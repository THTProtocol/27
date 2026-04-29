import re

HTML_PATH = '/workspaces/27/public/index.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    h = f.read()

# Strip previous injections cleanly
h = re.sub(r'<style>\s*#mobileOverlay[\s\S]*?</style>\s*', '', h)
h = re.sub(r'<div id="mobileOverlay">[\s\S]*?</div>\s*(?=\s*<script>\s*\(function)', '', h)
h = re.sub(r'<script>\s*\(function\(\)\{\s*function toggleMobileView[\s\S]*?\}\)\(\);\s*</script>', '', h)

TOGGLE_BTN = '<button id="viewToggleBtn" onclick="toggleMobileView()" style="margin-right:8px;padding:6px 14px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.25);color:#49e8c2;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.03em;display:inline-flex;align-items:center;gap:6px"><span id="viewToggleIcon">&#128241;</span><span id="viewToggleLabel">Mobile</span></button>'

if 'viewToggleBtn' not in h:
    old = '<button class="btn-c" id="cBtn"'
    if old in h:
        h = h.replace(old, TOGGLE_BTN + old, 1)
        print('Toggle button injected')
    else:
        m = re.search(r'<button[^>]*id="cBtn"', h)
        if m:
            h = h[:m.start()] + TOGGLE_BTN + h[m.start():]
            print('Toggle button injected via fallback')
        else:
            print('WARNING: cBtn not found')
else:
    print('Toggle button already present')

