<div align="center">

```
██╗  ██╗██╗ ██████╗ ██╗  ██╗    ████████╗ █████╗ ██████╗ ██╗     ███████╗
██║  ██║██║██╔════╝ ██║  ██║    ╚══██╔══╝██╔══██╗██╔══██╗██║     ██╔════╝
███████║██║██║  ███╗███████║       ██║   ███████║██████╔╝██║     █████╗  
██╔══██║██║██║   ██║██╔══██║       ██║   ██╔══██║██╔══██╗██║     ██╔══╝  
██║  ██║██║╚██████╔╝██║  ██║       ██║   ██║  ██║██████╔╝███████╗███████╗
╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝

██████╗ ██████╗  ██████╗ ████████╗ ██████╗  ██████╗ ██████╗ ██╗     
██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔═══██╗██╔════╝██╔═══██╗██║     
██████╔╝██████╔╝██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     
██╔═══╝ ██╔══██╗██║   ██║   ██║   ██║   ██║██║     ██║   ██║██║     
██║     ██║  ██║╚██████╔╝   ██║   ╚██████╔╝╚██████╗╚██████╔╝███████╗
╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝  ╚═════╝ ╚═════╝╚══════╝
```

**Trustless skill games and information markets on the Kaspa BlockDAG.**

*Non-custodial · Covenant-enforced · Oracle-resolved · Built in Rust*

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://rustup.rs)
[![Kaspa](https://img.shields.io/badge/kaspa-TN12%20→%20mainnet-70C7BA.svg)](https://kaspa.org)
[![Backend](https://img.shields.io/badge/backend-axum%20%2B%20sqlite-blue.svg)](crates/htp-server)
[![Status](https://img.shields.io/badge/status-live%20testnet-brightgreen.svg)](https://hightable.pro)
[![Website](https://img.shields.io/badge/website-hightable.pro-gold.svg)](https://hightable.pro)

</div>

---

## What is High Table Protocol?

High Table Protocol (HTP) is a **trustless coordination layer** for skill-based competition and information markets built on the [Kaspa BlockDAG](https://kaspa.org).

The Kaspa BlockDAG is the referee — no house, no custodian, no trust required. Players wager directly against each other. Outcomes are attested by a bonded, slashable oracle network and enforced by Kaspa covenants. Payouts are automatic and non-custodial.

Built on Kaspa's BlockDAG — the world's fastest UTXO ledger — HTP settles wagers in seconds, not minutes, with no mempool congestion.

```
Player A ──┐                          ┌── Payout A
           ├── Covenant UTXO Lock ────┤
Player B ──┘   (BlockDAG-enforced)    └── Payout B
                      │
               Oracle Quorum
               (m-of-n bonded)
                      │
               Winner attested
               on the BlockDAG
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    hightable.pro                            │
│              (nginx → Vercel CDN mirror)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│              htp-server  (Rust / Axum)  :3000               │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Games   │ │ Oracle  │ │Maximizer │ │  Auto-Settler  │  │
│  │  Engine  │ │ Network │ │   Pools  │ │  (30s ticker)  │  │
│  └────┬─────┘ └────┬────┘ └────┬─────┘ └───────┬────────┘  │
│       └────────────┴───────────┴───────────────┘            │
│                         SQLite                              │
│                   /root/htp/htp.db                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           htp-orders  (Node.js / Express)  :3001            │
│         P2P wager matching · order book · stats             │
└──────────────────────────────┬──────────────────────────────┘
                               │ gRPC / WS
┌──────────────────────────────▼──────────────────────────────┐
│              Kaspa Node  (rusty-kaspa)                      │
│              TN12 testnet → mainnet migration               │
└─────────────────────────────────────────────────────────────┘
```

### Crate Layout

```
crates/
├── htp-server/        # Axum HTTP server, all REST routes
├── htp-core/          # Protocol types, covenant logic, UTXO builder
├── htp-games/         # Game engines: chess, poker, checkers, connect4
├── htp-oracle/        # Oracle registration, attestation, slashing
├── htp-wallet/        # Kaspa wallet integration, tx signing
└── htp-wasm/          # WASM bindings for browser wallet

public/
├── index.html         # Single-page shell
└── htp-router.js      # Hash router + all screen components

orders-api.js          # Node.js P2P order matching service
covenants/             # KaspaSilver covenant scripts
docs/                  # Protocol specs, oracle design, covenant math
scripts/               # Deploy, migrate, seed scripts
infra/                 # nginx config, PM2 ecosystem, systemd units
```

---

## Protocol Components

### Games Engine

Supported game types with on-chain covenant enforcement:

| Game | Type | Outcome Determination |
|------|------|------------------------|
| Chess | 1v1 skill | Oracle quorum |
| Poker | Multi-player | Oracle quorum + hand eval |
| Checkers | 1v1 skill | Oracle quorum |
| Connect 4 | 1v1 skill | Oracle quorum |
| Prediction Market | Information | Oracle quorum |

Every game locks funds in a Kaspa covenant UTXO. The covenant script enforces that only the oracle-attested winner can unlock the payout. No admin key. No escape hatch.

### Oracle Network

HTP uses a **bonded m-of-n oracle system**:

- Oracles post a KAS bond (minimum 1 KAS) to register
- Results require `m` of `n` oracle signatures (default: 2-of-3)
- Dishonest oracles are **slashed** — 10% of bond per proven fault
- Oracle type: `zk` | `bond` | `hybrid`
- Full lifecycle: `pending → active → slashed | exited`

```
Oracle Registration flow:

register(address, bond_sompi, m, n)
    └── bond TX confirmed on BlockDAG
        └── activate(oracle_id)
            └── status: active
                └── attest(game_id, winner, proof_root, signature)
                    └── quorum reached (m of n)
                        └── auto-settler triggers payout
```

### Maximizer Pools

Pool-capped wagering enforced at the protocol layer:

- Each pool has a hard `pool_cap_sompi` — no bets accepted once full
- Per-bet min and max enforced server-side
- Over-cap bets return a structured error with exact `remaining_sompi`
- Capped pools auto-close after 10 minutes
- Full audit trail in `maximizer_entries` table

### Auto-Settler

Background Tokio task running every 30 seconds:

1. Finds games with `status='completed'` and no winner set
2. Checks `oracle_quorum_results` for `status='reached'`
3. If quorum exists: sets `games.winner` and `games.status='settled'`
4. Logs every settlement to stderr (PM2-captured)
5. Also auto-closes stale capped Maximizer pools

### Orders (P2P Matching)

Peer-to-peer wager matching without a central counterparty:

- Post a wager: amount, game type, conditions
- Match an existing order → covenant lock created
- Cancel before match → funds returned
- Full order book with stats endpoint

---

## REST API Reference

Base URL: `https://hightable.pro`  
All endpoints return JSON. No authentication required for reads.

### Core

```http
GET  /health
GET  /api/stats
GET  /api/fees
GET  /api/config
```

### Games

```http
GET  /api/games              # List games (paginated)
GET  /api/games/:id          # Get game by ID
POST /api/games              # Create game
PATCH /api/games/:id         # Update game state
GET  /api/events             # Protocol events feed
```

### Oracle Network

```http
POST /api/oracle/register              # Register new oracle
POST /api/oracle/:id/activate          # Activate after bond TX
POST /api/oracle/attest                # Submit outcome attestation
GET  /api/oracle/quorum/:game_id       # Check quorum status
POST /api/oracle/slash                 # Report dishonest oracle
GET  /api/oracle/list                  # List all oracles
GET  /api/oracle/:id                   # Get oracle by ID
POST /api/oracle/:id/exit              # Oracle voluntary exit
GET  /api/oracle/network               # Network-wide stats
```

**Register oracle:**
```json
POST /api/oracle/register
{
  "address":     "kaspa:qp...",
  "bond_sompi":  500000000,
  "oracle_type": "hybrid",
  "m":           2,
  "n":           3
}
```

**Attest outcome:**
```json
POST /api/oracle/attest
{
  "game_id":    "game_abc123",
  "oracle_id":  "oracle_1778264754",
  "oracle_addr": "kaspa:qp...",
  "winner":     "kaspa:qp_winner...",
  "proof_root": "0000...0000",
  "attest_type": "hybrid"
}
```

### Maximizer

```http
GET  /api/maximizer/stats              # Pool statistics
GET  /api/maximizer/pools              # List open pools
POST /api/maximizer/pools/create       # Create new pool
POST /api/maximizer/enter              # Enter a pool (cap-enforced)
```

**Create pool:**
```json
POST /api/maximizer/pools/create
{
  "game_type":       "chess",
  "pool_cap_sompi":  1000000000,
  "min_bet_sompi":   10000000,
  "max_bet_sompi":   500000000
}
```

**Enter pool (over-cap rejected):**
```json
// Over-cap response:
{
  "error":                "pool cap would be exceeded",
  "cap_sompi":            1000000000,
  "current_sompi":        950000000,
  "remaining_sompi":      50000000,
  "your_bet_sompi":       200000000,
  "max_you_can_bet_sompi": 50000000
}
```

### Auto-Settler

```http
GET  /api/settler/status               # Settler state + counts
```

### Orders

```http
GET  /api/orders                       # List orders
POST /api/orders                       # Create order
PATCH /api/orders/:id                  # Update order
DELETE /api/orders/:id                 # Cancel order
POST /api/orders/:id/match             # Match order
GET  /api/orders/stats                 # Order book stats
```

---

## Database Schema

```sql
-- Core game table
games (
  id TEXT PK, game_type TEXT, player_a TEXT, player_b TEXT,
  wager_sompi INTEGER, status TEXT, winner TEXT,
  covenant_tx_id TEXT, created_at INTEGER, updated_at INTEGER
)

-- Oracle system
oracles (id, address, bond_sompi, bond_tx_id, oracle_type,
          m_of_n_m, m_of_n_n, slash_count, status,
          registered_at, activated_at, slashed_at, metadata)

oracle_attestations (id, game_id, oracle_id, oracle_addr,
                     winner, proof_root, signature, attest_type, created_at)

oracle_quorum_results (id, game_id, winner, m_required, n_total,
                       attested_count, status, resolved_at, payout_tx_id)

oracle_slashes (id, oracle_id, game_id, reason,
                slash_sompi, reported_by, created_at)

-- Maximizer
maximizer_pools (id, game_type, pool_cap_sompi, current_sompi,
                 min_bet_sompi, max_bet_sompi, status,
                 created_at, updated_at)

maximizer_entries (id, pool_id, player_addr, bet_sompi,
                   predicted_winner, tx_id, status, created_at)

-- Orders
orders (id, player_addr, game_type, wager_sompi, conditions,
        status, matched_with, created_at, updated_at)
```

---

## Development Setup

### Prerequisites

- Rust 1.75+ (`rustup install stable`)
- Node.js 18+
- SQLite 3
- A Kaspa node (TN12 testnet recommended)

### Quick Start

```bash
# 1. Clone
git clone https://github.com/THTProtocol/27.git htp
cd htp

# 2. Copy env
cp .env.example .env
# Edit .env: set KASPA_NODE_URL, DB_PATH, PORT

# 3. Build Rust server
cd crates
cargo build --release -p htp-server
cd ..

# 4. Initialize database
sqlite3 htp.db < scripts/init_schema.sql

# 5. Start backend
./crates/target/release/htp-server

# 6. Start orders API (separate terminal)
node orders-api.js

# 7. Serve frontend
# Open public/index.html or serve with any static server
npx serve public
```

### PM2 Production

```bash
# Start both services
pm2 start infra/ecosystem.config.js
pm2 save
pm2 startup

# View logs
pm2 logs htp-server
pm2 logs htp-orders
```

### Docker

```bash
docker-compose up -d
```

---

## Environment Variables

```env
# Kaspa node
KASPA_NODE_URL=ws://localhost:17110
KASPA_NETWORK=testnet-12        # or mainnet

# Server
PORT=3000
ORDERS_PORT=3001
DB_PATH=./htp.db
HOST=0.0.0.0

# Protocol
MIN_ORACLE_BOND_SOMPI=100000000   # 1 KAS
ORACLE_SLASH_PCT=10               # 10% per fault
MAX_BET_SOMPI=10000000000        # 100 KAS hard cap
SETTLER_INTERVAL_SECS=30

# Frontend
API_ORIGIN=https://hightable.pro
VERCEL_TOKEN=your_token_here
```

---

## Covenant Design

HTP uses Kaspa's native UTXO model with covenant-style locking scripts (KaspaSilver):

```
Game UTXO lock conditions:

  UNLOCK IF:
    sig(winner_address) AND oracle_quorum_attestation(game_id)

  OR (timeout refund):
    sig(player_a) AND sig(player_b) AND height > lock_height + TIMEOUT
```

The covenant script is committed at game creation. Neither party can redirect funds without a valid oracle attestation. See [`covenants/`](covenants/) for full script specs.

---

## Oracle Slashing

Oracles that attest incorrect outcomes are slashed:

1. Anyone can call `POST /api/oracle/slash` with evidence
2. Slash is recorded in `oracle_slashes`
3. `slash_count` increments on oracle record
4. 10% of `bond_sompi` is burned per proven fault
5. After 3 slashes, oracle status → `slashed` (permanently excluded)

This creates strong economic incentives for honest attestation.

---

## Frontend

The frontend is a single-file vanilla JS application with a hash router.
No framework. No build step. Loads in <200ms.

**Screens:**

| Route | Screen | Description |
|-------|--------|-------------|
| `#/overview` | Overview | Hero, live stats, feature cards, recent games |
| `#/games` | Games | Game list, create game, join game |
| `#/oracle` | Oracle | Register, activate, attest, network stats |
| `#/maximizer` | Maximizer | Pool list, enter pool, create pool |
| `#/orders` | Orders | P2P order book, post and match wagers |
| `#/settler` | Settler | Auto-settler status dashboard |
| `#/info` | Info | Protocol docs, covenant explainer |

**API config** (`window.HTP_CONFIG`):
```html
<script>
  window.HTP_CONFIG = {
    API_ORIGIN: 'https://hightable.pro',
    NETWORK: 'testnet-12'
  };
</script>
```

---

## Roadmap

### Live (TN12 Testnet)
- [x] Core game engine (chess, poker, checkers, connect4)
- [x] Oracle network (register, activate, attest, slash, quorum)
- [x] Maximizer pools with hard cap enforcement
- [x] Auto-settler background task
- [x] P2P order matching
- [x] Full frontend with hash router
- [x] PM2 production deployment
- [x] nginx + SSL
- [x] Vercel CDN mirror

### In Progress
- [ ] Kaspa mainnet migration (TN12 → mainnet)
- [ ] WASM wallet integration (browser-native signing)
- [ ] Covenant script finalization (KaspaSilver)
- [ ] ZK oracle proofs (hybrid → full ZK)

### Planned
- [ ] Mobile-responsive frontend polish
- [ ] Oracle reputation scoring
- [ ] Prediction markets (binary + scalar)
- [ ] Tournament brackets
- [ ] SDK / NPM package for third-party integrations
- [ ] Governance module (HTP token)

---

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

Key security properties:
- **Non-custodial**: HTP never holds user funds — all locked in covenant UTXOs
- **No admin key**: No privileged role can redirect funds
- **Oracle slashing**: Economic penalty for dishonest attestation
- **Cap enforcement**: Maximizer pool caps are enforced at the protocol layer, not the UI
- **CORS**: API locked to `hightable.pro` origin in production

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Quick checklist:
- `cargo fmt` and `cargo clippy` before PRs
- All new routes need an integration test in `tests/`
- Oracle changes require updating `docs/oracle-design.md`
- Covenant changes require full audit before merge

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

**The Kaspa BlockDAG is the referee.**

[hightable.pro](https://hightable.pro) · [Kaspa](https://kaspa.org) · [MIT License](LICENSE)

</div>
