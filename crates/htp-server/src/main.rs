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
pub mod covenant_derive;

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

    routes::spawn_auto_settler(Arc::clone(&state));
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
        .route("/api/games/:id/join", post(routes::join_game))
        .route("/api/games/:id/challenge", post(routes::challenge_game))
        .route("/api/games/:id/guardian", post(routes::guardian_override))
        .route("/api/markets/:id/attest-payout", post(routes::attest_payout))
        .route("/api/proof-commit",           post(routes::proof_commit_route))
        .route("/api/balance/:address", get(routes::balance_route))
        .route("/api/games", get(routes::list_games))
        .route("/api/games/:id/settlement", get(routes::get_settlement))
        // Orders (migrated from Node to Rust)
        .route("/api/orders", axum::routing::get(routes::list_orders_handler).post(routes::create_order_handler))
        .route("/api/orders/stats", axum::routing::get(routes::order_stats_handler))
        .route("/api/orders/:id", axum::routing::get(routes::get_order_handler))
        .route("/api/orders/:id/match", axum::routing::post(routes::match_order_handler))
        .route("/api/orders/:id/cancel", axum::routing::post(routes::cancel_order_handler))
        // Portfolio
        .route("/api/portfolio/:addr", axum::routing::get(routes::portfolio_handler))
        // Events
        .route("/api/events/:id", axum::routing::get(routes::list_events_handler))
        .route("/api/events", axum::routing::get(routes::list_events_handler).post(routes::create_event_handler))
        .route("/api/events/:id/attest", axum::routing::post(routes::attest_event_handler))
        .route("/api/events/:id/attestations", axum::routing::get(routes::get_event_attestations_handler))
        .route("/api/operators", axum::routing::get(routes::list_operators_handler).post(routes::register_operator_handler))
        .route("/api/events/:id/settle", axum::routing::post(routes::settle_event_handler))
        .route("/api/oracle/register", axum::routing::post(routes::oracle_register))
        .route("/api/oracle/attest",   axum::routing::post(routes::oracle_attest))
        .route("/api/oracle/quorum/:game_id", axum::routing::get(routes::oracle_quorum))
        .route("/api/oracle/slash",    axum::routing::post(routes::oracle_slash))
        .route("/api/oracle/list",     axum::routing::get(routes::oracle_list))
        .route("/api/oracle/:id",      axum::routing::get(routes::oracle_get))
        .route("/api/oracle/:id/activate", axum::routing::post(routes::oracle_activate))
        .route("/api/oracle/:id/exit",     axum::routing::post(routes::oracle_exit))
        .route("/api/oracle/network",  axum::routing::get(routes::oracle_network_stats))
        .route("/ws", get(ws::ws_handler))
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(tower_http::limit::RequestBodyLimitLayer::new(64 * 1024))
        .route("/api/maximizer/stats", get(routes::maximizer_stats))
        .route("/api/maximizer/pools", get(routes::maximizer_pools))
        .route("/api/maximizer/pools/create", post(routes::maximizer_create_pool))
        .route("/api/maximizer/enter", post(routes::maximizer_enter))
        .route("/api/settler/status", get(routes::settler_status))
        .with_state(state);

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse().expect("PORT must be number");
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("[HTP Server] Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
