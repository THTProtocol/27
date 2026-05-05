//! WebSocket relay — direct replacement for server.js WS relay

use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, State},
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize)]
struct RelayMsg {
    #[serde(rename = "type")]
    msg_type: String,
    room: Option<String>,
    payload: Option<serde_json::Value>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(_state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    tracing::debug!("[HTP WS] Client connected");
    while let Some(Ok(msg)) = socket.recv().await {
        match msg {
            Message::Text(text) => {
                if let Ok(relay) = serde_json::from_str::<RelayMsg>(&text) {
                    tracing::debug!("[HTP WS] relay msg type={} room={:?}", relay.msg_type, relay.room);
                    // Echo back — clients use Firebase as primary, this is fallback relay
                    let echo = serde_json::to_string(&relay).unwrap_or_default();
                    let _ = socket.send(Message::Text(echo.into())).await;
                }
            }
            Message::Close(_) => {
                tracing::debug!("[HTP WS] Client disconnected");
                break;
            }
            _ => {}
        }
    }
}
