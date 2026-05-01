/**
 * htp-wallet-logos.js — v6.1
 * Real official logos sourced from:
 *   KasWare  → github.com/kasware-wallet/extension (confirmed 200)
 *   Kastle   → gstatic faviconV2 from kastle.cc (confirmed 200)
 *   Kasperia → lh3.googleusercontent.com Chrome Web Store icon (confirmed 200)
 *   OKX      → gstatic faviconV2 from okx.com (confirmed 200)
 *   Kaspium  → gstatic faviconV2 from kaspium.io (confirmed 200)
 *   Tangem   → gstatic faviconV2 from tangem.com (confirmed 200)
 */

var _LOGO_URLS = {
  KasWare:  'https://raw.githubusercontent.com/kasware-wallet/extension/main/build/_raw/images/logo/logo@128x.png',
  Kastle:   'https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://kastle.cc&size=128',
  Kasperia: 'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128-rj-sc0x00ffffff',
  OKX:      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://okx.com&size=128',
  Kaspium:  'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://kaspium.io&size=128',
  Tangem:   'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://tangem.com&size=128'
};

window.HTP_WALLET_LOGOS = {
  KasWare:  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0b1f15"/><polygon points="13,12 25,12 25,29 39,12 51,12 36,32 51,52 39,52 25,35 25,52 13,52" fill="#49e8c2"/></svg>',
  Kastle:   '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0d1623"/><rect x="8" y="38" width="48" height="18" rx="1" fill="#5ba3d4"/><rect x="8" y="24" width="12" height="16" fill="#5ba3d4"/><rect x="44" y="24" width="12" height="16" fill="#5ba3d4"/><rect x="24" y="20" width="16" height="20" fill="#7bbce8"/><rect x="8" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="16" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="44" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="52" y="18" width="4" height="8" fill="#5ba3d4"/><rect x="24" y="13" width="4" height="9" fill="#7bbce8"/><rect x="31" y="13" width="4" height="9" fill="#7bbce8"/><rect x="38" y="13" width="4" height="9" fill="#7bbce8"/><rect x="28" y="44" width="8" height="12" rx="4" fill="#0d1623"/></svg>',
  Kasperia: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#0a1628"/><path d="M18 38 Q26 16 40 14 Q54 12 50 30 Q46 44 32 50 Q20 54 18 38Z" fill="#4db8e8" opacity="0.9"/><path d="M20 36 Q28 18 40 16 Q52 14 48 30 Q44 42 32 48" fill="none" stroke="#7dd4f0" stroke-width="1.5" opacity="0.6"/><circle cx="38" cy="20" r="3" fill="#7dd4f0" opacity="0.8"/></svg>',
  OKX:      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#000"/><rect x="8" y="8" width="20" height="20" rx="3" fill="#fff"/><rect x="36" y="8" width="20" height="20" rx="3" fill="#fff"/><rect x="8" y="36" width="20" height="20" rx="3" fill="#fff"/><rect x="36" y="36" width="20" height="20" rx="3" fill="#49e8c2"/></svg>',
  Kaspium:  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#071c10"/><path d="M32 6 L55 16 L55 36 C55 50 32 60 32 60 C32 60 9 50 9 36 L9 16 Z" fill="#1a5c32" stroke="#49e8c2" stroke-width="2"/><rect x="22" y="20" width="5" height="24" rx="1" fill="#49e8c2"/><polygon points="27,32 40,20 46,20 33,32 46,44 40,44" fill="#49e8c2"/></svg>',
  Tangem:   '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" rx="14" fill="#061510"/><rect x="6" y="14" width="52" height="36" rx="6" fill="none" stroke="#49e8c2" stroke-width="2.2"/><rect x="13" y="28" width="14" height="10" rx="3" fill="none" stroke="#49e8c2" stroke-width="1.5"/><line x1="13" y1="33" x2="27" y2="33" stroke="#49e8c2" stroke-width="1"/><line x1="20" y1="28" x2="20" y2="38" stroke="#49e8c2" stroke-width="1"/><path d="M35 28 Q42 33 35 38" fill="none" stroke="#49e8c2" stroke-width="1.5" stroke-linecap="round"/><path d="M39 25 Q49 33 39 41" fill="none" stroke="#49e8c2" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>'
};

window.getWalletLogo = function(name) {
  return window.HTP_WALLET_LOGOS[name] || window.HTP_WALLET_LOGOS['KasWare'];
};

