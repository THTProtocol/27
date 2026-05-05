//! HTP API — placeholder. Full game API re-exports for Axum integration.

pub use htp_db::{Database, Game, Market, User};
pub use htp_kaspa_rpc::{KaspaRpc, Utxo};
pub use htp_settlement::{SettlementEngine, calculate_payout, settlement_hash};
pub use htp_game_engine::{TicTacToe, Cell};
