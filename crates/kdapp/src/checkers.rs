//! Checkers Episode — 8×8 board, mandatory captures, multi-jump chains, king promotion.
//!
//! Move format: "r1c1-r2c2" or "r1c1-r2c2-r3c3" for multi-jump chains.
//! Player One = Red (starts rows 0-2), Player Two = Black (starts rows 5-7).
//! Red moves upward (increasing row), Black moves downward.
//! Kings can move/capture in all four diagonal directions.

use serde::{Deserialize, Serialize};

use crate::episode::{Episode, GameResult, GameStatus, Move, PlayerSide};

const SIZE: usize = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum Piece {
    Red,
    RedKing,
    Black,
    BlackKing,
}

impl Piece {
    fn side(self) -> PlayerSide {
        match self {
            Piece::Red | Piece::RedKing => PlayerSide::One,
            Piece::Black | Piece::BlackKing => PlayerSide::Two,
        }
    }

    fn is_king(self) -> bool {
        matches!(self, Piece::RedKing | Piece::BlackKing)
    }

    fn promote(self) -> Self {
        match self {
            Piece::Red => Piece::RedKing,
            Piece::Black => Piece::BlackKing,
            other => other,
        }
    }

    /// Forward directions for this piece (row deltas).
    fn forward_dirs(self) -> &'static [i32] {
        match self {
            Piece::Red => &[1],             // Red moves up
            Piece::Black => &[-1],          // Black moves down
            Piece::RedKing | Piece::BlackKing => &[1, -1], // Kings both
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Checkers {
    board: [[Option<Piece>; SIZE]; SIZE], // board[row][col]
    turn: PlayerSide,
    moves: usize,
    finished: Option<GameResult>,
}

impl Checkers {
    pub fn new() -> Self {
        let mut board = [[None; SIZE]; SIZE];
        // Red (Player One) on rows 0-2, dark squares only
        for row in 0..3 {
            for col in 0..SIZE {
                if (row + col) % 2 == 1 {
                    board[row][col] = Some(Piece::Red);
                }
            }
        }
        // Black (Player Two) on rows 5-7
        for row in 5..8 {
            for col in 0..SIZE {
                if (row + col) % 2 == 1 {
                    board[row][col] = Some(Piece::Black);
                }
            }
        }
        Self {
            board,
            turn: PlayerSide::One, // Red goes first
            moves: 0,
            finished: None,
        }
    }

    fn in_bounds(r: i32, c: i32) -> bool {
        r >= 0 && r < SIZE as i32 && c >= 0 && c < SIZE as i32
    }

    fn piece_at(&self, r: usize, c: usize) -> Option<Piece> {
        self.board[r][c]
    }

    /// Find all simple (non-capture) moves for a piece at (r,c).
    fn simple_moves_for(&self, r: usize, c: usize) -> Vec<Vec<(usize, usize)>> {
        let piece = match self.board[r][c] {
            Some(p) => p,
            None => return vec![],
        };
        let mut result = vec![];
        for &dr in piece.forward_dirs() {
            for dc in [-1i32, 1i32] {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
                if Self::in_bounds(nr, nc) && self.board[nr as usize][nc as usize].is_none() {
                    result.push(vec![(r, c), (nr as usize, nc as usize)]);
                }
            }
        }
        result
    }

    /// Find all capture chains starting from (r,c). Returns sequences of positions.
    fn capture_chains_for(&self, r: usize, c: usize) -> Vec<Vec<(usize, usize)>> {
        let piece = match self.board[r][c] {
            Some(p) => p,
            None => return vec![],
        };
        let mut results = vec![];
        let mut board_copy = self.board;
        self.capture_dfs(r, c, piece, &mut board_copy, &mut vec![(r, c)], &mut results);
        results
    }

    fn capture_dfs(
        &self,
        r: usize,
        c: usize,
        piece: Piece,
        board: &mut [[Option<Piece>; SIZE]; SIZE],
        path: &mut Vec<(usize, usize)>,
        results: &mut Vec<Vec<(usize, usize)>>,
    ) {
        let mut found_capture = false;
        for &dr in piece.forward_dirs() {
            for dc in [-1i32, 1i32] {
                let mr = r as i32 + dr; // midpoint (captured piece)
                let mc = c as i32 + dc;
                let lr = r as i32 + 2 * dr; // landing
                let lc = c as i32 + 2 * dc;
                if !Self::in_bounds(lr, lc) {
                    continue;
                }
                let mr_u = mr as usize;
                let mc_u = mc as usize;
                let lr_u = lr as usize;
                let lc_u = lc as usize;

                if let Some(mid_piece) = board[mr_u][mc_u] {
                    if mid_piece.side() != piece.side() && board[lr_u][lc_u].is_none() {
                        found_capture = true;
                        // Temporarily remove captured piece
                        let saved = board[mr_u][mc_u];
                        board[mr_u][mc_u] = None;
                        path.push((lr_u, lc_u));

                        // Check if piece promotes mid-chain (king promotion extends directions)
                        let effective_piece = if should_promote(piece, lr_u) {
                            piece.promote()
                        } else {
                            piece
                        };

                        self.capture_dfs(lr_u, lc_u, effective_piece, board, path, results);

                        path.pop();
                        board[mr_u][mc_u] = saved;
                    }
                }
            }
        }
        if !found_capture && path.len() > 1 {
            results.push(path.clone());
        }
    }

    /// All legal moves for the current player as chains of positions.
    fn all_moves_for_side(&self, side: PlayerSide) -> Vec<Vec<(usize, usize)>> {
        let mut captures = vec![];
        let mut simples = vec![];

        for r in 0..SIZE {
            for c in 0..SIZE {
                if let Some(piece) = self.board[r][c] {
                    if piece.side() == side {
                        let mut caps = self.capture_chains_for(r, c);
                        captures.append(&mut caps);
                        let mut sms = self.simple_moves_for(r, c);
                        simples.append(&mut sms);
                    }
                }
            }
        }

        // Mandatory capture rule: if any capture is available, must capture
        if !captures.is_empty() {
            captures
        } else {
            simples
        }
    }

    fn path_to_string(path: &[(usize, usize)]) -> String {
        path.iter()
            .map(|(r, c)| {
                let col_ch = (b'a' + *c as u8) as char;
                format!("{}{}", col_ch, r + 1)
            })
            .collect::<Vec<_>>()
            .join("-")
    }

    fn parse_path(s: &str) -> Result<Vec<(usize, usize)>, String> {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() < 2 {
            return Err("Move must have at least two positions (e.g. 'c3-d4')".into());
        }
        let mut path = vec![];
        for part in parts {
            let bytes = part.as_bytes();
            if bytes.len() < 2 {
                return Err(format!("Invalid position '{}'", part));
            }
            let col = (bytes[0].to_ascii_lowercase() as i32) - b'a' as i32;
            let row: i32 = part[1..]
                .parse::<i32>()
                .map_err(|_| format!("Invalid row in '{}'", part))?
                - 1;
            if col < 0 || col >= SIZE as i32 || row < 0 || row >= SIZE as i32 {
                return Err(format!("Position '{}' out of bounds", part));
            }
            path.push((row as usize, col as usize));
        }
        Ok(path)
    }

    fn apply_path(&mut self, path: &[(usize, usize)]) -> Result<(), String> {
        if path.len() < 2 {
            return Err("Path too short".into());
        }
        let (sr, sc) = path[0];
        let piece = self.board[sr][sc].ok_or("No piece at start position")?;

        // Simple move (2 positions, no capture)
        if path.len() == 2 {
            let (dr, dc) = path[1];
            let row_diff = (dr as i32 - sr as i32).abs();
            let col_diff = (dc as i32 - sc as i32).abs();

            if row_diff == 1 && col_diff == 1 {
                // Simple move
                if self.board[dr][dc].is_some() {
                    return Err("Destination is occupied".into());
                }
                self.board[sr][sc] = None;
                self.board[dr][dc] = Some(if should_promote(piece, dr) {
                    piece.promote()
                } else {
                    piece
                });
                return Ok(());
            } else if row_diff == 2 && col_diff == 2 {
                // Single capture
                let mr = ((sr as i32 + dr as i32) / 2) as usize;
                let mc = ((sc as i32 + dc as i32) / 2) as usize;
                if let Some(mid_piece) = self.board[mr][mc] {
                    if mid_piece.side() == piece.side() {
                        return Err("Cannot capture own piece".into());
                    }
                } else {
                    return Err("No piece to capture".into());
                }
                if self.board[dr][dc].is_some() {
                    return Err("Landing square is occupied".into());
                }
                self.board[sr][sc] = None;
                self.board[mr][mc] = None;
                self.board[dr][dc] = Some(if should_promote(piece, dr) {
                    piece.promote()
                } else {
                    piece
                });
                return Ok(());
            }
        }

        // Multi-jump chain
        let mut current_r = sr;
        let mut current_c = sc;
        let mut current_piece = piece;
        self.board[sr][sc] = None;

        for i in 1..path.len() {
            let (nr, nc) = path[i];
            let row_diff = (nr as i32 - current_r as i32).abs();
            let col_diff = (nc as i32 - current_c as i32).abs();
            if row_diff != 2 || col_diff != 2 {
                return Err(format!("Invalid jump from ({},{}) to ({},{})", current_r, current_c, nr, nc));
            }
            let mr = ((current_r as i32 + nr as i32) / 2) as usize;
            let mc = ((current_c as i32 + nc as i32) / 2) as usize;
            if self.board[mr][mc].map(|p| p.side()) != Some(current_piece.side().opponent()) {
                return Err(format!("No opponent piece to capture at ({},{})", mr, mc));
            }
            if self.board[nr][nc].is_some() {
                return Err(format!("Landing ({},{}) is occupied", nr, nc));
            }
            self.board[mr][mc] = None; // remove captured piece
            current_r = nr;
            current_c = nc;
            if should_promote(current_piece, current_r) {
                current_piece = current_piece.promote();
            }
        }

        self.board[current_r][current_c] = Some(current_piece);
        Ok(())
    }

    fn check_game_over(&mut self) {
        let next_moves = self.all_moves_for_side(self.turn);
        if next_moves.is_empty() {
            // Current player has no moves → opponent wins
            self.finished = Some(GameResult::Win(self.turn.opponent()));
        }
    }
}

fn should_promote(piece: Piece, row: usize) -> bool {
    match piece {
        Piece::Red => row == SIZE - 1,    // Red promotes at top row
        Piece::Black => row == 0,         // Black promotes at bottom row
        _ => false,                        // Already a king
    }
}

impl Default for Checkers {
    fn default() -> Self {
        Self::new()
    }
}

impl Episode for Checkers {
    fn name(&self) -> &str {
        "Checkers"
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

        let path = Self::parse_path(mv.as_str())?;

        // Verify this is among legal moves
        let legal = self.all_moves_for_side(side);
        if !legal.iter().any(|lp| *lp == path) {
            return Err(format!("Illegal move '{}'", mv.as_str()));
        }

        self.apply_path(&path)?;
        self.moves += 1;
        self.turn = side.opponent();
        self.check_game_over();
        Ok(self.status())
    }

    fn legal_moves(&self) -> Vec<Move> {
        if self.finished.is_some() {
            return vec![];
        }
        self.all_moves_for_side(self.turn)
            .iter()
            .map(|path| Move::new(Self::path_to_string(path)))
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
        let sym = |p: Option<Piece>| match p {
            Some(Piece::Red) => 'r',
            Some(Piece::RedKing) => 'R',
            Some(Piece::Black) => 'b',
            Some(Piece::BlackKing) => 'B',
            None => '.',
        };
        let mut lines = vec![];
        lines.push("    a b c d e f g h".to_string());
        lines.push("  +-----------------+".to_string());
        for row in (0..SIZE).rev() {
            let row_str: String = (0..SIZE)
                .map(|col| format!("{}", sym(self.board[row][col])))
                .collect::<Vec<_>>()
                .join(" ");
            lines.push(format!("{} | {} |", row + 1, row_str));
        }
        lines.push("  +-----------------+".to_string());
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_setup() {
        let g = Checkers::new();
        // Red pieces on rows 0-2 dark squares
        assert!(g.board[0][1].is_some());
        assert!(g.board[2][1].is_some());
        // Black pieces on rows 5-7
        assert!(g.board[5][0].is_some());
        assert!(g.board[7][0].is_some());
        // Middle is empty
        assert!(g.board[3][0].is_none());
        assert!(g.board[4][1].is_none());
    }

    #[test]
    fn test_simple_move() {
        let mut g = Checkers::new();
        // Red piece at (2,1) moves to (3,0)
        let legal = g.legal_moves();
        assert!(!legal.is_empty());
        // Move a red piece forward
        g.apply_move(PlayerSide::One, &Move::new("b3-a4")).unwrap();
        assert_eq!(g.move_count(), 1);
        assert!(g.board[2][1].is_none());
        assert_eq!(g.board[3][0], Some(Piece::Red));
    }

    #[test]
    fn test_mandatory_capture() {
        let mut g = Checkers::new();
        // Clear board, set up a capture scenario
        g.board = [[None; SIZE]; SIZE];
        g.board[2][2] = Some(Piece::Red);         // Red at c3
        g.board[3][3] = Some(Piece::Black);       // Black at d4 (capturable)
        g.turn = PlayerSide::One;

        let legal = g.legal_moves();
        // Only capture should be available (mandatory capture rule)
        assert_eq!(legal.len(), 1);
        assert_eq!(legal[0].as_str(), "c3-e5");
    }

    #[test]
    fn test_multi_jump() {
        let mut g = Checkers::new();
        g.board = [[None; SIZE]; SIZE];
        g.board[0][0] = Some(Piece::Red);         // Red at a1
        g.board[1][1] = Some(Piece::Black);       // Black at b2
        g.board[3][3] = Some(Piece::Black);       // Black at d4
        g.turn = PlayerSide::One;

        let legal = g.legal_moves();
        // Should be a multi-jump: a1-c3-e5
        assert!(legal.iter().any(|m| m.as_str() == "a1-c3-e5"));
    }

    #[test]
    fn test_king_promotion() {
        let mut g = Checkers::new();
        g.board = [[None; SIZE]; SIZE];
        g.board[6][1] = Some(Piece::Red);         // Red at b7
        g.turn = PlayerSide::One;

        g.apply_move(PlayerSide::One, &Move::new("b7-a8")).unwrap();
        assert_eq!(g.board[7][0], Some(Piece::RedKing));
    }

    #[test]
    fn test_no_moves_loses() {
        let mut g = Checkers::new();
        g.board = [[None; SIZE]; SIZE];
        // Single black piece cornered with no moves
        g.board[0][0] = Some(Piece::Black); // Black at a1, can only move down but row 0 is bottom
        g.turn = PlayerSide::Two;
        g.check_game_over();
        // Black has no forward moves → Red wins
        assert_eq!(g.status(), GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }
}
