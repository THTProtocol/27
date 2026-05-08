<div align="center">

```
████████╗ ██████╗  ██████╗ ██████╗ █████╗ ████████╗ █████╗
╚══██╔══╝██╔═══██╗██╔════╝██╔════╝██╔══██╗╚══██╔══╝██╔══██╗
   ██║   ██║   ██║██║     ██║     ███████║   ██║   ███████║
   ██║   ██║   ██║██║     ██║     ██╔══██║   ██║   ██╔══██║
   ██║   ╚██████╔╝╚██████╗╚██████╗██║  ██║   ██║   ██║  ██║
   ╚═╝    ╚═════╝  ╚═════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
```

**Skill games and prediction markets settled on the Kaspa BlockDAG.**

*Non-custodial · Covenant-enforced · ZK-oracle resolved · Built in Rust*

[![License: MIT](https://img.shields.io/badge/license-MIT-70a5fd.svg?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-f74c00.svg?style=flat-square&logo=rust)](https://rust-lang.org)
[![Kaspa](https://img.shields.io/badge/kaspa-TN12%20→%20mainnet-49e8c2.svg?style=flat-square)](https://kaspa.org)
[![Backend](https://img.shields.io/badge/backend-axum%20%2B%20sqlite-a8b5c4.svg?style=flat-square)](https://github.com/tokio-rs/axum)
[![Status](https://img.shields.io/badge/status-live%20on%20testnet-brightgreen.svg?style=flat-square)](https://hightable.pro)
[![Live](https://img.shields.io/badge/🌐%20live-hightable.pro-49e8c2.svg?style=flat-square)](https://hightable.pro)

</div>

---

## What is Toccata?

Toccata is a **trustless protocol** for skill-based gaming and prediction markets running on the [Kaspa BlockDAG](https://kaspa.org). Players stake KAS, compete, and settle on-chain — no custodian ever holds your funds.

Every match is a **P2PK covenant escrow** on the Kaspa DAG. The winner claims the pot. A bonded oracle network attests outcomes with cryptographic proofs. The blockchain is the referee.

```
 player_a ──┐                          ┌── player_a claims pot
             ├─→  escrow covenant  ──→ ┤
 player_b ──┘    (Kaspa P2PK UTXO)    └── 2% protocol fee → treasury
                        ↑
              oracle quorum attests
              game outcome (m-of-n)
```

> Currently live on **Kaspa TN12 testnet** · Mainnet deployment pending Toccata hard fork covenant opcode activation.

---

## Protocol Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Vanilla JS + WASM · Nginx CDN | BIP44 key derivation in-browser |
| **Backend** | Rust · Axum · SQLite | 35 REST endpoints + WS relay |
| **Blockchain** | Kaspa BlockDAG (TN12 → mainnet) | DAG-proof settlement roots |
| **Wallet** | WASM BIP44 `m/44h/111111h/0h` | KasWare · Kastle · Kaspium · mnemonic |
| **Settlement** | Kaspa P2PK covenants · Schnorr sigs | secp256k1 arbiter signing |
| **Oracles** | Bonded operator network · ECDSA attest | m-of-n quorum, slash conditions |
| **Infra** | Hetzner VPS · PM2 · Let's Encrypt | `178.105.76.81` · Falkenstein DE |

---

## Games Live on TN12

```
♟  Chess          — full rules (shakmaty), move validation, checkmate, draw detection
●  Connect 4      — gravity logic, win detection, 6×7 board
◆  Checkers       — multi-jump, king promotion, forced-capture rules
○  Tic-Tac-Toe    — server-authoritative reference implementation
🃏  Texas Hold'em  — engine written, Rust port in progress
🂡  Blackjack      — multi-deck engine written, Rust port in progress
⬡  Prediction     — parimutuel pools, oracle resolution, covenant enforcement
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        hightable.pro                            │
│                                                                 │
│  Browser (JS + WASM)                                            │
│    ├── /                → static SPA (Nginx)                    │
│    ├── /api/*           → Rust htp-server :3000 (Axum)          │
│    ├── /api/orders/*    → Node orders-api :3001                 │
│    └── /ws              → WebSocket relay :3000                 │
│                                                                 │
│  Rust Backend (PM2)                                             │
│    ├── htp-server       — 35 routes, game engine, oracle, WS   │
│    └── htp-settler      — polls events, auto-settles (wip)      │
│                                                                 │
│  Node Backend (PM2)                                             │
│    └── htp-orders       — order book CRUD, match-making         │
│                                                                 │
│  Storage                                                        │
│    └── SQLite           — /root/htp/data/htp.db                 │
│         ├── games, players, settlements                         │
│         ├── htp_events, htp_attestations                        │
│         ├── htp_operators (bonded oracle nodes)                 │
│         └── orders (open order book)                            │
└─────────────────────────────────────────────────────────────────┘
                           │
              Kaspa TN12 REST + wRPC
              api-tn12.kaspa.org
              ws-tn12.kaspa.org
```

---

## API Reference

### Health
```http
GET /health
→ {"engine":"rust","status":"ok","version":"0.1.0"}
```

### Skill Games
```http
GET  /api/games                    # list all games
POST /api/games                    # create match + escrow
GET  /api/games/:id                # game state
POST /api/games/:id/join           # join as opponent
POST /api/games/:id/move           # submit move
POST /api/games/:id/settle         # trigger payout
POST /api/games/:id/propose-settle # arbiter settlement proposal
```

### Oracle Network
```http
GET  /api/oracle/network           # operator + event stats
POST /api/operators                # register bonded operator
GET  /api/operators                # list operators
POST /api/events                   # create prediction event
GET  /api/events                   # list open events
POST /api/events/:id/attest        # submit oracle attestation
GET  /api/events/:id/attestations  # get attestation proofs
```

### Order Book
```http
GET  /api/orders                   # open orders
POST /api/orders                   # post order
GET  /api/orders/stats             # volume + counts
POST /api/orders/:id/match         # match an order
POST /api/orders/:id/cancel        # cancel order
```

---

## Codebase

```
27/
├── crates/
│   ├── htp-server/           # Axum server — routes, WS, settlement, oracle
│   │   └── src/
│   │       ├── main.rs       # 35 routes wired
│   │       ├── routes.rs     # handlers (games, oracle, operators, events)
│   │       ├── oracle.rs     # attestation hash, signed_attestation, bond consts
│   │       ├── db.rs         # SQLite helpers for all 8 tables
│   │       └── models.rs     # shared types
│   ├── htp-games/            # game engines (chess·checkers·connect4·ttt)
│   └── htp-kaspa-rpc/        # Kaspa REST + wRPC client
│
├── covenants/                # SilverScript covenant templates (.ss)
│   ├── escrow-v2.ss          # P2PK escrow with arbiter unlock path
│   ├── payout.ss             # winner claim covenant
│   ├── refund.ss             # timeout refund path
│   └── fee.ss                # 2% protocol fee split
│
├── public/                   # SPA frontend (vanilla JS, no framework)
│   ├── index.html            # single entry point
│   ├── htp-config.js         # network config (TN12 ↔ mainnet toggle)
│   ├── htp-router.js         # screen router + 14 screen functions
│   ├── htp-covenant-escrow-v2.js  # covenant builder
│   ├── htp-escrow-derive.js  # deterministic escrow key derivation (WASM)
│   ├── app.js                # WS client
│   └── kaspa-wasm-sdk/       # rusty-kaspa WASM bindings
│
├── orders-api.js             # Node.js order book service (:3001)
├── Dockerfile                # multi-stage Rust build
├── docker-compose.yml        # local dev
└── nginx.conf                # reverse proxy reference
```

---

## Quickstart

### Prerequisites
- Rust `1.75+`
- Node.js `18+`
- A Kaspa TN12 endpoint (or use `https://api-tn12.kaspa.org`)

### Build & Run

```bash
# Clone
git clone https://github.com/THTProtocol/27.git && cd 27

# Build Rust backend
cargo build --release -p htp-server

# Configure
cp .env.example .env
# Set: HTP_NETWORK, KASPA_REST_TN12, HTP_ORACLE_PRIVKEY, PROTOCOL_ADDRESS

# Run backend
./target/release/htp-server

# Run order book service
node orders-api.js

# Serve frontend
cd public && python3 -m http.server 8080
```

### Docker

```bash
docker-compose up --build
```

### Network Toggle

```bash
# .env — flip one line on mainnet day:
HTP_NETWORK=tn12      # → change to: HTP_NETWORK=mainnet
```

---

## Covenant Design

Toccata covenants are written in **SilverScript** — a high-level language that compiles to Kaspa Script opcodes (pending Toccata HF activation).

```silverscript
// escrow-v2.ss — simplified
covenantEscrow(creator, opponent, arbiter, stake, fee_addr) {
  path winner_claim {
    require sig(arbiter, settlement_hash)
    require sig(winner, claim_tx)
    split(stake * 0.98 → winner, stake * 0.02 → fee_addr)
  }
  path timeout_refund {
    require daa_score > deadline
    split(stake / 2 → creator, stake / 2 → opponent)
  }
}
```

> Until covenant opcodes activate on mainnet, settlement uses **server-side secp256k1 Schnorr signing** with an arbiter key held in the protocol backend.

---

## Oracle Network

Operators register with a **bond** (minimum 1,000 KAS for oracles, 10,000 KAS for arbiters). Attestations require `m-of-n` quorum. Dishonest operators are slashed.

```
 operator registers + bonds KAS
         │
         ▼
  event created (resolution_url + condition + quorum_m/n)
         │
         ▼
  operators fetch source data independently
         │
         ▼
  each submits: attestation_hash(event_id, outcome, value, daa_score)
         │
         ▼
  when count(matching attestations) >= quorum_m → event.final = true
         │
         ▼
  htp-settler auto-calls /api/games/:id/settle
```

---

## Roadmap

| Milestone | Status | Description |
|---|---|---|
| `v0.9` | ✅ done | Rust backend, skill games, P2PK escrow |
| `v1.0` | ✅ done | Oracle network, order book, mainnet-ready config |
| `v1.1` | 🔄 in progress | Poker + Blackjack Rust port, htp-settler daemon |
| `v1.2` | 📅 Q3 2026 | Prediction markets with full covenant enforcement |
| `v2.0` | 📅 post-Toccata HF | Trustless on-chain covenants, decentralized oracle DAO |

---

## Security

- **Non-custodial** — the protocol never holds private keys
- **Covenant escrow** — funds locked in UTXO until oracle attests outcome
- **Schnorr signatures** — secp256k1, Rust-native via `secp256k1` crate
- **Bond slashing** — dishonest oracle operators lose their bond stake
- **Deterministic escrow keys** — `HMAC-SHA256(matchId ∥ creatorAddr, seed)` via `htp-escrow-derive.js`
- **No random key fallbacks** — if derivation fails, transaction throws (never silently generates unrecoverable key)

For vulnerabilities: **do not open a public issue**. See [SECURITY.md](SECURITY.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome for:
- New game engine ports (poker, blackjack)
- Frontend UX improvements
- Oracle node client implementations
- Security audits & fuzzing
- Documentation

---

<div align="center">

Built on [Kaspa](https://kaspa.org) — the fastest BlockDAG in existence.

*"The blockchain is the referee."*

[![hightable.pro](https://img.shields.io/badge/🌐-hightable.pro-49e8c2?style=for-the-badge)](https://hightable.pro)

</div>
