use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use htp_games::{
    tictactoe::TicTacToe, connect4::Connect4, checkers::Checkers,
    blackjack::BlackjackGame, poker::PokerGame, GameStatus, GameOutcome,
};
use tokio::sync::{Mutex, broadcast};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;

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
    pub rooms: DashMap<String, broadcast::Sender<String>>,
    pub settlement_mutex: DashMap<String, Arc<Mutex<()>>>,
    pub settled_hashes: DashMap<String, String>,
    pub started_at: std::time::Instant,
    pub errors_total: Arc<AtomicU64>,
    pub c4_state: RwLock<crate::game_connect4::C4State>,
    pub checkers_state: RwLock<crate::game_checkers::CheckersState>,
    pub covenant_registry: crate::covenant_id::CovenantRegistry,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            games: DashMap::new(),
            rooms: DashMap::new(),
            settlement_mutex: DashMap::new(),
            settled_hashes: DashMap::new(),
            started_at: std::time::Instant::now(),
            errors_total: Arc::new(AtomicU64::new(0)),
            c4_state: RwLock::new(crate::game_connect4::C4State::default()),
            checkers_state: RwLock::new(crate::game_checkers::CheckersState::default()),
            covenant_registry: crate::covenant_id::CovenantRegistry::new(),
        }
    }

    pub fn broadcast_to_room(&self, game_id: &str, msg: &str) {
        if let Some(tx) = self.rooms.get(game_id) {
            let _ = tx.send(msg.to_string());
        }
    }
}
