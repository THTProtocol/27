# htp-rust-backend

Rust backend for the HTP platform, built with Axum. This service will eventually replace the WASM module, providing wallet operations, escrow management, and BlockDAG streaming via a JSON HTTP API.

## API Contract

| Method | Endpoint                  | Description                                      |
|--------|---------------------------|--------------------------------------------------|
| POST   | `/wallet/from-mnemonic`   | Derive Kaspa address from BIP39 mnemonic          |
| GET    | `/wallet/balance/:addr`   | Fetch UTXO balance for an address via Kaspa RPC   |
| POST   | `/escrow/create`          | Construct P2SH escrow address for two pubkeys     |
| POST   | `/escrow/payout`          | Build and sign payout tx to winner address         |
| POST   | `/escrow/cancel`          | Build and sign refund tx (both parties agree)      |
| GET    | `/blockdag/live`          | Stream recent block headers                        |
| POST   | `/tx/broadcast`           | Broadcast a raw transaction                        |
| GET    | `/health`                 | Health check                                       |

All stub endpoints currently return:
```json
{"status": "not_implemented", "endpoint": "..."}
```

The `/health` endpoint returns:
```json
{"status": "ok", "version": "0.1.0"}
```

## Build and Run

```bash
# Build
cargo build

# Run (listens on port 3000)
cargo run

# Test health endpoint
curl http://localhost:3000/health
```

## Planned Kaspa SDK Integration

The following Kaspa Rust SDK crates will be added once the build environment is configured:

- **kaspa-rpc-client** — gRPC client for communicating with kaspad
- **kaspa-wallet-core** — HD wallet derivation, key management, transaction signing
- **kaspa-consensus-core** — Transaction and UTXO types
- **kaspa-txscript** — Script building for P2SH escrow contracts
- **kaspa-bip32** — BIP32/BIP39 mnemonic and key derivation

These crates require the Kaspa Rust SDK which has specific build requirements (protobuf compiler, etc.). They will be integrated in a follow-up workstream.
