//! htp-covenant — Derives deterministic P2SH Kaspa addresses
//! from MatchEscrow covenant parameters.
//!
//! This crate is the single source of truth for covenant address derivation.
//! It is used by:
//!   - htp-server  (server-side, via REST API)
//!   - htp-wasm    (browser-side, via WASM — anyone can verify)
//!   - CLI tool    (auditors / third parties)
//!
//! Any implementation that produces a different address for the same
//! parameters is buggy. The address is the protocol.

pub mod address;
pub mod error;
pub mod params;

pub use address::CovenantAddress;
pub use error::CovenantError;
pub use params::EscrowParams;
