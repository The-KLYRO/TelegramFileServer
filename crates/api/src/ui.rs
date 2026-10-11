//! WebUI support endpoints: settings, favorites, recents, session probes,
//! log ingestion, and the `/api/events` SSE bus.
//!
//! These back the browser SPA's `invoke()` shims in `webui/src/lib/ipc/core.ts`.
//! Handlers that touch per-user data require a session; the two session probes
//! and log ingestion are open because they reveal nothing per-user and the
//! server binds 127.0.0.1 only.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header::CONTENT_TYPE},
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
};
use futures::{Stream, TryStreamExt};
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, sync::Arc};

use crate::{
    ApiError, ApiResult, AppState, DbError, data_database_name, files::require_media_session,
    require_session,
};

/// Truncate client log lines so a buggy page cannot flood the server log.
const MAX_LOG_MESSAGE_CHARS: usize = 4096;

/// Map a raw driver error onto `ApiError` (the same DbError -> Database path
/// the handlers in lib.rs use, one `?` conversion shorter).
fn mongo_err(e: mongodb::error::Error) -> ApiError {
    ApiError::Database(DbError::from(e))
}

// ===== Settings (`v2_settings`) =====

/// One stored setting. The value is kept as raw JSON text so every JSON type
/// (string, number, bool, object) round-trips exactly; `_id` embeds the owner
/// so two accounts may use the same key.
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct SettingDoc {
    #[serde(rename = "_id")]
    pub(crate) id: String,
    pub(crate) owner_id: String,
    pub(crate) key: String,
    pub(crate) value_json: String,
}

fn settings_collection(client: &mongodb::Client) -> mongodb::Collection<SettingDoc> {
    client
        .database(&data_database_name())
        .collection("v2_settings")
}

