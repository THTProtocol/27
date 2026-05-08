# Contributing to High Table Protocol

Thanks for your interest in contributing!

## How to Contribute

1. **Find or create an issue** — check the [issues page](https://github.com/THTProtocol/27/issues)
2. **Fork the repo** and create a feature branch
3. **Write code** following the conventions below
4. **Open a PR** against `main` — include a clear description
5. **Wait for review** — at least one maintainer must approve

## Code Conventions

### Rust
- `cargo fmt` before committing
- `cargo clippy` — zero warnings
- No `unsafe` without explicit justification
- Tests for all new game engines

### Frontend (JS)
- No framework dependencies — vanilla JS only
- Keep files under 500 lines where possible
- Use `htp-` prefix for all new modules
- No external npm dependencies without maintainer approval

### Commit Messages
Follow conventional commits:
```
feat: add Connect 4 game engine
fix: resolve WebSocket reconnection race
docs: update API reference
chore: prune dead code
```

## What We Need

| Priority | Area |
|----------|------|
| 🔴 High | Security audit, fuzz testing, stress tests |
| 🟡 Medium | New game engines (Go, poker variants, etc.) |
| 🟢 Low | UI polish, mobile responsiveness, i18n |

## Development Setup

```bash
git clone https://github.com/THTProtocol/27.git
cd 27
# Rust backend
cargo build
# Frontend
cd public && python3 -m http.server 8080
```

## Questions?

Open a [GitHub Discussion](https://github.com/THTProtocol/27/discussions) or reach out to the maintainers.