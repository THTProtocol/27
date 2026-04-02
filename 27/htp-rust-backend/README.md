# HTP Rust Backend

Rust backend for the **High Table Protocol (HTP)**, replacing the browser-side WASM implementation. The frontend is a vanilla HTML/JS app hosted on Firebase; this server provides wallet, escrow, and block-DAG endpoints over HTTP.

## Prerequisites

- Rust toolchain (stable) — install via [rustup](https://rustup.rs/)
- Kaspa dependencies require the [rusty-kaspa](https://github.com/kaspanet/rusty-kaspa) repo cloned locally. See the commented-out dependencies in `Cargo.toml` and update the paths once you have the repo.

## Build & Run

```bash
cargo build
cargo run
```

The server listens on `http://0.0.0.0:3000` by default.

## Endpoints

| Method | Path                      | Description                                  |
|--------|---------------------------|----------------------------------------------|
| GET    | `/health`                 | Health check — returns status and version     |
| POST   | `/wallet/from-mnemonic`   | Derive address from a BIP39 mnemonic          |
| GET    | `/wallet/balance/:addr`   | Fetch UTXO balance for an address             |
| POST   | `/escrow/create`          | Construct P2SH escrow address for two pubkeys |
| POST   | `/escrow/payout`          | Build & sign payout tx to winner address      |
| POST   | `/escrow/cancel`          | Build & sign refund tx                        |
| GET    | `/blockdag/live`          | Stream recent block headers (SSE)             |
| POST   | `/tx/broadcast`           | Broadcast a raw transaction                   |

### Request / Response Examples

**POST /wallet/from-mnemonic**

```json
// Request
{ "mnemonic": "word1 word2 ... word12", "network": "mainnet" }

// Response
{ "address": "kaspa:...", "public_key": "..." }
```

**GET /wallet/balance/:addr**

```json
// Response
{ "address": "kaspa:...", "balance_sompi": 100000000, "balance_kas": 1.0 }
```

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
```

**POST /escrow/cancel**

Same request body as `/escrow/payout`.

**POST /tx/broadcast**

```json
// Request
{ "raw_tx": "hex-encoded-transaction" }

// Response
{ "tx_id": "..." }
```

**GET /health**

```json
{ "status": "ok", "version": "0.1.0" }
```

## CORS

CORS is configured to allow all origins (development mode). Restrict before deploying to production.
