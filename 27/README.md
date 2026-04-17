<p align="center">
  <img src="https://img.shields.io/badge/Kaspa-Testnet_12-00d4aa?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMGQ0YWEiLz48L3N2Zz4=&logoColor=white" alt="Kaspa Testnet 12" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase Hosting" />
  <img src="https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust Backend" />
</p>

<h1 align="center">
  ♛ High Table Protocol
</h1>

<p align="center">
  <strong>Trustless skill-based wagering on Kaspa</strong><br/>
  <sub>Chess · Connect 4 · Checkers · Tic-Tac-Toe — all settled on-chain</sub>
</p>

<p align="center">
  <a href="https://hightable420.web.app"><strong>🌐 Launch App</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="./WHITEPAPER.md"><strong>📄 Whitepaper</strong></a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/THTProtocol/27/issues"><strong>🐛 Report Bug</strong></a>
</p>

---

## ✨ What is HTP?

High Table Protocol (HTP) lets two players wager **KAS** on classic board games with **zero trust required**. Escrow is locked in a Kaspa covenant, moves are synced in real-time via Firebase, and settlement happens atomically on-chain.

> **No custodians. No arbiters. Winner takes all (minus 2% protocol fee).**

---

## 🎮 Supported Games

| Game | Engine | Status |
|:-----|:-------|:------:|
| ♟️ **Chess** | `chess.js` + custom UI | ✅ Live |
| 🔴 **Connect 4** | Drop-column engine | ✅ Live |
| ⚪ **Checkers** | Multi-jump validation | ✅ Live |
| ❌ **Tic-Tac-Toe** | Minimax engine | ✅ Live |

---

## 🔄 Match Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  CREATE   │───▸│  ACCEPT  │───▸│   PLAY   │───▸│  VERIFY  │───▸│  SETTLE  │
│           │    │          │    │          │    │          │    │          │
│ Lock KAS  │    │ Opponent │    │ Moves on │    │ Covenant │    │ Winner   │
│ in escrow │    │ matches  │    │ chain    │    │ checks   │    │ paid     │
│           │    │ escrow   │    │          │    │ proof    │    │ 98% pool │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

> 💡 Creator can cancel before an opponent joins (full refund). After the game starts, leaving counts as a forfeit.

---

## 🏗️ Architecture

```
27/
├── index.html                  # Single-page application
├── htp-*.js                    # Frontend modules (30+ files)
│   ├── htp-init.js             #   App bootstrap
│   ├── htp-wallet-v3.js        #   Kaspa wallet integration
│   ├── htp-chess-ui.js          #   Chess board + drag-and-drop
│   ├── htp-covenant-escrow-v2.js#   Escrow covenant logic
│   ├── htp-fee-shim.js         #   Fee calculation (mirrors Rust)
│   └── htp-settlement-*.js     #   Settlement overlay + preview
├── chess.min.js                # Chess engine (chess.js)
├── kaspa_bg.wasm               # Kaspa WASM SDK
├── firebase-config.js          # Firebase project config
│
├── htp-rust-backend/           # ⚙️ Rust Backend (Axum)
│   ├── src/                    #   Rust source modules
│   │   ├── fee.rs              #   Canonical fee calculations
│   │   └── ...                 #   Oracle, settlement, API
│   ├── Cargo.toml              #   Dependencies
│   ├── Dockerfile              #   Container build
│   └── railway.toml            #   Railway deployment
│
├── htp-oracle-daemon/          # 👁️ Oracle Settlement Watcher
│   ├── watcher.js              #   UTXO monitoring v2.1
│   └── package.json            #   Node dependencies
│
├── functions/                  # ☁️ Firebase Cloud Functions
│   ├── htp-oracle-server.js    #   Oracle + move validator
│   └── test-oracle.js          #   10 integration tests
│
├── WHITEPAPER.md               # 📄 Protocol whitepaper v1.0
└── README.md                   # 📖 You are here
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- Firebase CLI (`npm i -g firebase-tools`)
- Rust toolchain (for backend)

### 1. Clone & Install

```bash
git clone https://github.com/THTProtocol/27.git
cd 27/27
npm install
```

### 2. Configure Environment

```bash
cp htp-oracle-daemon/.env.example htp-oracle-daemon/.env
# Edit with your Firebase + Kaspa RPC credentials
```

### 3. Run Locally

```bash
# Frontend (Firebase Hosting emulator)
firebase emulators:start

# Oracle daemon
cd htp-oracle-daemon && node watcher.js

# Rust backend
cd htp-rust-backend && cargo run
```

### 4. Deploy

```bash
./deploy.sh   # Lint → Test → Deploy pipeline
```

---

## 🌍 Deployment

| Component | Platform | URL |
|:----------|:---------|:----|
| **Frontend** | Firebase Hosting | [hightable420.web.app](https://hightable420.web.app) |
| **Rust Backend** | Railway / Cloud Run | Configured via `.cloud-run-url` |
| **Database** | Firebase Realtime DB | Auto-configured |
| **Oracle Daemon** | Self-hosted | `htp-oracle-daemon/` |

---

## 🔒 Security

- **Fee calculations** are implemented in Rust (`fee.rs`) as the canonical source of truth. The JavaScript `htp-fee-shim.js` mirrors these for UI responsiveness and falls back to the Rust API for settlement.
- **Escrow transactions** use Schnorr signatures and P2SH scripts.
- **No private keys** are stored server-side — ever.
- **Firebase rules** enforce read/write permissions per-match.

---

## 🤝 Contributing

1. **Fork** the repository
2. **Branch** — `git checkout -b feat/your-feature`
3. **Commit** — `git commit -m 'feat: description'`
4. **Push** — `git push origin feat/your-feature`
5. **PR** — Open a Pull Request

---

## 📜 License

MIT — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>♛ High Table Protocol</strong> · Built on Kaspa · Trustless by Design
</p>
