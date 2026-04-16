# Build stage
FROM rust:1.77-slim AS builder
WORKDIR /app

# Cache deps first (layer caching trick)
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

# Build real source
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Runtime stage - minimal image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/htp-backend /usr/local/bin/htp-backend

ENV PORT=8080
EXPOSE 8080
CMD ["htp-backend"]
