//! htp-server — Chess game engine via shakmaty
//! Server-side move validation, check/checkmate/draw detection.

use serde::{Deserialize, Serialize};
use htp_games::{GameStatus, GameOutcome};
use shakmaty::{Chess, Color, File, Move, Position, Rank, Role, Square};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChessResult {
    Ongoing,
    WhiteWins,
    BlackWins,
    Draw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChessMoveRequest {
    pub fen: String,
    pub from: String,
    pub to: String,
    pub promotion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChessMoveResponse {
    pub legal: bool,
    pub new_fen: Option<String>,
    pub result: ChessResult,
    pub is_check: bool,
}

pub fn apply_move(req: &ChessMoveRequest) -> ChessMoveResponse {
    use shakmaty::fen::Fen;
    use std::str::FromStr;

    let Ok(fen) = Fen::from_str(&req.fen) else {
        return ChessMoveResponse {
            legal: false,
            new_fen: None,
            result: ChessResult::Ongoing,
            is_check: false,
        };
    };
    let Ok(pos) = fen.into_position::<Chess>(shakmaty::CastlingMode::Standard) else {
        return ChessMoveResponse {
            legal: false,
            new_fen: None,
            result: ChessResult::Ongoing,
            is_check: false,
        };
    };

    let from = Square::from_str(&req.from).ok();
    let to = Square::from_str(&req.to).ok();
    let (Some(from_sq), Some(to_sq)) = (from, to) else {
        return ChessMoveResponse {
            legal: false,
            new_fen: None,
            result: ChessResult::Ongoing,
            is_check: false,
        };
    };

    let promotion = req.promotion.as_deref().and_then(|p| match p {
        "q" => Some(Role::Queen),
        "r" => Some(Role::Rook),
        "b" => Some(Role::Bishop),
        "n" => Some(Role::Knight),
        _ => None,
    });

    let legal_moves = pos.legal_moves();
    let chosen = legal_moves
        .iter()
        .find(|m| m.from() == Some(from_sq) && m.to() == to_sq && m.promotion() == promotion);

    let Some(mv) = chosen else {
        return ChessMoveResponse {
            legal: false,
            new_fen: None,
            result: ChessResult::Ongoing,
            is_check: false,
        };
    };

    let new_pos = pos.play(mv).unwrap();
    let result = if new_pos.is_checkmate() {
        match new_pos.turn() {
            Color::White => ChessResult::BlackWins,
            Color::Black => ChessResult::WhiteWins,
        }
    } else if new_pos.is_stalemate() || new_pos.is_insufficient_material() {
        ChessResult::Draw
    } else {
        ChessResult::Ongoing
    };

    let new_fen =
        shakmaty::fen::Fen::from_position(new_pos.clone(), shakmaty::EnPassantMode::Legal)
            .to_string();

    ChessMoveResponse {
        legal: true,
        new_fen: Some(new_fen),
        result,
        is_check: new_pos.is_check(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const START_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    #[test]
    fn test_legal_pawn_move() {
        let req = ChessMoveRequest {
            fen: START_FEN.into(),
            from: "e2".into(),
            to: "e4".into(),
            promotion: None,
        };
        let res = apply_move(&req);
        assert!(res.legal);
        assert_eq!(res.result, ChessResult::Ongoing);
    }

    #[test]
    fn test_illegal_move_rejected() {
        let req = ChessMoveRequest {
            fen: START_FEN.into(),
            from: "e2".into(),
            to: "e5".into(),
            promotion: None,
        };
        let res = apply_move(&req);
        assert!(!res.legal);
    }

    #[test]
    fn test_fool_checkmate() {
        let fen = "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
        let req = ChessMoveRequest {
            fen: fen.into(),
            from: "d1".into(),
            to: "h5".into(),
            promotion: None,
        };
        let res = apply_move(&req);
        assert!(!res.legal);
    }
}

// ─── Game state wrapper for the main game flow ───────────────────



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChessGame {
    pub fen: String,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub move_count: u32,
    pub moves: Vec<String>,
}

impl ChessGame {
    pub fn new() -> Self {
        Self {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".into(),
            status: GameStatus::Active,
            outcome: GameOutcome::Pending,
            move_count: 0,
            moves: Vec::new(),
        }
    }

    pub fn apply_chess_move(&mut self, from: &str, to: &str, promotion: Option<&str>) -> ChessMoveResponse {
        let req = ChessMoveRequest {
            fen: self.fen.clone(),
            from: from.to_string(),
            to: to.to_string(),
            promotion: promotion.map(String::from),
        };
        let res = apply_move(&req);
        if res.legal {
            if let Some(ref new_fen) = res.new_fen {
                self.fen = new_fen.clone();
            }
            self.move_count += 1;
            self.moves.push(format!("{}{}", from, to));
            match res.result {
                ChessResult::WhiteWins => {
                    self.status = GameStatus::Complete;
                    self.outcome = GameOutcome::Player1Wins;
                }
                ChessResult::BlackWins => {
                    self.status = GameStatus::Complete;
                    self.outcome = GameOutcome::Player2Wins;
                }
                ChessResult::Draw => {
                    self.status = GameStatus::Complete;
                    self.outcome = GameOutcome::Draw;
                }
                ChessResult::Ongoing => {}
            }
        }
        res
    }
}
