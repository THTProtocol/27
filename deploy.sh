#!/usr/bin/env bash
# ============================================================
# HTP Deploy Script — Rust-dominant stack
# Builds Rust binary on Hetzner, deploys Firebase frontend
# ============================================================
set -euo pipefail

SERVER_IP="178.105.76.81"
SERVER_USER="root"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/hermes_key}"
REMOTE="${SERVER_USER}@${SERVER_IP}"
COMPOSE_FILE="docker-compose.yml"

echo "╔══════════════════════════════════════════════╗"
echo "║  HTP Deploy — Rust binary + Firebase static  ║"
echo "╚══════════════════════════════════════════════╝"

# ─── 1. Push code to Hetzner ─────────────────────────────────────────────
echo "[1/4] Syncing codebase to ${SERVER_IP}…"
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE}" \
    "cd /root/htp && git pull origin main"

# ─── 2. Build Rust binary on server ──────────────────────────────────────
echo "[2/4] Building Rust htp-server binary…"
ssh -i "${SSH_KEY}" "${REMOTE}" bash << 'ENDSSH'
    set -e
    cd /root/htp/crates
    # Install Rust if not present
    if ! command -v cargo &>/dev/null; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.88.0
        source $HOME/.cargo/env
    fi
    source $HOME/.cargo/env
    cargo build --release -p htp-server
    echo "[HTP] Binary built: $(ls -lh target/release/htp-server | awk '{print $5}')"
ENDSSH

# ─── 3. Restart service ──────────────────────────────────────────────────
echo "[3/4] Restarting htp-server service…"
ssh -i "${SSH_KEY}" "${REMOTE}" bash << 'ENDSSH'
    set -e
    # Kill old processes
    pkill -f 'htp-server' 2>/dev/null || true
    pkill -f 'node server' 2>/dev/null || true
    sleep 1
    cd /root/htp
    # Start Rust binary as systemd-lite via nohup
    nohup ./crates/target/release/htp-server \
        > /var/log/htp-server.log 2>&1 &
    sleep 2
    # Verify it started
    if pgrep -f htp-server; then
        echo "[HTP] htp-server running (PID $(pgrep -f htp-server))"
        curl -sf http://localhost:3000/health && echo " ← health OK"
    else
        echo "[ERROR] htp-server failed to start — check /var/log/htp-server.log"
        tail -20 /var/log/htp-server.log
        exit 1
    fi
ENDSSH

# ─── 4. Firebase frontend deploy ─────────────────────────────────────────
echo "[4/4] Deploying Firebase frontend…"
if command -v firebase &>/dev/null; then
    firebase deploy --only hosting --non-interactive
    echo "[HTP] Firebase deploy complete"
else
    echo "[WARN] firebase CLI not found — skipping hosting deploy"
    echo "       Run: firebase deploy --only hosting"
fi

echo ""
echo "✅ Deploy complete"
echo "   API:      https://${SERVER_IP}:3000"
echo "   Health:   https://${SERVER_IP}:3000/health"
echo "   Frontend: https://hightable420.web.app"
