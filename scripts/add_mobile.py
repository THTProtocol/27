import re

HTML_PATH = '/workspaces/27/public/index.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    h = f.read()

# Clean previous injections
h = re.sub(r'<style>\s*\/\* ={3,} MOBILE OVERLAY[\s\S]*?<\/style>\s*', '', h)
h = re.sub(r'<style>\s*#mobileOverlay[\s\S]*?<\/style>\s*', '', h)
h = re.sub(r'<div id="mobileOverlay">[\s\S]*?<\/div>\s*(?=\s*<script>\s*\(function)', '', h)
h = re.sub(r'<script>\s*\(function\(\)\{\s*function toggleMobileView[\s\S]*?\}\)\(\);\s*<\/script>', '', h)

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

css = """
<style>
/* ===== MOBILE OVERLAY FULL ===== */
#mobileOverlay{
  display:none;position:fixed;inset:0;
  background:#060a12;
  z-index:9999;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;
}
#mobileOverlay.active{display:flex;flex-direction:column}

/* Scrollable body wrapper */
#mobScrollBody{
  flex:1;overflow-y:auto;overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  padding-bottom:72px;
}

/* Header */
.mob-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:13px 16px 11px;
  border-bottom:1px solid rgba(73,232,194,.1);
  background:rgba(6,10,18,.97);
  backdrop-filter:blur(16px);
  position:relative;z-index:20;flex-shrink:0;
}
.mob-hdr-logo{
  display:flex;align-items:center;gap:7px;
  font-size:14px;font-weight:900;color:#e2e8f0;
  letter-spacing:.07em;text-transform:uppercase;
}
.mob-hdr-dot{
  width:7px;height:7px;border-radius:50%;background:#49e8c2;
  box-shadow:0 0 8px rgba(73,232,194,.8);
  animation:mPulse 2.2s ease-in-out infinite;
}
@keyframes mPulse{0%,100%{opacity:1;box-shadow:0 0 6px rgba(73,232,194,.6)}50%{opacity:.7;box-shadow:0 0 16px rgba(73,232,194,1)}}
.mob-hdr-right{display:flex;align-items:center;gap:7px}
.mob-conn-pill{
  font-size:11px;color:#49e8c2;font-weight:700;cursor:pointer;
  padding:5px 12px;border:1px solid rgba(73,232,194,.3);
  border-radius:20px;background:rgba(73,232,194,.06);
  letter-spacing:.02em;white-space:nowrap;
  transition:background .15s;
}
.mob-conn-pill.connected{background:rgba(73,232,194,.12);border-color:rgba(73,232,194,.5)}
.mob-desktop-btn{
  font-size:11px;color:#64748b;font-weight:600;cursor:pointer;
  padding:5px 10px;border:1px solid rgba(255,255,255,.08);
  border-radius:20px;background:rgba(255,255,255,.03);
  white-space:nowrap;transition:all .15s;
}

/* Bottom nav */
.mob-nav{
  position:absolute;bottom:0;left:0;right:0;
  display:flex;background:rgba(6,10,18,.98);
  border-top:1px solid rgba(73,232,194,.12);
  z-index:20;flex-shrink:0;
  padding-bottom:env(safe-area-inset-bottom,0px);
}
.mob-nav-btn{
  flex:1;display:flex;flex-direction:column;align-items:center;
  gap:3px;padding:8px 2px 6px;
  background:none;border:none;color:#475569;
  cursor:pointer;font-size:8px;font-weight:800;
  text-transform:uppercase;letter-spacing:.06em;
  transition:color .15s;-webkit-tap-highlight-color:transparent;
}
.mob-nav-btn.active{color:#49e8c2}
.mob-nav-btn.active svg{filter:drop-shadow(0 0 5px rgba(73,232,194,.6))}
.mob-nav-icon{display:block;margin-bottom:1px}

/* Sections */
.mob-sec-wrap{display:none;padding:14px 14px 10px}
.mob-sec-wrap.mob-active{display:block}

/* Hero */
.mob-hero{
  background:linear-gradient(135deg,rgba(73,232,194,.05) 0%,rgba(99,102,241,.05) 100%);
  border:1px solid rgba(73,232,194,.12);border-radius:14px;
  padding:18px 16px 16px;margin-bottom:14px;position:relative;overflow:hidden;
}
.mob-hero::before{
  content:'';position:absolute;top:-50px;right:-50px;
  width:160px;height:160px;border-radius:50%;
  background:radial-gradient(circle,rgba(73,232,194,.07) 0%,transparent 70%);
  pointer-events:none;
}
.mob-hero-eyebrow{
  font-size:9px;font-weight:800;color:#49e8c2;
  text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px;
}
.mob-hero-h1{font-size:22px;font-weight:900;color:#f1f5f9;line-height:1.15;margin-bottom:4px}
.mob-hero-h1 em{color:#49e8c2;font-style:normal}
.mob-hero-sub{font-size:11px;color:#64748b;line-height:1.55;margin-bottom:14px}
.mob-stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.mob-stat-card{
  background:rgba(6,10,18,.7);border:1px solid rgba(73,232,194,.09);
  border-radius:10px;padding:10px 6px;text-align:center;
}
.mob-stat-val{font-size:18px;font-weight:900;color:#49e8c2;font-variant-numeric:tabular-nums}
.mob-stat-lbl{font-size:8px;color:#475569;margin-top:2px;text-transform:uppercase;letter-spacing:.07em}

/* Generic section header */
.mob-sh{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:10px;padding-bottom:8px;
  border-bottom:1px solid rgba(73,232,194,.08);
}
.mob-sh-title{font-size:10px;font-weight:800;color:#49e8c2;text-transform:uppercase;letter-spacing:.1em}
.mob-sh-badge{
  font-size:8px;font-weight:700;color:#475569;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  padding:2px 8px;border-radius:10px;
}
.mob-sh-btn{
  font-size:9px;font-weight:700;color:#49e8c2;
  background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.2);
  padding:3px 10px;border-radius:8px;cursor:pointer;
  transition:background .15s;
}
.mob-sh-btn:active{background:rgba(73,232,194,.18)}

/* Market rows */
.mob-market-list{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
.mob-mkt-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 12px;background:rgba(10,15,30,.7);
  border:1px solid rgba(73,232,194,.08);border-radius:11px;
  cursor:pointer;transition:border-color .15s;
}
.mob-mkt-row:active{border-color:rgba(73,232,194,.3)}
.mob-mkt-info{flex:1;min-width:0}
.mob-mkt-name{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mob-mkt-meta{font-size:10px;color:#475569;margin-top:2px}
.mob-mkt-right{text-align:right;flex-shrink:0;margin-left:10px}
.mob-mkt-pool{font-size:13px;font-weight:800;color:#49e8c2}
.mob-mkt-status{
  font-size:8px;font-weight:700;margin-top:2px;
  padding:1px 6px;border-radius:6px;display:inline-block;
}
.mob-mkt-status.live{background:rgba(73,232,194,.1);color:#49e8c2;border:1px solid rgba(73,232,194,.2)}
.mob-mkt-status.closed{background:rgba(100,116,139,.1);color:#64748b;border:1px solid rgba(100,116,139,.2)}

/* Create market form */
.mob-form-card{
  background:rgba(10,15,30,.7);border:1px solid rgba(73,232,194,.1);
  border-radius:12px;padding:14px;margin-bottom:12px;
}
.mob-label{font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:.06em}
.mob-input-field{
  width:100%;box-sizing:border-box;padding:10px 12px;
  background:rgba(6,10,18,.8);border:1px solid rgba(73,232,194,.15);
  color:#e2e8f0;border-radius:9px;font-size:13px;
  font-family:inherit;transition:border-color .15s;
  -webkit-appearance:none;
}
.mob-input-field:focus{outline:none;border-color:rgba(73,232,194,.45)}
textarea.mob-input-field{resize:vertical;min-height:64px;font-family:inherit}
select.mob-input-field{cursor:pointer}
.mob-row-2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.mob-form-sep{height:1px;background:rgba(73,232,194,.07);margin:12px 0}

/* Game grid */
.mob-game-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.mob-game-card{
  background:rgba(10,15,30,.7);border:1px solid rgba(73,232,194,.1);
  border-radius:12px;padding:14px 12px;
  cursor:pointer;transition:all .15s;position:relative;overflow:hidden;
}
.mob-game-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,rgba(73,232,194,.3),transparent);
  opacity:0;transition:opacity .2s;
}
.mob-game-card:active::before{opacity:1}
.mob-game-card:active{border-color:#49e8c2;transform:scale(.98)}
.mob-gc-cat{font-size:8px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
.mob-gc-name{font-size:15px;font-weight:900;color:#e2e8f0;margin-bottom:3px}
.mob-gc-desc{font-size:10px;color:#475569;line-height:1.45;margin-bottom:9px}
.mob-gc-foot{display:flex;align-items:center;justify-content:space-between}
.mob-gc-badge{
  font-size:8px;font-weight:700;color:#49e8c2;
  background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.15);
  padding:2px 7px;border-radius:7px;
}
.mob-gc-arrow{font-size:14px;color:#49e8c2;opacity:.6}

/* Challenge form */
.mob-challenge-panel{
  background:rgba(10,15,30,.8);border:1px solid rgba(73,232,194,.15);
  border-radius:12px;padding:14px;margin-top:8px;display:none;
}
.mob-challenge-panel.open{display:block}
.mob-challenge-title{font-size:12px;font-weight:800;color:#49e8c2;margin-bottom:12px}

/* Bet button row */
.mob-bet-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.mob-bet-chip{
  padding:8px 4px;border:1px solid rgba(73,232,194,.15);
  border-radius:8px;background:rgba(73,232,194,.05);
  color:#49e8c2;font-size:11px;font-weight:700;
  text-align:center;cursor:pointer;transition:all .15s;
}
.mob-bet-chip.selected,.mob-bet-chip:active{background:rgba(73,232,194,.2);border-color:#49e8c2}

/* Wallet section */
.mob-wdl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.mob-wdl-card{
  display:flex;flex-direction:column;align-items:center;
  gap:6px;padding:14px 6px;
  background:rgba(10,15,30,.7);border:1px solid rgba(73,232,194,.1);
  border-radius:12px;text-decoration:none;cursor:pointer;
  transition:all .15s;
}
.mob-wdl-card:active{border-color:#49e8c2;transform:scale(.97)}
.mob-wdl-logo{
  width:42px;height:42px;border-radius:11px;
  background:rgba(73,232,194,.05);border:1px solid rgba(73,232,194,.12);
  display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.mob-wdl-logo img{width:38px;height:38px;border-radius:9px;object-fit:cover}
.mob-wdl-name{font-size:11px;font-weight:800;color:#e2e8f0;text-align:center}
.mob-wdl-sub{font-size:8px;color:#475569;text-align:center;line-height:1.3}
.mob-os-tags{display:flex;gap:3px;flex-wrap:wrap;justify-content:center}
.mob-os-tag{
  font-size:7px;font-weight:700;color:#49e8c2;
  background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.15);
  padding:1px 5px;border-radius:5px;
}
.mob-ext-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mob-ext-card{
  display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:12px 6px;background:rgba(10,15,30,.7);
  border:1px solid rgba(73,232,194,.1);border-radius:11px;
  cursor:pointer;transition:all .15s;
}
.mob-ext-card:active{border-color:#49e8c2;box-shadow:0 0 12px rgba(73,232,194,.1)}
.mob-ext-card img{width:36px;height:36px;border-radius:8px}
.mob-ext-card span{font-size:10px;font-weight:700;color:#e2e8f0;text-align:center}
#mobWalletStatus{
  margin-top:10px;padding:12px;border-radius:10px;
  border:1px solid rgba(73,232,194,.2);background:rgba(10,15,30,.7);
  font-size:12px;display:none;line-height:1.6;
}

/* Portfolio */
.mob-port-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px}
.mob-port-card{
  background:rgba(10,15,30,.8);border:1px solid rgba(73,232,194,.1);
  border-radius:10px;padding:12px 8px;text-align:center;
}
.mob-port-val{font-size:19px;font-weight:900;color:#49e8c2}
.mob-port-lbl{font-size:8px;color:#475569;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.mob-pos-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px;background:rgba(10,15,30,.6);
  border:1px solid rgba(73,232,194,.08);border-radius:10px;margin-bottom:7px;
}
.mob-pos-name{font-size:12px;font-weight:700;color:#e2e8f0}
.mob-pos-meta{font-size:10px;color:#475569;margin-top:2px}
.mob-pos-val{font-size:13px;font-weight:800;color:#49e8c2}
.mob-pos-claim{
  font-size:10px;font-weight:700;color:#49e8c2;
  background:rgba(73,232,194,.1);border:1px solid rgba(73,232,194,.2);
  padding:4px 10px;border-radius:7px;cursor:pointer;
  transition:background .15s;
}
.mob-pos-claim:active{background:rgba(73,232,194,.2)}

/* Settings */
.mob-net-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.mob-net-btn{
  padding:10px;border-radius:10px;border:1px solid rgba(73,232,194,.15);
  background:rgba(10,15,30,.7);color:#94a3b8;font-size:12px;font-weight:700;
  cursor:pointer;text-align:center;transition:all .15s;
}
.mob-net-btn.active,.mob-net-btn:active{background:rgba(73,232,194,.12);border-color:#49e8c2;color:#49e8c2}

/* Divider */
.mob-div{height:1px;background:rgba(73,232,194,.07);margin:14px 0}

/* CTA */
.mob-cta-btn{
  display:block;width:100%;padding:13px;
  background:linear-gradient(135deg,rgba(73,232,194,.1) 0%,rgba(99,102,241,.07) 100%);
  border:1px solid rgba(73,232,194,.25);color:#49e8c2;
  border-radius:12px;cursor:pointer;font-size:13px;font-weight:800;
  text-align:center;letter-spacing:.04em;box-sizing:border-box;
  transition:all .15s;margin-top:10px;
}
.mob-cta-btn:active{transform:scale(.99);background:rgba(73,232,194,.18)}
.mob-cta-btn.secondary{
  background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.1);
  color:#94a3b8;margin-top:8px;
}

/* Toast */
#mobToast{
  position:fixed;bottom:82px;left:50%;transform:translateX(-50%) translateY(10px);
  background:rgba(10,15,30,.97);border:1px solid rgba(73,232,194,.3);
  color:#49e8c2;font-size:12px;font-weight:700;padding:10px 18px;
  border-radius:20px;z-index:99999;opacity:0;
  transition:all .25s;pointer-events:none;white-space:nowrap;
}
#mobToast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* Collapsible */
.mob-collapse-btn{
  display:flex;align-items:center;justify-content:space-between;
  width:100%;padding:10px 12px;margin-bottom:8px;
  background:rgba(10,15,30,.6);border:1px solid rgba(73,232,194,.1);
  border-radius:10px;cursor:pointer;color:#94a3b8;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
}
.mob-collapse-btn .mob-arr{transition:transform .2s;font-size:10px}
.mob-collapse-btn.open .mob-arr{transform:rotate(180deg)}
.mob-collapse-body{display:none;padding:4px 0}
.mob-collapse-body.open{display:block}

/* Info row */
.mob-info-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);
  font-size:12px;
}
.mob-info-row:last-child{border-bottom:none}
.mob-info-key{color:#475569;font-weight:600}
.mob-info-val{color:#e2e8f0;font-weight:700;font-family:monospace;font-size:11px}
</style>
"""

