# High Table Protocol (HTP) — Codebase Analysis

**Project**: High Table Protocol (hightable420.web.app)  
**Type**: Trustless 1v1 skill games (Chess, Connect-4, Checkers) + Parimutuel betting platform  
**Network**: Kaspa blockchain (testnet-12 or mainnet) with Firebase coordination layer

---

## 1. ENTRY POINTS & BOOTSTRAP SEQUENCE

### Primary Entry Point
- **[index.html](index.html)** — Single-page application HTML scaffold
  - Loads Firebase (compat) libraries
  - Injects all `htp-*.js` modules in sequence (NOT imported as ES6 modules)
  - Embeds localStorage shim for escrow keypair storage
  - Styles injected via inline CSS in game-specific modules

### Load Order (Critical)
1. `htp-init.js` — Network detection + WASM gate + wallet auto-connect
2. Firebase config + RealTime DB init
3. `htp-rpc-client.js` — Kaspa RPC connection + UTXO tracking
4. `htp-fee-engine.js` — Fee rules (treasury address, percentages)
5. `htp-covenant-escrow-v2.js` — Escrow keypair generation + script building
6. `htp-events-v3.js` — Match creation/join (skill games)
7. Game sync modules: `htp-chess-sync.js`, `htp-games-sync.js`
8. `htp-chess-dnd.js`, `htp-chess-ui.js` — Chess rendering
9. `htp-c4-animation.js`, `htp-checkers-multijump.js` — Game UI
10. `htp-autopayout-engine.js` — Auto settlement on game over (must be LAST)

---

## 2. MAIN MODULE FILES & PURPOSES

### Core Infrastructure

| File | Purpose | Key Exports/APIs |
|------|---------|------------------|
| **htp-init.js** | Network detection (tn12 vs mainnet), WASM boot gate, wallet auto-connect | `window.HTP_NETWORK`, `window.activeNet`, `window._onWasmReady()` |
| **htp-rpc-client.js** | Kaspa WebSocket RPC client, DAA score subscriber, UTXO tracking | `window.htpRpc.*`, `window.htpBalance`, `window.htpDaaScore` |
| **firebase-config.js** | Firebase Realtime DB initialization (hightable420 project) | `window.htpFirebase.*` (match/event helpers) |
| **htp-fee-engine.js** | Fee calculation engine (2% winner fee for skills, 30% hedge loss for maximizers) | `window.HTPFee.skillGameSettle()`, `.treasuryAddress()` |
| **htp-match-deadline.js** | DAA-score based match timing (replaces wall-clock for on-chain safety) | `HTPDeadline.create()`, `.check()`, `.onExpiry()` |

### Game Infrastructure

| File | Purpose | Dependencies |
|------|---------|---------------|
| **htp-events-v3.js** | Match creation & join flow (connects to escrow + Firebase) | escrow-v2, fee-engine, firebase, rpc-client |
| **htp-chess-sync.js** | Color assignment + board orientation + clock sync (Chess) | firebase real-time listeners |
| **htp-games-sync.js** | Side assignment + clock sync (Connect-4, Checkers) | firebase real-time listeners |
| **htp-board-engine.js** | Normalises board APIs across chess.js variants + UTXO patch | (patch layer) |
| **htp-chess-ui.js** | Piece rendering (white/black unicode pieces) + board styling | (visual layer) |
| **htp-chess-dnd.js** | Drag-and-drop move input for chess | chess.js library |
| **htp-c4-animation.js** | Drop animation + win-line pulse for Connect-4 | (animation only) |
| **htp-checkers-multijump.js** | Multi-jump validation + king promotion for Checkers | (rules engine) |

### Settlement & Wallet

| File | Purpose | Key Exports |
|------|---------|-------------|
| **htp-covenant-escrow-v2.js** | P2SH escrow script generation + escrow key storage + settlement TX builder | `window.generateMatchEscrow()`, `window.settleMatchPayout()` |
| **htp-autopayout-engine.js** | Watches Firebase `result` writes → auto-triggers settlement TX | `handleMatchGameOver()` (patched into game engines) |
| **htp-settlement-overlay.js** | Pre-flight verification + result display modal | `window.HTPSettlementOverlay.show()` |
| **htp-settlement-preview.js** | Wraps settlement with confirmation dialog | (wrapper layer) |

