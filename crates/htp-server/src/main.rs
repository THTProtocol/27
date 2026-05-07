//! HTP Server - Axum HTTP/WS backend (Phase 8 clean)

mod routes;
mod state;
mod ws;
mod signing;
mod observability;
mod proof_commit;
mod settlement_guard;
mod api_models;
mod game_chess;
mod game_connect4;
mod game_checkers;
mod zk_proof;
mod covenant_id;
mod oracle;
mod db;

use axum::{Router, routing::{get, post}};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
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

    let db_path = std::env::var("HTP_DB_PATH").unwrap_or_else(|_| "/root/htp/htp.db".into());
    let database = match crate::db::HtpDb::open(&db_path) {
        Ok(d) => { tracing::info!("Database opened: {}", db_path); d }
        Err(e) => { tracing::error!("Cannot open DB at {}: {}", db_path, e); std::process::exit(1); }
    };
    let state = Arc::new(AppState::new(database));
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/api/admin/stats", get(routes::admin_stats))
        .route("/api/covenants/deployed", get(routes::covenants_deployed))
        .route("/metrics", get(routes::metrics_handler))
        .route("/api/stats", get(routes::metrics_handler))
        .route("/api/config", get(routes::config))
        .route("/api/games", post(routes::create_game))
        .route("/api/games/:id", get(routes::get_game))
        .route("/api/games/:id/move", post(routes::apply_move))
        .route("/api/games/:id/settle", post(routes::settle_game))
        .route("/api/games/:id/chess-move", post(routes::chess_game_move))
        .route("/api/proof/preview", get(routes::proof_preview))
        .route("/api/chess/move", post(routes::chess_move))
        .route("/api/c4/drop", post(routes::c4_drop))
        .route("/api/checkers/move", post(routes::checkers_move))
        .route("/api/zk/prove", post(routes::zk_prove))
        .route("/api/zk/status", get(routes::zk_status_handler))
        .route("/api/covenant/register", post(routes::covenant_register))
        .route("/api/covenant/:mid/advance", post(routes::covenant_advance))
        .route("/api/covenant/:mid", get(routes::covenant_get))
        .route("/api/games/:id/propose",      post(routes::propose_settle))
        .route("/api/markets/:id/attest-payout", post(routes::attest_payout))
        .route("/api/proof-commit",           post(routes::proof_commit_route))
        .route("/api/balance/:address", get(routes::balance_route))
        .route("/api/games", get(routes::list_games))
        .route("/api/games/:id/settlement", get(routes::get_settlement))
        .route("/ws", get(ws::ws_handler))
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::limit::RequestBodyLimitLayer::new(64 * 1024))
        .with_state(state);

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse().expect("PORT must be number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("[HTP Server] Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
