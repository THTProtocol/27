//! Low-level script builder — push bytes and opcodes into a buffer.

use crate::error::ScriptError;
use crate::opcode::Opcode;

const MAX_SCRIPT_SIZE: usize = 10_000;

#[derive(Debug, Clone, Default)]
pub struct Script(pub Vec<u8>);

impl Script {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    /// Push a single opcode.
    pub fn push_opcode(&mut self, op: Opcode) -> &mut Self {
        self.0.push(op.byte());
        self
    }

    /// Push raw bytes with minimal push encoding.
    pub fn push_bytes(&mut self, data: &[u8]) -> Result<&mut Self, ScriptError> {
        let len = data.len();
        match len {
            0 => { self.0.push(Opcode::OP_0.byte()); }
            1..=75 => {
                self.0.push(len as u8);
                self.0.extend_from_slice(data);
            }
            76..=255 => {
                self.0.push(0x4c); // OP_PUSHDATA1
                self.0.push(len as u8);
                self.0.extend_from_slice(data);
            }
            256..=520 => {
                self.0.push(0x4d); // OP_PUSHDATA2
                self.0.push((len & 0xff) as u8);
                self.0.push((len >> 8) as u8);
                self.0.extend_from_slice(data);
            }
            _ => return Err(ScriptError::InvalidPushData(len)),
        }
        if self.0.len() > MAX_SCRIPT_SIZE {
            return Err(ScriptError::ScriptTooLarge { size: self.0.len() });
        }
        Ok(self)
    }

    /// Push a 20-byte hash (OP_DATA_20 + bytes).
    pub fn push_hash160(&mut self, hash: &[u8; 20]) -> Result<&mut Self, ScriptError> {
        self.push_bytes(hash)
    }

    /// Push a little-endian encoded i64 (for DAA deadlines / wagers).
    pub fn push_int(&mut self, n: i64) -> &mut Self {
        if n == 0 {
            self.0.push(Opcode::OP_0.byte());
            return self;
        }
        let mut abs = n.unsigned_abs();
        let negative = n < 0;
        let mut bytes = Vec::new();
        while abs > 0 {
            bytes.push((abs & 0xff) as u8);
            abs >>= 8;
        }
        if bytes.last().map_or(false, |&b| b & 0x80 != 0) {
            bytes.push(if negative { 0x80 } else { 0x00 });
        } else if negative {
            *bytes.last_mut().unwrap() |= 0x80;
        }
        self.0.push(bytes.len() as u8);
        self.0.extend_from_slice(&bytes);
        self
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }
}
