# HTP Deployment Guide

## Architecture
```
Browser (Firebase)──→ HTTPS ──→ nginx (Hetzner) ──→ server.js :3333
                                                     │
                                                     ├── Rust signer (/root/htp-signer)
                                                     ├── TN12 via REST (api-tn12.kaspa.org)
                                                     └── WebSocket /ws
```

## Quick Deploy

### 1. Hetzner Server
```bash
ssh root@178.105.76.81
cd /root/htp
git pull origin main
cargo build --release --manifest-path /root/htp-signer/Cargo.toml
pm2 restart htp-backend
```

### 2. Firebase Frontend
```bash
cd /root/htp
firebase deploy --only hosting
```
Live at: https://hightable420.web.app

### 3. Verify
```bash
curl -sk https://localhost/api/health
curl -sk https://hightable420.web.app
```

## Environment
- `.env` on server: `KASPA_REST_URL`, `PORT=3333`, `HTP_WS_HOST`
- Server wallet: `/root/htp/.e2e-wallet.json`
- Rust signer: `/root/htp-signer/target/release/htp-signer`

## Key Dependencies
- Node.js 20+
- Rust (for secp256k1 signer)
- pm2 (process manager)
- nginx + Let's Encrypt
