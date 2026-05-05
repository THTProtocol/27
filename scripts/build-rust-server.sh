#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../crates/htp-server"
cargo build --release
echo "[HTP] Rust server built: target/release/htp-server"
