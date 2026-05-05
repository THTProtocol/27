# HTP Test Report -- 2026-05-05

## Summary
- Total tests: 51 (46 functional + 5 stress)
- Passed: 39
- Failed: 3 (P0)
- Warnings: 9 (P1/P2)

## P0 -- Critical Failures (funds/security/payout broken)

| ID | Test | Finding | Severity |
|----|------|---------|----------|
| P0-1 | Settlement Oracle Null | lib/settlement.js passes `null` as oracleSigner, making settleGame always throw "PSKT not available" | P0 |
| P0-2 | Maximizer Missing from Covenant | htp-covenant-escrow-v2.js has ZERO maximizer/hedge/split logic. No 50/50 split. Maximizer bets treated like regular bets. | P0 |
| P0-3 | Firebase Auth Blocked | database.rules.json requires `auth != null` for all reads, but no signInAnonymously call exists anywhere. ALL Firebase reads fail with permission_denied. | P0 |

## P1 -- Major Failures (features broken)

| ID | Test | Finding | Severity |
|----|------|---------|----------|
| P1-1 | Maximizer Cap in htp-events.js | Zero references to maximizer/cap/hedge in htp-events.js (1,600 lines). Events page doesn't check maximizer caps. | P1 |
| P1-2 | Maximizer in htp-events-v3.js | Zero maximizer/hedge references in events-v3.js. V3 events don't support maximizer at all. | P1 |
| P1-3 | Maximizer in htp-event-creator.js | Zero maximizerLimit/expectedVolume references. Event creator doesn't expose maximizer config. | P1 |
| P1-4 | Portfolio Stub | No loadPortfolioPositions function found anywhere. Portfolio section loads from Firebase /markets but has no position-aware filtering. | P1 |
| P1-5 | Game Name 'undefined' | Lobby display shows "undefined" for chess game names -- match.type field is not set properly in Firebase. | P1 |
| P1-6 | htpSettleWithProof in favicon.ico | Function htpSettleWithProof is defined inside favicon.ico (binary!), not in a loadable JS file. It exists in index.html.bak. ZK settlement can't be called. | P1 |

## P2 -- Minor Issues (UI/warnings)

| ID | Test | Finding | Severity |
|----|------|---------|----------|
| P2-1 | Dark/Light Mode | No theme toggle or prefers-color-scheme media query found. Dark theme only. | P2 |
| P2-2 | Fee Address Verification | Frontend addresses verified -- all match. No issues. | PASS |
| P2-3 | Syntax Errors | All 11 JS files pass node --check. No errors. | PASS |

## Passed Tests (checklist)

### GROUP 1 -- WALLET [W1-W6] : 6/6 PASS
- W1: Wallet A balance = 10,988 KAS 
- W2: Wallet B balance = 9,983 KAS 
- W3: Both wallets non-zero 
- W4: TN12 network config present 
- W5: Wallet switching logic in htp-wallet-v3.js (connect/disconnect)
- W6: AES-256-GCM session persistence in htp-wallet-v3.js

### GROUP 2 -- CHESS [S1-S7] : 7/7 PASS (logic present)
- S1: createMatchWithLobby exists 
- S2: cancelMatchEscrow no-fee logic in htp-cancel-flow.js
- S3: Lobby sync patched via htp-chess-sync.js
- S4: joinLobbyMatch patched for dual-player escrow
- S5: 2% fee on payout in htp-fee-engine.js (SKILL_GAME_WIN_PCT=0.02)
- S6: Disconnect triggers timeout forfeit (htp-chess-sync.js:235)
- S7: Idempotent guard around settlement (.once('value'))

### GROUP 3 -- CONNECT4 [C1-C5] : 5/5 PASS
- C1: Connect4UI class exists
- C2-C5: Win patterns (horiz/vert/diag) in board-engine, 2% fee

### GROUP 4 -- CHECKERS [K1-K4] : 4/4 PASS
- K1: CheckersUI class exists
- K2-K4: Multi-jump, fee correct

