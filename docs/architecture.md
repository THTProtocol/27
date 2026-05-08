# High Table Protocol — Architecture

## Overview

High Table Protocol is composed of three runtime services, a static frontend, and a shared SQLite database — all running on a single Hetzner VPS (CPX32, Falkenstein DE).

```
hightable.pro  (Nginx TLS termination)
    ├── /              →  static SPA  (public/)
    ├── /api/*         →  htp-server  :3000  (Rust/Axum)
    ├── /api/orders/*  →  htp-orders  :3001  (Node.js)
    └── /ws           →  htp-server  :3000  (WebSocket)
```

## Services

### htp-server (Rust · Axum · PM2)

The core backend. Handles:
- Skill game session lifecycle (create · join · move · settle)
- Oracle network (operator registration · attestation · quorum)
- Information market management (create · allocate · resolve)
- WebSocket relay for real-time move fan-out
- Arbiter key signing for settlement transactions

Source: `crates/htp-server/src/`

### htp-orders (Node.js · Express · PM2)

Lightweight order book service. Handles:
- Open order posting and cancellation
- Order matching → creates game session in htp-server
- Volume and open interest statistics

Source: `orders-api.js`

### Nginx

- TLS termination via Let's Encrypt
- Serves `public/` as static SPA with `try_files` fallback
- Proxies `/api/orders/` to `:3001` (more specific, matched first)
- Proxies `/api/` and `/ws` to `:3000`

Config reference: `nginx.conf`

## Database Schema

All state is stored in SQLite at `/root/htp/data/htp.db`.

| Table | Purpose |
|---|---|
| `games` | Skill game sessions, moves, status |
| `players` | Participant metadata |
| `settlements` | Settlement transaction records |
| `htp_events` | Information market definitions |
| `htp_attestations` | Oracle attestation records |
| `htp_operators` | Bonded oracle operator registry |
| `orders` | Open order book entries |
| `schema_migrations` | Migration version tracking |

## Frontend

Vanilla JS single-page application. No framework. All network calls routed through `window.HTP_CONFIG.API_ORIGIN` — a single toggle to switch between TN12 testnet and mainnet.

Key modules:

| File | Purpose |
|---|---|
| `htp-config.js` | Network endpoints, environment config |
| `htp-router.js` | Screen router + 14 screen render functions |
| `htp-covenant-escrow-v2.js` | Covenant UTXO builder |
| `htp-escrow-derive.js` | Deterministic escrow key derivation (WASM) |
| `app.js` | WebSocket client + connection management |
| `kaspa-wasm-sdk/` | rusty-kaspa WASM bindings |

## Settlement Flow

```
1. participant_a calls POST /api/games  →  session created, escrow key derived
2. participant_b calls POST /api/games/:id/join  →  escrow UTXO broadcast to Kaspa
3. participants submit moves via POST /api/games/:id/move
4. game engine detects terminal state (win / draw / timeout)
5. htp-server signs settlement tx with arbiter key
6. settlement tx broadcast to Kaspa network
7. winner's wallet receives stake minus 2% fee
```

## Oracle Resolution Flow

```
1. market creator calls POST /api/events with resolution condition + deadline
2. bonded operators independently verify the outcome
3. each operator calls POST /api/events/:id/attest
4. when count(matching attestations) >= quorum_m → market finalised
5. htp-settler daemon calls settlement endpoint automatically
```
