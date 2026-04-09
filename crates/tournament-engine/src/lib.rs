//! # HTP Tournament Engine
//!
//! Wraps multiple kdapp Episodes and manages bracket progression
//! for single-elimination, double-elimination, and round-robin tournaments.
//! Spectator betting reuses the ParimutuelMarket covenant — each tournament
//! has an escrow for per-match parimutuel pools + a global tournament-winner pool.

pub mod bracket;
pub mod pool;

pub use bracket::{Match, MatchResult, Tournament, TournamentBracket, TournamentFormat};
pub use pool::SpectatorPool;
