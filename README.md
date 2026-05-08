<div align="center">

<img src="https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/8c591225-60dc-4cca-91d4-0a9bb106e1a0.png" alt="High Table Protocol" width="100%">

**Trustless skill games and information markets on the Kaspa BlockDAG.**

*Non-custodial · Covenant-enforced · Oracle-resolved · Built in Rust*

[![License: MIT](https://img.shields.io/badge/license-MIT-70a5fd.svg?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-f74c00.svg?style=flat-square&logo=rust)](https://rust-lang.org)
[![Kaspa](https://img.shields.io/badge/kaspa-TN12%20→%20mainnet-49e8c2.svg?style=flat-square)](https://kaspa.org)
[![Axum](https://img.shields.io/badge/backend-axum%20%2B%20sqlite-a8b5c4.svg?style=flat-square)](https://github.com/tokio-rs/axum)
[![Status](https://img.shields.io/badge/status-live%20testnet-brightgreen.svg?style=flat-square)](https://hightable.pro)
[![Site](https://img.shields.io/badge/🌐-hightable.pro-49e8c2.svg?style=flat-square)](https://hightable.pro)

</div>

---

## What is High Table Protocol?

High Table Protocol is a **trustless coordination layer** for skill-based competition and information markets built on the [Kaspa BlockDAG](https://kaspa.org).

Participants stake KAS to compete in skill games or signal their conviction on real-world outcomes. Settlement is enforced by cryptographic escrow on the Kaspa DAG — no custodian, no counterparty risk, no intermediary.

```
 participant_a ──┬
                 ├──▶  P2PK escrow (Kaspa UTXO)  ──▶  winner receives stake
 participant_b ──┘         ▲
                   oracle quorum attests           2% → treasury
                   outcome (m-of-n Schnorr)
```

> Live on **Kaspa Testnet 12 (TN12)**. Mainnet deployment pending covenant opcode activation in the **Toccata hard fork**.

---

## Core Concepts

### Skill Games
Two participants lock equal stakes into a P2PK covenant escrow. A verified game engine runs server-side. When the game concludes, the protocol arbiter key signs the settlement transaction — releasing funds to the winner. No manual intervention, no dispute resolution theatre.

### Information Markets
Participants allocate stake to signal their view on a future outcome (price levels, protocol events, real-world facts). A bonded oracle network independently attests the resolution. When quorum is reached, the market settles automatically. Stake is redistributed proportionally to participants who signalled correctly.

### Covenant Escrow
All funds are locked in **Kaspa P2PK UTXOs** with two spend paths: a winner-claim path (requires arbiter + winner signatures) and a timeout-refund path (available after a DAA score deadline). Until Toccata covenant opcodes activate on mainnet, settlement uses server-side Schnorr signing with an isolated arbiter key.

---

## Protocol Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Vanilla JS + rusty-kaspa WASM | BIP44 key derivation in-browser, no framework |
| **Backend** | Rust · Axum · SQLite | 35 REST endpoints + WebSocket relay |
| **DAG Layer** | Kaspa BlockDAG (TN12 → mainnet) | DAG-native UTXO settlement, ~1 BPS confirmation |
| **Wallet** | WASM BIP44 `m/44h/111111h/0h` | KasWare · Kastle · Kaspium · mnemonic import |
| **Settlement** | P2PK covenants · secp256k1 Schnorr | Rust-native via `secp256k1` crate |
| **Oracles** | Bonded operator network · ECDSA attest | m-of-n quorum, slash-on-dishonesty |
| **Infra** | Hetzner VPS · Nginx · PM2 | Falkenstein DE · Let's Encrypt TLS |

---

## Games & Markets

```
♟  Chess               —  full rules engine (shakmaty), move validation, checkmate
●  Connect 4           —  gravity logic, win detection, 6×7 board
◆  Checkers            —  multi-jump, king promotion, forced-capture rules
○  Tic-Tac-Toe         —  server-authoritative reference implementation
🃏  Texas Hold'em       —  engine complete, Rust backend port in progress
🂡  Blackjack           —  multi-deck engine complete, Rust backend port in progress
⬡  Information Markets  —  parimutuel allocation, bonded oracle resolution
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       hightable.pro                             │
│                                                                 │
│  Browser (JS + WASM)                                            │
│    ├── /                →  static SPA (Nginx)                   │
│    ├── /api/*           →  Rust htp-server :3000 (Axum)         │
│    ├── /api/orders/*    →  Node.js order book :3001             │
│    └── /ws              →  WebSocket relay :3000                 │
│                                                                 │
│  Rust Backend (PM2: htp-server)                                 │
│    ├── game engines     —  chess · checkers · connect4 · ttt    │
│    ├── oracle module    —  attestation · quorum · slash          │
│    ├── settlement       —  arbiter signing · UTXO broadcast      │
│    └── WebSocket relay  —  real-time move fan-out               │
│                                                                 │
│  Node.js Backend (PM2: htp-orders)                              │
│    └── order book       —  open orders · matching · cancellation │
│                                                                 │
│  Storage — SQLite /root/htp/data/htp.db                         │
│    ├── games · players · settlements                            │
│    ├── htp_events · htp_attestations                            │
│    ├── htp_operators (bonded oracle nodes)                      │
│    └── orders (open order book)                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                 Kaspa TN12 — BlockDAG consensus
              api-tn12.kaspa.org · ws-tn12.kaspa.org
              ~1 block/second · DAG-parallel confirmation
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
GET  /api/games                     # list all sessions
POST /api/games                     # create session + escrow
GET  /api/games/:id                 # session state
POST /api/games/:id/join            # join as second participant
POST /api/games/:id/move            # submit move
POST /api/games/:id/settle          # trigger settlement
POST /api/games/:id/propose-settle  # arbiter settlement proposal
```

### Information Markets
```http
GET  /api/oracle/network            # operator + market stats
POST /api/operators                 # register bonded operator
GET  /api/operators                 # list operators
POST /api/events                    # create information market
GET  /api/events                    # list open markets
POST /api/events/:id/attest         # submit oracle attestation
GET  /api/events/:id/attestations   # retrieve attestation proofs
```

### Order Book
```http
GET  /api/orders                    # open positions
POST /api/orders                    # post order
GET  /api/orders/stats              # volume + counts
POST /api/orders/:id/match          # match an order
POST /api/orders/:id/cancel         # cancel order
```

---

## Codebase

```
27/
├── crates/
│   ├── htp-server/            # Axum server — routes, WebSocket, settlement, oracle
│   │   └── src/
│   │       ├── main.rs        # 35 routes
│   │       ├── routes.rs      # handlers: games · oracle · operators · markets
│   │       ├── oracle.rs      # attestation hash · quorum · bond constants
│   │       ├── db.rs          # SQLite helpers for all 8 tables
│   │       └── models.rs      # shared types
│   ├── htp-games/             # game engines (chess · checkers · connect4 · ttt)
│   └── htp-kaspa-rpc/         # Kaspa REST + wRPC client
│
├── covenants/                 # SilverScript covenant templates
│   ├── escrow-v2.ss           # P2PK escrow — winner claim + DAA timeout refund
│   ├── payout.ss              # winner claim path
│   ├── refund.ss              # DAA-score timeout refund
│   └── fee.ss                 # 2% protocol fee split
│
├── public/                    # SPA frontend — vanilla JS, no framework
│   ├── index.html             # single entry point
│   ├── htp-config.js          # network config (TN12 ↔ mainnet toggle)
│   ├── htp-router.js          # screen router + 14 screen functions
│   ├── htp-covenant-escrow-v2.js  # covenant UTXO builder
│   ├── htp-escrow-derive.js   # deterministic escrow key derivation (WASM)
│   ├── app.js                 # WebSocket client
│   └── kaspa-wasm-sdk/        # rusty-kaspa WASM bindings
│
├── orders-api.js              # Node.js order book service (:3001)
├── docs/                      # extended documentation
├── scripts/                   # build, deploy, stress-test tools
├── Dockerfile                 # multi-stage Rust build
├── docker-compose.yml         # local development
├── nginx.conf                 # reverse proxy reference config
└── .env.example               # environment variable template
```

---

## Quickstart

### Prerequisites
- Rust `1.75+`
- Node.js `18+`
- Kaspa TN12 endpoint (public: `https://api-tn12.kaspa.org`)

### Build & Run

```bash
git clone https://github.com/THTProtocol/27.git && cd 27

cargo build --release -p htp-server

cp .env.example .env
# Set: HTP_NETWORK, KASPA_REST_TN12, HTP_ORACLE_PRIVKEY, PROTOCOL_ADDRESS

./target/release/htp-server          # Rust backend  :3000
node orders-api.js                   # order book     :3001
cd public && python3 -m http.server 8080  # frontend  :8080
```

### Docker
```bash
docker-compose up --build
```

### Network Toggle
```bash
# .env — flip one line on mainnet day:
HTP_NETWORK=tn12    # → HTP_NETWORK=mainnet
```

---

## Covenant Design

Covenants are written in **SilverScript** — a high-level language that compiles to Kaspa Script opcodes, pending Toccata hard fork activation.

```silverscript
// escrow-v2.ss
covenantEscrow(participant_a, participant_b, arbiter, stake, fee_addr) {
  path winner_claim {
    require sig(arbiter, settlement_hash)  // oracle quorum attested
    require sig(winner, claim_tx)
    split(stake * 0.98 → winner, stake * 0.02 → fee_addr)
  }
  path daa_timeout_refund {
    require daa_score > deadline           // DAG-native timelock
    split(stake / 2 → participant_a, stake / 2 → participant_b)
  }
}
```

> Until Toccata activates, settlement uses **server-side Schnorr signing** with an isolated arbiter key. The DAG handles finality.

---

## Oracle Network

Operators register with a bond (min 1,000 KAS). Dishonest attestations are slashed. Markets resolve on `m-of-n` quorum.

```
  register + bond KAS
       │
  market created (condition + deadline_daa_score + quorum m/n)
       │
  operators independently verify outcome
       │
  each submits: HMAC(market_id ‖ outcome ‖ value ‖ daa_score)
       │
  matching_attestations ≥ quorum_m  →  market.final = true
       │
  htp-settler auto-calls settlement endpoint
```

---

## Roadmap

| Milestone | Status | Description |
|---|---|---|
| `v0.9` | ✅ complete | Rust backend, skill games, P2PK escrow |
| `v1.0` | ✅ complete | Oracle network, order book, production config |
| `v1.1` | 🔄 in progress | Texas Hold'em + Blackjack Rust port, htp-settler daemon |
| `v1.2` | 📅 Q3 2026 | Information markets with full covenant enforcement |
| `v2.0` | 📅 post-Toccata | On-chain covenants, decentralized oracle DAO, mainnet |

---

## Security

- **Non-custodial** — the protocol never holds participant private keys
- **Covenant escrow** — funds locked in a Kaspa UTXO until the oracle attests outcome
- **Schnorr signatures** — secp256k1, Rust-native, DAG-finalized
- **Bond slashing** — dishonest oracle operators lose their bond
- **Deterministic escrow keys** — `HMAC-SHA256(matchId ‖ creatorAddr, seed)` via `htp-escrow-derive.js`
- **No silent key generation** — derivation failure throws; no random fallback key ever generated

For vulnerabilities: **do not open a public issue**. See [SECURITY.md](SECURITY.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests welcome for game engine ports, oracle client implementations, frontend improvements, and security audits.

---

<div align="center">

Built on [Kaspa](https://kaspa.org) — BlockDAG consensus at ~1 block per second.

*"Settlement is final when the DAG says so."*

[![hightable.pro](https://img.shields.io/badge/🌐-hightable.pro-49e8c2?style=for-the-badge)](https://hightable.pro)

</div>
