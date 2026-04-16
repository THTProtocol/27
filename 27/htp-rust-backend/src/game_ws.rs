//! game_ws.rs — WebSocket game-state relay
//!
//! Replaces Firebase RTDB relay paths used by:
//!   htp-chess-sync.js   → relay/<matchId>/clock, relay/<matchId>/colors
//!   htp-games-sync.js   → relay/<matchId>/clock, relay/<matchId>/sides
//!
//! Clients connect to: ws://<host>/ws/game/<matchId>
//!
//! Message format (JSON):
//!   { "type": "clock",    "data": { ... } }
//!   { "type": "sides",    "data": { ... } }
//!   { "type": "colors",   "data": { ... } }
//!   { "type": "move",     "data": { ... } }
//!   { "type": "game_over","data": { ... } }
//!   { "type": "ping" }  ← keepalive

use axum::{
    extract::ws::{Message, WebSocket},
    Json,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{broadcast, RwLock};

const CHAN_CAPACITY: usize = 64;

// ── Registry ──────────────────────────────────────────────────────────────────

pub type MatchRegistry = Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>;

pub fn new_registry() -> MatchRegistry {
    Arc::new(RwLock::new(HashMap::new()))
}

// ── Message types ─────────────────────────────────────────────────────────────

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
    pub white_ms:     u64,
    pub black_ms:     u64,
    pub active_color: String,
    pub last_move_ts: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidesData {
    pub p1:       String,
    pub p2:       String,
    pub assigned: bool,
    pub game:     String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorsData {
    pub white:    String,
    pub black:    String,
    pub assigned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveData {
    pub player: String,
    pub game:   String,
    pub mv:     String,
    pub ts:     u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameOverData {
    pub match_id: String,
    pub winner:   String,
    pub reason:   String,
}

// ── Public socket handler (called from main.rs closure) ───────────────────────

pub async fn handle_socket_pub(socket: WebSocket, match_id: String, registry: MatchRegistry) {
    handle_socket(socket, match_id, registry).await;
}

async fn handle_socket(mut socket: WebSocket, match_id: String, registry: MatchRegistry) {
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
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<WsMsg>(&text) {
                            Ok(WsMsg::Ping) => {
                                let pong = serde_json::to_string(&WsMsg::Pong).unwrap();
                                let _ = socket.send(Message::Text(pong.into())).await;
                            }
                            Ok(_) => { let _ = tx.send(text.to_string()); }
                            Err(_) => {
                                let err = serde_json::to_string(&WsMsg::Error {
                                    message: "Unknown message type".into(),
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
            Ok(broadcast_msg) = rx.recv() => {
                if socket.send(Message::Text(broadcast_msg.into())).await.is_err() {
                    break;
                }
            }
        }
    }

    let mut reg = registry.write().await;
    if let Some(chan) = reg.get(&match_id) {
        if chan.receiver_count() == 0 {
            reg.remove(&match_id);
            tracing::info!("WS channel removed: match={}", match_id);
        }
    }
}

// ── REST broadcast body + inner fn (called from main.rs closure) ──────────────

#[derive(Debug, Deserialize)]
pub struct BroadcastBody {
    pub msg: WsMsg,
}

pub async fn rest_broadcast_inner(
    match_id: String,
    registry: MatchRegistry,
    body: Json<BroadcastBody>,
) -> Json<serde_json::Value> {
    let reg = registry.read().await;
    if let Some(tx) = reg.get(&match_id) {
        let text = serde_json::to_string(&body.msg).unwrap_or_default();
        let sent = tx.send(text).is_ok();
        Json(serde_json::json!({ "sent": sent, "match_id": match_id }))
    } else {
        Json(serde_json::json!({ "sent": false, "match_id": match_id, "reason": "no active channel" }))
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
