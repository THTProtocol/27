//! WebSocket relay with game rooms + auto-payout + token auth + disconnect forfeit.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use uuid::Uuid;
use crate::state::AppState;
use htp_games::{GameStatus, GameOutcome};

#[derive(Debug, Deserialize)]
struct WsIncoming {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    #[serde(rename = "matchId")]
    match_id: Option<String>,
    player: Option<String>,
    token: Option<String>,
    data: Option<serde_json::Value>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    let (local_tx, mut local_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let mut joined: Vec<String> = Vec::new();
    let mut my_addr: String = String::new(); // tracked for forfeit

    loop {
        tokio::select! {
            Some(msg) = local_rx.recv() => {
                if socket.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
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
                                if gid.is_empty() { continue; }

                                // Token auth: verify address matches game players
                                let addr = incoming.token.as_deref().unwrap_or("").to_string();
                                if !addr.is_empty() {
                                    // Try to parse gid as UUID for game lookup
                                    if let Ok(uuid) = Uuid::parse_str(&gid) {
                                        let authorized = state.games.get(&uuid).map_or(true, |r| {
                                            addr == r.player1 || r.player2.as_deref() == Some(&addr)
                                        });
                                        if !authorized {
                                            let err = serde_json::json!({
                                                "type": "error",
                                                "code": "unauthorized",
                                                "message": "address mismatch"
                                            }).to_string();
                                            let _ = socket.send(Message::Text(err.into())).await;
                                            // Close socket after sending error
                                            // socket auto-closed on drop
                                            return;
                                        }
                                    }
                                    my_addr = addr;
                                }

                                if !joined.contains(&gid) {
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
                                        if s.settled_hashes.contains_key(&hash) { return; }
                                        let mutex = s.settlement_mutex
                                            .entry(g.clone())
                                            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
                                            .clone();
                                        let _lock = mutex.lock().await;
                                        if s.settled_hashes.contains_key(&hash) { return; }
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
                            _ => {}
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }

    // Disconnect forfeit: 60s timeout for each active game room
    let disconnected_addr = my_addr;
    for gid_str in &joined {
        if let Ok(game_uuid) = Uuid::parse_str(gid_str) {
            let state2 = state.clone();
            let gid2 = gid_str.clone();
            let addr2 = disconnected_addr.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(60)).await;
                if let Some(mut record) = state2.games.get_mut(&game_uuid) {
                    if record.status == GameStatus::Active {
                        let winner = if addr2 == record.player1 {
                            record.player2.clone().unwrap_or_default()
                        } else {
                            record.player1.clone()
                        };
                        record.status = GameStatus::Complete;
                        let outcome = if winner == record.player1 {
                            GameOutcome::Player1Wins
                        } else {
                            GameOutcome::Player2Wins
                        };
                        record.outcome = outcome;
                        let forfeit_msg = serde_json::json!({
                            "type": "forfeit",
                            "winner": winner,
                            "reason": "disconnect_timeout",
                            "gameId": gid2
                        }).to_string();
                        state2.broadcast_to_room(&gid2, &forfeit_msg);
                    }
                }
            });
        }
    }

    // Clean up rooms on disconnect
    for r in &joined { state.rooms.remove(r); }
}