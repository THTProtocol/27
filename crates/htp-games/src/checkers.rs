use serde::{Deserialize, Serialize};
use crate::{GameError, GameOutcome, GameStatus};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum Piece { Empty, P1, P2, P1King, P2King }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Move { pub from: (usize, usize), pub to: (usize, usize) }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkers {
    pub board: [[Piece; 8]; 8],
    pub current_player: u8,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub p1_pieces: u8,
    pub p2_pieces: u8,
}

impl Checkers {
    pub fn new() -> Self {
        let mut board = [[Piece::Empty; 8]; 8];
        for r in 0..3 {
            for c in 0..8 {
                if (r + c) % 2 == 1 { board[r][c] = Piece::P2; }
            }
        }
        for r in 5..8 {
            for c in 0..8 {
                if (r + c) % 2 == 1 { board[r][c] = Piece::P1; }
            }
        }
        Self { board, current_player: 1, status: GameStatus::Active, outcome: GameOutcome::Pending, p1_pieces: 12, p2_pieces: 12 }
    }

    pub fn apply_move(&mut self, mv: Move, player: u8) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active { return Err(GameError::GameOver); }
        if self.current_player != player { return Err(GameError::NotYourTurn); }
        let (fr, fc) = mv.from;
        let (tr, tc) = mv.to;
        let piece = self.board[fr][fc];
        let is_p1 = piece == Piece::P1 || piece == Piece::P1King;
        let is_p2 = piece == Piece::P2 || piece == Piece::P2King;
        if (player == 1 && !is_p1) || (player == 2 && !is_p2) {
            return Err(GameError::InvalidMove("wrong piece".into()));
        }
        let dr = tr as i32 - fr as i32;
        let dc = tc as i32 - fc as i32;
        if dr.abs() == 2 && dc.abs() == 2 {
            let mr = ((fr as i32 + tr as i32) / 2) as usize;
            let mc = ((fc as i32 + tc as i32) / 2) as usize;
            let mid = self.board[mr][mc];
            let capture_valid = (player == 1 && (mid == Piece::P2 || mid == Piece::P2King))
                || (player == 2 && (mid == Piece::P1 || mid == Piece::P1King));
            if !capture_valid { return Err(GameError::InvalidMove("no enemy piece to capture".into())); }
            self.board[mr][mc] = Piece::Empty;
            if player == 1 { self.p2_pieces -= 1; } else { self.p1_pieces -= 1; }
        } else if dr.abs() != 1 || dc.abs() != 1 {
            return Err(GameError::InvalidMove("diagonal 1 or jump 2 only".into()));
        }
        self.board[tr][tc] = piece;
        self.board[fr][fc] = Piece::Empty;
        // kinging
        if tr == 0 && piece == Piece::P1 { self.board[tr][tc] = Piece::P1King; }
        if tr == 7 && piece == Piece::P2 { self.board[tr][tc] = Piece::P2King; }
        if self.p1_pieces == 0 { self.status = GameStatus::Complete; self.outcome = GameOutcome::Player2Wins; }
        else if self.p2_pieces == 0 { self.status = GameStatus::Complete; self.outcome = GameOutcome::Player1Wins; }
        else { self.current_player = 3 - player; }
        Ok(self.outcome.clone())
    }
}

impl Default for Checkers {
    fn default() -> Self { Self::new() }
}
