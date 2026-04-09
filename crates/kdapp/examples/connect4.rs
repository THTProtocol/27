//! Connect 4 CLI — play via stdin.
use kdapp::connect4::Connect4;
use kdapp::{Episode, GameStatus, Move, PlayerSide};

fn main() {
    let mut game = Connect4::new();
    println!("=== Connect 4 (HTP Episode) ===");
    println!("Enter column number 0-6.\n");

    loop {
        println!("{}\n", game.display());
        match game.status() {
            GameStatus::Finished(result) => {
                println!("Game over: {:?}", result);
                break;
            }
            GameStatus::InProgress(side) => {
                let color = if side == PlayerSide::One { "Red" } else { "Yellow" };
                println!("{} ({:?}) — enter column:", color, side);
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