css = """<style>
/* ===== MOBILE OVERLAY BASE ===== */
#mobileOverlay{
  display:none;position:fixed;inset:0;
  background:#060a12;
  z-index:9999;overflow-y:auto;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  -webkit-overflow-scrolling:touch;
}
#mobileOverlay.active{display:flex;flex-direction:column}

/* Header */
.mob-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 16px 12px;
  border-bottom:1px solid rgba(73,232,194,.12);
  position:sticky;top:0;background:rgba(6,10,18,.97);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  z-index:10;
}
.mob-logo{
  display:flex;align-items:center;gap:8px;
  font-size:15px;font-weight:900;color:#e2e8f0;
  letter-spacing:.06em;text-transform:uppercase;
}
.mob-logo-dot{
  width:8px;height:8px;border-radius:50%;
  background:#49e8c2;
  box-shadow:0 0 8px rgba(73,232,194,.7);
  animation:mobPulse 2s ease-in-out infinite;
}
@keyframes mobPulse{
  0%,100%{box-shadow:0 0 6px rgba(73,232,194,.6)}
  50%{box-shadow:0 0 14px rgba(73,232,194,1)}
}
.mob-header-right{display:flex;align-items:center;gap:8px}
.mob-conn-pill{
  font-size:11px;color:#49e8c2;font-weight:700;cursor:pointer;
  padding:5px 12px;border:1px solid rgba(73,232,194,.3);
  border-radius:20px;background:rgba(73,232,194,.06);
  letter-spacing:.03em;transition:background .15s;
}
.mob-conn-pill:active{background:rgba(73,232,194,.14)}
.mob-close-btn{
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:#94a3b8;font-size:11px;font-weight:700;
  cursor:pointer;padding:5px 12px;border-radius:20px;
  letter-spacing:.03em;transition:all .15s;
}
.mob-close-btn:active{background:rgba(255,255,255,.12);color:#e2e8f0}

/* Hero banner */
.mob-hero{
  margin:14px 14px 0;
  background:linear-gradient(135deg,rgba(73,232,194,.06) 0%,rgba(99,102,241,.06) 100%);
  border:1px solid rgba(73,232,194,.15);
  border-radius:14px;padding:18px 16px;
  position:relative;overflow:hidden;
}
.mob-hero::before{
  content:'';position:absolute;top:-40px;right:-40px;
  width:130px;height:130px;border-radius:50%;
  background:radial-gradient(circle,rgba(73,232,194,.08) 0%,transparent 70%);
  pointer-events:none;
}
.mob-hero-label{
  font-size:9px;font-weight:800;color:#49e8c2;
  text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;
}
.mob-hero-title{
  font-size:20px;font-weight:900;color:#e2e8f0;
  line-height:1.2;margin-bottom:4px;
}
.mob-hero-title span{color:#49e8c2}
.mob-hero-sub{
  font-size:11px;color:#64748b;line-height:1.5;
  margin-bottom:14px;
}
.mob-hero-stats{
  display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
}
.mob-hstat{
  background:rgba(6,10,18,.6);border:1px solid rgba(73,232,194,.1);
  border-radius:10px;padding:10px 8px;text-align:center;
}
.mob-hstat-val{
  font-size:17px;font-weight:900;color:#49e8c2;
  font-variant-numeric:tabular-nums;
}
.mob-hstat-lbl{
  font-size:8px;color:#475569;margin-top:2px;
  text-transform:uppercase;letter-spacing:.06em;
}

/* Body */
.mob-body{padding:14px 14px 90px;flex:1}

/* Section */
.mob-sec{margin-bottom:22px}
.mob-sec-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:10px;padding-bottom:8px;
  border-bottom:1px solid rgba(73,232,194,.1);
}
.mob-sec-title{
  font-size:10px;font-weight:800;color:#49e8c2;
  text-transform:uppercase;letter-spacing:.1em;
}
.mob-sec-badge{
  font-size:9px;font-weight:700;color:#475569;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  padding:2px 7px;border-radius:10px;
}

/* Game cards */
.mob-game-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.mob-game-card{
  background:rgba(10,15,30,.7);
  border:1px solid rgba(73,232,194,.1);
  border-radius:12px;padding:14px 12px;
  cursor:pointer;transition:all .15s;
  position:relative;overflow:hidden;
}
.mob-game-card::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(73,232,194,.03) 0%,transparent 60%);
  pointer-events:none;
}
.mob-game-card:active{
  border-color:#49e8c2;
  box-shadow:0 0 16px rgba(73,232,194,.12);
  transform:scale(.98);
}
.mob-game-card .gcategory{
  font-size:8px;font-weight:800;color:#475569;
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;
}
.mob-game-card .gname{
  font-size:14px;font-weight:800;color:#e2e8f0;margin-bottom:3px;
}
.mob-game-card .gdesc{
  font-size:10px;color:#475569;line-height:1.45;
}
.mob-game-card .gbadge{
  display:inline-block;margin-top:8px;
  font-size:8px;font-weight:700;
  padding:2px 8px;border-radius:8px;
  background:rgba(73,232,194,.08);color:#49e8c2;
  border:1px solid rgba(73,232,194,.15);
}

/* Mobile wallet cards */
.mob-wallet-dl-grid{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:8px;margin-bottom:12px;
}
.mob-wdl-card{
  display:flex;flex-direction:column;align-items:center;
  gap:7px;padding:14px 8px;
  background:rgba(10,15,30,.7);
  border:1px solid rgba(73,232,194,.12);
  border-radius:12px;cursor:pointer;
  text-decoration:none;
  transition:all .15s;
}
.mob-wdl-card:active{
  border-color:#49e8c2;
  box-shadow:0 0 14px rgba(73,232,194,.15);
  transform:scale(.97);
}
.mob-wdl-logo{
  width:40px;height:40px;border-radius:10px;
  background:rgba(73,232,194,.06);
  border:1px solid rgba(73,232,194,.15);
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;
}
.mob-wdl-logo img{width:36px;height:36px;border-radius:8px;object-fit:cover}
.mob-wdl-name{
  font-size:11px;font-weight:800;color:#e2e8f0;text-align:center;
}
.mob-wdl-tag{
  font-size:8px;font-weight:600;color:#475569;
  text-align:center;line-height:1.3;
}
.mob-wdl-platforms{
  display:flex;gap:3px;
}
.mob-wdl-os{
  font-size:7px;font-weight:700;color:#49e8c2;
  background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.15);
  padding:1px 5px;border-radius:5px;
}

/* Browser wallet grid */
.mob-bwallet-grid{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:8px;
}
.mob-bw-card{
  display:flex;flex-direction:column;align-items:center;
  gap:6px;padding:12px 6px;
  background:rgba(10,15,30,.7);
  border:1px solid rgba(73,232,194,.1);
  border-radius:11px;cursor:pointer;
  transition:all .15s;
}
.mob-bw-card:active{
  border-color:#49e8c2;
  box-shadow:0 0 12px rgba(73,232,194,.12);
}
.mob-bw-card img{width:36px;height:36px;border-radius:8px}
.mob-bw-card span{
  font-size:10px;font-weight:700;color:#e2e8f0;text-align:center;
}

/* Seed import */
#mobWalletStatus{
  margin-top:10px;padding:12px;
  border-radius:10px;
  border:1px solid rgba(73,232,194,.2);
  background:rgba(10,15,30,.7);
  font-size:12px;display:none;
}
.mob-input{
  width:100%;box-sizing:border-box;
  padding:11px 12px;
  background:rgba(10,15,30,.8);
  border:1px solid rgba(73,232,194,.18);
  color:#e2e8f0;border-radius:10px;
  font-size:12px;font-family:monospace;
  resize:vertical;min-height:68px;
  transition:border-color .15s;
}
.mob-input:focus{outline:none;border-color:rgba(73,232,194,.5)}
.mob-btn-primary{
  margin-top:8px;width:100%;padding:12px;
  background:rgba(73,232,194,.1);
  border:1px solid rgba(73,232,194,.3);
  color:#49e8c2;border-radius:10px;
  cursor:pointer;font-size:13px;font-weight:700;
  letter-spacing:.03em;transition:all .15s;
}
.mob-btn-primary:active{background:rgba(73,232,194,.2)}

/* Bottom nav */
.mob-nav{
  position:fixed;bottom:0;left:0;right:0;
  display:flex;background:rgba(6,10,18,.98);
  border-top:1px solid rgba(73,232,194,.15);
  z-index:10000;
  padding-bottom:env(safe-area-inset-bottom);
}
.mob-nav-btn{
  flex:1;display:flex;flex-direction:column;
  align-items:center;gap:3px;
  padding:9px 4px 7px;
  background:none;border:none;
  color:#475569;cursor:pointer;
  font-size:8px;font-weight:800;
  text-transform:uppercase;letter-spacing:.06em;
  transition:color .15s;
}
.mob-nav-btn.active{color:#49e8c2}
.mob-nav-btn.active svg{filter:drop-shadow(0 0 4px rgba(73,232,194,.5))}
.mob-nav-btn svg{display:block}

/* Sections */
.mob-section{display:none}
.mob-section.mob-active{display:block}

/* Portfolio stats */
.mob-port-stats{
  display:grid;grid-template-columns:repeat(3,1fr);
  gap:6px;margin-bottom:16px;
}
.mob-pstat{
  background:rgba(10,15,30,.8);
  border:1px solid rgba(73,232,194,.1);
  border-radius:10px;padding:12px 8px;text-align:center;
}
.mob-pstat-val{
  font-size:18px;font-weight:900;color:#49e8c2;
}
.mob-pstat-lbl{
  font-size:8px;color:#475569;margin-top:3px;
  text-transform:uppercase;letter-spacing:.06em;
}

/* CTA button */
.mob-cta{
  display:block;width:100%;margin-top:16px;padding:14px;
  background:linear-gradient(135deg,rgba(73,232,194,.12) 0%,rgba(99,102,241,.08) 100%);
  border:1px solid rgba(73,232,194,.25);
  color:#49e8c2;border-radius:12px;
  cursor:pointer;font-size:13px;font-weight:800;
  text-align:center;letter-spacing:.04em;
  box-sizing:border-box;transition:all .15s;
}
.mob-cta:active{background:rgba(73,232,194,.2);transform:scale(.99)}

/* Divider */
.mob-divider{
  height:1px;background:rgba(73,232,194,.08);
  margin:16px 0;
}
/* Market row placeholder */
.mob-market-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;
  background:rgba(10,15,30,.6);
  border:1px solid rgba(73,232,194,.08);
  border-radius:10px;margin-bottom:6px;
}
.mob-market-name{font-size:12px;font-weight:700;color:#e2e8f0}
.mob-market-meta{font-size:10px;color:#475569;margin-top:1px}
.mob-market-pool{font-size:12px;font-weight:700;color:#49e8c2}
</style>"""

