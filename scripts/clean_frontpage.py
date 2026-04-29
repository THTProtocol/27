import re

HTML_PATH = '/workspaces/27/public/index.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    h = f.read()

original_len = len(h)

# ============================================================
# 1. REMOVE / HIDE "LIVE DAG" ticker / writing
#    Matches common patterns: "Live DAG", "live-dag", "LIVE DAG",
#    any small <span> or <div> that just says live dag status
# ============================================================

# Pattern: standalone live dag badge/ticker spans or divs
patterns_remove = [
    # <span ...>Live DAG</span> variants
    r'<span[^>]*class="[^"]*(?:live-dag|dag-live|dag-status|live-status|ticker)[^"]*"[^>]*>[\s\S]{0,200}?</span>',
    # <div ...>...Live DAG...</div> short divs
    r'<div[^>]*class="[^"]*(?:live-dag|dag-live|dag-status|live-status|ticker|dag-ticker)[^"]*"[^>]*>[\s\S]{0,300}?</div>',
    # Any element with text exactly "Live DAG" or "LIVE DAG"
    r'<(?:span|p|small|div)[^>]*>\s*(?:&#9679;\s*)?(?:LIVE|Live|live)\s+DAG\s*</(?:span|p|small|div)>',
    # Dot + Live + space patterns often used as status indicators
    r'<(?:span|div)[^>]*>\s*[\u25cf\u2022●•]\s*(?:LIVE|Live)\s*(?:DAG)?\s*</(?:span|div)>',
]

removed_dag = 0
for pat in patterns_remove:
    new_h, n = re.subn(pat, '', h, flags=re.IGNORECASE)
    if n:
        h = new_h
        removed_dag += n
        print(f'  Removed {n} live-dag element(s) via pattern: {pat[:60]}...')

# ============================================================
# 2. REMOVE small description / subtitle text on skill game cards
#    The cards typically have: title, then a <p> or <span> with
#    a short description like "Provably fair. Instant settlement."
#    We want to keep the title + badge but strip the body text.
# ============================================================

# Common class names for the small text inside game cards
game_desc_patterns = [
    # <p class="game-desc ...">...</p>
    r'(<(?:p|span|div)[^>]*class="[^"]*(?:game-desc|game-description|card-desc|card-body|game-sub|game-text|skill-desc)[^"]*"[^>]*>)[\s\S]{1,400}?(</(?:p|span|div)>)',
    # small tags inside cards
    r'(<small[^>]*class="[^"]*(?:game|skill|card)[^"]*"[^>]*>)[\s\S]{1,300}?(</small>)',
]

removed_desc = 0
for pat in game_desc_patterns:
    new_h, n = re.subn(pat, '', h, flags=re.IGNORECASE)
    if n:
        h = new_h
        removed_desc += n
        print(f'  Removed {n} game card description(s)')

# ============================================================
# 3. INJECT improved front-page CSS overrides
#    - Cleaner hero typography
#    - Bigger, bolder game card titles
#    - Remove any residual live-dag via CSS display:none as fallback
#    - Tighter, more premium feel overall
# ============================================================

# Strip previous frontpage override block if re-running
h = re.sub(r'<style id="htp-frontpage-overrides">[\s\S]*?</style>', '', h)