fn validate_setting_key(key: &str) -> Result<(), ApiError> {
    if key.is_empty() || key.len() > 128 {
        return Err(ApiError::InvalidInput(
            "setting key must be 1-128 characters".to_string(),
        ));
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
    {
        return Err(ApiError::InvalidInput(
            "setting key may only contain letters, numbers, '.', '_', '-'".to_string(),
        ));
    }
    Ok(())
}

/// GET /api/settings/:key — the stored JSON value, or `null` when unset.
/// Returning 200 + null (instead of 404) keeps the console clean: the SPA
/// already treats a missing value as "use the default".
pub(crate) async fn settings_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> ApiResult<Response> {
    let owner = require_session(&headers, &state.sessions)?;
    validate_setting_key(&key)?;
    let client = state.mongo_client().await?;
    let Some(doc) = settings_collection(&client)
        .find_one(doc! { "_id": format!("{owner}:{key}") })
        .await
        .map_err(mongo_err)?
    else {
        return Ok(Json(serde_json::Value::Null).into_response());
    };
    Ok(([(CONTENT_TYPE, "application/json")], doc.value_json).into_response())
}

/// PUT /api/settings/:key — store any JSON value; 204 on success.
pub(crate) async fn settings_put(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(key): Path<String>,
    Json(value): Json<serde_json::Value>,
) -> ApiResult<StatusCode> {
    let owner = require_session(&headers, &state.sessions)?;
    validate_setting_key(&key)?;
    let value_json = serde_json::to_string(&value)
        .map_err(|e| ApiError::Internal(format!("setting value not serializable: {e}")))?;
    let client = state.mongo_client().await?;
    settings_collection(&client)
        .update_one(
            doc! { "_id": format!("{owner}:{key}") },
            doc! { "$set": { "owner_id": &owner, "key": &key, "value_json": &value_json } },
        )
        .upsert(true)
        .await
        .map_err(mongo_err)?;
    Ok(StatusCode::NO_CONTENT)
}

// ===== Favorites (`v2_favorites`) =====

/// One bookmarked folder. `_id` is owner+path so adding the same path twice
/// updates the label instead of duplicating the row; the numeric `id` handed
/// to the client (and used by DELETE) is set once at insert.
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct FavoriteDoc {
    #[serde(rename = "_id")]
    pub(crate) id: String,
    pub(crate) owner_id: String,
    pub(crate) numeric_id: i64,
    pub(crate) path: String,
    pub(crate) label: String,
    pub(crate) created_at: chrono::DateTime<chrono::Utc>,
}

fn favorites_collection(client: &mongodb::Client) -> mongodb::Collection<FavoriteDoc> {
    client
        .database(&data_database_name())
        .collection("v2_favorites")
}

#[derive(Debug, Serialize)]
pub(crate) struct FavoriteView {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) label: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct FavoriteAddRequest {
    pub(crate) path: String,
    pub(crate) label: String,
}

/// GET /api/favorites — every bookmark of the session's owner.
pub(crate) async fn favorites_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<FavoriteView>>> {
    let owner = require_session(&headers, &state.sessions)?;
    let client = state.mongo_client().await?;
    let mut cursor = favorites_collection(&client)
        .find(doc! { "owner_id": &owner })
        .sort(doc! { "path": 1 })
        .await
        .map_err(mongo_err)?;
    let mut rows = Vec::new();
    while let Some(doc) = cursor.try_next().await.map_err(mongo_err)? {
        rows.push(FavoriteView {
            id: doc.numeric_id,
            path: doc.path,
            label: doc.label,
        });
    }
    Ok(Json(rows))
}

/// POST /api/favorites — upsert one bookmark by path; 204.
pub(crate) async fn favorites_add(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<FavoriteAddRequest>,
) -> ApiResult<StatusCode> {
    let owner = require_session(&headers, &state.sessions)?;
    let path = input.path.trim();
    let label = input.label.trim();
    if path.is_empty() {
        return Err(ApiError::InvalidInput(
            "favorite path must not be empty".to_string(),
        ));
    }
    if label.is_empty() {
        return Err(ApiError::InvalidInput(
            "favorite label must not be empty".to_string(),
        ));
    }
    let client = state.mongo_client().await?;
    let now = chrono::Utc::now();
    favorites_collection(&client)
        .update_one(
            doc! { "_id": format!("{owner}:{path}") },
            doc! {
                "$set": {
                    "owner_id": &owner,
                    "path": path,
                    "label": label,
                },
                "$setOnInsert": {
                    "numeric_id": now.timestamp_micros(),
                    "created_at": now.to_rfc3339(),
                },
            },
        )
        .upsert(true)
        .await
        .map_err(mongo_err)?;
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/favorites/:id — drop one bookmark by its numeric id; 204 even
/// when nothing matched (idempotent, the SPA ignores the outcome).
pub(crate) async fn favorites_remove(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let owner = require_session(&headers, &state.sessions)?;
    let numeric_id = id
        .parse::<i64>()
        .map_err(|_| ApiError::InvalidInput("favorite id must be an integer".to_string()))?;
    let client = state.mongo_client().await?;
    favorites_collection(&client)
        .delete_one(doc! { "owner_id": &owner, "numeric_id": numeric_id })
        .await
        .map_err(mongo_err)?;
    Ok(StatusCode::NO_CONTENT)
}

// ===== Recents (`v2_recents`) =====

/// One recently-visited folder. `_id` is owner+path so revisiting a folder
/// refreshes `last_opened` instead of adding a second row.
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct RecentDoc {
    #[serde(rename = "_id")]
    pub(crate) id: String,
    pub(crate) owner_id: String,
    pub(crate) numeric_id: i64,
    pub(crate) path: String,
    pub(crate) last_opened: chrono::DateTime<chrono::Utc>,
}

fn recents_collection(client: &mongodb::Client) -> mongodb::Collection<RecentDoc> {
    client
        .database(&data_database_name())
        .collection("v2_recents")
}

#[derive(Debug, Serialize)]
pub(crate) struct RecentView {
    pub(crate) id: i64,
    pub(crate) path: String,
    pub(crate) last_opened: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RecentsQuery {
    pub(crate) limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RecentAddRequest {
    pub(crate) path: String,
}

/// GET /api/recents — most-recently-opened folders first.
pub(crate) async fn recents_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RecentsQuery>,
) -> ApiResult<Json<Vec<RecentView>>> {
    let owner = require_session(&headers, &state.sessions)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let client = state.mongo_client().await?;
    let mut cursor = recents_collection(&client)
        .find(doc! { "owner_id": &owner })
        .sort(doc! { "last_opened": -1 })
        .limit(limit)
        .await
        .map_err(mongo_err)?;
    let mut rows = Vec::new();
    while let Some(doc) = cursor.try_next().await.map_err(mongo_err)? {
        rows.push(RecentView {
            id: doc.numeric_id,
            path: doc.path,
            last_opened: doc.last_opened.to_rfc3339(),
        });
    }
    Ok(Json(rows))
}

/// POST /api/recents — record one visit (upsert); 204.
pub(crate) async fn recents_add(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<RecentAddRequest>,
) -> ApiResult<StatusCode> {
    let owner = require_session(&headers, &state.sessions)?;
    let path = input.path.trim();
    if path.is_empty() {
        return Err(ApiError::InvalidInput(
            "recent path must not be empty".to_string(),
        ));
    }
    let client = state.mongo_client().await?;
    let now = chrono::Utc::now();
    recents_collection(&client)
        .update_one(
            doc! { "_id": format!("{owner}:{path}") },
            doc! {
                "$set": {
                    "owner_id": &owner,
                    "path": path,
                    "last_opened": now.to_rfc3339(),
                },
                "$setOnInsert": { "numeric_id": now.timestamp_micros() },
            },
        )
        .upsert(true)
        .await
        .map_err(mongo_err)?;
    Ok(StatusCode::NO_CONTENT)
}

// ===== Session probes =====

/// GET /api/session/readiness — everything is ready in the browser build:
/// no native runtime to check, credentials come from config.tfs. Unauthenticated;
/// reveals nothing per-user.
pub(crate) async fn session_readiness() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "webview2": { "state": "Ready" },
        "credentials": {
            "state": "CredentialsReady",
            "blocking_title": "",
            "blocking_message": "",
            "source": "server",
            "tdlib_present": true,
            "tmdb_present": true,
        },
        "telegram_runtime": {
            "state": "Ready",
            "blocking_title": "",
            "blocking_message": "",
            "diagnostics": {
                "executable_path": "",
                "install_dir": "",
                "bin_dir": "",
                "tdjson_path": "",
                "dll_checks": [],
                "architecture_expectation": "",
                "loader_flags": [],
            },
        },
    }))
}

