//! HTP Game Engine — board game logic and move validation.
//! Ports game logic from frontend JS to server-side Rust.

/// Represents a board position for TicTacToe (0-8).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Cell {
    Empty,
    X,
    O,
}

impl Cell {
    pub fn to_char(&self) -> char {
        match self {
            Cell::Empty => '.',
            Cell::X => 'X',
            Cell::O => 'O',
        }
    }
}

/// TicTacToe game state.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TicTacToe {
    pub board: [Cell; 9],
    pub turn: Cell,
    pub winner: Option<Cell>,
    pub finished: bool,
    pub moves_count: u8,
}

impl Default for TicTacToe {
    fn default() -> Self {
        Self {
            board: [Cell::Empty; 9],
            turn: Cell::X,
            winner: None,
            finished: false,
            moves_count: 0,
        }
    }
}

impl TicTacToe {
    pub fn new() -> Self { Self::default() }

    /// Play a move at position 0-8 for the current turn.
    pub fn play(&mut self, position: usize) -> Result<&str, String> {
        if position > 8 { return Err("Invalid position".into()); }
        if self.finished { return Err("Game is over".into()); }
        if self.board[position] != Cell::Empty { return Err("Cell occupied".into()); }

        self.board[position] = self.turn;
        self.moves_count += 1;

        // Check win
        const WINS: [[usize; 3]; 8] = [
            [0,1,2], [3,4,5], [6,7,8],
            [0,3,6], [1,4,7], [2,5,8],
            [0,4,8], [2,4,6],
        ];
        for w in WINS {
            if self.board[w[0]] != Cell::Empty &&
               self.board[w[0]] == self.board[w[1]] &&
               self.board[w[1]] == self.board[w[2]] {
                self.winner = Some(self.turn);
                self.finished = true;
                return Ok("win");
            }
        }

        // Draw
        if self.moves_count == 9 {
            self.finished = true;
            return Ok("draw");
        }

        self.turn = if self.turn == Cell::X { Cell::O } else { Cell::X };
        Ok("ok")
    }

    pub fn board_string(&self) -> String {
        self.board.iter().map(|c| c.to_char()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tictactoe_happy_path() {
        let mut g = TicTacToe::new();
        assert_eq!(g.play(0).unwrap(), "ok"); // X
        assert_eq!(g.play(3).unwrap(), "ok"); // O
        assert_eq!(g.play(1).unwrap(), "ok"); // X
        assert_eq!(g.play(4).unwrap(), "ok"); // O
        assert_eq!(g.play(2).unwrap(), "win"); // X wins
    }

    #[test]
    fn test_double_play_error() {
        let mut g = TicTacToe::new();
        g.play(0).unwrap();
        assert!(g.play(0).is_err());
    }
}
