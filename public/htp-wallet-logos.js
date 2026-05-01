/**
 * htp-wallet-logos.js — v8.0
 * Full professional wallet page redesign:
 * - Correct brand logos for all wallets (Kasperia = teal fish, proper SVGs)
 * - Install ↗ for undetected, Connect for detected (green glow)
 * - Network selector (TN12 / Mainnet) injected above mnemonic + hex sections
 * - selWallet() patched: handles requestAccounts / connect / enable across all providers
 * - Mobile preview toggle (📱) fixed bottom-right on desktop; auto-apply on real phones
 * - Full page redesign: status card, dividers, section headers, clean typography
 */

// ─── Brand-accurate SVG logos ────────────────────────────────────────────────
window.HTP_WALLET_LOGOS = {

  KasWare: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#071a10"/><polygon points="14,12 26,12 26,28 40,12 53,12 37,32 53,52 40,52 26,36 26,52 14,52" fill="#49e8c2"/></svg>',

  Kastle: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0d1a2e"/><rect x="7" y="37" width="50" height="19" rx="2" fill="#4a9ed6"/><rect x="7" y="23" width="13" height="16" fill="#4a9ed6"/><rect x="44" y="23" width="13" height="16" fill="#4a9ed6"/><rect x="23" y="18" width="18" height="21" fill="#6cb8eb"/><rect x="7" y="16" width="5" height="9" rx="1" fill="#4a9ed6"/><rect x="15" y="16" width="5" height="9" rx="1" fill="#4a9ed6"/><rect x="44" y="16" width="5" height="9" rx="1" fill="#4a9ed6"/><rect x="52" y="16" width="5" height="9" rx="1" fill="#4a9ed6"/><rect x="27" y="11" width="5" height="9" rx="1" fill="#6cb8eb"/><rect x="35" y="11" width="5" height="9" rx="1" fill="#6cb8eb"/><rect x="29" y="44" width="6" height="12" rx="3" fill="#0d1a2e"/></svg>',

  // Kasperia real logo: white/teal abstract wing/leaf shape on dark blue
  Kasperia: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kpGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a9aff"/><stop offset="100%" stop-color="#0af"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#050e1f"/><ellipse cx="32" cy="30" rx="17" ry="11" fill="none" stroke="url(#kpGrad)" stroke-width="3"/><path d="M15 30 Q24 14 40 18 Q52 22 49 32 Q46 42 32 44 Q18 46 15 30Z" fill="url(#kpGrad)" opacity="0.18"/><path d="M22 30 Q28 20 40 22 Q48 24 46 32" fill="none" stroke="#5dc8ff" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="22" r="3.5" fill="#5dc8ff"/><circle cx="32" cy="30" r="2" fill="#fff" opacity="0.9"/></svg>',

  OKX: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#000"/><rect x="8" y="8" width="19" height="19" rx="3" fill="#fff"/><rect x="37" y="8" width="19" height="19" rx="3" fill="#fff"/><rect x="8" y="37" width="19" height="19" rx="3" fill="#fff"/><rect x="37" y="37" width="19" height="19" rx="3" fill="#fff"/><rect x="22" y="22" width="5" height="5" fill="#000"/><rect x="37" y="22" width="5" height="5" fill="#000"/><rect x="22" y="37" width="5" height="5" fill="#000"/><rect x="37" y="37" width="5" height="5" fill="#000"/></svg>',

  // Kasanova: gradient wave logo (cyan→purple→pink)
  Kasanova: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="knBg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#130e28"/><stop offset="100%" stop-color="#070712"/></radialGradient><linearGradient id="knW" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#06d6d6"/><stop offset="45%" stop-color="#9b5de5"/><stop offset="100%" stop-color="#f72585"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#knBg)"/><path d="M9 46 C15 32 22 22 30 18 C38 14 44 17 42 27 C40 35 33 38 28 33 C23 28 26 19 34 15 C42 11 53 16 56 27" fill="none" stroke="url(#knW)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="3" fill="#b185ff" opacity="0.95"/></svg>',

  // Kaspium: shield + K arrow
  Kaspium: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kiSh" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#1a6e3e"/><stop offset="100%" stop-color="#0d3d20"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#061510"/><path d="M32 7 L56 17 L56 36 C56 51 32 60 32 60 C32 60 8 51 8 36 L8 17 Z" fill="url(#kiSh)" stroke="#49e8c2" stroke-width="2"/><rect x="22" y="21" width="5" height="22" rx="1.5" fill="#49e8c2"/><polygon points="27,32 41,21 47,21 33,32 47,43 41,43" fill="#49e8c2"/></svg>',

  // KaspaCom: official kaspa.com — teal K in circle
  KaspaCom: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="kcBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0a1e2e"/><stop offset="100%" stop-color="#071018"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#kcBg)"/><circle cx="32" cy="32" r="20" fill="none" stroke="#49e8c2" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-size="22" font-weight="900" fill="#49e8c2" font-family="Arial,sans-serif">K</text></svg>',

  Tangem: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#04100c"/><rect x="5" y="16" width="54" height="32" rx="7" fill="none" stroke="#49e8c2" stroke-width="2"/><rect x="12" y="27" width="14" height="10" rx="3" fill="none" stroke="#49e8c2" stroke-width="1.5"/><line x1="12" y1="32" x2="26" y2="32" stroke="#49e8c2" stroke-width="1"/><line x1="19" y1="27" x2="19" y2="37" stroke="#49e8c2" stroke-width="1"/><path d="M34 27 Q42 32 34 37" fill="none" stroke="#49e8c2" stroke-width="1.8" stroke-linecap="round"/><path d="M39 24 Q50 32 39 40" fill="none" stroke="#49e8c2" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/></svg>'

};