html = """
<div id="mobToast"></div>

<div id="mobileOverlay">

  <!-- HEADER -->
  <div class="mob-hdr">
    <div class="mob-hdr-logo">
      <div class="mob-hdr-dot"></div>
      High Table
    </div>
    <div class="mob-hdr-right">
      <div class="mob-conn-pill" id="mobConnBtn" onclick="mobTab('wallet')">Connect Wallet</div>
      <button class="mob-desktop-btn" onclick="toggleMobileView()">Desktop &#8599;</button>
    </div>
  </div>

  <!-- SCROLL BODY -->
  <div id="mobScrollBody">

    <!-- HERO (shown on markets + games tabs) -->
    <div class="mob-hero" id="mobHero" style="margin:12px 14px 0">
      <div class="mob-hero-eyebrow">High Table Protocol &middot; Kaspa DAG</div>
      <div class="mob-hero-h1">Challenge.<br>Settle on the <em>DAG.</em></div>
      <div class="mob-hero-sub">Provably fair skill games &amp; prediction markets.<br>On-chain covenant settlement.</div>
      <div class="mob-stats-row">
        <div class="mob-stat-card"><div class="mob-stat-val" id="mobStatPool">--</div><div class="mob-stat-lbl">Pool KAS</div></div>
        <div class="mob-stat-card"><div class="mob-stat-val" id="mobStatMkts">--</div><div class="mob-stat-lbl">Markets</div></div>
        <div class="mob-stat-card"><div class="mob-stat-val" id="mobStatPos">--</div><div class="mob-stat-lbl">Positions</div></div>
      </div>
    </div>

    <!-- ===== MARKETS TAB ===== -->
    <div class="mob-sec-wrap mob-active" id="mobTab-markets">

      <!-- Active markets list -->
      <div class="mob-sh" style="margin-top:14px">
        <div class="mob-sh-title">Active Markets</div>
        <div class="mob-sh-badge" id="mobMktCount">Live</div>
      </div>
      <div class="mob-market-list" id="mobMktList">
        <div class="mob-mkt-row">
          <div class="mob-mkt-info"><div class="mob-mkt-name">Connect wallet to view markets</div><div class="mob-mkt-meta">--</div></div>
          <div class="mob-mkt-right"><div class="mob-mkt-pool">-- KAS</div><div class="mob-mkt-status live">Live</div></div>
        </div>
      </div>

      <!-- Create market collapsible -->
      <button class="mob-collapse-btn" onclick="mobToggleCollapse('mobCreateMkt',this)">
        <span>+ Create New Market</span><span class="mob-arr">&#9660;</span>
      </button>
      <div class="mob-collapse-body" id="mobCreateMkt">
        <div class="mob-form-card">
          <label class="mob-label">Market Question</label>
          <input class="mob-input-field" id="mobMktQ" placeholder="e.g. Will KAS reach $1 by Q3 2026?" />
          <div class="mob-row-2">
            <div>
              <label class="mob-label" style="margin-top:8px">Category</label>
              <select class="mob-input-field" id="mobMktCat">
                <option>Crypto Price</option>
                <option>Sports</option>
                <option>Politics</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label class="mob-label" style="margin-top:8px">Resolution</label>
              <input class="mob-input-field" id="mobMktRes" type="date" />
            </div>
          </div>
          <div class="mob-row-2" style="margin-top:0">
            <div>
              <label class="mob-label" style="margin-top:8px">Min Bet (KAS)</label>
              <input class="mob-input-field" id="mobMktMin" type="number" placeholder="10" />
            </div>
            <div>
              <label class="mob-label" style="margin-top:8px">Oracle Address</label>
              <input class="mob-input-field" id="mobMktOracle" placeholder="kaspa:qq..." />
            </div>
          </div>
          <button class="mob-cta-btn" onclick="mobCreateMarket()" style="margin-top:12px">Create Market</button>
        </div>
      </div>

      <!-- Place a bet -->
      <button class="mob-collapse-btn" onclick="mobToggleCollapse('mobPlaceBet',this)" style="margin-top:4px">
        <span>Place a Bet</span><span class="mob-arr">&#9660;</span>
      </button>
      <div class="mob-collapse-body" id="mobPlaceBet">
        <div class="mob-form-card">
          <label class="mob-label">Market ID</label>
          <input class="mob-input-field" id="mobBetMktId" placeholder="Market ID or address" />
          <label class="mob-label" style="margin-top:8px">Your Outcome</label>
          <select class="mob-input-field" id="mobBetOutcome">
            <option value="yes">Yes / Long</option>
            <option value="no">No / Short</option>
            <option value="draw">Draw / Neutral</option>
          </select>
          <label class="mob-label" style="margin-top:8px">Amount (KAS)</label>
          <div class="mob-bet-row">
            <div class="mob-bet-chip" onclick="mobSetBet(10,this)">10</div>
            <div class="mob-bet-chip" onclick="mobSetBet(50,this)">50</div>
            <div class="mob-bet-chip" onclick="mobSetBet(100,this)">100</div>
            <div class="mob-bet-chip" onclick="mobSetBet(250,this)">250</div>
            <div class="mob-bet-chip" onclick="mobSetBet(500,this)">500</div>
            <div class="mob-bet-chip" onclick="mobSetBet(0,this)">Custom</div>
          </div>
          <input class="mob-input-field" id="mobBetAmt" type="number" placeholder="Amount in KAS" style="margin-top:4px"/>
          <button class="mob-cta-btn" onclick="mobPlaceBet()" style="margin-top:10px">Place Bet</button>
        </div>
      </div>
    </div>

    <!-- ===== GAMES TAB ===== -->
    <div class="mob-sec-wrap" id="mobTab-games">
      <div class="mob-sh" style="margin-top:14px">
        <div class="mob-sh-title">Skill Games</div>
        <div class="mob-sh-badge">On-chain</div>
      </div>

      <div class="mob-game-grid">
        <div class="mob-game-card" onclick="mobOpenGame('chess')">
          <div class="mob-gc-cat">Strategy</div>
          <div class="mob-gc-name">Chess</div>
          <div class="mob-gc-desc">FIDE rules. Covenant escrow. On-chain settlement.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">Heads-up</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
        <div class="mob-game-card" onclick="mobOpenGame('checkers')">
          <div class="mob-gc-cat">Strategy</div>
          <div class="mob-gc-name">Checkers</div>
          <div class="mob-gc-desc">Full replay proof committed to the DAG.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">Heads-up</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
        <div class="mob-game-card" onclick="mobOpenGame('connect4')">
          <div class="mob-gc-cat">Casual</div>
          <div class="mob-gc-name">Connect 4</div>
          <div class="mob-gc-desc">4-in-a-row wins the covenant escrow.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">Fast</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
        <div class="mob-game-card" onclick="mobOpenGame('tictactoe')">
          <div class="mob-gc-cat">Casual</div>
          <div class="mob-gc-name">Tic-Tac-Toe</div>
          <div class="mob-gc-desc">Provably fair. Instant on-chain result.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">Fast</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
        <div class="mob-game-card" onclick="mobOpenGame('holdem')">
          <div class="mob-gc-cat">Cards</div>
          <div class="mob-gc-name">Texas Hold'em</div>
          <div class="mob-gc-desc">Heads-up poker. Covenant escrow. No house edge.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">P2P</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
        <div class="mob-game-card" onclick="mobOpenGame('blackjack')">
          <div class="mob-gc-cat">Cards</div>
          <div class="mob-gc-name">Blackjack</div>
          <div class="mob-gc-desc">Peer-to-peer. Zero house edge. DAG settled.</div>
          <div class="mob-gc-foot"><span class="mob-gc-badge">P2P</span><span class="mob-gc-arrow">&#8250;</span></div>
        </div>
      </div>

      <!-- Challenge / Join panel -->
      <div class="mob-sh" style="margin-top:6px">
        <div class="mob-sh-title">Challenge / Join</div>
      </div>
      <div class="mob-form-card">
        <label class="mob-label">Game</label>
        <select class="mob-input-field" id="mobChalGame">
          <option value="chess">Chess</option>
          <option value="checkers">Checkers</option>
          <option value="connect4">Connect 4</option>
          <option value="tictactoe">Tic-Tac-Toe</option>
          <option value="holdem">Texas Hold'em</option>
          <option value="blackjack">Blackjack</option>
        </select>
        <label class="mob-label" style="margin-top:8px">Opponent Address (leave blank to open lobby)</label>
        <input class="mob-input-field" id="mobChalOpp" placeholder="kaspa:qq... (optional)" />
        <label class="mob-label" style="margin-top:8px">Stake (KAS)</label>
        <div class="mob-bet-row">
          <div class="mob-bet-chip" onclick="mobSetStake(10,this)">10</div>
          <div class="mob-bet-chip" onclick="mobSetStake(50,this)">50</div>
          <div class="mob-bet-chip" onclick="mobSetStake(100,this)">100</div>
          <div class="mob-bet-chip" onclick="mobSetStake(500,this)">500</div>
          <div class="mob-bet-chip" onclick="mobSetStake(1000,this)">1K</div>
          <div class="mob-bet-chip" onclick="mobSetStake(0,this)">Custom</div>
        </div>
        <input class="mob-input-field" id="mobChalStake" type="number" placeholder="Stake in KAS" style="margin-top:4px"/>
        <button class="mob-cta-btn" onclick="mobChallenge()" style="margin-top:10px">Challenge / Create Match</button>
        <div class="mob-form-sep"></div>
        <label class="mob-label">Join Existing Match</label>
        <input class="mob-input-field" id="mobJoinId" placeholder="Match ID or escrow address" />
        <button class="mob-cta-btn secondary" onclick="mobJoinMatch()">Join Match</button>
      </div>
    </div>

    <!-- ===== WALLET TAB ===== -->
    <div class="mob-sec-wrap" id="mobTab-wallet">

      <div class="mob-sh" style="margin-top:14px">
        <div class="mob-sh-title">Mobile Wallets</div>
        <div class="mob-sh-badge">Recommended</div>
      </div>
      <div class="mob-wdl-grid">
        <a class="mob-wdl-card" href="https://kaspium.io" target="_blank" rel="noopener">
          <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=kaspium.io&sz=64" alt="Kaspium" onerror="this.style.display='none'"/></div>
          <div class="mob-wdl-name">Kaspium</div>
          <div class="mob-wdl-sub">Native Kaspa wallet</div>
          <div class="mob-os-tags"><span class="mob-os-tag">iOS</span><span class="mob-os-tag">Android</span></div>
        </a>
        <a class="mob-wdl-card" href="https://dex.cc" target="_blank" rel="noopener">
          <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=dex.cc&sz=64" alt="DEX.cc" onerror="this.style.display='none'"/></div>
          <div class="mob-wdl-name">DEX.cc</div>
          <div class="mob-wdl-sub">Kaspa DeFi wallet</div>
          <div class="mob-os-tags"><span class="mob-os-tag">iOS</span><span class="mob-os-tag">Android</span></div>
        </a>
        <a class="mob-wdl-card" href="https://klever.io" target="_blank" rel="noopener">
          <div class="mob-wdl-logo"><img src="https://www.google.com/s2/favicons?domain=klever.io&sz=64" alt="Klever" onerror="this.style.display='none'"/></div>
          <div class="mob-wdl-name">Klever</div>
          <div class="mob-wdl-sub">Multi-chain wallet</div>
          <div class="mob-os-tags"><span class="mob-os-tag">iOS</span><span class="mob-os-tag">Android</span></div>
        </a>
      </div>
      <div style="font-size:10px;color:#334155;text-align:center;margin-bottom:14px">Tap to visit &mdash; install from your app store, then use mnemonic import below</div>

      <div class="mob-div"></div>

      <div class="mob-sh">
        <div class="mob-sh-title">Browser Extension</div>
        <div class="mob-sh-badge">Desktop Chrome</div>
      </div>
      <div class="mob-ext-grid">
        <div class="mob-ext-card" onclick="selWallet('KasWare');updateMobConnBtn()">
          <img src="/img/kasware.png" alt="KasWare" /><span>KasWare</span>
        </div>
        <div class="mob-ext-card" onclick="selWallet('Kastle');updateMobConnBtn()">
          <img src="/img/kastle.png" alt="Kastle" /><span>Kastle</span>
        </div>
        <div class="mob-ext-card" onclick="selWallet('Kasperia');updateMobConnBtn()">
          <img src="/img/kasperia.png" alt="Kasperia" /><span>Kasperia</span>
        </div>
      </div>
      <div id="mobWalletStatus"></div>

      <div class="mob-div"></div>

      <div class="mob-sh">
        <div class="mob-sh-title">Mnemonic Import</div>
      </div>
      <div class="mob-form-card">
        <label class="mob-label">12 or 24-word Seed Phrase</label>
        <textarea class="mob-input-field" id="mobMnInput" placeholder="word1 word2 word3 ..."></textarea>
        <button class="mob-cta-btn" onclick="mobConnectMnemonic()" style="margin-top:10px">Connect via Mnemonic</button>
      </div>

      <!-- Wallet info after connection -->
      <div id="mobWalletDetail" style="display:none">
        <div class="mob-div"></div>
        <div class="mob-sh"><div class="mob-sh-title">Wallet Info</div></div>
        <div class="mob-form-card">
          <div class="mob-info-row"><span class="mob-info-key">Address</span><span class="mob-info-val" id="mobWalAddr">--</span></div>
          <div class="mob-info-row"><span class="mob-info-key">Balance</span><span class="mob-info-val" id="mobWalBal">-- KAS</span></div>
          <div class="mob-info-row"><span class="mob-info-key">Network</span><span class="mob-info-val" id="mobWalNet">--</span></div>
          <div class="mob-info-row"><span class="mob-info-key">Provider</span><span class="mob-info-val" id="mobWalProv">--</span></div>
        </div>
        <button class="mob-cta-btn" onclick="mobSendKas()">Send KAS</button>
      </div>

      <!-- Send KAS panel -->
      <div id="mobSendPanel" style="display:none;margin-top:10px">
        <div class="mob-form-card">
          <label class="mob-label">Recipient Address</label>
          <input class="mob-input-field" id="mobSendTo" placeholder="kaspa:qq..." />
          <label class="mob-label" style="margin-top:8px">Amount (KAS)</label>
          <input class="mob-input-field" id="mobSendAmt" type="number" placeholder="0.00" />
          <button class="mob-cta-btn" onclick="mobConfirmSend()" style="margin-top:10px">Confirm Send</button>
          <button class="mob-cta-btn secondary" onclick="document.getElementById('mobSendPanel').style.display='none'">Cancel</button>
        </div>
      </div>
    </div>

    <!-- ===== PORTFOLIO TAB ===== -->
    <div class="mob-sec-wrap" id="mobTab-portfolio">
      <div class="mob-port-grid" style="margin-top:14px">
        <div class="mob-port-card"><div class="mob-port-val" id="mobPortPnl">0</div><div class="mob-port-lbl">P&amp;L KAS</div></div>
        <div class="mob-port-card"><div class="mob-port-val" id="mobPortOpen">0</div><div class="mob-port-lbl">Open</div></div>
        <div class="mob-port-card"><div class="mob-port-val" id="mobPortClaim">0</div><div class="mob-port-lbl">Claimable</div></div>
      </div>

      <div class="mob-sh">
        <div class="mob-sh-title">Open Positions</div>
        <button class="mob-sh-btn" onclick="mobRefreshPortfolio()">Refresh</button>
      </div>
      <div id="mobPosList">
        <div style="text-align:center;padding:28px 0">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(73,232,194,.05);border:1px solid rgba(73,232,194,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 10px">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#49e8c2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          </div>
          <div style="font-size:12px;color:#475569">No open positions</div>
          <div style="font-size:10px;color:#334155;margin-top:4px">Connect wallet to view portfolio</div>
        </div>
      </div>

      <div class="mob-sh" style="margin-top:8px">
        <div class="mob-sh-title">Claim Winnings</div>
      </div>
      <div class="mob-form-card">
        <label class="mob-label">Match / Market ID</label>
        <input class="mob-input-field" id="mobClaimId" placeholder="Match ID or escrow address" />
        <button class="mob-cta-btn" onclick="mobClaimWinnings()" style="margin-top:10px">Claim Winnings</button>
      </div>

      <div class="mob-sh" style="margin-top:8px">
        <div class="mob-sh-title">Active Matches</div>
        <button class="mob-sh-btn" onclick="mobRefreshMatches()">Refresh</button>
      </div>
      <div id="mobMatchList">
        <div style="font-size:12px;color:#475569;text-align:center;padding:16px 0">No active matches</div>
      </div>
    </div>

    <!-- ===== SETTINGS TAB ===== -->
    <div class="mob-sec-wrap" id="mobTab-settings">
      <div class="mob-sh" style="margin-top:14px">
        <div class="mob-sh-title">Network</div>
      </div>
      <div class="mob-net-row">
        <button class="mob-net-btn active" id="mobNetMainBtn" onclick="mobSetNetwork('mainnet')">Mainnet</button>
        <button class="mob-net-btn" id="mobNetTestBtn" onclick="mobSetNetwork('testnet')">Testnet</button>
      </div>

      <div class="mob-sh">
        <div class="mob-sh-title">RPC Node</div>
      </div>
      <div class="mob-form-card">
        <label class="mob-label">Node URL</label>
        <input class="mob-input-field" id="mobRpcUrl" placeholder="wss://... or https://..." />
        <button class="mob-cta-btn" onclick="mobSetRpc()" style="margin-top:10px">Connect Node</button>
      </div>

      <div class="mob-div"></div>

      <div class="mob-sh">
        <div class="mob-sh-title">Escrow Mnemonic</div>
      </div>
      <div class="mob-form-card">
        <label class="mob-label">Escrow Wallet Seed (for match payouts)</label>
        <textarea class="mob-input-field" id="mobEscrowMn" placeholder="12 or 24-word escrow mnemonic..."></textarea>
        <div style="font-size:10px;color:#334155;margin-top:6px">Stored in localStorage only. Never transmitted. Used to sign payout TXs.</div>
        <button class="mob-cta-btn" onclick="mobSaveEscrow()" style="margin-top:10px">Save Escrow Mnemonic</button>
      </div>

      <div class="mob-div"></div>

      <div class="mob-sh"><div class="mob-sh-title">About</div></div>
      <div class="mob-form-card">
        <div class="mob-info-row"><span class="mob-info-key">Version</span><span class="mob-info-val">HTP Mobile v2</span></div>
        <div class="mob-info-row"><span class="mob-info-key">Network</span><span class="mob-info-val" id="mobAboutNet">mainnet</span></div>
        <div class="mob-info-row"><span class="mob-info-key">Chain</span><span class="mob-info-val">Kaspa DAG</span></div>
      </div>
    </div>

  </div><!-- end #mobScrollBody -->

  <!-- BOTTOM NAV -->
  <nav class="mob-nav">
    <button class="mob-nav-btn active" onclick="mobTab('markets')" id="mnav-markets">
      <svg class="mob-nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="12" width="4" height="10"/><rect x="9" y="7" width="4" height="15"/><rect x="16" y="3" width="4" height="19"/></svg>
      Markets
    </button>
    <button class="mob-nav-btn" onclick="mobTab('games')" id="mnav-games">
      <svg class="mob-nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4M15 11h2M15 13h2"/></svg>
      Games
    </button>
    <button class="mob-nav-btn" onclick="mobTab('wallet')" id="mnav-wallet">
      <svg class="mob-nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 12h2"/><path d="M2 7l4-4h12l4 4"/></svg>
      Wallet
    </button>
    <button class="mob-nav-btn" onclick="mobTab('portfolio')" id="mnav-portfolio">
      <svg class="mob-nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Portfolio
    </button>
    <button class="mob-nav-btn" onclick="mobTab('settings')" id="mnav-settings">
      <svg class="mob-nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      Settings
    </button>
  </nav>

</div>
"""

