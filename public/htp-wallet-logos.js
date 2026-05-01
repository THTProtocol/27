/**
 * htp-wallet-logos.js — v7.3
 * - ALL wallet buttons call native selWallet() — the correct entry point
 * - selWallet() already handles: extension connect, TN12, mnemonic fallback, balance polling
 * - Replaces ONLY .w-grid in-place, preserves all .w-sec blocks (mnemonic, hex, custom node)
 * - No address-paste nonsense for mobile wallets
 */

var _LOGO_URLS = {
  KasWare:  'https://raw.githubusercontent.com/kasware-wallet/extension/main/build/_raw/images/logo/logo@128x.png',
  Kastle:   'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://kastle.cc&size=128',
  Kasperia: 'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128-rj-sc0x00ffffff',
  OKX:      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://okx.com&size=128',
  Kaspium:  'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://kaspium.io&size=128',
  Kasanova: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://kasanova.io&size=128',
  KaspaCom: 'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://wallet.kaspa.com&size=128',
  Tangem:   'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://tangem.com&size=128'
};

window.HTP_WALLET_LOGOS = {
  KasWare:  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0b1f15"/><polygon points="13,12 25,12 25,29 39,12 51,12 36,32 51,52 39,52 25,35 25,52 13,52" fill="#49e8c2"/></svg>',
  Kastle:   '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0d1623"/><rect x="8" y="38" width="48" height="18" rx="1" fill="#5ba3d4"/><rect x="8" y="24" width="12" height="16" fill="#5ba3d4"/><rect x="44" y="24" width="12" height="16" fill="#5ba3d4"/><rect x="24" y="20" width="16" height="20" fill="#7bbce8"/><rect x="8" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="16" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="44" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="52" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="24" y="13" width="4" height="9" fill="#7bbce8"/><rect x="31" y="13" width="4" height="9" fill="#7bbce8"/><rect x="38" y="13" width="4" height="9" fill="#7bbce8"/><rect x="28" y="44" width="8" height="12" rx="4" fill="#0d1623"/></svg>',
  Kasperia: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0a1628"/><path d="M18 38 Q26 16 40 14 Q54 12 50 30 Q46 44 32 50 Q20 54 18 38Z" fill="#4db8e8" opacity="0.9"/><path d="M20 36 Q28 18 40 16 Q52 14 48 30 Q44 42 32 48" fill="none" stroke="#7dd4f0" stroke-width="1.5" opacity="0.6"/><circle cx="38" cy="20" r="3" fill="#7dd4f0" opacity="0.8"/></svg>',
  OKX:      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#000"/><rect x="8" y="8" width="20" height="20" rx="3" fill="#fff"/><rect x="36" y="8" width="20" height="20" rx="3" fill="#fff"/><rect x="8" y="36" width="20" height="20" rx="3" fill="#fff"/><rect x="36" y="36" width="20" height="20" rx="3" fill="#49e8c2"/></svg>',
  Kasanova: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ksnBg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#0d0d22"/><stop offset="100%" stop-color="#070714"/></radialGradient><linearGradient id="ksnWave" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#06b6d4"/><stop offset="50%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#ksnBg)"/><path d="M10 48 C14 36 20 28 28 24 C36 20 40 22 38 30 C36 36 30 38 26 34 C22 30 24 22 32 18 C40 14 50 18 54 28" fill="none" stroke="url(#ksnWave)" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="3.5" fill="#a78bfa" opacity="0.9"/><circle cx="22" cy="40" r="2" fill="#06b6d4" opacity="0.7"/></svg>',
  Kaspium:  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#071c10"/><path d="M32 6 L55 16 L55 36 C55 50 32 60 32 60 C32 60 9 50 9 36 L9 16 Z" fill="#1a5c32" stroke="#49e8c2" stroke-width="2"/><rect x="22" y="20" width="5" height="24" rx="1" fill="#49e8c2"/><polygon points="27,32 40,20 46,20 33,32 46,44 40,44" fill="#49e8c2"/></svg>',
  KaspaCom: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0a1628"/><circle cx="32" cy="32" r="18" fill="none" stroke="#49e8c2" stroke-width="2"/><text x="32" y="37" text-anchor="middle" font-size="18" font-weight="bold" fill="#49e8c2" font-family="monospace">K</text></svg>',
  Tangem:   '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#061510"/><rect x="6" y="14" width="52" height="36" rx="6" fill="none" stroke="#49e8c2" stroke-width="2.2"/><rect x="13" y="28" width="14" height="10" rx="3" fill="none" stroke="#49e8c2" stroke-width="1.5"/><line x1="13" y1="33" x2="27" y2="33" stroke="#49e8c2" stroke-width="1"/><line x1="20" y1="28" x2="20" y2="38" stroke="#49e8c2" stroke-width="1"/><path d="M35 28 Q42 33 35 38" fill="none" stroke="#49e8c2" stroke-width="1.5" stroke-linecap="round"/><path d="M39 25 Q49 33 39 41" fill="none" stroke="#49e8c2" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>'
};

