# TOCCATA PROTOCOL LOCK — Part 1: Protocol Lock + Backend Truth Layer

> HIGH TABLE PROTOCOL — Toccata/TN12 Covenant Migration
> Effective: 2026-05-11
> Status: Phase 1 active. Phases 2–8 pending.

## Protocol Invariants (Non-Negotiable)

These invariants MUST hold at every layer (Rust backend, Node API, frontend). No phase may relax them.

### 1. Non-Custodial — No Proxy Escrow
- The server NEVER holds user funds.
- No server-side wallet with spend authority.
- No "deposit to us and we'll forward" flow.
- All fund flow goes through on-chain covenant UTXOs controlled by the Kaspa script.
- The server may OBSERVE, INDEX, and RELAY — never CUSTODY.

### 2. Real-or-Fail Covenant Addresses
- A covenant funding address MUST be derived from a real on-chain covenant script.
- The server MUST NEVER fabricate, concatenate, or placeholder a deposit address.
- If covenant derivation is not yet implemented, `/api/gamecreate` and any funding-address endpoint MUST return:
  ```json
  { "error": "COVENANT_DERIVATION_NOT_READY", "detail": "Refusing to return fake deposit address." }
  ```
- PROTOCOLADDRESS, fee address, or any server-controlled address MUST NOT be returned as a covenant funding address.

### 3. No Fake Transaction Hashes
- Every txid returned by the API MUST correspond to a real on-chain transaction.
- Never return `"0".repeat(64)` or any fabricated hash as a real txid.
- If a tx is not yet broadcast, return a `pending_tx` status with no txid — not a fake one.

### 4. No Fake Oracle Signatures
- Oracle attestations must be real cryptographic signatures verifiable on-chain.
- Never return a mock/placeholder attestation as if it were real.
- If oracle signing is not available, return `ORACLE_SIGNING_NOT_READY`.

### 5. No Fake Payout/Proof Root
- `proof_root` must be a real Merkle root or `null` if not yet computed.
- Never hardcode `proof_root` to `"0".repeat(64)` as a valid value.
- "Payout done" status requires a real txid or verifiable on-chain operation.

### 6. Fail Loudly
- If a requested operation requires infrastructure not yet deployed (covenant scripts, oracle network, WASM signing), FAIL with a clear error code.
- Never silently return success for an operation that didn't actually happen on-chain.
- Error codes: `COVENANT_DERIVATION_NOT_READY`, `ORACLE_SIGNING_NOT_READY`, `TX_BROADCAST_FAILED`, `INVALID_PROOF_ROOT`, `INSUFFICIENT_BOND`.

## Server Role Boundaries

### ALLOWED (Server May)
- Index and serve on-chain data (games, events, oracles, covenants).
- Relay user-submitted data to the Kaspa P2P network.
- Proxy read-only queries to the Rust backend.
- Match orders (pairing logic only — no custody).
- Serve static frontend assets.
- Store order metadata (creator, stake, expiry) for matching purposes.

### FORBIDDEN (Server Must NOT)
- Generate or hold private keys for users.
- Sign transactions on behalf of users.
- Hold KAS in a hot wallet for "convenience."
- Return a deposit address that the server controls.
- Claim a payout occurred without an on-chain txid.
- Fabricate oracle attestations.

## Phases (1–8)

| Phase | Name | Scope |
|-------|------|-------|
| 1 | Protocol Lock + Backend Truth Layer | Invariants doc, no-fake enforcement, missing endpoint plumbing |
| 2 | Covenant Script Audit + TN12 Deployment | Audit Rust covenant code, deploy to TN12, verify script hash |
| 3 | WASM Client-Side Signing Pipeline | Browser-side covenant address derivation, PSBT signing, tx broadcast |
| 4 | Oracle Network Hardening | Real BLS/Schnorr attestations, quorum logic, slash enforcement |
| 5 | End-to-End Game Flow | Create → fund covenant → play → attest → settle — full cycle on TN12 |
| 6 | ZK Proof Integration | Zero-knowledge proof of fair play, on-chain verification |
| 7 | Mainnet Readiness | TN12 → mainnet migration plan, security audit, economic parameters |
| 8 | Governance + Protocol Economics | Fee model, DAO parameters, upgrade mechanism |

## Enforcement

- Every PR and commit touching fund flow, covenant addresses, oracle attestations, or tx hashes MUST be checked against these invariants.
- CI should include a `grep` scan for banned patterns: `mock`, `fake`, `placeholder`, `0.repeat(64)`, `PROTOCOLADDRESS`, `Math.random()` in fund-flow paths.
- This document is the source of truth. If code contradicts it, the code is wrong.