/// GET /api/session/auth — the browser build talks to the server over HTTP
/// with its own sessions, so the Telegram layer is always "ready". The SPA
/// only checks for this exact state string.
pub(crate) async fn session_auth() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "state": "authorizationStateReady" }))
}

// ===== Log ingestion =====

#[derive(Debug, Deserialize)]
pub(crate) struct LogRequest {
    pub(crate) level: String,
    pub(crate) message: String,
}

/// POST /api/logs — accept a browser log line and forward it to tracing.
/// Unauthenticated: the server is loopback-only and the browser has no
/// session yet when early errors fire.
pub(crate) async fn logs_ingest(Json(input): Json<LogRequest>) -> ApiResult<StatusCode> {
    let message = if input.message.chars().count() > MAX_LOG_MESSAGE_CHARS {
        let truncated: String = input.message.chars().take(MAX_LOG_MESSAGE_CHARS).collect();
        tracing::warn!(
            target: "webui",
            "log line truncated from {} to {MAX_LOG_MESSAGE_CHARS} chars",
            input.message.chars().count()
        );
        truncated
    } else {
        input.message
    };
    match input.level.as_str() {
        "debug" => tracing::debug!(target: "webui", "{message}"),
        "info" => tracing::info!(target: "webui", "{message}"),
        "warn" => tracing::warn!(target: "webui", "{message}"),
        "error" => tracing::error!(target: "webui", "{message}"),
        other => {
            return Err(ApiError::InvalidInput(format!(
                "unknown log level: {other}"
            )));
        }
    }
    Ok(StatusCode::NO_CONTENT)
}

// ===== Event stream =====

#[derive(Debug, Deserialize)]
pub(crate) struct EventsQuery {
    pub(crate) token: Option<String>,
}

/// GET /api/events — server-sent events for every session-scoped push
/// (uploads, index progress, file updates). `EventSource` cannot set
/// headers, so the session token arrives as `?token=` (the Authorization
/// header still works for other clients). Payloads are JSON objects shaped
/// `{ "type": ..., "payload": ... }`.
pub(crate) async fn events_sse(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<EventsQuery>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    // The media-session helper already accepts header-or-query tokens.
    require_media_session(&headers, query.token.as_deref(), &state.sessions)?;

    let receiver = state.events.subscribe();
    let stream = futures::stream::unfold(receiver, |mut receiver| async move {
        loop {
            match receiver.recv().await {
                Ok(value) => {
                    let data = serde_json::to_string(&value).unwrap_or_else(|_| "{}".to_string());
                    return Some((Ok(Event::default().data(data)), receiver));
                }
                // A slow reader drops old events; keep the stream alive.
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
            }
        }
    });
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// Unknown /api/* paths answer JSON 404 instead of the SPA's index.html
/// (which arrives as `200 text/html` and breaks `response.json()`).
pub(crate) async fn api_not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(serde_json::json!({ "error": "not found" })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setting_key_accepts_the_shapes_the_spa_saves() {
        assert!(validate_setting_key("explorer.view_mode").is_ok());
        assert!(validate_setting_key("skybox_runtime_notice").is_ok());
        assert!(validate_setting_key("a").is_ok());
    }

    #[test]
    fn setting_key_rejects_empty_oversized_and_punctuation() {
        assert!(validate_setting_key("").is_err());
        assert!(validate_setting_key(&"x".repeat(129)).is_err());
        assert!(validate_setting_key("a/b").is_err());
        assert!(validate_setting_key("a:b").is_err());
        assert!(validate_setting_key("a b").is_err());
    }
}
