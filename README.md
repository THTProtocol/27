# ▲ HIGH TABLE PROTOCOL

> Trustless skill-game covenants on Kaspa.
> Zero counterparty risk. No house. No custody.

[![Kaspa TN12](https://img.shields.io/badge/chain-Kaspa%20TN12-cyan)](https://kaspa.org)
[![Rust](https://img.shields.io/badge/oracle-Rust%20%2B%20Axum-orange)](https://github.com/THTProtocol/27)
[![License: MIT](https://img.shields.io/badge/license-MIT-gold)](LICENSE)

Built on [Kaspa](https://kaspa.org) — the fastest PoW blockDAG.
Covenants enforced by Silverscript (Toccata hard fork).
Pre-Toccata: arbiter-attested settlement with on-chain dispute windows.

## How It Works

```
Player —‖↕ locks KAS into Covenant UTXO
  ⟜
  ├── PATH A: HTP_ARBITER + creator attest ──▞ settle
  ├── PATH B: winner claims after DISPUTE_WINDOW
  ┌── PATH C: HTP_GUARDIAN override after GUARDIAN_WINDOW
```

## Contracts

| Contract | Lines | Entrypoints | State Machine |
|---|---|--|--|
| `SkillGame.ss` | 285 | 8 | open→pending→settled/disputed |
| `TournamentBracket.ss` | 181 | 6 | open→bracket→settled |
| `ParimutuelMarket.ss` | 221 | 6 | open→proposed→settled/refunded |
| `MaximizerEscrow.ss` | 169 | 6 | locked→hedged→released |

## Stack

| Layer | Tech |
|---|--|
| Chain | Kaspa TN12 → Mainnet (post-Toccata) |
| Covenant lang | Silverscript (pre-compiled shim until Toccata) |
| Oracle / Arbiter | Rust + Axum (`crates/htp-server`) |
| Frontend | Vanilla JS + Kaspa WASM SDK |
| Realtime sync | Firebase RTDB |
| Hosting | Firebase (`hightable420.web.app`) |
| Reverse proxy | Nginx + Let's Encrypt |

## Live

- **App**: https://hightable420.web.app
- **API**: https://hightable.duckdns.org/health
- **Network**: Kaspa Testnet (TN12)

## Run Locally

```bash
# Oracle server
cargo build --release -p htp-server
./target/release/htp-server

# Frontend (no build step)
cd public && python3 -m http.server 8080
```

## Toccata Readiness

All covenants use `OP_TXINPUTBLOCKDAASCORE` for dispute/timeout.
FHTP_ARBITER` + `HTP_GUARDIAN` in all 4 contracts.
When Toccata ships: swap shim compiler output with real bytecode. One change.

## Directory

```
covenants/   Silverscript contracts + compiler shim
crates/      Rust oracle server (Axum + SQLite)
public/      Vanilla JS frontend + Kaspa WASM SDK
scripts/     Deployment + seeding utilities
docs/        Architecture + protocol spec
tests/       Integration tests
```

## License

MIT — the code is free. The table is open.
