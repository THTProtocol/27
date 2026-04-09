# Kaspa High Table Protocol (HTP) — Master Build Wiki
**Parimutuel Skill-Game Prediction Markets + Tournaments on TN12 (Covenants++)**
**Repo**: https://github.com/THTProtocol/27
**Live site**: https://hightable420.web.app
**Network**: TN12 (Covenants++) — April 2026

---

## Vision

Pure native-KAS parimutuel prediction markets for on-chain P2P skill games (Chess, Connect 4, Checkers).

- Every match runs entirely on-chain via kdapp Episodes
- Spectators bet into shared parimutuel pools using native KAS
- Winners receive pro-rata shares; 2% protocol fee is paid atomically to a hardcoded treasury
- **Additional layer**: Skill-game tournaments with spectator betting on match outcomes and tournament winners
- All covenant logic, escrow, and payout is permissionless — anyone can trigger a claim even if the website is down

No KRC-20 tokens for skill games. No ELO. No flash pools. Pure native KAS + parimutuel + tournaments.

---

## Background: Why Kaspa TN12

Kaspa is the fastest PoW BlockDAG (10+ BPS live, targeting 100+ BPS).
Covenants (KIP-17) enable bounded, stateful smart-contract logic directly in UTXOs.
TN12 is the dedicated covenants testnet (launched January 2026) with full KIP-17 opcodes, Covenant IDs, Groth16/RISC0 ZK precompiles (KIP-16), Silverscript, and ATAN support (KIP-15).

Parimutuel logic is perfect: all bets go into one covenant-locked pool UTXO; final resolve tx does on-chain pro-rata math.
Skill games are short-duration — no KRC-20 tokens needed, no mid-game trading required.

**Mainnet covenant hard fork**: early-mid June 2026

---

## TN12 Resolver Setup (Use for All RPC — Never Hardcode IPs)

```js
// JavaScript / WASM SDK
const client = new RpcClient({ resolver: "tn12" });
```

```rust
// Rust
let resolver = Resolver::new("tn12").await?;
let client   = WrpcClient::new(resolver).await?;
```

Resolver docs: https://kaspa.aspectron.org/rpc/kaspa-resolver.html
Alias `tn12` = load-balanced public nodes with automatic failover.

---

## All Required GitHub Repositories

### Core Kaspa Infrastructure
- **rusty-kaspa** (full node + WASM SDK + ZK + covenants): https://github.com/kaspanet/rusty-kaspa — use `tn12` / `covpp` branch
- **silverscript** (high-level covenant language): https://github.com/kaspanet/silverscript
- **kdapp** (on-chain games framework — Tic-Tac-Toe is the exact template): https://github.com/michaelsutton/kdapp
- **kaspa-python-sdk** (TN12 branch): https://github.com/kaspanet/kaspa-python-sdk — use `tn12` branch
- **vprogs** (ZK + based computation for long-term markets): https://github.com/kaspanet/vprogs
- **kaspa research** (specs, oracle research): https://github.com/kaspanet/research — see /vProgs/ folder
- **kips** (all improvement proposals): https://github.com/kaspanet/kips — KIP-15 ATAN, KIP-16 ZK, KIP-17 Covenants++
- **kaspa-ng** (optional wallet GUI): https://github.com/aspectron/kaspa-ng

### Game Logic Repos — Port into kdapp Tic-Tac-Toe Template
**Chess**
- https://github.com/jordanbray/chess — pure Rust logic crate: move generation, FEN, legal moves, checkmate. Best for kdapp.
- https://github.com/StefanSalewski/tiny-chess — Rust + egui visual board, full rules
- https://github.com/samumartinf/taures — Rust engine + Svelte/Tailwind UI

**Connect 4**
- https://github.com/aelgohar/rusty-connect4 — Rust backend + Yew WASM frontend, full logic
- https://github.com/benjaminrall/connect-four-ai — perfect solver + validation logic

