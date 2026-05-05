# ── Stage 1: Rust builder ────────────────────────────────────────────────
FROM rust:1.88-slim AS builder
WORKDIR /build

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY crates/Cargo.toml crates/Cargo.lock ./
COPY crates/htp-server/Cargo.toml        htp-server/Cargo.toml
COPY crates/htp-games/Cargo.toml         htp-games/Cargo.toml
COPY crates/htp-daemon/Cargo.toml        htp-daemon/Cargo.toml
COPY crates/kaspa-tn12-sighash/Cargo.toml kaspa-tn12-sighash/Cargo.toml
COPY crates/mirofish-bridge/Cargo.toml   mirofish-bridge/Cargo.toml
# Dummy src to allow dep caching
RUN mkdir -p htp-server/src htp-games/src htp-daemon/src kaspa-tn12-sighash/src mirofish-bridge/src \
    && echo 'fn main(){}' > htp-server/src/main.rs \
    && echo 'fn main(){}' > htp-daemon/src/main.rs \
    && touch htp-games/src/lib.rs kaspa-tn12-sighash/src/lib.rs mirofish-bridge/src/lib.rs
RUN cargo build --release -p htp-server 2>/dev/null || true

# Full source
COPY crates/ .
RUN cargo build --release -p htp-server

# ── Stage 2: Minimal runtime ─────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/htp-server /app/htp-server
COPY public/ /app/public/
EXPOSE 3000
ENTRYPOINT ["/app/htp-server"]
