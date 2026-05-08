//! High Table Protocol — Texas Hold'em Poker game wrapper
//! Bridges htp-games::poker with the route handler pattern.

use serde::{Deserialize, Serialize};
use htp_games::{GameStatus, GameOutcome};
use htp_games::poker::{
    PokerGame as Engine, PokerAction, PokerActionResult, PokerState, PokerStage, PokerPlayer,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerGame {
    pub engine: Engine,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub player_a: String,
    pub player_b: String,
    pub stake_kas: u32,
}

impl PokerGame {
    pub fn new(player_a: String, player_b: String, stake_kas: u32) -> Self {
        let sb = std::cmp::max(1, stake_kas / 20);
        let bb = sb * 2;
        let engine = Engine::new(player_a.clone(), player_b.clone(), stake_kas, sb, bb);
        PokerGame {
            status: engine.status.clone(),
            outcome: engine.outcome.clone(),
            engine,
            player_a,
            player_b,
            stake_kas,
        }
    }

    pub fn action(&mut self, player_addr: &str, action_str: &str, amount: Option<u32>) -> PokerActionResult {
        let action = match action_str {
            "fold" => PokerAction::Fold,
            "check" => PokerAction::Check,
            "call" => PokerAction::Call,
            "raise" => PokerAction::Raise(amount.unwrap_or(0)),
            "allin" | "all_in" => PokerAction::AllIn,
            _ => return PokerActionResult { error: Some(format!("unknown action: {}", action_str)), ..Default::default() },
        };
        let result = self.engine.action(player_addr, &action);
        if result.finished {
            self.status = GameStatus::Complete;
            self.outcome = match result.winner.as_deref() {
                Some(w) if *w == self.player_a => GameOutcome::Player1Wins,
                Some(_) => GameOutcome::Player2Wins,
                None => GameOutcome::Draw,
            };
        }
        result
    }

    pub fn public_state(&self, viewer_addr: &str) -> serde_json::Value {
        let state = self.engine.state.to_public(viewer_addr);
        serde_json::to_value(&state).unwrap_or_default()
    }
}

impl Default for PokerGame {
    fn default() -> Self {
        Self::new("".into(), "".into(), 10)
    }
}
