//! Connect 4 Episode — 7-column × 6-row vertical drop, first to four-in-a-row wins.

use serde::{Deserialize, Serialize};

use crate::episode::{Episode, GameResult, GameStatus, Move, PlayerSide};

const COLS: usize = 7;
const ROWS: usize = 6;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Connect4 {
    /// Column-major: board[col][row], row 0 = bottom. 0=empty, 1=P1(Red), 2=P2(Yellow)
    board: [[u8; ROWS]; COLS],
    /// How many discs in each column.
    heights: [usize; COLS],
    turn: PlayerSide,
    moves: usize,
    finished: Option<GameResult>,
}

impl Connect4 {
    pub fn new() -> Self {
        Self {
            board: [[0; ROWS]; COLS],
            heights: [0; COLS],
            turn: PlayerSide::One,
            moves: 0,
            finished: None,
        }
    }

    fn cell_val(side: PlayerSide) -> u8 {
        match side {
            PlayerSide::One => 1,
            PlayerSide::Two => 2,
        }
    }

    fn check_winner_at(&self, col: usize, row: usize) -> bool {
        let v = self.board[col][row];
        if v == 0 {
            return false;
        }
        // Check 4 directions: horizontal, vertical, diag /, diag \.
        let dirs: [(i32, i32); 4] = [(1, 0), (0, 1), (1, 1), (1, -1)];
        for (dc, dr) in &dirs {
            let mut count = 1;
            // Forward
            for step in 1..4 {
                let c = col as i32 + dc * step;
                let r = row as i32 + dr * step;
                if c < 0 || c >= COLS as i32 || r < 0 || r >= ROWS as i32 {
                    break;
                }
                if self.board[c as usize][r as usize] == v {
                    count += 1;
                } else {
                    break;
                }
            }
            // Backward
            for step in 1..4 {
                let c = col as i32 - dc * step;
                let r = row as i32 - dr * step;
                if c < 0 || c >= COLS as i32 || r < 0 || r >= ROWS as i32 {
                    break;
                }
                if self.board[c as usize][r as usize] == v {
                    count += 1;
                } else {
                    break;
                }
            }
            if count >= 4 {
                return true;
            }
        }
        false
    }
}

impl Default for Connect4 {
    fn default() -> Self {
        Self::new()
    }
}

impl Episode for Connect4 {
    fn name(&self) -> &str {
        "Connect 4"
    }

    fn status(&self) -> GameStatus {
        if let Some(result) = self.finished {
            return GameStatus::Finished(result);
        }
        GameStatus::InProgress(self.turn)
    }

    fn apply_move(&mut self, side: PlayerSide, mv: &Move) -> Result<GameStatus, String> {
        if side != self.turn {
            return Err(format!("Not {:?}'s turn", side));
        }
        if self.finished.is_some() {
            return Err("Game is already over".into());
        }

        let col: usize = mv.as_str().parse().map_err(|_| {
            format!("Invalid column '{}': expected 0-6", mv.as_str())
        })?;
        if col >= COLS {
            return Err(format!("Column {} out of bounds (0-6)", col));
        }
        if self.heights[col] >= ROWS {
            return Err(format!("Column {} is full", col));
        }

        let row = self.heights[col];
        self.board[col][row] = Self::cell_val(side);
        self.heights[col] += 1;
        self.moves += 1;

        if self.check_winner_at(col, row) {
            self.finished = Some(GameResult::Win(side));
        } else if self.moves >= COLS * ROWS {
            self.finished = Some(GameResult::Draw);
        }

        self.turn = side.opponent();
        Ok(self.status())
    }

    fn legal_moves(&self) -> Vec<Move> {
        if self.finished.is_some() {
            return vec![];
        }
        (0..COLS)
            .filter(|&c| self.heights[c] < ROWS)
            .map(|c| Move::new(c.to_string()))
            .collect()
    }

    fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }

    fn move_count(&self) -> usize {
        self.moves
    }

    fn display(&self) -> String {
        let sym = |v: u8| match v {
            1 => 'R',
            2 => 'Y',
            _ => '.',
        };
        let mut lines = Vec::new();
        for row in (0..ROWS).rev() {
            let row_str: String = (0..COLS)
                .map(|col| format!("{}", sym(self.board[col][row])))
                .collect::<Vec<_>>()
                .join(" ");
            lines.push(format!("| {} |", row_str));
        }
        lines.push("+-+-+-+-+-+-+-+".to_string());
        lines.push("  0 1 2 3 4 5 6".to_string());
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertical_win() {
        let mut g = Connect4::new();
        // P1 drops in col 0 four times, P2 in col 1
        for i in 0..3 {
            g.apply_move(PlayerSide::One, &Move::new("0")).unwrap();
            g.apply_move(PlayerSide::Two, &Move::new("1")).unwrap();
        }
        let status = g.apply_move(PlayerSide::One, &Move::new("0")).unwrap();
        assert_eq!(status, GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }

    #[test]
    fn test_horizontal_win() {
        let mut g = Connect4::new();
        // P1: cols 0,1,2,3 (bottom row). P2: col 0,1,2 (second row)
        g.apply_move(PlayerSide::One, &Move::new("0")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("0")).unwrap();
        g.apply_move(PlayerSide::One, &Move::new("1")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("1")).unwrap();
        g.apply_move(PlayerSide::One, &Move::new("2")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("2")).unwrap();
        let status = g.apply_move(PlayerSide::One, &Move::new("3")).unwrap();
        assert_eq!(status, GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }

    #[test]
    fn test_diagonal_win() {
        let mut g = Connect4::new();
        // Build a diagonal for P1: (0,0), (1,1), (2,2), (3,3)
        // Col 0: P1
        g.apply_move(PlayerSide::One, &Move::new("0")).unwrap(); // (0,0)=P1
        // Col 1: P2, P1
        g.apply_move(PlayerSide::Two, &Move::new("1")).unwrap(); // (1,0)=P2
        g.apply_move(PlayerSide::One, &Move::new("1")).unwrap(); // (1,1)=P1
        // Col 2: P2, P2, P1
        g.apply_move(PlayerSide::Two, &Move::new("2")).unwrap(); // (2,0)=P2
        g.apply_move(PlayerSide::One, &Move::new("6")).unwrap(); // throwaway
        g.apply_move(PlayerSide::Two, &Move::new("2")).unwrap(); // (2,1)=P2
        g.apply_move(PlayerSide::One, &Move::new("2")).unwrap(); // (2,2)=P1
        // Col 3: P2, P2, P2, P1
        g.apply_move(PlayerSide::Two, &Move::new("3")).unwrap(); // (3,0)=P2
        g.apply_move(PlayerSide::One, &Move::new("6")).unwrap(); // throwaway
        g.apply_move(PlayerSide::Two, &Move::new("3")).unwrap(); // (3,1)=P2
        g.apply_move(PlayerSide::One, &Move::new("6")).unwrap(); // throwaway
        g.apply_move(PlayerSide::Two, &Move::new("3")).unwrap(); // (3,2)=P2
        let status = g.apply_move(PlayerSide::One, &Move::new("3")).unwrap(); // (3,3)=P1 → diag win
        assert_eq!(status, GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }

    #[test]
    fn test_full_column_error() {
        let mut g = Connect4::new();
        for _ in 0..3 {
            g.apply_move(PlayerSide::One, &Move::new("0")).unwrap();
            g.apply_move(PlayerSide::Two, &Move::new("0")).unwrap();
        }
        // Col 0 is now full (6 discs)
        assert!(g.apply_move(PlayerSide::One, &Move::new("0")).is_err());
    }
}