**Checkers**
- https://github.com/Sarsoo/draught — Rust WASM + JS visual renderer, mandatory jumps, kinging
- https://github.com/tomszir/chemkers — Rust engine + Preact UI

### Official Docs & Explorers
- TN12 node setup & faucet: https://github.com/kaspanet/rusty-kaspa/blob/covpp/docs/testnet12.md
- TN12 Explorer: https://tn12.kaspa.stream
- Kaspa.org Developments & Roadmap: https://kaspa.org/developments/
- Kaspa Notes — Covenants++ Overview: https://kaspanotes.com/resources/covenants++/overview
- Kaspa Aspectron Docs: https://kaspa.aspectron.org/documentation.html
- Kaspa Research Forum: https://research.kas.pa/

### Oracle / Miner Attestations / ATAN
- Hashdag Medium post (miner-enforced oracles for prediction markets): https://hashdag.medium.com/in-which-it-was-never-my-choice-to-hold-the-fire-we-found-937314149402
- KIP-15 ATAN spec: https://github.com/kaspanet/kips/blob/master/kip-0015.md
- Kaspa 2025-2026 Milestones: https://kaspa.org/developments/

---

## Architecture

```
Market Creation (ParimutuelMarket covenant UTXO)
    |
    v
Players Join → Game Session (kdapp Episode — spends prev UTXO each move)
    |
    v
Bettors → Shared Parimutuel Pool UTXO (native KAS + outcomeIndex tag)
    |
    v
Every Move = Transaction (kdapp validates on-chain)
    |
    v
Final Game-State UTXO proves winner
    |
    v
One Atomic Claim Tx:
  - Game covenant validates outcome
  - Market covenant computes: (bet_size / total_winning_bets) × (pool - 2% fee)
  - Outputs: winner shares → bettor addresses
  - Output: 2% fee → hardcoded treasury
```

Short games: 100% on-chain covenants.
Long-term / hybrid events: miner attestations + ATAN + optional ZK proofs.

---

## Environment Setup

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# rusty-kaspa TN12 node
git clone https://github.com/kaspanet/rusty-kaspa.git
cd rusty-kaspa && git checkout tn12 && cargo build --release
./target/release/kaspad --testnet --netsuffix=12

# Silverscript compiler
git clone https://github.com/kaspanet/silverscript
cd silverscript && cargo install --path .

# Python SDK (optional)
git clone https://github.com/kaspanet/kaspa-python-sdk
cd kaspa-python-sdk && git checkout tn12
```

---

## Step-by-Step Build Plan for THTProtocol/27

The repo already has: trustless 1v1 games, parimutuel 2% fee engine, escrow generation, auto-payout, Firebase + Kaspa RPC, UI modules.

### Phase 0 — Resolver & Config (30 min)

In `27/htp-init.js` and `27/htp-rpc-client.js`:
```js
const client = new RpcClient({ resolver: "tn12" });
window.HTP_NETWORK = 'tn12';
```

Create `covenants/` folder at repo root.

---

### Phase 1 — On-Chain P2P Skill Games via kdapp (3-5 days)

Fork https://github.com/michaelsutton/kdapp into `crates/kdapp`.
Copy `examples/tictactoe` as the base template for Chess, Connect 4, Checkers.
Replace ONLY: board state, move validation, win detection.
Everything else is identical to Tic-Tac-Toe: Generator, Proxy, Engine, wRPC, rollback.

**Chess Episode** (`crates/kdapp/examples/chess/main.rs`):
```rust
use kdapp::{Episode, PublicKey};

#[derive(Clone, Debug)]
pub struct ChessState {
    board: [[char; 8]; 8], // uppercase=white, lowercase=black, '.'=empty
    turn: char,             // 'w' or 'b'
    castling_rights: String,
    en_passant: Option<(u8, u8)>,
    halfmove: u8,
    fullmove: u16,
}

