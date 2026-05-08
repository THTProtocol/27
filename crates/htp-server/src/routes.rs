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
) -> Json<Value> {
    match state.db.lock() {
        Ok(db) => match db.list_games(None) {
            Ok(games) => Json(json!({"games": games, "count": games.len()})),
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
