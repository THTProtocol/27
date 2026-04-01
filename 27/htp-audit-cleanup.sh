#!/usr/bin/env bash
# ============================================================
# htp-audit-cleanup.sh — HTP Project Audit + Cleanup
# Run from your /27 project root:
#   cd /mnt/c/Users/User/Desktop/27
#   bash htp-audit-cleanup.sh
# ============================================================

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0; WARN=0

green()  { echo -e "\033[32m  ✓ $*\033[0m"; ((PASS++)); }
red()    { echo -e "\033[31m  ✗ $*\033[0m"; ((FAIL++)); }
yellow() { echo -e "\033[33m  ⚠ $*\033[0m"; ((WARN++)); }
header() { echo -e "\n\033[36m━━━ $* ━━━\033[0m"; }

# ─── 1. Required files ────────────────────────────────────────
header "1. REQUIRED FILES"

for f in index.html firebase.json database.rules.json firebase-config.js \
         htp-utxo-mutex.js htp-covenant-escrow-v2.js htp-board-engine.js \
         htp-board-engine-fix.js htp-chess-ui.js htp-events-v3.js \
         htp-fee-engine.js htp-games-sync.js htp-chess-sync.js \
         htp-init.js wasm-bridge.js kaspa/kaspa.js; do
  [ -f "$BASE/$f" ] && green "$f" || red "$f MISSING"
done

for f in htp-oracle-daemon/watcher.js htp-oracle-daemon/.env \
         htp-oracle-daemon/package.json; do
  [ -f "$BASE/$f" ] && green "$f" || red "$f MISSING"
done

for f in functions/htp-oracle-server.js functions/test-oracle.js functions/package.json; do
  [ -f "$BASE/$f" ] && green "$f" || yellow "$f (needed for Blaze — skip if not on Blaze yet)"
done

# ─── 2. Delete dead files ─────────────────────────────────────
header "2. CLEANUP — DELETING DEAD FILES"

DEAD=(
  htp-fix-deploy.sh htp-deploy-fix2.sh htp-fix2-deploy.sh htp-fix3-deploy.sh
  htp-sync-deploy.sh htp-games-sync-deploy.sh htp-visual-deploy.sh
  htp-critical-deploy.sh htp-critical-fix.js deploy-board-engine.sh
  htp-board-engine-fix2.js htp-wasm-bridge-fix.js "htp-wasm-bridge-fix-2.js"
  htp-p01-p06.js htp-p07-p09.js htp-patches-8.js htp-fix-v4.js
  htp-game-fix.js htp-master-fix.js htp-master-deploy.sh
  htp-ui-v2.js htp-balance-pill-v2.js htp-balance-pill.js
  htp-bal-reader.js htp-bal-shield.js htp-wallet-pill.js
  htp-trustless-v2.js htp-settlement-daemon.js
  htp-covenant-fingerprint.js htp-covenant-patch.js
  htp-maximizer-patch.js htp-oracle-hardening.js
  runtime-audit.js fix-direct.py fix-syntax-errors.py
  nuke-ghost-matches.js cleanup-firebase-matches.js
  "htp-utxo-mutex (1).js"
  index.html.bak-chess index.html.bak-critical index.html.bak-visual
  "index.html.bak2" "index.html.bak3" "index.html.bak"
)

DELETED=0
for f in "${DEAD[@]}"; do
  fp="$BASE/$f"
  if [ -f "$fp" ]; then
    rm -f "$fp"
    echo -e "  \033[33m  🗑 Deleted: $f\033[0m"
    ((DELETED++))
  fi
done
echo "  → Removed $DELETED dead files"

# ─── 3. Script load order ─────────────────────────────────────
header "3. INDEX.HTML LOAD ORDER"

HTML="$BASE/index.html"
if [ ! -f "$HTML" ]; then
  red "index.html not found"
