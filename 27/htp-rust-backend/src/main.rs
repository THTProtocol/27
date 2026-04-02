use axum::{
    extract::Path,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct StubResponse {
    status: &'static str,
    endpoint: &'static str,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

// POST /wallet/from-mnemonic - derive address from BIP39 mnemonic
async fn wallet_from_mnemonic() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/wallet/from-mnemonic",
    })
}

// GET /wallet/balance/:addr - fetch UTXO balance via RPC
async fn wallet_balance(Path(_addr): Path<String>) -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/wallet/balance/:addr",
    })
}

// POST /escrow/create - construct P2SH escrow address for two pubkeys
async fn escrow_create() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/escrow/create",
    })
}

// POST /escrow/payout - build and sign payout tx to winner address
async fn escrow_payout() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/escrow/payout",
    })
}

// POST /escrow/cancel - build and sign refund tx (both parties agree)
async fn escrow_cancel() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/escrow/cancel",
    })
}

// GET /blockdag/live - stream recent block headers
async fn blockdag_live() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/blockdag/live",
    })
}

// POST /tx/broadcast - broadcast a raw transaction
async fn tx_broadcast() -> Json<StubResponse> {
    Json(StubResponse {
        status: "not_implemented",
        endpoint: "/tx/broadcast",
    })
}

// GET /health - health check endpoint
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: "0.1.0",
    })
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/wallet/from-mnemonic", post(wallet_from_mnemonic))
        .route("/wallet/balance/{addr}", get(wallet_balance))
        .route("/escrow/create", post(escrow_create))
        .route("/escrow/payout", post(escrow_payout))
        .route("/escrow/cancel", post(escrow_cancel))
        .route("/blockdag/live", get(blockdag_live))
        .route("/tx/broadcast", post(tx_broadcast))
        .route("/health", get(health))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("failed to bind to port 3000");

    println!("htp-rust-backend listening on http://0.0.0.0:3000");

    axum::serve(listener, app)
        .await
        .expect("server error");
}
