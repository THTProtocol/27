//! Core Episode trait — the kdapp game interface.
//!
//! Every skill-game (Tic-Tac-Toe, Connect 4, Checkers, Chess) implements
//! this trait. The HTP oracle calls `apply_move` → `status` to verify
//! game outcomes deterministically.

use serde::{Deserialize, Serialize};

/// Which player is acting.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PlayerSide {
    One, // first mover (X, White, Red, etc.)
    Two, // second mover (O, Black, Black, etc.)
}

impl PlayerSide {
    pub fn opponent(self) -> Self {
        match self {
            Self::One => Self::Two,
            Self::Two => Self::One,
        }
    }
}

/// A game move — opaque string that the Episode parses.
/// Format is game-specific: "e2e4" for chess, "3" for connect4, "b3-c4" for checkers, etc.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Move(pub String);

impl Move {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Terminal result of a game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameResult {
    Win(PlayerSide),
    Draw,
}

/// Current status of a game.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameStatus {
    /// Game in progress — it is `PlayerSide`'s turn.
    InProgress(PlayerSide),
    /// Game is over.
    Finished(GameResult),
}

/// The Episode trait — implement this for each skill-game.
pub trait Episode: Clone {
    /// Human-readable game name ("Tic-Tac-Toe", "Chess", etc.)
    fn name(&self) -> &str;

    /// Current game status.
    fn status(&self) -> GameStatus;

    /// Whose turn is it? `None` if the game is finished.
    fn current_player(&self) -> Option<PlayerSide> {
        match self.status() {
            GameStatus::InProgress(side) => Some(side),
            GameStatus::Finished(_) => None,
        }
    }

    /// Apply a move. Returns `Err` if the move is illegal or it's not the right player's turn.
    fn apply_move(&mut self, side: PlayerSide, mv: &Move) -> Result<GameStatus, String>;

    /// List all legal moves for the current player. Used by AI / validation.
    fn legal_moves(&self) -> Vec<Move>;

    /// Serialize the full game state to JSON (for oracle storage / replay).
    fn to_json(&self) -> String;

    /// Deserialize game state from JSON.
    fn from_json(json: &str) -> Result<Self, String>
    where
        Self: Sized;

    /// Move count so far.
    fn move_count(&self) -> usize;

    /// Compact board representation for display / logging.
    fn display(&self) -> String;
}
