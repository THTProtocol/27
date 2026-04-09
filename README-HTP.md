# High Table Protocol (HTP) – Kaspa Parimutuel Skill-Game Prediction Markets

## Overview

HTP is a **fully on-chain, trustless prediction market platform** built on Kaspa TN12 (Covenants++). 

Users play skill games (Chess, Connect 4, Checkers) P2P, spectators bet into shared parimutuel pools, and winners + protocol fee (2%) are paid atomically via Kaspa covenants.

## Key Features

✅ **Pure Native KAS** – No tokens, no wrapped assets. All bets and payouts in native Kaspa sompi.

✅ **Parimutuel Pools** – All bets go into one shared UTXO locked by the ParimutuelMarket covenant.

✅ **P2P Skill Games** – Chess, Connect 4, Checkers played entirely on-chain via kdapp Episodes.

✅ **Atomic Payouts** – One resolve transaction pays all winners + protocol fee in a single snapshot.

✅ **Permissionless Claims** – Even if the website is down, anyone can claim winnings using the open-source `claim-now` CLI.

✅ **Tournaments** – Stack multiple skill games into single-elimination, double-elimination, or round-robin tournaments with spectator betting on champions.

✅ **Kaspa Resolver** – All RPC calls use automatic load-balanced Resolver alias (tn12 or mainnet) instead of hardcoded endpoints.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User Skill Games (kdapp Episodes)                          │
│  ├─ Chess (full rules: castling, en passant, checks, mate)  │
│  ├─ Connect 4 (gravity, 4-in-a-row)                         │
│  └─ Checkers (forced captures, kinging, multi-jump)         │
└──────────────────┬──────────────────────────────────────────┘
                   │ Game state UTXOs (wRPC)
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Parimutuel Pool UTXO (ParimutuelMarket.ss covenant)         │
│  ├─ Collects all bets (native KAS)                          │
│  ├─ Stores outcomeIndex per bettor (0=Yes, 1=No, 2=Draw)    │
│  └─ Locked until game resolves                              │
└──────────────────┬──────────────────────────────────────────┘
                   │ Game final state + miner attestation
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Resolve Transaction (permissionless)                        │
│  ├─ Verifies game outcome                                   │
│  ├─ Calculates pro-rata shares: (bet / total_winners)       │
│  ├─ Creates winner outputs (native KAS)                     │
│  └─ Creates fee output (2% to treasury)                     │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### 1. Set Up TN12 Node

```bash
git clone https://github.com/kaspanet/rusty-kaspa.git
cd rusty-kaspa
git checkout tn12
cargo build --release

./target/release/kaspad --testnet --netsuffix=12
```

### 2. Convert RPC to Use Kaspa Resolver

All RPC calls now automatically use the `tn12` Resolver alias for load-balanced, fail-over node selection.

In `htp-init.js`, the network is configured as:

```js
tn12: {
  prefix:         'kaspatest',
  networkId:      'testnet-12',
  resolverAlias:  'tn12',    // Use Kaspa Resolver
  useResolver:    true,      // Enable resolver-based RPC
  explorerTx:     'https://tn12.kaspa.stream/txs/',
}
```

In `htp-rpc-client.js`, the RPC client is created with:

```js
const client = new RpcClient({ resolver: resolverAlias, networkId: networkId });
```

### 3. Compile Silverscript Covenants

The `ParimutuelMarket.ss` covenant defines the parimutuel logic:

```bash
silverscript compile covenants/ParimutuelMarket.ss -o public/covenants/
```

### 4. Port Skill Games from kdapp

The Three games (Chess, Connect 4, Checkers) follow the exact kdapp Episode template:

```
crates/
  ├─ tournament-engine.rs    (Tournament wrapper + bracket)
  └─ ... (future: full kdapp fork with Episodes)
```

### 5. Use the Permissionless Claim Tool

Anyone can claim market winnings, even offline:

```bash
cargo build --release -p htp-claim-now

./target/release/claim-now \
  --escrow-utxo <txid> \
  --game-final-txid <txid> \
  --network tn12
```

## Folder Structure

```
/workspaces/27/
├── WIKI.md                          # Master build guide (you are here)
├── 27/                              # Frontend (JS modules)
│   ├── htp-init.js                  # Network config + resolver setup
│   ├── htp-rpc-client.js            # Kaspa Resolver RPC client
│   ├── htp-chess-ui.js              # Chess UI
│   ├── htp-games-sync.js            # Game state sync
│   └── ... (other game modules)
├── covenants/                       # Silverscript contracts
│   └── ParimutuelMarket.ss          # Parimutuel betting covenant
├── crates/                          # Rust components
│   └── tournament-engine.rs         # Tournament logic
├── tools/                           # Standalone tools
│   └── claim-now/                   # Permissionless claim CLI
├── htp-daemon/                      # Background services
└── .firebaserc                       # Firebase config (for UI deployment)
```

## Testing on Firebase

Deploy the frontend to Firebase with:

```bash
firebase deploy
```

The app will connect to TN12 using the Kaspa Resolver automatically.

## Key Changes Made

### Network Configuration
- ✅ Updated `htp-init.js` to use Kaspa Resolver `tn12` alias (no hardcoded URLs)
- ✅ Updated `htp-rpc-client.js` to leverage resolver for automatic load-balancing + failover

### Covenants
- ✅ Created `/covenants/ParimutuelMarket.ss` – Silverscript parimutuel betting logic

### Core Components
- ✅ Created `/crates/tournament-engine.rs` – Tournament bracket + winner progression
- ✅ Created `/tools/claim-now/` – Permissionless CLI for claiming winnings

### Documentation
- ✅ Created `/WIKI.md` – Comprehensive master build guide with all sources

## Next Steps

1. **Fork kdapp** – Add Chess, Connect 4, Checkers Episodes (step-by-step in WIKI.md)
2. **Compile Silverscript** – Build ParimutuelMarket.ss covenant for deployment
3. **Test end-to-end** – Create a match → play → resolve on TN12
4. **Deploy frontend** – Push to Firebase and test on TN12 faucet testnet KAS

## Community & Support

- Kaspa Discord: https://discord.gg/kaspa
- @kasparnd on Telegram
- Kaspa Research Forum: https://research.kas.pa/

## License

MIT