pub struct ChessEpisode {
    state: ChessState,
    players: [PublicKey; 2], // 0=White, 1=Black
    current_turn: usize,
    rollback_stack: Vec<ChessState>,
}

impl Episode for ChessEpisode {
    type State   = ChessState;
    type Command = String; // "e2e4", "e7e8q" for promotion

    fn new(p1: PublicKey, p2: PublicKey) -> Self {
        let s = Self::starting_position();
        ChessEpisode { state: s.clone(), players: [p1, p2], current_turn: 0, rollback_stack: vec![s] }
    }

    fn handle_command(&mut self, cmd: String, signer: PublicKey) -> Result<(), String> {
        if signer != self.players[self.current_turn] { return Err("Not your turn".into()); }
        let (from, to, promo) = Self::parse_move(&cmd)?;
        if !self.is_legal(from, to, promo) { return Err("Illegal move".into()); }
        self.rollback_stack.push(self.state.clone());
        self.apply(from, to, promo);
        self.current_turn = 1 - self.current_turn;
        Ok(())
    }

    fn get_state(&self) -> &ChessState { &self.state }
    fn is_finished(&self) -> bool { self.is_checkmate() || self.is_stalemate() || self.is_draw() }
    fn winner(&self) -> Option<PublicKey> {
        if self.is_checkmate() { Some(self.players[1 - self.current_turn]) } else { None }
    }
    fn rollback(&mut self, steps: usize) {
        for _ in 0..steps { if let Some(p) = self.rollback_stack.pop() { self.state = p; } }
        self.current_turn = if self.state.turn == 'w' { 0 } else { 1 };
    }
}

impl ChessEpisode {
    // Port from https://github.com/jordanbray/chess:
    // starting_position, parse_move, is_legal (pins, castling, en passant, promotion, check),
    // apply, is_checkmate, is_stalemate, is_draw (50-move, 3-fold repetition)
    fn starting_position() -> ChessState { todo!() }
    fn parse_move(cmd: &str) -> Result<((u8,u8),(u8,u8),Option<char>), String> { todo!() }
    fn is_legal(&self, from: (u8,u8), to: (u8,u8), promo: Option<char>) -> bool { todo!() }
    fn apply(&mut self, from: (u8,u8), to: (u8,u8), promo: Option<char>) { todo!() }
    fn is_checkmate(&self) -> bool { todo!() }
    fn is_stalemate(&self) -> bool { todo!() }
    fn is_draw(&self) -> bool { todo!() }
}
```

**Connect 4 Episode** (`crates/kdapp/examples/connect4/main.rs`):
```rust
use kdapp::{Episode, PublicKey};
const ROWS: usize = 6; const COLS: usize = 7;

#[derive(Clone, Debug)]
pub struct C4State { board: [[u8; COLS]; ROWS], turn: u8 }

pub struct C4Episode {
    state: C4State,
    players: [PublicKey; 2], // 0=Red(1), 1=Yellow(2)
    current_turn: usize,
    rollback_stack: Vec<C4State>,
    winner_player: Option<usize>,
}

impl Episode for C4Episode {
    type State = C4State; type Command = usize; // column 0-6

    fn new(p1: PublicKey, p2: PublicKey) -> Self {
        let s = C4State { board: [[0;COLS];ROWS], turn: 1 };
        C4Episode { state: s.clone(), players: [p1,p2], current_turn: 0, rollback_stack: vec![s], winner_player: None }
    }

    fn handle_command(&mut self, col: usize, signer: PublicKey) -> Result<(), String> {
        if signer != self.players[self.current_turn] { return Err("Not your turn".into()); }
        if col >= COLS { return Err("Invalid column".into()); }
        let row = self.drop_piece(col).ok_or("Column full")?;
        self.rollback_stack.push(self.state.clone());
        let piece = self.state.turn;
        self.state.board[row][col] = piece;
        if Self::check_win(&self.state.board, row, col, piece) { self.winner_player = Some(self.current_turn); }
        self.state.turn = if piece == 1 { 2 } else { 1 };
        self.current_turn = 1 - self.current_turn;
        Ok(())
    }

