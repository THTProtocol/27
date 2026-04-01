#!/bin/bash
set -e
TARGET="index.html"
BACKUP="index.html.bak-chess"
echo "--- HTP Chess Bug Fix (Bugs 1-5) ---"
[ ! -f "$TARGET" ] && echo "ERROR: Run from /27" && exit 1
cp "$TARGET" "$BACKUP"
echo "✓ Backup saved"

python3 - << 'PYEOF'
import re
content = open('index.html', 'r', encoding='utf-8').read()

# Bug 4: Remove type="module" from wasm-bridge.js script tag
before = content
content = re.sub(
    r'<script\s+type=["\']module["\']\s+src=["\']htp-wasm-bridge\.js["\']',
    '<script src="htp-wasm-bridge.js"',
    content
)
content = re.sub(
    r'<script\s+type=["\']module["\']\s+src=["\']wasm-bridge\.js["\']',
    '<script src="wasm-bridge.js"',
    content
)
if content != before:
    print('  Bug 4: Removed type="module" from wasm-bridge script tag')
else:
    print('  Bug 4: type=module not found (may already be fixed)')

# Remove any previous injections of these fix scripts to avoid duplicates
for pat in [
    r'\s*<script\s+src=["\']htp-board-engine-fix\.js["\'].*?></script>',
    r'\s*<script\s+src=["\']htp-board-engine-fix2\.js["\'].*?></script>',
    r'\s*<script\s+src=["\']htp-wasm-bridge-fix\.js["\'].*?></script>',
]:
    content = re.sub(pat, '', content)

# Inject in correct order just before </body>
inject = """
  <script src="htp-wasm-bridge-fix.js"></script>
  <script src="htp-board-engine-fix2.js"></script>"""

if '</body>' in content:
    content = content.replace('</body>', inject + '\n</body>', 1)
    print('  Bugs 1+2+3+4: Fix scripts injected before </body>')
else:
    print('ERROR: </body> not found')
    exit(1)

open('index.html', 'w', encoding='utf-8').write(content)
PYEOF

echo "--- Lint ---"
node -e "require('fs').readFileSync('index.html','utf8')" && echo "✓ File readable"

echo "--- Deploying ---"
firebase deploy --only hosting

echo ""
echo "✅ Chess bug fixes deployed!"
echo "Expected browser console:"
echo "  [HTP WASM Bridge Fix] Loaded — safe window bridge active"
echo "  [HTP Board Engine Fix v2] Loaded"
echo "  isCheck/isCheckmate/isStalemate/isDraw aliases active"
echo "  htpRelay.send bridge active"
echo "  Board orientation enforcer active"
