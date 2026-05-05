use serde::{Deserialize, Serialize};
use rand::seq::SliceRandom;
use crate::{GameError, GameOutcome, GameStatus};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum HandRank {
    HighCard = 0, OnePair, TwoPair, ThreeOfKind, Straight, Flush, FullHouse, FourOfKind, StraightFlush, RoyalFlush,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerCard { pub suit: u8, pub rank: u8 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerGame {
    pub p1_hand: Vec<PokerCard>,
    pub p2_hand: Vec<PokerCard>,
    deck: Vec<PokerCard>,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub p1_rank: Option<HandRank>,
    pub p2_rank: Option<HandRank>,
}

fn evaluate_hand(hand: &[PokerCard]) -> HandRank {
    let mut ranks: Vec<u8> = hand.iter().map(|c| c.rank).collect();
    ranks.sort_unstable();
    let suits: Vec<u8> = hand.iter().map(|c| c.suit).collect();
    let flush = suits.iter().all(|&s| s == suits[0]);
    let straight = ranks.windows(2).all(|w| w[1] == w[0] + 1)
        || ranks == [1, 10, 11, 12, 13]; // A-high straight
    let mut counts: Vec<u8> = {
        let mut m = std::collections::HashMap::new();
        for &r in &ranks { *m.entry(r).or_insert(0u8) += 1; }
        let mut v: Vec<u8> = m.values().cloned().collect();
        v.sort_unstable_by(|a, b| b.cmp(a));
        v
    };
    counts.sort_unstable_by(|a, b| b.cmp(a));
    match (flush, straight, counts.as_slice()) {
        (true, true, _) if ranks.contains(&1) && ranks.contains(&13) => HandRank::RoyalFlush,
        (true, true, _) => HandRank::StraightFlush,
        (_, _, [4, 1, ..]) => HandRank::FourOfKind,
        (_, _, [3, 2, ..]) => HandRank::FullHouse,
        (true, false, _) => HandRank::Flush,
        (false, true, _) => HandRank::Straight,
        (_, _, [3, 1, 1, ..]) => HandRank::ThreeOfKind,
        (_, _, [2, 2, 1, ..]) => HandRank::TwoPair,
        (_, _, [2, 1, 1, 1, ..]) => HandRank::OnePair,
        _ => HandRank::HighCard,
    }
}

impl PokerGame {
    pub fn new() -> Self {
        let mut deck: Vec<PokerCard> = (1u8..=13).flat_map(|rank| (0u8..4).map(move |suit| PokerCard { suit, rank })).collect();
        let mut rng = rand::thread_rng();
        deck.shuffle(&mut rng);
        let p1_hand: Vec<PokerCard> = (0..5).map(|_| deck.pop().unwrap()).collect();
        let p2_hand: Vec<PokerCard> = (0..5).map(|_| deck.pop().unwrap()).collect();
        let p1_rank = evaluate_hand(&p1_hand);
        let p2_rank = evaluate_hand(&p2_hand);
        let outcome = match p1_rank.cmp(&p2_rank) {
            std::cmp::Ordering::Greater => GameOutcome::Player1Wins,
            std::cmp::Ordering::Less => GameOutcome::Player2Wins,
            std::cmp::Ordering::Equal => GameOutcome::Draw,
        };
        Self {
            p1_hand, p2_hand, deck,
            status: GameStatus::Complete,
            outcome,
            p1_rank: Some(p1_rank),
            p2_rank: Some(p2_rank),
        }
    }

    pub fn resolve(&mut self) -> Result<GameOutcome, GameError> {
        Ok(self.outcome.clone())
    }
}

impl Default for PokerGame {
    fn default() -> Self { Self::new() }
}