    fn get_state(&self) -> &C4State { &self.state }
    fn is_finished(&self) -> bool { self.winner_player.is_some() || self.state.board[0].iter().all(|&c| c!=0) }
    fn winner(&self) -> Option<PublicKey> { self.winner_player.map(|i| self.players[i]) }
    fn rollback(&mut self, steps: usize) {
        for _ in 0..steps { if let Some(p) = self.rollback_stack.pop() { self.state = p; } }
        self.current_turn = (self.state.turn-1) as usize; self.winner_player = None;
    }
}

impl C4Episode {
    fn drop_piece(&self, col: usize) -> Option<usize> {
        (0..ROWS).rev().find(|&r| self.state.board[r][col] == 0)
    }
    fn check_win(board: &[[u8;COLS];ROWS], row: usize, col: usize, p: u8) -> bool {
        [(0i32,1i32),(1,0),(1,1),(1,-1)].iter().any(|&(dr,dc)| {
            let mut n = 1;
            for s in [-1i32,1] {
                let (mut r,mut c) = (row as i32+s*dr, col as i32+s*dc);
                while r>=0&&r<ROWS as i32&&c>=0&&c<COLS as i32&&board[r as usize][c as usize]==p { n+=1; r+=s*dr; c+=s*dc; }
            }
            n >= 4
        })
    }
}
```

**Checkers Episode** (`crates/kdapp/examples/checkers/main.rs`):
```rust
use kdapp::{Episode, PublicKey};

// '.', 'r'=red piece, 'R'=red king, 'b'=black piece, 'B'=black king
#[derive(Clone, Debug)]
pub struct CheckersState { board: [[char; 8]; 8], turn: char }

pub struct CheckersEpisode {
    state: CheckersState,
    players: [PublicKey; 2], // 0=Red, 1=Black
    current_turn: usize,
    rollback_stack: Vec<CheckersState>,
}

impl Episode for CheckersEpisode {
    type State = CheckersState;
    type Command = String; // "12-23" or "12-23-34" multi-jump

    fn new(p1: PublicKey, p2: PublicKey) -> Self {
        let s = Self::starting_position();
        CheckersEpisode { state: s.clone(), players: [p1,p2], current_turn: 0, rollback_stack: vec![s] }
    }

    fn handle_command(&mut self, cmd: String, signer: PublicKey) -> Result<(), String> {
        if signer != self.players[self.current_turn] { return Err("Not your turn".into()); }
        if !self.is_legal_move(&cmd) { return Err("Illegal move".into()); }
        self.rollback_stack.push(self.state.clone());
        self.apply_move(&cmd);
        self.state.turn = if self.state.turn == 'r' { 'b' } else { 'r' };
        self.current_turn = 1 - self.current_turn;
        Ok(())
    }

    fn get_state(&self) -> &CheckersState { &self.state }
    fn is_finished(&self) -> bool { self.no_pieces_left() || self.no_legal_moves() }
    fn winner(&self) -> Option<PublicKey> {
        if self.is_finished() { Some(self.players[1 - self.current_turn]) } else { None }
    }
    fn rollback(&mut self, steps: usize) {
        for _ in 0..steps { if let Some(p) = self.rollback_stack.pop() { self.state = p; } }
        self.current_turn = if self.state.turn == 'r' { 0 } else { 1 };
    }
}

