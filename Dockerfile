# ── Stage 1: Rust builder ────────────────────────────────────────────────
FROM rust:1.88-slim AS builder
WORKDIR /build

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Cache dependencies — pre-copy all Cargo.toml files for all workspace members
COPY crates/Cargo.toml crates/Cargo.lock ./
COPY crates/htp-server/Cargo.toml         htp-server/Cargo.toml
COPY crates/htp-games/Cargo.toml          htp-games/Cargo.toml
COPY crates/htp-db/Cargo.toml             htp-db/Cargo.toml
COPY crates/htp-kaspa-rpc/Cargo.toml      htp-kaspa-rpc/Cargo.toml
COPY crates/htp-settlement/Cargo.toml     htp-settlement/Cargo.toml
COPY crates/htp-game-engine/Cargo.toml    htp-game-engine/Cargo.toml
COPY crates/htp-api/Cargo.toml            htp-api/Cargo.toml
COPY crates/htp-elo/Cargo.toml            htp-elo/Cargo.toml
COPY crates/htp-firebase-sync/Cargo.toml  htp-firebase-sync/Cargo.toml
COPY crates/kaspa-tn12-sighash/Cargo.toml kaspa-tn12-sighash/Cargo.toml

# Dummy src to allow dep caching
RUN mkdir -p htp-server/src htp-games/src htp-db/src htp-kaspa-rpc/src \
    htp-settlement/src htp-game-engine/src htp-api/src htp-elo/src \
    htp-firebase-sync/src kaspa-tn12-sighash/src \
    && for d in htp-server htp-games htp-db htp-kaspa-rpc htp-settlement \
               htp-game-engine htp-api htp-elo htp-firebase-sync kaspa-tn12-sighash; do \
         echo 'fn main(){}' > $d/src/main.rs 2>/dev/null; \
         touch $d/src/lib.rs 2>/dev/null; \
       done
RUN cargo build --release -p htp-server 2>/dev/null || true

# Full source
COPY crates/ ./
RUN cargo build --release -p htp-server

# ── Stage 2: Minimal runtime ─────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /build/target/release/htp-server /app/htp-server
COPY public/ /app/public/
EXPOSE 3000

# Railway injects PORT, override defaults for port + db path
ENV PORT=3000
ENV HTP_DB_PATH=/data/htp.db

CMD ["/app/htp-server"]
