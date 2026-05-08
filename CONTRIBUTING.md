# Contributing to High Table Protocol

Thank you for your interest in contributing to HTP. This document covers everything you need to get started.

## Code of Conduct

Be direct, honest, and respectful. Assume good faith. Don't waste people's time.

## Development Setup

See [README.md](README.md#development-setup) for full setup instructions.

Quick start:
```bash
git clone https://github.com/THTProtocol/27.git htp
cd htp
cp .env.example .env
cd crates && cargo build
```

## How to Contribute

### Bugs

1. Check existing issues first
2. Open an issue with: reproduction steps, expected vs actual behavior, OS + Rust version
3. For security issues, see [SECURITY.md](SECURITY.md) — do NOT open public issues

### Features

1. Open an issue describing the feature and why it fits HTP's goals
2. Wait for feedback before building — this prevents wasted effort
3. Fork, build, test, PR

### Pull Requests

**Before submitting:**

```bash
# Rust
cargo fmt
cargo clippy -- -D warnings
cargo test

# JavaScript (frontend)
node --check public/htp-router.js
```

**PR checklist:**
- [ ] `cargo fmt` applied
- [ ] No new `clippy` warnings
- [ ] Tests added/updated for new routes or logic
- [ ] `docs/` updated if API surface changed
- [ ] No secrets or credentials committed
- [ ] Single logical change per PR

## Crate Ownership

| Crate | Owner | Description |
|-------|-------|-------------|
| `htp-server` | core team | Axum routes, server config |
| `htp-core` | core team | Protocol types, UTXO logic |
| `htp-games` | open | Game engines |
| `htp-oracle` | core team | Oracle system |
| `htp-wallet` | core team | Kaspa wallet integration |
| `htp-wasm` | open | Browser WASM bindings |

## Adding a Game Type

1. Add variant to `GameType` enum in `htp-core/src/types.rs`
2. Implement `GameEngine` trait in `htp-games/src/<game>.rs`
3. Add route handler in `htp-server/src/routes.rs`
4. Add frontend screen in `public/htp-router.js`
5. Add integration test in `tests/`
6. Document in `docs/games/<game>.md`

## Commit Style

```
type(scope): short description

feat(oracle): add zk proof verification
fix(maximizer): reject bets above pool cap
docs(api): add settler endpoint reference
refactor(games): extract shared payout logic
test(oracle): add quorum edge case tests
```

## Questions

Open a GitHub Discussion or reach out via the contact in SECURITY.md.
