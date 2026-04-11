//! Checkers CLI — play via stdin.
use kdapp::checkers::Checkers;
use kdapp::{Episode, GameStatus, Move, PlayerSide};

fn main() {
    let mut game = Checkers::new();
    println!("=== Checkers (HTP Episode) ===");
    println!("Move format: 'c3-d4' or multi-jump 'a1-c3-e5'");
    println!("Red (r/R) = Player 1, Black (b/B) = Player 2\n");

    loop {
        println!("{}\n", game.display());
        match game.status() {
            GameStatus::Finished(result) => {
                println!("Game over: {:?}", result);
                break;
            }
            GameStatus::InProgress(side) => {
                let color = if side == PlayerSide::One { "Red" } else { "Black" };
                let legal = game.legal_moves();
                println!(
                    "Legal moves: {:?}",
                    legal.iter().map(|m| m.as_str()).collect::<Vec<_>>()
                );
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