function getWalletLogo(name) {
  return window.HTP_WALLET_LOGOS[name] || window.HTP_WALLET_LOGOS['KasWare'];
}

// ─── Install URLs ─────────────────────────────────────────────────────────────
var _INSTALL_URLS = {
  KasWare:  'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  Kastle:   'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  Kasperia: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
  OKX:      'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  Kasanova: 'https://kasanova.app',
  Kaspium:  'https://kaspium.io',
  KaspaCom: 'https://wallet.kaspa.com'
};

// ─── Nav-pill active bar ───────────────────────────────────────────────────────
(function applyNavFix() {
  function fix() {
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      if (!btn.classList.contains('act')) return;
      if (btn.querySelector('.nav-active-bar')) return;
      var bar = document.createElement('span');
      bar.className = 'nav-active-bar';
      bar.style.cssText = 'position:absolute;left:10px;right:10px;bottom:6px;height:2px;border-radius:2px;background:rgba(73,232,194,.95);box-shadow:0 0 10px rgba(73,232,194,.24);pointer-events:none';
      btn.style.position = 'relative';
      btn.appendChild(bar);
    });
  }
  if (document.readyState !== 'loading') fix();
  else document.addEventListener('DOMContentLoaded', fix);
  document.addEventListener('click', function(){ setTimeout(fix, 80); });
})();

