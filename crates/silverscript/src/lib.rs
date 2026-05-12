//! Silverscript compiler — targeted subset for HTP MatchEscrow.
//!
//! Compiles the MatchEscrow covenant parameters into deterministic
//! Kaspa script bytecode. Anyone can run this independently to verify
//! the covenant address before funding — this is what makes HTP trustless.
//!
//! Supported opcodes (MatchEscrow subset only):
//!   OP_DUP, OP_HASH160, OP_EQUALVERIFY, OP_CHECKSIG,
//!   OP_CHECKDATASIG, OP_SHA256, OP_EQUAL, OP_VERIFY,
//!   OP_CHECKLOCKTIMEVERIFY, OP_DROP, OP_2, OP_SWAP,
//!   OP_ROT, OP_PICK, OP_IF, OP_ELSE, OP_ENDIF,
//!   OP_RETURN, OP_PUSHDATA variants

pub mod error;
pub mod opcode;
pub mod script;
pub mod encoder;

pub use error::ScriptError;
pub use script::Script;
pub use encoder::ScriptEncoder;
