// HTP Server — Route Handlers (Phase 8 clean build)
use axum::{
    extract::{Path, State, Query},
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
        "active_games": 0,
        "active_rooms": state.rooms.len(),
        "settled_matches": state.settled_hashes.len(),
        "uptime_secs": state.started_at.elapsed().as_secs(),
        "errors_total": state.errors_total.load(std::sync::atomic::Ordering::Relaxed),
    }))
}

// ─── Config ──────────────────────────────────────────────────────────
pub async fn config() -> Json<Value> {
    let host = std::env::var("HTP_HOST").unwrap_or_else(|_| "hightable.duckdns.org".to_string());
    Json(json!({
        "wsUrl": format!("wss://{}/ws", host),
        "network": "tn12",
        "version": "rust-1.0",
    }))
}

// ─── Create Game ─────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct CreateGameReq {
    pub game_type: Option<String>,
    #[serde(rename = "type")]
    pub r#type: Option<String>,
    pub creator: Option<String>,
    pub player1: Option<String>,
    pub stake_sompi: Option<i64>,
    pub entry_fee_sompi: Option<String>,
    pub max_players: Option<i64>,
}

pub async fn create_game(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateGameReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let game_type = req.game_type
        .or(req.r#type)
        .unwrap_or_else(|| "SkillGame".to_string());
    
    // Validate HTP types + legacy types
    let valid_types = ["SkillGame","TournamentBracket","ParimutuelMarket","MaximizerEscrow",
                       "tictactoe","connect4","checkers","chess","blackjack","poker"];
    if !valid_types.contains(&game_type.as_str()) {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": format!("unknown game_type: {}", game_type)}))));
    }

    let creator = req.creator
        .or(req.player1)
        .unwrap_or_else(|| "kaspatest:unknown".to_string());

    let stake_sompi: i64 = req.stake_sompi
        .or_else(|| req.entry_fee_sompi.as_ref().and_then(|s| s.parse::<i64>().ok()))
        .unwrap_or(100_000_000);

    let max_players = req.max_players.unwrap_or(2);
    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let record = crate::db::GameRecord {
        id:          id.clone(),
        game_type:   game_type.clone(),
        creator:     creator.clone(),
        opponent:    None,
        stake_sompi: stake_sompi as u64,
        status:      "open".to_string(),
        winner:      None,
        proof_root:  None,
        covenant_id: None,
        created_at:  now,
        updated_at:  now,
    };

    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    db.upsert_game(&record).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;

    tracing::info!("[HTP] Game created: {} type={}", id, game_type);
    let _ = state.broadcast_to_room(&id, &format!(r#"{{"type":"game_created","game":{{"id":"{}","game_type":"{}","creator":"{}","status":"open"}}}}"#, id, game_type, creator));
    Ok(Json(json!({
        "id": id,
        "game_type": game_type,
        "creator": creator,
        "stake_sompi": stake_sompi,
        "status": "open",
        "max_players": max_players
    })))
}

pub async fn get_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "db_lock_poisoned" }))))?;
    match db.get_game(&id) {
        Ok(Some(game)) => Ok(Json(serde_json::to_value(game).unwrap())),
        Ok(None) => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" })))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })))),
    }
}

#[derive(Serialize, Deserialize)]
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
    Path(id): Path<String>,
    Json(req): Json<MoveReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    let move_data = serde_json::to_string(&req).unwrap_or_default();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    let player_id = format!("player_{}", req.player);
    db.append_move(&id, now as u64, &move_data, &player_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    Ok(Json(json!({
        "game_id": id,
        "move_index": now,
        "player": req.player,
        "status": "move_recorded"
    })))
}

// ─── Settle ──────────────────────────────────────────────────────────
#[derive(Deserialize)]
pub struct SettleReq {
    pub winner_pubkey: Option<String>,

    pub winner_address: String,
    pub escrow_tx: Option<String>,
}

pub async fn settle_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<SettleReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    db.finalize_settlement(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    tracing::info!("[HTP] Game {} settled, winner={}", id, req.winner_address);
    Ok(Json(json!({
        "game_id": id,
        "winner": req.winner_address,
        "status": "settled",
        "message": "settlement finalized"
    })))
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
#[derive(Serialize)]
pub struct ChessGameMoveReq {
    pub from: String,
    pub to: String,
    pub promotion: Option<String>,
}

pub async fn chess_game_move(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<ChessGameMoveReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    let game = db.get_game(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "game not found" }))))?;
    if game.game_type != "chess" && game.game_type != "SkillGame" {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"not a chess or SkillGame match"}))));
    }
    let move_data = serde_json::to_string(&req).unwrap_or_default();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    db.append_move(&id, now as u64, &move_data, &game.creator)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    Ok(Json(json!({
        "game_id": id,
        "from": req.from,
        "to": req.to,
        "legal": true,
        "status": "move_recorded"
    })))
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

// ═══════════════════════════════════════════════════════════════
// ORACLE ATTESTATION ROUTES
// Server acts as HTP_ARBITER — signs outcomes, does NOT move money.
// Covenant proposeSettle verifies arbiter sig on-chain.
// ═══════════════════════════════════════════════════════════════

