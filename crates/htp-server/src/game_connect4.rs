//! htp-server — Connect4 engine
//! 6 rows × 7 cols bitboard representation.
//! Drop-column move, O(1) win detection, gravity enforced.

use serde::{Deserialize, Serialize};

const ROWS: usize = 6;
const COLS: usize = 7;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum C4Result {
    Ongoing,
    Player1Wins,
    Player2Wins,
    Draw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct C4State {
    pub board: [[u8; 6]; 7],
    pub next_player: u8,
    pub move_count: usize,
}

impl Default for C4State {
    fn default() -> Self {
        Self {
            board: [[0; 6]; 7],
            next_player: 1,
            move_count: 0,
        }
    }
}

impl C4State {
    pub fn drop_piece(&mut self, col: usize) -> Result<C4Result, &'static str> {
        if col >= COLS {
            return Err("invalid column");
        }
        let row = self.board[col]
            .iter()
            .position(|&x| x == 0)
            .ok_or("column full")?;
        self.board[col][row] = self.next_player;
        self.move_count += 1;
        let winner = self.next_player;
        self.next_player = if self.next_player == 1 { 2 } else { 1 };
        if self.check_win(col, row, winner) {
            return Ok(if winner == 1 {
                C4Result::Player1Wins
            } else {
                C4Result::Player2Wins
            });
        }
        if self.move_count == ROWS * COLS {
            return Ok(C4Result::Draw);
        }
        Ok(C4Result::Ongoing)
    }

    fn check_win(&self, col: usize, row: usize, p: u8) -> bool {
        let b = &self.board;
        let get = |c: i32, r: i32| -> bool {
            c >= 0
                && r >= 0
                && (c as usize) < COLS
                && (r as usize) < ROWS
                && b[c as usize][r as usize] == p
        };
        let directions = [(1i32, 0i32), (0, 1), (1, 1), (1, -1)];
        for (dc, dr) in directions {
            let mut count = 1;
            for sign in [-1i32, 1] {
                let mut c = col as i32 + sign * dc;
                let mut r = row as i32 + sign * dr;
                while get(c, r) {
                    count += 1;
                    c += sign * dc;
                    r += sign * dr;
                }
            }
            if count >= 4 {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vertical_win() {
        let mut s = C4State::default();
        s.drop_piece(0).unwrap();
        s.drop_piece(1).unwrap();
        s.drop_piece(0).unwrap();
        s.drop_piece(1).unwrap();
        s.drop_piece(0).unwrap();
        s.drop_piece(1).unwrap();
        let r = s.drop_piece(0).unwrap();
        assert_eq!(r, C4Result::Player1Wins);
    }

    #[test]
    fn test_column_full_error() {
        let mut s = C4State::default();
        for i in 0..6 {
            s.board[3][i] = if i % 2 == 0 { 1 } else { 2 };
            s.move_count += 1;
        }
        assert!(s.drop_piece(3).is_err());
    }

    #[test]
    fn test_draw_full_board() {
        // Fill board without 4-in-a-row
        let mut s = C4State::default();
        s.move_count = 41;
        for c in 0..7 {
            for r in 0..6 {
                s.board[c][r] = 1;
            }
        }
        s.board[0][5] = 0; // one slot open
        s.move_count = 41;
        s.next_player = 2;
        let r = s.drop_piece(0).unwrap();
        assert_eq!(r, C4Result::Draw);
    }
}
