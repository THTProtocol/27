# HTP Execution Model — Kaspa-Native Architecture

## Design Philosophy

High Table Protocol follows the **Kaspa Toccata model**: native L1 covenants for enforceable money flows, Rust services for verifiable off-chain computation, and browser JS only where the DOM/wallet/canvas requires it.

## Layer Map

| Concern | Layer | Why |
|---------|-------|-----|
| **Funds custody** (stake locked in escrow) | COVENANT ON-CHAIN | Only L1 can truly enforce custody |
| **Join conditions** (exact stake match) | COVENANT ON-CHAIN | Must be programmatic, not trusted |
| **Cancel conditions** (creator-only pre-join, timelock) | COVENANT ON-CHAIN | Refund path must be covenant-enforced |
| **Settlement authorization** (winner payout sig) | COVENANT + ORACLE | 2-of-3 multisig or oracle attestation |
| **Protocol fee routing** (2% treasury) | COVENANT ON-CHAIN | Fee extraction must be script-enforced |
| **Oracle bond/slash** | COVENANT ON-CHAIN | Bond escrow + slash conditions |
| **Move legality** (chess rules, check detection) | RUST OFF-CHAIN | Too complex for script, deterministic in Rust |
| **Win/draw/loss detection** | RUST OFF-CHAIN | Computed by game engine, verifiable |
| **Proof commit** (SHA-256 chain root) | RUST OFF-CHAIN | Narrow verification commitment |
| **Groth16 proof** (KIP-16) | RUST OFF-CHAIN | BN254 prover, optional for testnet |
| **Settlement plan** (who gets what) | RUST OFF-CHAIN | Fee math, winner/loser splits |
| **Board rendering** (pieces, DnD, animation) | BROWSER JS | DOM/canvas, wallet injection |
| **Wallet bridge** (connect, sign, send) | BROWSER JS | Browser extensions (KasWare, Kastle, etc.) |
| **Firebase sync** (lobby, match state, portfolio) | BROWSER JS + Rust | Realtime reads in browser, write bridge in Rust |
| **BlockDAG viz** | BROWSER JS | Kepler explorer iframe |

## What Runs On-Chain (Covenants)

```
MatchEscrow:
  - Locks: creator stake → covenant UTXO
  - Join path: exact_amount + correct_destination → active match state
  - Cancel path: creator_sig AND no_join_yet → refund to creator
  - Settle path: oracle_attestation(winner) → winner_payout + protocol_fee
  - Timeout path: timelock_expired AND no_settle → refund to parties
```

## What Runs in Rust (Off-Chain, Verifiable)

```
Game Engines:
  - Chess: shakmaty crate — FEN, legal moves, check/draw/mate
  - Connect4: bitboard engine — drop, gravity, 4-in-a-row detection  
  - Checkers: multi-jump engine — mandatory captures, king promotion

Settlement Engine:
  - Fee calculation: stake * 2 * 0.02 → treasury
  - Payout plan: winner gets (stake * 2 - fee)
  - Idempotency gate: match_id → settle_tx stored, replayed not re-executed
  - Settlement preview: returns canonical payout JSON before TX signing

Proof System:
  - SHA-256 sequential chain: h0=SHA(m0), h1=SHA(h0+m1), ...  
  - Narrow verification: commit root posted to chain/Firebase
  - Groth16 (KIP-16): BN254 prover ready when arkworks deps resolve

Covenant Registry (KIP-20):
  - match_id → covenant_id → creation_txid → current_txid → generation
  - Lineage tracking across UTXO transitions
```

## What Stays in Browser JS

- Wallet extension detection and connection (kasware, kastle, OKX, etc.)
- Board DOM rendering with SVG pieces (Lichess-style)
- Drag-and-drop and touch interaction
- Firebase Realtime DB listeners for lobby and match sync
- BlockDAG visualization (Kepler iframe)
- UI chrome: navigation, overlays, toasts, modals
- Theme/styling/animation

## Why This Architecture

Kaspa covenants excel at **enforceable money flows** — custody, conditions, fee routing. They are not designed for chess rule evaluation or 4-in-a-row detection. The right split:

1. **Covenant enforces**: funds are locked, only correct paths spend them, fees go to treasury
2. **Rust computes**: which player won (deterministically, auditable), what the payout amounts are  
3. **Browser presents**: beautiful board, smooth drag-and-drop, wallet UX

This matches the Kaspa Toccata spirit: "L1 for asset security, off-chain for computation, ZK for privacy/compression."
