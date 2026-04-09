//! Tic-Tac-Toe Episode — 3×3 grid, first to three-in-a-row wins.

use serde::{Deserialize, Serialize};

use crate::episode::{Episode, GameResult, GameStatus, Move, PlayerSide};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TicTacToe {
    /// 0 = empty, 1 = Player One (X), 2 = Player Two (O)
    board: [u8; 9],
    turn: PlayerSide,
    moves: usize,
}

const WIN_LINES: [[usize; 3]; 8] = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],             // diags
];

impl TicTacToe {
    pub fn new() -> Self {
        Self {
            board: [0; 9],
            turn: PlayerSide::One,
            moves: 0,
        }
    }

    fn cell_val(side: PlayerSide) -> u8 {
        match side {
            PlayerSide::One => 1,
            PlayerSide::Two => 2,
        }
    }

    fn check_winner(&self) -> Option<PlayerSide> {
        for line in &WIN_LINES {
            let a = self.board[line[0]];
            if a != 0 && a == self.board[line[1]] && a == self.board[line[2]] {
                return Some(if a == 1 { PlayerSide::One } else { PlayerSide::Two });
            }
        }
        None
    }
}

impl Default for TicTacToe {
    fn default() -> Self {
        Self::new()
    }
}

impl Episode for TicTacToe {
    fn name(&self) -> &str {
        "Tic-Tac-Toe"
    }

    fn status(&self) -> GameStatus {
        if let Some(winner) = self.check_winner() {
            return GameStatus::Finished(GameResult::Win(winner));
        }
        if self.moves >= 9 {
            return GameStatus::Finished(GameResult::Draw);
        }
        GameStatus::InProgress(self.turn)
    }

    fn apply_move(&mut self, side: PlayerSide, mv: &Move) -> Result<GameStatus, String> {
        if side != self.turn {
            return Err(format!("Not {:?}'s turn", side));
        }
        if let GameStatus::Finished(_) = self.status() {
            return Err("Game is already over".into());
        }

        let idx: usize = mv.as_str().parse().map_err(|_| {
            format!("Invalid move '{}': expected 0-8", mv.as_str())
        })?;
        if idx >= 9 {
            return Err(format!("Cell {} out of bounds (0-8)", idx));
        }
        if self.board[idx] != 0 {
            return Err(format!("Cell {} is already occupied", idx));
        }

        self.board[idx] = Self::cell_val(side);
        self.moves += 1;
        self.turn = side.opponent();
        Ok(self.status())
    }

    fn legal_moves(&self) -> Vec<Move> {
        if let GameStatus::Finished(_) = self.status() {
            return vec![];
        }
        (0..9)
            .filter(|&i| self.board[i] == 0)
            .map(|i| Move::new(i.to_string()))
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
            1 => 'X',
            2 => 'O',
            _ => '.',
        };
        format!(
            " {} | {} | {}\n-----------\n {} | {} | {}\n-----------\n {} | {} | {}",
            sym(self.board[0]), sym(self.board[1]), sym(self.board[2]),
            sym(self.board[3]), sym(self.board[4]), sym(self.board[5]),
            sym(self.board[6]), sym(self.board[7]), sym(self.board[8]),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x_wins() {
        let mut g = TicTacToe::new();
        g.apply_move(PlayerSide::One, &Move::new("0")).unwrap(); // X top-left
        g.apply_move(PlayerSide::Two, &Move::new("3")).unwrap(); // O mid-left
        g.apply_move(PlayerSide::One, &Move::new("1")).unwrap(); // X top-mid
        g.apply_move(PlayerSide::Two, &Move::new("4")).unwrap(); // O center
        let status = g.apply_move(PlayerSide::One, &Move::new("2")).unwrap(); // X top-right → wins
        assert_eq!(status, GameStatus::Finished(GameResult::Win(PlayerSide::One)));
    }

    #[test]
    fn test_draw() {
        let mut g = TicTacToe::new();
        // X O X
        // X X O
        // O X O
        for (side, cell) in [
            (PlayerSide::One, "0"), (PlayerSide::Two, "1"), (PlayerSide::One, "2"),
            (PlayerSide::Two, "5"), (PlayerSide::One, "3"), (PlayerSide::Two, "6"),
            (PlayerSide::One, "4"), (PlayerSide::Two, "8"), (PlayerSide::One, "7"),
        ] {
            g.apply_move(side, &Move::new(cell)).unwrap();
        }
        assert_eq!(g.status(), GameStatus::Finished(GameResult::Draw));
    }

    #[test]
    fn test_illegal_moves() {
        let mut g = TicTacToe::new();
        g.apply_move(PlayerSide::One, &Move::new("4")).unwrap();
        assert!(g.apply_move(PlayerSide::One, &Move::new("0")).is_err()); // wrong turn
        assert!(g.apply_move(PlayerSide::Two, &Move::new("4")).is_err()); // occupied
        assert!(g.apply_move(PlayerSide::Two, &Move::new("9")).is_err()); // out of bounds
    }
}
