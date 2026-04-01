#!/usr/bin/env python3
"""
htp-remove-dead-tags.py — Removes ALL dead <script src> tags from index.html
regardless of where they appear in the file (handles 35000+ line files).
Run from /27 project root: python3 htp-remove-dead-tags.py
"""
import re, shutil, os, sys

BASE = os.getcwd()
HTML = os.path.join(BASE, 'index.html')
if not os.path.exists(HTML):
    print(f"ERROR: index.html not found in {BASE}"); sys.exit(1)

shutil.copy(HTML, HTML + '.bak-deadtags')
print("Backed up → index.html.bak-deadtags")

content = open(HTML, encoding='utf-8', errors='ignore').read()
original_size = len(content)

# Remove any <script src="..."> tag whose src file does NOT exist on disk
# This handles ALL occurrences anywhere in the file, including inline script blocks

def remove_dead_script_tags(html, base):
    pattern = re.compile(
        r'[ \t]*<script[^>]+src=["\']([^"\']+\.js)["\'][^>]*>(?:</script>)?\s*\n?'
    )
    removed = []
    def replacer(m):
        src = m.group(1).lstrip('/')
        # Skip external URLs
        if src.startswith('http'):
            return m.group(0)
        # Check if file exists
        if os.path.exists(os.path.join(base, src)):
            return m.group(0)
        removed.append(src)
        return ''
    
    new_html = pattern.sub(replacer, html)
    return new_html, removed

new_content, removed = remove_dead_script_tags(content, BASE)

if removed:
    print(f"\n🗑 Removed {len(removed)} dead script tags:")
    for r in removed:
        print(f"   {r}")
else:
    print("\n✓ No dead script tags found")

# Write back
open(HTML, 'w', encoding='utf-8').write(new_content)
saved = original_size - len(new_content)
print(f"\n✓ index.html updated (saved {saved} bytes)")

# Final verification — should be zero dead tags now
remaining = []
for m in re.finditer(r'src=["\']/?([^"\']+\.js)["\']', new_content):
    src = m.group(1).lstrip('/')
    if not src.startswith('http') and not os.path.exists(os.path.join(BASE, src)):
        remaining.append(src)

if remaining:
    print(f"\n⚠ Still dead (check manually): {remaining}")
    sys.exit(1)
else:
    print("✓ Zero dead script tags remain")
    print("\nRun: bash deploy.sh hosting")
