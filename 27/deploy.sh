#!/usr/bin/env bash
# deploy.sh — HTP Deploy Script (fixed for flat /27 root layout)
set -e
PROJECT="hightable420"
TARGET="${1:-hosting}"
BASE="$(cd "$(dirname "$0")" && pwd)"

echo "━━━ HTP Antigravity Deploy ━━━"
echo "Project : $PROJECT"
echo "Target  : $TARGET"
echo ""

# Lint all JS files in project root (not src/)
echo "→ Linting JS files in root..."
LINT_FAIL=0
for f in "$BASE"/htp-*.js "$BASE"/wasm-bridge.js "$BASE"/firebase-config.js "$BASE"/dag-background.js; do
  [ -f "$f" ] || continue
  fname="$(basename "$f")"
  if node --check "$f" 2>/dev/null; then
    echo "  ✓ $fname"
  else
    echo "  ✗ BROKEN: $fname"
    node --check "$f" 2>&1 | head -3 | sed 's/^/    /'
    LINT_FAIL=1
  fi
done
[ $LINT_FAIL -eq 1 ] && echo "Lint failed — aborting." && exit 1

# Check for dead script tags in index.html
if [ -f "$BASE/index.html" ]; then
  echo "→ Checking for dead <script> tags..."
  MISSING=0
  while IFS= read -r f; do
    [[ "$f" == http* ]] && continue
    [ ! -f "$BASE/$f" ] && echo "  ✗ DEAD TAG: $f" && MISSING=1
  done < <(grep -oP '(?<=src=")[^"]+\.js(?=")' "$BASE/index.html" 2>/dev/null)
  [ $MISSING -eq 1 ] && echo "Dead tags found — fix before deploying." && exit 1
  echo "  ✓ All script tags resolve"
fi

# Set Firebase project and deploy
firebase use "$PROJECT"
case "$TARGET" in
  hosting)
    firebase deploy --only hosting,database
    ;;
  functions)
    (cd "$BASE/functions" && npm install && node test-oracle.js)
    firebase deploy --only functions
    ;;
  all)
    (cd "$BASE/functions" && npm install && node test-oracle.js)
    firebase deploy --only hosting,database,functions
    ;;
  *)
    echo "Usage: bash deploy.sh [hosting|functions|all]"
    exit 1
    ;;
esac

echo ""
echo "✓ Deploy complete → https://hightable420.web.app"