html = """<div id="mobileOverlay">

  <!-- Header -->
  <div class="mob-header">
    <div class="mob-logo">
      <div class="mob-logo-dot"></div>
      High Table
    </div>
    <div class="mob-header-right">
      <div class="mob-conn-pill" id="mobConnBtn" onclick="mobTab('wallet')">Connect Wallet</div>
      <button class="mob-close-btn" onclick="toggleMobileView()">Desktop &#8599;</button>
    </div>
  </div>

  <!-- Bottom nav -->
  <nav class="mob-nav">
    <button class="mob-nav-btn active" onclick="mobTab('markets')" id="mnav-markets">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="12" width="4" height="10"/><rect x="9" y="7" width="4" height="15"/><rect x="16" y="3" width="4" height="19"/></svg>
      Markets
    </button>
    <button class="mob-nav-btn" onclick="mobTab('games')" id="mnav-games">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4M15 11h2M15 13h2"/></svg>
      Games
    </button>
    <button class="mob-nav-btn" onclick="mobTab('wallet')" id="mnav-wallet">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 12h2"/><path d="M2 7l4-4h12l4 4"/></svg>
      Wallet
    </button>
    <button class="mob-nav-btn" onclick="mobTab('portfolio')" id="mnav-portfolio">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      Portfolio
    </button>
  </nav>

  <!-- Hero -->
  <div class="mob-hero">
    <div class="mob-hero-label">High Table Protocol &middot; Kaspa DAG</div>
    <div class="mob-hero-title">Challenge.<br>Settle on the <span>DAG.</span></div>
    <div class="mob-hero-sub">Provably fair skill games &amp; prediction markets,<br>settled on-chain via Kaspa covenants.</div>
    <div class="mob-hero-stats">
      <div class="mob-hstat"><div class="mob-hstat-val" id="mobTotalPool">--</div><div class="mob-hstat-lbl">Pool KAS</div></div>
      <div class="mob-hstat"><div class="mob-hstat-val" id="mobActiveMarkets">--</div><div class="mob-hstat-lbl">Markets</div></div>
      <div class="mob-hstat"><div class="mob-hstat-val" id="mobPositions">--</div><div class="mob-hstat-lbl">Positions</div></div>
    </div>
  </div>

  <div class="mob-body">

    <!-- MARKETS TAB -->
    <div class="mob-section mob-active" id="mob-markets">
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Active Markets</div>
          <div class="mob-sec-badge">Live</div>
        </div>
        <div class="mob-market-row">
          <div><div class="mob-market-name">KAS/USD Q2 2026</div><div class="mob-market-meta">Prediction &middot; 3 outcomes</div></div>
          <div class="mob-market-pool">-- KAS</div>
        </div>
        <div class="mob-market-row">
          <div><div class="mob-market-name">Chess Championship</div><div class="mob-market-meta">Skill Match &middot; Heads-up</div></div>
          <div class="mob-market-pool">-- KAS</div>
        </div>
        <div id="mobMarketsList"></div>
      </div>
      <button class="mob-cta" onclick="toggleMobileView()">Open Full App &#8599;</button>
    </div>

    <!-- GAMES TAB -->
    <div class="mob-section" id="mob-games">
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Strategy</div>
          <div class="mob-sec-badge">On-chain</div>
        </div>
        <div class="mob-game-grid">
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Strategy</div>
            <div class="gname">Chess</div>
            <div class="gdesc">Full FIDE rules. On-chain settlement via covenant escrow.</div>
            <div class="gbadge">Heads-up</div>
          </div>
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Strategy</div>
            <div class="gname">Checkers</div>
            <div class="gdesc">Full replay proof committed to the DAG.</div>
            <div class="gbadge">Heads-up</div>
          </div>
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Casual</div>
            <div class="gname">Connect 4</div>
            <div class="gdesc">4-in-a-row wins the covenant escrow.</div>
            <div class="gbadge">Fast</div>
          </div>
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Casual</div>
            <div class="gname">Tic-Tac-Toe</div>
            <div class="gdesc">Provably fair. Instant settlement.</div>
            <div class="gbadge">Fast</div>
          </div>
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Cards</div>
            <div class="gname">Texas Hold em</div>
            <div class="gdesc">Heads-up poker with covenant escrow. No house edge.</div>
            <div class="gbadge">P2P</div>
          </div>
          <div class="mob-game-card" onclick="toggleMobileView()">
            <div class="gcategory">Cards</div>
            <div class="gname">Blackjack</div>
            <div class="gdesc">Peer-to-peer. Zero house edge.</div>
            <div class="gbadge">P2P</div>
          </div>
        </div>
      </div>
      <button class="mob-cta" onclick="toggleMobileView()">Play in Full App &#8599;</button>
    </div>

    <!-- WALLET TAB -->
    <div class="mob-section" id="mob-wallet">

      <!-- Mobile wallets download -->
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Mobile Wallets</div>
          <div class="mob-sec-badge">Recommended</div>
        </div>
        <div class="mob-wallet-dl-grid">
          <a class="mob-wdl-card" href="https://kaspium.io" target="_blank" rel="noopener">
            <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=kaspium.io&sz=64" alt="Kaspium" onerror="this.style.display='none'"/></div>
            <div class="mob-wdl-name">Kaspium</div>
            <div class="mob-wdl-tag">Native Kaspa wallet</div>
            <div class="mob-wdl-platforms"><span class="mob-wdl-os">iOS</span><span class="mob-wdl-os">Android</span></div>
          </a>
          <a class="mob-wdl-card" href="https://dex.cc" target="_blank" rel="noopener">
            <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=dex.cc&sz=64" alt="DEX.cc" onerror="this.style.display='none'"/></div>
            <div class="mob-wdl-name">DEX.cc</div>
            <div class="mob-wdl-tag">Kaspa DeFi wallet</div>
            <div class="mob-wdl-platforms"><span class="mob-wdl-os">iOS</span><span class="mob-wdl-os">Android</span></div>
          </a>
          <a class="mob-wdl-card" href="https://klever.io" target="_blank" rel="noopener">
            <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=klever.io&sz=64" alt="Klever" onerror="this.style.display='none'"/></div>
            <div class="mob-wdl-name">Klever</div>
            <div class="mob-wdl-tag">Multi-chain wallet</div>
            <div class="mob-wdl-platforms"><span class="mob-wdl-os">iOS</span><span class="mob-wdl-os">Android</span></div>
          </a>
        </div>
        <div style="font-size:10px;color:#475569;text-align:center;margin-top:4px">Tap to visit &mdash; download from your device's app store</div>
      </div>

      <div class="mob-divider"></div>

      <!-- Browser extension wallets -->
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Browser Extension</div>
          <div class="mob-sec-badge">Desktop</div>
        </div>
        <div class="mob-bwallet-grid">
          <div class="mob-bw-card" onclick="selWallet('KasWare');updateMobConnBtn()">
            <img src="/img/kasware.png" alt="KasWare"/>
            <span>KasWare</span>
          </div>
          <div class="mob-bw-card" onclick="selWallet('Kastle');updateMobConnBtn()">
            <img src="/img/kastle.png" alt="Kastle"/>
            <span>Kastle</span>
          </div>
          <div class="mob-bw-card" onclick="selWallet('Kasperia');updateMobConnBtn()">
            <img src="/img/kasperia.png" alt="Kasperia"/>
            <span>Kasperia</span>
          </div>
        </div>
        <div id="mobWalletStatus"></div>
      </div>

      <div class="mob-divider"></div>

      <!-- Seed import -->
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Seed Import</div>
        </div>
        <textarea class="mob-input" id="mobMnInput" placeholder="Enter 12 or 24-word mnemonic..."></textarea>
        <button class="mob-btn-primary" onclick="mobConnectMnemonic()">Connect via Mnemonic</button>
      </div>
    </div>

    <!-- PORTFOLIO TAB -->
    <div class="mob-section" id="mob-portfolio">
      <div class="mob-port-stats">
        <div class="mob-pstat"><div class="mob-pstat-val" id="mobPnl">0</div><div class="mob-pstat-lbl">P&amp;L KAS</div></div>
        <div class="mob-pstat"><div class="mob-pstat-val" id="mobOpenPos">0</div><div class="mob-pstat-lbl">Open</div></div>
        <div class="mob-pstat"><div class="mob-pstat-val" id="mobClaimable">0</div><div class="mob-pstat-lbl">Claimable</div></div>
      </div>
      <div class="mob-sec">
        <div class="mob-sec-header">
          <div class="mob-sec-title">Positions</div>
          <div class="mob-sec-badge">0 open</div>
        </div>
        <div style="text-align:center;padding:32px 0">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(73,232,194,.06);border:1px solid rgba(73,232,194,.15);display:flex;align-items:center;justify-content:center;margin:0 auto 10px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#49e8c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <div style="font-size:12px;color:#475569">No active positions</div>
          <div style="font-size:10px;color:#334155;margin-top:4px">Connect wallet to view portfolio</div>
        </div>
      </div>
      <button class="mob-cta" onclick="mobTab('wallet')">Connect Wallet</button>
    </div>

  </div>
</div>"""

