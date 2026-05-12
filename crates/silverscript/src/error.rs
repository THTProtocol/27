use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScriptError {
    #[error("invalid parameter length: expected {expected}, got {got}")]
    InvalidParamLength { expected: usize, got: usize },

    #[error("hex decode error: {0}")]
    HexDecode(#[from] hex::FromHexError),

    #[error("unsupported opcode: {0}")]
    UnsupportedOpcode(String),

    #[error("script too large: {size} bytes (max 10000)")]
    ScriptTooLarge { size: usize },

    #[error("invalid push data length: {0}")]
    InvalidPushData(usize),
}
