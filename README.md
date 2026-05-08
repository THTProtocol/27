# High Table Protocol

**Trustless skill-gaming and prediction markets on the Kaspa BlockDAG.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://rust-lang.org)
[![Kaspa](https://img.shields.io/badge/kaspa-TN12-green.svg)](https://kaspa.org)

<p align="center">
  <img src="https://hightable.duckdns.org/favicon.ico" alt="High Table Logo" width="80" height="80">
</p>

---

## What is High Table Protocol?

High Table Protocol lets you **wager on skill** — chess, checkers, Connect 4 — with settlement enforced by cryptographic escrow on the Kaspa network. No custodian, no counterparty risk.

Every game is a P2PK escrow contract. Winner claims the pot. Protocol takes a 2% fee. The blockchain is the referee.

**Status:** Live on [Kaspa Testnet 12 (TN12)](https://hightable420.web.app). Poker and blackjack engines exist but are not yet ported to the Rust backend. Mainnet deployment pending covenant opcode activation in the Toccata hard fork.

---

## Architecture

```
Browser (Firebase Hosting) -- nginx :443 -- Rust backend :3000
                                                  |
   /health  -> {"status":"ok","engine":"rust"}    |-- /api/games     -> create, sign, broadcast
   /api/*   -> REST endpoints                     |-- /api/markets   -> prediction markets
   /ws      -> real-time game relay               |-- auto-settle on game-over
                                                  -- SQLite persistence + UTXO indexer

   Kaspa Node (kaspad, Go) -------------------- TN12, :17219 JSON-RPC, :17217 borsh
```

**Stack:**

| Layer | Technology | Lines |
|-------|-----------|-------|
| Backend | Rust (Axum) | 4,711 |
| Frontend | Vanilla JS + HTML + CSS | 40,486 |
| Covenants | Silverscript (aspirational) | 856 |
| Node | Kaspa kaspad (Go) | External dep |

---

## Features

### Skill Games (Live on TN12)

- **Chess** — full rules engine (shakmaty), move validation, checkmate detection
- **Checkers** — multi-jump, king promotion, draw detection
- **Connect 4** — gravity logic, win detection
- **Tic-Tac-Toe** — server-authoritative (reference implementation)

### Coming Soon

- **Poker** — Texas Hold'em engine written, awaiting Rust port
- **Blackjack** — Multi-deck engine written, awaiting Rust port
- **Prediction Markets** — Parimutuel pools, oracle network, covenant enforcement

### Security

- **Non-custodial** — protocol never holds your keys
- **P2PK escrow** — funds locked until game resolution
- **secp256k1 Schnorr signing** — Rust-based signer
- **Oracle network** — distributed attestation with slash conditions
- Server-side signing with private key isolation

### WebSocket Relay

- Real-time move broadcasting
- Game state synchronization
- Settlement event fan-out

---

## Quickstart

### Prerequisites

- Rust 1.75+
- A Kaspa TN12 node (or use public REST API)

### Build

```bash
git clone https://github.com/THTProtocol/27.git
cd 27
cargo build --release -p htp-server
```

### Configure

```bash
cp .env.example .env
# Edit: KASPA_REST_URL, ORACLE keys, PORT
```

### Run

```bash
export $(cat .env | xargs)
./target/release/htp-server
```

### Frontend

```bash
# Serve static files
cd public && python3 -m http.server 8080

# Or deploy to Firebase
firebase deploy --only hosting
```

---

## Project Structure

```
27/
├── crates/
│   ├── htp-server/        # Axum web server, WS relay, settlement
│   ├── htp-games/         # Game engines (chess, checkers, connect4, tictactoe)
│   └── htp-kaspa-rpc/     # Kaspa REST / wRPC client
├── covenants/             # Silverscript covenant templates
├── public/                # SPA frontend (vanilla JS)
├── scripts/               # Build, deploy, stress-test tools
├── Dockerfile             # Multi-stage Rust build
├── docker-compose.yml     # Local dev environment
└── nginx.conf             # Reverse proxy config reference
```

---

## Roadmap

| Phase | Target | Description |
|-------|--------|-------------|
| v0.9 | Done | Rust backend, skill games, P2PK escrow |
| v1.0 | Done | Oracle network, professional repo, public docs |
| v1.1 | Q3 2026 | Poker + Blackjack engines ported to Rust |
| v1.2 | Q4 2026 | Prediction markets with covenant enforcement |
| v2.0 | Mainnet | Full covenant opcodes, decentralized oracle DAO |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We accept PRs for:
- New game engines
- Frontend improvements
- Security audits
- Documentation

Security issues: see [SECURITY.md](SECURITY.md). Do NOT open public issues for vulnerabilities.

---

## Team

Built by the High Table Protocol contributors. Originally conceived as a Rust-first skill-gaming layer for the Kaspa ecosystem.

---

## License

MIT (C) High Table Protocol Contributors. See [LICENSE](LICENSE).
