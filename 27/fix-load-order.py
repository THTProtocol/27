#!/usr/bin/env python3
"""
fix-load-order.py
Removes ALL duplicate script tag entries for the 4 critical files,
then ensures exactly one copy each in correct order:
  firebase-config.js → htp-fee-engine.js → htp-init.js → htp-covenant-escrow-v2.js
"""
import re, shutil, sys
from pathlib import Path

HTML = Path('index.html')
if not HTML.exists():
    print('ERROR: index.html not found'); sys.exit(1)

shutil.copy(HTML, 'index.html.bak-order-fix')
src = HTML.read_text(encoding='utf-8')
original_len = len(src)

TARGETS = [
    'firebase-config.js',
    'htp-fee-engine.js',
    'htp-init.js',
    'htp-covenant-escrow-v2.js',
]

# Remove ALL occurrences of each target script tag (including stray comment lines)
for name in TARGETS:
    # Remove script tags
    src = re.sub(
        r'[ \t]*<script\s+src=["\']' + re.escape(name) + r'["\'][^>]*>\s*</script>[ \t]*\n?',
        '', src, flags=re.IGNORECASE
    )
    # Remove stray comment lines referencing these files
    src = re.sub(
        r'[ \t]*<!--[^>]*' + re.escape(name) + r'[^>]*-->[ \t]*\n?',
        '', src, flags=re.IGNORECASE
    )

# Build the canonical block in correct order
block = (
    '    <script src="firebase-config.js"></script>\n'
    '    <script src="htp-fee-engine.js"></script>\n'
    '    <script src="htp-init.js"></script>\n'
    '    <script src="htp-covenant-escrow-v2.js"></script>\n'
)

# Insert before </body>
if '</body>' not in src:
    print('ERROR: </body> not found'); sys.exit(1)

src = src.replace('</body>', block + '</body>', 1)

HTML.write_text(src, encoding='utf-8')

# Verify
result = HTML.read_text(encoding='utf-8')
for name in TARGETS:
    count = len(re.findall(re.escape(name), result))
    status = '✓' if count == 1 else f'✗ ({count} occurrences!)'
    print(f'  {status} {name}')

# Check order
positions = {}
for name in TARGETS:
    m = re.search(re.escape(name), result)
    if m: positions[name] = m.start()

ordered = sorted(TARGETS, key=lambda n: positions.get(n, 999999))
if ordered == TARGETS:
    print('\n✓ Load order correct: firebase-config → htp-fee-engine → htp-init → htp-covenant-escrow-v2')
else:
    print('\n✗ Order wrong:', ordered)

print(f'\nSaved {original_len - len(src)} bytes | Backup: index.html.bak-order-fix')
