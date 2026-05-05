use serde::{Deserialize, Serialize};
use rand::seq::SliceRandom;
use crate::{GameError, GameOutcome, GameStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card { pub suit: u8, pub rank: u8 }

impl Card {
    pub fn value(&self) -> u8 {
        match self.rank {
            1 => 11, // ace (adjusted later)
            11..=13 => 10,
            n => n,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackjackGame {
    pub player_hand: Vec<Card>,
    pub dealer_hand: Vec<Card>,
    deck: Vec<Card>,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub player_bust: bool,
    pub dealer_bust: bool,
}

fn hand_value(hand: &[Card]) -> u8 {
    let mut total: u16 = hand.iter().map(|c| c.value() as u16).sum();
    let aces = hand.iter().filter(|c| c.rank == 1).count();
    let mut ace_adj = aces;
    while total > 21 && ace_adj > 0 { total -= 10; ace_adj -= 1; }
    total.min(255) as u8
}

impl BlackjackGame {
    pub fn new() -> Self {
        let mut deck: Vec<Card> = (1..=13).flat_map(|rank| (0..4).map(move |suit| Card { suit, rank })).collect();
        let mut rng = rand::thread_rng();
        deck.shuffle(&mut rng);
        let mut g = Self { player_hand: vec![], dealer_hand: vec![], deck, status: GameStatus::Active, outcome: GameOutcome::Pending, player_bust: false, dealer_bust: false };
        g.player_hand.push(g.deck.pop().unwrap());
        g.dealer_hand.push(g.deck.pop().unwrap());
        g.player_hand.push(g.deck.pop().unwrap());
        g.dealer_hand.push(g.deck.pop().unwrap());
        // natural blackjack check
        if hand_value(&g.player_hand) == 21 { g.status = GameStatus::Complete; g.outcome = GameOutcome::Player1Wins; }
        g
    }

    pub fn hit(&mut self) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active { return Err(GameError::GameOver); }
        let card = self.deck.pop().ok_or_else(|| GameError::InvalidMove("deck empty".into()))?;
        self.player_hand.push(card);
        if hand_value(&self.player_hand) > 21 {
            self.player_bust = true;
            self.status = GameStatus::Complete;
            self.outcome = GameOutcome::Player2Wins; // dealer wins on player bust
        }
        Ok(self.outcome.clone())
    }

    pub fn stand(&mut self) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active { return Err(GameError::GameOver); }
        // dealer draws to 17
        while hand_value(&self.dealer_hand) < 17 {
            let card = self.deck.pop().ok_or_else(|| GameError::InvalidMove("deck empty".into()))?;
            self.dealer_hand.push(card);
        }
        let pv = hand_value(&self.player_hand);
        let dv = hand_value(&self.dealer_hand);
        if dv > 21 {
            self.dealer_bust = true;
            self.outcome = GameOutcome::Player1Wins;
        } else if pv > dv {
            self.outcome = GameOutcome::Player1Wins;
        } else if dv > pv {
            self.outcome = GameOutcome::Player2Wins;
        } else {
            self.outcome = GameOutcome::Draw;
        }
        self.status = GameStatus::Complete;
        Ok(self.outcome.clone())
    }

    pub fn player_value(&self) -> u8 { hand_value(&self.player_hand) }
    pub fn dealer_value(&self) -> u8 { hand_value(&self.dealer_hand) }
}

impl Default for BlackjackGame {
    fn default() -> Self { Self::new() }
}
