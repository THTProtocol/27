/**
 * htp-wallet-logos.js — v9.0
 * Clean, professional wallet selection page.
 * - Beautiful glassmorphism cards with correct brand logos
 * - Detected → glowing Connect button | Undetected → Install ↗ with link
 * - Network selector injected ONCE above each section (guard prevents duplication)
 * - Mobile toggle + auto-detect
 */

// ─── Brand SVG logos ──────────────────────────────────────────────────────────
window.HTP_WALLET_LOGOS = {

  KasWare: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#061510"/><polygon points="13,13 26,13 26,29 40,13 52,13 37,32 52,51 40,51 26,35 26,51 13,51" fill="#49e8c2"/></svg>',

  Kastle: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0b1929"/><rect x="7" y="37" width="50" height="19" rx="3" fill="#4a9ed6"/><rect x="7" y="23" width="13" height="15" fill="#3d8ec4"/><rect x="44" y="23" width="13" height="15" fill="#3d8ec4"/><rect x="23" y="18" width="18" height="20" fill="#5aade0"/><rect x="7" y="16" width="5" height="9" rx="1" fill="#3d8ec4"/><rect x="15" y="16" width="5" height="9" rx="1" fill="#3d8ec4"/><rect x="44" y="16" width="5" height="9" rx="1" fill="#3d8ec4"/><rect x="52" y="16" width="5" height="9" rx="1" fill="#3d8ec4"/><rect x="28" y="11" width="5" height="9" rx="1" fill="#5aade0"/><rect x="36" y="11" width="5" height="9" rx="1" fill="#5aade0"/><rect x="29" y="44" width="6" height="12" rx="3" fill="#0b1929"/></svg>',

  Kasperia: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a9fff"/><stop offset="100%" stop-color="#00cfff"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#050e1f"/><path d="M10 38 C16 22 26 14 36 14 C48 14 54 24 50 34 C46 44 34 48 22 44 C14 40 10 38 10 38Z" fill="url(#kg1)" opacity="0.12"/><ellipse cx="32" cy="30" rx="16" ry="10" fill="none" stroke="url(#kg1)" stroke-width="2.5"/><path d="M16 30 Q24 18 38 20 Q50 22 48 32" fill="none" stroke="#5dc8ff" stroke-width="2" stroke-linecap="round"/><circle cx="38" cy="20" r="3.5" fill="#5dc8ff"/><circle cx="32" cy="30" r="2.5" fill="white" opacity="0.85"/></svg>',

  OKX: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#111"/><rect x="9" y="9" width="18" height="18" rx="3" fill="white"/><rect x="37" y="9" width="18" height="18" rx="3" fill="white"/><rect x="9" y="37" width="18" height="18" rx="3" fill="white"/><rect x="37" y="37" width="18" height="18" rx="3" fill="white"/><rect x="23" y="23" width="4" height="4" fill="#111"/><rect x="37" y="23" width="4" height="4" fill="#111"/><rect x="23" y="37" width="4" height="4" fill="#111"/><rect x="37" y="37" width="4" height="4" fill="#111"/></svg>',

  Kasanova: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="knbg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#15102a"/><stop offset="100%" stop-color="#080713"/></radialGradient><linearGradient id="knw" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#06d6d6"/><stop offset="45%" stop-color="#9b5de5"/><stop offset="100%" stop-color="#f72585"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#knbg)"/><path d="M8 47 C15 31 23 20 31 17 C40 13 46 17 44 28 C42 36 34 39 28 34 C22 28 26 18 34 14 C43 10 54 16 56 28" fill="none" stroke="url(#knw)" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="31" r="2.5" fill="#b185ff" opacity="0.9"/></svg>',

  Kaspium: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kish" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#1d7a46"/><stop offset="100%" stop-color="#0d3d22"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#05130c"/><path d="M32 7 L56 17 L56 36 C56 51 32 60 32 60 C32 60 8 51 8 36 L8 17 Z" fill="url(#kish)" stroke="#49e8c2" stroke-width="1.5"/><rect x="22" y="21" width="5" height="22" rx="2" fill="#49e8c2"/><polygon points="27,32 41,21 47,21 33,32 47,43 41,43" fill="#49e8c2"/></svg>',

  KaspaCom: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kcg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0a1e2e"/><stop offset="100%" stop-color="#071018"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#kcg)"/><circle cx="32" cy="32" r="21" fill="none" stroke="#49e8c2" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-size="24" font-weight="900" fill="#49e8c2" font-family="Arial,sans-serif">K</text></svg>'
};

