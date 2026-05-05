use serde::{Deserialize, Serialize};
use crate::{GameError, GameOutcome, GameStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToe {
    pub board: [Option<u8>; 9], // 0 = empty, 1 = X, 2 = O
    pub current_player: u8,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub move_count: u8,
}

const WINS: [[usize; 3]; 8] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],             // diags
];

impl TicTacToe {
    pub fn new() -> Self {
        Self {
            board: [None; 9],
            current_player: 1,
            status: GameStatus::Active,
            outcome: GameOutcome::Pending,
            move_count: 0,
        }
    }

    pub fn play(&mut self, pos: usize, player: u8) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active {
            return Err(GameError::GameOver);
        }
        if self.current_player != player {
            return Err(GameError::NotYourTurn);
        }
        if pos > 8 || self.board[pos].is_some() {
            return Err(GameError::InvalidMove(format!("position {} is occupied or invalid", pos)));
        }
        self.board[pos] = Some(player);
        self.move_count += 1;
        if self.check_win(player) {
            self.status = GameStatus::Complete;
            self.outcome = if player == 1 { GameOutcome::Player1Wins } else { GameOutcome::Player2Wins };
        } else if self.move_count == 9 {
            self.status = GameStatus::Complete;
            self.outcome = GameOutcome::Draw;
        } else {
            self.current_player = if player == 1 { 2 } else { 1 };
        }
        Ok(self.outcome.clone())
    }

    fn check_win(&self, player: u8) -> bool {
        WINS.iter().any(|&[a, b, c]| {
            self.board[a] == Some(player)
                && self.board[b] == Some(player)
                && self.board[c] == Some(player)
        })
    }
}

impl Default for TicTacToe {
    fn default() -> Self { Self::new() }
}