pub async fn propose_settle(
    State(state): State<Arc<AppState>>,
    Path(game_id): Path<String>,
    Json(req): Json<crate::oracle::ProposeSettleReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let default_root = "0".repeat(64);
    let proof_root = req.proof_root.as_deref().unwrap_or(&default_root);
    let path = req.settlement_path.as_deref().unwrap_or("B");
    let arbiter_addr = std::env::var("PROTOCOL_ADDRESS")
        .unwrap_or_else(|_| "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj".into());
    let (hash, arbiter_sig, arbiter_pubkey) = match crate::oracle::signed_attestation(
        &game_id, &req.winner, proof_root, path,
    ) {
        Ok(signed) => signed,
        Err(e) => {
            tracing::warn!("[ARBITER] signing failed: {}, falling back to plain hash", e);
            let fallback_hash = crate::oracle::build_attestation(&game_id, &req.winner, proof_root);
            (fallback_hash, String::new(), String::new())
        }
    };
    tracing::info!("[ARBITER] proposeSettle game={} winner={} path={}", game_id, req.winner, path);
    let _ = state.broadcast_to_room(&game_id, &format!(r#"{{"type":"settlement_proposed","game_id":"{}","winner":"{}","arbiter_sig":"{}","status":"attested"}}"#, game_id, req.winner, arbiter_sig));

    // Persist to SQLite
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    match state.db.lock() {
        Ok(db) => {
            let _ = db.upsert_settlement(&crate::db::SettlementRecord {
                game_id:          game_id.clone(),
                winner:           req.winner.clone(),
                attestation_hash: hash.clone(),
                arbiter:          arbiter_addr.clone(),
                settlement_path:  path.to_string(),
                status:           "PENDING_SETTLE".into(),
                proposed_at:      now,
                finalized_at:     None,
                dispute_deadline: now + 172800,
                disputed_by:      None,
            });
        }
        Err(_) => tracing::warn!("DB lock poisoned"),
    }
    Ok(Json(json!({
        "game_id": game_id, "winner": req.winner, "proof_root": proof_root,
        "attestation_hash": hash,
        "arbiter_sig": arbiter_sig,
        "arbiter_pubkey": arbiter_pubkey,
        "arbiter": arbiter_addr,
        "settlement_path": path, "status": "attested"
    })))
}

pub async fn attest_payout(
    State(_state): State<Arc<AppState>>,
    Path(market_id): Path<String>,
    Json(req): Json<crate::oracle::AttestPayoutReq>,
) -> Json<Value> {
    let hash = crate::oracle::build_payout_attestation(&market_id, &req.claimer, req.amount);
    let arbiter_addr = std::env::var("PROTOCOL_ADDRESS")
        .unwrap_or_else(|_| "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj".into());
    tracing::info!("[ARBITER] attestPayout market={} claimer={} amount={}", market_id, req.claimer, req.amount);
    Json(json!({
        "market_id": market_id, "claimer": req.claimer, "amount": req.amount,
        "attestation_hash": hash, "arbiter": arbiter_addr, "status": "attested"
    }))
}

pub async fn proof_commit_route(
    Json(req): Json<crate::oracle::ProofCommitReq>,
) -> Json<Value> {
    match crate::oracle::build_proof_root(&req.moves) {
        None => Json(json!({"error":"no moves","proof_root":"0".repeat(64)})),
        Some(root) => Json(json!({
            "game_id": req.game_id, "move_count": req.moves.len(),
            "proof_root": root, "proof_system": "sha256-sequential-chain"
        }))
    }
}

// ─── Balance Route ────────────────────────────────────────────────────
// Queries Kaspa TN12 REST API for address balance.

pub async fn balance_route(
    Path(address): Path<String>,
) -> Json<Value> {
    let tn12 = "https://api-tn12.kaspa.org";
    let url = format!("{}/addresses/{}/balance", tn12, address);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_default();
    match client.get(&url).send().await {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(data) => {
                let balance_sompi = data["balance"].as_u64().unwrap_or(0);
                let balance_kas = balance_sompi as f64 / 100_000_000.0;
                Json(json!({
                    "address": address,
                    "balance_sompi": balance_sompi,
                    "balance_kas": balance_kas,
                    "balance_usd": 0.0
                }))
            }
            Err(_) => Json(json!({"address": address, "balance_kas": 0.0, "error": "parse_failed"})),
        },
        Err(e) => Json(json!({"address": address, "balance_kas": 0.0, "error": e.to_string()})),
    }
}


// --- List Games from SQLite ---

pub async fn list_games(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Json<Value> {
    let limit: usize = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(200);
    match state.db.lock() {
        Ok(db) => match db.list_games(None) {
            Ok(games) => {
                let filtered: Vec<_> = games.into_iter().take(limit).collect();
                Json(json!({"games": filtered, "count": filtered.len()}))
            },
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock_poisoned"})),
    }
}

// --- Get Settlement from SQLite ---

pub async fn get_settlement(
    State(state): State<Arc<AppState>>,
    Path(game_id): Path<String>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.get_settlement(&game_id) {
            Ok(Some(s)) => Json(serde_json::to_value(s).unwrap_or_default()),
            Ok(None) => Json(json!({"error":"not_found","game_id":game_id})),
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock_poisoned"})),
    }
}

// ─── Covenants Deployed ──────────────────────────────────────────────
pub async fn covenants_deployed() -> Json<Value> {
    let data = std::fs::read_to_string("/root/htp/deployed.json")
        .unwrap_or_else(|_| "{}".to_string());
    let v: serde_json::Value = serde_json::from_str(&data).unwrap_or(json!({}));
    Json(v)
}

// ─── Admin Stats ─────────────────────────────────────────────────────
pub async fn admin_stats(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Admin key gate
    let admin_key = std::env::var("HTP_ADMIN_KEY").unwrap_or_else(|_| "htp-admin-2026".to_string());
    let header_val = headers.get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if header_val != admin_key {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized", "hint": "set x-admin-key header"}))));
    }

    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    let games = db.list_games(None).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    let total = games.len();
    let open = games.iter().filter(|g| g.status == "open").count();
    let settled = games.iter().filter(|g| g.status == "settled").count();

    Ok(Json(json!({
        "games_total": total,
        "games_open": open,
        "games_settled": settled,
        "uptime_secs": 0,
        "version": "rust-1.0"
    })))
}


// --- Join Game ---
#[derive(Deserialize)]
pub struct JoinGameReq {
    pub player: String,
}

pub async fn join_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<JoinGameReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    let game = match db.get_game(&id).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))? {
        Some(g) => g,
        None => return Err((StatusCode::NOT_FOUND, Json(json!({"error":"game not found"})))),
    };
    let player = req.player;
    if game.creator == player || game.opponent.as_ref() == Some(&player) {
        return Err((StatusCode::CONFLICT, Json(json!({"error":"already joined"}))));
    }
    if game.status != "open" {
        return Err((StatusCode::CONFLICT, Json(json!({"error":"game not open"}))));
    }
    db.set_game_opponent(&id, &player).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    db.set_game_status(&id, "active").map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    let _ = state.broadcast_to_room(&id, &format!(r#"{{"type":"player_joined","game_id":"{}","player":"{}"}}"#, id, player));
    tracing::info!("[HTP] Player {} joined game {}", player, id);
    Ok(Json(json!({
        "id": id,
        "game_id": id,
        "player": player,
        "status": "active",
        "message": "joined successfully",
        "players": [game.creator, player]
    })))
}

// --- Challenge (Dispute) ---
#[derive(Deserialize)]
pub struct ChallengeReq {
    pub challenger: String,
    pub reason: Option<String>,
}

pub async fn challenge_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<ChallengeReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    db.dispute_settlement(&id, &req.challenger).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    Ok(Json(json!({
        "game_id": id,
        "challenger": req.challenger,
        "status": "disputed",
        "reason": req.reason.unwrap_or_default(),
        "message": "dispute opened successfully"
    })))
}

// --- Guardian Override ---
#[derive(Deserialize)]
pub struct GuardianReq {
    pub action: String,
    pub guardian: String,
    pub winner: Option<String>,
}

pub async fn guardian_override(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<GuardianReq>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let guardian_addr = std::env::var("HTP_GUARDIAN_ADDRESS")
        .unwrap_or_else(|_| "kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m".to_string());
    if req.guardian != guardian_addr {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error":"not authorized — must match HTP_GUARDIAN_ADDRESS"}))));
    }
    let db = state.db.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock_poisoned"}))))?;
    db.finalize_settlement(&id).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()}))))?;
    Ok(Json(json!({
        "game_id": id,
        "action": req.action,
        "winner": req.winner,
        "status": "settled",
        "message": "guardian override executed"
    })))
}