function getWalletLogo(n){ return window.HTP_WALLET_LOGOS[n] || window.HTP_WALLET_LOGOS.KasWare; }

// ─── Install URLs ─────────────────────────────────────────────────────────────
var _WL_INSTALL = {
  KasWare:  'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  Kastle:   'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  Kasperia: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
  OKX:      'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  Kasanova: 'https://kasanova.app',
  Kaspium:  'https://kaspium.io',
  KaspaCom: 'https://wallet.kaspa.com'
};

// ─── Network selector (injected ONCE per section) ─────────────────────────────
window._htpSetConnectNet = function(sid, net) {
  window.activeNet = net;
  if (typeof window.htpSetNetwork === 'function') window.htpSetNetwork(net);
  document.querySelectorAll('[data-net-sel="'+sid+'"] button').forEach(function(b) {
    var on = b.dataset.net === net;
    b.style.cssText = on
      ? 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:#49e8c2;color:#021a10;border:none;transition:all .2s'
      : 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.2);transition:all .2s';
  });
};

function _mkNetSel(sid) {
  var cur = window.activeNet || 'tn12';
  var base = 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s;';
  var on  = base + 'background:#49e8c2;color:#021a10;border:none;';
  var off = base + 'background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.2);';
  return '<div data-net-sel="'+sid+'" style="display:flex;gap:8px;margin-bottom:18px">'
    + '<button data-net="tn12"    onclick="_htpSetConnectNet(\''+sid+'\',\'tn12\')"    style="'+(cur==='tn12'?on:off)+'">TN12 Testnet</button>'
    + '<button data-net="mainnet" onclick="_htpSetConnectNet(\''+sid+'\',\'mainnet\')" style="'+(cur==='mainnet'?on:off)+'">Mainnet</button>'
    + '</div>';
}

function _injectNetSels() {
  var mn = document.getElementById('recMn');
  if (mn && !document.querySelector('[data-net-sel="ns-mn"]')) {
    var d = document.createElement('div');
    d.innerHTML = _mkNetSel('ns-mn');
    var target = mn.closest ? mn.closest('.fg') : mn.parentNode;
    if (!target) target = mn.parentNode;
    target.parentNode.insertBefore(d.firstElementChild, target);
  }
  var hx = document.getElementById('recHexKey');
  if (hx && !document.querySelector('[data-net-sel="ns-hx"]')) {
    var d2 = document.createElement('div');
    d2.innerHTML = _mkNetSel('ns-hx');
    var target2 = hx.closest ? hx.closest('.fg') : hx.parentNode;
    if (!target2) target2 = hx.parentNode;
    target2.parentNode.insertBefore(d2.firstElementChild, target2);
  }
}

