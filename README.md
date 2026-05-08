     1|# High Table Protocol (htp)
     2|
     3|**Trustless skill-gaming and prediction markets on the Kaspa BlockDAG.**
     4|
     5|[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
     6|[![Rust](https://img.shields.io/badge/rust-1.88%2B-orange.svg)](https://rust-lang.org)
     7|[![Kaspa](https://img.shields.io/badge/kaspa-testnet--12-green.svg)](https://kaspa.org)
     8|
     9|<p align="center">
    10|  <img src="https://hightable.duckdns.org/favicon.ico" alt="HTP Logo" width="80" height="80">
    11|</p>
    12|
    13|---
    14|
    15|## What is High Table Protocol?
    16|
    17|High Table Protocol lets you **wager on skill** — chess, checkers, Connect 4, poker, blackjack — with settlement enforced by cryptographic covenants on the Kaspa network. No custodian, no counterparty risk, no "trust us bro."
    18|
    19|Every game is a multi-sig escrow contract. Winner claims the pot. Protocol takes a 2% fee. The blockchain is the referee.
    20|
    21|**Status:** Live on [Kaspa Testnet 12 (TN12)](https://hightable420.web.app). Mainnet deployment pending covenant opcode activation.
    22|
    23|---
    24|
    25|## Architecture
    26|
    27|```
    28|Browser (Firebase Hosting) ──→ nginx :443 ──→ Rust backend :3000
    29|                                                  │
    30|   /health  → {"status":"ok","engine":"rust"}     ├── /api/games     → create, sign, broadcast
    31|   /api/*   → REST endpoints                      ├── /api/markets   → prediction markets
    32|   /ws      → real-time game relay                ├── auto-settle on game-over
    33|                                                  └── SQLite persistence + UTXO indexer
    34|
    35|   Kaspa Node (kaspad, Go) ───────────────────── TN12, :17219 JSON-RPC, :17217 borsh
    36|```
    37|
    38|**Stack:**
    39|
    40|| Layer | Technology | Lines |
    41||-------|-----------|-------|
    42|| Backend | Rust (Axum) | 4,711 |
    43|| Frontend | Vanilla JS + HTML + CSS | 40,486 |
    44|| Covenants | Silverscript (aspirational) | 856 |
    45|| Node | Kaspa kaspad (Go) | External dep |
    46|
    47|---
    48|
    49|## Features
    50|
    51|### Skill Games (Live on TN12)
    52|
    53|- **Chess** — full rules engine (shakmaty), move validation, checkmate detection
    54|- **Checkers** — multi-jump, king promotion, draw detection
    55|- **Connect 4** — gravity logic, win detection
    56|- **Tic-Tac-Toe** — server-authoritative (reference implementation)
    57|
    58|### Prediction Markets (In Development)
    59|
    60|- Parimutuel pools with covenant-enforced payout math
    61|- Multi-sig oracle network for resolution
    62|- 0.5% oracle fee + 2% protocol fee on winnings
    63|
    64|### Security
    65|
    66|- **Non-custodial** — protocol never holds your keys
    67|- **P2PK escrow** — funds locked until game resolution
    68|- **secp256k1 Schnorr signing** — Rust-based signer (no WASM SDK dependency)
    69|- **Oracle network** — distributed attestation with slash conditions
    70|- Server-side signing with private key isolation
    71|
    72|### WebSocket Relay
    73|
    74|- Real-time move broadcasting
    75|- Game state synchronization
    76|- Settlement event fan-out
    77|
    78|---
    79|
    80|## Quickstart
    81|
    82|### Prerequisites
    83|
    84|- Rust 1.75+
    85|- A Kaspa TN12 node (or use public REST API)
    86|
    87|### Build
    88|
    89|```bash
    90|git clone https://github.com/THTProtocol/27.git
    91|cd 27
    92|cargo build --release -p htp-server
    93|```
    94|
    95|### Configure
    96|
    97|```bash
    98|cp .env.example .env
    99|# Edit: KASPA_REST_URL, ORACLE keys, PORT
   100|```
   101|
   102|### Run
   103|
   104|```bash
   105|export $(cat .env | xargs)
   106|./target/release/htp-server
   107|```
   108|
   109|### Frontend
   110|
   111|```bash
   112|# Serve static files
   113|cd public && python3 -m http.server 8080
   114|
   115|# Or deploy to Firebase
   116|firebase deploy --only hosting
   117|```
   118|
   119|---
   120|
   121|## Project Structure
   122|
   123|```
   124|27/
   125|├── crates/
   126|│   ├── htp-server/        # Axum web server, WS relay, settlement
   127|│   ├── htp-games/         # Game engines (chess, checkers, connect4, tictactoe)
   128|│   └── htp-kaspa-rpc/     # Kaspa REST / wRPC client
   129|├── covenants/             # Silverscript covenant templates
   130|├── public/                # SPA frontend (vanilla JS)
   131|├── scripts/               # Build, deploy, stress-test tools
   132|├── Dockerfile             # Multi-stage Rust build
   133|├── docker-compose.yml     # Local dev environment
   134|├── nginx.conf             # Reverse proxy config reference
   135|├── ecosystem.config.js    # PM2 process management
   136|└── .env.example           # Environment template
   137|```
   138|
   139|---
   140|
   141|## Roadmap
   142|
   143|| Phase | Target | Description |
   144||-------|--------|-------------|
   145|| v0.9 | ✅ Done | Rust backend, skill games, P2PK escrow |
   146|| v1.0 | ✅ Done | Oracle network, professional repo, public docs |
   147|| v1.1 | Q3 2026 | Prediction markets with covenant enforcement |
   148|| v1.2 | Q4 2026 | Kasplex inscription integration, NFT badges |
   149|| v2.0 | Mainnet | Full covenant opcodes (KIP-17), decentralized oracle DAO |
   150|
   151|---
   152|
   153|## Contributing
   154|
   155|See [CONTRIBUTING.md](CONTRIBUTING.md). We accept PRs for:
   156|- New game engines
   157|- Frontend improvements
   158|- Security audits
   159|- Documentation
   160|
   161|Security issues: see [SECURITY.md](SECURITY.md). Do NOT open public issues for vulnerabilities.
   162|
   163|---
   164|
   165|## Team
   166|
   167|Built by the High Table Protocol contributors. Originally conceived as a Rust-first skill-gaming layer for the Kaspa ecosystem.
   168|
   169|---
   170|
   171|## License
   172|
   173|MIT © High Table Protocol Contributors. See [LICENSE](LICENSE).
   174|