// HTP Server — Route Handlers (Phase 8 clean build)
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use std::sync::Arc;
use chrono::Utc;
use htp_games::{
    tictactoe::TicTacToe, connect4::Connect4, checkers::Checkers,
    checkers::Move as CheckersMove, blackjack::BlackjackGame, poker::PokerGame,
    GameStatus, GameOutcome,
};
use crate::state::{AppState, GameRecord, GameEngine};
use crate::signing;

// ─── Health ──────────────────────────────────────────────────────────
pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION"), "engine": "rust" }))
}

// ─── Metrics ─────────────────────────────────────────────────────────
pub async fn metrics_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Json<Value> {
    Json(json!({
        "active_games": state.games.len(),
        "active_rooms": state.rooms.len(),
        "settled_matches": state.settled_hashes.len(),
        "uptime_secs": state.started_at.elapsed().as_secs(),
        "errors_total": state.errors_total.load(std::sync::atomic::Ordering::Relaxed),
    }))
}

// ─── Config ──────────────────────────────────────────────────────────
pub async fn config() -> Json<Value> {
    let host = std::env::var("HTP_HOST").unwrap_or_else(|_| "178.105.76.81".to_string());
    Json(json!({
        "wsUrl": format!("wss://{}/ws", host),
        "network": "tn12",
        "version": "rust-1.0",
    }))
}

// ─── Create Game ─────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct CreateGameReq {
    pub game_type: String,
    pub player1: String,
    pub stake_sompi: u64,
}

pub async fn create_game(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateGameReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = Uuid::new_v4();
    let engine = match req.game_type.as_str() {
        "tictactoe" => GameEngine::TicTacToe(TicTacToe::new()),
        "connect4"  => GameEngine::Connect4(Connect4::new()),
        "checkers"  => GameEngine::Checkers(Checkers::new()),
        "blackjack" => GameEngine::Blackjack(BlackjackGame::new()),
        "poker"     => GameEngine::Poker(PokerGame::new()),
        "chess"     => GameEngine::Chess(crate::game_chess::ChessGame::new()),
        other => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": format!("unknown game_type: {}", other) })))),
    };
    let (status, outcome) = match &engine {
        GameEngine::Poker(p) => (p.status.clone(), p.outcome.clone()),
        GameEngine::Blackjack(b) => (b.status.clone(), b.outcome.clone()),
        GameEngine::Chess(c) => (c.status.clone(), c.outcome.clone()),
        _ => (GameStatus::Active, GameOutcome::Pending),
    };
    let record = GameRecord {
        id, game_type: req.game_type.clone(), engine,
        player1: req.player1, player2: None,
        stake_sompi: req.stake_sompi, escrow_tx: None, settle_tx: None,
        status, outcome, created_at: Utc::now(), updated_at: Utc::now(),
    };
    state.games.insert(id, record.clone());
    tracing::info!("[HTP] Game created: {} type={}", id, req.game_type);
    Ok(Json(json!({ "id": id, "game_type": req.game_type, "status": "active" })))
}

// ─── Get Game ────────────────────────────────────────────────────────
pub async fn get_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let game = state.games.get(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" }))))?;
    Ok(Json(serde_json::to_value(&*game).unwrap()))
}

// ─── Apply Move ──────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct MoveReq {
    pub player: u8,
    pub position: Option<usize>,
    pub column: Option<usize>,
    pub from: Option<[usize; 2]>,
    pub to: Option<[usize; 2]>,
    pub action: Option<String>,
}

pub async fn apply_move(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<MoveReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut game = state.games.get_mut(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" }))))?;
    let outcome = match &mut game.engine {
        GameEngine::TicTacToe(g) => {
            let pos = req.position.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "position required" }))))?;
            g.play(pos, req.player).map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?
        }
        GameEngine::Connect4(g) => {
            let col = req.column.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "column required" }))))?;
            g.drop_piece(col, req.player).map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?
        }
        GameEngine::Checkers(g) => {
            let from = req.from.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "from required" }))))?;
            let to = req.to.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "to required" }))))?;
            g.apply_move(CheckersMove { from: (from[0], from[1]), to: (to[0], to[1]) }, req.player)
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?
        }
        GameEngine::Blackjack(g) => match req.action.as_deref() {
            Some("hit") => g.hit().map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?,
            Some("stand") => g.stand().map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?,
            _ => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "action must be hit or stand" })))),
        },
        GameEngine::Poker(_) => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "poker has no moves" })))),
        GameEngine::Chess(_) => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "use /api/games/{id}/chess-move for chess" })))),
    };
    let (new_status, new_outcome) = match &game.engine {
        GameEngine::TicTacToe(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Connect4(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Checkers(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Blackjack(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Poker(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Chess(g) => (g.status.clone(), g.outcome.clone()),
    };
    game.status = new_status;
    game.outcome = new_outcome.clone();
    game.updated_at = Utc::now();
    Ok(Json(json!({ "outcome": outcome, "status": game.status, "updated": game.updated_at })))
}

// ─── Settle ──────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct SettleReq {
    pub winner_address: String,
    pub escrow_tx: Option<String>,
}

pub async fn settle_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<SettleReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut game = state.games.get_mut(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" }))))?;
    if game.status != GameStatus::Complete {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "game not complete" }))));
    }
    if game.settle_tx.is_some() {
        return Ok(Json(json!({ "settle_tx": game.settle_tx, "status": "already_settled" })));
    }
    let settle_tx = signing::build_payout_tx(
        &req.winner_address, game.stake_sompi, req.escrow_tx.as_deref(),
    ).await.map_err(|e| {
        state.errors_total.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
    })?;
    game.settle_tx = Some(settle_tx.clone());
    game.updated_at = Utc::now();
    tracing::info!("[HTP] Game {} settled tx={}", id, settle_tx);
    Ok(Json(json!({ "game_id": id, "settle_tx": settle_tx, "winner": req.winner_address, "status": "settled" })))
}