// ─── selWallet patch — handles requestAccounts / connect / enable ─────────────
(function patchSelWallet() {
  function extractAddr(r) {
    if (!r) return null;
    if (Array.isArray(r)) return r[0] || null;
    if (typeof r === 'string') return r;
    if (r.address) return r.address;
    if (r.accounts && r.accounts[0]) return r.accounts[0];
    return null;
  }
  async function callConnect(provider) {
    if (typeof provider.requestAccounts === 'function') return extractAddr(await provider.requestAccounts());
    if (typeof provider.connect          === 'function') return extractAddr(await provider.connect());
    if (typeof provider.enable           === 'function') return extractAddr(await provider.enable());
    throw new Error('Wallet provider has no connect method (requestAccounts / connect / enable)');
  }
  function getP(name) {
    var w = window;
    switch(name) {
      case 'KasWare':  return w.kasware  || w.kasWare  || null;
      case 'Kastle':   return w.kastle   || null;
      case 'Kasperia': return w.kasperia || null;
      case 'OKX':      return (w.okxwallet && w.okxwallet.kaspa) ? w.okxwallet.kaspa : null;
      case 'Kasanova': return w.kasanova || w.KasanovaWallet || null;
      case 'Kaspium':  return w.kaspium  || w.KaspiumWallet  || null;
      case 'KaspaCom': return w.kaspacom || (w.kaspa && w.kaspa.requestAccounts ? w.kaspa : null);
      default: return w.kasware || w.kastle || null;
    }
  }
  window.selWallet = async function(name) {
    var statusEl = document.getElementById('walletStatus');
    function setStatus(html) { if (statusEl) { statusEl.style.display='block'; statusEl.innerHTML=html; } }
    setStatus('<span style="color:var(--muted)">Connecting to ' + name + '\u2026</span>');
    // Poll up to 3s for extension to inject
    var provider = null;
    for (var i=0;i<20;i++) { provider=getP(name); if(provider) break; await new Promise(function(r){setTimeout(r,150);}); }
    if (!provider) {
      var url = _INSTALL_URLS[name] || '';
      setStatus(
        '<div style="display:flex;align-items:flex-start;gap:12px">'+
        '<div style="font-size:22px;line-height:1">\uD83D\uDD0C</div>'+
        '<div><div style="font-weight:700;color:#f1f5f9;margin-bottom:4px">'+ name +' not detected</div>'+
        (url ? '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px">Install the extension, refresh the page, then connect.</div>'+
          '<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:rgba(73,232,194,.1);border:1px solid rgba(73,232,194,.3);border-radius:8px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;text-decoration:none">Install '+name+' \u2197</a>' : '')+
        '<div style="margin-top:10px;font-size:12px;color:#556070">Or use <strong style="color:#49e8c2">Mnemonic</strong> / <strong style="color:#49e8c2">Hex Key</strong> below \u2014 works on TN12 &amp; Mainnet.</div>'+
        '</div></div>'
      );
      var mn = document.querySelector('.w-sec');
      if (mn) setTimeout(function(){ mn.scrollIntoView({behavior:'smooth',block:'start'}); }, 500);
      return;
    }
    try {
      var addr = await callConnect(provider);
      if (!addr) throw new Error('No address returned \u2014 connection rejected or no accounts.');
      window.walletAddress = window.htpWalletAddress = window.htpAddress = addr;
      window.walletProvider = name;
      window.conn = true;
      var network = 'unknown';
      try { network = await provider.getNetwork(); } catch(e){}
      try {
        var bal = await provider.getBalance();
        window.walletBalance = { confirmed: bal.confirmed||bal.mature||0, unconfirmed: bal.unconfirmed||bal.pending||0, total: bal.total||0 };
      } catch(e) { window.walletBalance = {confirmed:0,unconfirmed:0,total:0}; }
      try { window.walletPubKey = await provider.getPublicKey(); } catch(e){}
      if (typeof window.updateWalletUI === 'function') window.updateWalletUI(name, network);
      if (typeof window.startBalancePoller === 'function') window.startBalancePoller();
      var dcBtn = document.getElementById('dcBtn'); if(dcBtn) dcBtn.style.display='inline-block';
      if (provider.on) {
        try {
          provider.on('accountsChanged', function(a){ if(a&&a[0]){window.walletAddress=a[0]; if(typeof window.updateWalletUI==='function') window.updateWalletUI(name,network);} });
          provider.on('balanceChanged', function(b){ window.walletBalance={confirmed:b.balance?b.balance.mature||0:b.confirmed||0,unconfirmed:b.balance?b.balance.pending||0:b.unconfirmed||0,total:0}; if(typeof window.updateBalanceDisplay==='function') window.updateBalanceDisplay(); });
        } catch(e){}
      }
    } catch(e) {
      var statusEl2 = document.getElementById('walletStatus');
      if(statusEl2) { statusEl2.style.display='block'; statusEl2.innerHTML='<span style="color:#ef4444">Connection failed: '+(e.message||e)+'</span>'; }
      window.conn = false;
    }
  };
})();

// ─── Network selector helper ───────────────────────────────────────────────────
window._htpSetConnectNet = function(selectorId, net) {
  window.activeNet = net;
  if (typeof window.htpSetNetwork === 'function') window.htpSetNetwork(net);
  var sel = document.getElementById(selectorId);
  if (!sel) return;
  sel.querySelectorAll('button[data-net]').forEach(function(b) {
    var on = b.getAttribute('data-net') === net;
    b.style.background = on ? '#49e8c2' : 'rgba(73,232,194,.06)';
    b.style.color      = on ? '#02110d' : '#49e8c2';
    b.style.border     = on ? '1px solid transparent' : '1px solid rgba(73,232,194,.25)';
    b.style.fontWeight = '800';
  });
  if (window.showToast) window.showToast('Network: ' + (net==='tn12'?'TN12 Testnet':'Mainnet'), 'info');
};

