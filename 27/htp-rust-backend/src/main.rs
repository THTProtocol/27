use axum::{
    extract::Path,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[allow(dead_code)]
struct MnemonicRequest {
    mnemonic: String,
    network: String,
}

#[derive(Serialize)]
struct MnemonicResponse {
    address: String,
    public_key: String,
}

#[derive(Serialize)]
struct BalanceResponse {
    address: String,
    balance_sompi: u64,
    balance_kas: f64,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct EscrowCreateRequest {
    pubkey_a: String,
    pubkey_b: String,
    amount_sompi: u64,
}

#[derive(Serialize)]
struct EscrowCreateResponse {
    escrow_address: String,
    script_hash: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct PayoutRequest {
    escrow_address: String,
    winner_address: String,
    amount_sompi: u64,
    fee_address: String,
    fee_bps: u16,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct BroadcastRequest {
    raw_tx: String,
}

#[derive(Serialize)]
struct BroadcastResponse {
    tx_id: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        version: "0.1.0".into(),
    })
}

async fn wallet_from_mnemonic(
    Json(_body): Json<MnemonicRequest>,
) -> Json<MnemonicResponse> {
    // TODO: derive address from BIP39 mnemonic using kaspa-wallet-core
    Json(MnemonicResponse {
        address: "kaspa:placeholder_address".into(),
        public_key: "placeholder_public_key".into(),
    })
}

async fn wallet_balance(Path(addr): Path<String>) -> Json<BalanceResponse> {
    // TODO: fetch UTXO balance via kaspa-rpc-client
    Json(BalanceResponse {
        address: addr,
        balance_sompi: 0,
        balance_kas: 0.0,
    })
}

async fn escrow_create(
    Json(_body): Json<EscrowCreateRequest>,
) -> Json<EscrowCreateResponse> {
    // TODO: construct P2SH escrow address for two pubkeys
    Json(EscrowCreateResponse {
        escrow_address: "kaspa:placeholder_escrow".into(),
        script_hash: "placeholder_script_hash".into(),
    })
}

async fn escrow_payout(
    Json(_body): Json<PayoutRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // TODO: build and sign payout tx to winner address
    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "stub", "message": "payout not yet implemented" })),
    )
}

async fn escrow_cancel(
    Json(_body): Json<PayoutRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    // TODO: build and sign refund tx
    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "stub", "message": "cancel not yet implemented" })),
    )
}

async fn blockdag_live() -> (StatusCode, String) {
    // TODO: stream recent block headers via SSE (axum::response::sse)
    (
        StatusCode::OK,
        "data: {\"status\":\"stub\",\"message\":\"SSE stream not yet implemented\"}\n\n".into(),
    )
}

async fn tx_broadcast(
    Json(_body): Json<BroadcastRequest>,
) -> Json<BroadcastResponse> {
    // TODO: broadcast raw transaction via kaspa-rpc-client
    Json(BroadcastResponse {
        tx_id: "placeholder_tx_id".into(),
    })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/health", get(health))
        .route("/wallet/from-mnemonic", post(wallet_from_mnemonic))
        .route("/wallet/balance/{addr}", get(wallet_balance))
        .route("/escrow/create", post(escrow_create))
        .route("/escrow/payout", post(escrow_payout))
        .route("/escrow/cancel", post(escrow_cancel))
        .route("/blockdag/live", get(blockdag_live))
        .route("/tx/broadcast", post(tx_broadcast))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind to port 3000");

    println!("HTP Rust backend listening on http://0.0.0.0:3000");
    axum::serve(listener, app).await.expect("server error");
}