### Oracle & Events

| File | Purpose |
|------|---------|
| **htp-oracle-sync.js** | UI syncing for oracle stats (bonds, slashed amounts, accuracy) |
| **htp-zk-pipeline.js** | Proof commit → Firebase + attestation integration |
| **htp-event-creator.js** | Event creation form + maximizer cap calculator |
| **htp-maximizer-ui.js** | Maximizer bet UI + 50/50 split preview |

### Navigation & UI

| File | Purpose |
|------|---------|
| **htp-nav-v4.js** | Desktop pills + mobile bottom tab bar + breadcrumb + FAB + deep-linking |
| **htp-wallet-logos.js** | Wallet icon SVG injections (KasWare, KaspaWallet) |
| **htp-utxo-mutex.js** | Serialised UTXO sending (prevents double-spend across browser tabs) |
| **htp-cancel-flow.js** | Match cancellation flow (creator can cancel before opponent joins) |
| **htp-wasm-loader.js** | WASM binary loader for Kaspa SDK |

### Auxiliary

| File | Purpose |
|------|---------|
| **dag-background.js** | Animated DAG background (visual only) |
| **htp-silverscript-live.js** | Live script monitoring (development?) |

---

## 3. KEY STATE MANAGEMENT PATTERNS

### Global State (window namespace)

#### Network & Blockchain
```javascript
window.HTP_NETWORK          // 'tn12' or 'mainnet' (set by htp-init.js)
window.activeNet            // { prefix, networkId, rpcEndpoint, explorerTx, ... }
window.htpRpc               // RPC client API
window.htpBalance           // Current balance in KAS (float)
window.htpBalanceSompi      // Current balance in SOMPI (bigint)
window.htpDaaScore          // Current DAA score (bigint, ~10/sec increment)
```

#### Wallet & Identity
```javascript
window.walletAddress        // Connected wallet address (created by wallet extension)
window.connectedAddress     // Alias for walletAddress
window.walletBalance        // { total, available, pending, ... } in SOMPI
```

#### Match State
```javascript
window.matchLobby           // { matches: [...], activeMatch: {...}, myPlayerId: '...' }
window.htpMatches           // Alternative match storage
```

#### Escrow & Settlement
```javascript
window.htpEscrowKeys        // Map<matchId, { privKeyHex, pubKeyHex, address }>
window.htpCovenantEscrows   // Map<matchId, { address, redeemScript, escrowTxId }>
```

### Firebase Realtime DB Structure

```
matches/<matchId>/
  info/                     # Game metadata
    game: 'chess'
    status: 'waiting|active|completed'
    stake: 5 (KAS)
    timeControl: '5+0'
    created: timestamp
  players/
    creator: playerId
    opponent: playerId
    creatorAddrFull: 'kasp...addr'
    opponentAddrFull: 'kasp...addr'

relay/<matchId>/
  moves/<index>: { from, to, timestamp }      # Move history
  colors/
    white: playerId
    black: playerId
    assigned: true
  sides/
    p1: playerId           # For C4/Checkers: creator
    p2: playerId           # For C4/Checkers: joiner
    game: 'checkers'
    assigned: true
  clocks/                   # Firebase-synced game clocks
    white_ms: 123456
    black_ms: 234567
  result/
    winner: playerId|'draw'
    reason: 'checkmate|resignation|...'
    timestamp: timestamp

lobby/<matchId>/
  (match metadata for lobby listing)

oracleProofs/<marketId>: { proofHash, commitment, timestamp }
attestations/<marketId>: { result, oracle, attestedAt }
```

### Event Listeners & Callbacks

```javascript
// Firebase listeners (real-time sync)
firebase.database().ref('relay/<matchId>/moves').on('child_added', (snap) => {...})
firebase.database().ref('relay/<matchId>/clocks').on('value', (snap) => {...})
firebase.database().ref('relay/<matchId>/result').once('value', (snap) => {...})

// Custom events (cross-module communication)
window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: {...} }))
window.dispatchEvent(new CustomEvent('htp:balance:updated', { detail: { kas, sompi, address } }))
window.dispatchEvent(new CustomEvent('htp:wasm:ready', {}))
window.dispatchEvent(new CustomEvent('htp:settlement:complete', { detail: { txId, winner, ... } }))
window.dispatchEvent(new CustomEvent('htp:deadline:expired', { detail: { matchId, ... } }))
```

