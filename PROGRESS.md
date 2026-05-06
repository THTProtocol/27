## PHASE 1: COMPLETE — 2026-05-06T17:34:01Z
- signing.rs rewritten: real Kaspa TN12 secp256k1 Schnorr via /root/htp-signer binary
- Loads privkey from .e2e-wallet.json (64-char hex, 33-byte compressed pubkey)
- Fetches UTXOs from api-tn12.kaspa.org, builds unsigned TX, calls htp-signer, submits
- reqwest workspace dep wired, cargo check 0 errors 37 warnings, build 9.56s release
- pm2 restart → health green
- SettleReq extended with winner_pubkey: Option<String>

## PHASE 2: COMPLETE — "2026-05-06T17:42:31Z"
- Workspace unified: 10 crates in /root/htp/crates/
- htp-settlement, htp-game-engine, htp-api moved from htp-core/ to crates/
- htp-daemon + mirofish-bridge excluded (missing kaspa-wasm dep)
- cargo check --workspace: 0 errors, 37 warnings (cosmetic)
- htp-server imports htp-games + htp-kaspa-rpc