// ── Fix mobile hamburger visibility ──────────────────────────────────────────
(function fixMobileNav() {
  function applyNavFix() {
    var style = document.getElementById('wpc-nav-fix');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wpc-nav-fix';
      style.textContent = [
        '@media(max-width:959px){',
          '.menu-toggle{display:flex!important;align-items:center;justify-content:center;',
            'width:38px;height:38px;padding:0;font-size:22px;',
            'border:1px solid rgba(73,232,194,.3)!important;',
            'color:#49e8c2!important;border-radius:8px;cursor:pointer;',
            'background:rgba(73,232,194,.06)!important;flex-shrink:0}',
          '.hdr-in{flex-wrap:nowrap!important;justify-content:space-between!important}',
          '.hdr-r{order:3;flex-shrink:0}',
          '.hdr-t{flex:1;min-width:0}',
        '}'
      ].join('');
      document.head.appendChild(style);
    }
    var toggle = document.querySelector('.menu-toggle');
    if (toggle && !toggle._htpFixed) {
      toggle._htpFixed = true;
      document.querySelectorAll('.hdr-nav .nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var nav = document.getElementById('nav');
          if (nav) nav.classList.remove('open');
        });
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyNavFix);
  else applyNavFix();
})();

// ── Wallet grid ───────────────────────────────────────────────────────────────
(function patchWalletGrid() {

  function logoEl(id) {
    var url = _LOGO_URLS[id];
    var svg = window.HTP_WALLET_LOGOS[id] || '';
    var imgId = 'wpc-img-' + id;
    if (url) {
      return [
        '<div style="width:64px;height:64px;margin:0 auto 10px;border-radius:14px;overflow:hidden;',
        'display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);',
        'border:1px solid rgba(255,255,255,.08)">',
          '<img id="', imgId, '" src="', url, '"',
          ' style="width:60px;height:60px;object-fit:contain;border-radius:12px;display:block"',
          ' onerror="this.style.display=\'none\';var fb=document.getElementById(\'fb-', imgId, '\');if(fb)fb.style.display=\'flex\'">',
          '<div id="fb-', imgId, '" style="display:none;width:64px;height:64px;align-items:center;justify-content:center">', svg, '</div>',
        '</div>'
      ].join('');
    }
    return [
      '<div style="width:64px;height:64px;margin:0 auto 10px;border-radius:14px;overflow:hidden;',
      'display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);',
      'border:1px solid rgba(255,255,255,.08)">', svg, '</div>'
    ].join('');
  }

  var EXT_WALLETS = [
    { id:'KasWare',  label:'KasWare',    badge:'Chrome \u00b7 Firefox',
      detect: function(){ return !!window.kasware; },
      url:'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf' },
    { id:'Kastle',   label:'Kastle',     badge:'Chrome \u00b7 Mobile',
      detect: function(){ return !!window.kastle; },
      url:'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego' },
    { id:'Kasperia', label:'Kasperia',   badge:'Chrome',
      detect: function(){ return !!window.kasperia; },
      url:'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob' },
    { id:'OKX',      label:'OKX Wallet', badge:'Chrome \u00b7 Mobile',
      detect: function(){ return !!(window.okxwallet && window.okxwallet.kaspa); },
      url:'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiologcge' }
  ];

  var ADDR_WALLETS = [
    { id:'Kaspium', label:'Kaspium', badge:'iOS & Android',
      desc:'Open app \u2192 tap Receive \u2192 copy KAS address and paste below.',
      appstore:'https://apps.apple.com/app/kaspium-wallet/id1644798032',
      playstore:'https://play.google.com/store/apps/details?id=io.kaspium.kaspiumwallet' },
    { id:'Tangem',  label:'Tangem',  badge:'Hardware NFC',
      desc:'Open Tangem app \u2192 tap card \u2192 copy KAS address and paste below.',
      appstore:'https://apps.apple.com/app/tangem-crypto-cold-wallet/id1546877388',
      playstore:'https://play.google.com/store/apps/details?id=com.tangem.wallet' }
  ];

  function buildExtCard(w) {
    var found = w.detect();
    return [
      '<div class="wpc" data-wid="', w.id, '" onclick="window._wpcConnect(\'', w.id, '\')"',
      ' style="background:rgba(255,255,255,.028);border:1px solid ', found ? 'rgba(73,232,194,.4)' : 'rgba(255,255,255,.07)',
      ';border-radius:14px;padding:18px 10px 14px;text-align:center;cursor:pointer;',
      'transition:border-color .2s,transform .2s,box-shadow .2s;position:relative;overflow:hidden;">',
        found ? '<div style="position:absolute;top:8px;right:8px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 7px #49e8c2;animation:wpc-pulse 2s ease-in-out infinite"></div>' : '',
        logoEl(w.id),
        '<div style="font-size:13px;font-weight:800;color:#f1f5f9;margin-bottom:3px">', w.label, '</div>',
        '<div style="font-size:10px;margin-bottom:10px;color:', found ? '#49e8c2' : '#556070', '">',
          found ? '&#x25cf;&thinsp;Detected' : w.badge,
        '</div>',
        '<button style="width:100%;padding:7px 4px;background:', found ? '#49e8c2' : 'rgba(255,255,255,.06)',
          ';color:', found ? '#02110d' : '#7a8899',
          ';border:1px solid ', found ? 'transparent' : 'rgba(255,255,255,.12)',
          ';border-radius:8px;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">',
          found ? 'Connect' : 'Install &#8599;',
        '</button>',
      '</div>'
    ].join('');
  }

  function buildAddrCard(w) {
    return [
      '<div class="wpc wpc-addr" data-wid="', w.id, '"',
      ' style="background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.07);',
      'border-radius:14px;padding:18px 10px 14px;text-align:center;">',
        logoEl(w.id),
        '<div style="font-size:13px;font-weight:800;color:#f1f5f9;margin-bottom:3px">', w.label, '</div>',
        '<div style="font-size:10px;color:#556070;margin-bottom:8px">', w.badge, '</div>',
        '<p style="font-size:10px;color:#94a3b8;line-height:1.5;margin:0 0 10px;text-align:left">', w.desc, '</p>',
        '<div style="display:flex;gap:6px">',
          '<a href="', w.appstore, '" target="_blank" style="flex:1;padding:6px 4px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:9px;font-weight:700;color:#94a3b8;text-decoration:none;letter-spacing:.04em;text-transform:uppercase;display:block;text-align:center">&#xf8ff; App Store</a>',
          '<a href="', w.playstore, '" target="_blank" style="flex:1;padding:6px 4px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:7px;font-size:9px;font-weight:700;color:#94a3b8;text-decoration:none;letter-spacing:.04em;text-transform:uppercase;display:block;text-align:center">&#x25b6; Play Store</a>',
        '</div>',
      '</div>'
    ].join('');
  }

  window._wpcConnect = function(id) {
    var w = EXT_WALLETS.find(function(x){ return x.id === id; });
    if (!w) return;
    if (!w.detect()) { window.open(w.url, '_blank'); return; }
    if (typeof window.selWallet === 'function') { window.selWallet(id); return; }
    var providers = { KasWare: window.kasware, Kastle: window.kastle, Kasperia: window.kasperia,
      OKX: window.okxwallet && window.okxwallet.kaspa };
    var provider = providers[id];
    if (provider && provider.requestAccounts) {
      provider.requestAccounts().then(function(accounts) {
        if (accounts && accounts[0]) {
          window.walletAddress = window.htpAddress = window.connectedAddress = accounts[0];
          window.walletProvider = id;
          window.conn = true;
          window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: accounts[0], wallet: id } }));
          if (window.showToast) window.showToast(id + ' connected: ' + accounts[0].slice(0,14) + '\u2026', 'success');
          if (window.updateWalletUI) window.updateWalletUI(id, 'unknown');
        }
      }).catch(function(e) {
        if (window.showToast) window.showToast('Connection refused: ' + (e.message || e), 'error');
      });
    }
  };

  function buildGrid() {
    return [
      '<div style="margin-bottom:20px">',
        '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
             'color:#49e8c2;margin-bottom:12px;display:flex;align-items:center;gap:8px">',
          '<span>Browser Extensions</span>',
          '<span style="height:1px;flex:1;background:rgba(73,232,194,.15)"></span>',
          '<span style="color:#556070">Desktop \u2014 full connect</span>',
        '</div>',
        '<div id="wpc-ext-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">',
          EXT_WALLETS.map(buildExtCard).join(''),
        '</div>',
      '</div>',
      '<div>',
        '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
             'color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:8px">',
          '<span>Mobile &amp; Hardware</span>',
          '<span style="height:1px;flex:1;background:rgba(148,163,184,.15)"></span>',
          '<span style="color:#556070">Address-only</span>',
        '</div>',
        '<div id="wpc-addr-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">',
          ADDR_WALLETS.map(buildAddrCard).join(''),
        '</div>',
      '</div>'
    ].join('');
  }

  function run() {
    var section = document.getElementById('v-wallet');
    if (!section) return;
    var mx = section.querySelector('.mx');
    var container = mx || section;
    var sh = container.querySelector('.sh');
    Array.from(container.children).forEach(function(c) {
      if (c !== sh) container.removeChild(c);
    });
    var wrap = document.createElement('div');
    wrap.id = 'wpc-wrap';
    wrap.innerHTML = buildGrid();
    container.appendChild(wrap);
    if (sh) {
      var h2 = sh.querySelector('h2');
      var p  = sh.querySelector('p');
      if (h2) h2.textContent = 'Connect Wallet';
      if (p)  p.textContent  = '4 browser extensions connect instantly. Mobile & hardware wallets via address paste.';
    }
    if (!document.getElementById('wpc-style')) {
      var s = document.createElement('style');
      s.id = 'wpc-style';
      s.textContent = [
        '.wpc{transition:transform .18s,box-shadow .18s}',
        '.wpc:hover{transform:translateY(-3px)!important;box-shadow:0 14px 32px rgba(0,0,0,.55)!important}',
        '@keyframes wpc-pulse{0%,100%{opacity:1}50%{opacity:.4}}',
        '@media(min-width:540px){',
          '#wpc-ext-grid{grid-template-columns:repeat(4,1fr)!important}',
          '#wpc-addr-grid{grid-template-columns:repeat(2,1fr)!important}',
        '}'
      ].join('');
      document.head.appendChild(s);
    }
    console.log('[HTP] wallet grid v6.1 injected');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

})();