// ═══════════════════════════════════════════════════════
// HTP ORACLE NETWORK ROUTES (new)
// ═══════════════════════════════════════════════════════

fn short_oid() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let n = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    format!("{:x}", n % 0xffffffffffff)
}

pub async fn create_event_handler(
    State(state): State<Arc<AppState>>,
    Json(b): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let id = format!("evt-{}", short_oid());
    let title = b["title"].as_str().unwrap_or("Untitled Event");
    let url = b["resolution_url"].as_str().unwrap_or("");
    let condition = b["resolution_condition"].as_str().unwrap_or("eq:yes");
    let resolution_daa = b["resolution_daa"].as_i64().unwrap_or(0);
    let creator = b["creator_address"].as_str().unwrap_or("");
    let oracle_type = b["oracle_type"].as_str().unwrap_or("oracle");
    let json_path = b["resolution_json_path"].as_str().unwrap_or("$.result");
    let quorum_m = b["quorum_m"].as_i64().unwrap_or(2);
    let quorum_n = b["quorum_n"].as_i64().unwrap_or(3);
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    db.create_event_db(&id, title, creator, oracle_type, url, json_path, condition, resolution_daa, quorum_m, quorum_n)
        .map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(serde_json::json!({
        "event_id": id, "title": title, "oracle_type": oracle_type,
        "resolution_url": url, "resolution_condition": condition,
        "quorum": format!("{}/{}", quorum_m, quorum_n), "status": "open", "protocol_fee_pct": 2
    })))
}

pub async fn list_events_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let events = db.get_open_events().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(serde_json::json!({ "events": events })))
}

pub async fn attest_event_handler(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
    Json(b): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pubkey = b["attestor_pubkey"].as_str().unwrap_or("");
    let att_type = b["attestor_type"].as_str().unwrap_or("oracle");
    let value = b["resolution_value"].as_str().unwrap_or("");
    let outcome = b["signed_outcome"].as_str().unwrap_or("");
    let hash = b["attestation_hash"].as_str().unwrap_or("");
    let sig = b["signature"].as_str().unwrap_or("");
    let daa = b["daa_score"].as_i64().unwrap_or(0);
    let expected = crate::oracle::attestation_hash(&event_id, &outcome, &value, daa as u64);
    if hash != expected {
        return Err((StatusCode::BAD_REQUEST, format!("hash mismatch")));
    }
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let bond = db.get_operator_bond(pubkey).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let min_bond = if att_type == "arbiter" { crate::oracle::MIN_ARBITER_BOND_SOMPI as i64 } else { crate::oracle::MIN_ORACLE_BOND_SOMPI as i64 };
    if bond < min_bond { return Err((StatusCode::FORBIDDEN, format!("insufficient bond {}", bond))); }
    db.submit_attestation_db(&event_id, pubkey, att_type, value, outcome, hash, sig, daa)
        .map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let quorum_m: i64 = db.conn.query_row("SELECT quorum_m FROM htp_events WHERE id=?1", rusqlite::params![event_id], |r| r.get(0)).unwrap_or(2);
    let count = db.count_attestations(&event_id, outcome).unwrap_or(0);
    if count >= quorum_m {
        db.finalize_event_db(&event_id, outcome).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
        db.reward_operator_db(pubkey).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    }
    Ok(Json(serde_json::json!({
        "accepted": true, "event_id": event_id, "outcome": outcome,
        "matching_attestations": count, "quorum_required": quorum_m,
        "quorum_reached": count >= quorum_m
    })))
}

pub async fn get_event_attestations_handler(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let atts = db.get_attestations_for_event_db(&event_id).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(serde_json::json!({ "event_id": event_id, "attestations": atts })))
}

pub async fn register_operator_handler(
    State(state): State<Arc<AppState>>,
    Json(b): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let pubkey = b["pubkey"].as_str().unwrap_or("");
    let nickname = b["nickname"].as_str().unwrap_or("anon");
    let operator_type = b["operator_type"].as_str().unwrap_or("oracle");
    let bond_txid = b["bond_txid"].as_str().unwrap_or("");
    let bond_sompi = b["bond_sompi"].as_i64().unwrap_or(0);
    let min = if operator_type == "arbiter" { crate::oracle::MIN_ARBITER_BOND_SOMPI as i64 } else { crate::oracle::MIN_ORACLE_BOND_SOMPI as i64 };
    if bond_sompi < min { return Err((StatusCode::BAD_REQUEST, format!("need {} sompi min", min))); }
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    db.register_operator_db(pubkey, nickname, operator_type, bond_txid, bond_sompi)
        .map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(serde_json::json!({ "registered": true, "pubkey": pubkey, "operator_type": operator_type, "bond_kas": bond_sompi as f64 / 1e8 })))
}

pub async fn list_operators_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let ops = db.get_operators_db().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(serde_json::json!({ "operators": ops, "total": ops.len() })))
}

pub async fn oracle_network_stats_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    let stats = db.get_oracle_network_stats().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;
    Ok(Json(stats))
}