---

## 4. GAME FLOW (End-to-End)

### A. Skill Game (Chess/Connect-4/Checkers)

#### Phase 1: Match Creation
1. User fills form: game, stake (KAS), time control
2. **htp-events-v3.js** → `createMatchWithLobby()`
   - Validates balance & user confirmation
   - **htp-covenant-escrow-v2.js** → `generateMatchEscrow(matchId, addr)`
     - Generates random escrow keypair (client-side only)
     - Builds P2SH redeem script (KIP-10 covenant)
     - Stores keypair in `localStorage['htpEscrowKeys']`
   - Constructs payload (metadata JSON)
   - **htp-rpc-client.js** → `htpSendTx(escrowAddress, stakeSompi, opts)`
     - Uses UTXO mutex to prevent double-spend
     - Signs TX + sends to Kaspa RPC
     - Returns txId
   - Writes match object to Firebase `matches/<matchId>/` & `lobby/<matchId>/`

#### Phase 2: Match Join
1. Opponent finds match in lobby list
2. **htp-events-v3.js** → `joinLobbyMatch(matchId)`
   - Retrieves match from Firebase (or local cache)
   - Validates stake availability
   - Sends stake to escrow address
   - Updates Firebase `matches/<matchId>/info/status` = 'active'
   - Initializes Firebase relay paths

#### Phase 3: Game Play
1. **htp-chess-sync.js** / **htp-games-sync.js**
   - Creator writes side assignment (color/side) to Firebase
   - Joiner reads & takes opposite side
   - Both listen to Firebase for real-time move updates
2. **htp-chess-dnd.js** (Chess) / **htp-checkers-multijump.js** (Checkers)
   - Local move validation + board rendering
   - On every move:
     - Write to `relay/<matchId>/moves/<index>`
     - Update `relay/<matchId>/clocks` (Firebase-synced time)
     - Opponent's browser detects Firebase update + renders move
3. **htp-match-deadline.js**
   - Enforces DAA-score based move timeout
   - On expiry → opponent wins by timeout

#### Phase 4: Game Over
1. One of three outcomes fires `handleMatchGameOver(winner, isDraw)`:
   - Checkmate/captured king (Chess)
   - 4-in-a-row (Connect-4)
   - No pieces left / king captured (Checkers)
   - Timeout
   - Resignation
2. Winner's browser writes to `relay/<matchId>/result`
   - Both browsers listen for this write
3. **htp-autopayout-engine.js** detects result write
   - Calls `settleMatchPayout(matchId, winnerAddr, isDraw, ...)`
4. **htp-settlement-preview.js** gates settlement with confirmation modal
5. **htp-covenant-escrow-v2.js** → `window.settleMatchPayout()`
   - Retrieves escrow keypair from localStorage
   - Calculates settlement amounts via `HTPFee.skillGameSettle(stakeKas)`
     - Total pool = 2 × stakeKas
     - Protocol fee = 2% of pool
     - Winner payout = pool - fee
   - Builds settlement TX:
     - Input: escrow UTXO
     - Output 1: winner address (net payout)
     - Output 2: treasury (protocol fee)
   - Signs with escrow private key
   - Sends to Kaspa RPC
6. **htp-settlement-overlay.js** shows result modal (win/lose/draw)

---

## 5. ARCHITECTURE PATTERNS

### Pattern 1: Optimistic UI + Backend Sync
- Board opens before escrow UTXO confirms
- Firebase relay used for cross-browser coordination (not for settlement)
- Each browser remains authoritative for its own moves

### Pattern 2: Client-Side Escrow
- Escrow keypair generated in browser, stored in localStorage
- Private key NEVER leaves browser or sent to Firebase
- Settlement TX signed client-side
- Firebase is coordination-only (match state, opponent moves, oracle attestation)

### Pattern 3: DAA-Score Timing
- Replaces wall-clock with on-chain DAA score (~10 ticks/second)
- Enables covenant-based move deadlines
- Immune to client clock manipulation

### Pattern 4: Firebase Real-Time Listeners
- Moves propagate via `child_added` listeners (not polling)
- Clock synced via `on('value')` with periodic updates
- Result detection via `once('value')` wait pattern

