/**
 * htp-wallet-fix.js
 * Patches:
 * 1. selWallet() — handle connect() vs requestAccounts() per wallet
 * 2. Wallet cards — show Install (with link) for undetected, Connect for detected
 * 3. Mnemonic + Hex sections — add TN12/Mainnet network selector that updates activeNet before connect
 * 4. Mobile preview toggle button (desktop only)
 * 5. Auto-switch to mobile layout when real mobile UA detected
 */
(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // 1. PATCH selWallet — handle all provider API variants
  // ─────────────────────────────────────────────────────────────────

  var INSTALL_URLS = {
    KasWare:  'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
    Kastle:   'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
    Kasperia: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
    OKX:      'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
    Kasanova: 'https://kasanova.app',
    Kaspium:  'https://kaspium.io',
    KaspaCom: 'https://wallet.kaspa.com'
  };

  // Normalise accounts response across all wallet APIs
  function extractAddress(result) {
    if (!result) return null;
    if (Array.isArray(result)) return result[0] || null;
    if (typeof result === 'string') return result;
    if (result.address) return result.address;
    if (result.accounts && result.accounts[0]) return result.accounts[0];
    return null;
  }

  // Call whatever connect method the provider exposes
  async function connectProvider(provider) {
    // Try in priority order: requestAccounts → connect → enable
    if (typeof provider.requestAccounts === 'function') {
      return extractAddress(await provider.requestAccounts());
    }
    if (typeof provider.connect === 'function') {
      return extractAddress(await provider.connect());
    }
    if (typeof provider.enable === 'function') {
      return extractAddress(await provider.enable());
    }
    throw new Error('provider has no connect method (requestAccounts / connect / enable)');
  }

  // Override selWallet with a version that handles all edge cases
  window._origSelWallet = window.selWallet;
  window.selWallet = async function(name) {
    var statusEl = document.getElementById('walletStatus');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span style="color:var(--muted)">Connecting to ' + name + '…</span>';
    }

    // Wait up to 3s for extension to inject itself
    var provider = null;
    for (var i = 0; i < 20; i++) {
      if (typeof window.getProvider === 'function') provider = window.getProvider(name);
      else {
        var w = window;
        switch(name) {
          case 'KasWare':  provider = w.kasware || w.kasWare; break;
          case 'Kastle':   provider = w.kastle; break;
          case 'Kasperia': provider = w.kasperia; break;
          case 'OKX':      provider = w.okxwallet && w.okxwallet.kaspa ? w.okxwallet.kaspa : null; break;
          case 'Kasanova': provider = w.kasanova || w.KasanovaWallet; break;
          case 'Kaspium':  provider = w.kaspium  || w.KaspiumWallet; break;
          case 'KaspaCom': provider = w.kaspacom || (w.kaspa && w.kaspa.requestAccounts ? w.kaspa : null); break;
          default:         provider = w.kasware || w.kastle || null;
        }
      }
      if (provider) break;
      await new Promise(function(r){ setTimeout(r, 150); });
    }

    if (!provider) {
      var url = INSTALL_URLS[name] || '';
      var msg = '<div style="color:#ef4444;font-weight:600;margin-bottom:6px">' + name + ' not detected.</div>' +
        '<div style="font-size:12px;color:var(--text);line-height:1.55">' +
        (url ? 'Install it from <a href="' + url + '" target="_blank" rel="noopener" style="color:#49e8c2;font-weight:700">' + url.replace(/^https?:\/\//,'').split('/')[0] + ' ↗</a>, refresh, then connect.<br>' : '') +
        'Or use <strong style="color:#49e8c2">Mnemonic</strong> or <strong style="color:#49e8c2">Hex Key</strong> below — works on both TN12 &amp; Mainnet.' +
        '</div>';
      if (statusEl) statusEl.innerHTML = msg;
      if (window.showToast) window.showToast(name + ' not detected — see wallet section for install link', 'error');
      // Scroll to mnemonic section
      var mnSec = document.querySelector('.w-sec');
      if (mnSec) setTimeout(function(){ mnSec.scrollIntoView({ behavior:'smooth', block:'start' }); }, 400);
      return;
    }

    try {
      var addr = await connectProvider(provider);
      if (!addr) throw new Error('No address returned — connection rejected or no accounts.');

      window.walletAddress = window.htpAddress = window.connectedAddress = window.htpWalletAddress = addr;
      window.walletProvider = name;
      window.conn = true;

      // Network
      var network = 'unknown';
      try {
        network = await provider.getNetwork();
        if (typeof network === 'number') network = network === 0 ? 'mainnet' : 'testnet-' + network;
      } catch(e) {}

      // Balance
      try {
        var bal = await provider.getBalance();
        window.walletBalance = {
          confirmed:   bal.confirmed || bal.mature || 0,
          unconfirmed: bal.unconfirmed || bal.pending || 0,
          total:       bal.total || ((bal.confirmed || bal.mature || 0) + (bal.unconfirmed || bal.pending || 0))
        };
      } catch(e) { window.walletBalance = { confirmed:0, unconfirmed:0, total:0 }; }

      // Public key
      try { window.walletPubKey = await provider.getPublicKey(); } catch(e) {}

      // Auto-sync network
      if (network !== 'unknown') {
        var isMain = (network === 'mainnet' || network === 0);
        if (typeof window.htpSetNetwork === 'function') window.htpSetNetwork(isMain ? 'mainnet' : 'tn12');
      }

      if (typeof window.updateWalletUI === 'function') window.updateWalletUI(name, network);
      if (typeof window.startBalancePoller === 'function') window.startBalancePoller();
      var dcBtn = document.getElementById('dcBtn');
      if (dcBtn) dcBtn.style.display = 'inline-block';

      // Event listeners
      if (provider.on) {
        try {
          provider.on('accountsChanged', function(accs) {
            if (accs && accs.length > 0) { window.walletAddress = accs[0]; if (typeof window.updateWalletUI === 'function') window.updateWalletUI(name, network); }
          });
          provider.on('balanceChanged', function(b) {
            window.walletBalance = {
              confirmed:   b.balance ? (b.balance.mature||0) : (b.confirmed||0),
              unconfirmed: b.balance ? (b.balance.pending||0) : (b.unconfirmed||0),
              total:       b.balance ? (b.balance.mature||0)+(b.balance.pending||0) : (b.total||0)
            };
            if (typeof window.updateBalanceDisplay === 'function') window.updateBalanceDisplay();
          });
          provider.on('networkChanged', function(n){ network = n; if (typeof window.updateWalletUI === 'function') window.updateWalletUI(name, n); });
        } catch(e) {}
      }

    } catch(e) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">Connection failed: ' + (e.message || e) + '</span>';
      window.conn = false;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // 2. WALLET CARD PATCH — Install button for undetected wallets
  // ─────────────────────────────────────────────────────────────────

  var DETECT_FNS = {
    KasWare:  function(){ return !!(window.kasware || window.kasWare); },
    Kastle:   function(){ return !!window.kastle; },
    Kasperia: function(){ return !!window.kasperia; },
    OKX:      function(){ return !!(window.okxwallet && window.okxwallet.kaspa); },
    Kasanova: function(){ return !!(window.kasanova || window.KasanovaWallet); },
    Kaspium:  function(){ return !!(window.kaspium  || window.KaspiumWallet); },
    KaspaCom: function(){ return !!(window.kaspacom || (window.kaspa && window.kaspa.requestAccounts)); }
  };

  function patchCardButtons() {
    document.querySelectorAll('.wpc[data-wid]').forEach(function(card) {
      var id = card.getAttribute('data-wid');
      var detectFn = DETECT_FNS[id];
      if (!detectFn) return;
      var found = detectFn();
      var btn = card.querySelector('button');
      if (!btn) return;

      if (!found) {
        var url = INSTALL_URLS[id];
        btn.textContent = 'Install ↗';
        btn.style.background = 'rgba(73,232,194,.04)';
        btn.style.color = '#49e8c2';
        btn.style.border = '1px solid rgba(73,232,194,.25)';
        // Remove existing onclick, set install redirect
        card.onclick = null;
        btn.onclick = function(e) {
          e.stopPropagation();
          if (url) window.open(url, '_blank');
          if (window.showToast) window.showToast('Opening ' + id + ' install page…', 'info');
        };
        // Update badge
        var badge = card.querySelectorAll('div')[1];
        if (badge) { badge.textContent = 'Not installed'; badge.style.color = '#ef4444'; }
        card.style.borderColor = 'rgba(255,255,255,.06)';
        card.style.opacity = '0.75';
      } else {
        btn.textContent = 'Connect';
        btn.style.background = '#49e8c2';
        btn.style.color = '#02110d';
        btn.style.border = '1px solid transparent';
        card.onclick = function(){ window.selWallet(id); };
        btn.onclick = null;
        card.style.opacity = '1';
        card.style.borderColor = 'rgba(73,232,194,.4)';
        // Green dot
        if (!card.querySelector('.wpc-dot')) {
          var dot = document.createElement('div');
          dot.className = 'wpc-dot';
          dot.style.cssText = 'position:absolute;top:8px;right:8px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 7px #49e8c2;animation:wpc-pulse 2s ease-in-out infinite';
          card.style.position = 'relative';
          card.appendChild(dot);
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. MNEMONIC + HEX SECTIONS — add network selector (TN12 / Mainnet)
  // ─────────────────────────────────────────────────────────────────

  function buildNetSelector(id) {
    return '<div id="' + id + '" style="display:flex;gap:6px;margin-bottom:12px">' +
      '<button data-net="tn12" onclick="window._htpSetConnectNet(\'' + id + '\',\'tn12\')"' +
        ' style="flex:1;padding:7px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;' +
        'background:#49e8c2;color:#02110d;border:1px solid transparent">TN12</button>' +
      '<button data-net="mainnet" onclick="window._htpSetConnectNet(\'' + id + '\',\'mainnet\')"' +
        ' style="flex:1;padding:7px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;' +
        'background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.25)">Mainnet</button>' +
    '</div>';
  }

  window._htpSetConnectNet = function(selectorId, net) {
    // Update activeNet used by recW() and recHex()
    window.activeNet = net;
    if (typeof window.htpSetNetwork === 'function') window.htpSetNetwork(net);
    // Update button styles
    var sel = document.getElementById(selectorId);
    if (!sel) return;
    sel.querySelectorAll('button').forEach(function(b) {
      var isActive = b.getAttribute('data-net') === net;
      b.style.background = isActive ? '#49e8c2' : 'rgba(73,232,194,.06)';
      b.style.color      = isActive ? '#02110d' : '#49e8c2';
      b.style.border     = isActive ? '1px solid transparent' : '1px solid rgba(73,232,194,.25)';
    });
    if (window.showToast) window.showToast('Network set to ' + (net === 'tn12' ? 'TN12 Testnet' : 'Mainnet'), 'info');
  };

  function injectNetSelectors() {
    // Find "Connect via Mnemonic" section — has textarea#recMn
    var mnArea = document.getElementById('recMn');
    if (mnArea && !document.getElementById('htp-net-sel-mn')) {
      var div = document.createElement('div');
      div.innerHTML = buildNetSelector('htp-net-sel-mn');
      mnArea.parentNode.parentNode.insertBefore(div.firstElementChild, mnArea.parentNode);
    }

    // Find "Connect via Private Key" section — has input#recHexKey
    var hexInput = document.getElementById('recHexKey');
    if (hexInput && !document.getElementById('htp-net-sel-hex')) {
      var div2 = document.createElement('div');
      div2.innerHTML = buildNetSelector('htp-net-sel-hex');
      var hexFg = hexInput.closest('.fg') || hexInput.parentNode;
      hexFg.parentNode.insertBefore(div2.firstElementChild, hexFg);
    }

    // Sync button states to current activeNet
    var cur = window.activeNet || 'tn12';
    ['htp-net-sel-mn','htp-net-sel-hex'].forEach(function(sid) {
      var sel = document.getElementById(sid);
      if (!sel) return;
      sel.querySelectorAll('button').forEach(function(b) {
        var isActive = b.getAttribute('data-net') === cur;
        b.style.background = isActive ? '#49e8c2' : 'rgba(73,232,194,.06)';
        b.style.color      = isActive ? '#02110d' : '#49e8c2';
        b.style.border     = isActive ? '1px solid transparent' : '1px solid rgba(73,232,194,.25)';
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. MOBILE PREVIEW TOGGLE (desktop only) + auto-detect real mobile
  // ─────────────────────────────────────────────────────────────────

  var isMobileSim = false;
  var MOBILE_WIDTH = '390px'; // iPhone 14 Pro width

  function applyMobileView(active) {
    isMobileSim = active;
    var root = document.documentElement;
    var app  = document.getElementById('app') || document.body;

    if (active) {
      root.style.setProperty('--htp-sim-mobile', '1');
      app.style.maxWidth  = MOBILE_WIDTH;
      app.style.margin    = '0 auto';
      app.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.75)';
      app.style.minHeight = '100vh';
      document.body.style.background = '#050810';
      // Force viewport-style font scaling
      var mStyle = document.getElementById('htp-mobile-sim-style');
      if (!mStyle) {
        mStyle = document.createElement('style');
        mStyle.id = 'htp-mobile-sim-style';
        document.head.appendChild(mStyle);
      }
      mStyle.textContent = [
        'body { overflow-x: hidden !important; }',
        '#app, .app-root { max-width:' + MOBILE_WIDTH + ' !important; margin:0 auto !important; }',
        // Make nav bottom-bar sticky like mobile
        '.nav-bar,.bottom-nav,nav { position:fixed !important; bottom:0 !important; left:50% !important; transform:translateX(-50%) !important; width:' + MOBILE_WIDTH + ' !important; }'
      ].join('\n');
      // Update toggle button
      var btn = document.getElementById('htp-mobile-toggle');
      if (btn) { btn.textContent = '💻 Desktop'; btn.title = 'Switch to desktop view'; btn.style.background = 'rgba(73,232,194,.15)'; }
    } else {
      root.style.removeProperty('--htp-sim-mobile');
      app.style.maxWidth  = '';
      app.style.margin    = '';
      app.style.boxShadow = '';
      document.body.style.background = '';
      var mStyle2 = document.getElementById('htp-mobile-sim-style');
      if (mStyle2) mStyle2.textContent = '';
      var btn2 = document.getElementById('htp-mobile-toggle');
      if (btn2) { btn2.textContent = '📱 Mobile'; btn2.title = 'Preview mobile layout'; btn2.style.background = 'rgba(255,255,255,.05)'; }
    }
    localStorage.setItem('htpMobileSim', active ? '1' : '0');
  }

  function injectMobileToggle() {
    // Only show on non-touch desktop
    var isTruePhone = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isTruePhone) {
      // Real phone — force mobile layout automatically
      applyMobileView(true);
      return;
    }

    if (document.getElementById('htp-mobile-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'htp-mobile-toggle';
    btn.textContent = '📱 Mobile';
    btn.title = 'Preview mobile layout';
    btn.style.cssText = [
      'position:fixed',
      'bottom:72px',
      'right:14px',
      'z-index:9999',
      'padding:8px 13px',
      'border-radius:20px',
      'font-size:11px',
      'font-weight:800',
      'letter-spacing:.05em',
      'color:#49e8c2',
      'background:rgba(255,255,255,.05)',
      'border:1px solid rgba(73,232,194,.25)',
      'cursor:pointer',
      'backdrop-filter:blur(8px)',
      'box-shadow:0 4px 20px rgba(0,0,0,.4)',
      'transition:all .2s'
    ].join(';');
    btn.onclick = function() { applyMobileView(!isMobileSim); };
    document.body.appendChild(btn);

    // Restore previous state
    if (localStorage.getItem('htpMobileSim') === '1') applyMobileView(true);
  }

  // ─────────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────────

  function boot() {
    patchCardButtons();
    injectNetSelectors();
    injectMobileToggle();

    // Re-patch cards when wallet view opens (detection state may change)
    var _origGo = window.go;
    if (typeof _origGo === 'function' && !_origGo._fixPatch) {
      window.go = function(v) {
        _origGo(v);
        if (v === 'wallet') setTimeout(function() { patchCardButtons(); injectNetSelectors(); }, 200);
      };
      window.go._fixPatch = true;
    }
    window.addEventListener('htp:view:wallet', function() {
      setTimeout(function() { patchCardButtons(); injectNetSelectors(); }, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