function _buildNetSel(id) {
  var cur = window.activeNet || 'tn12';
  function btnStyle(active) {
    return 'flex:1;padding:8px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:all .15s;' +
      (active ? 'background:#49e8c2;color:#02110d;border:1px solid transparent;' : 'background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.25);');
  }
  return '<div id="'+id+'" style="display:flex;gap:6px;margin-bottom:14px">'+
    '<button data-net="tn12" onclick="window._htpSetConnectNet(\''+id+'\',\'tn12\')" style="'+btnStyle(cur==='tn12')+'">TN12 Testnet</button>'+
    '<button data-net="mainnet" onclick="window._htpSetConnectNet(\''+id+'\',\'mainnet\')" style="'+btnStyle(cur==='mainnet')+'">Mainnet</button>'+
  '</div>';
}

// ─── Main wallet page redesign ────────────────────────────────────────────────
(function buildWalletPage() {

  var ALL_WALLETS = [
    { id:'KasWare',  label:'KasWare',  sub:'Chrome · Firefox', detect: function(){ return !!(window.kasware||window.kasWare); } },
    { id:'Kastle',   label:'Kastle',   sub:'Chrome · Mobile',  detect: function(){ return !!window.kastle; } },
    { id:'Kasperia', label:'Kasperia', sub:'Chrome',           detect: function(){ return !!window.kasperia; } },
    { id:'OKX',      label:'OKX',      sub:'Chrome · Mobile',  detect: function(){ return !!(window.okxwallet&&window.okxwallet.kaspa); } },
    { id:'Kasanova', label:'Kasanova', sub:'iOS · Android',    detect: function(){ return !!(window.kasanova||window.KasanovaWallet); } },
    { id:'Kaspium',  label:'Kaspium',  sub:'iOS · Android',    detect: function(){ return !!(window.kaspium||window.KaspiumWallet); } },
    { id:'KaspaCom', label:'KaspaCom', sub:'Web · Mobile',     detect: function(){ return !!(window.kaspacom||(window.kaspa&&window.kaspa.requestAccounts)); } }
  ];

  // Safety fallback
  window._wpcFallback = function(id) {
    setTimeout(function(){ if(typeof window.selWallet==='function') window.selWallet(id); },200);
  };

  function card(w) {
    var found = w.detect();
    var installUrl = _INSTALL_URLS[w.id] || '';
    var logo = getWalletLogo(w.id);

    var borderCol  = found ? 'rgba(73,232,194,.45)' : 'rgba(255,255,255,.06)';
    var bgCol      = found ? 'rgba(73,232,194,.04)' : 'rgba(255,255,255,.018)';
    var btnBg      = found ? '#49e8c2' : 'rgba(73,232,194,.07)';
    var btnCol     = found ? '#021a10' : '#49e8c2';
    var btnBorder  = found ? 'transparent' : 'rgba(73,232,194,.25)';
    var btnLabel   = found ? 'Connect' : 'Install \u2197';
    var btnClick   = found
      ? 'onclick="(typeof selWallet===\'function\'?selWallet(\''+w.id+'\'):window._wpcFallback(\''+w.id+'\'))"'
      : 'onclick="window.open(\''+installUrl+'\',\'_blank\')"\'>';
    var subCol     = found ? '#49e8c2' : '#64748b';
    var subText    = found ? '● Detected' : w.sub;
    var dotHtml    = found ? '<div style="position:absolute;top:9px;right:9px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 8px #49e8c2;animation:wlPulse 2s ease-in-out infinite"></div>' : '';
    var cardClick  = found ? 'onclick="(typeof selWallet===\'function\'?selWallet(\''+w.id+'\'):window._wpcFallback(\''+w.id+'\'))"' : '';
    var opac       = found ? '1' : '0.72';

    return '<div class="wlCard" data-wid="'+w.id+'" '+cardClick+
      ' style="background:'+bgCol+';border:1px solid '+borderCol+';border-radius:16px;padding:20px 12px 16px;'+
      'text-align:center;cursor:pointer;position:relative;overflow:hidden;opacity:'+opac+';'+
      'transition:transform .2s,box-shadow .2s,opacity .2s">'+
      dotHtml+
      '<div style="width:52px;height:52px;margin:0 auto 12px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25)">'+
        logo+
      '</div>'+
      '<div style="font-size:12px;font-weight:800;color:#f1f5f9;margin-bottom:4px;letter-spacing:.01em">'+w.label+'</div>'+
      '<div style="font-size:10px;color:'+subCol+';margin-bottom:12px;font-weight:600">'+subText+'</div>'+
      '<button '+btnClick+
        ' style="width:100%;padding:8px 4px;border-radius:9px;cursor:pointer;'+
        'font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;'+
        'background:'+btnBg+';color:'+btnCol+';border:1px solid '+btnBorder+';'+
        'transition:all .15s">'+btnLabel+'</button>'+
    '</div>';
  }

  function styles() {
    if (document.getElementById('wlStyles')) return;
    var s = document.createElement('style');
    s.id = 'wlStyles';
    s.textContent = [
      '@keyframes wlPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.85)}}',
      '.wlCard:hover{transform:translateY(-4px)!important;box-shadow:0 18px 40px rgba(0,0,0,.6)!important;opacity:1!important}',
      '#wlGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
      '@media(min-width:500px){#wlGrid{grid-template-columns:repeat(4,1fr)!important}}',
      '@media(min-width:740px){#wlGrid{grid-template-columns:repeat(7,1fr)!important}}',
      // Section headers
      '.wlSecHead{display:flex;align-items:center;gap:10px;margin-bottom:16px}',
      '.wlSecHead span{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#49e8c2}',
      '.wlSecHead hr{flex:1;border:none;border-top:1px solid rgba(73,232,194,.12);margin:0}',
      // Status card
      '#walletStatus{margin-top:0;padding:16px;border-radius:12px;border:1px solid rgba(73,232,194,.15);background:rgba(5,14,30,.8);font-size:13px;backdrop-filter:blur(8px)}',
      // Mnemonic / Hex panels
      '.wlPanel{background:rgba(5,12,25,.7);border:1px solid rgba(73,232,194,.1);border-radius:14px;padding:20px;margin-bottom:16px}',
      '.wlPanel:hover{border-color:rgba(73,232,194,.2)}',
      // Main section bg
      '#v-wallet .mx{padding-bottom:32px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function divider(label) {
    return '<div class="wlSecHead"><span>'+label+'</span><hr></div>';
  }

  function buildWrap() {
    return [
      // Section title bar
      divider('Choose Wallet'),
      // Wallet grid
      '<div id="wlGrid">',
        ALL_WALLETS.map(card).join(''),
      '</div>',
      // Status
      '<div id="walletStatus" style="display:none;margin-top:14px"></div>'
    ].join('');
  }

  function injectNetSelectors() {
    // Mnemonic section
    var mnArea = document.getElementById('recMn');
    if (mnArea && !document.getElementById('wlNetSelMn')) {
      var d = document.createElement('div');
      d.innerHTML = _buildNetSel('wlNetSelMn');
      var fg = mnArea.closest ? mnArea.closest('.fg') : mnArea.parentNode;
      if (fg) fg.parentNode.insertBefore(d.firstElementChild, fg);
      else mnArea.parentNode.insertBefore(d.firstElementChild, mnArea);
    }
    // Hex section
    var hexInp = document.getElementById('recHexKey');
    if (hexInp && !document.getElementById('wlNetSelHex')) {
      var d2 = document.createElement('div');
      d2.innerHTML = _buildNetSel('wlNetSelHex');
      var fg2 = hexInp.closest ? hexInp.closest('.fg') : hexInp.parentNode;
      if (fg2) fg2.parentNode.insertBefore(d2.firstElementChild, fg2);
      else hexInp.parentNode.insertBefore(d2.firstElementChild, hexInp);
    }
    // Sync button states
    var cur = window.activeNet || 'tn12';
    ['wlNetSelMn','wlNetSelHex'].forEach(function(sid){
      var sel = document.getElementById(sid); if(!sel) return;
      sel.querySelectorAll('button[data-net]').forEach(function(b){
        var on = b.getAttribute('data-net')===cur;
        b.style.background = on?'#49e8c2':'rgba(73,232,194,.06)';
        b.style.color      = on?'#02110d':'#49e8c2';
        b.style.border     = on?'1px solid transparent':'1px solid rgba(73,232,194,.25)';
      });
    });
  }

  function wrapExistingSecs() {
    // Wrap each .w-sec in a styled .wlPanel if not already done
    document.querySelectorAll('#v-wallet .w-sec').forEach(function(sec) {
      if (sec.classList.contains('wlPanelDone')) return;
      sec.classList.add('wlPanelDone','wlPanel');
    });
  }

  function run() {
    var section = document.getElementById('v-wallet');
    if (!section) return;
    styles();

    // Replace existing wrap or old .w-grid
    var existing = document.getElementById('wlWrap');
    if (existing) {
      var grid = existing.querySelector('#wlGrid');
      if (grid) grid.innerHTML = ALL_WALLETS.map(card).join('');
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = 'wlWrap';
    wrap.style.cssText = 'margin-bottom:24px';
    wrap.innerHTML = buildWrap();

    var oldGrid = section.querySelector('.w-grid');
    var mx = section.querySelector('.mx') || section;
    if (oldGrid) {
      oldGrid.parentNode.replaceChild(wrap, oldGrid);
    } else {
      var sh = mx.querySelector('.sh');
      mx.insertBefore(wrap, sh ? sh.nextSibling : mx.firstChild);
    }

    // Remove old walletStatus (will use new one inside wrap)
    var oldStatus = mx.querySelector('#walletStatus:not(#wlWrap #walletStatus)');
    if (oldStatus) oldStatus.remove();

    // Update section subtitle
    var sp = section.querySelector('.sh p');
    if (sp) sp.textContent = 'Connect your Kaspa wallet. Use Mnemonic or Hex Key below for TN12 & Mainnet.';

    // Wrap .w-sec panels
    wrapExistingSecs();

    // Inject network selectors
    injectNetSelectors();

    // Mobile toggle
    injectMobileToggle();

    console.log('[HTP] wallet page v8.0 loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  // Re-run on nav
  var _origGo = window.go;
  if (typeof _origGo === 'function' && !_origGo._wl8) {
    window.go = function(v) { _origGo(v); if(v==='wallet') setTimeout(run, 160); };
    window.go._wl8 = true;
  }
  window.addEventListener('htp:view:wallet', function(){ setTimeout(run, 160); });

})();

// ─── Mobile preview toggle ────────────────────────────────────────────────────
var _htpMobSim = false;
function injectMobileToggle() {
  var isPhone = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isPhone) { _applyMob(true); return; }
  if (document.getElementById('htpMobBtn')) return;
  var btn = document.createElement('button');
  btn.id = 'htpMobBtn';
  btn.title = 'Preview mobile layout';
  btn.textContent = '\uD83D\uDCF1 Mobile';
  btn.style.cssText = 'position:fixed;bottom:76px;right:14px;z-index:9998;padding:8px 14px;border-radius:20px;'+
    'font-size:11px;font-weight:800;letter-spacing:.05em;color:#49e8c2;'+
    'background:rgba(5,14,30,.85);border:1px solid rgba(73,232,194,.25);cursor:pointer;'+
    'backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,.5);transition:all .2s';
  btn.onclick = function(){ _applyMob(!_htpMobSim); };
  document.body.appendChild(btn);
  if (localStorage.getItem('htpMobSim')==='1') _applyMob(true);
}

function _applyMob(on) {
  _htpMobSim = on;
  var app = document.getElementById('app') || document.body;
  var mStyle = document.getElementById('htpMobStyle');
  if (!mStyle) { mStyle = document.createElement('style'); mStyle.id='htpMobStyle'; document.head.appendChild(mStyle); }
  if (on) {
    app.style.maxWidth = '390px'; app.style.margin = '0 auto';
    app.style.boxShadow = '0 0 0 100vw rgba(0,0,0,.7)';
    mStyle.textContent = 'body{overflow-x:hidden!important}#app,.app-root{max-width:390px!important;margin:0 auto!important}';
    var b = document.getElementById('htpMobBtn');
    if(b){b.textContent='\uD83D\uDCBB Desktop';b.style.background='rgba(73,232,194,.12)';}
  } else {
    app.style.maxWidth=''; app.style.margin=''; app.style.boxShadow='';
    mStyle.textContent='';
    var b2=document.getElementById('htpMobBtn');
    if(b2){b2.textContent='\uD83D\uDCF1 Mobile';b2.style.background='rgba(5,14,30,.85)';}
  }
  localStorage.setItem('htpMobSim', on?'1':'0');
}
