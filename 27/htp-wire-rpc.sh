#!/usr/bin/env bash
# htp-wire-rpc.sh
# Wires Phase 1 RPC files into index.html and htp-oracle-daemon/watcher.js
# Run from /27: bash htp-wire-rpc.sh

BASE="$(cd "$(dirname "$0")" && pwd)"
HTML="$BASE/index.html"
WATCHER="$BASE/htp-oracle-daemon/watcher.js"

echo "━━━ HTP Phase 1 Wiring ━━━"

# ── 1. Inject htp-rpc-client.js and htp-init-rpc-patch.js into index.html ──
# They go AFTER wasm-bridge.js and BEFORE htp-init.js

python3 - << 'PYEOF'
import re, os, sys

BASE = os.getcwd()
HTML = os.path.join(BASE, 'index.html')
content = open(HTML, encoding='utf-8', errors='ignore').read()
original = content

INJECT_AFTER  = 'wasm-bridge.js'
NEW_SCRIPTS   = [
    'htp-rpc-client.js',
    'htp-init-rpc-patch.js',
]

def has_tag(c, f):
    return bool(re.search(rf'src=["\']/?{re.escape(f)}["\']', c))

def insert_after_tag(c, anchor, new_html):
    pattern = rf'(<script[^>]+src=["\']/?{re.escape(anchor)}["\'][^>]*>(?:</script>)?)'
    return re.sub(pattern, r'\1\n    ' + new_html, c, count=1)

injected = []
for script in NEW_SCRIPTS:
    if has_tag(content, script):
        print(f'  ✓ {script} already in index.html')
    else:
        tag = f'<script src="{script}"></script>'
        content = insert_after_tag(content, INJECT_AFTER, tag)
        # update anchor so next script goes after the previously inserted one
        INJECT_AFTER = script
        injected.append(script)
        print(f'  ✓ Injected {script}')

if injected:
    open(HTML, 'w', encoding='utf-8').write(content)
    print(f'\n  Saved index.html ({len(injected)} scripts added)')
else:
    print('\n  index.html unchanged')
PYEOF

# ── 2. Replace watcher.js with v3 ─────────────────────────────────────────
if [ -f "$BASE/watcher-v3.js" ]; then
  cp "$BASE/htp-oracle-daemon/watcher.js" "$BASE/htp-oracle-daemon/watcher.v2.bak.js"
  cp "$BASE/watcher-v3.js" "$BASE/htp-oracle-daemon/watcher.js"
  echo "  ✓ watcher.js upgraded to v3.0 (v2 backed up as watcher.v2.bak.js)"
else
  echo "  ⚠ watcher-v3.js not found — skipping daemon upgrade"
fi

# ── 3. Verify load order ──────────────────────────────────────────────────
echo ""
echo "Load order verification:"
python3 - << 'PYEOF'
import re, os
BASE = os.getcwd()
lines = open(os.path.join(BASE,'index.html'), encoding='utf-8', errors='ignore').read().split('\n')
def lof(f):
    for i,l in enumerate(lines):
        if f'src="{f}"' in l or f"src='/{f}'" in l: return i
    return -1
checks = [
    ("wasm-bridge.js",       "htp-rpc-client.js"),
    ("htp-rpc-client.js",    "htp-init-rpc-patch.js"),
    ("htp-init-rpc-patch.js","htp-init.js"),
    ("htp-utxo-mutex.js",    "htp-covenant-escrow-v2.js"),
    ("htp-board-engine.js",  "htp-board-engine-fix.js"),
]
for a,b in checks:
    la, lb = lof(a), lof(b)
    if la==-1: print(f'  ⚠ {a} not in index.html')
    elif lb==-1: print(f'  ⚠ {b} not in index.html')
    elif la<lb: print(f'  ✓ {a} → {b}')
    else: print(f'  ✗ ORDER WRONG: {a} after {b}')
PYEOF

echo ""
echo "Next steps:"
echo "  1. cp watcher-v3.js htp-oracle-daemon/watcher.js   (already done above)"
echo "  2. cd htp-oracle-daemon && npm install && node watcher.js"
echo "  3. bash deploy.sh hosting"
echo "  4. Open https://hightable420.web.app — watch browser console for:"
echo "     [HTPRpc] Connected to wss://... (mainnet)"
echo "     [HTP] Network: mainnet"
