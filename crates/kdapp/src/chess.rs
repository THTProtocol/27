//! Chess Episode — full FIDE rules: legal move generation, check/checkmate/stalemate,
//! castling, en passant, pawn promotion, 50-move draw, threefold repetition.
//!
//! Move format: algebraic coordinate notation "e2e4", "e1g1" (castling), "e7e8q" (promotion).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::episode::{Episode, GameResult, GameStatus, Move, PlayerSide};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Color {
    White,
    Black,
}

impl Color {
    fn opponent(self) -> Self {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }

    fn to_side(self) -> PlayerSide {
        match self {
            Color::White => PlayerSide::One,
            Color::Black => PlayerSide::Two,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PieceKind {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChessPiece {
    pub kind: PieceKind,
    pub color: Color,
}

impl ChessPiece {
    fn new(kind: PieceKind, color: Color) -> Self {
        Self { kind, color }
    }

    fn symbol(self) -> char {
        let ch = match self.kind {
            PieceKind::Pawn => 'P',
            PieceKind::Knight => 'N',
            PieceKind::Bishop => 'B',
            PieceKind::Rook => 'R',
            PieceKind::Queen => 'Q',
            PieceKind::King => 'K',
        };
        match self.color {
            Color::White => ch,
            Color::Black => ch.to_ascii_lowercase(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

impl Default for CastlingRights {
    fn default() -> Self {
        Self {
            white_kingside: true,
            white_queenside: true,
            black_kingside: true,
            black_queenside: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Chess {
    board: [[Option<ChessPiece>; 8]; 8], // board[rank][file], rank 0=1, file 0=a
    turn: Color,
    castling: CastlingRights,
    en_passant: Option<(usize, usize)>, // target square (rank, file)
    halfmove_clock: u32,                // for 50-move rule
    fullmove_number: u32,
    moves: usize,
    finished: Option<GameResult>,
    #[serde(skip)]
    position_history: HashMap<String, u32>,
}

impl Chess {
    pub fn new() -> Self {
        let mut board = [[None; 8]; 8];

        // White pieces (rank 0 = row 1)
        let back_rank = [
            PieceKind::Rook, PieceKind::Knight, PieceKind::Bishop, PieceKind::Queen,
            PieceKind::King, PieceKind::Bishop, PieceKind::Knight, PieceKind::Rook,
        ];
        for (f, &kind) in back_rank.iter().enumerate() {
            board[0][f] = Some(ChessPiece::new(kind, Color::White));
        }
        for f in 0..8 {
            board[1][f] = Some(ChessPiece::new(PieceKind::Pawn, Color::White));
        }

        // Black pieces (rank 7 = row 8)
        for (f, &kind) in back_rank.iter().enumerate() {
            board[7][f] = Some(ChessPiece::new(kind, Color::Black));
        }
        for f in 0..8 {
            board[6][f] = Some(ChessPiece::new(PieceKind::Pawn, Color::Black));
        }

        let mut chess = Self {
            board,
            turn: Color::White,
            castling: CastlingRights::default(),
            en_passant: None,
            halfmove_clock: 0,
            fullmove_number: 1,
            moves: 0,
            finished: None,
            position_history: HashMap::new(),
        };
        chess.record_position();
        chess
    }

    fn in_bounds(r: i32, f: i32) -> bool {
        (0..8).contains(&r) && (0..8).contains(&f)
    }

    fn at(&self, r: usize, f: usize) -> Option<ChessPiece> {
        self.board[r][f]
    }

    fn find_king(&self, color: Color) -> (usize, usize) {
        for r in 0..8 {
            for f in 0..8 {
                if let Some(p) = self.board[r][f] {
                    if p.kind == PieceKind::King && p.color == color {
                        return (r, f);
                    }
                }
            }
        }
        unreachable!("King must exist")
    }

    /// Is the given square attacked by `attacker`?
    fn is_attacked_by(&self, r: usize, f: usize, attacker: Color) -> bool {
        // Knight attacks
        for &(dr, df) in &[
            (-2i32, -1i32), (-2, 1), (-1, -2), (-1, 2),
            (1, -2), (1, 2), (2, -1), (2, 1),
        ] {
            let nr = r as i32 + dr;
            let nf = f as i32 + df;
            if Self::in_bounds(nr, nf) {
                if let Some(p) = self.board[nr as usize][nf as usize] {
                    if p.color == attacker && p.kind == PieceKind::Knight {
                        return true;
                    }
                }
            }
        }

        // Pawn attacks
        let pawn_dir: i32 = if attacker == Color::White { 1 } else { -1 };
        // Pawns attack from their forward direction toward us, so we look backward
        let pawn_rank = r as i32 - pawn_dir;
        for &df in &[-1i32, 1] {
            let pf = f as i32 + df;
            if Self::in_bounds(pawn_rank, pf) {
                if let Some(p) = self.board[pawn_rank as usize][pf as usize] {
                    if p.color == attacker && p.kind == PieceKind::Pawn {
                        return true;
                    }
                }
            }
        }

        // King attacks
        for dr in -1..=1i32 {
            for df in -1..=1i32 {
                if dr == 0 && df == 0 { continue; }
                let nr = r as i32 + dr;
                let nf = f as i32 + df;
                if Self::in_bounds(nr, nf) {
                    if let Some(p) = self.board[nr as usize][nf as usize] {
                        if p.color == attacker && p.kind == PieceKind::King {
                            return true;
                        }
                    }
                }
            }
        }

        // Sliding pieces (rook/queen orthogonal, bishop/queen diagonal)
        // Orthogonal (rook, queen)
        for &(dr, df) in &[(0i32, 1i32), (0, -1), (1, 0), (-1, 0)] {
            let mut nr = r as i32 + dr;
            let mut nf = f as i32 + df;
            while Self::in_bounds(nr, nf) {
                if let Some(p) = self.board[nr as usize][nf as usize] {
                    if p.color == attacker && (p.kind == PieceKind::Rook || p.kind == PieceKind::Queen) {
                        return true;
                    }
                    break; // blocked
                }
                nr += dr;
                nf += df;
            }
        }

        // Diagonal (bishop, queen)
        for &(dr, df) in &[(1i32, 1i32), (1, -1), (-1, 1), (-1, -1)] {
            let mut nr = r as i32 + dr;
            let mut nf = f as i32 + df;
            while Self::in_bounds(nr, nf) {
                if let Some(p) = self.board[nr as usize][nf as usize] {
                    if p.color == attacker && (p.kind == PieceKind::Bishop || p.kind == PieceKind::Queen) {
                        return true;
                    }
                    break;
                }
                nr += dr;
                nf += df;
            }
        }

        false
    }

    fn is_in_check(&self, color: Color) -> bool {
        let (kr, kf) = self.find_king(color);
        self.is_attacked_by(kr, kf, color.opponent())
    }

    /// Generate all pseudo-legal moves for `color`, then filter for legality.
    fn generate_legal_moves(&self, color: Color) -> Vec<(usize, usize, usize, usize, Option<PieceKind>)> {
        let mut moves = vec![];
        self.generate_pseudo_legal(color, &mut moves);
        // Filter: only keep moves that don't leave own king in check
        moves.retain(|&(sr, sf, dr, df, promo)| {
            let mut test = self.clone();
            test.make_move_unchecked(sr, sf, dr, df, promo);
            !test.is_in_check(color)
        });
        moves
    }

    fn generate_pseudo_legal(
        &self,
        color: Color,
        out: &mut Vec<(usize, usize, usize, usize, Option<PieceKind>)>,
    ) {
        for r in 0..8 {
            for f in 0..8 {
                if let Some(piece) = self.board[r][f] {
                    if piece.color != color {
                        continue;
                    }
                    match piece.kind {
                        PieceKind::Pawn => self.gen_pawn_moves(r, f, color, out),
                        PieceKind::Knight => self.gen_knight_moves(r, f, color, out),
                        PieceKind::Bishop => self.gen_sliding_moves(r, f, color, &[(1,1),(1,-1),(-1,1),(-1,-1)], out),
                        PieceKind::Rook => self.gen_sliding_moves(r, f, color, &[(0,1),(0,-1),(1,0),(-1,0)], out),
                        PieceKind::Queen => self.gen_sliding_moves(r, f, color, &[(0,1),(0,-1),(1,0),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)], out),
                        PieceKind::King => self.gen_king_moves(r, f, color, out),
                    }
                }
            }
        }
    }

    fn gen_pawn_moves(
        &self, r: usize, f: usize, color: Color,
        out: &mut Vec<(usize, usize, usize, usize, Option<PieceKind>)>,
    ) {
        let dir: i32 = if color == Color::White { 1 } else { -1 };
        let start_rank = if color == Color::White { 1 } else { 6 };
        let promo_rank = if color == Color::White { 7 } else { 0 };

        // Forward one
        let nr = r as i32 + dir;
        if Self::in_bounds(nr, f as i32) && self.board[nr as usize][f].is_none() {
            if nr as usize == promo_rank {
                for &kind in &[PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight] {
                    out.push((r, f, nr as usize, f, Some(kind)));
                }
            } else {
                out.push((r, f, nr as usize, f, None));
                // Forward two from start
                if r == start_rank {
                    let nr2 = nr + dir;
                    if Self::in_bounds(nr2, f as i32) && self.board[nr2 as usize][f].is_none() {
                        out.push((r, f, nr2 as usize, f, None));
                    }
                }
            }
        }

        // Captures (including en passant)
        for &df in &[-1i32, 1] {
            let nf = f as i32 + df;
            if !Self::in_bounds(nr, nf) { continue; }
            let nr_u = nr as usize;
            let nf_u = nf as usize;

            let is_capture = self.board[nr_u][nf_u]
                .map(|p| p.color != color)
                .unwrap_or(false);
            let is_ep = self.en_passant == Some((nr_u, nf_u));

            if is_capture || is_ep {
                if nr_u == promo_rank {
                    for &kind in &[PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight] {
                        out.push((r, f, nr_u, nf_u, Some(kind)));
                    }
                } else {
                    out.push((r, f, nr_u, nf_u, None));
                }
            }
        }
    }

    fn gen_knight_moves(
        &self, r: usize, f: usize, color: Color,
        out: &mut Vec<(usize, usize, usize, usize, Option<PieceKind>)>,
    ) {
        for &(dr, df) in &[
            (-2i32, -1i32), (-2, 1), (-1, -2), (-1, 2),
            (1, -2), (1, 2), (2, -1), (2, 1),
        ] {
            let nr = r as i32 + dr;
            let nf = f as i32 + df;
            if Self::in_bounds(nr, nf) {
                let nr_u = nr as usize;
                let nf_u = nf as usize;
                if self.board[nr_u][nf_u].map(|p| p.color) != Some(color) {
                    out.push((r, f, nr_u, nf_u, None));
                }
            }
        }
    }

    fn gen_sliding_moves(
        &self, r: usize, f: usize, color: Color,
        dirs: &[(i32, i32)],
        out: &mut Vec<(usize, usize, usize, usize, Option<PieceKind>)>,
    ) {
        for &(dr, df) in dirs {
            let mut nr = r as i32 + dr;
            let mut nf = f as i32 + df;
            while Self::in_bounds(nr, nf) {
                let nr_u = nr as usize;
                let nf_u = nf as usize;
                match self.board[nr_u][nf_u] {
                    None => {
                        out.push((r, f, nr_u, nf_u, None));
                    }
                    Some(p) if p.color != color => {
                        out.push((r, f, nr_u, nf_u, None));
                        break;
                    }
                    _ => break, // own piece
                }
                nr += dr;
                nf += df;
            }
        }
    }

    fn gen_king_moves(
        &self, r: usize, f: usize, color: Color,
        out: &mut Vec<(usize, usize, usize, usize, Option<PieceKind>)>,
    ) {
        for dr in -1..=1i32 {
            for df in -1..=1i32 {
                if dr == 0 && df == 0 { continue; }
                let nr = r as i32 + dr;
                let nf = f as i32 + df;
                if Self::in_bounds(nr, nf) {
                    let nr_u = nr as usize;
                    let nf_u = nf as usize;
                    if self.board[nr_u][nf_u].map(|p| p.color) != Some(color) {
                        out.push((r, f, nr_u, nf_u, None));
                    }
                }
            }
        }

        // Castling
        let back_rank = if color == Color::White { 0 } else { 7 };
        if r == back_rank && f == 4 && !self.is_in_check(color) {
            // Kingside
            let can_ks = if color == Color::White {
                self.castling.white_kingside
            } else {
                self.castling.black_kingside
            };
            if can_ks
                && self.board[back_rank][5].is_none()
                && self.board[back_rank][6].is_none()
                && !self.is_attacked_by(back_rank, 5, color.opponent())
                && !self.is_attacked_by(back_rank, 6, color.opponent())
            {
                out.push((r, 4, back_rank, 6, None));
            }

            // Queenside
            let can_qs = if color == Color::White {
                self.castling.white_queenside
            } else {
                self.castling.black_queenside
            };
            if can_qs
                && self.board[back_rank][3].is_none()
                && self.board[back_rank][2].is_none()
                && self.board[back_rank][1].is_none()
                && !self.is_attacked_by(back_rank, 3, color.opponent())
                && !self.is_attacked_by(back_rank, 2, color.opponent())
            {
                out.push((r, 4, back_rank, 2, None));
            }
        }
    }

    /// Apply a move without checking legality — used for testing check.
    fn make_move_unchecked(
        &mut self,
        sr: usize, sf: usize,
        dr: usize, df: usize,
        promo: Option<PieceKind>,
    ) {
        let piece = self.board[sr][sf].unwrap();

        // En passant capture
        if piece.kind == PieceKind::Pawn && Some((dr, df)) == self.en_passant {
            let capture_rank = sr; // captured pawn is on same rank as moving pawn
            self.board[capture_rank][df] = None;
        }

        // Update en passant target
        self.en_passant = None;
        if piece.kind == PieceKind::Pawn && (dr as i32 - sr as i32).unsigned_abs() == 2 {
            let ep_rank = (sr + dr) / 2;
            self.en_passant = Some((ep_rank, sf));
        }

        // Castling: move the rook too
        if piece.kind == PieceKind::King {
            let back_rank = if piece.color == Color::White { 0 } else { 7 };
            if sr == back_rank && sf == 4 {
                if df == 6 {
                    // Kingside
                    self.board[back_rank][5] = self.board[back_rank][7];
                    self.board[back_rank][7] = None;
                } else if df == 2 {
                    // Queenside
                    self.board[back_rank][3] = self.board[back_rank][0];
                    self.board[back_rank][0] = None;
                }
            }
        }

        // Update castling rights
        if piece.kind == PieceKind::King {
            match piece.color {
                Color::White => {
                    self.castling.white_kingside = false;
                    self.castling.white_queenside = false;
                }
                Color::Black => {
                    self.castling.black_kingside = false;
                    self.castling.black_queenside = false;
                }
            }
        }
        if piece.kind == PieceKind::Rook {
            match (piece.color, sr, sf) {
                (Color::White, 0, 0) => self.castling.white_queenside = false,
                (Color::White, 0, 7) => self.castling.white_kingside = false,
                (Color::Black, 7, 0) => self.castling.black_queenside = false,
                (Color::Black, 7, 7) => self.castling.black_kingside = false,
                _ => {}
            }
        }
        // If capturing a rook on its home square
        if let Some(captured) = self.board[dr][df] {
            if captured.kind == PieceKind::Rook {
                match (captured.color, dr, df) {
                    (Color::White, 0, 0) => self.castling.white_queenside = false,
                    (Color::White, 0, 7) => self.castling.white_kingside = false,
                    (Color::Black, 7, 0) => self.castling.black_queenside = false,
                    (Color::Black, 7, 7) => self.castling.black_kingside = false,
                    _ => {}
                }
            }
        }

        // Halfmove clock
        if piece.kind == PieceKind::Pawn || self.board[dr][df].is_some() {
            self.halfmove_clock = 0;
        } else {
            self.halfmove_clock += 1;
        }

        // Move piece
        self.board[dr][df] = Some(match promo {
            Some(kind) => ChessPiece::new(kind, piece.color),
            None => piece,
        });
        self.board[sr][sf] = None;

        self.turn = self.turn.opponent();
        if self.turn == Color::White {
            self.fullmove_number += 1;
        }
    }

    fn position_key(&self) -> String {
        // Compact position key for repetition detection
        let mut key = String::with_capacity(80);
        for r in 0..8 {
            for f in 0..8 {
                key.push(self.board[r][f].map(|p| p.symbol()).unwrap_or('.'));
            }
        }
        key.push(if self.turn == Color::White { 'w' } else { 'b' });
        if self.castling.white_kingside { key.push('K'); }
        if self.castling.white_queenside { key.push('Q'); }
        if self.castling.black_kingside { key.push('k'); }
        if self.castling.black_queenside { key.push('q'); }
        if let Some((er, ef)) = self.en_passant {
            key.push((b'a' + ef as u8) as char);
            key.push_str(&(er + 1).to_string());
        }
        key
    }

    fn record_position(&mut self) {
        let key = self.position_key();
        *self.position_history.entry(key).or_insert(0) += 1;
    }

    fn is_threefold_repetition(&self) -> bool {
        let key = self.position_key();
        self.position_history.get(&key).copied().unwrap_or(0) >= 3
    }

    fn check_game_end(&mut self) {
        let legal = self.generate_legal_moves(self.turn);
        if legal.is_empty() {
            if self.is_in_check(self.turn) {
                // Checkmate
                self.finished = Some(GameResult::Win(self.turn.opponent().to_side()));
            } else {
                // Stalemate
                self.finished = Some(GameResult::Draw);
            }
        } else if self.halfmove_clock >= 100 {
            // 50-move rule (100 half-moves)
            self.finished = Some(GameResult::Draw);
        } else if self.is_threefold_repetition() {
            self.finished = Some(GameResult::Draw);
        }
    }

    /// Parse coordinate notation: "e2e4", "e7e8q"
    fn parse_move(s: &str) -> Result<(usize, usize, usize, usize, Option<PieceKind>), String> {
        let s = s.trim().to_lowercase();
        if s.len() < 4 || s.len() > 5 {
            return Err(format!("Invalid move '{}': expected 4-5 chars like 'e2e4'", s));
        }
        let bytes = s.as_bytes();
        let sf = (bytes[0] as i32) - b'a' as i32;
        let sr = (bytes[1] as i32) - b'1' as i32;
        let df = (bytes[2] as i32) - b'a' as i32;
        let dr = (bytes[3] as i32) - b'1' as i32;

        if !Self::in_bounds(sr, sf) || !Self::in_bounds(dr, df) {
            return Err(format!("Move '{}' contains out-of-bounds squares", s));
        }

        let promo = if s.len() == 5 {
            Some(match bytes[4] {
                b'q' => PieceKind::Queen,
                b'r' => PieceKind::Rook,
                b'b' => PieceKind::Bishop,
                b'n' => PieceKind::Knight,
                _ => return Err(format!("Invalid promotion piece '{}'", bytes[4] as char)),
            })
        } else {
            None
        };

        Ok((sr as usize, sf as usize, dr as usize, df as usize, promo))
    }

    fn square_name(r: usize, f: usize) -> String {
        format!("{}{}", (b'a' + f as u8) as char, r + 1)
    }
}

impl Default for Chess {
    fn default() -> Self {
        Self::new()
    }
}

impl Episode for Chess {
    fn name(&self) -> &str {
        "Chess"
    }

    fn status(&self) -> GameStatus {
        if let Some(result) = self.finished {
            return GameStatus::Finished(result);
        }
        GameStatus::InProgress(self.turn.to_side())
    }

    fn apply_move(&mut self, side: PlayerSide, mv: &Move) -> Result<GameStatus, String> {
        let expected_color = match side {
            PlayerSide::One => Color::White,
            PlayerSide::Two => Color::Black,
        };
        if self.turn != expected_color {
            return Err(format!("Not {:?}'s turn", side));
        }
        if self.finished.is_some() {
            return Err("Game is already over".into());
        }

        let (sr, sf, dr, df, promo) = Self::parse_move(mv.as_str())?;

        // Verify this is a legal move
        let legal = self.generate_legal_moves(self.turn);
        if !legal.contains(&(sr, sf, dr, df, promo)) {
            return Err(format!("Illegal move '{}'", mv.as_str()));
        }

        self.make_move_unchecked(sr, sf, dr, df, promo);
        self.moves += 1;
        self.record_position();
        self.check_game_end();
        Ok(self.status())
    }

    fn legal_moves(&self) -> Vec<Move> {
        if self.finished.is_some() {
            return vec![];
        }
        self.generate_legal_moves(self.turn)
            .iter()
            .map(|&(sr, sf, dr, df, promo)| {
                let mut s = format!("{}{}", Self::square_name(sr, sf), Self::square_name(dr, df));
                if let Some(kind) = promo {
                    s.push(match kind {
                        PieceKind::Queen => 'q',
                        PieceKind::Rook => 'r',
                        PieceKind::Bishop => 'b',
                        PieceKind::Knight => 'n',
                        _ => 'q',
                    });
                }
                Move::new(s)
            })
            .collect()
    }

    fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    fn from_json(json: &str) -> Result<Self, String> {
        let mut chess: Self = serde_json::from_str(json).map_err(|e| e.to_string())?;
        // Rebuild position history from deserialized state
        chess.position_history = HashMap::new();
        chess.record_position();
        Ok(chess)
    }

    fn move_count(&self) -> usize {
        self.moves
    }

    fn display(&self) -> String {
        let mut lines = vec![];
        lines.push("    a b c d e f g h".to_string());
        lines.push("  +-----------------+".to_string());
        for r in (0..8).rev() {
            let row_str: String = (0..8)
                .map(|f| {
                    self.board[r][f]
                        .map(|p| format!("{}", p.symbol()))
                        .unwrap_or_else(|| ".".to_string())
                })
                .collect::<Vec<_>>()
                .join(" ");
            lines.push(format!("{} | {} |", r + 1, row_str));
        }
        lines.push("  +-----------------+".to_string());
        lines.push(format!(
            "  {} to move | Move {}",
            if self.turn == Color::White { "White" } else { "Black" },
            self.fullmove_number
        ));
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_legal_moves() {
        let g = Chess::new();
        let moves = g.legal_moves();
        // White has 20 legal opening moves (16 pawn + 4 knight)
        assert_eq!(moves.len(), 20);
    }

    #[test]
    fn test_e4_e5() {
        let mut g = Chess::new();
        g.apply_move(PlayerSide::One, &Move::new("e2e4")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("e7e5")).unwrap();
        assert!(g.board[3][4].is_some()); // e4
        assert!(g.board[4][4].is_some()); // e5
    }

    #[test]
    fn test_scholars_mate() {
        // 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6?? 4. Qxf7#
        let mut g = Chess::new();
        g.apply_move(PlayerSide::One, &Move::new("e2e4")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("e7e5")).unwrap();
        g.apply_move(PlayerSide::One, &Move::new("d1h5")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("b8c6")).unwrap();
        g.apply_move(PlayerSide::One, &Move::new("f1c4")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("g8f6")).unwrap();
        let status = g.apply_move(PlayerSide::One, &Move::new("h5f7")).unwrap();
        assert_eq!(status, GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }

    #[test]
    fn test_castling_kingside() {
        let mut g = Chess::new();
        // Clear path for white kingside castle
        g.board[0][5] = None; // f1
        g.board[0][6] = None; // g1
        let legal = g.generate_legal_moves(Color::White);
        assert!(legal.contains(&(0, 4, 0, 6, None))); // e1g1
    }

    #[test]
    fn test_en_passant() {
        let mut g = Chess::new();
        g.apply_move(PlayerSide::One, &Move::new("e2e4")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("a7a6")).unwrap();
        g.apply_move(PlayerSide::One, &Move::new("e4e5")).unwrap();
        g.apply_move(PlayerSide::Two, &Move::new("d7d5")).unwrap(); // en passant target
        // White can capture en passant: e5xd6
        let legal = g.legal_moves();
        assert!(legal.iter().any(|m| m.as_str() == "e5d6"));
    }

    #[test]
    fn test_promotion() {
        let mut g = Chess::new();
        // Clear path for a white pawn on rank 7
        g.board = [[None; 8]; 8];
        g.board[6][0] = Some(ChessPiece::new(PieceKind::Pawn, Color::White)); // a7
        g.board[0][4] = Some(ChessPiece::new(PieceKind::King, Color::White));
        g.board[7][4] = Some(ChessPiece::new(PieceKind::King, Color::Black));
        g.turn = Color::White;

        let status = g.apply_move(PlayerSide::One, &Move::new("a7a8q")).unwrap();
        assert!(g.board[7][0].unwrap().kind == PieceKind::Queen);
        assert!(matches!(status, GameStatus::InProgress(_)));
    }

    #[test]
    fn test_stalemate() {
        // King vs King + Queen, set up stalemate
        let mut g = Chess::new();
        g.board = [[None; 8]; 8];
        g.board[0][0] = Some(ChessPiece::new(PieceKind::King, Color::Black)); // a1
        g.board[2][1] = Some(ChessPiece::new(PieceKind::Queen, Color::White)); // b3
        g.board[1][2] = Some(ChessPiece::new(PieceKind::King, Color::White)); // c2
        g.turn = Color::Black;
        g.finished = None;
        g.check_game_end();
        assert_eq!(g.status(), GameStatus::Finished(GameResult::Draw));
    }

    #[test]
    fn test_illegal_move_rejected() {
        let g = Chess::new();
        let mut g2 = g.clone();
        assert!(g2.apply_move(PlayerSide::One, &Move::new("e2e5")).is_err()); // pawn can't go 3 squares
    }
}
