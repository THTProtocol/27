//! htp-server — Checkers engine
//! 8x8 board, mandatory captures, multi-jump chains, king promotion.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Piece {
    P1Man,
    P1King,
    P2Man,
    P2King,
}

impl Piece {
    pub fn is_player(&self, p: u8) -> bool {
        matches!(
            (*self, p),
            (Piece::P1Man | Piece::P1King, 1) | (Piece::P2Man | Piece::P2King, 2)
        )
    }
    pub fn is_king(&self) -> bool {
        matches!(self, Piece::P1King | Piece::P2King)
    }
    pub fn promote(&self) -> Self {
        match self {
            Piece::P1Man => Piece::P1King,
            Piece::P2Man => Piece::P2King,
            k => *k,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CheckersResult {
    Ongoing,
    Player1Wins,
    Player2Wins,
}

pub type Board = [[Option<Piece>; 8]; 8];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckersMove {
    pub path: Vec<[usize; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckersState {
    pub board: Board,
    pub next_player: u8,
    pub move_count: usize,
}

impl Default for CheckersState {
    fn default() -> Self {
        let mut board: Board = [[None; 8]; 8];
        for r in 0..3usize {
            for c in 0..8usize {
                if (r + c) % 2 == 1 {
                    board[r][c] = Some(Piece::P2Man);
                }
            }
        }
        for r in 5..8usize {
            for c in 0..8usize {
                if (r + c) % 2 == 1 {
                    board[r][c] = Some(Piece::P1Man);
                }
            }
        }
        Self {
            board,
            next_player: 1,
            move_count: 0,
        }
    }
}

impl CheckersState {
    pub fn apply_move(&mut self, mv: &CheckersMove) -> Result<CheckersResult, &'static str> {
        if mv.path.len() < 2 {
            return Err("path too short");
        }
        let [sr, sc] = mv.path[0];
        let piece = self.board[sr][sc].ok_or("no piece at source")?;
        if !piece.is_player(self.next_player) {
            return Err("not your piece");
        }

        let is_capture = mv.path.len() > 2 || (mv.path[1][0] as i32 - sr as i32).abs() == 2;

        if !is_capture && self.has_captures(self.next_player) {
            return Err("capture mandatory");
        }

        let mut board = self.board;
        let mut cr = sr;
        let mut cc = sc;
        board[cr][cc] = None;

        for &[nr, nc] in &mv.path[1..] {
            let dr = nr as i32 - cr as i32;
            let dc = nc as i32 - cc as i32;
            if dr.abs() == 2 {
                let mr = ((cr as i32 + dr / 2) as usize);
                let mc = ((cc as i32 + dc / 2) as usize);
                let cap = board[mr][mc].ok_or("no piece to capture")?;
                if cap.is_player(self.next_player) {
                    return Err("can't capture own piece");
                }
                board[mr][mc] = None;
            }
            cr = nr;
            cc = nc;
        }

        let promoted = if (self.next_player == 1 && cr == 0) || (self.next_player == 2 && cr == 7) {
            piece.promote()
        } else {
            piece
        };
        board[cr][cc] = Some(promoted);

        self.board = board;
        self.move_count += 1;
        self.next_player = if self.next_player == 1 { 2 } else { 1 };

        if !self.has_any_move(self.next_player) {
            let winner = self.next_player ^ 3;
            return Ok(if winner == 1 {
                CheckersResult::Player1Wins
            } else {
                CheckersResult::Player2Wins
            });
        }
        Ok(CheckersResult::Ongoing)
    }

    fn has_captures(&self, p: u8) -> bool {
        for r in 0..8 {
            for c in 0..8 {
                if let Some(piece) = self.board[r][c] {
                    if piece.is_player(p) && !self.captures_for(r, c, piece).is_empty() {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn has_any_move(&self, p: u8) -> bool {
        for r in 0..8 {
            for c in 0..8 {
                if let Some(piece) = self.board[r][c] {
                    if piece.is_player(p) {
                        if !self.captures_for(r, c, piece).is_empty() {
                            return true;
                        }
                        if !self.simple_moves_for(r, c, piece).is_empty() {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }

    fn captures_for(&self, r: usize, c: usize, piece: Piece) -> Vec<[usize; 2]> {
        let dirs: &[(i32, i32)] = if piece.is_king() {
            &[(-1, -1), (-1, 1), (1, -1), (1, 1)]
        } else if piece.is_player(1) {
            &[(-1, -1), (-1, 1)]
        } else {
            &[(1, -1), (1, 1)]
        };
        dirs.iter()
            .filter_map(|&(dr, dc)| {
                let mr = r as i32 + dr;
                let mc = c as i32 + dc;
                let tr = r as i32 + 2 * dr;
                let tc = c as i32 + 2 * dc;
                if mr < 0 || mc < 0 || tr < 0 || tc < 0 {
                    return None;
                }
                let (mr, mc, tr, tc) = (mr as usize, mc as usize, tr as usize, tc as usize);
                if tr >= 8 || tc >= 8 {
                    return None;
                }
                let mid = self.board[mr][mc]?;
                if piece.is_player(1) == mid.is_player(1) {
                    return None;
                }
                if self.board[tr][tc].is_none() {
                    Some([tr, tc])
                } else {
                    None
                }
            })
            .collect()
    }

    fn simple_moves_for(&self, r: usize, c: usize, piece: Piece) -> Vec<[usize; 2]> {
        let dirs: &[(i32, i32)] = if piece.is_king() {
            &[(-1, -1), (-1, 1), (1, -1), (1, 1)]
        } else if piece.is_player(1) {
            &[(-1, -1), (-1, 1)]
        } else {
            &[(1, -1), (1, 1)]
        };
        dirs.iter()
            .filter_map(|&(dr, dc)| {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                if nr < 0 || nc < 0 || nr >= 8 || nc >= 8 {
                    return None;
                }
                let (nr, nc) = (nr as usize, nc as usize);
                if self.board[nr][nc].is_none() {
                    Some([nr, nc])
                } else {
                    None
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_board_setup() {
        let s = CheckersState::default();
        let p2_count = (0..8)
            .flat_map(|r| (0..8).map(move |c| (r, c)))
            .filter(|&(r, c)| s.board[r][c] == Some(Piece::P2Man))
            .count();
        assert_eq!(p2_count, 12);
    }

    #[test]
    fn test_mandatory_capture_enforcement() {
        let mut s = CheckersState::default();
        s.board = [[None; 8]; 8];
        s.board[5][2] = Some(Piece::P1Man);
        s.board[4][3] = Some(Piece::P2Man); // P2 is opponent, adjacent to P1
        s.board[2][5] = Some(Piece::P2Man); // extra opponent piece
        // P1 at [5][2] can capture P2 at [4][3] landing at [3][4]
        // Try a simple move instead — should be rejected (capture mandatory)
        let mv = CheckersMove {
            path: vec![[5, 2], [4, 1]],
        };
        let r = s.apply_move(&mv);
        assert!(r.is_err());
    }

    #[test]
    fn test_simple_move() {
        let mut s = CheckersState::default();
        s.board = [[None; 8]; 8];
        s.board[5][0] = Some(Piece::P1Man);
        s.board[2][1] = Some(Piece::P2Man); // opponent still has pieces
        let mv = CheckersMove {
            path: vec![[5, 0], [4, 1]],
        };
        let r = s.apply_move(&mv).unwrap();
        assert_eq!(r, CheckersResult::Ongoing);
        assert_eq!(s.board[4][1], Some(Piece::P1Man));
        assert_eq!(s.board[5][0], None);
    }

    #[test]
    fn test_capture_move() {
        let mut s = CheckersState::default();
        s.board = [[None; 8]; 8];
        s.board[5][0] = Some(Piece::P1Man);
        s.board[4][1] = Some(Piece::P2Man);
        s.board[2][3] = Some(Piece::P2Man); // opponent still has pieces after capture
        let mv = CheckersMove {
            path: vec![[5, 0], [3, 2]],
        };
        let r = s.apply_move(&mv).unwrap();
        assert_eq!(r, CheckersResult::Ongoing);
        assert_eq!(s.board[3][2], Some(Piece::P1Man));
        assert_eq!(s.board[4][1], None);
    }
}
