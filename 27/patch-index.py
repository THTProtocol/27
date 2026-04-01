#!/usr/bin/env python3
"""
patch-index.py — Injects antigravity src/ scripts into index.html in correct load order.
Run from your /27 project root:
    python3 /path/to/antigravity/patch-index.py
"""
import re, shutil, os, sys

BASE = os.getcwd()
HTML = os.path.join(BASE, 'index.html')

if not os.path.exists(HTML):
    print(f"ERROR: index.html not found in {BASE}")
    sys.exit(1)

# Backup
shutil.copy(HTML, HTML + '.bak-antigravity')
print(f"Backed up to index.html.bak-antigravity")

html = open(HTML, encoding='utf-8', errors='ignore').read()

INJECTIONS = [
    # (anchor_pattern, new_tag, label)
    # P0: UTXO mutex — must come before covenant escrow
    (r'(<script[^>]+src=["\']htp-covenant-escrow-v2\.js["\'][^>]*>)',
     '<script src="htp-utxo-mutex.js"></script>\n    ',
     'htp-utxo-mutex.js (before covenant escrow)'),

    # Board engine fix — after htp-board-engine.js
    (r'(<script[^>]+src=["\']htp-board-engine\.js["\'][^>]*></script>)',
     r'\1\n    <script src="htp-board-engine-fix.js"></script>',
     'htp-board-engine-fix.js'),

    # Chess UI — after htp-chess-ui.js (replace old one) or before </body>
    (r'(<script[^>]+src=["\']htp-chess-ui\.js["\'][^>]*></script>)',
     r'\1',  # already present, no duplicate needed
     'htp-chess-ui.js (already present)'),
]

changes = 0
for pattern, replacement, label in INJECTIONS:
    if re.search(pattern, html):
        new_html = re.sub(pattern, replacement, html, count=1)
        if new_html != html:
            html = new_html
            print(f"  ✓ Injected: {label}")
            changes += 1
        else:
            print(f"  — Already present: {label}")
    else:
        print(f"  ! Anchor not found for: {label} (manual injection needed)")

if changes > 0:
    open(HTML, 'w', encoding='utf-8').write(html)
    print(f"\n✓ index.html updated ({changes} change(s))")
else:
    print("\n— No changes made to index.html")

# Verify no dead script tags
import glob
print("\nChecking for dead script tags...")
missing = []
for m in re.finditer(r'src=["\']([^"\']+\.js)["\']', html):
    f = m.group(1)
    if not f.startswith('http') and not os.path.exists(os.path.join(BASE, f)):
        missing.append(f)
if missing:
    print("  ✗ MISSING files (remove these tags from index.html):")
    for f in missing: print(f"    {f}")
else:
    print("  ✓ All script tags resolve")