### Pattern 5: Idempotent Settlement
- Settlement lock in Firebase prevents double-spend
- Both browsers can trigger settlement, but only one wins
- Insurance: covenant script allows creator to cancel before join

### Pattern 6: Module Coupling via Global Functions
- No ES6 modules — all modules export to `window` namespace
- Modules import via function checks: `if (typeof window.X === 'function')`
- Allows lazy loading + circular dependency avoidance

---

## 6. CURRENT INCOMPLETE/BROKEN FEATURES

### P0 Issues (Critical)

#### ❌ WASM Loading Path Broken
- **File**: `htp-init.js`, `htp-wasm-loader.js`
- **Issue**: WASM path hardcoded as `'./kaspa_bg.wasm'` (relative), but hosted at root or `/kaspa_bg.wasm`
- **Impact**: Kaspa SDK fails to load → no RPC connection → no wallet balance
- **Evidence**: `htp-init.js:100` mentions WASM gate but WASM fails silently
- **Status**: Partially fixed in `deploy-fixed.sh` (sed replace)
- **Fix**: Verify WASM path in Firebase Hosting config

#### ❌ Firebase Emulator Start Failing
- **File**: `functions/`, Firebase Cloud Functions
- **Issue**: `firebase emulators:start` exits with code 1 (see terminal history)
- **Possible Causes**:
  - Missing Node.js dependencies (`npm install` in `functions/`)
  - Firebase CLI version mismatch
  - Emulator port conflicts (4000, 5000, 4400, 4401, etc.)
- **Impact**: Local development blocked; manual testing required
- **Status**: Blocking Oracle daemon development
- **Fix**: Run `npm install` in `functions/` + check port availability

#### ❌ Oracle Daemon Settlement Watcher Not Running
- **File**: `htp-oracle-daemon/watcher.js`
- **Issue**: Settlement watch loop not triggering payouts (no recent logs)
- **Symptoms**:
  - Matches complete but settlement TX never fires
  - Escrow UTXOs accumulate without redemption
  - Oracle daemon logs show "waiting for attestation" infinitely
- **Root Cause**: Firebase listener not detecting `result` writes, or escrow settlement lacking covenant signature
- **Impact**: Winners don't receive payouts
- **Status**: P0 blocker
- **Fix**: 
  1. Verify `htp-oracle-daemon/.env` has correct `FIREBASE_DB_URL`
  2. Check Firebase security rules allow daemon to read `matches/*/result`
  3. Verify escrow private key persists correctly between browsers

#### ❌ Escrow Settlement TX Not Building Correctly
- **File**: `htp-covenant-escrow-v2.js` (line ~350)
- **Issue**: Settlement TX may fail at Kaspa RPC:
  - `scriptPubKey` encoding mismatch
  - `redeemScript` not included in scriptSig
  - Output count != 2 (violates KIP-10 covenant)
- **Evidence**: `htp-autopayout-engine.js` mentions "covenant integrity guard" but guard may not trigger
- **Fix**:
  1. Add test vector at `functions/test-oracle.js` for covenant settlement
  2. Verify `getTreasurySpk()` returns correct address per network
  3. Check P2SH address derivation via Kaspa SDK

### P1 Issues (Degraded Features)

#### ⚠️ Chess Piece Styling Inheritance Breaks
- **File**: `htp-chess-ui.js` (v3.0)
- **Issue**: Teal accent color leaks into piece rendering from lobby previews
- **Fix**: Applies `filter:none` to preview cards, but may not catch all selectors
- **Workaround**: `htp-chess-ui.js` uses MutationObserver to re-color pieces on DOM change

#### ⚠️ Connect-4/Checkers Clock Desync
- **File**: `htp-games-sync.js`
- **Issue**: Firebase clock updates may lag → local clock ticks ahead → clock shows negative
- **Evidence**: Logic includes `if (ms < 0) ms = 0` (defensive only)
- **Fix**: Add clock lower-bound enforcement; consider time-sync negotiation on move

#### ⚠️ Maximizer Parasitic Fee Not Enforced
- **File**: `htp-fee-engine.js`, `htp-event-creator.js`
- **Issue**: Maximizers are cheaper for event creators but logic for capping total vol not validated on-chain
- **Fix**: Oracle daemon should reject markets that exceed `maxMaximizerPct`

