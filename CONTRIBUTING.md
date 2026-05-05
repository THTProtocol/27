# Contributing to High Table Protocol

## Branches
- `main` — production/testnet deployment
- `develop` — integration branch
- `feat/*` — feature branches

## Rust code
- Run `cargo fmt` before committing
- All new modules require unit tests
- Use `tracing::` not `println!`

## JavaScript code
- Validate with `acorn --ecma2020`
- New modules must register to `window.HTP_*` namespace
- Config values from `window.HTP_CONFIG` only

## Commit convention
`type(scope): description`
Types: feat, fix, chore, docs, refactor, test