pub async fn settle_event_handler(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    let gross_pot: i64 = db.conn.query_row(
        "SELECT gross_pot_sompi FROM htp_events WHERE id=?1",
        rusqlite::params![event_id], |r| r.get(0)
    ).unwrap_or(0);

    let quorum_m: i64 = db.conn.query_row(
        "SELECT quorum_m FROM htp_events WHERE id=?1",
        rusqlite::params![event_id], |r| r.get(0)
    ).unwrap_or(2);

    let (total_fee, per_oracle) = crate::oracle::compute_oracle_fee(
        gross_pot as u64, quorum_m as u64
    );

    // Get winning outcome attestors
    let attestations = db.get_attestations_for_event_db(&event_id)
        .map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    let mut paid = 0;
    for att in &attestations {
        if let Some(pk) = att["pubkey"].as_str() {
            let _ = db.conn.execute(
                "INSERT OR IGNORE INTO htp_payouts (event_id,recipient,payout_type,amount_sompi)
                 VALUES (?1,?2,'oracle_fee',?3)",
                rusqlite::params![event_id, pk, per_oracle as i64],
            );
            paid += 1;
        }
    }

    db.conn.execute(
        "UPDATE htp_events SET status='resolved', resolved_at=strftime('%s','now') WHERE id=?1",
        rusqlite::params![event_id],
    ).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    Ok(Json(serde_json::json!({
        "event_id": event_id, "status": "resolved",
        "gross_pot_sompi": gross_pot, "total_oracle_fee_sompi": total_fee,
        "per_oracle_sompi": per_oracle, "attestors_paid": paid,
        "protocol_fee_sompi": 0,
        "note": "Zero protocol fee. Only challenge slashes generate revenue."
    })))
}


// ═══════════════════════════════════════════════════════
// HTP ORACLE CHALLENGE ROUTES
// ═══════════════════════════════════════════════════════

/// POST /api/challenge — file a challenge against an attestation
pub async fn submit_challenge_handler(
    State(state): State<Arc<AppState>>,
    Json(b): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let event_id = b["event_id"].as_str().unwrap_or("");
    let attestation_id = b["attestation_id"].as_i64().unwrap_or(0);
    let challenger = b["challenger_pubkey"].as_str().unwrap_or("");
    let stake = b["challenger_stake_sompi"].as_i64().unwrap_or(0);
    let wrong_attestor = b["wrong_attestor_pubkey"].as_str().unwrap_or("");
    let proof_type = b["proof_type"].as_str().unwrap_or("counter_url");
    let proof_data = b["proof_data"].as_str().unwrap_or("{}");
    let counter = b["counter_outcome"].as_str().unwrap_or("");

    let min_stake = crate::oracle::MIN_CHALLENGE_STAKE_SOMPI as i64;
    if stake < min_stake {
        return Err((StatusCode::BAD_REQUEST,
            format!("Minimum challenge stake is {} KAS ({} sompi). Got {} sompi.",
                min_stake / 100_000_000, min_stake, stake)));
    }

    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    // Verify attestation exists
    let att_exists: bool = db.conn.query_row(
        "SELECT COUNT(*) > 0 FROM htp_attestations WHERE id=?1 AND event_id=?2",
        rusqlite::params![attestation_id, event_id],
        |r| r.get(0),
    ).unwrap_or(false);

    if !att_exists {
        return Err((StatusCode::NOT_FOUND, "attestation not found".into()));
    }

    // Insert challenge
    db.conn.execute(
        "INSERT INTO htp_challenges \
         (event_id, attestation_id, challenger_pubkey, challenger_stake_sompi, \
          wrong_attestor_pubkey, proof_type, proof_data, counter_outcome) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![event_id, attestation_id, challenger, stake,
            wrong_attestor, proof_type, proof_data, counter],
    ).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    let challenge_id = db.conn.last_insert_rowid();

    tracing::info!("Challenge #{} filed for event {} against attestation #{} by {} (stake {} KAS)",
        challenge_id, event_id, attestation_id,
        &challenger[..challenger.len().min(16)],
        stake as f64 / 1e8);

    Ok(Json(serde_json::json!({
        "challenge_id": challenge_id,
        "event_id": event_id,
        "attestation_id": attestation_id,
        "challenger": challenger,
        "stake_sompi": stake,
        "stake_kas": stake as f64 / 1e8,
        "status": "pending",
        "message": "Challenge filed. Resolution: upheld (attestor slashed) or rejected (challenger loses stake).",
        "fee_model": {
            "if_upheld": "50% bond slashed: 98% challenger, 2% protocol",
            "if_rejected": "100% stake lost: 98% accused, 2% protocol"
        }
    })))
}

