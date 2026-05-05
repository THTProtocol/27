# ♛ High Table Protocol v8.0

**Prediction Markets + Skill Games on Kaspa — Powered by Covenants**

> On-chain prediction markets and wagered board games using Kaspa's BlockDAG and SilverScript covenants. Every bet is a UTXO. Every outcome is oracle-verified. Every payout is trustless.

---

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Firebase Hosting (static) | HTML/JS/WASM UI |
| Game Relay | **Rust (Axum + Tokio)** | WebSocket rooms, /api/config, /api/stats |
| Blockchain | Kaspa WASM SDK (browser) | Wallets, UTXO, TX signing |
| Match State | Firebase Realtime DB | Lobby, oracle, ZK attestation |
| Covenants | Rusty-Kaspa (TN12) | Escrow logic |

The Rust server replaces the previous Node.js server.js entirely.
Build: `cd crates/htp-server && cargo build --release`

```
┌──────────────────────────────────────────────────────────────────┐
│                        HIGH TABLE v8.0                           │
├──────────┬──────────┬──────────┬──────────┬──────────────────────┤
│ Markets  │  Games   │  Oracle  │  Vault   │  SilverScript        │
│ Engine   │  Arena   │  Daemon  │  (Learn) │  Validator           │
├──────────┴──────────┴──────────┴──────────┴──────────────────────┤
│                     Settlement Engine                            │
│              Spot · Maximizer · Open · Game                      │
├──────────────────────────────────────────────────────────────────┤
│                    Transaction Builder                           │
│        Genesis · Position · Resolution · Escrow · Slash          │
├──────────────────────────────────────────────────────────────────┤
│                      UTXO Indexer                                │
│           Pool tracking · Receipt scanning · Batching            │
├──────────────────────────────────────────────────────────────────┤
│                     Covenant Scripts                             │
│   MarketPool · PositionReceipt · CreatorBond · GameEscrow        │
├──────────────────────────────────────────────────────────────────┤
│                    Kaspa wRPC (WebSocket)                        │
│              TN12 · 10 BPS · Crescendo Covenants                 │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
git clone https://github.com/your-repo/high-table.git
cd high-table
npm install
cp .env .env.local
npm test
npm start
open http://localhost:3000
```

## Docker Deployment

```bash
# Full stack (app + Kaspa TN12 node + nginx)
docker compose up -d --build

# App only (external Kaspa node)
docker compose up -d high-table nginx
```

## Project Structure

```
high-table/
├── server.js                 # Express + WebSocket server
├── lib/
│   ├── scripts/
│   │   ├── market-pool.js    # Market pool covenant script
│   │   ├── position-receipt.js # Position receipt script
│   │   ├── creator-bond.js   # Creator bond + challenge bond
│   │   └── game-escrow.js    # Game escrow covenant
│   ├── kaspa-rpc.js          # Kaspa wRPC WebSocket client
│   ├── tx-builder.js         # 12 transaction types (PSKT)
│   ├── utxo-indexer.js       # UTXO tracking + polling
│   ├── db.js                 # JSON file database
│   ├── fees.js               # Fee schedule + payout math
│   ├── settlement.js         # Settlement engine (batch)
│   ├── oracle-daemon.js      # Auto-resolution daemon
│   └── script-validator.js   # SilverScript validator
├── public/
│   ├── index.html            # SPA shell (6 views)
│   ├── style.css             # Chess.com-inspired dark theme
│   ├── app.js                # Frontend application
│   ├── wallet-ui.js          # KasWare wallet integration
│   ├── chess-ui.js           # Chess game UI
│   ├── checkers-ui.js        # Checkers game UI
│   ├── connect4-ui.js        # Connect 4 game UI
│   └── assets/pieces.js      # SVG chess pieces
├── tests/
│   ├── run-all.js            # Test runner
│   ├── test-scripts.js       # Covenant script tests
│   ├── test-fees.js          # Fee + payout tests
│   ├── test-settlement.js    # Settlement flow tests
│   ├── test-validator.js     # Validator tests
│   └── test-games.js         # Game logic tests
├── docker-compose.yml        # Full stack deployment
├── Dockerfile                # App container
├── nginx.conf                # Reverse proxy config
├── deploy.sh                 # One-command deployment
├── package.json
├── .env
└── README.md
```

## Covenant Scripts

| Script | Purpose | Key Features |
|--------|---------|-------------|
| **MarketPool** | Locks prediction market funds | Oracle sig · DAA timelock · Introspection |
| **PositionReceipt** | On-chain proof of bet | Side · Amount · Risk mode · User pubkey |
| **CreatorBond** | Skin-in-the-game for creators | 1000 KAS · 2-of-3 multisig · Slashable |
| **GameEscrow** | Holds game stakes | 2-of-3 oracle · Timeout refund · Player keys |

## Transaction Types

| # | Transaction | Description |
|---|-------------|-------------|
| 1 | Market Genesis | Create market + pool + bond |
| 2 | Position | Take a side in a market |
| 3 | Resolution | Oracle resolves + distribute payouts |
| 4 | Timeout Refund | Auto-refund if oracle fails |
| 5 | Game Escrow | Player A creates game + stakes |
| 6 | Game Join | Player B matches stake |
| 7 | Game Settle | Winner gets pot |
| 8 | Game Draw | Split pot equally |
| 9 | Game Cancel | Refund stakes |
| 10 | Challenge | Challenge a creator bond |
| 11 | Slash | Slash fraudulent creator |
| 12 | Bond Refund | Return bond after clean resolution |

## Risk Modes

| Mode | Winner Gets | Loser Gets | Protocol Fee |
|------|-------------|------------|-------------|
| **Spot** | Stake + proportional share | 0 | 2% of loser pool |
| **Maximizer** | Stake + reduced share | 50% back (minus hedge fee) | ~7.5% effective |
| **Open** | User chooses per position | Mixed in same market | Per-mode fees |

## Fee Schedule

- **Market creation bond:** 1,000 KAS (refundable)
- **Spot protocol fee:** 2% of loser pool
- **Maximizer hedge fee:** 30% of hedge return
- **Game protocol fee:** 2% of total pot
- **Challenge bond:** 250 KAS
- **Min position:** 1 KAS (configurable)

## API Endpoints

### Markets
- `GET /api/markets` — List markets
- `GET /api/markets/:id` — Market detail
- `POST /api/markets` — Create market (returns PSKT)
- `POST /api/markets/:id/position` — Take position
- `POST /api/markets/:id/resolve` — Manual resolution

### Games
- `GET /api/games` — List games
- `POST /api/games` — Create game
- `POST /api/games/:id/join` — Join game

### Users & Stats
- `GET /api/users/:addr` — User profile
- `GET /api/leaderboard` — Top users
- `GET /api/stats` — Platform statistics
- `GET /api/fees` — Fee schedule

### WebSocket
Connect to `ws://localhost:3000/ws`

**Send:** join-game, leave-game, game-move, game-resign, game-draw-offer

**Receive:** market-created, position-taken, market-resolved, game-started, game-move, game-over

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| KASPA_WRPC_URL | ws://127.0.0.1:17210 | Kaspa node wRPC |
| PROTOCOL_ADDRESS | kaspatest:qpn2dp4... | Fee collection address |
| AUTO_RESOLVE | true | Oracle auto-resolution |
| ORACLE_CHECK_MS | 10000 | Oracle poll interval |
| INDEXER_POLL_MS | 5000 | UTXO indexer poll |

## License

MIT — Built on Kaspa.

---

*"At the High Table, every position has a price, every outcome has an oracle, and every settlement is trustless."*