impl CheckersEpisode {
    // Port full rules from https://github.com/Sarsoo/draught:
    // simple diagonal moves, mandatory captures, multi-jumps, kinging, kings move both directions
    fn starting_position() -> CheckersState { todo!() }
    fn is_legal_move(&self, cmd: &str) -> bool { todo!() }
    fn apply_move(&mut self, cmd: &str) { todo!() }
    fn no_pieces_left(&self) -> bool { todo!() }
    fn no_legal_moves(&self) -> bool { todo!() }
}
```

**What to change vs Tic-Tac-Toe**: board state, Command type, move validation, win detection.
**What stays identical**: Generator, Proxy, Engine, wRPC subscription, re-org rollback.

---

### Phase 2 — Parimutuel Covenants (2 days)

Add `covenants/ParimutuelMarket.ss`:

```silverscript
// Supports: yes/no binary OR multi-outcome (chess: 0=white 1=black 2=draw)
contract ParimutuelMarket(
    outcomeTxid: Hash,        // kdapp final game-state txid
    winningOutcomeIndex: u64, // set at resolution
    feePercent: u64,          // 2
    feeAddr: Address          // hardcoded treasury — never changes
) {
    entrypoint function resolve(betProofs: array<Bet>, resolverSig: Sig) {
        require(validateOutcome(outcomeTxid, winningOutcomeIndex));
        let totalPool = this.amount();
        let fee = totalPool * feePercent / 100;
        let winnersPool = totalPool - fee;
        let winningBetsTotal = 0u64;
        for bet in betProofs {
            if bet.outcomeIndex == winningOutcomeIndex { winningBetsTotal += bet.amount; }
        }
        for bet in betProofs {
            if bet.outcomeIndex == winningOutcomeIndex {
                let share = (bet.amount * winnersPool) / winningBetsTotal;
                outputs.push({script: bet.owner.toScript(), amount: share});
            }
        }
        outputs.push({script: feeAddr, amount: fee}); // 2% always paid atomically
    }
}
```

Generate a fresh escrow address per market:

```js
// htp-covenant-v3.js
async function createMarketEscrow({ outcomeTxidPlaceholder, feeAddr }) {
    const covenantScript = await compileSilverscript({
        outcomeTxid: outcomeTxidPlaceholder,
        feePercent: 2,
        feeAddr: feeAddr,
    });
    const escrowAddress = Address.fromScript(covenantScript, NetworkType.Testnet);
    return { escrowAddress: escrowAddress.toString(), covenantScript };
    // Show this address to bettors — they send KAS directly to it
}
```

---

### Phase 3 — Tournaments (3 days)

Add `crates/tournament-engine/src/lib.rs`:

```rust
pub struct Tournament {
    pub bracket: Vec<Option<PublicKey>>, // winner of each match slot
    pub spectator_pool_txid: Option<String>, // global ParimutuelMarket escrow
}

impl Tournament {
    pub fn advance_winner(&mut self, match_index: usize, winner: PublicKey) {
        self.bracket[match_index] = Some(winner);
        // Frontend: create next match pairings + fresh escrow addresses
    }
    pub fn champion(&self) -> Option<PublicKey> {
        self.bracket.last().and_then(|w| *w) // tournament champion
    }
}
```

Spectator betting on the full tournament uses the same `ParimutuelMarket` covenant — point `outcomeTxid` at the final bracket resolution txid.

---

### Phase 4 — Permissionless Claim Tool (2 days)

Add `tools/claim-now/main.rs`:

```rust
// Anyone can run: ./claim-now <escrow-txid> <game-final-txid>
#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let resolver = Resolver::new("tn12").await.unwrap();
    let client   = WrpcClient::new(resolver).await.unwrap();
    let resolve_tx = build_resolve_tx(&client, &args[1], &args[2]).await;
    let txid = client.submit_transaction(resolve_tx).await.unwrap();
    println!("Claim broadcast! Txid: {}", txid);
    println!("Winners paid + 2% fee sent to treasury.");
}
```

Advertise on site footer: "Website down? Run `claim-now <escrow-txid> <final-txid>` — fully permissionless."

---

### Phase 5 — Replace Firebase Move Relay with On-Chain wRPC

```js
// OLD (Firebase)
firebase.database().ref('relay/' + matchId + '/moves').on('child_added', onMove);

