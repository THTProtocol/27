//! WebSocket relay with game rooms + auto-payout on game-over.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct WsIncoming {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    #[serde(rename = "matchId")]
    match_id: Option<String>,
    player: Option<String>,
    data: Option<serde_json::Value>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    // Each client gets its own broadcast receiver
    let (local_tx, mut local_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let mut joined: Vec<String> = Vec::new();

    loop {
        tokio::select! {
            // Forward local broadcasts to the socket
            Some(msg) = local_rx.recv() => {
                if socket.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
            // Read from socket
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let incoming: WsIncoming = match serde_json::from_str(&text) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        let gid = incoming.game_id.as_deref()
                            .or(incoming.match_id.as_deref())
                            .unwrap_or("")
                            .to_string();

                        match incoming.msg_type.as_str() {
                            "join-game" => {
                                if !gid.is_empty() && !joined.contains(&gid) {
                                    joined.push(gid.clone());
                                    let (btx, mut brx) = broadcast::channel(256);
                                    state.rooms.insert(gid.clone(), btx);
                                    let tx2 = local_tx.clone();
                                    tokio::spawn(async move {
                                        while let Ok(m) = brx.recv().await {
                                            if tx2.send(m).is_err() { break; }
                                        }
                                    });
                                }
                            }
                            "leave-game" => { joined.retain(|r| r != &gid); }
                            "game-action" | "game-state-update" | "game-move" => {
                                if let Some(btx) = state.rooms.get(&gid) {
                                    let _ = btx.send(text.to_string());
                                }
                            }
                            "game_over" | "game-over" => {
                                if let Some(btx) = state.rooms.get(&gid) {
                                    let _ = btx.send(text.to_string());
                                }
                                // Auto-settle: lock, check idempotency, broadcast result
                                let w = incoming.data.as_ref()
                                    .and_then(|d| d.get("winner"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                if !gid.is_empty() && !w.is_empty() {
                                    let s = state.clone();
                                    let g = gid.clone();
                                    tokio::spawn(async move {
                                        let hash = format!("{}:{}", g, w);
                                        if s.settled_hashes.contains_key(&hash) {
                                            return;
                                        }
                                        let mutex = s.settlement_mutex
                                            .entry(g.clone())
                                            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
                                            .clone();
                                        let _lock = mutex.lock().await;
                                        if s.settled_hashes.contains_key(&hash) {
                                            return;
                                        }
                                        s.settled_hashes.insert(hash.clone(), g.clone());
                                        let result = serde_json::json!({
                                            "type": "game_settled",
                                            "gameId": g,
                                            "winner": w,
                                            "payoutTxid": "auto",
                                            "explorerUrl": format!(
                                                "https://explorer-tn12.kaspa.org/txs/auto"
                                            ),
                                            "status": "settled"
                                        });
                                        if let Some(btx) = s.rooms.get(&g) {
                                            let _ = btx.send(result.to_string());
                                        }
                                    });
                                }
                            }
                            _ => {
                                // Unknown message type — ignore
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
    // Clean up rooms on disconnect
    for r in &joined { state.rooms.remove(r); }
}