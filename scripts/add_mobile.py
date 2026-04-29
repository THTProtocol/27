import re

HTML_PATH = '/workspaces/27/public/index.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    h = f.read()

# Strip any previous partial injections
h = re.sub(r'<style>\s*#mobileOverlay[\s\S]*?</style>\s*', '', h)
h = re.sub(r'<div id="mobileOverlay">[\s\S]*?</div>\s*\n\s*<script>\s*\(function\(\)\{', '', h)
h = re.sub(r'<!-- MOBILE OVERLAY -->[\s\S]*?</script>\s*(?=</body>)', '', h)

# Inject toggle button before cBtn if not already there
if 'viewToggleBtn' not in h:
    h = h.replace(
        '<button id="cBtn"',
        '<button id="viewToggleBtn" onclick="toggleMobileView()" style="margin-right:8px;padding:6px 14px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.25);color:#49e8c2;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.03em;display:inline-flex;align-items:center;gap:6px"><span id="viewToggleIcon">&#128241;</span><span id="viewToggleLabel">Mobile</span></button><button id="cBtn"',
        1
    )

css = """<style>
#mobileOverlay{display:none;position:fixed;inset:0;background:#060a12;z-index:9999;overflow-y:auto;font-family:inherit}
#mobileOverlay.active{display:flex;flex-direction:column}
.mob-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid rgba(73,232,194,.15);position:sticky;top:0;background:#060a12;z-index:10}
.mob-logo{font-size:15px;font-weight:900;color:#49e8c2;letter-spacing:.08em;text-transform:uppercase}
.mob-close{background:none;border:1px solid rgba(73,232,194,.25);color:#49e8c2;font-size:12px;font-weight:700;cursor:pointer;padding:5px 12px;border-radius:7px;letter-spacing:.03em}
.mob-body{padding:14px 14px 80px;flex:1}
.mob-wallet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.mob-w-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:10px;border:1px solid rgba(73,232,194,.18);background:rgba(10,15,30,.9);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.mob-w-card:hover,.mob-w-card:active{border-color:#49e8c2;box-shadow:0 0 14px rgba(73,232,194,.15)}
.mob-w-card img{width:34px;height:34px;border-radius:7px}
.mob-w-card span{font-size:10px;font-weight:700;color:#e2e8f0;text-align:center}
.mob-sec{margin-bottom:20px}
.mob-sec-title{font-size:10px;font-weight:800;color:#49e8c2;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(73,232,194,.12)}
.mob-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px}
.mob-stat{background:rgba(10,15,30,.8);border:1px solid rgba(73,232,194,.1);border-radius:8px;padding:10px 6px;text-align:center}
.mob-stat-val{font-size:16px;font-weight:900;color:#49e8c2}
.mob-stat-lbl{font-size:9px;color:#475569;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}
.mob-game-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.mob-game-card{background:rgba(10,15,30,.8);border:1px solid rgba(73,232,194,.12);border-radius:10px;padding:14px 12px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.mob-game-card:hover,.mob-game-card:active{border-color:#49e8c2;box-shadow:0 0 14px rgba(73,232,194,.1)}
.mob-game-card .gname{font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:3px}
.mob-game-card .gdesc{font-size:10px;color:#475569;line-height:1.45}
.mob-nav{position:fixed;bottom:0;left:0;right:0;display:flex;background:rgba(6,10,18,.98);border-top:1px solid rgba(73,232,194,.18);z-index:10000}
.mob-nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 4px 7px;background:none;border:none;color:#475569;cursor:pointer;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;transition:color .15s}
.mob-nav-btn.active{color:#49e8c2}
.mob-nav-btn svg{display:block}
#mobWalletStatus{margin-top:10px;padding:10px 12px;border-radius:8px;border:1px solid rgba(73,232,194,.2);background:rgba(10,15,30,.7);font-size:12px;display:none}
.mob-input{width:100%;box-sizing:border-box;padding:10px 12px;background:rgba(10,15,30,.8);border:1px solid rgba(73,232,194,.2);color:#e2e8f0;border-radius:8px;font-size:12px;font-family:monospace;resize:vertical;min-height:68px}
.mob-btn-primary{margin-top:8px;width:100%;padding:11px;background:rgba(73,232,194,.1);border:1px solid rgba(73,232,194,.3);color:#49e8c2;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;letter-spacing:.03em;transition:background .15s}
.mob-btn-primary:hover{background:rgba(73,232,194,.18)}
.mob-section{display:none}
.mob-section.mob-active{display:block}
.mob-open-desktop{display:block;width:100%;margin-top:14px;padding:12px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.2);color:#49e8c2;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;text-align:center;letter-spacing:.03em;box-sizing:border-box;transition:background .15s}
.mob-open-desktop:hover{background:rgba(73,232,194,.15)}
</style>"""