function getWalletLogo(name) {
  return window.HTP_WALLET_LOGOS[name] || window.HTP_WALLET_LOGOS['KasWare'];
}

// ── Nav-pill active indicator fix ──────────────────────────────────────────────
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

// ── Wallet grid ───────────────────────────────────────────────────────────────
(function patchWalletGrid() {

  // ALL wallets — every button calls selWallet(id) directly
  // selWallet() handles: extension detect, requestAccounts, TN12, error messaging
  // If not installed, selWallet() shows the install link and tells user to use mnemonic below
  var ALL_WALLETS = [
    { id:'KasWare',  label:'KasWare',  badge:'Chrome · Firefox', detect: function(){ return !!window.kasware; } },
    { id:'Kastle',   label:'Kastle',   badge:'Chrome · Mobile',  detect: function(){ return !!window.kastle; } },
    { id:'Kasperia', label:'Kasperia', badge:'Chrome',             detect: function(){ return !!window.kasperia; } },
    { id:'OKX',      label:'OKX',      badge:'Chrome · Mobile',  detect: function(){ return !!(window.okxwallet && window.okxwallet.kaspa); } },
    { id:'Kasanova', label:'Kasanova', badge:'iOS · Android',    detect: function(){ return !!(window.kasanova || window.KasanovaWallet); } },
    { id:'Kaspium',  label:'Kaspium',  badge:'iOS · Android',    detect: function(){ return !!(window.kaspium || window.KaspiumWallet); } },
    { id:'KaspaCom', label:'KaspaCom', badge:'Web · Mobile',     detect: function(){ return !!(window.kaspa && window.kaspa.requestAccounts); } }
  ];

  function logoEl(id) {
    var url = _LOGO_URLS[id];
    if (url) {
      return '<img src="' + url + '" width="48" height="48"'
           + ' style="border-radius:10px;display:block;margin:0 auto 10px" loading="lazy"'
           + ' onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
           + '<div style="display:none;width:48px;height:48px;margin:0 auto 10px;border-radius:10px;'
           + 'align-items:center;justify-content:center;background:rgba(73,232,194,.08)">'
           + getWalletLogo(id) + '</div>';
    }
    return '<div style="width:48px;height:48px;margin:0 auto 10px;border-radius:10px;display:flex;'
         + 'align-items:center;justify-content:center;background:rgba(73,232,194,.08)">'
         + getWalletLogo(id) + '</div>';
  }

  function buildCard(w) {
    var found = w.detect();
    return [
      '<div class="wpc" data-wid="', w.id, '"'
      + ' onclick="(typeof selWallet===\'function\'?selWallet(\'', w.id, '\'):window._wpcFallback(\'', w.id, '\'))"',
      ' style="background:rgba(255,255,255,.028);border:1px solid ',
        found ? 'rgba(73,232,194,.4)' : 'rgba(255,255,255,.07)',
      ';border-radius:14px;padding:18px 10px 14px;text-align:center;cursor:pointer;',
      'transition:border-color .2s,transform .2s,box-shadow .2s;position:relative;overflow:hidden;">',
        found ? '<div style="position:absolute;top:8px;right:8px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 7px #49e8c2;animation:wpc-pulse 2s ease-in-out infinite"></div>' : '',
        logoEl(w.id),
        '<div style="font-size:13px;font-weight:800;color:#f1f5f9;margin-bottom:3px">', w.label, '</div>',
        '<div style="font-size:10px;margin-bottom:10px;color:', found ? '#49e8c2' : '#556070', '">',
          found ? '● Detected' : w.badge,
        '</div>',
        '<button style="width:100%;padding:7px 4px;border-radius:8px;cursor:pointer;',
          'font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;',
          'background:', found ? '#49e8c2' : 'rgba(73,232,194,.06)', ';',
          'color:', found ? '#02110d' : '#49e8c2', ';',
          'border:1px solid ', found ? 'transparent' : 'rgba(73,232,194,.3)', '">',
          'Connect',
        '</button>',
      '</div>'
    ].join('');
  }

  // Safety fallback if selWallet somehow not ready yet
  window._wpcFallback = function(id) {
    setTimeout(function() {
      if (typeof window.selWallet === 'function') window.selWallet(id);
      else if (window.showToast) window.showToast('Page still loading — try again in a moment', 'warn');
    }, 200);
  };

  function buildGrid() {
    return [
      '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
           'color:#49e8c2;margin-bottom:12px;display:flex;align-items:center;gap:8px">',
        '<span>Choose Wallet</span>',
        '<span style="height:1px;flex:1;background:rgba(73,232,194,.15)"></span>',
        '<span style="color:#556070">Click to connect · mnemonic & hex below</span>',
      '</div>',
      '<div id="wpc-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">',
        ALL_WALLETS.map(buildCard).join(''),
      '</div>'
    ].join('');
  }

  function injectStyles() {
    if (document.getElementById('wpc-style')) return;
    var s = document.createElement('style');
    s.id = 'wpc-style';
    s.textContent = [
      '.wpc{transition:transform .18s,box-shadow .18s}',
      '.wpc:hover{transform:translateY(-3px)!important;box-shadow:0 14px 32px rgba(0,0,0,.55)!important}',
      '@keyframes wpc-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
      '@media(min-width:480px){#wpc-grid{grid-template-columns:repeat(4,1fr)!important}}',
      '@media(min-width:720px){#wpc-grid{grid-template-columns:repeat(7,1fr)!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  function run() {
    var section = document.getElementById('v-wallet');
    if (!section) return;

    // Re-render only if already injected
    var existing = document.getElementById('wpc-wrap');
    if (existing) {
      existing.innerHTML = buildGrid();
      return;
    }

    var wrap = document.createElement('div');
    wrap.id = 'wpc-wrap';
    wrap.style.cssText = 'margin-bottom:24px';
    wrap.innerHTML = buildGrid();

    // Replace the old .w-grid in-place — all .w-sec blocks (mnemonic, hex, node) stay untouched
    var oldGrid = section.querySelector('.w-grid');
    if (oldGrid) {
      oldGrid.parentNode.replaceChild(wrap, oldGrid);
    } else {
      var mx = section.querySelector('.mx') || section;
      var sh = mx.querySelector('.sh');
      mx.insertBefore(wrap, sh ? sh.nextSibling : mx.firstChild);
    }

    // Fix section subtitle — tell users mnemonic/hex are below
    var sp = section.querySelector('.sh p');
    if (sp) sp.textContent = 'Click a wallet to connect. On TN12, use Mnemonic or Hex Key import below.';

    injectStyles();
    console.log('[HTP] wallet grid v7.3 — all buttons call selWallet(), mnemonic/hex preserved below');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  var _origGo = window.go;
  if (typeof _origGo === 'function' && !_origGo._wlPatch) {
    window.go = function(v) { _origGo(v); if (v === 'wallet') setTimeout(run, 150); };
    window.go._wlPatch = true;
  }
  window.addEventListener('htp:view:wallet', function() { setTimeout(run, 150); });

})();
