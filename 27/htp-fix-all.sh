#!/bin/bash
set -e
cd /workspaces/27/27

echo "[0/6] Restoring index.html from last good commit..."
# The good index.html is in commit 26c43ee (Initial commit, 2.2MB)
git show 26c43ee:27/index.html > index.html
SIZE=$(wc -c < index.html)
echo "  Restored: $SIZE bytes"
if [ "$SIZE" -lt 1000000 ]; then
  echo "  ERROR: index.html too small ($SIZE bytes) — restore failed"
  exit 1
fi

echo "[1/6] Removing 404 ghost script tags..."
sed -i '/<script src="\/wasm-bridge.js"><\/script>/d' index.html
sed -i '/<script src="\/multiplayer.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-maximizer-patch.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-patches-8.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-p01-p06.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-p07-p09.js"><\/script>/d' index.html
echo "  Ghost tags removed."

echo "[2/6] Injecting missing modules before </body>..."
# Append 7 script tags right after htp-oracle-sync.js
python3 - << 'PYEOF'
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

old = '<script src="htp-oracle-sync.js"></script>'
new = '''<script src="htp-oracle-sync.js"></script>
<script src="htp-rpc-client.js"></script>
<script src="htp-settlement-overlay.js"></script>
<script src="htp-cancel-flow.js"></script>
<script src="htp-events-v3.js"></script>
<script src="htp-event-creator.js"></script>
<script src="htp-autopayout-engine.js"></script>
<script src="htp-nav-v4.js"></script>'''

if old in html:
    html = html.replace(old, new, 1)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('  Injection OK')
else:
    print('  ERROR: htp-oracle-sync.js tag not found — check index.html content')
    import sys; sys.exit(1)
PYEOF

echo "[3/6] Verifying..."
OK=1
for tag in htp-rpc-client htp-settlement-overlay htp-cancel-flow htp-events-v3 htp-event-creator htp-autopayout-engine htp-nav-v4; do
  grep -q "$tag" index.html && echo "  OK $tag" || { echo "  MISSING: $tag"; OK=0; }
done
for ghost in wasm-bridge htp-maximizer-patch htp-patches-8 htp-p01-p06 htp-p07-p09; do
  grep -q "/$ghost" index.html && { echo "  STILL PRESENT: $ghost"; OK=0; } || echo "  removed: $ghost"
done
if [ "$OK" -eq 0 ]; then
  echo "  Verification FAILED. Aborting."
  exit 1
fi
echo "  All checks passed."

echo "[4/6] Committing..."
git add index.html
git commit -m "fix: restore index.html, remove 6 dead 404 scripts, inject 7 missing modules"

echo "[5/6] Pushing..."
git push origin main

echo "[6/6] Deploying to Firebase..."
cd /workspaces/27
firebase deploy --only hosting

echo ""
echo "DONE. Live at https://hightable420.web.app"
