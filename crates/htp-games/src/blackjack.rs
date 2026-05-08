//! High Table Protocol - Blackjack Engine
//! Ported from 400-line JS engine. Multi-deck, hit/stand/double-down,
//! dealer draws to 17, bust detection, natural blackjack.

use serde::{Deserialize, Serialize};
use rand::seq::SliceRandom;
use crate::{GameError, GameOutcome, GameStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct BJCard { pub rank: u8, pub suit: u8 }

impl BJCard {
    pub fn value(&self) -> u8 {
        match self.rank { 1 => 11, 11..=13 => 10, n => n }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackjackState {
    pub player_hand: Vec<BJCard>,
    pub dealer_hand: Vec<BJCard>,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub player_bust: bool,
    pub dealer_bust: bool,
    pub doubled_down: bool,
    pub player_done: bool,
    pub deck: Vec<BJCard>,
    pub num_decks: u8,
}

fn hand_value(hand: &[BJCard]) -> u8 {
    let mut total: u16 = hand.iter().map(|c| c.value() as u16).sum();
    let aces = hand.iter().filter(|c| c.rank == 1).count();
    while total > 21 && aces > 0 { total -= 10; }
    total.min(255) as u8
}

fn is_blackjack(hand: &[BJCard]) -> bool {
    hand.len() == 2 && hand_value(hand) == 21
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicBlackjackState {
    pub player_hand: Vec<BJCard>,
    pub dealer_upcard: Option<BJCard>,
    pub status: GameStatus,
    pub outcome: GameOutcome,
    pub player_bust: bool,
    pub dealer_bust: bool,
    pub doubled_down: bool,
    pub player_done: bool,
    pub player_value: u8,
    pub dealer_value: Option<u8>,
}

impl BlackjackState {
    pub fn new(num_decks: u8) -> Self {
        let mut deck: Vec<BJCard> = (1u8..=13)
            .flat_map(|rank| (0..4).map(move |suit| BJCard { rank, suit }))
            .cycle()
            .take(num_decks as usize * 52)
            .collect();
        let mut rng = rand::thread_rng();
        deck.shuffle(&mut rng);

        let mut state = BlackjackState {
            player_hand: vec![],
            dealer_hand: vec![],
            status: GameStatus::Active,
            outcome: GameOutcome::Pending,
            player_bust: false,
            dealer_bust: false,
            doubled_down: false,
            player_done: false,
            deck,
            num_decks,
        };

        // Deal initial hands
        state.player_hand.push(state.deck.pop().unwrap());
        state.dealer_hand.push(state.deck.pop().unwrap());
        state.player_hand.push(state.deck.pop().unwrap());
        state.dealer_hand.push(state.deck.pop().unwrap());

        // Natural blackjack check
        if is_blackjack(&state.player_hand) && is_blackjack(&state.dealer_hand) {
            state.status = GameStatus::Complete;
            state.outcome = GameOutcome::Draw;
            state.player_done = true;
        } else if is_blackjack(&state.player_hand) {
            state.status = GameStatus::Complete;
            state.outcome = GameOutcome::Player1Wins;
            state.player_done = true;
        } else if is_blackjack(&state.dealer_hand) {
            state.status = GameStatus::Complete;
            state.outcome = GameOutcome::Player2Wins;
            state.player_done = true;
        }

        state
    }

    pub fn player_value(&self) -> u8 { hand_value(&self.player_hand) }
    pub fn dealer_value(&self) -> u8 { hand_value(&self.dealer_hand) }

    pub fn hit(&mut self) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active {
            return Err(GameError::GameOver);
        }
        if self.player_done {
            return Err(GameError::InvalidMove("player already done".into()));
        }
        let card = self.deck.pop()
            .ok_or_else(|| GameError::InvalidMove("deck empty".into()))?;
        self.player_hand.push(card);

        let val = hand_value(&self.player_hand);
        if val > 21 {
            self.player_bust = true;
            self.status = GameStatus::Complete;
            self.outcome = GameOutcome::Player2Wins;
            self.player_done = true;
        } else if val == 21 {
            // Auto-stand on 21
            return self.stand();
        }
        Ok(self.outcome.clone())
    }

    pub fn stand(&mut self) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active {
            return Err(GameError::GameOver);
        }
        if self.player_done {
            return Err(GameError::InvalidMove("player already done".into()));
        }
        self.player_done = true;

        // Dealer draws to 17
        while hand_value(&self.dealer_hand) < 17 {
            let card = self.deck.pop()
                .ok_or_else(|| GameError::InvalidMove("deck empty".into()))?;
            self.dealer_hand.push(card);
        }

        let pv = self.player_value();
        let dv = self.dealer_value();

        self.outcome = if self.player_bust {
            GameOutcome::Player2Wins
        } else if dv > 21 {
            self.dealer_bust = true;
            GameOutcome::Player1Wins
        } else if pv > dv {
            GameOutcome::Player1Wins
        } else if dv > pv {
            GameOutcome::Player2Wins
        } else {
            GameOutcome::Draw
        };
        self.status = GameStatus::Complete;
        Ok(self.outcome.clone())
    }

    pub fn double_down(&mut self) -> Result<GameOutcome, GameError> {
        if self.status != GameStatus::Active {
            return Err(GameError::GameOver);
        }
        if self.player_hand.len() != 2 {
            return Err(GameError::InvalidMove("can only double on first two cards".into()));
        }
        self.doubled_down = true;

        // One card, then stand
        let card = self.deck.pop()
            .ok_or_else(|| GameError::InvalidMove("deck empty".into()))?;
        self.player_hand.push(card);

        if hand_value(&self.player_hand) > 21 {
            self.player_bust = true;
            self.status = GameStatus::Complete;
            self.outcome = GameOutcome::Player2Wins;
            self.player_done = true;
            return Ok(self.outcome.clone());
        }

        self.stand()
    }

    pub fn to_public(&self) -> PublicBlackjackState {
        PublicBlackjackState {
            player_hand: self.player_hand.clone(),
            dealer_upcard: self.dealer_hand.first().copied(),
            status: self.status.clone(),
            outcome: self.outcome.clone(),
            player_bust: self.player_bust,
            dealer_bust: self.dealer_bust,
            doubled_down: self.doubled_down,
            player_done: self.player_done,
            player_value: self.player_value(),
            dealer_value: if self.player_done || self.status == GameStatus::Complete {
                Some(self.dealer_value())
            } else {
                None
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackjackGame {
    pub state: BlackjackState,
    pub status: GameStatus,
    pub outcome: GameOutcome,
}

impl BlackjackGame {
    pub fn new(num_decks: u8) -> Self {
        let state = BlackjackState::new(num_decks);
        BlackjackGame {
            status: state.status.clone(),
            outcome: state.outcome.clone(),
            state,
        }
    }

    pub fn hit(&mut self) -> Result<GameOutcome, GameError> {
        let r = self.state.hit()?;
        self.status = self.state.status.clone();
        self.outcome = self.state.outcome.clone();
        Ok(r)
    }

    pub fn stand(&mut self) -> Result<GameOutcome, GameError> {
        let r = self.state.stand()?;
        self.status = self.state.status.clone();
        self.outcome = self.state.outcome.clone();
        Ok(r)
    }

    pub fn double_down(&mut self) -> Result<GameOutcome, GameError> {
        let r = self.state.double_down()?;
        self.status = self.state.status.clone();
        self.outcome = self.state.outcome.clone();
        Ok(r)
    }
}

impl Default for BlackjackGame {
    fn default() -> Self { Self::new(6) }
}
