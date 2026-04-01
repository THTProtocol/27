#!/bin/bash
set -e
cd /workspaces/27/27

echo "[1/5] Removing 404 ghost script tags..."
sed -i '/<script src="\/wasm-bridge.js"><\/script>/d' index.html
sed -i '/<script src="\/multiplayer.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-maximizer-patch.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-patches-8.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-p01-p06.js"><\/script>/d' index.html
sed -i '/<script src="\/htp-p07-p09.js"><\/script>/d' index.html

echo "[2/5] Injecting missing modules before </body>..."
sed -i 's|<script src="htp-oracle-sync.js"></script>|<script src="htp-oracle-sync.js"></script>\n<script src="htp-rpc-client.js"></script>\n<script src="htp-settlement-overlay.js"></script>\n<script src="htp-cancel-flow.js"></script>\n<script src="htp-events-v3.js"></script>\n<script src="htp-event-creator.js"></script>\n<script src="htp-autopayout-engine.js"></script>\n<script src="htp-nav-v4.js"></script>|' index.html

echo "[3/5] Verifying..."
for tag in htp-rpc-client htp-settlement-overlay htp-cancel-flow htp-events-v3 htp-event-creator htp-autopayout-engine htp-nav-v4; do
  grep -q "$tag" index.html && echo "  checkmark $tag" || echo "  X MISSING: $tag"
done
for ghost in wasm-bridge htp-maximizer-patch htp-patches-8 htp-p01-p06 htp-p07-p09; do
  grep -q "/$ghost" index.html && echo "  X STILL PRESENT: $ghost" || echo "  checkmark removed: $ghost"
done

echo "[4/5] Committing..."
git add index.html
git commit -m "fix: remove 6 dead 404 scripts, inject 7 missing modules, correct load order"
git push origin main

echo "[5/5] Deploying to Firebase..."
firebase deploy --only hosting

echo "DONE. Visit https://hightable420.web.app"
