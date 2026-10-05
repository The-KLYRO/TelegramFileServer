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
    let serve_dir = ServeDir::new(static_dir)
        .append_index_html_on_directories(true)
        .fallback(ServeFile::new(format!("{}/setup.html", static_dir)));

    // tfs_api::router already registers absolute paths (/api/setup/*),
    // so merge it directly — do not nest it under another /api prefix.
    let app = Router::new()
        .route("/healthz", get(healthz))
        .merge(api_router(mongo_uri))
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