// ─── Proof Preview ────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ProofPreviewReq {
    pub match_id: String,
    pub winner: String,
    pub game_type: String,
    pub move_count: usize,
}

pub async fn proof_preview(Json(req): Json<ProofPreviewReq>) -> Json<Value> {
    Json(json!(crate::api_models::ProofPreviewShape {
        protocol: "HTP/1.0".into(),
        proof_type: "narrow-verification".into(),
        match_id: req.match_id,
        root: format!("sha256:{}", "0".repeat(64)),
        winner: req.winner,
        move_count: req.move_count,
        game_type: req.game_type,
        proof_system: "sha256-sequential-chain".into(),
        note: "Canonical shape — actual root computed at settlement time".into(),
    }))
}

// ─── Chess Move (shakmaty) ──────────────────────────────────────────
pub async fn chess_move(Json(req): Json<crate::game_chess::ChessMoveRequest>) -> Json<Value> {
    Json(json!(crate::game_chess::apply_move(&req)))
}

// ─── Connect4 Drop ──────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct C4DropReq { pub col: usize }

pub async fn c4_drop(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(req): Json<C4DropReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut c4 = state.c4_state.write().unwrap();
    match c4.drop_piece(req.col) {
        Ok(result) => Ok(Json(json!({ "result": result, "next_player": c4.next_player }))),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json!({ "error": e })))),
    }
}

// ─── Checkers Move ──────────────────────────────────────────────────
pub async fn checkers_move(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(req): Json<crate::game_checkers::CheckersMove>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut ck = state.checkers_state.write().unwrap();
    match ck.apply_move(&req) {
        Ok(result) => Ok(Json(json!({ "result": result, "next_player": ck.next_player }))),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json!({ "error": e })))),
    }
}

// ─── ZK Prove ───────────────────────────────────────────────────────
pub async fn zk_prove(
    Json(req): Json<crate::zk_proof::ZkProofRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match crate::zk_proof::generate_match_proof(&req) {
        Ok(result) => Ok(Json(json!(result))),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json!({ "error": e })))),
    }
}

// ─── ZK Status ──────────────────────────────────────────────────────
pub async fn zk_status_handler() -> Json<Value> {
    Json(json!(crate::zk_proof::zk_status()))
}

// ─── Covenant Register ──────────────────────────────────────────────
pub async fn covenant_register(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(req): Json<crate::covenant_id::CovenantRegisterRequest>,
) -> Json<Value> {
    Json(json!(state.covenant_registry.register(&req)))
}

// ─── Covenant Advance ───────────────────────────────────────────────
pub async fn covenant_advance(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Path(mid): Path<String>,
    Json(req): Json<crate::covenant_id::CovenantAdvanceRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if req.match_id != mid {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "id mismatch" }))));
    }
    match state.covenant_registry.advance(&req) {
        Some(e) => Ok(Json(json!(e))),
        None => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "not found" })))),
    }
}

// ─── Covenant Get ───────────────────────────────────────────────────
pub async fn covenant_get(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Path(mid): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    match state.covenant_registry.get(&mid) {
        Some(e) => Ok(Json(json!(e))),
        None => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "not found" })))),
    }
}


// ─── Chess Game Move (game-scoped) ─────────────────────────────────

#[derive(Deserialize)]
pub struct ChessGameMoveReq {
    pub from: String,
    pub to: String,
    pub promotion: Option<String>,
}

pub async fn chess_game_move(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<ChessGameMoveReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut game = state.games.get_mut(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error":"game not found"}))))?;
    let (legal, new_fen, result, is_check, new_status, new_outcome) = {
        if let GameEngine::Chess(ref mut chess) = game.engine {
            let res = chess.apply_chess_move(&req.from, &req.to, req.promotion.as_deref());
            (res.legal, res.new_fen, res.result, res.is_check, chess.status.clone(), chess.outcome.clone())
        } else {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"not a chess game"}))));
        }
    };
    game.status = new_status;
    game.outcome = new_outcome;
    game.updated_at = chrono::Utc::now();
    Ok(Json(json!({"legal": legal, "new_fen": new_fen, "result": result, "is_check": is_check})))
}

// ─── Kaspa Balance Lookup ──────────────────────────────────────────

pub async fn kaspa_balance(
    Path(address): Path<String>,
) -> Json<Value> {
    let rpc_url = std::env::var("KASPA_REST_URL")
        .unwrap_or_else(|_| "https://api-tn12.kaspa.org".into());
    let rpc = htp_kaspa_rpc::KaspaRpc::new(rpc_url.clone());
    match rpc.get_balance(&address).await {
        Ok(bal) => Json(json!({
            "address": address,
            "balance_sompi": bal.balance,
            "source": rpc_url
        })),
        Err(e) => Json(json!({"error": format!("rpc error: {}", e), "address": address}))
    }
}
