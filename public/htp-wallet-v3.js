/**
 * htp-wallet-v3.js - Complete wallet management with mnemonic import, encryption, and persistence
 *
 * WALLET REGISTRY (10 wallets):
 *  BROWSER EXTENSIONS (connectable on desktop):
 *  - KasWare    : window.kasware           (Chrome extension)
 *  - Kastle     : window.kastle            (Chrome extension, Forbole)
 *  - Kasperia   : window.kasperia          (Chrome extension)
 *  - OKX        : window.okxwallet.kaspa   (Chrome extension, 30M+ users)
 *  - Kaspa-NG   : window.kasng             (Desktop app / browser mode)
 *
 *  MOBILE ONLY (link to app store):
 *  - Kasanova   : mobile dApp browser
 *  - Kaspium    : mobile wallet iOS & Android
 *
 *  WEB / NO-INSTALL:
 *  - KaspaCom   : web wallet (open in browser)
 *
 *  HARDWARE:
 *  - Tangem     : NFC hardware card (buy online)
 *
 *  BOT:
 *  - KSPR Bot   : Telegram bot (no install)
 */

(function(window) {
  'use strict';

  var SOMPI_PER_KAS = 100000000;

  /* ═══════════════════════════════════════════════════════════════════════════
   * WALLET REGISTRY
   * ═══════════════════════════════════════════════════════════════════════════ */

  var WALLET_REGISTRY = {
    'KasWare': {
      label: 'KasWare',
      type: 'Browser extension',
      btnLabel: 'Install ↗',
      canConnect: true,
      installUrl: 'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
      detect: function() { return window.kasware || window.kasWare || null; },
      connect: async function(provider) {
        var accounts = await provider.connect();
        return accounts && accounts[0];
      }
    },
    'Kastle': {
      label: 'Kastle',
      type: 'Browser extension',
      btnLabel: 'Install ↗',
      canConnect: true,
      installUrl: 'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
      detect: function() { return window.kastle || null; },
      connect: async function(provider) {
        // Kastle uses .connect() returning {address, publicKey}, NOT .connect()
        var result = await provider.connect();
        if (!result) throw new Error('Kastle connection rejected');
        if (typeof result === 'string') return result;
        if (result.address) return result.address;
        if (result.accounts && result.accounts.length) return result.accounts[0];
        throw new Error('Kastle returned unexpected data: ' + JSON.stringify(result));
      }
    },
    'Kasperia': {
      label: 'Kasperia',
      type: 'Browser extension',
      btnLabel: 'Install ↗',
      canConnect: true,
      installUrl: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
      detect: function() { return window.kasperia || null; },
      connect: async function(provider) {
        var accounts = await provider.connect();
        return accounts && accounts[0];
      }
    },
    'OKX': {
      label: 'OKX Wallet',
      type: 'Browser extension',
      btnLabel: 'Install ↗',
      canConnect: true,
      installUrl: 'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
      detect: function() { return (window.okxwallet && window.okxwallet.kaspa) ? window.okxwallet.kaspa : null; },
      connect: async function(provider) {
        var accounts = await provider.connect();
        return accounts && accounts[0];
      }
    },
    'KasNG': {
      label: 'Kaspa-NG',
      type: 'Desktop / Browser',
      btnLabel: 'Download ↗',
      canConnect: true,
      installUrl: 'https://github.com/aspectron/kaspa-ng/releases',
      detect: function() { return window.kasng || null; },
      connect: async function(provider) {
        // Kaspa-NG uses .connect() returning {address, accounts, publicKey}
        var result = await provider.connect();
        if (!result) throw new Error('Kaspa-NG connection rejected');
        if (typeof result === 'string') return result;
        if (result.address) return result.address;
        if (result.accounts && result.accounts.length) return result.accounts[0];
        throw new Error('Kaspa-NG returned unexpected data: ' + JSON.stringify(result));
      }
    },
    'Kasanova': {
      label: 'Kasanova',
      type: 'Mobile · iOS & Android',
      btnLabel: 'Get App ↗',
      canConnect: false,
      installUrl: 'https://kasanova.io',
      detect: function() { return (window.kasanova && window.kasanova.kasware) ? window.kasanova.kasware : null; },
      connect: async function(provider) {
        var accounts = await provider.connect();
        return accounts && accounts[0];
      }
    },
    'Kaspium': {
      label: 'Kaspium',
      type: 'Mobile · iOS & Android',
      btnLabel: 'Get App ↗',
      canConnect: true,
      installUrl: 'https://kaspium.io',
      detect: function() { return window.kaspium || null; },
      connect: async function(provider) {
        // Kaspium uses .connect() returning {address} or {accounts: [addr]}
        var result = await provider.connect();
        if (!result) throw new Error('Kaspium connection rejected');
        if (typeof result === 'string') return result;
        if (result.address) return result.address;
        if (result.accounts && result.accounts.length) return result.accounts[0];
        throw new Error('Kaspium returned unexpected data');
      }
    },
    'KaspaCom': {
      label: 'KaspaCom',
      type: 'Web wallet',
      btnLabel: 'Open ↗',
      canConnect: false,
      installUrl: 'https://kaspa.com',
      detect: function() { return window.kaspacom || null; },
      connect: async function(provider) {
        var result = await provider.connect();
        return result && (result.address || result);
      }
    },
    'Tangem': {
      label: 'Tangem',
      type: 'Hardware NFC card',
      btnLabel: 'Buy Card ↗',
      canConnect: false,
      installUrl: 'https://tangem.com/kaspa',
      detect: function() { return null; },
      connect: async function() { return null; }
    },
    'KSPRBot': {
      label: 'KSPR Bot',
      type: 'Telegram · no install',
      btnLabel: 'Open Bot ↗',
      canConnect: false,
      installUrl: 'https://t.me/kspr_home_bot',
      detect: function() { return null; },
      connect: async function() { return null; }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
   * REAL WALLET LOGOS
   * ═══════════════════════════════════════════════════════════════════════════ */

  // Inline SVG placeholder used when a remote favicon 404s. Picks the first
  // letter of the wallet name and draws it on the standard tile background.
  function placeholderSvg(letter) {
    var ch = (letter || '?').toString().charAt(0).toUpperCase();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">' +
      '<rect width="44" height="44" rx="10" fill="rgba(79,152,163,0.18)"/>' +
      '<rect x="3" y="3" width="38" height="38" rx="8" fill="#0a1f1a"/>' +
      '<text x="22" y="29" font-family="monospace,Courier New" font-size="19" font-weight="900" fill="#49EACB" text-anchor="middle">' + ch + '</text>' +
      '</svg>'
    );
  }

  function getWalletLogo(type) {
    var s = 'width:44px;height:44px;border-radius:8px;object-fit:contain;display:block;';
    // Each img falls back through: local png (when present) -> known favicon ->
    // inline SVG placeholder. We swap to the placeholder as the final step so
    // a broken network URL never leaves an empty img frame.
    var ph = {
      Kaspium:  placeholderSvg('K'),
      KaspaCom: placeholderSvg('K'),
      Tangem:   placeholderSvg('T'),
      KSPRBot:  placeholderSvg('B'),
      Kastle:   placeholderSvg('K'),
      Kasperia: placeholderSvg('K'),
      Kasanova: placeholderSvg('N'),
      KasNG:    placeholderSvg('N'),
      OKX:      placeholderSvg('O')
    };
    function imgWithFallback(primary, secondary, key) {
      var fb = ph[key] || placeholderSvg(key);
      var sec = secondary ? secondary : fb;
      // Two-step onerror: try secondary, then placeholder.
      var oerr = 'if(this.dataset.htpFb!==\'1\'){this.dataset.htpFb=\'1\';this.src=\'' + sec + '\';}else{this.onerror=null;this.src=\'' + fb + '\';}';
      return '<img src="' + primary + '" onerror="' + oerr + '" style="' + s + '">';
    }
    var logos = {
      // KasWare FX  inline SVG (site is down, no external dependency)
      'KasWare': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44" style="border-radius:8px;display:block"><rect width="44" height="44" rx="10" fill="#49EACB"/><rect x="3" y="3" width="38" height="38" rx="8" fill="#0a1f1a"/><text x="22" y="30" font-family="monospace,Courier New" font-size="19" font-weight="900" fill="#49EACB" text-anchor="middle">|&lt;</text></svg>',
      'Kastle':   imgWithFallback('img/kastle.png',   'https://kastle.cc/favicon.ico',   'Kastle'),
      'Kasperia': imgWithFallback('img/kasperia.png', 'https://kasperia.com/favicon.ico','Kasperia'),
      'OKX':      imgWithFallback('https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png', 'https://www.okx.com/favicon.ico', 'OKX'),
      'KasNG':    imgWithFallback('https://kaspa-ng.org/favicon.ico', 'https://raw.githubusercontent.com/aspectron/kaspa-ng/master/resources/icon.png', 'KasNG'),
      'Kasanova': imgWithFallback('https://kasanova.app/favicon.ico', 'https://kasanova.io/favicon.ico', 'Kasanova'),
      'Kaspium':  imgWithFallback('https://kaspium.io/favicon.ico', '', 'Kaspium'),
      'KaspaCom': imgWithFallback('https://kaspa.com/favicon.ico',  'https://kaspacom.com/favicon.ico', 'KaspaCom'),
      'Tangem':   imgWithFallback('https://tangem.com/favicon.ico', '', 'Tangem'),
      'KSPRBot':  imgWithFallback('https://kspr.app/favicon.ico',   'https://telegram.org/favicon.ico', 'KSPRBot')
    };
    return logos[type] || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44"><rect width="44" height="44" rx="10" fill="rgba(79,152,163,0.15)"/><circle cx="22" cy="22" r="12" fill="none" stroke="#4f98a3" stroke-width="2"/></svg>';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * CRYPTO UTILITIES — AES-256-GCM
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function deriveKeyFromString(secret) {
    var enc = new TextEncoder();
    var hash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
    return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptMnemonic(mnemonic, sessionKey) {
    try {
      var key = await deriveKeyFromString(sessionKey);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var plaintext = new TextEncoder().encode(mnemonic);
      var ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);
      return btoa(JSON.stringify({
        iv: Array.from(iv).map(b => String.fromCharCode(b)).join(''),
        ciphertext: Array.from(new Uint8Array(ciphertext)).map(b => String.fromCharCode(b)).join('')
      }));
    } catch(e) { console.error('[HTP Wallet] Encrypt error:', e); return null; }
  }

  async function decryptMnemonic(encrypted, sessionKey) {
    try {
      var data = JSON.parse(atob(encrypted));
      var iv = new Uint8Array(data.iv.split('').map(c => c.charCodeAt(0)));
      var ct = new Uint8Array(data.ciphertext.split('').map(c => c.charCodeAt(0)));
      var key = await deriveKeyFromString(sessionKey);
      var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      return new TextDecoder().decode(plain);
    } catch(e) { console.error('[HTP Wallet] Decrypt error:', e); return null; }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * MNEMONIC DERIVATION
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function deriveCaspaAddressFromMnemonic(mnemonicPhrase) {
    return new Promise(function(resolve) {
      if (!window.whenWasmReady) { console.error('[HTP Wallet] whenWasmReady missing'); return resolve(null); }
      window.whenWasmReady(function() {
        try {
          if (!window.kaspaSDK || !window.kaspaSDK.Mnemonic) { console.error('[HTP Wallet] WASM SDK not ready'); return resolve(null); }
          var mnemonic = window.kaspaSDK.Mnemonic.new(mnemonicPhrase);
          var xPriv = mnemonic.toXPrv('');
          var derivationPath = window.kaspaSDK.DerivationPath.new("m/44'/111111'/0'/0/0'");
          var privateKey = xPriv.derivePrivateKey(derivationPath);
          var addr = window.kaspaSDK.Address.fromPublicKey(privateKey.publicKey(), window.HTP_PREFIX);
          resolve(addr.toString());
        } catch(e) { console.error('[HTP Wallet] Derivation error:', e); resolve(null); }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * RPC BALANCE
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function fetchBalance(address) {
    try {
      var base = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || 'https://hightable.duckdns.org';
      var resp = await fetch(base + '/api/balance/' + address, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return null;
      var d = await resp.json();
      var kas = ((d.balance_sompi || 0) / 1e8).toFixed(4);
      var el = document.getElementById('htp-wallet-balance');
      if (el) { el.textContent = kas + ' KAS'; }
      window.htpBalance = parseFloat(kas);
      return d.balance_sompi || 0;
    } catch(e) { console.warn('[HTP Wallet] Balance error:', e); return null; }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * SESSION PERSISTENCE
   * ═══════════════════════════════════════════════════════════════════════════ */

  var SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  var WALLET_SESSION_KEY = 'htp_wallet_session';

  function generateSessionKey() {
    var key = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');
    window._htpSessionMnemonicKey = key;
    return key;
  }
  function getSessionKey() { return window._htpSessionMnemonicKey || generateSessionKey(); }

  async function saveMnemonicSession(mnemonic, address) {
    try {
      var enc = await encryptMnemonic(mnemonic, getSessionKey());
      if (!enc) return false;
      sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify({ encrypted: enc, address: address, timestamp: Date.now(), ttl: SESSION_TTL_MS }));
      return true;
    } catch(e) { return false; }
  }

  async function loadMnemonicSession() {
    try {
      var stored = sessionStorage.getItem(WALLET_SESSION_KEY);
      if (!stored) return null;
      var s = JSON.parse(stored);
      if (Date.now() - s.timestamp > s.ttl) { sessionStorage.removeItem(WALLET_SESSION_KEY); return null; }
      var mnemonic = await decryptMnemonic(s.encrypted, getSessionKey());
      return mnemonic ? { mnemonic: mnemonic, address: s.address } : null;
    } catch(e) { return null; }
  }

  function clearMnemonicSession() { try { sessionStorage.removeItem(WALLET_SESSION_KEY); } catch(e) {} }

  /* ═══════════════════════════════════════════════════════════════════════════
   * MNEMONIC IMPORT
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function importMnemonicWallet(phrase) {
    var words = phrase.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length !== 12 && words.length !== 24) return { ok: false, error: 'Mnemonic must be 12 or 24 words' };
    var address = await deriveCaspaAddressFromMnemonic(phrase);
    if (!address) return { ok: false, error: 'Failed to derive address. Invalid phrase or WASM not ready.' };
    var balanceSompi = await fetchBalance(address);
    if (balanceSompi === null) return { ok: false, error: 'Could not fetch balance. Network unavailable.' };
    await saveMnemonicSession(phrase, address);
    return { ok: true, address: address, balance: (balanceSompi / SOMPI_PER_KAS).toFixed(4) };
  }

  function formatAddress(addr) {
    if (!addr || addr.length < 10) return addr;
    return addr.substring(0, 6) + '…' + addr.slice(-4);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * UI BUILDER
   * ═══════════════════════════════════════════════════════════════════════════ */

  function buildWalletSectionHTML() {
    var html = '<section class="view" id="v-wallet-v3" style="display:none">';
    html += '<div class="mx sec-pad">';
    html += '<div class="sh"><h2>Connect Wallet</h2>';
    html += '<p style="color:var(--text-muted);font-size:13px">Choose your Kaspa wallet. Browser extensions connect directly — mobile and hardware wallets open their respective apps or stores.</p></div>';

    // ── BROWSER EXTENSIONS ──
    html += '<h4 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:0 0 10px">Browser Extensions</h4>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:28px">';
    ['KasWare','Kastle','Kasperia','OKX','KasNG'].forEach(function(key) {
      html += buildCard(key);
    });
    html += '</div>';

    // ── MOBILE ──
    html += '<h4 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:0 0 10px">Mobile Wallets</h4>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:28px">';
    ['Kasanova','Kaspium'].forEach(function(key) {
      html += buildCard(key);
    });
    html += '</div>';

    // ── OTHER ──
    html += '<h4 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:0 0 10px">Web &amp; Hardware</h4>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:28px">';
    ['KaspaCom','Tangem','KSPRBot'].forEach(function(key) {
      html += buildCard(key);
    });
    html += '</div>';

    // Connected wallet status
    html += '<div id="wallet-connected-status" style="display:none;padding:16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin-bottom:24px">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Connected Wallet</div>';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '<div><div id="connected-address" style="font-family:monospace;font-size:13px;color:var(--text);word-break:break-all;margin-bottom:6px"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted)">Balance: <span id="connected-balance">—</span> KAS</div></div>';
    html += '<button onclick="htpWalletV3.disconnect()" style="padding:8px 12px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0">Disconnect</button>';
    html += '</div></div>';

    // Manual address
    html += '<div class="w-sec" style="margin-bottom:24px">';
    html += '<h3 style="font-size:14px;font-weight:600;margin:0 0 8px">View Any Address</h3>';
    html += '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px">Enter a Kaspa address to view portfolio (read-only)</p>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<input id="manual-address-input" type="text" placeholder="kaspatest:qq..." style="flex:1;min-width:200px;padding:10px 12px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:13px"/>';
    html += '<button onclick="htpWalletV3.setManualAddress()" style="padding:10px 20px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px">View</button>';
    html += '</div></div>';

    // Mnemonic import
    html += '<div class="w-sec" style="border-top:1px solid var(--border);padding-top:20px">';
    html += '<button onclick="htpWalletV3.toggleMnemonicPanel()" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;text-align:left;display:flex;justify-content:space-between;align-items:center">';
    html += '<span>🔐 Import Seed Phrase (12 or 24 words)</span><span id="mnemonic-toggle-arrow">▼</span></button>';
    html += '<div id="mnemonic-import-panel" style="display:none;margin-top:10px;padding:14px;background:rgba(73,234,203,0.04);border:1px solid rgba(73,234,203,0.12);border-radius:8px">';
    html += '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px">Encrypted in-session only. Never sent to any server.</p>';
    html += '<textarea id="mnemonic-input" placeholder="word1 word2 word3 ... word12" style="width:100%;height:72px;padding:10px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;font-family:monospace;font-size:12px;box-sizing:border-box;resize:vertical;margin-bottom:10px"></textarea>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button onclick="htpWalletV3.importMnemonic()" style="flex:1;padding:10px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px">Import Wallet</button>';
    html += '<button onclick="htpWalletV3.clearMnemonicInput()" style="padding:10px 14px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-size:12px">Clear</button>';
    html += '</div>';
    html += '<div id="mnemonic-status" style="display:none;margin-top:10px;padding:10px;border-radius:6px;font-size:12px"></div>';
    html += '</div></div>';

    // Network
    html += '<div class="w-sec" style="border-top:1px solid var(--border);padding-top:20px;margin-top:20px">';
    html += '<h3 style="font-size:14px;font-weight:600;margin:0 0 10px">Network</h3>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<button id="network-tn12" class="chip chip-a" onclick="htpWalletV3.setNetwork(\'tn12\')">TN12 Testnet</button>';
    html += '<button id="network-mainnet" class="chip" onclick="htpWalletV3.setNetwork(\'mainnet\')">Mainnet</button>';
    html += '</div></div>';

    html += '</div></section>';
    return html;
  }

  function buildCard(key) {
    var w = WALLET_REGISTRY[key];
    if (!w) return '';
    var detected = w.canConnect && !!w.detect();
    var isConnectable = w.canConnect;

    // Button: if detected → CONNECT (green), if connectable not detected → install label (outline), if not connectable → action label (muted)
    var btnText = detected ? 'Connect' : w.btnLabel;
    var btnStyle = detected
      ? 'padding:7px 10px;background:var(--accent);color:#000;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;width:100%;margin-top:8px'
      : isConnectable
        ? 'padding:7px 10px;background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;width:100%;margin-top:8px'
        : 'padding:7px 10px;background:rgba(73,234,203,0.07);color:var(--accent);border:1px solid rgba(73,234,203,0.2);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;width:100%;margin-top:8px';

    var logoOpacity = (detected || !isConnectable) ? '1' : '0.55';
    var borderColor = detected ? 'rgba(73,234,203,0.5)' : 'var(--border)';

    var html = '<div class="card wallet-card" data-wallet="' + key + '" data-detected="' + detected + '" ';
    html += 'style="border:1px solid ' + borderColor + ';padding:16px 12px;text-align:center;border-radius:10px;transition:border-color 0.2s">';

    // Logo
    html += '<div style="width:52px;height:52px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;opacity:' + logoOpacity + ';border-radius:10px;overflow:hidden">';
    html += getWalletLogo(key);
    html += '</div>';

    // Name
    html += '<h3 style="font-size:12px;font-weight:700;margin:0 0 2px;color:var(--text)">' + w.label + '</h3>';

    // Subtitle
    html += '<p style="font-size:10px;color:var(--text-muted);margin:0 0 2px;line-height:1.4">' + w.type + '</p>';

    // Detected badge
    if (detected) {
      html += '<div style="display:flex;align-items:center;gap:4px;justify-content:center;font-size:10px;color:#22c55e;margin-top:3px">';
      html += '<span style="width:5px;height:5px;background:#22c55e;border-radius:50%;display:inline-block"></span>Detected</div>';
    }

    // Status indicator (shown when connected)
    html += '<div class="wallet-status-indicator" style="display:none;align-items:center;gap:4px;justify-content:center;font-size:10px;color:var(--accent);margin-top:3px">';
    html += '<span style="width:5px;height:5px;background:var(--accent);border-radius:50%;display:inline-block"></span>Connected</div>';

    // Button
    html += '<button class="wallet-connect-btn" data-wallet="' + key + '" style="' + btnStyle + '">' + btnText + '</button>';

    html += '</div>';
    return html;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * PUBLIC API
   * ═══════════════════════════════════════════════════════════════════════════ */

  var _activeProvider = null;
  var _activeWalletType = null;

  function _onAccountsChanged(accounts) {
    if (accounts && accounts[0]) {
      window.connectedAddress = accounts[0];
      window.htpAddress = accounts[0];
      try { localStorage.setItem('htpPlayerId', accounts[0]); } catch(e) {}
      htpWalletV3.updateUI();
      window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: accounts[0] } }));
      htpWalletV3.refreshBalance();
    } else { htpWalletV3.disconnect(); }
  }

  function _onNetworkChanged(network) {
    console.log('[HTP Wallet V3] networkChanged ->', network);
    htpWalletV3.disconnect();
    if (window.showToast) window.showToast('Network changed — please reconnect.', 'info');
  }

  window.htpWalletV3 = {
  // v5.0 public aliases for router compatibility
  generateWallet: async function() {
    if (!window.kaspaSDK || !window.kaspaSDK.Mnemonic) {
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'WASM SDK not ready. Try again in 2 seconds.';
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
      return;
    }
    try {
      var mnemonic = window.kaspaSDK.Mnemonic.random();
      var words = mnemonic.phrase;
      // Show words in a modal before importing
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center';
      overlay.innerHTML = '<div style="background:var(--htp-card,#181818);border:1px solid var(--htp-border,#2a2a2a);border-radius:var(--htp-radius,8px);padding:24px;max-width:480px;text-align:center">' +
        '<h3 style="color:var(--htp-gold,#c9a84c);margin:0 0 8px">SAVE THESE WORDS</h3>' +
        '<p style="color:var(--htp-muted,#888);font-size:12px;margin:0 0 16px">Write these 12 words down. Never share them.</p>' +
        '<div style="background:var(--htp-dark,#111);border:1px solid var(--htp-border,#2a2a2a);border-radius:6px;padding:14px;font-family:monospace;font-size:14px;color:var(--htp-gold,#c9a84c);margin-bottom:16px;word-break:break-word">' + words + '</div>' +
        '<button id="htp-gen-confirm" class="htp-btn" style="margin-right:8px">I SAVED THEM — IMPORT</button>' +
        '<button id="htp-gen-cancel" class="htp-btn htp-btn-ghost">CANCEL</button></div>';
      document.body.appendChild(overlay);
      document.getElementById('htp-gen-confirm').onclick = function() {
        overlay.remove();
        // Fill textarea + import
        var ta = document.getElementById('mnemonic-input');
        if (ta) ta.value = words;
        if (typeof htpWalletV3.importMnemonic === 'function') htpWalletV3.importMnemonic();
      };
      document.getElementById('htp-gen-cancel').onclick = function() { overlay.remove(); };
    } catch(e) {
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'Failed to generate: ' + e.message;
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
    }
  },
  importMnemonic: function() {
    var panel = document.querySelector(".htp-mnemonic-panel");
    if (panel) { panel.style.display = panel.style.display === "none" ? "block" : "none"; return; }
    // Fallback: show wallet panel
    if (typeof htpWalletV3.showWalletPanel === "function") htpWalletV3.showWalletPanel();
  },
  disconnect: function() {
    localStorage.removeItem("htp_session");
    window.connectedAddress = null;
    window.htpAddress = null;
    window.dispatchEvent(new CustomEvent("htp:wallet:disconnected"));
  },
  showConnectModal: function() {
    if (typeof htpWalletV3.showWalletPanel === "function") htpWalletV3.showWalletPanel();
    else if (typeof htpWalletV3.connect === "function") htpWalletV3.connect();
  },

    async init() {
      console.log('[HTP Wallet V3] Initialized — 10 wallets registered');
      var session = await loadMnemonicSession();
      if (session) {
        window.connectedAddress = session.address;
        window.htpAddress = session.address;
        window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: session.address } }));
        htpWalletV3.refreshBalance();
        this.updateUI();
      }
      this.setupListeners();
    },

    setupListeners() {
      document.addEventListener('click', async (e) => {
        var btn = e.target.closest('.wallet-connect-btn');
        if (!btn) return;
        var key = btn.getAttribute('data-wallet');
        var w = WALLET_REGISTRY[key];
        if (!w) return;
        // Non-connectable wallets → open link
        if (!w.canConnect) { window.open(w.installUrl, '_blank'); return; }
        var provider = w.detect();
        if (!provider) { window.open(w.installUrl, '_blank'); return; }
        await this.connectWallet(key);
      });
    },

    async connectWallet(type) {
      try {
        var w = WALLET_REGISTRY[type];
        if (!w || !w.canConnect) return false;
        var provider = w.detect();
        if (!provider) return false;
        var address = await w.connect(provider);
        if (address) {
          _activeProvider = provider;
          _activeWalletType = type;
          if (typeof provider.on === 'function') {
            provider.on('accountsChanged', _onAccountsChanged);
            provider.on('networkChanged', _onNetworkChanged);
          }
          window.connectedAddress = address;
          window.htpAddress = address;
          try { localStorage.setItem('htpPlayerId', address); } catch(e) {}
          this.updateUI();
          window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: address, wallet: type } }));
          htpWalletV3.refreshBalance();
          console.log('[HTP Wallet V3] Connected:', type, address);
          return true;
        }
        return false;
      } catch(e) {
        console.error('[HTP Wallet V3] Connection error:', e);
        if (window.showToast) window.showToast('Wallet connection failed: ' + e.message, 'error');
        return false;
      }
    },

    toggleMnemonicPanel() {
      var panel = document.getElementById('mnemonic-import-panel');
      var arrow = document.getElementById('mnemonic-toggle-arrow');
      if (!panel) return;
      var open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      if (arrow) arrow.textContent = open ? '▼' : '▲';
    },

    async importMnemonic() {
      var input = document.getElementById('mnemonic-input');
      var status = document.getElementById('mnemonic-status');
      if (!input || !input.value.trim()) {
        if (status) { status.style.cssText = 'display:block;background:rgba(239,68,68,0.1);color:#ef4444;border-left:3px solid #ef4444;padding:10px;border-radius:6px;font-size:12px'; status.textContent = 'Enter a mnemonic phrase'; }
        return;
      }
      if (status) { status.style.cssText = 'display:block;background:rgba(73,234,203,0.07);color:var(--text);border-left:3px solid var(--accent);padding:10px;border-radius:6px;font-size:12px'; status.textContent = 'Deriving address…'; }
      var result = await importMnemonicWallet(input.value);
      if (result.ok) {
        window.connectedAddress = result.address;
        window.htpAddress = result.address;
        this.updateUI();
        if (status) { status.style.cssText = 'display:block;background:rgba(34,197,94,0.1);color:#22c55e;border-left:3px solid #22c55e;padding:10px;border-radius:6px;font-size:12px'; status.textContent = 'Imported! ' + formatAddress(result.address) + ' — ' + result.balance + ' KAS'; }
        if (input) input.value = '';
        setTimeout(() => this.toggleMnemonicPanel(), 1200);
        window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: result.address } }));
        htpWalletV3.refreshBalance();
      } else {
        if (status) { status.style.cssText = 'display:block;background:rgba(239,68,68,0.1);color:#ef4444;border-left:3px solid #ef4444;padding:10px;border-radius:6px;font-size:12px'; status.textContent = result.error; }
      }
    },

  importPrivkey: async function(hexKey) {
    if (!hexKey || hexKey.length !== 64) {
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'Private key must be 64 hex characters';
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000); return;
    }
    if (!window.kaspaSDK) {
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'WASM SDK not ready';
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000); return;
    }
    try {
      var pk = window.kaspaSDK.PrivateKey.fromHex(hexKey);
      var addr = window.kaspaSDK.Address.fromPublicKey(pk.publicKey(), 'kaspatest');
      window.connectedAddress = addr.toString();
      window.htpAddress = addr.toString();
      sessionStorage.setItem('htpSession', JSON.stringify({address: addr.toString()}));
      window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: addr.toString() } }));
      htpWalletV3.refreshBalance();
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'Imported: ' + addr.toString().slice(0,12) + '...';
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
    } catch(e) {
      var t = document.createElement('div'); t.className = 'htp-toast';
      t.textContent = 'Invalid key: ' + e.message;
      document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
    }
  },

    clearMnemonicInput() {
      var input = document.getElementById('mnemonic-input');
      var status = document.getElementById('mnemonic-status');
      if (input) input.value = '';
      if (status) status.style.display = 'none';
    },

    setManualAddress() {
      var input = document.getElementById('manual-address-input');
      var addr = input && input.value.trim();
      if (!addr) { if (window.showToast) window.showToast('Enter an address', 'error'); return; }
      window.connectedAddress = addr;
      window.htpAddress = addr;
      this.updateUI();
      window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: addr } }));
      htpWalletV3.refreshBalance();
    },

    disconnect() {
      if (_activeProvider && typeof _activeProvider.removeListener === 'function') {
        try { _activeProvider.removeListener('accountsChanged', _onAccountsChanged); _activeProvider.removeListener('networkChanged', _onNetworkChanged); } catch(e) {}
      }
      _activeProvider = null;
      _activeWalletType = null;
      window.connectedAddress = null;
      window.htpAddress = null;
      try { localStorage.removeItem('htpPlayerId'); } catch(e) {}
      clearMnemonicSession();
      this.updateUI();
      window.dispatchEvent(new CustomEvent('htp:wallet:disconnected'));
    },

    setNetwork(net) {
      if (net === 'mainnet') {
        window.HTP_NETWORK = 'mainnet';
        window.HTP_PREFIX = 'kaspa';
        window.HTP_RPC_URL = 'wss://wrpc.kaspa.org/mainnet';
        try { localStorage.setItem('htp_network', 'mainnet'); } catch(e) {}
        var mainBtn = document.getElementById('network-mainnet');
        var tnBtn = document.getElementById('network-tn12');
        if (mainBtn) mainBtn.classList.add('chip-a');
        if (tnBtn) tnBtn.classList.remove('chip-a');
        if (window.showToast) window.showToast('Switched to Mainnet. Real KAS will be used.', 'warn');
      } else {
        window.HTP_NETWORK = 'tn12';
        window.HTP_PREFIX = 'kaspatest';
        window.HTP_RPC_URL = 'wss://wrpc.kaspa.org/testnet-12';
        try { localStorage.setItem('htp_network', 'tn12'); } catch(e) {}
        var mainBtn2 = document.getElementById('network-mainnet');
        var tnBtn2 = document.getElementById('network-tn12');
        if (tnBtn2) tnBtn2.classList.add('chip-a');
        if (mainBtn2) mainBtn2.classList.remove('chip-a');
        if (window.showToast) window.showToast('Switched to TN12 Testnet', 'info');
      }
      window.dispatchEvent(new CustomEvent('htp:network:changed', { detail: { network: net } }));
      console.log('[HTP Wallet V3] Network set to:', net);
      return true;
    },

    updateUI() {
      var connectedDiv = document.getElementById('wallet-connected-status');
      if (!connectedDiv) return;
      if (window.connectedAddress) {
        connectedDiv.style.display = 'block';
        var addrEl = document.getElementById('connected-address');
        if (addrEl) addrEl.textContent = window.connectedAddress;
        var balEl = document.getElementById('connected-balance');
        if (balEl) balEl.textContent = (typeof window.htpBalance === 'number') ? window.htpBalance.toFixed(4) : '—';
        document.querySelectorAll('.wallet-card').forEach(function(card) {
          var isActive = _activeWalletType && card.getAttribute('data-wallet') === _activeWalletType;
          card.style.borderColor = isActive ? 'rgba(73,234,203,0.6)' : 'var(--border)';
          var ind = card.querySelector('.wallet-status-indicator');
          if (ind) ind.style.display = isActive ? 'flex' : 'none';
        });
      } else {
        connectedDiv.style.display = 'none';
        document.querySelectorAll('.wallet-card').forEach(function(card) {
          var w = WALLET_REGISTRY[card.getAttribute('data-wallet')];
          var det = w && w.canConnect && w.detect();
          card.style.borderColor = det ? 'rgba(73,234,203,0.5)' : 'var(--border)';
          var ind = card.querySelector('.wallet-status-indicator');
          if (ind) ind.style.display = 'none';
        });
      }
    },

    buildHTML: buildWalletSectionHTML
  };

  console.log('[HTP Wallet V3] Loaded — 10 wallets: ' + Object.keys(WALLET_REGISTRY).join(', '));

})(window);