// NEW (wRPC subscription to game-state UTXO)
const client = new RpcClient({ resolver: "tn12" });
client.subscribeUtxosChanged([gameStateAddress], ({ added }) => {
    added.forEach(utxo => applyMoveToBoard(decodeKdappMove(utxo)));
});
```

Firebase stays for optional UI/lobby metadata. Core game state must not depend on it.

---

### Phase 6 — Test & Deploy

```bash
# Run oracle tests (must be 16/16)
cd 27/functions && npm test

# Deploy Firebase Hosting
cd 27
npx firebase-tools@latest deploy --project hightable420 --only hosting

# Verify live
curl -I https://hightable420.web.app  # must return HTTP/2 200
```

---

## Protocol Fee

- Fixed 2% of each pool, hardcoded in the covenant
- Delivered **atomically in the same final resolve tx** as winner payouts
- Sent to a hardcoded treasury address — no extra claim tx required
- Immutable once covenant is deployed
- Each market is fully independent — one resolve tx = one market's fee only

**Payout layout**:
```
Escrow UTXO (covenant-locked)
         |  (anyone broadcasts final claim tx)
         v
 Winner share(s)  +  2% Protocol Fee
 (pro-rata KAS)      (direct to treasury)
```

If nobody ever claims, funds stay locked in the UTXO forever. No time-lock expiry.

---

## Oracle Layer

**Skill games**: kdapp final state UTXO is the oracle. Checkmate / 4-in-a-row / no-moves = provable on-chain. No external oracle needed.

**Long-term / hybrid events**:
- Miner attestations: miners vote in blocks, majority wins. PoW honest-majority assumption. (hashdag post: https://hashdag.medium.com/in-which-it-was-never-my-choice-to-hold-the-fire-we-found-937314149402)
- ATAN: archives accepted txs + canonical order for 6-month+ events. KIP-15: https://github.com/kaspanet/kips/blob/master/kip-0015.md
- ZK: native Groth16 prooofs (KIP-16) in rusty-kaspa for private/verified attestations.

---

## Current Repo File Map

```
/workspaces/27/
  27/                           <- Firebase Hosting root
    index.html
    firebase.json               <- hosting + functions config
    htp-init.js                 <- app bootstrap, set HTP_NETWORK='tn12'
    htp-rpc-client.js           <- wRPC client (use resolver: "tn12")
    htp-board-engine.js         <- Chess/C4/Checkers board + clock
    htp-chess-ui.js             <- Chess rendering (illegal-move guarded)
    htp-autopayout-engine.js    <- Payout flow (illegal-move guarded)
    htp-covenant-escrow-v2.js   <- Escrow generation (upgrade to v3)
    htp-fee-engine.js           <- 2% protocol fee logic
    htp-wallet-v3.js            <- Kaspa wallet integration
    functions/
      htp-oracle-server.js      <- Move validator + oracle (16/16 tests pass)
      test-oracle.js            <- Tests: chess + connect4 + HMAC
    htp-oracle-daemon/          <- Standalone oracle daemon
  covenants/                    <- Add: Silverscript files (Phase 2)
    ParimutuelMarket.ss
  crates/                       <- Add: Rust crates (Phase 1)
    kdapp/                      <- kdapp fork: Chess/C4/Checkers Episodes
    tournament-engine/          <- Tournament bracket (Phase 3)
  htp-daemon/                   <- Rust settlement + deadline daemon
  tools/
    claim-now/                  <- Permissionless CLI (Phase 4)
  WIKI.md                       <- This file
```

---

## Community & Support

- Kaspa Discord / @kasparnd Telegram
- Michael Sutton (@michaelsuttonil) — kdapp + Silverscript author
- Yonatan Sompolinsky (@hashdag) — oracle + vProgs research
- Ori Newman — Silverscript + covenant implementation
- Kaspa Research Forum: https://research.kas.pa/

---

*Last updated: April 2026 — TN12 live, hightable420.web.app deployed, 16/16 oracle tests passing.*
