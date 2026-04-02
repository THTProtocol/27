use axum::{
    extract::Path,
    http::StatusCode,
    response::{sse::Event, Json, Sse},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tokio_stream::Stream;
use tower_http::cors::CorsLayer;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct MnemonicRequest {
    mnemonic: String,
    network: String,
}

#[derive(Debug, Serialize)]
struct MnemonicResponse {
    address: String,
    public_key: String,
}

#[derive(Debug, Serialize)]
struct BalanceResponse {
    address: String,
    balance_sompi: u64,
    balance_kas: f64,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct EscrowCreateRequest {
    pubkey_a: String,
    pubkey_b: String,
    amount_sompi: u64,
}

#[derive(Debug, Serialize)]
struct EscrowCreateResponse {
    escrow_address: String,
    script_hash: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PayoutRequest {
    escrow_address: String,
    winner_address: String,
    amount_sompi: u64,
    fee_address: String,
    fee_bps: u16,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct BroadcastRequest {
    raw_tx: String,
}

#[derive(Debug, Serialize)]
struct BroadcastResponse {
    tx_id: String,
}

#[derive(Debug, Serialize)]
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
    // TODO: construct P2SH escrow address using kaspa-consensus-core
    Json(EscrowCreateResponse {
        escrow_address: "kaspa:placeholder_escrow".into(),
        script_hash: "placeholder_script_hash".into(),
    })
}

async fn escrow_payout(
    Json(_body): Json<PayoutRequest>,
) -> (StatusCode, Json<BroadcastResponse>) {
    // TODO: build and sign payout tx to winner address
    (
        StatusCode::OK,
        Json(BroadcastResponse {
            tx_id: "placeholder_tx_id".into(),
        }),
    )
}

async fn escrow_cancel(
    Json(_body): Json<PayoutRequest>,
) -> (StatusCode, Json<BroadcastResponse>) {
    // TODO: build and sign refund tx
    (
        StatusCode::OK,
        Json(BroadcastResponse {
            tx_id: "placeholder_tx_id".into(),
        }),
    )
}

async fn blockdag_live() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // TODO: stream recent block headers from kaspa-rpc-client
    let stream = tokio_stream::once(Ok(Event::default().data(
        r#"{"message":"blockdag SSE stream placeholder"}"#,
    )));
    Sse::new(stream)
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
// Server
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

    println!("HTP backend listening on http://0.0.0.0:3000");
    axum::serve(listener, app).await.expect("server error");
}
