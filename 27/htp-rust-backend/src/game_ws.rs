//! game_ws.rs — WebSocket game-state relay
//!
//! Replaces Firebase RTDB relay paths used by:
//!   htp-chess-sync.js   → relay/<matchId>/clock, relay/<matchId>/colors
//!   htp-games-sync.js   → relay/<matchId>/clock, relay/<matchId>/sides
//!
//! Each match gets its own broadcast channel.
//! Clients connect to: ws://<host>/ws/game/<matchId>
//!
//! Message format (JSON):
//!   { "type": "clock",  "data": { "white_ms": N, "black_ms": N, "active_color": "white"|"black", "last_move_ts": N } }
//!   { "type": "sides",  "data": { "p1": "playerId", "p2": "playerId", "assigned": true } }
//!   { "type": "colors", "data": { "white": "playerId", "black": "playerId", "assigned": true } }
//!   { "type": "move",   "data": { "player": "playerId", "move": "e2e4", "game": "chess"|"c4"|"checkers", "ts": N } }
//!   { "type": "game_over", "data": { "winner": 1|2|"white"|"black", "reason": "checkmate"|"timeout"|"resign"|"connect4" } }
//!   { "type": "ping" }  ← keepalive from client

use axum::{
    extract::{Path, State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{broadcast, RwLock};

const CHAN_CAPACITY: usize = 64;

// ── Shared registry: matchId → broadcast sender ───────────────────────────────

pub type MatchRegistry = Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>;

pub fn new_registry() -> MatchRegistry {
    Arc::new(RwLock::new(HashMap::new()))
}

// ── WS message types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum WsMsg {
    Clock(ClockData),
    Sides(SidesData),
    Colors(ColorsData),
    Move(MoveData),
    GameOver(GameOverData),
    Ping,
    Pong,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockData {
    pub white_ms:      u64,
    pub black_ms:      u64,
    pub active_color:  String, // "white" | "black" | "side1" | "side3"
    pub last_move_ts:  u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidesData {
    pub p1:       String,
    pub p2:       String,
    pub assigned: bool,
    pub game:     String, // "c4" | "checkers"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorsData {
    pub white:    String,
    pub black:    String,
    pub assigned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveData {
    pub player:  String,
    pub game:    String,    // "chess" | "c4" | "checkers"
    pub mv:      String,    // move notation
    pub ts:      u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameOverData {
    pub match_id: String,
    pub winner:   String,  // player_id or "white"/"black"
    pub reason:   String,  // "checkmate" | "timeout" | "resign" | "connect4" | "no_moves"
}

// ── Axum WS upgrade handler ───────────────────────────────────────────────────

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(match_id): Path<String>,
    State(registry): State<MatchRegistry>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, match_id, registry))
}

async fn handle_socket(mut socket: WebSocket, match_id: String, registry: MatchRegistry) {
    // Get or create the broadcast channel for this match
    let tx = {
        let mut reg = registry.write().await;
        reg.entry(match_id.clone())
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(CHAN_CAPACITY);
                tx
            })
            .clone()
    };
    let mut rx = tx.subscribe();

    tracing::info!("WS connected: match={}", match_id);

    loop {
        tokio::select! {
            // Incoming message from this client → broadcast to all peers
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        // Validate it's a known WsMsg type
                        match serde_json::from_str::<WsMsg>(&text) {
                            Ok(WsMsg::Ping) => {
                                let pong = serde_json::to_string(&WsMsg::Pong).unwrap();
                                let _ = socket.send(Message::Text(pong.into())).await;
                            }
                            Ok(_parsed) => {
                                // Broadcast to all other subscribers
                                let _ = tx.send(text.to_string());
                            }
                            Err(_) => {
                                let err = serde_json::to_string(&WsMsg::Error {
                                    message: "Unknown message type".to_string(),
                                }).unwrap();
                                let _ = socket.send(Message::Text(err.into())).await;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::info!("WS disconnected: match={}", match_id);
                        break;
                    }
                    Some(Ok(Message::Ping(p))) => {
                        let _ = socket.send(Message::Pong(p)).await;
                    }
                    _ => {}
                }
            }
            // Outgoing: relay broadcast messages to this client
            Ok(broadcast_msg) = rx.recv() => {
                if socket.send(Message::Text(broadcast_msg.into())).await.is_err() {
                    break;
                }
            }
        }
    }

    // Clean up empty channels
    let mut reg = registry.write().await;
    if let Some(chan) = reg.get(&match_id) {
        if chan.receiver_count() == 0 {
            reg.remove(&match_id);
            tracing::info!("WS channel removed: match={}", match_id);
        }
    }
}

// ── REST: POST /ws/broadcast/:matchId  (server-side forced broadcast) ────────
//   Used by oracle/autopayout to push game_over to all clients

#[derive(Debug, Deserialize)]
pub struct BroadcastBody {
    pub msg: WsMsg,
}

pub async fn rest_broadcast(
    Path(match_id): Path<String>,
    State(registry): State<MatchRegistry>,
    axum::Json(body): axum::Json<BroadcastBody>,
) -> impl IntoResponse {
    let reg = registry.read().await;
    if let Some(tx) = reg.get(&match_id) {
        let text = serde_json::to_string(&body.msg).unwrap_or_default();
        let sent = tx.send(text).is_ok();
        axum::Json(serde_json::json!({ "sent": sent, "match_id": match_id }))
    } else {
        axum::Json(serde_json::json!({ "sent": false, "match_id": match_id, "reason": "no active channel" }))
    }
}

// ── Utility: current unix timestamp ms ───────────────────────────────────────

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
