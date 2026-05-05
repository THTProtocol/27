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
    tictactoe::TicTacToe,
    connect4::Connect4,
    checkers::{Checkers, Move as CheckersMove},
    blackjack::BlackjackGame,
    poker::PokerGame,
    GameStatus, GameOutcome,
};
use crate::state::{AppState, GameRecord, GameEngine};
use crate::signing;

// ─── Health ────────────────────────────────────────────────────────────────
pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION"), "engine": "rust" }))
}

// ─── Metrics ───────────────────────────────────────────────────────────────
pub async fn metrics_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Json<Value> {
    Json(json!({
        "active_games":    state.games.len(),
        "active_rooms":    state.rooms.len(),
        "settled_matches": state.settled_hashes.len(),
        "uptime_check":    "ok"
    }))
}

// ─── Config ────────────────────────────────────────────────────────────────
pub async fn config() -> Json<Value> {
    let host = std::env::var("HTP_HOST").unwrap_or_else(|_| "178.105.76.81".to_string());
    Json(json!({
        "wsUrl": format!("wss://{}/ws", host),
        "network": "tn12",
        "version": "rust-1.0"
    }))
}


// ─── Create game ──────────────────────────────────────────────────────────
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
        other => return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("unknown game_type: {}", other) }))
        )),
    };
    // Determine initial status — poker resolves immediately
    let (status, outcome) = match &engine {
        GameEngine::Poker(p) => (p.status.clone(), p.outcome.clone()),
        GameEngine::Blackjack(b) => (b.status.clone(), b.outcome.clone()),
        _ => (GameStatus::Active, GameOutcome::Pending),
    };
    let record = GameRecord {
        id,
        game_type: req.game_type.clone(),
        engine,
        player1: req.player1,
        player2: None,
        stake_sompi: req.stake_sompi,
        escrow_tx: None,
        settle_tx: None,
        status,
        outcome,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.games.insert(id, record.clone());
    tracing::info!("[HTP] Game created: {} type={}", id, req.game_type);
    Ok(Json(json!({ "id": id, "game_type": req.game_type, "status": "active" })))
}

// ─── Get game ─────────────────────────────────────────────────────────────
pub async fn get_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let game = state.games.get(&id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" }))))?;
    Ok(Json(serde_json::to_value(&*game).unwrap()))
}

// ─── Apply move ───────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct MoveReq {
    pub player: u8,
    // TicTacToe / Connect4
    pub position: Option<usize>,
    pub column: Option<usize>,
    // Checkers
    pub from: Option<[usize; 2]>,
    pub to: Option<[usize; 2]>,
    // Blackjack
    pub action: Option<String>, // "hit" | "stand"
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
            let to   = req.to.ok_or_else(|| (StatusCode::BAD_REQUEST, Json(json!({ "error": "to required" }))))?;
            g.apply_move(CheckersMove { from: (from[0], from[1]), to: (to[0], to[1]) }, req.player)
                .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?
        }
        GameEngine::Blackjack(g) => {
            match req.action.as_deref() {
                Some("hit")   => g.hit().map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?,
                Some("stand") => g.stand().map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))))?,
                _ => return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "action must be hit or stand" })))),
            }
        }
        GameEngine::Poker(_) => {
            return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "poker has no moves — check outcome directly" }))))
        }
    };

    // Sync top-level status/outcome
    let (new_status, new_outcome) = match &game.engine {
        GameEngine::TicTacToe(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Connect4(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Checkers(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Blackjack(g) => (g.status.clone(), g.outcome.clone()),
        GameEngine::Poker(g) => (g.status.clone(), g.outcome.clone()),
    };
    game.status = new_status;
    game.outcome = new_outcome.clone();
    game.updated_at = Utc::now();

    Ok(Json(json!({
        "outcome": outcome,
        "status": game.status,
        "updated": game.updated_at,
    })))
}

// ─── Settle ───────────────────────────────────────────────────────────────
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

    // Input validation: winner address must be valid Kaspa bech32
    if !req.winner_address.starts_with("kaspa:") && !req.winner_address.starts_with("kaspatest:") {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid_input", "field": "winner_address", "expected": "kaspa:... or kaspatest:..."}))));
    }

    // Stake validation: must be non-zero and within reasonable bounds
    if game.stake_sompi == 0 {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid_input", "field": "stake_sompi", "reason": "zero stake"}))));
    }
    if game.stake_sompi > 1_000_000_000_000 {
        return Err((StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid_input", "field": "stake_sompi", "reason": "exceeds max (1M KAS)"}))));
    }

    if game.status != GameStatus::Complete {
        return Err((StatusCode::BAD_REQUEST, Json(json!({ "error": "game not complete yet" }))));
    }
    if game.settle_tx.is_some() {
        return Ok(Json(json!({ "settle_tx": game.settle_tx, "status": "already_settled" })));
    }

    // Call Rust signer to build + submit payout TX
    let settle_tx = signing::build_payout_tx(
        &req.winner_address,
        game.stake_sompi,
        req.escrow_tx.as_deref(),
    ).await.map_err(|e| {
        tracing::error!("[HTP] Signing error: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))
    })?;

    game.settle_tx = Some(settle_tx.clone());
    game.updated_at = Utc::now();
    tracing::info!("[HTP] Game {} settled → tx={}", id, settle_tx);

    Ok(Json(json!({
        "game_id": id,
        "settle_tx": settle_tx,
        "winner": req.winner_address,
        "status": "settled",
    })))
}
// ─── Proof Preview ─────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct ProofPreviewReq {
    pub match_id: String,
    pub winner: String,
    pub game_type: String,
    pub move_count: usize,
}

pub async fn proof_preview(
    Json(req): Json<ProofPreviewReq>,
) -> Json<Value> {
    let canonical = crate::api_models::ProofPreviewShape {
        protocol: "HTP/1.0".into(),
        proof_type: "narrow-verification".into(),
        match_id: req.match_id,
        root: format!("sha256:{}", "0".repeat(64)),
        winner: req.winner,
        move_count: req.move_count,
        game_type: req.game_type,
        proof_system: "sha256-sequential-chain".into(),
        note: "Canonical shape — actual root computed by htpBuildMoveCommit at settlement time".into(),
    };
    Json(json!(canonical))
}

// ─── Proof Preview ─────────────────────────────────────────────────────────
use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProofPreviewReq {
    pub match_id: String,
    pub winner: String,
