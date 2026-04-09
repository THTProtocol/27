//! # kdapp — Kaspa dApp Episode Framework
//!
//! Defines the `Episode` trait used by all HTP skill-games.
//! Each Episode encapsulates complete game rules, state transitions,
//! move validation, and win/draw detection — everything needed for
//! deterministic on-chain settlement via the HTP oracle.

pub mod episode;
pub mod tictactoe;
pub mod connect4;
pub mod checkers;
pub mod chess;

pub use episode::{Episode, GameResult, GameStatus, Move, PlayerSide};