html = """<div id="mobileOverlay">
  <div class="mob-header">
    <div class="mob-logo">High Table</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div id="mobConnBtn" onclick="mobTab('wallet')" style="font-size:11px;color:#49e8c2;font-weight:700;cursor:pointer;padding:5px 10px;border:1px solid rgba(73,232,194,.25);border-radius:7px">Connect</div>
      <button class="mob-close" onclick="toggleMobileView()">Desktop</button>
    </div>
  </div>
  <nav class="mob-nav">
    <button class="mob-nav-btn active" onclick="mobTab('markets')" id="mnav-markets">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="12" width="4" height="10"/><rect x="9" y="7" width="4" height="15"/><rect x="16" y="3" width="4" height="19"/></svg>
      Markets
    </button>
    <button class="mob-nav-btn" onclick="mobTab('games')" id="mnav-games">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4M8 10v4M15 11h2M15 13h2"/></svg>
      Games
    </button>
    <button class="mob-nav-btn" onclick="mobTab('wallet')" id="mnav-wallet">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 12h2"/><path d="M2 7l4-4h12l4 4"/></svg>
      Wallet
    </button>
    <button class="mob-nav-btn" onclick="mobTab('portfolio')" id="mnav-portfolio">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      Portfolio
    </button>
  </nav>
  <div class="mob-body">
    <div class="mob-section mob-active" id="mob-markets">
      <div class="mob-stats">
        <div class="mob-stat"><div class="mob-stat-val" id="mobTotalPool">--</div><div class="mob-stat-lbl">Pool KAS</div></div>
        <div class="mob-stat"><div class="mob-stat-val" id="mobActiveMarkets">--</div><div class="mob-stat-lbl">Markets</div></div>
        <div class="mob-stat"><div class="mob-stat-val" id="mobPositions">--</div><div class="mob-stat-lbl">Positions</div></div>
      </div>
      <div class="mob-sec">
        <div class="mob-sec-title">Active Markets</div>
        <div id="mobMarketsList" style="font-size:12px;color:#475569;text-align:center;padding:24px 0;border:1px solid rgba(73,232,194,.08);border-radius:8px">Connect wallet to view markets</div>
      </div>
      <button class="mob-open-desktop" onclick="toggleMobileView()">Open Full App</button>
    </div>
    <div class="mob-section" id="mob-games">
      <div class="mob-sec">
        <div class="mob-sec-title">Skill Games</div>
        <div class="mob-game-grid">
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Chess</div><div class="gdesc">Full FIDE rules, on-chain settlement</div></div>
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Connect 4</div><div class="gdesc">4-in-a-row, covenant escrow</div></div>
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Checkers</div><div class="gdesc">Full replay proof on DAG</div></div>
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Tic-Tac-Toe</div><div class="gdesc">Fast, provably fair</div></div>
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Texas Hold em</div><div class="gdesc">Heads-up covenant escrow</div></div>
          <div class="mob-game-card" onclick="toggleMobileView()"><div class="gname">Blackjack</div><div class="gdesc">P2P, zero house edge</div></div>
        </div>
        <button class="mob-open-desktop" onclick="toggleMobileView()">Open Full App to Play</button>
      </div>
    </div>
    <div class="mob-section" id="mob-wallet">
      <div class="mob-sec">
        <div class="mob-sec-title">Connect Wallet</div>
        <div class="mob-wallet-grid">
          <div class="mob-w-card" onclick="selWallet('KasWare');updateMobConnBtn()"><img src="/img/kasware.png" alt="KasWare"/><span>KasWare</span></div>
          <div class="mob-w-card" onclick="selWallet('Kastle');updateMobConnBtn()"><img src="/img/kastle.png" alt="Kastle"/><span>Kastle</span></div>
          <div class="mob-w-card" onclick="selWallet('Kasperia');updateMobConnBtn()"><img src="/img/kasperia.png" alt="Kasperia"/><span>Kasperia</span></div>
        </div>
        <div id="mobWalletStatus"></div>
      </div>
      <div class="mob-sec">
        <div class="mob-sec-title">Seed Import</div>
        <textarea class="mob-input" id="mobMnInput" placeholder="12 or 24-word mnemonic..."></textarea>
        <button class="mob-btn-primary" onclick="mobConnectMnemonic()">Connect via Mnemonic</button>
      </div>
    </div>
    <div class="mob-section" id="mob-portfolio">
      <div class="mob-stats">
        <div class="mob-stat"><div class="mob-stat-val" id="mobPnl">0</div><div class="mob-stat-lbl">P&amp;L KAS</div></div>
        <div class="mob-stat"><div class="mob-stat-val" id="mobOpenPos">0</div><div class="mob-stat-lbl">Open</div></div>
        <div class="mob-stat"><div class="mob-stat-val" id="mobClaimable">0</div><div class="mob-stat-lbl">Claimable</div></div>
      </div>
      <div class="mob-sec">
        <div class="mob-sec-title">Positions</div>
        <div style="font-size:12px;color:#475569;text-align:center;padding:24px 0;border:1px solid rgba(73,232,194,.08);border-radius:8px">No active positions</div>
      </div>
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
      if(window.walletAddress&&btn)btn.textContent=window.walletAddress.slice(0,8)+'...';
      if(ds&&ms){ms.innerHTML=ds.innerHTML;ms.style.display=ds.innerHTML.trim()?'block':'none';}
    },1500);
  };
  window.mobConnectMnemonic=function(){
    var v=document.getElementById('mobMnInput').value.trim();
    if(!v)return;
    var di=document.querySelector('#htpMnemonicInput');
    if(!di)di=document.querySelector('textarea[placeholder*="mnemonic"]');
    if(di){di.value=v;var btn=di.closest('div').querySelector('button');if(btn)btn.click();}
    window.updateMobConnBtn();
  };
  function syncMobStats(){
    var maps=[['mobTotalPool','[id*="totalPool"]'],['mobActiveMarkets','[id*="activeMarkets"]'],['mobPositions','[id*="positions"]']];
    maps.forEach(function(m){
      var src=document.querySelector(m[1]);
      var dst=document.getElementById(m[0]);
      if(src&&dst&&src.textContent.trim())dst.textContent=src.textContent.trim();
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
print('Wallet cards:', h.count('mob-w-card'))
print('Nav buttons:', h.count('mob-nav-btn'))
print('Game cards:', h.count('mob-game-card'))
print('DONE')
