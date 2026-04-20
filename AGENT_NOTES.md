# AGENT_NOTES - Sun Apr 20 19:24:00 UTC 2026

## STEP 0 — SETUP COMPLETE

### Codebase Map
- Repo exists at ~/high-table (pulled from origin/main)
- Structure: Node.js project (NOT Rust workspace as protocol described)
- No covenants/, crates/, or 27/ directories found
- Main code: lib/, server.js, public/, tests/

### Files Found
**JavaScript files (25):**
- server.js, lib/kaspa-rpc.js, lib/tx-builder.js, lib/utxo-indexer.js
- lib/scripts/: creator-bond.js, market-pool.js, position-receipt.js, game-escrow.js
- lib/oracle-daemon.js, lib/settlement.js, lib/fees.js
- public/: app.js, chess-ui.js, checkers-ui.js, connect4-ui.js, wallet-ui.js
- tests/: 5 test files

**Rust files:** NONE
**Cargo.toml:** NONE
**Silverscript (.ss):** NONE

### MiroFish Status
✓ MiroFish-Offline backend running on localhost:5001 (status: ok)

## STEP 1 — RESEARCH COMPLETE

Research saved to ~/high-table/research.json

### Key Findings:

**Breaking Changes (rusty-kaspa 2025-2026):**
- v1.1.0 (Mar 2026): DB schema v6, Rust 2024 edition, VSPC API v2
- v1.0.0 (Mar 2025): Crescendo hardfork (1→10 BPS), P2P v7
- v0.16.0 (Jan 2025): DB v3→v4, KIP-10 opcodes, 8-byte arithmetic

**TN12 Opcodes Available:**
- OpOutpointTxId (0xba), OpOutpointIndex (0xbb)
- OpTxInputIndex (0xb9), OpTxInputAmount (0xbe)
- OpTxInputSpk (0xbf), OpTxOutputSpk (0xc3)
- OpCovInputCount (0xd0), OpCovInputIdx (0xd1), OpCovOutputCount (0xd2), OpCovOutputIdx (0xd3)
- OpInputCovenantId (0xcf), OpAuthOutputCount (0xcb), OpAuthOutputIdx (0xcc)
- OpChainblockSeqCommit (0xd4) for KIP-15
- PLUS: Full KIP-10 introspection set (OpTxVersion, OpTxInputCount, etc.)

**NOT Available:**
- OP_NEXTTXID — must be computed externally
- OP_COVENANTAMOUNT — use OpTxInputAmount + covenant index opcodes

**KIP-15 ATAN:**
- SequencingCommitment field replaces AcceptedIDMerkleRoot
- Calculated as hash(parent.SequencingCommitment, AcceptedIDMerkleRoot)
- Timestamps: Unix milliseconds (u64)

**Crate Versions:**
- Workspace: 1.1.0 (Rust 1.88.0, Edition 2024)
- Published: kaspa-os 0.13.4, kaspa-wasm 0.15.0, kaspa-miner 0.2.5

## STEP 2 — AUDIT INCONSISTENCIES

## ISSUES FOUND

- [ ] No Rust workspace exists — entire crates/ directory missing | N/A | Must create from scratch
- [ ] No covenants/ directory with .ss files | N/A | Must create ParimutuelMarket.ss, TournamentBracket.ss
- [ ] No 27/ directory for frontend JS | N/A | Must create htp-init.js, htp-rpc-client.js, htp-mirofish.js
- [ ] lib/kaspa-rpc.js — need to check if using resolver "tn12" or hardcoded IP | lib/kaspa-rpc.js | Audit needed
- [ ] No MiroFish integration in any file | N/A | Must add htp-mirofish.js and Rust bridge
- [ ] No silverscript compiler available | N/A | Need to verify silverscript CLI exists
- [ ] package.json has no kaspa-* dependencies | package.json | Using pure JS, no Rust crates

### Next Actions:
1. Create directory structure: covenants/, crates/, 27/
2. Delegate covenant writing to "coder"
3. Delegate Rust workspace + MiroFish bridge to "coder"
4. Create JS frontend files with TN12 resolver
