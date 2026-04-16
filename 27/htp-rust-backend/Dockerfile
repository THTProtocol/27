# Build stage
FROM rust:1.86-slim AS builder
WORKDIR /app

# Install build deps (needed by reqwest/rustls)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Cache deps layer
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

# Build real source
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/htp-backend /app/htp-backend

ENV PORT=3000
EXPOSE 3000
CMD ["/app/htp-backend"]
