//! HTP Server — Axum HTTP/WS backend replacing server.js
//! Endpoints:
//!   POST /api/games          create game
//!   GET  /api/games/:id      get state
//!   POST /api/games/:id/move apply move
//!   POST /api/games/:id/settle  settle payout
//!   GET  /health             liveness
//!   WS   /ws                 relay channel

mod routes;
mod state;
mod ws;
mod signing;

use axum::{
    Router,
    routing::{get, post},
    middleware,
};
use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use state::AppState;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "htp_server=debug,tower_http=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(AppState::new());
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/api/games", post(routes::create_game))
        .route("/api/games/:id", get(routes::get_game))
        .route("/api/games/:id/move", post(routes::apply_move))
        .route("/api/games/:id/settle", post(routes::settle_game))
        .route("/ws", get(ws::ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse()
        .expect("PORT must be a number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("[HTP Server] Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
