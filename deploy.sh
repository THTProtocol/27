#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════
# HIGH TABLE PROTOCOL v8.0 — Deployment Script
# ══════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   HIGH TABLE PROTOCOL v8.0 — Deploy          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 1. Check Prerequisites ──────────────────────────────
info "Checking prerequisites..."

command -v node >/dev/null 2>&1 || { err "Node.js not found. Install Node 18+."; exit 1; }
NODE_VER=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  err "Node.js $NODE_VER found, need 18+."
  exit 1
fi
log "Node.js $(node -v)"

command -v npm >/dev/null 2>&1 || { err "npm not found."; exit 1; }
log "npm $(npm -v)"

# ─── 2. Install Dependencies ─────────────────────────────
info "Installing dependencies..."
npm install --production 2>&1 | tail -1
log "Dependencies installed"

# ─── 3. Create Data Directory ────────────────────────────
mkdir -p data
log "Data directory ready"

# ─── 4. Validate .env ────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found, using defaults"
  cp .env.example .env 2>/dev/null || true
else
  log ".env loaded"
fi

# ─── 5. Run Tests ────────────────────────────────────────
info "Running test suite..."
if node tests/run-all.js; then
  log "All tests passed"
else
  warn "Some tests failed — review above"
  read -p "Continue deployment anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    err "Deployment aborted."
    exit 1
  fi
fi

# ─── 6. Check Kaspa Node ─────────────────────────────────
info "Checking Kaspa node connection..."
KASPA_URL="${KASPA_WRPC_URL:-ws://127.0.0.1:17210}"
if command -v wscat >/dev/null 2>&1; then
  if echo '{"id":1,"method":"getServerInfo","params":{}}' | timeout 5 wscat -c "$KASPA_URL" -w 3 2>/dev/null; then
    log "Kaspa node reachable at $KASPA_URL"
  else
    warn "Cannot reach Kaspa node at $KASPA_URL"
    warn "Server will run in offline mode (queued operations)"
  fi
else
  warn "wscat not installed — skipping node check"
  warn "Install with: npm i -g wscat"
fi

# ─── 7. Mode Selection ───────────────────────────────────
echo ""
info "Select deployment mode:"
echo "  1) Direct (node server.js)"
echo "  2) Docker Compose (full stack)"
echo "  3) Docker Compose (app only, external node)"
echo ""
read -p "Choice [1/2/3]: " -n 1 -r MODE
echo ""

case $MODE in
  2)
    info "Starting full Docker stack..."
    command -v docker >/dev/null 2>&1 || { err "Docker not found."; exit 1; }
    command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || { err "Docker Compose not found."; exit 1; }
    docker compose up -d --build
    log "Stack running. UI at http://localhost"
    info "Kaspa node syncing at ws://localhost:17210"
    info "Logs: docker compose logs -f"
    ;;
  3)
    info "Starting app container (external node)..."
    docker compose up -d --build high-table nginx
    log "App running. UI at http://localhost"
    info "Connects to $KASPA_URL"
    ;;
  *)
    info "Starting server directly..."
    echo ""
    log "Server starting on http://localhost:${PORT:-3000}"
    echo ""
    exec node server.js
    ;;
esac

echo ""
log "Deployment complete!"
echo ""
echo "  📊 Dashboard:  http://localhost:${PORT:-3000}"
echo "  📡 API:        http://localhost:${PORT:-3000}/api/stats"
echo "  🔌 WebSocket:  ws://localhost:${PORT:-3000}/ws"
echo ""
