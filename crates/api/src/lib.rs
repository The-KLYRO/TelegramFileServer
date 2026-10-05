use axum::{
    Router,
    extract::{Json, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tfs_config::{
    CheckResponse, ConfigError, SaveResponse, Step1Input, Step2Input,
    appdata::{ConnectionStore, delete_connection, load_connection, save_connection},
    create_setup_config, verify_and_decrypt,
};
use tfs_db::{DbError, connect, has_config, load_config, save_config};
use thiserror::Error;

/// Validate Step1Input manually (mirrors tfs-config validation)
fn validate_step1(input: &Step1Input) -> Result<(), String> {
    if input.mongo_uri.is_empty() {
        return Err("MongoDB URI is required".to_string());
    }
    if input.password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }
    Ok(())
}

/// Validate Step2Input manually (mirrors tfs-config validation)
fn validate_step2(input: &Step2Input) -> Result<(), String> {
    if input.api_id <= 0 {
        return Err("API ID must be a positive integer".to_string());
    }
    if input.api_hash.is_empty() {
        return Err("API hash is required".to_string());
    }
    if input.bot_token_1.is_empty() {
        return Err("Bot token 1 is required".to_string());
    }
    if input.owner_id <= 0 {
        return Err("Owner ID must be a positive integer".to_string());
    }
    Ok(())
}

/// Response for GET /api/setup/resume - uses untagged enum to match exact JSON contract
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResumeResponse {
    /// No connection file found: {"saved":false}
    NotSaved(ResumeNotSaved),

    /// Configured: {"saved":true,"configured":true,"api_id":...,"owner_id":...,"bot_count":...}
    Configured(ResumeConfigured),

    /// Valid connection, no config in DB: {"saved":true,"configured":false,"connection":{...}}
    NotConfigured(ResumeNotConfigured),

    /// Password mismatch (file deleted): {"saved":true,"configured":false,"stale":true,"reason":"password-mismatch"}
    StalePasswordMismatch(ResumeStalePasswordMismatch),

    /// Mongo unreachable (file kept): {"saved":true,"configured":false,"stale":true,"reason":"connection-failed","connection":{...}}
    StaleConnectionFailed(ResumeStaleConnectionFailed),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeNotSaved {
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeConfigured {
    pub saved: bool,
    pub configured: bool,
    pub api_id: i64,
    pub owner_id: i64,
    pub bot_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeNotConfigured {
    pub saved: bool,
    pub configured: bool,
    pub connection: ConnectionStore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeStalePasswordMismatch {
    pub saved: bool,
    pub configured: bool,
    pub stale: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeStaleConnectionFailed {
    pub saved: bool,
    pub configured: bool,
    pub stale: bool,
    pub reason: String,
    pub connection: ConnectionStore,
}

impl ResumeResponse {
    fn not_saved() -> Self {
        Self::NotSaved(ResumeNotSaved { saved: false })
    }

    fn saved_configured(api_id: i64, owner_id: i64, bot_count: usize) -> Self {
        Self::Configured(ResumeConfigured {
            saved: true,
            configured: true,
            api_id,
            owner_id,
            bot_count,
        })
    }

    fn saved_not_configured(connection: ConnectionStore) -> Self {
        Self::NotConfigured(ResumeNotConfigured {
            saved: true,
            configured: false,
            connection,
        })
    }

    fn saved_stale_password_mismatch() -> Self {
        Self::StalePasswordMismatch(ResumeStalePasswordMismatch {
            saved: true,
            configured: false,
            stale: true,
            reason: "password-mismatch".to_string(),
        })
    }

    fn saved_stale_connection_failed(connection: ConnectionStore) -> Self {
        Self::StaleConnectionFailed(ResumeStaleConnectionFailed {
            saved: true,
            configured: false,
            stale: true,
            reason: "connection-failed".to_string(),
            connection,
        })
    }
}

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("database error: {0}")]
    Database(#[from] DbError),
    #[error("config error: {0}")]
    Config(#[from] ConfigError),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        ApiError::Internal(e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            ApiError::Database(DbError::Connection(e)) => (
                StatusCode::BAD_GATEWAY,
                format!("MongoDB connection failed: {}", e),
            ),
            ApiError::Database(DbError::NotFound) => {
                (StatusCode::NOT_FOUND, "Configuration not found".to_string())
            }
            ApiError::Config(ConfigError::InvalidPassword(msg)) => {
                (StatusCode::UNAUTHORIZED, msg.clone())
            }
            ApiError::Config(ConfigError::Validation(msg)) => {
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            ApiError::Validation(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            ApiError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(serde_json::json!({ "error": error_message }));
        (status, body).into_response()
    }
}

pub type ApiResult<T> = std::result::Result<T, ApiError>;

#[derive(Clone)]
pub struct AppState {
    pub mongo_uri: String,
}

impl AppState {
    pub fn new(mongo_uri: String) -> Self {
        Self { mongo_uri }
    }
}

/// POST /api/setup/check
async fn check_setup(
    State(state): State<Arc<AppState>>,
    Json(input): Json<Step1Input>,
) -> ApiResult<Json<CheckResponse>> {
    validate_step1(&input).map_err(ApiError::Validation)?;

    let client = connect(&state.mongo_uri).await?;

    if !has_config(&client).await? {
        return Ok(Json(CheckResponse {
            configured: false,
            api_id: None,
            owner_id: None,
            bot_count: None,
            error: None,
        }));
    }

    let config = load_config(&client).await?;
    let sensitive = verify_and_decrypt(&config, &input.password)?;

    // Persist connection on successful verification
    let store = ConnectionStore {
        mongo_uri: state.mongo_uri.clone(),
        password: input.password.clone(),
    };
    if let Err(e) = save_connection(&store) {
        tracing::warn!("Failed to persist connection: {}", e);
    }

    Ok(Json(CheckResponse {
        configured: true,
        api_id: Some(config.api_id),
        owner_id: Some(config.owner_id),
        bot_count: Some(sensitive.bot_tokens.len()),
        error: None,
    }))
}

/// POST /api/setup/save
async fn save_setup(
    State(state): State<Arc<AppState>>,
    Json(input): Json<SaveSetupInput>,
) -> ApiResult<Json<SaveResponse>> {
    // Validate step1
    let step1 = Step1Input {
        mongo_uri: state.mongo_uri.clone(),
        password: input.password.clone(),
    };
    validate_step1(&step1).map_err(ApiError::Validation)?;

    // Validate step2
    let step2 = Step2Input {
        api_id: input.api_id,
        api_hash: input.api_hash.clone(),
        bot_token_1: input.bot_token_1.clone(),
        bot_token_2: input.bot_token_2.clone(),
        bot_token_3: input.bot_token_3.clone(),
        owner_id: input.owner_id,
    };
    validate_step2(&step2).map_err(ApiError::Validation)?;

    let client = connect(&state.mongo_uri).await?;

    // Check if config already exists
    if has_config(&client).await? {
        // Verify password matches existing config
        let existing = load_config(&client).await?;
        verify_and_decrypt(&existing, &input.password).map_err(|_| {
            ApiError::Config(ConfigError::InvalidPassword(
                "password doesn't match existing config".to_string(),
            ))
        })?;
    }

    let config = create_setup_config(&step1, &step2)?;
    save_config(&client, &config).await?;

    // Persist connection after successful save
    let store = ConnectionStore {
        mongo_uri: state.mongo_uri.clone(),
        password: input.password.clone(),
    };
    if let Err(e) = save_connection(&store) {
        tracing::warn!("Failed to persist connection: {}", e);
    }

    Ok(Json(SaveResponse {
        ok: true,
        error: None,
    }))
}

/// GET /api/setup/resume
async fn resume_setup(State(_state): State<Arc<AppState>>) -> ApiResult<Json<ResumeResponse>> {
    // Try to load connection from local storage
    let Some(store) = load_connection()? else {
        return Ok(Json(ResumeResponse::not_saved()));
    };

    // Try to connect to MongoDB
    let client = match connect(&store.mongo_uri).await {
        Ok(c) => c,
        Err(_) => {
            // Case 5: MongoDB unreachable - keep file, return stale with connection info
            return Ok(Json(ResumeResponse::saved_stale_connection_failed(store)));
        }
    };

    // Check if config exists in database
    let has_config_doc = match has_config(&client).await {
        Ok(true) => true,
        Ok(false) => false,
        Err(_) => {
            // DB error - treat as connection failed
            return Ok(Json(ResumeResponse::saved_stale_connection_failed(store)));
        }
    };

    if !has_config_doc {
        // Case 3: Connection file exists but no config doc in DB
        return Ok(Json(ResumeResponse::saved_not_configured(store)));
    }

    // Config exists - try to verify password
    let config = match load_config(&client).await {
        Ok(c) => c,
        Err(_) => {
            return Ok(Json(ResumeResponse::saved_stale_connection_failed(store)));
        }
    };

    match verify_and_decrypt(&config, &store.password) {
        Ok(sensitive) => {
            // Case 2: Password verifies - return configured info
            Ok(Json(ResumeResponse::saved_configured(
                config.api_id,
                config.owner_id,
                sensitive.bot_tokens.len(),
            )))
        }
        Err(_) => {
            // Case 4: Password mismatch - delete file and return stale
            let _ = delete_connection();
            Ok(Json(ResumeResponse::saved_stale_password_mismatch()))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveSetupInput {
    pub password: String,
    pub api_id: i64,
    pub api_hash: String,
    pub bot_token_1: String,
    pub bot_token_2: Option<String>,
    pub bot_token_3: Option<String>,
    pub owner_id: i64,
}

pub fn router(mongo_uri: String) -> Router {
    let state = Arc::new(AppState::new(mongo_uri));
    Router::new()
        .route("/api/setup/check", post(check_setup))
        .route("/api/setup/save", post(save_setup))
        .route("/api/setup/resume", get(resume_setup))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::tempdir;

    #[test]
    fn test_validate_step1_valid() {
        let input = Step1Input {
            mongo_uri: "mongodb://localhost:27017".to_string(),
            password: "password123".to_string(),
        };
        assert!(validate_step1(&input).is_ok());
    }

    #[test]
    fn test_validate_step1_empty_mongo_uri() {
        let input = Step1Input {
            mongo_uri: "".to_string(),
            password: "password123".to_string(),
        };
        let err = validate_step1(&input).unwrap_err();
        assert!(err.contains("MongoDB URI is required"));
    }

    #[test]
    fn test_validate_step1_short_password() {
        let input = Step1Input {
            mongo_uri: "mongodb://localhost:27017".to_string(),
            password: "short".to_string(),
        };
        let err = validate_step1(&input).unwrap_err();
        assert!(err.contains("Password must be at least 8 characters"));
    }

    #[test]
    fn test_validate_step2_valid() {
        let input = Step2Input {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: Some("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew12".to_string()),
            bot_token_3: None,
            owner_id: 987654321,
        };
        assert!(validate_step2(&input).is_ok());
    }

    #[test]
    fn test_validate_step2_zero_api_id() {
        let input = Step2Input {
            api_id: 0,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: None,
            bot_token_3: None,
            owner_id: 987654321,
        };
        let err = validate_step2(&input).unwrap_err();
        assert!(err.contains("API ID must be a positive integer"));
    }

    #[test]
    fn test_validate_step2_empty_api_hash() {
        let input = Step2Input {
            api_id: 123456,
            api_hash: "".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: None,
            bot_token_3: None,
            owner_id: 987654321,
        };
        let err = validate_step2(&input).unwrap_err();
        assert!(err.contains("API hash is required"));
    }

    #[test]
    fn test_validate_step2_empty_bot_token() {
        let input = Step2Input {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "".to_string(),
            bot_token_2: None,
            bot_token_3: None,
            owner_id: 987654321,
        };
        let err = validate_step2(&input).unwrap_err();
        assert!(err.contains("Bot token 1 is required"));
    }

    #[test]
    fn test_validate_step2_zero_owner_id() {
        let input = Step2Input {
            api_id: 123456,
            api_hash: "abcdef1234567890abcdef1234567890".to_string(),
            bot_token_1: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11".to_string(),
            bot_token_2: None,
            bot_token_3: None,
            owner_id: 0,
        };
        let err = validate_step2(&input).unwrap_err();
        assert!(err.contains("Owner ID must be a positive integer"));
    }

    // Both resume tests mutate TFS_DATA_DIR; serialize them to avoid env races.
    // The guard spans an await on purpose: each #[tokio::test] runs on its own
    // OS thread with a current_thread runtime, so holding a std Mutex here
    // cannot starve the runtime (the whole test *is* the critical section).
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[tokio::test]
    #[allow(clippy::await_holding_lock)]
    async fn test_resume_no_connection_file() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        unsafe { env::set_var("TFS_DATA_DIR", temp_dir.path()) };

        let result = resume_setup(State(Arc::new(AppState::new(
            "mongodb://localhost:27017".to_string(),
        ))))
        .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        match response.0 {
            ResumeResponse::NotSaved(inner) => assert!(!inner.saved),
            _ => panic!("expected NotSaved variant"),
        }

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }

    #[tokio::test]
    #[allow(clippy::await_holding_lock)]
    async fn test_resume_connection_file_no_mongo() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp_dir = tempdir().unwrap();
        unsafe { env::set_var("TFS_DATA_DIR", temp_dir.path()) };

        // Create a connection file
        let store = tfs_config::appdata::ConnectionStore {
            mongo_uri: "mongodb://invalid-host:27017".to_string(),
            password: "password123".to_string(),
        };
        tfs_config::appdata::save_connection(&store).unwrap();

        let result = resume_setup(State(Arc::new(AppState::new(
            "mongodb://localhost:27017".to_string(),
        ))))
        .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        match response.0 {
            ResumeResponse::StaleConnectionFailed(inner) => {
                assert!(inner.saved);
                assert!(!inner.configured);
                assert!(inner.stale);
                assert_eq!(inner.reason, "connection-failed");
                assert_eq!(inner.connection.mongo_uri, "mongodb://invalid-host:27017");
                assert_eq!(inner.connection.password, "password123");
            }
            _ => panic!("expected StaleConnectionFailed variant"),
        }

        unsafe { env::remove_var("TFS_DATA_DIR") };
    }
}
