# HTP Rust Backend

Rust backend server for the **High Table Protocol (HTP)** — a Kaspa-based escrow and wagering platform. This service replaces the browser-side WASM implementation with a dedicated HTTP server built on [Axum](https://github.com/tokio-rs/axum).

The frontend is a vanilla HTML/JS app hosted on Firebase that communicates with this backend over REST + SSE.

## Prerequisites

- **Rust 1.75+** (install via [rustup](https://rustup.rs))
- **Kaspa dependencies** — the `kaspa-*` crates are **not published on crates.io**. You must clone [rusty-kaspa](https://github.com/kaspanet/rusty-kaspa) locally, then uncomment and configure the git dependencies in `Cargo.toml`.

## Build & Run

```bash
# Build
cargo build

# Run (listens on 0.0.0.0:3000)
cargo run
```

## Endpoints

All endpoints return JSON unless noted otherwise.

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status":"ok","version":"0.1.0"}` |

### Wallet

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/wallet/from-mnemonic` | Derive a Kaspa address from a BIP39 mnemonic |
| `GET` | `/wallet/balance/{addr}` | Fetch UTXO balance for a Kaspa address |

**POST /wallet/from-mnemonic**

```json
// Request
{ "mnemonic": "word1 word2 ... word12", "network": "mainnet" }

// Response
{ "address": "kaspa:...", "public_key": "..." }
```

**GET /wallet/balance/{addr}**

```json
// Response
{ "address": "kaspa:...", "balance_sompi": 100000000, "balance_kas": 1.0 }
```

### Escrow

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/escrow/create` | Construct a P2SH escrow address for two pubkeys |
| `POST` | `/escrow/payout` | Build and sign a payout transaction to the winner |
| `POST` | `/escrow/cancel` | Build and sign a refund transaction |

**POST /escrow/create**

```json
// Request
{ "pubkey_a": "...", "pubkey_b": "...", "amount_sompi": 500000000 }

// Response
{ "escrow_address": "kaspa:...", "script_hash": "..." }
```

**POST /escrow/payout**

```json
// Request
{
  "escrow_address": "kaspa:...",
  "winner_address": "kaspa:...",
  "amount_sompi": 500000000,
  "fee_address": "kaspa:...",
  "fee_bps": 250
}

// Response
{ "tx_id": "..." }
```

**POST /escrow/cancel** — same request/response shape as `/escrow/payout`.

### BlockDAG

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/blockdag/live` | Server-Sent Events stream of recent block headers |

### Transaction

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tx/broadcast` | Broadcast a signed raw transaction |

```json
// Request
{ "raw_tx": "..." }

// Response
{ "tx_id": "..." }
```

## Architecture

```
Frontend (Firebase)  ──HTTP/SSE──▶  htp-rust-backend (Axum :3000)
                                          │
                                          ▼
                                    Kaspa Node (wRPC)
```

All Kaspa interactions (wallet derivation, UTXO queries, transaction signing, broadcasting) will use the `kaspa-*` crates from the [rusty-kaspa](https://github.com/kaspanet/rusty-kaspa) monorepo once the git dependencies are enabled.

## CORS

CORS is configured to allow all origins (development mode). Restrict before deploying to production.
