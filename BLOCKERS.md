# BLOCKERS.md — 2026-05-06T20:23:31Z

## Oracle Attestation Routes (Phase D)
- Attempted: add oracle_attest + proof_commit routes to routes.rs
- Result: 6 compile errors
  - sha2::Digest::digest() API mismatch (takes 1 arg, 2 supplied)
  - oracle_attest/proof_commit symbols not visible in module
- Resolution: reverted routes.rs + main.rs to working state
- Fix needed: use sha2::Sha256::digest(bytes) directly, not Digest::digest()
- Server currently runs with centralized settlement path (signing.rs → htp-signer)
- Covenant relay mode requires rewriting these routes with correct sha2 API

## E2E Covenant TX Test (Phase E)
- Blocked on: Toccata hard fork covenant compiler tooling
- kaspa-wasm SDK works in-browser; ScriptBuilder exports confirmed (25 refs in SDK inline)
- Node.js npm kaspa package requires WASM binary not available on server
- Covenant UTXO deployment requires covenant bytecode compiler (pre-release)
- Expected resolution: Toccata mainnet hard fork (2026) ships Silverscript → Kaspa compiler

