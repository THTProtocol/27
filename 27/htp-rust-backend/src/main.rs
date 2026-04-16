//! HTP Rust Backend v0.4.0
//!
//! Axum HTTP server — ALL HTP business logic in native Rust.
//!
//! JS files fully deleted (logic now in Rust):
//!   htp-fee-engine.js      → fee.rs
//!   htp-match-deadline.js  → deadline.rs
//!   htp-utxo-mutex.js      → utxo_mutex.rs
//!   htp-oracle-pipeline.js → oracle_commit.rs
//!   htp-zk-pipeline.js     → oracle_commit.rs
//!
//! JS files replaced with thin browser shims:
//!   htp-covenant-escrow-v2.js → escrow.rs  (/escrow/*)
//!   htp-autopayout-engine.js  → autopayout.rs (/autopayout/*)
//!   htp-rpc-client.js         → wallet.rs + blockdag.rs
//!   htp-event-creator.js      → markets.rs (/markets/create)
//!   htp-events-v3.js          → markets.rs (/markets/list via Firebase proxy)
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
mod oracle_commit;
mod markets;
mod autopayout;
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

#[derive(Clone)]
struct AppState {
    api_base: String,
}

fn api_base() -> String {
    std::env::var("KASPA_API_BASE")
        .unwrap_or_else(|_| "https://api-tn12.kaspa.org".to_string())
}

// ── Health ────────────────────────────────────────────────────────────────────

async fn health(State(_s): State<Arc<AppState>>) -> impl IntoResponse {
    Json(types::HealthResponse {
        status:  "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        network: std::env::var("KASPA_NETWORK")
            .unwrap_or_else(|_| "testnet-12".to_string()),
    })
}

// ── Wallet ────────────────────────────────────────────────────────────────────

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

// ── Escrow ────────────────────────────────────────────────────────────────────

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

// ── Fee Engine ────────────────────────────────────────────────────────────────

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

// ── Settlement ────────────────────────────────────────────────────────────────

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

// ── Deadline ──────────────────────────────────────────────────────────────────

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

// ── Oracle Game Validators ────────────────────────────────────────────────────

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

// ── Oracle Commit Pipeline ────────────────────────────────────────────────────

async fn oracle_commit(
    Json(req): Json<types::OracleCommitRequest>,
) -> impl IntoResponse {
    Json(oracle_commit::submit_attestation(&req))
}

async fn oracle_auto_attest(
    Json(req): Json<types::AutoAttestRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    oracle_commit::auto_attest(&req)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ── Markets ───────────────────────────────────────────────────────────────────

async fn markets_create(
    Json(req): Json<types::MarketCreateRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    markets::create_market(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn markets_bet(
    Json(req): Json<types::BetPlaceRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    markets::validate_bet(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn markets_odds(
    Json(req): Json<types::OddsRequest>,
) -> impl IntoResponse {
    Json(markets::compute_odds(&req))
}

// ── Auto-Payout ───────────────────────────────────────────────────────────────

async fn autopayout_resolve(
    Json(req): Json<types::ResolveWinnerRequest>,
) -> impl IntoResponse {
    Json(autopayout::resolve_winner_address(&req))
}

async fn autopayout_prepare(
    Json(req): Json<types::PrepareSettlementRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    autopayout::prepare_settlement(&req)
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

// ── BlockDAG + Broadcast ──────────────────────────────────────────────────────

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

// ── Server ────────────────────────────────────────────────────────────────────

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
        .route("/health",                          get(health))
        // Wallet
        .route("/wallet/from-mnemonic",             post(wallet_from_mnemonic))
        .route("/wallet/balance/{addr}",            get(wallet_balance))
        // Escrow
        .route("/escrow/create",                    post(escrow_create))
        .route("/escrow/payout",                    post(escrow_payout))
        .route("/escrow/cancel",                    post(escrow_cancel))
        // Fee engine
        .route("/fee/skill-settle",                 post(fee_skill_settle))
        .route("/fee/cancel-check",                 post(fee_cancel_check))
        .route("/fee/maximizer-win",                post(fee_maximizer_win))
        .route("/fee/maximizer-lose",               post(fee_maximizer_lose))
        .route("/fee/treasury",                     post(fee_treasury))
        // Settlement
        .route("/settlement/preview",               post(settlement_preview))
        .route("/settlement/validate-covenant",     post(settlement_covenant_validate))
        // Deadline
        .route("/deadline/create",                  post(deadline_create))
        .route("/deadline/check",                   post(deadline_check))
        .route("/deadline/daa",                     get(deadline_daa))
        // Oracle — game validators
        .route("/oracle/connect4",                  post(oracle_connect4))
        .route("/oracle/tictactoe",                 post(oracle_tictactoe))
        .route("/oracle/chess",                     post(oracle_chess))
        .route("/oracle/resign",                    post(oracle_resign))
        // Oracle — commit pipeline
        .route("/oracle/commit",                    post(oracle_commit))
        .route("/oracle/auto-attest",               post(oracle_auto_attest))
        // Markets
        .route("/markets/create",                   post(markets_create))
        .route("/markets/bet",                      post(markets_bet))
        .route("/markets/odds",                     post(markets_odds))
        // Auto-payout
        .route("/autopayout/resolve",               post(autopayout_resolve))
        .route("/autopayout/prepare",               post(autopayout_prepare))
        // BlockDAG + Broadcast
        .route("/blockdag/live",                    get(blockdag_live))
        .route("/tx/broadcast",                     post(tx_broadcast))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("HTP Rust Backend v{} on http://{}", env!("CARGO_PKG_VERSION"), addr);
    tracing::info!("Modules: wallet | escrow | fee | settlement | deadline | oracle | oracle_commit | markets | autopayout | blockdag | broadcast");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