frontpage_css = """
<style id="htp-frontpage-overrides">
/* ===== HTP Front Page Overrides ===== */

/* Kill any remaining live-dag / dag-status indicators */
.live-dag, .dag-live, .dag-status, .live-status,
.dag-ticker, .ticker, [class*="live-dag"], [class*="dag-live"],
[class*="dag-status"], [class*="live-status"] {
  display: none !important;
}

/* ---- HERO SECTION ---- */
.hero, .hero-section, #heroSection, .htp-hero {
  background: linear-gradient(
    160deg,
    rgba(6, 10, 18, 1) 0%,
    rgba(10, 18, 35, 1) 50%,
    rgba(6, 10, 18, 1) 100%
  ) !important;
  position: relative;
  overflow: hidden;
}
.hero::before, .hero-section::before, #heroSection::before {
  content: '';
  position: absolute;
  top: -80px; left: 50%; transform: translateX(-50%);
  width: 600px; height: 400px;
  background: radial-gradient(ellipse at center,
    rgba(73, 232, 194, 0.06) 0%,
    rgba(99, 102, 241, 0.04) 40%,
    transparent 70%);
  pointer-events: none; z-index: 0;
}

/* Hero headline — bigger, tighter */
.hero h1, .hero-title, .htp-hero h1,
#heroSection h1, .hero .title {
  font-size: clamp(2.4rem, 6vw, 4.2rem) !important;
  font-weight: 900 !important;
  letter-spacing: -0.02em !important;
  line-height: 1.08 !important;
  background: linear-gradient(135deg, #f1f5f9 30%, #49e8c2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Hero sub — cleaner, no clutter */
.hero p, .hero-sub, .hero .subtitle, .htp-hero p,
#heroSection p, .hero .description {
  font-size: clamp(0.95rem, 2vw, 1.15rem) !important;
  color: #64748b !important;
  font-weight: 400 !important;
  line-height: 1.65 !important;
  max-width: 520px;
}

/* Hero CTA buttons */
.hero .btn-primary, .hero-cta, .hero .cta-btn {
  padding: 14px 32px !important;
  font-size: 15px !important;
  font-weight: 800 !important;
  border-radius: 12px !important;
  letter-spacing: 0.04em !important;
}

/* ---- SKILL GAME CARDS ---- */
/* Strip small description text */
.game-card .game-desc,
.game-card .card-desc,
.game-card .card-body > p,
.game-card small,
.game-card .game-description,
.game-card .description,
.skill-game-card .desc,
.skill-game-card p,
.skill-game-card small,
[class*="game-card"] .desc,
[class*="game-card"] small,
[class*="game-card"] > p {
  display: none !important;
}

/* Game card — bigger title, clean look */
.game-card, .skill-game-card, [class*="game-card"] {
  background: rgba(10, 15, 30, 0.8) !important;
  border: 1px solid rgba(73, 232, 194, 0.1) !important;
  border-radius: 14px !important;
  transition: all 0.18s ease !important;
  overflow: hidden;
}
.game-card:hover, .skill-game-card:hover, [class*="game-card"]:hover {
  border-color: rgba(73, 232, 194, 0.35) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 32px rgba(73, 232, 194, 0.08) !important;
}

/* Game card title — prominent */
.game-card .game-name, .game-card .card-title,
.game-card h3, .game-card h4,
.skill-game-card h3, .skill-game-card h4,
.skill-game-card .game-name,
[class*="game-card"] h3,
[class*="game-card"] h4 {
  font-size: 1.15rem !important;
  font-weight: 900 !important;
  color: #e2e8f0 !important;
  letter-spacing: 0.01em !important;
  line-height: 1.2 !important;
  margin-bottom: 6px !important;
}

/* Category label — clean uppercase */
.game-card .game-category, .game-card .category,
.skill-game-card .category,
[class*="game-card"] .category {
  font-size: 9px !important;
  font-weight: 800 !important;
  color: #475569 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.12em !important;
  margin-bottom: 6px !important;
}

/* ---- STAT / METRIC CARDS ---- */
.stat-card, .metric-card, .info-card {
  background: rgba(10, 15, 30, 0.7) !important;
  border: 1px solid rgba(73, 232, 194, 0.09) !important;
  border-radius: 12px !important;
}

/* ---- SECTION HEADERS ---- */
.section-title, .sec-title, h2.title {
  font-size: clamp(1.4rem, 3vw, 2rem) !important;
  font-weight: 900 !important;
  color: #f1f5f9 !important;
  letter-spacing: -0.01em !important;
}

/* ---- GLOBAL CLEANUP ---- */
/* Tighten body bg */
body {
  background: #060a12 !important;
}
/* Scrollbar styling */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(73,232,194,.2); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(73,232,194,.4); }
</style>
"""

# Inject into <head>
h = h.replace('</head>', frontpage_css + '</head>', 1)

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(h)

new_len = len(h)
print(f'\nOriginal size: {original_len:,} bytes')
print(f'New size:      {new_len:,} bytes')
print(f'Removed live-dag elements: {removed_dag}')
print(f'Removed game card descriptions: {removed_desc}')
print(f'CSS override block injected: yes')
print('DONE')