// ─── selWallet ────────────────────────────────────────────────────────────────
(function() {
  function getProvider(name) {
    var w = window;
    switch(name) {
      case 'KasWare':  return w.kasware  || w.kasWare  || null;
      case 'Kastle':   return w.kastle   || null;
      case 'Kasperia': return w.kasperia || null;
      case 'OKX':      return (w.okxwallet && w.okxwallet.kaspa) ? w.okxwallet.kaspa : null;
      case 'Kasanova': return w.kasanova || w.KasanovaWallet || null;
      case 'Kaspium':  return w.kaspium  || w.KaspiumWallet  || null;
      case 'KaspaCom': return w.kaspacom || (w.kaspa && w.kaspa.requestAccounts ? w.kaspa : null);
      default:         return null;
    }
  }
  function extractAddr(r) {
    if (!r) return null;
    if (Array.isArray(r)) return r[0]||null;
    if (typeof r==='string') return r;
    if (r.address) return r.address;
    if (r.accounts && r.accounts[0]) return r.accounts[0];
    return null;
  }
  async function callConnect(p) {
    if (typeof p.requestAccounts==='function') return extractAddr(await p.requestAccounts());
    if (typeof p.connect==='function')         return extractAddr(await p.connect());
    if (typeof p.enable==='function')          return extractAddr(await p.enable());
    throw new Error('Wallet has no connect method');
  }

  window.selWallet = async function(name) {
    var st = document.getElementById('walletStatus');
    function setS(h){ if(st){st.style.display='block';st.innerHTML=h;} }
    setS('<span style="color:#94a3b8">Connecting to '+name+'\u2026</span>');

    var p = null;
    for (var i=0;i<20;i++){ p=getProvider(name); if(p) break; await new Promise(function(r){setTimeout(r,150);}); }

    if (!p) {
      var url = _WL_INSTALL[name]||'';
      setS(
        '<div style="display:flex;gap:14px;align-items:flex-start">'
        +'<div style="font-size:28px;line-height:1">\uD83D\uDD0C</div>'
        +'<div>'
        +'<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px">'+name+' not detected</div>'
        +(url?'<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Install the extension, refresh the page, then connect.</div>'
            +'<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.25);border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Install '+name+' \u2197</a>':'')
        +'<div style="margin-top:10px;font-size:12px;color:#475569">Or use <b style="color:#49e8c2">Mnemonic</b> / <b style="color:#49e8c2">Hex Key</b> below \u2014 works on TN12 &amp; Mainnet.</div>'
        +'</div></div>'
      );
      var sec = document.querySelector('.w-sec');
      if(sec) setTimeout(function(){sec.scrollIntoView({behavior:'smooth',block:'start'});},500);
      return;
    }

    try {
      var addr = await callConnect(p);
      if (!addr) throw new Error('No address returned');
      window.walletAddress = window.htpAddress = window.connectedAddress = addr;
      window.walletProvider = name; window.conn = true;

      var network = 'unknown';
      try { network = await p.getNetwork(); } catch(e){}
      try {
        var bal = await p.getBalance();
        window.walletBalance = { confirmed: bal.confirmed||bal.mature||0, unconfirmed: bal.unconfirmed||bal.pending||0, total: bal.total||0 };
      } catch(e) { window.walletBalance = {confirmed:0,unconfirmed:0,total:0}; }
      try { window.walletPubKey = await p.getPublicKey(); } catch(e){}

      if (typeof window.updateWalletUI==='function') window.updateWalletUI(name, network);
      if (typeof window.startBalancePoller==='function') window.startBalancePoller();
      var dcBtn=document.getElementById('dcBtn'); if(dcBtn) dcBtn.style.display='inline-block';
    } catch(e) {
      if(st){ st.style.display='block'; st.innerHTML='<span style="color:#ef4444">Connection failed: '+(e.message||e)+'</span>'; }
      window.conn = false;
    }
  };
})();

