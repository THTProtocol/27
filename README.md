# High Table Protocol (HTP)

**Trustless, non-custodial prediction markets and skill gaming on Kaspa.**

HTP is a covenant-based protocol running on the Kaspa BlockDAG. Every match and market is enforced by on-chain covenant escrows, settled by bonded oracles, and secured by narrow-verification ZK proofs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Firebase Hosting)           │
│  index.html + 48 JS modules                             │
│  Chess · Connect4 · Checkers · Prediction Markets       │
│  Wallet Connect · Oracle UI · Portfolio · BlockDAG viz  │
└───────────────┬─────────────────────────────────────────┘
                │ wss:// / REST
┌───────────────▼─────────────────────────────────────────┐
│                BACKEND (Rust Axum + Node.js)             │
│  Hetzner — nginx :443 → :3000                           │
│  Axum HTTP/WS server (htp-server crate)                 │
│  Game engines (htp-games crate)                         │
│  Firebase sync bridge (htp-firebase-sync crate)         │
│  ELO rating system (htp-elo crate)                      │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────┐
│                 KASPA TESTNET 12 (TN12)                  │
│  REST API: api-tn12.kaspa.org                           │
│  wRPC: 178.105.76.81:17211 (borsh binary)               │
│  Explorer: explorer-tn12.kaspa.org                      │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### Frontend
- **48 JS modules** loaded through a single SPA (`public/index.html`)
- Skill games: Chess, Connect4, Checkers with full move engines
- Prediction markets: create events, take positions, oracle resolution
- Wallet: 10 wallet providers (KasWare, Kastle, OKX, Kaspium, etc.)
- BlockDAG visualizer: live DAG canvas from Kaspa explorer iframe
- ZK proof pipeline: SHA-256 commit, Firebase proof store, oracle fallback

### Rust Backend (`crates/htp-server`)
- Axum HTTP + WebSocket server (replaces server.js for game relay)
- REST endpoints: `/health`, `/metrics`, `/api/stats`, `/api/games`, `/api/config`
- WebSocket rooms with token auth and disconnect forfeit
- Structured observability (started_at, uptime, errors counter)
- Settlement signing bridge (PSKT construction, P2PK Schnorr)

### Game Engines (`crates/htp-games`)
- Pure Rust implementations: TicTacToe, Connect4, Checkers, Blackjack, Poker
- Serialized state snapshots via serde
- Status/outcome enums for settlement gating

### Firebase Sync (`crates/htp-firebase-sync`)
- PATCHes match outcomes from Rust server to Firebase RTDB
- Reads active matches for lobby polling
- Testnet/mainnet URL branching

### ELO Rating (`crates/htp-elo`)
- Skill-based leaderboard rankings
- SQLite-backed with rusqlite (bundled)

---

## Repository Structure

```
htp/
├── public/              # Frontend SPA (48 JS modules + index.html)
├── crates/              # Rust workspace
│   ├── htp-server/      #   Axum HTTP/WS backend
│   ├── htp-games/       #   Pure Rust game engines
│   ├── htp-firebase-sync/  # Firebase RTDB sync bridge
│   ├── htp-elo/         #   ELO rating system
│   ├── htp-daemon/      #   Oracle daemon (pending dep resolution)
│   ├── kaspa-tn12-sighash/  # Correct TN12 sighash impl
│   └── mirofish-bridge/ #   Image generation bridge
├── covenants/           # Silverscript covenant templates
├── lib/                 # Node.js settlement + covenant libs
├── scripts/             # E2E test + deployment scripts
├── docs/                # Architecture docs + troubleshooting
├── certs/               # SSL certificates
├── data/                # Runtime data (gitignored)
└── docker/              # Docker + docker-compose configs
```

---

## Local Development

```bash
# Clone
git clone https://github.com/THTProtocol/27.git
cd 27

# Frontend — serve locally, or deploy to Firebase
cd public && python3 -m http.server 8080

# Rust backend — build htp-server
cd crates && cargo build --release -p htp-server

# Firebase deploy
firebase deploy --only hosting --non-interactive
```

---

## Deployment

- **Frontend**: Firebase Hosting (`hightable420.web.app`)
- **Backend**: Hetzner VPS `178.105.76.81`
  - Rust binary managed by PM2 (`htp-server`)
  - nginx reverse proxy :443 → :3000
  - Kaspa TN12 node on :17211
- **Database**: Firebase Realtime DB (europe-west1)

---

## Current Status

**Active testnet build on TN12. Mainnet-switchable.**

| Component      | Status             | Notes                              |
|---------------|--------------------|-------------------------------------|
| Frontend       | Deployed           | 48 modules, full SPA                |
| Rust server    | Running            | :3000, PM2 managed                  |
| Kaspa node     | Synced             | TN12, ~4M DAA                       |
| Firebase DB    | Live               | Rules deployed, auth active          |
| ZK pipeline    | Implemented        | Narrow verification, oracle fallback |
| ELO system     | Crate ready        | Not yet wired                       |
| Workspace build| **Partial**        | htp-daemon blocked by kaspa-wasm dep |

---

## Engineering Discipline

- All changes via `git commit` + `push` to main
- Frontend served from Firebase Hosting with absolute backend URLs
- Secrets never tracked in git (`.env`, wallet JSONs in `.gitignore`)
- No destructive refactors of working code
- Rust additions are real, documented, and scoped to backend responsibilities

---

## License

MIT
