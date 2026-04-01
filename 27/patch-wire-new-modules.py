#!/usr/bin/env python3
"""
patch-wire-new-modules.py
Injects the 6 new module script tags into index.html
immediately after htp-covenant-escrow-v2.js
"""
import re, shutil, sys
from pathlib import Path

HTML = Path('index.html')
if not HTML.exists():
    print('ERROR: index.html not found'); sys.exit(1)

shutil.copy(HTML, 'index.html.bak-wire-modules')
src = HTML.read_text(encoding='utf-8')

NEW_MODULES = [
    'htp-maximizer-ui.js',
    'htp-settlement-overlay.js',
    'htp-event-creator.js',
    'htp-rpc-test.js',
    'htp-cancel-flow.js',
    'htp-settlement-preview.js',
]

# Remove any existing occurrences first (idempotent)
for name in NEW_MODULES:
    src = re.sub(
        r'[ \t]*<script\s+src=["\']' + re.escape(name) + r'["\'][^>]*>\s*</script>[ \t]*\n?',
        '', src, flags=re.IGNORECASE
    )

# Find anchor: htp-covenant-escrow-v2.js script tag
anchor_pattern = re.compile(
    r'(<script\s+src=["\']htp-covenant-escrow-v2\.js["\'][^>]*>\s*</script>)',
    re.IGNORECASE
)

if not anchor_pattern.search(src):
    print('ERROR: htp-covenant-escrow-v2.js not found in index.html'); sys.exit(1)

block = '\n' + '\n'.join(f'    <script src="{n}"></script>' for n in NEW_MODULES)

src = anchor_pattern.sub(r'\1' + block, src, count=1)
HTML.write_text(src, encoding='utf-8')

# Verify
result = HTML.read_text(encoding='utf-8')
print('Wired modules:')
for name in NEW_MODULES:
    count = len(re.findall(re.escape(name), result))
    print(f'  {"✓" if count == 1 else "✗ (" + str(count) + "x)"} {name}')

print('\n✓ Done — backup: index.html.bak-wire-modules')