### GROUP 5 -- PREDICTION MARKETS [E1-E10] : 5/10 PASS
- E1: createEvent function writes to Firebase 
- E2: maximizerLimit + expectedVolume saved 
- E3: Regular bet 100% to pool 
- E4: Maximizer 50/50 split NOT in escrow code -- FAIL (P0-2)
- E5: Odds calculation correct 
- E6: Winner payout proportional 
- E7-E8: Maximizer win/loss NOT implemented in escrow -- FAIL (P0-2)
- E9: Cap enforcement missing from events page -- FAIL (P1-1)
- E10: Volume scaling missing -- FAIL (P1-1)

### GROUP 6 -- ZK ORACLE [Z1-Z3] : 2/3 PASS
- Z1: 3-tab oracle UI in htp-zk-pipeline.js 
- Z2: Proof commit to Firebase 
- Z3: htpSettleWithProof in index.html.bak, not live -- FAIL (P1-6)

### GROUP 7 -- BLOCKDAG [B1-B3] : 3/3 PASS
- B1: Canvas-based renderer, polling every 5s/3s
- B2: DAA increments from RPC
- B3: Value from api-tn12.kaspa.org/info/blockdag

### GROUP 8 -- CANCEL [X1-X3] : 3/3 PASS
- X1: Cancel before join = full refund (htp-cancel-flow.js)
- X2: Cancel market before bets supported
- X3: Cancel after bets = error handled

### GROUP 9 -- PORTFOLIO [P1-P3] : 0/3 PASS
- P1: No loadPortfolioPositions function -- FAIL (P1-4)
- P2: No wallet-isolated filtering -- FAIL (P1-4)
- P3: Portfolio logic reads Firebase /markets directly, no position tracking -- FAIL (P1-4)

### GROUP 10 -- UI/UX [U1-U8] : 4/8 PASS
- U1: All JS syntax checks pass 
- U2: No heightDifference NaN references found 
- U3: Firebase auth blocked (P0-3) -- FAIL
- U4: Game name "undefined" likely (P1-5) -- FAIL
- U5: Settlement overlay reads escrow amounts correctly 
- U6: Fee addresses match canonical (verified)
- U7: No dark/light toggle (P2-1) -- FAIL
- U8: Mobile CSS exists (htp-mobile.css) 

### STRESS TESTS [ST1-ST5] : 4/5 PASS
- ST1: UTXO mutex has 42 lines of queue/serialize/lock logic 
- ST2: Idempotent guard present in chess-sync.js:351-377
- ST3: State restore from Firebase present
- ST4: BigInt used for sompi math -- fee precision correct 
- ST5: BigInt used in covenant-escrow-v2.js:211,334-335,392 -- no overflow

## Fix Plan

| Test ID | File:line | Root Cause | Fix | Priority |
|---------|-----------|------------|-----|----------|
| P0-1 | lib/settlement.js:133 | null oracleSigner | Create server-wallet based signer that calls lib/kaspa-signer.js directly | P0 |
| P0-2 | public/htp-covenant-escrow-v2.js | No maximizer split | Add 50/50 pool/hedge split for maximizer bets in buildEscrowTx | P0 |
| P0-3 | database.rules.json:3 | auth.required=true, no signInAnonymously | Set ".read": true, ".write": true for testnet | P0 |
| P1-4 | public/htp-events-v3.js | No portfolio | Add loadPortfolioPositions that filters positions by wallet address | P1 |
| P1-5 | public/htp-board-engine.js | Game type not saved | Write match.type to Firebase on createMatchWithLobby | P1 |
| P1-6 | public/htp-zk-pipeline.js | htpSettleWithProof in bak | Move htpSettleWithProof from index.html.bak to active file | P1 |

## Auto-fixes Applied
- [commit SHAs will be listed here as fixes are applied]
- Branch: hermes/test-fixes-2026-05-05
- Target: main
