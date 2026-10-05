use axum::{
    Router,
    response::{IntoResponse, Json},
    routing::get,
};
use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use tfs_api::router as api_router;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let mongo_uri =
        std::env::var("MONGO_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8090);

    let static_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/static");
    let webui_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/static/webui");
    let webui_index = format!("{}/index.html", webui_dir);

    // Serve /webui/ with SPA fallback: unknown paths → index.html (history routing).
    // - Existing files (assets/*, index.html) served normally
    // - Unknown subpaths (/webui/explorer, /webui/settings/...) → index.html
    // - If index.html missing → 404 (ServeFile returns 404 on absent file)
    // - /webui (no trailing slash) → redirect to /webui/ via append_index_html_on_directories
    let webui_service = ServeDir::new(webui_dir)
        .append_index_html_on_directories(true)
        .fallback(ServeFile::new(webui_index));

    // Main static files (icon.png, etc.) with fallback to setup.html for the wizard.
    let serve_dir = ServeDir::new(static_dir)
        .append_index_html_on_directories(true)
        .fallback(ServeFile::new(format!("{}/setup.html", static_dir)));

    // tfs_api::router already registers absolute paths (/api/setup/*),
    // so merge it directly — do not nest it under another /api prefix.
    let app = Router::new()
        .route("/healthz", get(healthz))
        .merge(api_router(mongo_uri))
        .nest_service("/webui", webui_service)
        .fallback_service(serve_dir);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Server listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn healthz() -> impl IntoResponse {
    let version = env!("CARGO_PKG_VERSION");
    Json(serde_json::json!({ "status": "ok", "version": version }))
}