// ─── CSS ──────────────────────────────────────────────────────────────────────
(function injectStyles() {
  if (document.getElementById('wl9-styles')) return;
  var s = document.createElement('style');
  s.id = 'wl9-styles';
  s.textContent = [
    '@keyframes wlPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }',
    '#wlWrap { background:rgba(255,255,255,.025);border:1px solid rgba(73,232,194,.1);border-radius:20px;padding:24px;margin-bottom:20px;backdrop-filter:blur(12px); }',
    '.wlHdr { display:flex;align-items:center;gap:12px;margin-bottom:20px; }',
    '.wlHdr-title { font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#49e8c2;white-space:nowrap; }',
    '.wlHdr-line { flex:1;height:1px;background:linear-gradient(90deg,rgba(73,232,194,.25) 0%,transparent 100%); }',
    '.wlHdr-hint { font-size:10px;color:#475569;letter-spacing:.05em;white-space:nowrap; }',
    '#wlGrid { display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }',
    '@media(min-width:500px){#wlGrid{grid-template-columns:repeat(4,1fr)!important}}',
    '@media(min-width:720px){#wlGrid{grid-template-columns:repeat(7,1fr)!important}}',
    '.wlCard { position:relative;border-radius:16px;padding:18px 10px 14px;text-align:center;cursor:pointer;overflow:hidden;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s; }',
    '.wlCard:hover { transform:translateY(-5px) scale(1.02)!important;box-shadow:0 20px 50px rgba(0,0,0,.7)!important;opacity:1!important; }',
    '.wlCard-detected { background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.4); }',
    '.wlCard-undetected { background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.06);opacity:.7; }',
    '.wlCard-dot { position:absolute;top:9px;right:9px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 8px #49e8c2;animation:wlPulse 2s ease-in-out infinite; }',
    '.wlCard-logo { width:52px;height:52px;margin:0 auto 11px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center; }',
    '.wlCard-logo svg { width:100%;height:100%;display:block; }',
    '.wlCard-name { font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:3px;letter-spacing:.01em; }',
    '.wlCard-sub { font-size:9.5px;font-weight:600;margin-bottom:11px; }',
    '.wlCard-btn { width:100%;padding:8px 4px;border-radius:10px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s; }',
    '.wlCard-btn-connect { background:#49e8c2;color:#021a10;border:none; }',
    '.wlCard-btn-connect:hover { background:#6fffd8; }',
    '.wlCard-btn-install { background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.22); }',
    '.wlCard-btn-install:hover { background:rgba(73,232,194,.12); }',
    '#walletStatus { margin-top:16px;padding:16px 18px;border-radius:14px;border:1px solid rgba(73,232,194,.12);background:rgba(4,12,28,.7);font-size:13px;backdrop-filter:blur(8px);display:none; }',
    '.w-sec { background:rgba(255,255,255,.022)!important;border:1px solid rgba(73,232,194,.1)!important;border-radius:16px!important;padding:22px!important;margin-bottom:16px!important;backdrop-filter:blur(8px)!important; }',
    '.w-sec:hover { border-color:rgba(73,232,194,.2)!important; }'
  ].join('\n');
  document.head.appendChild(s);
})();

