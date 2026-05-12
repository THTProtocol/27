use thiserror::Error;

#[derive(Debug, Error)]
pub enum CovenantError {
    #[error("script compilation failed: {0}")]
    Script(#[from] silverscript::ScriptError),

    #[error("invalid hex input: {0}")]
    HexDecode(#[from] hex::FromHexError),

    #[error("invalid parameter: {0}")]
    InvalidParam(String),

    #[error("address encoding failed: {0}")]
    AddressEncoding(String),
}
