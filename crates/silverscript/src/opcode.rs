//! Kaspa script opcodes used by MatchEscrow.
//! Reference: kaspa-script/src/opcodes/

#[allow(non_camel_case_types, dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Opcode {
    OP_0            = 0x00,
    OP_DATA_20      = 0x14, // push 20 bytes
    OP_DATA_32      = 0x20, // push 32 bytes
    OP_DATA_33      = 0x21, // push 33 bytes (compressed pubkey)
    OP_DUP          = 0x76,
    OP_EQUAL        = 0x87,
    OP_EQUALVERIFY  = 0x88,
    OP_DROP         = 0x75,
    OP_2DROP        = 0x6d,
    OP_NIP          = 0x77,
    OP_SWAP         = 0x7c,
    OP_ROT          = 0x7b,
    OP_IF           = 0x63,
    OP_ELSE         = 0x67,
    OP_ENDIF        = 0x68,
    OP_VERIFY       = 0x69,
    OP_RETURN       = 0x6a,
    OP_HASH160      = 0xa9,
    OP_SHA256       = 0xa8,
    OP_CHECKSIG     = 0xac,
    OP_CHECKDATASIG = 0xbe,
    // Timelock
    OP_CHECKLOCKTIMEVERIFY = 0xb1,
    // Numeric pushes
    OP_1            = 0x51,
    OP_2            = 0x52,
    OP_16           = 0x60,
}

impl Opcode {
    pub fn byte(self) -> u8 {
        self as u8
    }
}
