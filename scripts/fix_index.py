#!/usr/bin/env python3
"""
fix_index.py
Applies 5 targeted fixes to public/index.html:
  1. Removes 3 stale duplicate toggleMobileView script blocks
  2. Replaces Kasperia provider in waitForProvider() with OKX
  3. Replaces 'Kasperia' in INSTALL_URLS with OKX
  4. Replaces Kasperia wallet card in desktop grid with OKX
  5. Replaces Kasperia wallet card in mobile overlay with OKX
Run from repo root: python3 scripts/fix_index.py
"""
import os, sys, re

INDEX = os.path.join(os.path.dirname(__file__), '..', 'public', 'index.html')

with open(INDEX, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
lines = content.split('\n')
total = len(lines)
print(f"Loaded {INDEX} — {total} lines, {original_size} bytes")

# ─── FIX 1: Remove 3 duplicate toggleMobileView blocks ───────────────────────
# Find all definition positions
defs = [i for i, l in enumerate(lines) if 'function toggleMobileView' in l]
print(f"toggleMobileView defs found at lines: {[d+1 for d in defs]}")

if len(defs) == 4:
    # The 3 stale blocks run from just after the htp-skill-v3.js script tag
    # up to and including the 3rd </script> close, before the mobile overlay <style>.
    # Empirically: defs[0]-2 through defs[2]+54 (each block is ~51 lines)
    # More robust: find the first def, go back to find the opening {, and
    # forward to find the 3rd closing </script>, then cut that range.
    block_start = defs[0] - 2   # two blank lines before the first {
    # Find the end of the 3rd block = next </script> after defs[2]
    block_end = defs[2]
    while block_end < total and '</script>' not in lines[block_end]:
        block_end += 1
    # block_end is now the index of the closing </script> of block 3
    print(f"  Removing lines {block_start+1}–{block_end+1} ({block_end - block_start + 1} lines)")
    lines = lines[:block_start] + lines[block_end + 1:]
    defs_after = [i for i, l in enumerate(lines) if 'function toggleMobileView' in l]
    print(f"  toggleMobileView defs remaining: {len(defs_after)} (want 1)")
elif len(defs) == 1:
    print("  Already clean — only 1 toggleMobileView def, skipping Fix 1")
else:
    print(f"  WARNING: unexpected def count ({len(defs)}), skipping Fix 1")

# ─── FIX 2: Replace Kasperia provider case with OKX ─────────────────────────
fixed2 = False
for i, l in enumerate(lines):
    if "case 'Kasperia'" in l and 'return w.kasperia' in l:
        lines[i] = "                case 'OKX':      return (w.okxwallet && w.okxwallet.kaspa) ? w.okxwallet.kaspa : null;"
        print(f"  Fix 2: replaced Kasperia provider at line {i+1}")
        fixed2 = True
        break
if not fixed2:
    # Already fixed or uses different pattern
    if any("case 'OKX'" in l for l in lines):
        print("  Fix 2: OKX case already present, skipping")
    else:
        print("  Fix 2: WARNING — Kasperia case not found and OKX not present")

# ─── FIX 3: Replace Kasperia INSTALL_URL with OKX ───────────────────────────
fixed3 = False
for i, l in enumerate(lines):
    if "'Kasperia'" in l and 'https://kasperia' in l and 'INSTALL' not in l:
        lines[i] = "                    'OKX':'https://www.okx.com/web3',"
        print(f"  Fix 3: replaced Kasperia install URL at line {i+1}")
        fixed3 = True
        break
    if "'Kasperia'" in l and 'kasperia.app' in l:
        lines[i] = "                    'OKX':'https://www.okx.com/web3',"
        print(f"  Fix 3: replaced Kasperia install URL at line {i+1}")
        fixed3 = True
        break
if not fixed3:
    if any("'OKX':'https://www.okx.com/web3'" in l for l in lines):
        print("  Fix 3: OKX install URL already present, skipping")
    else:
        print("  Fix 3: WARNING — Kasperia install URL not found")

# ─── FIX 4: Replace Kasperia desktop wallet card with OKX ───────────────────
fixed4 = False
for i, l in enumerate(lines):
    if "selWallet('Kasperia')" in l and 'mob' not in l:
        # Replace this line (the <div onclick>) and next two (img, span)
        lines[i] = lines[i].replace("selWallet('Kasperia')", "selWallet('OKX')")
        if i+1 < len(lines) and 'kasperia.png' in lines[i+1]:
            lines[i+1] = '                            <img src="https://www.google.com/s2/favicons?domain=okx.com&sz=64" alt="OKX Wallet" style="width:36px;height:36px;border-radius:8px" />'
        if i+2 < len(lines) and 'Kasperia' in lines[i+2]:
            lines[i+2] = '                            <span style="font-size:12px;font-weight:600;color:var(--text)">OKX Wallet</span>'
        print(f"  Fix 4: replaced desktop Kasperia card at line {i+1}")
        fixed4 = True
        break
if not fixed4:
    if any("selWallet('OKX')" in l and 'mob' not in l for l in lines):
        print("  Fix 4: OKX desktop card already present, skipping")
    else:
        print("  Fix 4: WARNING — Kasperia desktop card not found")

# ─── FIX 5: Replace Kasperia mobile wallet card with OKX ────────────────────
fixed5 = False
for i, l in enumerate(lines):
    if "selWallet('Kasperia')" in l and 'mob' in l:
        lines[i] = lines[i].replace("selWallet('Kasperia')", "selWallet('OKX')")
        if i+1 < len(lines) and 'kasperia.png' in lines[i+1]:
            lines[i+1] = '            <img src="https://www.google.com/s2/favicons?domain=okx.com&sz=64" alt="OKX Wallet" style="width:36px;height:36px;border-radius:8px"/>'
        if i+2 < len(lines) and 'Kasperia' in lines[i+2]:
            lines[i+2] = '            <span>OKX Wallet</span>'
        print(f"  Fix 5: replaced mobile Kasperia card at line {i+1}")
        fixed5 = True
        break
if not fixed5:
    if any("selWallet('OKX')" in l and 'mob' in l for l in lines):
        print("  Fix 5: OKX mobile card already present, skipping")
    else:
        print("  Fix 5: WARNING — Kasperia mobile card not found")

# ─── WRITE OUTPUT ─────────────────────────────────────────────────────────────
result = '\n'.join(lines)
new_size = len(result)

remaining_kasperia = result.count('Kasperia')
remaining_defs = result.count('function toggleMobileView')

print(f"\nSummary:")
print(f"  Original size : {original_size:,} bytes")
print(f"  New size      : {new_size:,} bytes")
print(f"  'Kasperia' remaining: {remaining_kasperia} (want 0)")
print(f"  toggleMobileView defs: {remaining_defs} (want 1)")

if remaining_kasperia > 0:
    for i, l in enumerate(lines):
        if 'Kasperia' in l:
            print(f"    Remaining Kasperia at line {i+1}: {l.strip()[:80]}")

if remaining_defs != 1:
    print(f"  WARNING: Expected 1 toggleMobileView def, got {remaining_defs}")
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as f:
    f.write(result)

print(f"\nWrote fixed file to {INDEX}")
print("DONE — run: git add public/index.html && git commit -m 'fix: dedup toggleMobileView; OKX wallet' && git push && firebase deploy --only hosting")
