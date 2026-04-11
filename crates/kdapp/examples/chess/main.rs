//! Chess CLI — play via stdin.
use kdapp::chess::Chess;
use kdapp::{Episode, GameStatus, Move, PlayerSide};

fn main() {
    let mut game = Chess::new();
    println!("=== Chess (HTP Episode) ===");
    println!("Move format: coordinate notation 'e2e4', 'e1g1' (castle), 'e7e8q' (promote)\n");

    loop {
        println!("{}\n", game.display());
        match game.status() {
            GameStatus::Finished(result) => {
                println!("Game over: {:?}", result);
                break;
            }
            GameStatus::InProgress(side) => {
                let color = if side == PlayerSide::One { "White" } else { "Black" };
                println!("{} ({:?}) — enter move:", color, side);
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