js = """
<script>
(function(){

  /* ---- Core toggle ---- */
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
      mobSyncAll();
    }
  }
  window.toggleMobileView=toggleMobileView;

  /* ---- Tab switching ---- */
  window.mobTab=function(name){
    document.querySelectorAll('.mob-sec-wrap').forEach(function(s){s.classList.remove('mob-active');});
    document.querySelectorAll('.mob-nav-btn').forEach(function(b){b.classList.remove('active');});
    var sec=document.getElementById('mobTab-'+name);
    var nav=document.getElementById('mnav-'+name);
    if(sec)sec.classList.add('mob-active');
    if(nav)nav.classList.add('active');
    var hero=document.getElementById('mobHero');
    if(hero)hero.style.display=(name==='markets'||name==='games')?'block':'none';
    var sb=document.getElementById('mobScrollBody');
    if(sb)sb.scrollTop=0;
  };

  /* ---- Collapse ---- */
  window.mobToggleCollapse=function(id,btn){
    var el=document.getElementById(id);
    if(!el)return;
    el.classList.toggle('open');
    if(btn)btn.classList.toggle('open');
  };

  /* ---- Toast ---- */
  function mobToast(msg,dur){
    var t=document.getElementById('mobToast');
    if(!t)return;
    t.textContent=msg;
    t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},(dur||2200));
  }
  window.mobToast=mobToast;

  /* ---- Wallet connection ---- */
  window.updateMobConnBtn=function(){
    setTimeout(function(){
      var btn=document.getElementById('mobConnBtn');
      var ms=document.getElementById('mobWalletStatus');
      var ds=document.getElementById('walletStatus');
      if(window.walletAddress&&btn){
        var short=window.walletAddress.slice(0,12)+'...';
        btn.textContent=short;
        btn.classList.add('connected');
      }
      if(ds&&ms&&ds.innerHTML.trim()){
        ms.innerHTML=ds.innerHTML;
        ms.style.display='block';
      }
      mobUpdateWalletDetail();
    },1500);
  };

  function mobUpdateWalletDetail(){
    if(!window.walletAddress)return;
    var d=document.getElementById('mobWalletDetail');
    if(d)d.style.display='block';
    var addr=document.getElementById('mobWalAddr');
    var bal=document.getElementById('mobWalBal');
    var net=document.getElementById('mobWalNet');
    var prov=document.getElementById('mobWalProv');
    if(addr)addr.textContent=window.walletAddress;
    if(bal&&window.walletBalance){
      var kas=(window.walletBalance.total/1e8).toFixed(2);
      bal.textContent=kas+' KAS';
    }
    if(net)net.textContent=window.htpNetwork||'mainnet';
    if(prov)prov.textContent=window.walletProvider||'--';
  }

  window.mobConnectMnemonic=function(){
    var v=document.getElementById('mobMnInput').value.trim();
    if(!v){mobToast('Enter mnemonic first');return;}
    var di=document.querySelector('#htpMnemonicInput,#mnInput,textarea[placeholder*="mnemonic"]');
    if(di){
      di.value=v;
      var form=di.closest('form,div');
      if(form){
        var btn=form.querySelector('button[onclick*="mnemonic"],button[onclick*="connect"],button[onclick*="Connect"]');
        if(!btn)btn=form.querySelector('button');
        if(btn)btn.click();
      }
    }
    setTimeout(function(){window.updateMobConnBtn();},1800);
    mobToast('Connecting...');
  };

  /* ---- Send KAS ---- */
  window.mobSendKas=function(){
    var p=document.getElementById('mobSendPanel');
    if(p)p.style.display=p.style.display==='none'?'block':'none';
  };
  window.mobConfirmSend=function(){
    var to=document.getElementById('mobSendTo').value.trim();
    var amt=parseFloat(document.getElementById('mobSendAmt').value);
    if(!to||!amt){mobToast('Enter address and amount');return;}
    if(typeof htpSend==='function'){
      htpSend(to,Math.round(amt*1e8)).then(function(){mobToast('TX sent!');}).catch(function(e){mobToast('Error: '+e.message);});
    } else if(typeof sendKas==='function'){
      sendKas(to,amt);
    } else {
      mobToast('Connect wallet first');
    }
  };

  /* ---- Create market ---- */
  window.mobCreateMarket=function(){
    if(!window.walletAddress){mobToast('Connect wallet first');return;}
    var q=document.getElementById('mobMktQ').value.trim();
    var cat=document.getElementById('mobMktCat').value;
    var res=document.getElementById('mobMktRes').value;
    var min=parseFloat(document.getElementById('mobMktMin').value)||10;
    var oracle=document.getElementById('mobMktOracle').value.trim();
    if(!q){mobToast('Enter market question');return;}
    // Wire to desktop create market function
    if(typeof createMarket==='function'){
      createMarket({question:q,category:cat,resolution:res,minBet:min,oracle:oracle});
      mobToast('Creating market...');
    } else if(typeof htpCreateMarket==='function'){
      htpCreateMarket(q,cat,res,min,oracle);
      mobToast('Creating market...');
    } else {
      // Mirror to desktop form and click
      var dq=document.querySelector('#marketQuestion,#mktQuestion,input[placeholder*="question"],input[placeholder*="Question"]');
      if(dq){dq.value=q;}
      var dcreate=document.querySelector('#createMarketBtn,button[onclick*="createMarket"]');
      if(dcreate){dcreate.click();mobToast('Market submitted');}
      else mobToast('Use desktop to create market');
    }
  };

  /* ---- Place bet ---- */
  var mobBetAmount=0;
  window.mobSetBet=function(amt,el){
    document.querySelectorAll('.mob-bet-chip').forEach(function(c){c.classList.remove('selected');});
    if(el)el.classList.add('selected');
    if(amt>0)document.getElementById('mobBetAmt').value=amt;
    mobBetAmount=amt;
  };
  window.mobPlaceBet=function(){
    if(!window.walletAddress){mobToast('Connect wallet first');return;}
    var mkt=document.getElementById('mobBetMktId').value.trim();
    var outcome=document.getElementById('mobBetOutcome').value;
    var amt=parseFloat(document.getElementById('mobBetAmt').value);
    if(!mkt||!amt){mobToast('Fill in all fields');return;}
    if(typeof placeBet==='function'){placeBet(mkt,outcome,amt);mobToast('Bet placed!');}
    else if(typeof htpPlaceBet==='function'){htpPlaceBet(mkt,outcome,amt);mobToast('Placing bet...');}
    else{mobToast('Use desktop to place bet');}
  };

  /* ---- Games ---- */
  window.mobOpenGame=function(game){
    // Switch to games tab and open challenge form
    mobTab('games');
    var sel=document.getElementById('mobChalGame');
    if(sel)sel.value=game;
    var panel=document.getElementById('mobChalPanel');
    if(panel){panel.classList.add('open');}
    // Also try to activate the desktop game tab
    var desktopGameBtns=document.querySelectorAll('[onclick*="'+game+'"],[data-game="'+game+'"]');
    if(desktopGameBtns.length>0)desktopGameBtns[0].click();
    mobToast(game.charAt(0).toUpperCase()+game.slice(1)+' selected');
  };

  var mobStakeAmount=0;
  window.mobSetStake=function(amt,el){
    document.querySelectorAll('#mobTab-games .mob-bet-chip').forEach(function(c){c.classList.remove('selected');});
    if(el)el.classList.add('selected');
    if(amt>0)document.getElementById('mobChalStake').value=amt;
    mobStakeAmount=amt;
  };

  window.mobChallenge=function(){
    if(!window.walletAddress){mobToast('Connect wallet first');return;}
    var game=document.getElementById('mobChalGame').value;
    var opp=document.getElementById('mobChalOpp').value.trim();
    var stake=parseFloat(document.getElementById('mobChalStake').value);
    if(!stake){mobToast('Enter stake amount');return;}
    // Try desktop challenge functions
    if(typeof createChallenge==='function'){createChallenge(game,opp,stake);mobToast('Challenge created!');return;}
    if(typeof htpCreateChallenge==='function'){htpCreateChallenge(game,opp,stake);mobToast('Challenge sent!');return;}
    if(typeof challengePlayer==='function'){challengePlayer(opp,game,stake);mobToast('Challenge sent!');return;}
    // Fallback: mirror to desktop form
    var dg=document.querySelector('select[id*="game"],select[id*="Game"]');
    if(dg)dg.value=game;
    var do_=document.querySelector('input[id*="opponent"],input[placeholder*="opponent"],input[placeholder*="address"]');
    if(do_)do_.value=opp;
    var ds=document.querySelector('input[id*="stake"],input[id*="amount"],input[placeholder*="KAS"]');
    if(ds)ds.value=stake;
    var db=document.querySelector('button[onclick*="challenge"],button[onclick*="Challenge"],#challengeBtn');
    if(db){db.click();mobToast('Challenge submitted!');}
    else mobToast('Challenge ready on desktop');
  };

  window.mobJoinMatch=function(){
    if(!window.walletAddress){mobToast('Connect wallet first');return;}
    var id=document.getElementById('mobJoinId').value.trim();
    if(!id){mobToast('Enter match ID');return;}
    if(typeof joinMatch==='function'){joinMatch(id);mobToast('Joining match...');return;}
    if(typeof htpJoinMatch==='function'){htpJoinMatch(id);mobToast('Joining...');return;}
    var di=document.querySelector('input[id*="joinId"],input[id*="matchId"],input[placeholder*="match"]');
    if(di){di.value=id;}
    var db=document.querySelector('button[onclick*="join"],button[onclick*="Join"],#joinBtn');
    if(db){db.click();mobToast('Joining match...');}
    else mobToast('Enter match ID on desktop');
  };

  /* ---- Portfolio ---- */
  window.mobRefreshPortfolio=function(){
    if(typeof refreshPortfolio==='function'){refreshPortfolio();mobToast('Refreshing...');}
    else if(typeof htpLoadPositions==='function'){htpLoadPositions();mobToast('Loading...');}
    else mobToast('Syncing from desktop...');
    setTimeout(mobSyncPortfolio,1500);
  };

  window.mobRefreshMatches=function(){
    if(typeof loadMatches==='function'){loadMatches();}
    else if(typeof htpLoadMatches==='function'){htpLoadMatches();}
    setTimeout(mobSyncMatches,1500);
  };

  window.mobClaimWinnings=function(){
    if(!window.walletAddress){mobToast('Connect wallet first');return;}
    var id=document.getElementById('mobClaimId').value.trim();
    if(!id){mobToast('Enter match/market ID');return;}
    if(typeof claimWinnings==='function'){claimWinnings(id);mobToast('Claiming...');return;}
    if(typeof htpClaim==='function'){htpClaim(id);mobToast('Claiming...');return;}
    var di=document.querySelector('input[id*="claim"],input[placeholder*="claim"]');
    if(di){di.value=id;}
    var db=document.querySelector('button[onclick*="claim"],button[onclick*="Claim"],#claimBtn');
    if(db){db.click();mobToast('Claiming winnings...');}
    else mobToast('Use desktop to claim');
  };

  function mobSyncPortfolio(){
    var pnlEl=document.querySelector('#pnlDisplay,#totalPnl,[id*="pnl"]');
    var openEl=document.querySelector('#openPositions,[id*="openPos"]');
    var claimEl=document.querySelector('#claimable,[id*="claimable"]');
    if(pnlEl)document.getElementById('mobPortPnl').textContent=pnlEl.textContent.trim()||'0';
    if(openEl)document.getElementById('mobPortOpen').textContent=openEl.textContent.trim()||'0';
    if(claimEl)document.getElementById('mobPortClaim').textContent=claimEl.textContent.trim()||'0';
  }

  function mobSyncMatches(){
    var ml=document.getElementById('mobMatchList');
    if(!ml)return;
    var desktopMatches=document.querySelectorAll('.match-row,.game-row,[class*="matchRow"],[class*="match-item"]');
    if(desktopMatches.length===0)return;
    ml.innerHTML='';
    desktopMatches.forEach(function(m){
      var clone=m.cloneNode(true);
      clone.style.cssText='font-size:12px;padding:10px;background:rgba(10,15,30,.6);border:1px solid rgba(73,232,194,.08);border-radius:9px;margin-bottom:6px;';
      ml.appendChild(clone);
    });
  }

  /* ---- Settings ---- */
  window.mobSetNetwork=function(net){
    document.getElementById('mobNetMainBtn').classList.toggle('active',net==='mainnet');
    document.getElementById('mobNetTestBtn').classList.toggle('active',net!=='mainnet');
    var an=document.getElementById('mobAboutNet');
    if(an)an.textContent=net;
    if(typeof htpSetNetwork==='function')htpSetNetwork(net==='mainnet'?'mainnet':'tn12');
    mobToast('Switched to '+net);
  };

  window.mobSetRpc=function(){
    var url=document.getElementById('mobRpcUrl').value.trim();
    if(!url){mobToast('Enter RPC URL');return;}
    if(typeof htpConnectNode==='function')htpConnectNode(url);
    var di=document.querySelector('input[id*="rpc"],input[id*="node"],input[placeholder*="wss"]');
    if(di){di.value=url;var btn=di.closest('div').querySelector('button');if(btn)btn.click();}
    mobToast('Connecting to node...');
  };

  window.mobSaveEscrow=function(){
    var v=document.getElementById('mobEscrowMn').value.trim();
    if(!v||v.split(' ').length<12){mobToast('Enter valid 12/24 word mnemonic');return;}
    localStorage.setItem('htpEscrowMnemonic',v);
    var di=document.querySelector('#htpEscrowInput,textarea[placeholder*="escrow"]');
    if(di){di.value=v;var btn=di.closest('div').querySelector('button');if(btn)btn.click();}
    document.getElementById('mobEscrowMn').value='';
    mobToast('Escrow mnemonic saved');
  };

  /* ---- Sync stats from desktop DOM ---- */
  function mobSyncAll(){
    var maps=[
      ['mobStatPool','[id*="totalPool"],[id*="poolTotal"]'],
      ['mobStatMkts','[id*="activeMarkets"],[id*="marketCount"]'],
      ['mobStatPos','[id*="positions"],[id*="positionCount"]'],
    ];
    maps.forEach(function(m){
      var src=document.querySelector(m[1]);
      var dst=document.getElementById(m[0]);
      if(src&&dst&&src.textContent.trim())dst.textContent=src.textContent.trim();
    });
    mobUpdateWalletDetail();
    mobSyncPortfolio();
  }

  /* ---- Auto-open on real mobile ---- */
  if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
    window.addEventListener('load',function(){
      setTimeout(function(){toggleMobileView();},400);
    });
  }

  /* ---- Poll wallet state every 5s when overlay is open ---- */
  setInterval(function(){
    var ov=document.getElementById('mobileOverlay');
    if(ov&&ov.classList.contains('active')&&window.walletAddress){
      mobUpdateWalletDetail();
    }
  },5000);

})();
</script>
"""

injection = "\n" + css + "\n" + html + "\n" + js + "\n"
h = h.replace('</body>', injection + '</body>', 1)

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print('Toggle button:', 'viewToggleBtn' in h)
print('Mobile overlay:', 'mobileOverlay' in h)
print('Game cards:', h.count('mob-game-card'))
print('Nav tabs:', h.count('mob-nav-btn'))
print('Forms:', h.count('mob-input-field'))
print('DONE')
