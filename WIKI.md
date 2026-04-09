# Kaspa High Table Protocol (HTP) – Parimutuel Skill-Game Prediction Markets

**Master Build Guide & Wiki**

**Repo**: https://github.com/THTProtocol/27

**Network**: TN12 (Covenants++) – April 2026

## VISION

Pure native-KAS parimutuel prediction markets for on-chain skill games (Chess, Connect 4, Checkers).

Every match is P2P (player vs player, no bot).

Spectators bet into shared pools; winners + 2% protocol fee paid atomically in one tx.

Only additional layer: Skill-game tournaments with spectator betting on match outcomes and tournament winners.

## ALL REQUIRED SOURCES & GITHUB REPOS

### Core Kaspa Infrastructure

- rusty-kaspa (full node + WASM SDK + TN12): https://github.com/kaspanet/rusty-kaspa (use tn12 or covpp branch)
- silverscript (covenant language): https://github.com/kaspanet/silverscript
- kdapp (games framework – Tic-Tac-Toe example is the exact template): https://github.com/michaelsutton/kdapp
- kaspa-python-sdk (TN12 branch): https://github.com/kaspanet/kaspa-python-sdk (tn12 branch)
- kips (KIP-17 Covenants++): https://github.com/kaspanet/kips

### Kaspa Resolver (Required for TN12)

- Kaspa Resolver docs: https://kaspa.aspectron.org/rpc/kaspa-resolver.html
- Alias: `tn12` (load-balanced public nodes – no hardcoded IPs)

### Game Logic Repos (Port into kdapp Tic-Tac-Toe Template)

- Chess: https://github.com/jordanbray/chess + https://github.com/StefanSalewski/tiny-chess
- Connect 4: https://github.com/aelgohar/rusty-connect4
- Checkers: https://github.com/Sarsoo/draught

### Official Docs

- TN12 Setup & Faucet: https://github.com/kaspanet/rusty-kaspa/blob/covpp/docs/testnet12.md
- TN12 Explorer: https://tn12.kaspa.stream
- Kaspa Resolver Integration: https://kaspa.aspectron.org/rpc/kaspa-resolver.html

## RESOLVER SETUP (DO THIS FIRST)

In every JS, Rust, or Python file that talks to Kaspa, replace any hardcoded URL with the tn12 alias.

JS / WASM SDK example:

```js
const client = new RpcClient({ resolver: "tn12" });
```

Rust example:

```rust
let resolver = Resolver::new("tn12").await?;
let client = WrpcClient::new(resolver).await?;
```

Python example:

```python
from kaspa import RpcClient
client = RpcClient(network="tn12")
```

This gives automatic load-balancing and failover for TN12 nodes. NO hardcoded URLs anywhere in the codebase.

## STEP-BY-STEP BUILD ORDER

### STEP 1: Setup Kaspa Resolver & TN12 Node (30 minutes)

Clone rusty-kaspa:

```bash
git clone https://github.com/kaspanet/rusty-kaspa.git
cd rusty-kaspa
git checkout tn12
cargo build --release
```

Run local TN12 node:

```bash
./target/release/kaspad --testnet --netsuffix=12
```

Update every RPC call in your repo (htp-init.js, htp-rpc-client.js, etc.) to use resolver: "tn12".

Get testnet KAS from the TN12 faucet (link in the TN12 Setup doc).

### STEP 2: Migrate to On-Chain P2P Skill Games (kdapp) – 3–5 days

Fork https://github.com/michaelsutton/kdapp into your repo as crates/kdapp.

Copy the entire examples/tictactoe folder as the base template.

Create three new folders inside crates/kdapp/examples/:

- crates/kdapp/examples/chess
- crates/kdapp/examples/connect4
- crates/kdapp/examples/checkers

For each game, copy the Tic-Tac-Toe Episode structure and improve it for pure P2P (no bot).

### STEP 3: ADD PARIMUTUEL COVENANTS

Create folder covenants/ at the root of your repo.

Add the file covenants/ParimutuelMarket.ss with the Silverscript covenant logic.

### STEP 4: ADD TOURNAMENTS (ONLY ADDITIONAL LAYER)

Create crates/tournament-engine that wraps multiple kdapp Episodes + bracket state.

Spectator betting reuses the same ParimutuelMarket covenant.

### STEP 5: ADD PERMISSIONLESS CLAIM TOOL

Create tools/claim-now/ with Rust CLI for claiming winnings even if website is down.

### STEP 6: REPLACE FIREBASE WITH ON-CHAIN WRPC

Replace Firebase move relay with wRPC subscription to game UTXO.

## FINAL SUMMARY

✅ All skill games are pure P2P (two players join a session, take turns, sign moves).

✅ Tournaments are the only extra layer.

✅ Everything uses Kaspa Resolver tn12.

✅ Spectator betting uses ParimutuelMarket covenant for every market.

✅ One atomic claim tx pays winners + 2% protocol fee.

✅ Open-source claim tool works even if website is down.

---

Start with Step 1 and Step 2. Build toward full on-chain parimutuel prediction markets on TN12.
