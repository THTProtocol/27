#!/usr/bin/env python3
"""
htp-index-rewrite.py — Rewrites <script> tags in index.html to canonical load order.
Run from /27 project root: python3 htp-index-rewrite.py
Backs up to index.html.bak-rewrite first.
"""
import re, shutil, os, sys

BASE = os.getcwd()
HTML = os.path.join(BASE, 'index.html')
if not os.path.exists(HTML):
    print(f"ERROR: index.html not found in {BASE}"); sys.exit(1)

shutil.copy(HTML, HTML + '.bak-rewrite')
print("Backed up → index.html.bak-rewrite")

content = open(HTML, encoding='utf-8', errors='ignore').read()

# Canonical load order — only files that actually exist get injected
CANONICAL = [
    "kaspa/kaspa.js",           # WASM — must be first
    "firebase-config.js",       # Firebase init
    "wasm-bridge.js",           # WASM bridge
    "htp-utxo-mutex.js",        # P0 mutex — BEFORE covenant escrow
    "htp-init.js",
    "htp-fee-engine.js",
    "htp-covenant-escrow-v2.js",
    "htp-events-v3.js",
    "htp-board-engine.js",
    "htp-board-engine-fix.js",  # must be directly after board-engine
    "htp-chess-core.js",
    "htp-chess-sync.js",
    "htp-chess-ui.js",
    "htp-games-sync.js",
    "htp-match-deadline.js",
    "htp-zk-pipeline.js",
    "dag-background.js",
    "htp-oracle-relay.js",
    "multiplayer.js",
]

present = [s for s in CANONICAL if os.path.exists(os.path.join(BASE, s))]
missing = [s for s in CANONICAL if not os.path.exists(os.path.join(BASE, s))]

if missing:
    print(f"\n⚠ Not present (skipped): {', '.join(missing)}")

# Find all existing local <script src> lines
existing = re.findall(r'<script[^>]+src=["\'](?!http)([^"\']+\.js)["\'][^>]*>(?:</script>)?', content)
removed  = [f for f in existing if f not in present]
if removed:
    print(f"\n🗑 Removing {len(removed)} dead/superseded tags:")
    for f in removed: print(f"   {f}")

# Build replacement block
new_block = '\n'.join(f'    <script src="{s}"></script>' for s in present)

# Replace the entire local-script block
pattern = r'(?:<script[^>]+src=["\'](?!http)[^"\']+\.js["\'][^>]*>(?:</script>)?\s*)+'
m = re.search(pattern, content)
if m:
    new_content = content[:m.start()] + new_block + '\n' + content[m.end():]
    print(f"\n✓ Replaced script block ({len(present)} scripts in canonical order)")
else:
    new_content = content.replace('</body>', new_block + '\n</body>', 1)
    print(f"\n✓ Injected {len(present)} scripts before </body>")

open(HTML, 'w', encoding='utf-8').write(new_content)

# Verify
lines = new_content.split('\n')
def line_of(f):
    for i, l in enumerate(lines):
        if f'src="{f}"' in l or f"src='{f}'" in l: return i
    return -1

print("\nLoad order verification:")
checks = [
    ("htp-utxo-mutex.js",     "htp-covenant-escrow-v2.js"),
    ("wasm-bridge.js",        "htp-utxo-mutex.js"),
    ("htp-board-engine.js",   "htp-board-engine-fix.js"),
    ("firebase-config.js",    "htp-events-v3.js"),
    ("htp-events-v3.js",      "htp-chess-sync.js"),
]
ok = True
for a, b in checks:
    la, lb = line_of(a), line_of(b)
    if la == -1:   print(f"  ⚠ {a} not in HTML")
    elif lb == -1: print(f"  ⚠ {b} not in HTML")
    elif la < lb:  print(f"  ✓ {a} → {b}")
    else:          print(f"  ✗ ORDER WRONG: {a} after {b}"); ok = False

print(f"\n{'✓ index.html rewrite complete' if ok else '✗ Order issue — check manually'}")
print("Next: bash deploy.sh hosting")
