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
}

impl AppState {
    pub fn new() -> Self {
        Self { games: DashMap::new() }
    }
}
