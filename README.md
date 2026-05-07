# High Table Protocol (HTP)

<p align="center">
  <strong>Skill games and prediction markets settled on the Kaspa DAG.</strong><br>
  Non-custodial. Covenant-enforced. ZK-oracle resolved.
</p>

---

## What is High Table Protocol?

HTP is a decentralized protocol for skill-based gaming and prediction markets running on the Kaspa BlockDAG. Players create matches, stake KAS, and compete — outcomes are verified by a network of bonded oracles with cryptographic proof commitments. All funds are held in P2PK covenant escrows on-chain. No custodian ever holds your KAS.

### Core Features

| Feature | Status |
|---|---|
| ♟ Chess | Live on TN12 |
| ● Connect 4 | Live on TN12 |
| ◆ Checkers | Live on TN12 |
| ⬡ Prediction Markets | Live on TN12 |
| 🔐 ZK Oracle Attestation | Proof-commit active |
| 🏦 Non-custodial Escrow | Covenant P2PK |
| ⚖️ Dispute Resolution | Guardian override |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend Hosting | Firebase Hosting (CDN) |
| Backend | Rust — Railway (Docker) |
| Database | SQLite (Railway Volume) |
| Blockchain | Kaspa TN12 testnet → mainnet |
| Wallet | WASM key derivation (BIP44 m/44h/111111h/0h) |
| Settlement | DAG proof roots via Kaspa RPC |

---

## Getting Started

### Prerequisites

- Rust 1.88+
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)

### Run Backend Locally

```bash
cd crates
cargo build --release -p htp-server
HTP_DB_PATH=./htp.db PORT=3000 ./target/release/htp-server
```

### Run Frontend Locally

```bash
cd public
python3 -m http.server 8080
# open http://localhost:8080
```

### Deploy

```bash
# Backend — auto-deploys via Railway on git push to main
# Frontend
firebase deploy --only hosting
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server health + version |
| GET | `/api/games` | List all games |
| POST | `/api/games` | Create a game |
| GET | `/api/games/:id` | Get game details |
| POST | `/api/games/:id/join` | Join a game |
| POST | `/api/games/:id/propose` | Propose settlement |
| GET | `/api/balance/:address` | Kaspa balance lookup |

---

## Network

Currently running on **Kaspa TN12 testnet**.

Mainnet launch pending audit completion.

Treasury: `kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m`

---

## Architecture

```
Browser (WASM) → Firebase CDN (static frontend)
                    ↓
              Railway (Rust API)
                    ↓
              SQLite (game state)
                    ↓
              Kaspa RPC (covenant escrow + settlement)
```

All critical path logic lives in Rust. The frontend is a thin rendering layer with zero business logic. WASM handles key derivation client-side — mnemonics never leave the browser.

---

## License

MIT — see [LICENSE](LICENSE)
