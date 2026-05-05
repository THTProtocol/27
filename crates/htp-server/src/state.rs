use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use htp_games::{
    tictactoe::TicTacToe,
    connect4::Connect4,
    checkers::Checkers,
    blackjack::BlackjackGame,
    poker::PokerGame,
    GameStatus, GameOutcome,
};
use tokio::sync::{Mutex, broadcast};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "game_type", rename_all = "snake_case")]
pub enum GameEngine {
    TicTacToe(TicTacToe),
    Connect4(Connect4),
    Checkers(Checkers),
    Blackjack(BlackjackGame),
    Poker(PokerGame),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRecord {
    pub id: Uuid,
    pub game_type: String,
    pub engine: GameEngine,
    pub player1: String,
    pub player2: Option<String>,
    pub stake_sompi: u64,
    pub escrow_tx: Option<String>,
    pub settle_tx: Option<String>,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct AppState {
    pub games: DashMap<Uuid, GameRecord>,
    /// Per-game broadcast channels for WS relay
    pub rooms: DashMap<String, broadcast::Sender<String>>,
    /// Per-match settlement mutex — prevents double-payout races
    pub settlement_mutex: DashMap<String, Arc<Mutex<()>>>,
    /// Already-settled game IDs (SHA-256 hashes stored here)
    pub settled_hashes: DashMap<String, String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            games: DashMap::new(),
            rooms: DashMap::new(),
            settlement_mutex: DashMap::new(),
            settled_hashes: DashMap::new(),
        }
    }

    /// Broadcast a message to all clients subscribed to a game room.
    pub fn broadcast_to_room(&self, game_id: &str, msg: &str) {
        if let Some(tx) = self.rooms.get(game_id) {
            let _ = tx.send(msg.to_string());
        }
    }
}
