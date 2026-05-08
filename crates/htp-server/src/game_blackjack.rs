//! High Table Protocol — Blackjack game wrapper
//! Bridges htp-games::blackjack with the route handler pattern.

use serde::{Deserialize, Serialize};
use htp_games::{GameStatus, GameOutcome};
use htp_games::blackjack::{BlackjackGame as Engine, BlackjackState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackjackGame {
    pub engine: Engine,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub player: String,
}

impl BlackjackGame {
    pub fn new(player: String, num_decks: u8) -> Self {
        let engine = Engine::new(num_decks);
        BlackjackGame {
            status: engine.status.clone(),
            outcome: engine.outcome.clone(),
            engine,
            player,
        }
    }

    pub fn hit(&mut self) -> Result<serde_json::Value, String> {
        match self.engine.hit() {
            Ok(_) => {
                self.status = self.engine.state.status.clone();
                self.outcome = self.engine.state.outcome.clone();
                Ok(serde_json::to_value(self.engine.state.to_public()).unwrap_or_default())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn stand(&mut self) -> Result<serde_json::Value, String> {
        match self.engine.stand() {
            Ok(_) => {
                self.status = self.engine.state.status.clone();
                self.outcome = self.engine.state.outcome.clone();
                Ok(serde_json::to_value(self.engine.state.to_public()).unwrap_or_default())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn double_down(&mut self) -> Result<serde_json::Value, String> {
        match self.engine.double_down() {
            Ok(_) => {
                self.status = self.engine.state.status.clone();
                self.outcome = self.engine.state.outcome.clone();
                Ok(serde_json::to_value(self.engine.state.to_public()).unwrap_or_default())
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn public_state(&self) -> serde_json::Value {
        serde_json::to_value(self.engine.state.to_public()).unwrap_or_default()
    }
}

impl Default for BlackjackGame {
    fn default() -> Self {
        Self::new("".into(), 6)
    }
}
