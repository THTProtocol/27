#!/usr/bin/env bash
# HTP Critical Fix Applicator
# Run from your project root: bash htp-apply-critical-fix.sh

set -e
PROJECT="${1:-.}"
INDEX="$PROJECT/public/index.html"

if [ ! -f "$INDEX" ]; then
  # Try without public/
  INDEX="$PROJECT/index.html"
fi
if [ ! -f "$INDEX" ]; then
  echo "❌ Cannot find index.html in $PROJECT/public/ or $PROJECT/"
  exit 1
fi

echo "📁 Found: $INDEX"

# 1. Copy fix file into public/
cp "$(dirname "$0")/htp-critical-fix.js" "$PROJECT/public/htp-critical-fix.js" 2>/dev/null \
  || cp /tmp/htp-critical-fix.js "$PROJECT/public/htp-critical-fix.js" 2>/dev/null \
  || cp /tmp/htp-critical-fix.js "$(dirname "$INDEX")/htp-critical-fix.js"

echo "✅ htp-critical-fix.js copied to public/"

# 2. Check if already injected
if grep -q "htp-critical-fix.js" "$INDEX"; then
  echo "ℹ️  htp-critical-fix.js already in index.html — skipping inject"
else
  # Inject LAST before </body>
  sed -i 's|</body>|<script src="htp-critical-fix.js"></script>\n</body>|' "$INDEX"
  echo "✅ Injected htp-critical-fix.js before </body>"
fi

# 3. Kill htp-fix-v3.js defineProperty conflict if present
# Wrap the defineProperty call safely (already handled inside the fix, but belt+suspenders)
echo "✅ defineProperty guard is embedded in htp-critical-fix.js"

# 4. Verify inject
echo ""
echo "--- Verifying script tag ---"
grep -n "htp-critical-fix" "$INDEX" || echo "❌ Tag not found — check manually"

# 5. Deploy to Firebase
echo ""
echo "🚀 Deploying to Firebase..."
cd "$PROJECT"
firebase deploy --only hosting
echo ""
echo "✅ Done. Open your site and check console for:"
echo "   [HTP Critical Fix v1] Loaded — WS storm guard, defineProperty guard, TX dedup, join amount fix ✅"