else
  line_of() {
    grep -n "src=[\"']$1[\"']" "$HTML" 2>/dev/null | head -1 | cut -d: -f1
  }
  check_order() {
    local A="$1" B="$2"
    local LA LB
    LA=$(line_of "$A"); LB=$(line_of "$B")
    if [ -z "$LA" ]; then yellow "$A not in index.html"
    elif [ -z "$LB" ]; then yellow "$B not in index.html"
    elif [ "$LA" -lt "$LB" ]; then green "$A (line $LA) → $B (line $LB)"
    else red "ORDER WRONG: $A must load before $B"
    fi
  }

  check_order "htp-utxo-mutex.js"       "htp-covenant-escrow-v2.js"
  check_order "htp-board-engine.js"      "htp-board-engine-fix.js"
  check_order "wasm-bridge.js"           "htp-utxo-mutex.js"
  check_order "firebase-config.js"       "htp-events-v3.js"
  check_order "htp-events-v3.js"         "htp-chess-sync.js"
  check_order "htp-chess-sync.js"        "htp-games-sync.js"

  # Dead script tags
  DEAD_TAGS=0
  while IFS= read -r src; do
    [[ "$src" == http* ]] && continue
    [ ! -f "$BASE/$src" ] && red "Dead tag: src=\"$src\"" && ((DEAD_TAGS++))
  done < <(grep -oP '(?<=src=")[^"]+\.js(?=")' "$HTML" 2>/dev/null)
  [ "$DEAD_TAGS" -eq 0 ] && green "No dead script tags"
fi

# ─── 4. JS syntax check ───────────────────────────────────────
header "4. JS SYNTAX"

SYNTAX_FAIL=0
for f in "$BASE"/htp-*.js "$BASE"/wasm-bridge.js "$BASE"/firebase-config.js "$BASE"/dag-background.js "$BASE"/multiplayer.js; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"
  if node --check "$f" 2>/dev/null; then
    green "$fname"
  else
    red "$fname SYNTAX ERROR"
    node --check "$f" 2>&1 | head -3 | sed 's/^/    /'
    ((SYNTAX_FAIL++))
  fi
done

# ─── 5. .env check ────────────────────────────────────────────
header "5. DAEMON .ENV"

ENV="$BASE/htp-oracle-daemon/.env"
if [ ! -f "$ENV" ]; then
  red ".env missing — copy from .env.example and fill in FIREBASE_DB_URL"
else
  grep -q "FIREBASE_DB_URL" "$ENV" && \
    green "FIREBASE_DB_URL present: $(grep FIREBASE_DB_URL "$ENV" | cut -d= -f2)" || \
    red "FIREBASE_DB_URL not set in .env"
fi

# ─── 6. Oracle tests ──────────────────────────────────────────
header "6. ORACLE TESTS"

if [ -f "$BASE/functions/test-oracle.js" ]; then
  (cd "$BASE/functions" && npm install --silent 2>/dev/null; node test-oracle.js 2>&1)
  [ $? -eq 0 ] && green "All oracle tests passed" || red "Oracle tests FAILED"
else
  yellow "functions/test-oracle.js not found — skipping"
fi

# ─── 7. Watcher structure ─────────────────────────────────────
header "7. WATCHER.JS CHECK"

WJS="$BASE/htp-oracle-daemon/watcher.js"
if [ -f "$WJS" ]; then
  node -e "
    const s = require('fs').readFileSync('$WJS','utf8');
    ['dotenv','firebase-admin','FIREBASE_DB_URL','HTP Settlement Watcher v'].forEach(k => {
      process.stdout.write(s.includes(k) ? '  \u2713 '+k+'\n' : '  \u2717 MISSING: '+k+'\n');
    });
  "
  grep -q "HTP Settlement Watcher v" "$WJS" && green "watcher.js is v2.1 (correct version)" || red "watcher.js is OLD version — replace it!"
else
  red "watcher.js not found"
fi

# ─── 8. Firebase project ──────────────────────────────────────
header "8. FIREBASE"

if [ -f "$BASE/.firebaserc" ]; then
  P=$(grep -oP '"default"\s*:\s*"\K[^"]+' "$BASE/.firebaserc" 2>/dev/null || echo "unknown")
  green "Active project: $P"
else
  red ".firebaserc not found"
fi

# ─── Summary ──────────────────────────────────────────────────
echo -e "\n\033[36m━━━ SUMMARY ━━━\033[0m"
echo -e "  \033[32mPASS: $PASS\033[0m  \033[31mFAIL: $FAIL\033[0m  \033[33mWARN: $WARN\033[0m\n"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  \033[31m⚠ Fix the failures above, then run: bash deploy.sh hosting\033[0m"
  exit 1
else
  echo -e "  \033[32m✓ All checks passed — run: bash deploy.sh hosting\033[0m"
fi