// ─── Main wallet page builder ──────────────────────────────────────────────────
(function buildWalletPage() {

  var WALLETS = [
    { id:'KasWare',  name:'KasWare',  sub:'Chrome · Firefox', detect:function(){ return !!(window.kasware||window.kasWare); } },
    { id:'Kastle',   name:'Kastle',   sub:'Chrome · Mobile',  detect:function(){ return !!window.kastle; } },
    { id:'Kasperia', name:'Kasperia', sub:'Chrome',           detect:function(){ return !!window.kasperia; } },
    { id:'OKX',      name:'OKX',      sub:'Chrome · Mobile',  detect:function(){ return !!(window.okxwallet&&window.okxwallet.kaspa); } },
    { id:'Kasanova', name:'Kasanova', sub:'iOS · Android',    detect:function(){ return !!(window.kasanova||window.KasanovaWallet); } },
    { id:'Kaspium',  name:'Kaspium',  sub:'iOS · Android',    detect:function(){ return !!(window.kaspium||window.KaspiumWallet); } },
    { id:'KaspaCom', name:'KaspaCom', sub:'Web · Mobile',     detect:function(){ return !!(window.kaspacom||(window.kaspa&&window.kaspa.requestAccounts)); } }
  ];

  function buildCard(w) {
    var found = w.detect();
    var url = _WL_INSTALL[w.id] || '';
    var dot  = found ? '<div class="wlCard-dot"></div>' : '';
    var sub  = found ? '<span style="color:#49e8c2">\u25CF Detected</span>' : w.sub;
    var cls  = 'wlCard ' + (found ? 'wlCard-detected' : 'wlCard-undetected');
    var btnCls  = 'wlCard-btn ' + (found ? 'wlCard-btn-connect' : 'wlCard-btn-install');
    var btnText = found ? 'Connect' : 'Install \u2197';
    var cardAction = found ? 'selWallet(\'' + w.id + '\')' : 'window.open(\'' + url + '\')';
    return '<div class="'+cls+'" onclick="'+cardAction+'">'
      + dot
      + '<div class="wlCard-logo">'+getWalletLogo(w.id)+'</div>'
      + '<div class="wlCard-name">'+w.name+'</div>'
      + '<div class="wlCard-sub">'+sub+'</div>'
      + '<button class="'+btnCls+'" onclick="event.stopPropagation();'+cardAction+'">'+btnText+'</button>'
      + '</div>';
  }

  function run() {
    var sec = document.getElementById('v-wallet');
    if (!sec) return;

    var wrap = document.getElementById('wlWrap');
    if (wrap) {
      var grid = document.getElementById('wlGrid');
      if (grid) grid.innerHTML = WALLETS.map(buildCard).join('');
      _injectNetSels();
      return;
    }

    wrap = document.createElement('div');
    wrap.id = 'wlWrap';
    wrap.innerHTML =
      '<div class="wlHdr">'
      + '<span class="wlHdr-title">Choose Wallet</span>'
      + '<div class="wlHdr-line"></div>'
      + '<span class="wlHdr-hint">Click to connect \u00B7 Mnemonic &amp; Key below</span>'
      + '</div>'
      + '<div id="wlGrid">'+WALLETS.map(buildCard).join('')+'</div>'
      + '<div id="walletStatus"></div>';

    var mx = sec.querySelector('.mx') || sec;
    var old = sec.querySelector('.w-grid');
    if (old) {
      old.parentNode.replaceChild(wrap, old);
    } else {
      var sh = mx.querySelector('.sh');
      mx.insertBefore(wrap, sh ? sh.nextSibling : mx.firstChild);
    }

    sec.querySelectorAll('#walletStatus').forEach(function(el, i){ if(i>0) el.remove(); });
    _injectNetSels();
    _injectMobileToggle();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  var _go = window.go;
  if (typeof _go==='function' && !_go._wl9) {
    window.go = function(v){ _go(v); if(v==='wallet') setTimeout(run, 180); };
    window.go._wl9 = true;
  }
  window.addEventListener('htp:view:wallet', function(){ setTimeout(run, 180); });

})();

// ─── Mobile toggle ────────────────────────────────────────────────────────────
var _htpMobOn = false;

function _injectMobileToggle() {
  var isPhone = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isPhone) { _setMob(true); return; }
  if (document.getElementById('htpMobBtn')) return;
  var btn = document.createElement('button');
  btn.id = 'htpMobBtn';
  btn.textContent = '\uD83D\uDCF1 Mobile';
  btn.title = 'Preview mobile layout';
  btn.style.cssText = 'position:fixed;bottom:72px;right:14px;z-index:9999;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.05em;color:#49e8c2;background:rgba(5,14,30,.85);border:1px solid rgba(73,232,194,.22);cursor:pointer;backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,.5);transition:all .2s';
  btn.onclick = function(){ _setMob(!_htpMobOn); };
  document.body.appendChild(btn);
  if (localStorage.getItem('htpMob')==='1') _setMob(true);
}

function _setMob(on) {
  _htpMobOn = on;
  var app = document.getElementById('app') || document.body;
  var ms  = document.getElementById('htpMobStyle');
  if (!ms) { ms = document.createElement('style'); ms.id='htpMobStyle'; document.head.appendChild(ms); }
  if (on) {
    app.style.maxWidth='390px'; app.style.margin='0 auto'; app.style.boxShadow='0 0 0 100vw rgba(0,0,0,.75)';
    ms.textContent='body{overflow-x:hidden!important}#app{max-width:390px!important;margin:0 auto!important}';
    var b=document.getElementById('htpMobBtn'); if(b){b.textContent='\uD83D\uDCBB Desktop';b.style.background='rgba(73,232,194,.12)';}
  } else {
    app.style.maxWidth=''; app.style.margin=''; app.style.boxShadow='';
    ms.textContent='';
    var b2=document.getElementById('htpMobBtn'); if(b2){b2.textContent='\uD83D\uDCF1 Mobile';b2.style.background='rgba(5,14,30,.85)';}
  }
  localStorage.setItem('htpMob', on?'1':'0');
}
