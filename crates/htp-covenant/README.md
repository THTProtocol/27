# htp-covenant

Deterministic P2SH covenant address derivation for the High Table Protocol.

## What it does

Given the 5 public parameters of a `MatchEscrow` covenant:

```rust
EscrowParams {
    player_a_hash160: String,  // HASH160 of player A pubkey
    player_b_hash160: String,  // HASH160 of player B pubkey
    oracle_hash160:   String,  // HASH160 of oracle pubkey
    wager_sompi:      i64,     // wager in sompi
    deadline_daa:     i64,     // DAA score for refund path
    network:          String,  // "tn12" or "mainnet"
}
```

It produces a **deterministic Kaspa P2SH address** that anyone can verify:

```rust
let addr = CovenantAddress::derive(&params)?;
println!("{}", addr.address); // kaspatest:pq...
```

## Derivation path

```
params
  → silverscript::ScriptEncoder::compile_match_escrow()
  → redeem_script (bytecode)
  → SHA256(redeem_script)
  → RIPEMD160(sha256) = hash160
  → bech32(hrp, 0x08 || hash160)  -- P2SH version byte = 0x08
  → kaspa[test]:p...
```

## Trustless verification

Because derivation is deterministic and open-source, **any player, auditor,
or third party** can verify the escrow address before sending funds.
No trust in the HTP server is required.

This crate will also be compiled to WASM (`htp-wasm`) so browsers and
KasWare wallet integrations can verify client-side.

## Building

```bash
cd crates
cargo build -p htp-covenant
cargo test -p htp-covenant
cargo test -p silverscript
```
