# htp-daemon

**High Table Protocol — Kaspa settlement + oracle daemon (Rust)**

This replaces `oracle-daemon.js` and `watcher.js` entirely. All Kaspa chain operations — TX construction, signing, submission, UTXO watching, DAA deadline enforcement, and oracle attestation signing — happen here in Rust.

## Architecture

```
Browser (JS)                  Firebase (message bus)         htp-daemon (Rust)
─────────────────────────   ───────────────────────   ──────────────────────
 KasWare wallet connect        matches/{id}                    polls every 5s
 Game engine (chess etc.)      │status, winner, deadlineDaa   reads completed matches
 Match creation UI   ────────┘                               builds + signs TX
 Display settlement results                                    submits to Kaspa
 Countdown timer (DAA only)   settlement/{id}/claimed ←───    writes txId back
                               daemon/heartbeat   ←────────    heartbeat write
                               attestations/{id}/{addr}←───   oracle attestations
```

## Source layout

```
src/
  main.rs         — entry point, poll loop, wires all modules
  types.rs        — shared types, fee constants, Firebase data shapes
  kaspa.rs        — UTXO fetch, TX build, secp256k1 signing, TX submit
  firebase.rs     — Firebase REST client (JWT auth)
  settlement.rs   — skill game + event fee math + TX execution
  oracle.rs       — external API resolvers (CoinGecko, DAA, OpenLigaDB) + attestation
  deadline.rs     — DAA score deadline registry, fires timeout settlements
```

## Setup

```bash
cd htp-daemon
cp .env.example .env
# Fill in .env:
#   KASPA_NETWORK=tn12
#   FIREBASE_DB_URL=https://hightable-76401-default-rtdb.europe-west1.firebasedatabase.app
#   FIREBASE_SERVICE_KEY_PATH=./serviceAccountKey.json
#   ORACLE_PRIVATE_KEY=<32-byte hex>
cargo build --release
./target/release/htp-daemon
```

## Escrow key management

Escrow private keys are **never stored in Firebase**. They live in `./escrow-keys.json`:

```json
{ "matchId-abc": "<32-byte-hex-privkey>" }
```

When the browser creates an escrow for a new match, it must:
1. Generate a keypair client-side (WASM or KasWare).
2. POST the private key to a secured endpoint that adds it to `escrow-keys.json`.
3. Store only the **public** escrow address in Firebase.

The daemon reads the private key from disk when settling.

## Firebase auth note

The `firebase.rs` JWT minting requires the `rsa` crate for RS256 signing.
During development you can set `FIREBASE_AUTH_SECRET` (legacy database secret)
and use it directly as the `?auth=` token — skip the JWT path entirely.

For production: add `rsa = "0.9"` and `pkcs8 = "0.10"` to Cargo.toml and
implement the RS256 sign step in `firebase.rs::mint_jwt()`.

## What the JS layer keeps

| Component | Stays JS | Reason |
|---|---|---|
| KasWare wallet connection | ✓ | Browser extension API |
| Game engine (chess/checkers/C4) | ✓ | DOM + real-time sync |
| Firebase reads + UI rendering | ✓ | Display only |
| `htp-match-deadline.js` | ✓ | UI countdown display only |
| Match creation (escrow address) | ✓ | Writes intent to Firebase |
| TX construction | ✘ | Daemon only |
| TX signing | ✘ | Daemon only |
| TX submission | ✘ | Daemon only |
| Oracle attestation signing | ✘ | Daemon only |
| DAA deadline enforcement | ✘ | Daemon only |

## Roadmap: replacing Firebase

Firebase is the current message bus. The daemon is already isolated from it:
all Firebase reads/writes go through `firebase.rs`. When you're ready to
replace Firebase:

1. Implement a `pubsub.rs` with a Kaspa OP_RETURN-based message bus, or
2. Replace `firebase.rs` with a WebSocket server that the browser connects to directly.

No other files change.