js = """<script>
(function(){
  function toggleMobileView(){
    var ov=document.getElementById('mobileOverlay');
    var lbl=document.getElementById('viewToggleLabel');
    var ico=document.getElementById('viewToggleIcon');
    if(ov.classList.contains('active')){
      ov.classList.remove('active');
      if(lbl)lbl.textContent='Mobile';
      if(ico)ico.innerHTML='&#128241;';
    }else{
      ov.classList.add('active');
      if(lbl)lbl.textContent='Desktop';
      if(ico)ico.innerHTML='&#128187;';
      syncMobStats();
    }
  }
  window.toggleMobileView=toggleMobileView;

  window.mobTab=function(name){
    document.querySelectorAll('.mob-section').forEach(function(s){s.classList.remove('mob-active');});
    document.querySelectorAll('.mob-nav-btn').forEach(function(b){b.classList.remove('active');});
    var sec=document.getElementById('mob-'+name);
    var nav=document.getElementById('mnav-'+name);
    if(sec)sec.classList.add('mob-active');
    if(nav)nav.classList.add('active');
  };

  window.updateMobConnBtn=function(){
    setTimeout(function(){
      var btn=document.getElementById('mobConnBtn');
      var ms=document.getElementById('mobWalletStatus');
      var ds=document.getElementById('walletStatus');
      if(window.walletAddress&&btn){
        btn.textContent=window.walletAddress.slice(0,10)+'...';
        btn.style.background='rgba(73,232,194,.12)';
      }
      if(ds&&ms&&ds.innerHTML.trim()){
        ms.innerHTML=ds.innerHTML;
        ms.style.display='block';
      }
    },1500);
  };

  window.mobConnectMnemonic=function(){
    var v=document.getElementById('mobMnInput').value.trim();
    if(!v)return;
    var di=document.querySelector('#htpMnemonicInput');
    if(!di)di=document.querySelector('textarea[placeholder*="mnemonic"]');
    if(di){
      di.value=v;
      var btn=di.closest('div').querySelector('button');
      if(btn)btn.click();
    }
    window.updateMobConnBtn();
  };

  function syncMobStats(){
    var maps=[
      ['mobTotalPool','[id*="totalPool"]'],
      ['mobActiveMarkets','[id*="activeMarkets"]'],
      ['mobPositions','[id*="positions"]']
    ];
    maps.forEach(function(m){
      var src=document.querySelector(m[1]);
      var dst=document.getElementById(m[0]);
      if(src&&dst&&src.textContent.trim())dst.textContent=src.textContent.trim();
    });
  }

  // Auto-open on real mobile devices
  if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
    window.addEventListener('DOMContentLoaded',function(){
      setTimeout(function(){toggleMobileView();},300);
    });
  }
})();
</script>"""

injection = "\n" + css + "\n" + html + "\n" + js + "\n"
h = h.replace('</body>', injection + '</body>', 1)

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print('Toggle button:', 'viewToggleBtn' in h)
print('Mobile overlay:', 'mobileOverlay' in h)
print('Wallet cards:', h.count('mob-w-card') + h.count('mob-wdl-card') + h.count('mob-bw-card'))
print('Nav buttons:', h.count('mob-nav-btn'))
print('Game cards:', h.count('mob-game-card'))
print('DONE')
