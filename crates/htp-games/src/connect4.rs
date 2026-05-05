use serde::{Deserialize, Serialize};
use crate::{GameError, GameOutcome, GameStatus};

const ROWS: usize = 6;
const COLS: usize = 7;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connect4 {
    pub board: [[u8; COLS]; ROWS], // 0=empty 1=P1 2=P2
    pub current_player: u8,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub last_drop: Option<(usize, usize)>,
}

impl Connect4 {
    pub fn new() -> Self {
        Self {
            board: [[0; COLS]; ROWS],
            current_player: 1,
            status: GameStatus::Active,
            outcome: GameOutcome::Pending,
            last_drop: None,
        }
    }

    pub fn drop_piece(&mut self, col: usize, player: u8) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active { return Err(GameError::GameOver); }
        if self.current_player != player { return Err(GameError::NotYourTurn); }
        if col >= COLS { return Err(GameError::InvalidMove(format!("col {} out of range", col))); }
        let row = (0..ROWS).rev().find(|&r| self.board[r][col] == 0)
            .ok_or_else(|| GameError::InvalidMove(format!("col {} is full", col)))?;
        self.board[row][col] = player;
        self.last_drop = Some((row, col));
        if self.check_win(row, col, player) {
            self.status = GameStatus::Complete;
            self.outcome = if player == 1 { GameOutcome::Player1Wins } else { GameOutcome::Player2Wins };
        } else if self.board[0].iter().all(|&c| c != 0) {
            self.status = GameStatus::Complete;
            self.outcome = GameOutcome::Draw;
        } else {
            self.current_player = 3 - player;
        }
        Ok(self.outcome.clone())
    }

    fn check_win(&self, row: usize, col: usize, player: u8) -> bool {
        let dirs: [(i32, i32); 4] = [(0,1),(1,0),(1,1),(1,-1)];
        dirs.iter().any(|&(dr, dc)| self.count_dir(row, col, dr, dc, player) + self.count_dir(row, col, -dr, -dc, player) + 1 >= 4)
    }

    fn count_dir(&self, row: usize, col: usize, dr: i32, dc: i32, player: u8) -> usize {
        let mut count = 0;
        let (mut r, mut c) = (row as i32 + dr, col as i32 + dc);
        while r >= 0 && r < ROWS as i32 && c >= 0 && c < COLS as i32 {
            if self.board[r as usize][c as usize] == player { count += 1; r += dr; c += dc; }
            else { break; }
        }
        count
    }
}

impl Default for Connect4 {
    fn default() -> Self { Self::new() }
}