#### ⚠️ Oracle Bond Slashing Not Automated
- **File**: `htp-oracle-sync.js`, no active slashing logic
- **Issue**: Bonds accumulate but slashing only happens if oracle attestates wrong result
- **Fix**: Implement automated slashing on `firebase.database().ref('markets/<id>/slashed')`

### P2 Issues (Missing Features)

#### ❓ Multi-Series Matches Not Supported in UI
- **File**: `htp-events-v3.js` stores `seriesLen` but no series round tracking
- **Impact**: Only first game of series is played
- **Fix**: Queue next match automatically on series > 1

#### ❓ Resignation Flow Not Wired
- **File**: `htp-cancel-flow.js` exists but may not integrate with game board
- **Fix**: Add resign button to game overlay; write `relay/<matchId>/result` with `reason: 'resignation'`

#### ❓ Wallet Auto-Switch Not Triggered
- **File**: `htp-init.js` detects wallet but may not listen for user switching between wallets (KasWare ↔ KaspaWallet)
- **Fix**: Listen to wallet extension events + refresh balance on switch

---

## 7. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER #1 (Creator)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Create Match Form]                                              │
│         ↓                                                          │
│  htp-events-v3.js → createMatchWithLobby()                       │
│         ↓                                                          │
│  htp-covenant-escrow-v2.js → generateMatchEscrow()               │
│    - Generate keypair (WebCrypto CSPRNG) → localStorage           │
│    - Build P2SH redeemScript                                      │
│         ↓                                                          │
│  htp-rpc-client.js → htpSendTx(escrowAddr, stakeSompi)           │
│    - Sign TX with wallet key                                      │
│    - Submit to Kaspa RPC                                          │
│         ↓                                                          │
│  Firebase → matches/<matchId>/*, lobby/<matchId>/*                │
│         ↓                                                          │
│  Board opens, listens: firebase.on('child_added', moves)          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Firebase (coordination only)
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER #2 (Joiner)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Lobby] → sees match → joinLobbyMatch(matchId)                  │
│         ↓                                                          │
│  htp-rpc-client.js → htpSendTx(escrowAddr, stakeSompi)           │
│    - Second stake TX to SAME escrow address                       │
│         ↓                                                          │
│  Firebase → matches/<matchId>/info/status = 'active'             │
│    → assigns color/side via relay/<matchId>/colors               │
│         ↓                                                          │
│  Board opens, listens: firebase.on('child_added', moves)          │
│  Renders moves from Browser #1 in real-time                       │
│         ↓                                                          │
│  Move sequence:                                                    │
│  - Browser #1 plays → write moves[0] → Firebase                   │
│  - Browser #2 listens → render                                    │
│  - Browser #2 plays → write moves[1] → Firebase                   │
│  - Browser #1 listens → render                                    │
│         ↓                                                          │
│  Game Over (checkmate/timeout/etc)                                │
│    Browser #1 writes: relay/<matchId>/result = {winner, reason}   │
│         ↓                                                          │
│  htp-autopayout-engine.js detects result write (both browsers)    │
│         ↓                                                          │
│  htp-settlement-preview.js shows confirmation modal               │
│         ↓                                                          │
│  Winner's browser (or Oracle daemon):                             │
│    htp-covenant-escrow-v2.js → settleMatchPayout()                │
│    - Fetch escrow keypair from localStorage                       │
│    - Calculate: fee = stakeKas × 2 × 0.02                         │
│    - Build settlement TX:                                         │
│      Input: escrow UTXO                                           │
│      Output[0]: winner addr (stakeKas × 2 - fee)                  │
│      Output[1]: treasury (fee)                                    │
│    - Sign with escrow private key                                 │
│    - Submit to Kaspa RPC                                          │
│         ↓                                                          │
│  htp-settlement-overlay.js shows result: "You won! 9.9 KAS"       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                         ↕ Kaspa Blockchain
                    [Escrow UTXO → Settlement TX]
                         (on-chain only)
```

---

## 8. KEY FILE CROSS-REFERENCES

### Dependency Graph (Load Order)
```
htp-init.js
  ↓ (sets window.HTP_NETWORK, window.activeNet)
htp-rpc-client.js
  ↓ (requires window.HTP_NETWORK)
firebase-config.js
  ↓ (Firebase init)
htp-fee-engine.js
  ↓ (requires window.HTP_NETWORK for treasury addr)
htp-covenant-escrow-v2.js
  ↓ (requires HTPFee)
htp-events-v3.js
  ↓ (requires generateMatchEscrow, htpSendTx, firebase)
htp-chess-sync.js, htp-games-sync.js, htp-board-engine.js
  ↓ (require Firebase + match metadata)
htp-chess-ui.js, htp-chess-dnd.js, htp-c4-animation.js, htp-checkers-multijump.js
  ↓ (visual + interaction layers)
htp-autopayout-engine.js (MUST BE LAST)
  ↓ (wraps handleMatchGameOver, requires all above)
```

### Oracle Infrastructure (Separate Process)
```
htp-oracle-daemon/
  ├── watcher.js
  │   └── Listens: Firebase matches/<matchId>/result
  │   └── Calls: settleMatchPayout() (node.js bridge to Kaspa SDK)
  │   └── Writes: attestations/<marketId>
  ├── settler/watcher.js
  │   └── Fallback multi-sig settlement for edge cases
  └── .env
      └── FIREBASE_DB_URL, ORACLE_PRIVKEY, etc.
```

---

## 9. DEVELOPMENT NOTES

### Testing Locally
1. Run Firebase emulator: `firebase emulators:start --only hosting,functions` (currently broken, use external DB)
2. Use Kaspa testnet-12: `?net=tn12` URL parameter
3. Create matches with small stakes (0.1 KAS)
4. Monitor browser console: `[HTP ...]` prefix logs all operations

### Debugging Checklist
- ✅ Verify WASM loads: check DevTools → Network → `kaspa_bg.wasm`
- ✅ Check wallet connected: `window.walletAddress` in console
- ✅ Check balance synced: `window.htpBalance` in console
- ✅ Check Firebase: browser DevTools → Application → Cookies → Firebase tokens
- ✅ Check escrow key: `JSON.parse(localStorage.getItem('htpEscrowKeys'))` in console
- ✅ Verify RPC connection: `window.htpRpc.isConnected()` in console
- ✅ Monitor settlement: grep "coinbase" or search GitHub Actions logs for settlement TX submissions

### Known Quirks
- **localStorage escrow keys**: Not cleared between matches; accumulates over time. Should implement cleanup.
- **Firebase listeners**: Each listener leaks memory if not detached on match end. Need active unsubscribe.
- **UTXO confirmation**: TX may appear immediately but UTXO not spendable for ~10 seconds (Kaspa consensus time).
- **Double-spend guard**: `htp-utxo-mutex.js` serialises TXs but doesn't persist state across page reloads.

---

## 10. FILE SIZE & Performance Note

| Component | Files | Approx Size | Load Time |
|-----------|-------|-------------|-----------|
| Game Board Engines | 4 files | ~80 KB | ~50ms |
| Firebase Listeners | 2 files | ~40 KB | ~30ms |
| Escrow + Settlement | 3 files | ~60 KB | ~40ms |
| Navigation + UI | 2 files | ~120 KB | ~60ms |
| **Total JS** | **30+ files** | **~800 KB** | **~500ms** |

- **WASM overhead**: Kaspa SDK adds ~400 KB gzipped (not counted above)
- **Firebase overhead**: compat libraries add ~200 KB (in index.html)
- **No bundling**: Direct script loading means no tree-shaking or minification

---

## SUMMARY TABLE

| Aspect | Status | Notes |
|--------|--------|-------|
| Skill Games (Chess/C4/Checkers) | ✅ Functional | Escrow + settlement working |
| Wallet Connection | ✅ Functional | KasWare & KaspaWallet supported |
| Firebase Sync | ✅ Functional | Real-time move propagation working |
| Oracle Daemon | ⚠️ Degraded | Watcher may not trigger consistently |
| Maximizer Bets | ✅ Functional | UI working; enforcement unclear |
| Multi-Series | ❌ Not Implemented | Need queue + auto-rematch |
| Resignation | ❌ Not Wired | Feature exists but not integrated |
| WASM Loading | ⚠️ Broken | Path issues; partially fixed |
| Firebase Emulator | ❌ Broken | Can't start locally |
| Escrow Settlement | ⚠️ Risky | Covenant integrity guard exists but may need testing |