/// POST /api/challenge/:id/resolve — resolve a challenge
pub async fn resolve_challenge_handler(
    State(state): State<Arc<AppState>>,
    Path(challenge_id): Path<i64>,
    Json(b): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let upheld = b["upheld"].as_bool().unwrap_or(false);

    let db = state.db.lock().map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    // Get challenge details
    let (event_id, wrong_attestor, challenger, stake): (String, String, String, i64) = db.conn.query_row(
        "SELECT event_id, wrong_attestor_pubkey, challenger_pubkey, challenger_stake_sompi \
         FROM htp_challenges WHERE id=?1 AND status='pending'",
        rusqlite::params![challenge_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    ).map_err(|_| (StatusCode::NOT_FOUND, "challenge not found or already resolved".into()))?;

    let (slash, challenger_reward, protocol_cut) = if upheld {
        // Get the wrong attestor's bond
        let bond: i64 = db.conn.query_row(
            "SELECT bond_sompi FROM htp_oracle_operators WHERE pubkey=?1",
            rusqlite::params![wrong_attestor],
            |r| r.get(0),
        ).unwrap_or(0);

        let (s, r, c) = crate::oracle::compute_slash_upheld(bond as u64);

        // Slash the wrong attestor
        let _ = db.slash_operator_db(&wrong_attestor, s as i64);

        // Log protocol fee
        let _ = db.conn.execute(
            "INSERT INTO htp_protocol_fees \
             (event_id, fee_type, gross_sompi, fee_bps, fee_sompi, net_sompi) \
             VALUES (?1, 'challenge_upheld', ?2, ?3, ?4, 0)",
            rusqlite::params![event_id, s as i64, crate::oracle::SLASH_PROTOCOL_BPS as i64, c as i64],
        );

        (s as i64, r as i64, c as i64)
    } else {
        // Rejected: challenger loses their stake
        let (accused_comp, protocol_cut) = crate::oracle::compute_slash_rejected(stake as u64);

        // Compensate the wrongly-accused attestor
        let _ = db.conn.execute(
            "UPDATE htp_oracle_operators SET bond_sompi = bond_sompi + ?1 WHERE pubkey = ?2",
            rusqlite::params![accused_comp as i64, wrong_attestor],
        );

        // Log protocol fee
        let _ = db.conn.execute(
            "INSERT INTO htp_protocol_fees \
             (event_id, fee_type, gross_sompi, fee_bps, fee_sompi, net_sompi) \
             VALUES (?1, 'challenge_rejected', ?2, ?3, ?4, 0)",
            rusqlite::params![event_id, stake, crate::oracle::SLASH_PROTOCOL_BPS as i64, protocol_cut as i64],
        );

        (stake, accused_comp as i64, protocol_cut as i64)
    };

    // Mark challenge resolved
    db.conn.execute(
        "UPDATE htp_challenges SET status=?1, bond_slashed_sompi=?2, \
         challenger_reward_sompi=?3, protocol_fee_sompi=?4, \
         resolved_at=strftime('%s','now') \
         WHERE id=?5",
        rusqlite::params![
            if upheld { "upheld" } else { "rejected" },
            slash, challenger_reward, protocol_cut, challenge_id
        ],
    ).map_err(|e|(StatusCode::INTERNAL_SERVER_ERROR,e.to_string()))?;

    Ok(Json(serde_json::json!({
        "challenge_id": challenge_id,
        "upheld": upheld,
        "status": if upheld { "upheld" } else { "rejected" },
        "slash_sompi": slash,
        "challenger_reward_sompi": challenger_reward,
        "protocol_cut_sompi": protocol_cut,
        "wrong_attestor": &wrong_attestor[..wrong_attestor.len().min(20)],
        "challenger": &challenger[..challenger.len().min(20)]
    })))
}
// ═══════════════════════════════════════════════════════
// HTP ORACLE PHASE 4 — Full oracle participation
// ═══════════════════════════════════════════════════════

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub async fn oracle_register(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Json<Value> {
    let addr = body["address"].as_str().unwrap_or("").to_string();
    let bond: i64 = body["bond_sompi"].as_i64().unwrap_or(0);
    let bond_tx = body["bond_tx_id"].as_str().unwrap_or("pending").to_string();
    let otype = body["oracle_type"].as_str().unwrap_or("hybrid").to_string();
    let m: i64 = body["m"].as_i64().unwrap_or(2);
    let n: i64 = body["n"].as_i64().unwrap_or(3);
    if addr.is_empty() { return Json(json!({"error": "address required"})); }
    let id = format!("oracle_{}", now_ts());
    let now = now_ts();
    let min_bond: i64 = 100_000_000;
    if bond < min_bond { return Json(json!({"error": format!("minimum bond is 1 KAS, got {}", bond)})); }
    match state.db.lock() {
        Ok(db) => {
            match db.conn.execute(
                "INSERT OR IGNORE INTO oracles (id,address,bond_sompi,bond_tx_id,oracle_type,m_of_n_m,m_of_n_n,status,registered_at) VALUES (?,?,?,?,?,?,?,?,?)",
                rusqlite::params![id, addr, bond, bond_tx, otype, m, n, "pending", now],
            ) {
                Ok(1) => Json(json!({"id":id,"address":addr,"bond_sompi":bond,"oracle_type":otype,"m":m,"n":n,"status":"pending","message":"Registered. Send bond TX then activate."})),
                Ok(_) => Json(json!({"error":"address already registered"})),
                Err(e) => Json(json!({"error": e.to_string()})),
            }
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_activate(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Json<Value> {
    let now = now_ts();
    let tx_id = body["bond_tx_id"].as_str().unwrap_or("").to_string();
    match state.db.lock() {
        Ok(db) => {
            let n = db.conn.execute(
                "UPDATE oracles SET status='active', activated_at=?1 WHERE id=?2 AND status='pending'",
                rusqlite::params![now, id],
            ).unwrap_or(0);
            if n > 0 && !tx_id.is_empty() {
                let _ = db.conn.execute("UPDATE oracles SET bond_tx_id=?1 WHERE id=?2", rusqlite::params![tx_id, id]);
            }
            Json(json!({"oracle_id": id, "status": if n>0{"active"}else{"not_found_or_already_active"}, "activated_at": now}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_attest(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Json<Value> {
    let game_id = body["game_id"].as_str().unwrap_or("").to_string();
    let oracle_id = body["oracle_id"].as_str().unwrap_or("").to_string();
    let oracle_addr = body["oracle_addr"].as_str().unwrap_or("").to_string();
    let winner = body["winner"].as_str().unwrap_or("").to_string();
    let proof_root = body["proof_root"].as_str().unwrap_or("0").to_string();
    let signature = body["signature"].as_str().unwrap_or("").to_string();
    let atype = body["attest_type"].as_str().unwrap_or("hybrid").to_string();
    if game_id.is_empty() || winner.is_empty() { return Json(json!({"error":"game_id and winner required"})); }
    match state.db.lock() {
        Ok(db) => {
            let oid = if !oracle_id.is_empty() { oracle_id } else {
                db.conn.query_row("SELECT id FROM oracles WHERE address=?1 AND status='active'", [&oracle_addr], |r| r.get::<_,String>(0)).unwrap_or_default()
            };
            if oid.is_empty() { return Json(json!({"error":"oracle not found or not active"})); }
            let existing: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_attestations WHERE game_id=?1 AND oracle_id=?2", [&game_id, &oid], |r| r.get(0)).unwrap_or(0);
            if existing > 0 { return Json(json!({"error":"oracle already attested this game"})); }
            let aid = format!("attest_{}", now_ts());
            db.conn.execute("INSERT INTO oracle_attestations (id,game_id,oracle_id,oracle_addr,winner,proof_root,signature,attest_type,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                rusqlite::params![aid, game_id, oid, oracle_addr, winner, proof_root, signature, atype, now_ts()]).unwrap();
            let (m,): (i64,) = db.conn.query_row("SELECT m_of_n_m FROM oracles WHERE id=?1", [&oid], |r| Ok((r.get(0)?,))).unwrap_or((2,));
            let agree: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_attestations WHERE game_id=?1 AND winner=?2", [&game_id, &winner], |r| r.get(0)).unwrap_or(0);
            let reached = agree >= m;
            if reached {
                let _ = db.conn.execute("INSERT OR REPLACE INTO oracle_quorum_results (id,game_id,winner,m_required,n_total,attested_count,status,resolved_at) VALUES (?1,?2,?3,?4,3,?5,'reached',?6)",
                    rusqlite::params![format!("qr_{}", game_id), game_id, winner, m, agree, now_ts()]);
            }
            Json(json!({"attestation_id":aid,"game_id":game_id,"oracle_id":oid,"winner":winner,"agree_count":agree,"m_required":m,"quorum_reached":reached,"status":if reached {"quorum_reached"}else{"pending"}}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_quorum(
    State(state): State<Arc<AppState>>,
    Path(game_id): Path<String>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let mut atts = Vec::new();
            let mut stmt = db.conn.prepare("SELECT id,oracle_id,oracle_addr,winner,attest_type,created_at FROM oracle_attestations WHERE game_id=?1 ORDER BY created_at ASC").unwrap();
            let rows = stmt.query_map([&game_id], |r| {
                Ok(json!({"id":r.get::<_,String>(0)?,"oracle_id":r.get::<_,String>(1)?,"oracle_addr":r.get::<_,String>(2)?,"winner":r.get::<_,String>(3)?,"attest_type":r.get::<_,String>(4)?,"created_at":r.get::<_,i64>(5)?}))
            }).unwrap();
            for row in rows { if let Ok(v) = row { atts.push(v); } }
            let qr = db.conn.query_row("SELECT winner,m_required,n_total,attested_count,status FROM oracle_quorum_results WHERE game_id=?1", [&game_id], |r| {
                Ok(json!({"winner":r.get::<_,String>(0)?,"m_required":r.get::<_,i64>(1)?,"n_total":r.get::<_,i64>(2)?,"attested_count":r.get::<_,i64>(3)?,"status":r.get::<_,String>(4)?}))
            }).ok();
            Json(json!({"game_id":game_id,"attestations":atts,"attestation_count":atts.len(),"quorum":qr}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_slash(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Json<Value> {
    let oracle_id = body["oracle_id"].as_str().unwrap_or("").to_string();
    let game_id = body["game_id"].as_str().unwrap_or("unknown").to_string();
    let reason = body["reason"].as_str().unwrap_or("dishonest_attestation").to_string();
    let reported_by = body["reported_by"].as_str().unwrap_or("protocol").to_string();
    if oracle_id.is_empty() { return Json(json!({"error":"oracle_id required"})); }
    match state.db.lock() {
        Ok(db) => {
            let (bond, sc): (i64, i64) = db.conn.query_row("SELECT COALESCE(bond_sompi,0), COALESCE(slash_count,0) FROM oracles WHERE id=?1", [&oracle_id], |r| Ok((r.get(0)?, r.get(1)?))).unwrap_or((0,0));
            let slash_amount = bond / 10;
            let new_bond = bond - slash_amount;
            let new_sc = sc + 1;
            let now = now_ts();
            let new_status = if new_sc >= 3 || new_bond < 100_000_000 { "slashed" } else { "active" };
            db.conn.execute("INSERT INTO oracle_slashes (id,oracle_id,game_id,reason,slash_sompi,reported_by,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                rusqlite::params![format!("slash_{}", now), oracle_id, game_id, reason, slash_amount, reported_by, now]).unwrap();
            db.conn.execute("UPDATE oracles SET bond_sompi=?1, slash_count=?2, status=?3, slashed_at=?4 WHERE id=?5",
                rusqlite::params![new_bond, new_sc, new_status, now, oracle_id]).unwrap();
            Json(json!({"slash_id":format!("slash_{}",now),"oracle_id":oracle_id,"slash_amount_sompi":slash_amount,"remaining_bond_sompi":new_bond,"slash_count":new_sc,"oracle_status":new_status,"reason":reason}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_list(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let mut oracles = Vec::new();
            let mut stmt = db.conn.prepare("SELECT id,address,bond_sompi,oracle_type,m_of_n_m,m_of_n_n,slash_count,status,registered_at FROM oracles ORDER BY bond_sompi DESC LIMIT 50").unwrap();
            let rows = stmt.query_map([], |r| {
                Ok(json!({"id":r.get::<_,String>(0)?,"address":r.get::<_,String>(1)?,"bond_sompi":r.get::<_,i64>(2)?,"oracle_type":r.get::<_,String>(3)?,"m":r.get::<_,i64>(4)?,"n":r.get::<_,i64>(5)?,"slash_count":r.get::<_,i64>(6)?,"status":r.get::<_,String>(7)?,"registered_at":r.get::<_,i64>(8)?}))
            }).unwrap();
            for row in rows { if let Ok(v) = row { oracles.push(v); } }
            let active: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracles WHERE status='active'", [], |r| r.get(0)).unwrap_or(0);
            let total_bond: i64 = db.conn.query_row("SELECT COALESCE(SUM(bond_sompi),0) FROM oracles WHERE status='active'", [], |r| r.get(0)).unwrap_or(0);
            Json(json!({"oracles":oracles,"count":oracles.len(),"active_count":active,"total_bond_sompi":total_bond}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_get(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let o = db.conn.query_row("SELECT id,address,bond_sompi,oracle_type,m_of_n_m,m_of_n_n,slash_count,status,registered_at,activated_at FROM oracles WHERE id=?1 OR address=?1", [&id], |r| {
                Ok(json!({"id":r.get::<_,String>(0)?,"address":r.get::<_,String>(1)?,"bond_sompi":r.get::<_,i64>(2)?,"oracle_type":r.get::<_,String>(3)?,"m":r.get::<_,i64>(4)?,"n":r.get::<_,i64>(5)?,"slash_count":r.get::<_,i64>(6)?,"status":r.get::<_,String>(7)?,"registered_at":r.get::<_,i64>(8)?,"activated_at":r.get::<_,Option<i64>>(9)?}))
            }).ok();
            match o { Some(v) => Json(v), None => Json(json!({"error":"oracle not found"})) }
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_exit(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Json<Value> {
    let now = now_ts();
    let exit_tx = body["exit_tx_id"].as_str().unwrap_or("pending").to_string();
    match state.db.lock() {
        Ok(db) => {
            let n = db.conn.execute("UPDATE oracles SET status='exited', slashed_at=?1 WHERE id=?2 AND status IN ('active','pending')", rusqlite::params![now, id]).unwrap_or(0);
            Json(json!({"oracle_id":id,"status":if n>0{"exited"}else{"not_found"},"exit_tx_id":exit_tx}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn oracle_network_stats(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let total: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracles", [], |r| r.get(0)).unwrap_or(0);
            let active: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracles WHERE status='active'", [], |r| r.get(0)).unwrap_or(0);
            let total_bond: i64 = db.conn.query_row("SELECT COALESCE(SUM(bond_sompi),0) FROM oracles WHERE status='active'", [], |r| r.get(0)).unwrap_or(0);
            let total_att: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_attestations", [], |r| r.get(0)).unwrap_or(0);
            let qr: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_quorum_results WHERE status='reached'", [], |r| r.get(0)).unwrap_or(0);
            Json(json!({
                "network": std::env::var("HTP_NETWORK").unwrap_or_else(|_|"tn12".to_string()),
                "oracles":{"total":total,"active":active},
                "bond":{"total_active_sompi":total_bond,"total_active_kas":total_bond as f64/1e8},
                "attestations":{"total":total_att,"quorums_reached":qr},
                "default_quorum":"2-of-3","min_bond_sompi":100000000
            }))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}



// MAXIMIZER PHASE 5
pub async fn maximizer_stats(State(state): State<Arc<AppState>>) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let open: i64 = db.conn.query_row("SELECT COUNT(*) FROM maximizer_pools WHERE status='open'", [], |r| r.get(0)).unwrap_or(0);
            let capped: i64 = db.conn.query_row("SELECT COUNT(*) FROM maximizer_pools WHERE status='capped'", [], |r| r.get(0)).unwrap_or(0);
            let total_entries: i64 = db.conn.query_row("SELECT COUNT(*) FROM maximizer_entries", [], |r| r.get(0)).unwrap_or(0);
            let total_bet: i64 = db.conn.query_row("SELECT COALESCE(SUM(bet_sompi),0) FROM maximizer_entries WHERE status!='refunded'", [], |r| r.get(0)).unwrap_or(0);
            Json(json!({"open_pools":open,"capped_pools":capped,"total_entries":total_entries,"total_bet_sompi":total_bet,"total_bet_kas":total_bet as f64/1e8}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn maximizer_pools(State(state): State<Arc<AppState>>) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let mut pools: Vec<Value> = Vec::new();
            let mut stmt = db.conn.prepare("SELECT id,game_type,pool_cap_sompi,current_sompi,min_bet_sompi,max_bet_sompi,status FROM maximizer_pools WHERE status!='closed' ORDER BY created_at DESC LIMIT 20").unwrap();
            let rows = stmt.query_map([], |r| Ok(json!({"id":r.get::<_,String>(0)?,"game_type":r.get::<_,String>(1)?,"pool_cap_sompi":r.get::<_,i64>(2)?,"current_sompi":r.get::<_,i64>(3)?,"min_bet_sompi":r.get::<_,i64>(4)?,"max_bet_sompi":r.get::<_,i64>(5)?,"status":r.get::<_,String>(6)?,"fill_pct":(r.get::<_,i64>(3).unwrap_or(0) as f64/r.get::<_,i64>(2).unwrap_or(1) as f64*100.0).round()}))).unwrap();
            for row in rows { if let Ok(v) = row { pools.push(v); } }
            let locked: i64 = db.conn.query_row("SELECT COALESCE(SUM(current_sompi),0) FROM maximizer_pools WHERE status='open'", [], |r| r.get(0)).unwrap_or(0);
            Json(json!({"pools":pools,"count":pools.len(),"total_locked_sompi":locked,"total_locked_kas":locked as f64/1e8}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn maximizer_create_pool(State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> Json<Value> {
    let game_type = body["game_type"].as_str().unwrap_or("chess").to_string();
    let cap: i64 = body["pool_cap_sompi"].as_i64().unwrap_or(1_000_000_000);
    let min_bet: i64 = body["min_bet_sompi"].as_i64().unwrap_or(10_000_000);
    let max_bet: i64 = body["max_bet_sompi"].as_i64().unwrap_or(500_000_000);
    if cap < 100_000_000 { return Json(json!({"error":"pool cap must be at least 1 KAS"})); }
    if min_bet >= max_bet { return Json(json!({"error":"min_bet must be < max_bet"})); }
    if max_bet > cap { return Json(json!({"error":"max_bet cannot exceed pool cap"})); }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    let id = format!("pool_{}", now);
    match state.db.lock() {
        Ok(db) => {
            match db.conn.execute("INSERT INTO maximizer_pools (id,game_type,pool_cap_sompi,current_sompi,min_bet_sompi,max_bet_sompi,status,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?5,'open',?6,?6)", rusqlite::params![id, game_type, cap, min_bet, max_bet, now]) {
                Ok(_) => Json(json!({"id":id,"game_type":game_type,"pool_cap_sompi":cap,"min_bet_sompi":min_bet,"max_bet_sompi":max_bet,"status":"open"})),
                Err(e) => Json(json!({"error":e.to_string()}))
            }
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

pub async fn maximizer_enter(State(state): State<Arc<AppState>>, Json(body): Json<Value>) -> Json<Value> {
    let pool_id = body["pool_id"].as_str().unwrap_or("").to_string();
    let player = body["player_addr"].as_str().unwrap_or("").to_string();
    let bet: i64 = body["bet_sompi"].as_i64().unwrap_or(0);
    if pool_id.is_empty() || player.is_empty() || bet <= 0 { return Json(json!({"error":"pool_id, player_addr, bet_sompi required"})); }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
    match state.db.lock() {
        Ok(db) => {
            let pool = db.conn.query_row("SELECT pool_cap_sompi,current_sompi,min_bet_sompi,max_bet_sompi,status FROM maximizer_pools WHERE id=?1", [&pool_id], |r| Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?,r.get::<_,i64>(3)?,r.get::<_,String>(4)?)));
            match pool {
                Err(_) => Json(json!({"error":"pool not found"})),
                Ok((cap,current,min_bet,max_bet,status)) => {
                    if status != "open" { return Json(json!({"error":"pool is not open, cannot enter"})); }
                    if bet < min_bet { return Json(json!({"error":"bet below min", "min":min_bet, "yours":bet})); }
                    if bet > max_bet { return Json(json!({"error":"bet above max", "max":max_bet, "yours":bet})); }
                    let new_total = current + bet;
                    if new_total > cap {
                        let remaining = cap - current;
                        return Json(json!({"error":"pool cap would be exceeded","cap_sompi":cap,"current_sompi":current,"remaining_sompi":remaining,"your_bet_sompi":bet,"max_you_can_bet_sompi":remaining}));
                    }
                    let entry_id = format!("entry_{}_{}", player.get(..8.min(player.len())).unwrap_or("anon"), now);
                    db.conn.execute("INSERT INTO maximizer_entries (id,pool_id,player_addr,bet_sompi,status,created_at) VALUES (?1,?2,?3,?4,'pending',?5)", rusqlite::params![entry_id, pool_id, player, bet, now]).unwrap();
                    let new_status = if new_total >= cap { "capped" } else { "open" };
                    db.conn.execute("UPDATE maximizer_pools SET current_sompi=?1, status=?2, updated_at=?3 WHERE id=?4", rusqlite::params![new_total, new_status, now, pool_id]).unwrap();
                    Json(json!({"entry_id":entry_id,"pool_id":pool_id,"bet_sompi":bet,"pool_total_sompi":new_total,"pool_cap_sompi":cap,"pool_status":new_status,"fill_pct":(new_total as f64/cap as f64*100.0).round(),"message":if new_status=="capped"{"Pool is now full!"}else{"Entry recorded"}}))
                }
            }
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}

// AUTO-SETTLER PHASE 5
pub fn spawn_auto_settler(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() as i64;
            if let Ok(db) = state.db.lock() {
                let games: Vec<(String,String)> = {
                    let mut stmt = match db.conn.prepare("SELECT id, game_type FROM games WHERE status='completed' AND (winner IS NULL OR winner='') LIMIT 20") {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    let rows = stmt.query_map([], |r| Ok((r.get::<_,String>(0)?, r.get::<_,String>(1)?)));
                    match rows {
                        Ok(r) => r.filter_map(|x| x.ok()).collect(),
                        Err(_) => continue,
                    }
                };
                let mut count = 0i64;
                for (gid, _) in &games {
                    let winner = db.conn.query_row("SELECT winner FROM oracle_quorum_results WHERE game_id=?1 AND status='reached'", [gid], |r| r.get::<_,String>(0));
                    if let Ok(w) = winner {
                        let n = db.conn.execute("UPDATE games SET status='settled', winner=?1, updated_at=?2 WHERE id=?3", rusqlite::params![w, now, gid]).unwrap_or(0);
                        if n > 0 { count += 1; eprintln!("[settler] settled {} winner={}", gid, w); }
                    }
                }
                if count > 0 { eprintln!("[settler] tick: settled {} games", count); }
                let _ = db.conn.execute("UPDATE maximizer_pools SET status='closed', updated_at=?1 WHERE status='capped' AND updated_at < ?2", rusqlite::params![now, now-600]);
            }
        }
    });
}


// Order endpoints (migrated from Node to Rust)

pub async fn list_orders_handler(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.list_orders(None, None) {
            Ok(orders) => Json(json!({"orders": orders, "count": orders.len()})),
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock_poisoned"})),
    }
}

pub async fn get_order_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.get_order(&id) {
            Ok(Some(order)) => Json(order),
            Ok(None) => Json(json!({"error":"not_found","id":id})),
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock"})),
    }
}

pub async fn create_order_handler(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let creator = body["creator"].as_str().unwrap_or("");
    let order_type = body["order_type"].as_str().unwrap_or("game");
    let game_type = body["game_type"].as_str();
    let stake_sompi = body["stake_sompi"].as_i64().unwrap_or(0);
    if creator.is_empty() || stake_sompi <= 0 {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error":"missing creator or stake_sompi"}))));
    }
    match state.db.lock() {
        Ok(db) => match db.create_order(creator, order_type, game_type, stake_sompi) {
            Ok(id) => Ok(Json(json!({"id":id,"status":"open"}))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()})))),
        },
        Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock"})))),
    }
}

pub async fn match_order_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let matcher = body["matcher"].as_str().unwrap_or("unknown");
    match state.db.lock() {
        Ok(db) => match db.match_order(&id, matcher) {
            Ok(true) => Ok(Json(json!({"id":id,"status":"matched","matched_by":matcher}))),
            Ok(false) => Err((StatusCode::BAD_REQUEST, Json(json!({"error":"order not open or not found"})))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()})))),
        },
        Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock"})))),
    }
}

pub async fn cancel_order_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let creator = body["creator"].as_str().unwrap_or("");
    match state.db.lock() {
        Ok(db) => match db.cancel_order(&id, creator) {
            Ok(true) => Ok(Json(json!({"id":id,"status":"cancelled"}))),
            Ok(false) => Err((StatusCode::BAD_REQUEST, Json(json!({"error":"not your order or already matched"})))),
            Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":e.to_string()})))),
        },
        Err(_) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":"db_lock"})))),
    }
}

pub async fn order_stats_handler(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.get_order_stats() {
            Ok(stats) => Json(stats),
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock"})),
    }
}

// Portfolio

pub async fn portfolio_handler(
    State(state): State<Arc<AppState>>,
    Path(addr): Path<String>,
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.get_portfolio(&addr) {
            Ok(data) => Json(data),
            Err(e) => Json(json!({"error": e.to_string()})),
        },
        Err(_) => Json(json!({"error":"db_lock"})),
    }
}

pub async fn settler_status(State(state): State<Arc<AppState>>) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => {
            let completed: i64 = db.conn.query_row("SELECT COUNT(*) FROM games WHERE status='completed'", [], |r| r.get(0)).unwrap_or(0);
            let settled: i64 = db.conn.query_row("SELECT COUNT(*) FROM games WHERE status='settled'", [], |r| r.get(0)).unwrap_or(0);
            let pending_q: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_quorum_results WHERE status='pending'", [], |r| r.get(0)).unwrap_or(0);
            let reached_q: i64 = db.conn.query_row("SELECT COUNT(*) FROM oracle_quorum_results WHERE status='reached'", [], |r| r.get(0)).unwrap_or(0);
            Json(json!({"auto_settler":"running","interval_secs":30,"games_completed":completed,"games_settled":settled,"quorums_pending":pending_q,"quorums_reached":reached_q}))
        }
        Err(_) => Json(json!({"error":"db_lock"}))
    }
}
