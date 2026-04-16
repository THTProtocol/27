//! HTP Rust Backend
//!
//! Axum HTTP server — all core HTP business logic in native Rust.
//!
//! Modules ported from JS:
//!   wallet.rs      ← htp-wallet-v3.js (BIP39/BIP44 derivation, balance)
//!   escrow.rs      ← htp-covenant-escrow-v2.js (P2SH script, payout, cancel)
//!   fee.rs         ← htp-fee-engine.js (skill game fees, maximizer logic)
//!   settlement.rs  ← htp-autopayout-engine.js (preview, covenant integrity)
//!   deadline.rs    ← htp-match-deadline.js (DAA-score timing)
//!   utxo_mutex.rs  ← htp-utxo-mutex.js (per-match concurrency guard)
//!   oracle.rs      ← htp-oracle-server.js (Connect4, TicTacToe, Chess, Resign)
//!   blockdag.rs    ← dag-background.js data layer
//!   broadcast.rs   ← Kaspa REST broadcast
//!
//! Default: http://localhost:3000
//! Production: Cloud Run (PORT env var)

mod types;
mod wallet;
mod escrow;
mod fee;
mod settlement;
mod deadline;
mod utxo_mutex;
mod oracle;
mod blockdag;
mod broadcast;

use axum::{
    extract::{Path, Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use std::{net::SocketAddr, sync::Arc};

/// Shared application state.
#[derive(Clone)]
struct AppState {
    api_base: String,
}

fn api_base() -> String {
    std::env::var("KASPA_API_BASE")
        .unwrap_or_else(|_| "https://api-tn12.kaspa.org".to_string())
}

// ============================================================
// Health
// ============================================================

async fn health(State(s): State<Arc<AppState>>) -> impl IntoResponse {
    Json(types::HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        network: std::env::var("KASPA_NETWORK")
            .unwrap_or_else(|_| "testnet-12".to_string()),
    })
}

// ============================================================
// Wallet routes
// ============================================================

async fn wallet_from_mnemonic(
    Json(req): Json<types::MnemonicRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    wallet::derive_from_mnemonic(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn wallet_balance(
    State(s): State<Arc<AppState>>,
    Path(addr): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    wallet::fetch_balance(&addr, &s.api_base)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ============================================================
// Escrow routes
// ============================================================

async fn escrow_create(
    Json(req): Json<types::EscrowCreateRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    escrow::create_escrow(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn escrow_payout(
    Json(req): Json<types::EscrowPayoutRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    escrow::build_payout(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn escrow_cancel(
    Json(req): Json<types::EscrowCancelRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    escrow::build_cancel(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

// ============================================================
// Fee routes  (htp-fee-engine.js)
// ============================================================

async fn fee_skill_settle(
    Json(req): Json<types::FeeSkillSettleRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    fee::skill_game_settle(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn fee_cancel_check(
    Json(req): Json<types::CancelCheckRequest>,
) -> impl IntoResponse {
    Json(fee::skill_game_can_cancel(&req.game_status, req.opponent_joined))
}

async fn fee_maximizer_win(
    Json(req): Json<types::MaximizerWinRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    fee::maximizer_win_settle(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn fee_maximizer_lose(
    Json(req): Json<types::MaximizerLoseRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    fee::maximizer_lose_settle(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn fee_treasury(
    Json(req): Json<types::TreasuryRequest>,
) -> impl IntoResponse {
    let network = req.network.as_deref().unwrap_or("testnet-12");
    Json(types::TreasuryResponse {
        treasury_address: fee::treasury_address(network).to_string(),
        network: network.to_string(),
    })
}

// ============================================================
// Settlement routes  (htp-autopayout-engine.js / htp-settlement-preview.js)
// ============================================================

async fn settlement_preview(
    Json(req): Json<types::SettlementPreviewRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    settlement::settlement_preview(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn settlement_covenant_validate(
    Json(req): Json<types::CovenantValidateRequest>,
) -> impl IntoResponse {
    Json(settlement::validate_covenant(&req))
}

// ============================================================
// Deadline routes  (htp-match-deadline.js)
// ============================================================

async fn deadline_create(
    Json(req): Json<types::DeadlineCreateRequest>,
) -> impl IntoResponse {
    Json(deadline::create_deadline(&req))
}

async fn deadline_check(
    Json(req): Json<types::DeadlineCheckRequest>,
) -> impl IntoResponse {
    Json(deadline::check_deadline(&req))
}

async fn deadline_daa(
    State(s): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    deadline::fetch_current_daa(&s.api_base)
        .await
        .map(|daa| Json(types::DaaResponse { virtual_daa_score: daa }))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ============================================================
// Oracle routes  (htp-oracle-server.js)
// ============================================================

async fn oracle_connect4(
    Json(req): Json<oracle::Connect4Request>,
) -> impl IntoResponse {
    Json(oracle::validate_connect4_move(&req))
}

async fn oracle_tictactoe(
    Json(req): Json<oracle::TicTacToeRequest>,
) -> impl IntoResponse {
    Json(oracle::validate_tictactoe_move(&req))
}

async fn oracle_chess(
    Json(req): Json<oracle::ChessMoveRequest>,
) -> impl IntoResponse {
    Json(oracle::validate_chess_move(&req))
}

async fn oracle_resign(
    Json(req): Json<oracle::ResignRequest>,
) -> impl IntoResponse {
    Json(oracle::process_resign(&req))
}

// ============================================================
// BlockDAG + Broadcast routes
// ============================================================

async fn blockdag_live(
    State(s): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    blockdag::fetch_live_blocks(&s.api_base)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn tx_broadcast(
    State(s): State<Arc<AppState>>,
    Json(req): Json<types::BroadcastRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    broadcast::broadcast_tx(&req, &s.api_base)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ============================================================
// Server Setup
// ============================================================

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "htp_backend=info,tower_http=info".into()),
        )
        .init();

    let state = Arc::new(AppState { api_base: api_base() });

    let app = Router::new()
        // Health
        .route("/health",                         get(health))
        // Wallet
        .route("/wallet/from-mnemonic",            post(wallet_from_mnemonic))
        .route("/wallet/balance/{addr}",           get(wallet_balance))
        // Escrow
        .route("/escrow/create",                   post(escrow_create))
        .route("/escrow/payout",                   post(escrow_payout))
        .route("/escrow/cancel",                   post(escrow_cancel))
        // Fee engine
        .route("/fee/skill-settle",                post(fee_skill_settle))
        .route("/fee/cancel-check",                post(fee_cancel_check))
        .route("/fee/maximizer-win",               post(fee_maximizer_win))
        .route("/fee/maximizer-lose",              post(fee_maximizer_lose))
        .route("/fee/treasury",                    post(fee_treasury))
        // Settlement
        .route("/settlement/preview",              post(settlement_preview))
        .route("/settlement/validate-covenant",    post(settlement_covenant_validate))
        // Deadline (DAA-score timing)
        .route("/deadline/create",                 post(deadline_create))
        .route("/deadline/check",                  post(deadline_check))
        .route("/deadline/daa",                    get(deadline_daa))
        // Oracle (game validators)
        .route("/oracle/connect4",                 post(oracle_connect4))
        .route("/oracle/tictactoe",                post(oracle_tictactoe))
        .route("/oracle/chess",                    post(oracle_chess))
        .route("/oracle/resign",                   post(oracle_resign))
        // BlockDAG + Broadcast
        .route("/blockdag/live",                   get(blockdag_live))
        .route("/tx/broadcast",                    post(tx_broadcast))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("HTP Rust Backend v{} listening on http://{}", env!("CARGO_PKG_VERSION"), addr);
    tracing::info!("Network : {}", std::env::var("KASPA_NETWORK").unwrap_or_else(|_| "testnet-12".to_string()));
    tracing::info!("API base: {}", api_base());
    tracing::info!("Routes  : wallet | escrow | fee | settlement | deadline | oracle | blockdag | broadcast");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
