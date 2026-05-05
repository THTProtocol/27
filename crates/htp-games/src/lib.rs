pub mod blackjack;
pub mod poker;
pub mod tictactoe;
pub mod connect4;
pub mod checkers;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameStatus {
    Waiting,
    Active,
    Complete,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameOutcome {
    Player1Wins,
    Player2Wins,
    Draw,
    Pending,
}

#[derive(Debug, Error)]
pub enum GameError {
    #[error("invalid move: {0}")]
    InvalidMove(String),
    #[error("game not active")]
    GameNotActive,
    #[error("not your turn")]
    NotYourTurn,
    #[error("game already over")]
    GameOver,
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}
