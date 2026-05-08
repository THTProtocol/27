# Contributing to High Table Protocol

Thank you for your interest in contributing to High Table Protocol — a trustless skill game and information market layer built on the Kaspa BlockDAG.

## How to Contribute

1. **Find or open an issue** — check the [issues page](https://github.com/THTProtocol/27/issues) first
2. **Fork the repo** and create a feature branch from `main`
3. **Write code** following the conventions below
4. **Open a pull request** — include a clear description of what changed and why
5. **Wait for review** — at least one maintainer approval required before merge

## Code Conventions

### Rust
- Run `cargo fmt` before committing
- Run `cargo clippy` — zero warnings policy
- No `unsafe` blocks without explicit justification in a comment
- Tests required for all new game engine logic
- Keep crates focused — `htp-games` for engines, `htp-server` for routing

### Frontend (JavaScript)
- Vanilla JS only — no framework dependencies
- All modules prefixed `htp-` (e.g. `htp-router.js`, `htp-config.js`)
- Keep individual files under 600 lines where possible; split if larger
- All network calls must use `window.HTP_CONFIG.API_ORIGIN` — no hardcoded URLs
- No external npm dependencies without maintainer approval

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Texas Hold'em game engine
fix: resolve WebSocket reconnection race condition
docs: update information markets API reference
chore: remove deprecated duckdns fallbacks
refactor: extract oracle quorum logic into oracle.rs
```

## Contribution Areas

| Priority | Area | Notes |
|---|---|---|
| 🔴 High | Security audit, fuzz testing | Escrow + oracle logic especially |
| 🔴 High | Texas Hold'em Rust port | Engine written in JS, needs `htp-games` crate |
| 🟡 Medium | Blackjack Rust port | Same — JS engine exists |
| 🟡 Medium | `htp-settler` daemon | Auto-settlement on oracle finality |
| 🟡 Medium | Oracle node client | Standalone operator binary |
| 🟢 Low | Mobile responsiveness | Frontend SPA polish |
| 🟢 Low | Documentation | Covenant design, API examples |

## Development Setup

```bash
git clone https://github.com/THTProtocol/27.git
cd 27

# Rust backend
cargo build -p htp-server
cargo test

# Frontend
cd public && python3 -m http.server 8080

# Order book service
node orders-api.js
```

See [README.md](README.md) for full environment configuration.

## Questions

Open a [GitHub Discussion](https://github.com/THTProtocol/27/discussions) or raise an issue tagged `question`.
