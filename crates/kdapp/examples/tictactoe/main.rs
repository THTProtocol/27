//! Tic-Tac-Toe CLI — play a quick game via stdin.
use kdapp::tictactoe::TicTacToe;
use kdapp::{Episode, GameStatus, Move, PlayerSide};

fn main() {
    let mut game = TicTacToe::new();
    println!("=== Tic-Tac-Toe (HTP Episode) ===");
    println!("Enter cell number 0-8:");
    println!(" 0 | 1 | 2\n-----------\n 3 | 4 | 5\n-----------\n 6 | 7 | 8\n");

    loop {
        println!("{}\n", game.display());
        match game.status() {
            GameStatus::Finished(result) => {
                println!("Game over: {:?}", result);
                break;
            }
            GameStatus::InProgress(side) => {
                let symbol = if side == PlayerSide::One { "X" } else { "O" };
                println!("{} ({:?}) — enter move:", symbol, side);
                let mut input = String::new();
                std::io::stdin().read_line(&mut input).unwrap();
                match game.apply_move(side, &Move::new(input.trim())) {
                    Ok(_) => {}
                    Err(e) => println!("Error: {}", e),
                }
            }
        }
    }
}
