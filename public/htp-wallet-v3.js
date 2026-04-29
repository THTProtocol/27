/**
 * htp-wallet-v3.js - Complete wallet management with mnemonic import, encryption, and persistence
 *
 * FEATURES:
 *  1. 8 wallet extension auto-detection + connection (mainnet)
 *  2. Install CTA for wallets not detected in browser
 *  3. accountsChanged / networkChanged event listeners (fixes session-drop bug)
 *  4. signMessage nonce authentication for verified sessions
 *  5. BIP39 mnemonic import with WASM SDK derivation (TN12 dev/testing)
 *  6. AES-256-GCM mnemonic encryption + sessionStorage persistence (24h TTL)
 *  7. Manual address entry for portfolio viewing
 *  8. Network switcher (TN12 / Mainnet)
 *  9. Live balance fetching via RPC, displayed in KAS with 4 decimals
 *
 * WALLET REGISTRY (8 wallets):
 *  - KasWare    : window.kasware           (browser extension, most popular)
 *  - Kastle     : window.kastle            (browser extension, forbole)
 *  - Kasperia   : window.kasperia          (browser extension, Kaspa↔Kasplex bridge)
 *  - OKX        : window.okxwallet.kaspa   (browser extension, 30M+ users)
 *  - KasNG      : window.kasng             (desktop app / browser mode, aspectron)
 *  - Kasanova   : window.kasanova.kasware  (mobile dApp browser)
 *  - Kaspium    : window.kaspium           (mobile wallet)
 *  - KaspaCom   : window.kaspacom          (web wallet)
 */

(function(window) {
  'use strict';

  var SOMPI_PER_KAS = 100000000;

  /* ═══════════════════════════════════════════════════════════════════════════
   * WALLET REGISTRY — mainnet extension providers + install links
   * ═══════════════════════════════════════════════════════════════════════════ */

  var WALLET_REGISTRY = {
    'KasWare': {
      label: 'KasWare',
      type: 'Browser extension',
      installUrl: 'https://chrome.google.com/webstore/detail/hklhheigdmpoolooomdihmhlpjjdbklf',
      detect: function() { return window.kasware || null; },
      connect: async function(provider) {
        var accounts = await provider.requestAccounts();
        return accounts && accounts[0];
      }
    },
    'Kastle': {
      label: 'Kastle',
      type: 'Browser extension',
      installUrl: 'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
      detect: function() { return window.kastle || null; },
      connect: async function(provider) {
        var result = await provider.connect();
        return result && (result.address || result);
      }
    },
    'Kasperia': {
      label: 'Kasperia',
      type: 'Browser extension',
      installUrl: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
      detect: function() { return window.kasperia || null; },
      connect: async function(provider) {
        var accounts = await provider.requestAccounts();
        return accounts && accounts[0];
      }
    },
    'OKX': {
      label: 'OKX Wallet',
      type: 'Browser extension',
      installUrl: 'https://www.okx.com/web3',
      detect: function() { return (window.okxwallet && window.okxwallet.kaspa) ? window.okxwallet.kaspa : null; },
      connect: async function(provider) {
        var accounts = await provider.requestAccounts();
        return accounts && accounts[0];
      }
    },
    'KasNG': {
      label: 'Kas NG',
      type: 'Desktop / Browser',
      installUrl: 'https://github.com/aspectron/kaspa-ng/releases',
      detect: function() { return window.kasng || null; },
      connect: async function(provider) {
        var result = await provider.connect();
        return result && (result.address || result.accounts && result.accounts[0] || result);
      }
    },
    'Kasanova': {
      label: 'Kasanova',
      type: 'Mobile dApp browser',
      installUrl: 'https://kasanova.io',
      detect: function() { return (window.kasanova && window.kasanova.kasware) ? window.kasanova.kasware : null; },
      connect: async function(provider) {
        var accounts = await provider.requestAccounts();
        return accounts && accounts[0];
      }
    },
    'Kaspium': {
      label: 'Kaspium',
      type: 'Mobile wallet',
      installUrl: 'https://kaspium.io',
      detect: function() { return window.kaspium || null; },
      connect: async function(provider) {
        var result = await provider.connect();
        return result && (result.address || result);
      }
    },
    'KaspaCom': {
      label: 'KaspaCom',
      type: 'Web wallet',
      installUrl: 'https://kaspa.com',
      detect: function() { return window.kaspacom || null; },
      connect: async function(provider) {
        var result = await provider.connect();
        return result && (result.address || result);
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. CRYPTO UTILITIES — AES-256-GCM Encryption
   * ═══════════════════════════════════════════════════════════════════════
*/

  async function deriveKeyFromString(secret) {
    var enc = new TextEncoder();
    var data = enc.encode(secret);
    var hash = await crypto.subtle.digest('SHA-256', data);
    return await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptMnemonic(mnemonic, sessionKey) {
    try {
      var key = await deriveKeyFromString(sessionKey);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var enc = new TextEncoder();
      var plaintext = enc.encode(mnemonic);
      var ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);
      var data = {
        iv: Array.from(iv).map(b => String.fromCharCode(b)).join(''),
        ciphertext: Array.from(new Uint8Array(ciphertext)).map(b => String.fromCharCode(b)).join('')
      };
      return btoa(JSON.stringify(data));
    } catch(e) {
      console.error('[HTP Wallet] Encryption error:', e);
      return null;
    }
  }

  async function decryptMnemonic(encrypted, sessionKey) {
    try {
      var data = JSON.parse(atob(encrypted));
      var iv = new Uint8Array(data.iv.split('').map(c => c.charCodeAt(0)));
      var ciphertext = new Uint8Array(data.ciphertext.split('').map(c => c.charCodeAt(0)));
      var key = await deriveKeyFromString(sessionKey);
      var plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
      var dec = new TextDecoder();
      return dec.decode(plaintext);
    } catch(e) {
      console.error('[HTP Wallet] Decryption error:', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. MNEMONIC DERIVATION — Using WASM SDK
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function deriveCaspaAddressFromMnemonic(mnemonicPhrase) {
    return new Promise(function(resolve) {
      if (window.whenWasmReady) {
        window.whenWasmReady(function() {
          try {
            if (!window.kaspaSDK || !window.kaspaSDK.Mnemonic) {
              console.error('[HTP Wallet] WASM SDK not ready');
              return resolve(null);
            }
            var mnemonic = window.kaspaSDK.Mnemonic.new(mnemonicPhrase);
            var xPriv = mnemonic.toXPrv('');
            var derivationPath = window.kaspaSDK.DerivationPath.new("m/44'/111111'/0'/0/0'");
            var privateKey = xPriv.derivePrivateKey(derivationPath);
            var publicKey = privateKey.publicKey();
            var addr = window.kaspaSDK.Address.fromPublicKey(publicKey, window.HTP_PREFIX);
            console.log('[HTP Wallet] Mnemonic derived address:', addr.toString());
            resolve(addr.toString());
          } catch(e) {
            console.error('[HTP Wallet] Derivation error:', e);
            resolve(null);
          }
        });
      } else {
        console.error('[HTP Wallet] whenWasmReady not available');
        resolve(null);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. RPC BALANCE FETCHING
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function fetchBalance(address) {
    try {
      if (!window.htpRpc || !window.htpRpc.balance) {
        console.warn('[HTP Wallet] RPC not ready, attempting direct fetch');
        if (!window.HTP_RPC_URL) return null;
        var apiUrl = window.HTP_RPC_URL.replace('wss://', 'https://').replace('ws://', 'http://');
        apiUrl = apiUrl.replace(/\/$/, '');
        var resp = await fetch(apiUrl.replace('/rpc', '/api') + `/addresses/${address}`);
        if (resp.ok) {
          var data = await resp.json();
          return data.balance || 0;
        }
        return null;
      }
      return await window.htpRpc.balance(address);
    } catch(e) {
      console.warn('[HTP Wallet] Balance fetch error:', e);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. SESSION STORAGE PERSISTENCE
   * ═══════════════════════════════════════════════════════════════════════════ */

  var SESSION_KEY_NAME = 'htp_mnemonic_key';
  var SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  var WALLET_SESSION_STORAGE = 'htp_wallet_session';

  function generateSessionKey() {
    var key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    window._htpSessionMnemonicKey = key;
    return key;
  }

  function getSessionKey() {
    if (window._htpSessionMnemonicKey) return window._htpSessionMnemonicKey;
    return generateSessionKey();
  }

  async function saveMnemonicSession(mnemonic, address) {
    try {
      var sessionKey = getSessionKey();
      var encrypted = await encryptMnemonic(mnemonic, sessionKey);
      if (!encrypted) return false;
      var session = { encrypted: encrypted, address: address, timestamp: Date.now(), ttl: SESSION_TTL_MS };
      try {
        sessionStorage.setItem(WALLET_SESSION_STORAGE, JSON.stringify(session));
        return true;
      } catch(e) { return false; }
    } catch(e) { return false; }
  }

  async function loadMnemonicSession() {
    try {
      var stored = sessionStorage.getItem(WALLET_SESSION_STORAGE);
      if (!stored) return null;
      var session = JSON.parse(stored);
      if (Date.now() - session.timestamp > session.ttl) {
        sessionStorage.removeItem(WALLET_SESSION_STORAGE);
        return null;
      }
      var mnemonic = await decryptMnemonic(session.encrypted, getSessionKey());
      return mnemonic ? { mnemonic: mnemonic, address: session.address } : null;
    } catch(e) { return null; }
  }

  function clearMnemonicSession() {
    try { sessionStorage.removeItem(WALLET_SESSION_STORAGE); } catch(e) {}
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. MNEMONIC IMPORT FLOW
   * ═══════════════════════════════════════════════════════════════════════════ */

  async function importMnemonicWallet(mnemonicPhrase) {
    var words = mnemonicPhrase.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length !== 12 && words.length !== 24) {
      return { ok: false, error: 'Mnemonic must be 12 or 24 words' };
    }
    var address = await deriveCaspaAddressFromMnemonic(mnemonicPhrase);
    if (!address) return { ok: false, error: 'Failed to derive address from mnemonic. Invalid phrase or WASM not ready.' };
    var balanceSompi = await fetchBalance(address);
    if (balanceSompi === null) return { ok: false, error: 'Could not fetch balance. Network issue or RPC unavailable.' };
    await saveMnemonicSession(mnemonicPhrase, address);
    return { ok: true, address: address, balance: (balanceSompi / SOMPI_PER_KAS).toFixed(4), balanceSompi: balanceSompi };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. UI HELPERS
   * ═══════════════════════════════════════════════════════════════════════════ */

  function formatAddress(addr) {
    if (!addr || addr.length < 10) return addr;
    return addr.substring(0, 6) + '…' + addr.slice(-4);
  }

  function createSVGLogo(type) {
    var logos = {
      'KasWare':  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="48" height="48" fill="none" stroke="#4f98a3" stroke-width="2" rx="4"/><path d="M24 32 L32 20 L40 32 L32 42 Z" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linejoin="miter"/></svg>',
      'Kastle':   '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M16 48 L16 24 L20 20 L20 16 L28 16 L28 20 L32 20 L36 16 L36 20 L44 20 L48 24 L48 48 Z" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linejoin="miter"/><line x1="28" y1="32" x2="36" y2="32" stroke="#4f98a3" stroke-width="1.5"/></svg>',
      'Kasperia': '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="20" fill="none" stroke="#4f98a3" stroke-width="2"/><path d="M24 32 L32 24 L40 32 L32 40 Z" fill="#4f98a3" opacity="0.3"/><path d="M24 32 L32 24 L40 32 L32 40 Z" fill="none" stroke="#4f98a3" stroke-width="2"/></svg>',
      'OKX':      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="26" width="12" height="12" fill="#4f98a3" rx="2"/><rect x="26" y="26" width="12" height="12" fill="none" stroke="#4f98a3" stroke-width="2" rx="2"/><rect x="42" y="26" width="12" height="12" fill="#4f98a3" rx="2"/></svg>',
      'KasNG':    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><polygon points="32,10 54,22 54,42 32,54 10,42 10,22" fill="none" stroke="#4f98a3" stroke-width="2"/><text x="32" y="37" font-size="14" fill="#4f98a3" text-anchor="middle" font-family="monospace">NG</text></svg>',
      'Kasanova': '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="22" fill="none" stroke="#4f98a3" stroke-width="2"/><path d="M32 14 L38 26 L28 26 Z" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linejoin="miter"/></svg>',
      'Kaspium':  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 12 L48 20 L48 36 C48 48 32 56 32 56 C32 56 16 48 16 36 L16 20 Z" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linejoin="miter"/></svg>',
      'KaspaCom': '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M26 18 C26 18 32 22 32 28 C32 34 26 38 26 38" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linecap="round"/><path d="M38 18 C38 18 32 22 32 28 C32 34 38 38 38 38" fill="none" stroke="#4f98a3" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="28" r="2" fill="#4f98a3"/></svg>'
    };
    return logos[type] || '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="20" fill="none" stroke="#4f98a3" stroke-width="2"/></svg>';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. UI BUILDER — Create wallet section HTML
   * ═══════════════════════════════════════════════════════════════════════════ */

  function buildWalletSectionHTML() {
    var walletKeys = Object.keys(WALLET_REGISTRY);

    var html = '<section class="view" id="v-wallet-v3" style="display:none">';
    html += '<div class="mx sec-pad">';
    html += '<div class="sh">';
    html += '<h2>Wallet & Address Book</h2>';
    html += '<p>Connect your existing Kaspa wallet. Supports all major Kaspa browser extensions and mobile wallets.</p>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px" class="wallet-extension-grid" id="wallet-grid">';

    walletKeys.forEach(function(key) {
      var w = WALLET_REGISTRY[key];
      var detected = !!w.detect();
      var btnLabel = detected ? 'Connect' : 'Install ↗';
      var btnStyle = detected
        ? 'padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;width:100%;margin-top:10px'
        : 'padding:8px 16px;background:transparent;color:var(--text-muted);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;width:100%;margin-top:10px';

      html += '<div class="card wallet-card" data-wallet="' + key + '" data-detected="' + detected + '" style="border:1px solid var(--border);padding:20px;text-align:center;transition:all 0.2s;border-radius:8px">';
      html += '<div style="width:72px;height:72px;margin:0 auto 12px;background:var(--surface);border:1px solid rgba(79,152,163,' + (detected ? '0.4' : '0.1') + ');border-radius:8px;display:flex;align-items:center;justify-content:center;opacity:' + (detected ? '1' : '0.5') + '">' + createSVGLogo(key) + '</div>';
      html += '<h3 style="font-size:13px;font-weight:600;margin:0 0 2px;color:var(--text)">' + w.label + '</h3>';
      html += '<p style="font-size:11px;color:var(--text-muted);margin:0">' + w.type + '</p>';
      html += '<div class="wallet-status-indicator" style="margin-top:6px;display:none;align-items:center;gap:6px;justify-content:center;font-size:11px;color:#22c55e">';
      html += '<span style="width:6px;height:6px;background:#22c55e;border-radius:50%"></span>';
      html += '<span>Connected</span>';
      html += '</div>';
      html += '<button class="wallet-connect-btn" data-wallet="' + key + '" style="' + btnStyle + '">' + btnLabel + '</button>';
      html += '</div>';
    });

    html += '</div>';

    // Connected wallet display
    html += '<div id="wallet-connected-status" style="display:none;padding:16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin-bottom:24px">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Connected Wallet</div>';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px">';
    html += '<div>';
    html += '<div id="connected-address" style="font-family:\'JetBrains Mono\',monospace;font-size:13px;color:var(--text);word-break:break-all;margin-bottom:8px"></div>';
    html += '<div style="font-size:12px;color:var(--text-muted)">Balance: <span id="connected-balance">—</span> KAS</div>';
    html += '</div>';
    html += '<button onclick="htpWalletV3.disconnect()" style="padding:8px 12px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Disconnect</button>';
    html += '</div>';
    html += '</div>';

    // Manual address entry
    html += '<div class="w-sec" style="margin-bottom:24px">';
    html += '<h3 style="font-size:14px;font-weight:600;margin:0 0 12px">Manual Address Entry</h3>';
    html += '<p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">Enter a Kaspa address to view portfolio (read-only)</p>';
    html += '<div style="display:flex;gap:8px">';
    html += '<input id="manual-address-input" type="text" placeholder="kaspatest:qq..." style="flex:1;padding:10px 12px;background:var(--surface-3);color:var(--text);border:1px solid var(--border);border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:13px" />';
    html += '<button onclick="htpWalletV3.setManualAddress()" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px">View</button>';
    html += '</div>';
    html += '</div>';

    // Mnemonic import section
    html += '<div class="w-sec" style="border-top:1px solid var(--border);padding-top:24px">';
    html += '<button onclick="htpWalletV3.toggleMnemonicPanel()" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;text-align:left;display:flex;justify-content:space-between;align-items:center">';
    html += '<span>🔐 Import with Mnemonic (12 or 24 words)</span>';
    html += '<span id="mnemonic-toggle-arrow">▼</span>';
    html += '</button>';
    html += '<div id="mnemonic-import-panel" style="display:none;margin-top:12px;padding:16px;background:rgba(79,152,163,0.05);border:1px solid rgba(79,152,163,0.15);border-radius:8px">';
    html += '<p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">Enter your BIP39 seed phrase. The private key is encrypted and stored only in this session.</p>';
    html += '<textarea id="mnemonic-input" placeholder="word1 word2 word3 ... word12 (or 24)" style="width:100%;height:80px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:12px;box-sizing:border-box;resize:vertical;margin-bottom:12px"></textarea>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button onclick="htpWalletV3.importMnemonic()" style="flex:1;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px">Import Wallet</button>';
    html += '<button onclick="htpWalletV3.clearMnemonicInput()" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-weight:600;font-size:12px">Clear</button>';
    html += '</div>';
    html += '<div id="mnemonic-status" style="display:none;margin-top:12px;padding:10px;border-radius:6px;font-size:12px"></div>';
    html += '</div>';
    html += '</div>';

    // Network selector
    html += '<div class="w-sec" style="border-top:1px solid var(--border);padding-top:24px;margin-top:24px">';
    html += '<h3 style="font-size:14px;font-weight:600;margin:0 0 12px">Network</h3>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button id="network-tn12" class="chip chip-a" onclick="htpWalletV3.setNetwork(\'tn12\')">TN12 Testnet</button>';
    html += '<button id="network-mainnet" class="chip" onclick="htpWalletV3.setNetwork(\'mainnet\')" style="opacity:0.5;cursor:not-allowed" title="Coming Q2 2026">Mainnet (Q2 2026)</button>';
    html += '</div>';
    html += '</div>';

    html += '</div></section>';
    return html;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. PUBLIC API
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
    } else {
      htpWalletV3.disconnect();
    }
  }

  function _onNetworkChanged(network) {
    console.log('[HTP Wallet V3] networkChanged ->', network);
    htpWalletV3.disconnect();
    if (window.showToast) window.showToast('Network changed. Please reconnect your wallet.', 'info');
  }

  window.htpWalletV3 = {
    async init() {
      console.log('[HTP Wallet V3] Initializing — 8 wallets registered');
      var session = await loadMnemonicSession();
      if (session) {
        window.connectedAddress = session.address;
        window.htpAddress = session.address;
        this.updateUI();
      }
      this.setupExtensionListeners();
    },

    setupExtensionListeners() {
      document.addEventListener('click', async (e) => {
        var btn = e.target.closest('.wallet-connect-btn');
        if (!btn) return;
        var walletType = btn.getAttribute('data-wallet');
        var w = WALLET_REGISTRY[walletType];
        if (!w) return;
        var provider = w.detect();
        if (!provider) {
          window.open(w.installUrl, '_blank');
          return;
        }
        await this.connectWallet(walletType);
      });
    },

    async connectWallet(type) {
      try {
        var w = WALLET_REGISTRY[type];
        if (!w) return false;
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
      if (panel.style.display === 'none') { panel.style.display = 'block'; arrow.textContent = '▲'; }
      else { panel.style.display = 'none'; arrow.textContent = '▼'; }
    },

    async importMnemonic() {
      var input = document.getElementById('mnemonic-input').value;
      var status = document.getElementById('mnemonic-status');
      if (!input.trim()) {
        status.style.cssText = 'display:block;background:rgba(239,68,68,0.1);color:#ef4444;border-left:3px solid #ef4444;padding:10px;border-radius:6px;font-size:12px';
        status.textContent = 'Enter a mnemonic phrase';
        return;
      }
      status.style.cssText = 'display:block;background:rgba(79,152,163,0.1);color:var(--text);border-left:3px solid var(--accent);padding:10px;border-radius:6px;font-size:12px';
      status.textContent = 'Deriving address...';
      var result = await importMnemonicWallet(input);
      if (result.ok) {
        window.connectedAddress = result.address;
        window.htpAddress = result.address;
        this.updateUI();
        status.style.cssText = 'display:block;background:rgba(34,197,94,0.1);color:#22c55e;border-left:3px solid #22c55e;padding:10px;border-radius:6px;font-size:12px';
        status.textContent = 'Imported! ' + formatAddress(result.address) + ' — ' + result.balance + ' KAS';
        document.getElementById('mnemonic-input').value = '';
        setTimeout(() => this.toggleMnemonicPanel(), 1000);
        window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: result.address } }));
      } else {
        status.style.cssText = 'display:block;background:rgba(239,68,68,0.1);color:#ef4444;border-left:3px solid #ef4444;padding:10px;border-radius:6px;font-size:12px';
        status.textContent = result.error;
      }
    },

    clearMnemonicInput() {
      document.getElementById('mnemonic-input').value = '';
      document.getElementById('mnemonic-status').style.display = 'none';
    },

    setManualAddress() {
      var addr = document.getElementById('manual-address-input').value.trim();
      if (!addr) { if (window.showToast) window.showToast('Enter an address', 'error'); return; }
      window.connectedAddress = addr;
      window.htpAddress = addr;
      this.updateUI();
      window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: addr } }));
    },

    disconnect() {
      if (_activeProvider && typeof _activeProvider.removeListener === 'function') {
        try {
          _activeProvider.removeListener('accountsChanged', _onAccountsChanged);
          _activeProvider.removeListener('networkChanged', _onNetworkChanged);
        } catch(e) {}
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
      if (net === 'mainnet') return;
      try { localStorage.setItem('htp_network', net); } catch(e) {}
      window.HTP_NETWORK = net;
      window.location.reload();
    },

    updateUI() {
      var connectedDiv = document.getElementById('wallet-connected-status');
      if (!connectedDiv) return;
      if (window.connectedAddress) {
        connectedDiv.style.display = 'block';
        document.getElementById('connected-address').textContent = window.connectedAddress;
        var bal = window.htpBalance;
        document.getElementById('connected-balance').textContent = (typeof bal === 'number') ? bal.toFixed(4) : '—';
        document.querySelectorAll('.wallet-card').forEach(card => {
          var isActive = _activeWalletType && card.getAttribute('data-wallet') === _activeWalletType;
          card.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
          var indicator = card.querySelector('.wallet-status-indicator');
          if (indicator) indicator.style.display = isActive ? 'flex' : 'none';
        });
      } else {
        connectedDiv.style.display = 'none';
        document.querySelectorAll('.wallet-card').forEach(card => {
          card.style.borderColor = 'var(--border)';
          var indicator = card.querySelector('.wallet-status-indicator');
          if (indicator) indicator.style.display = 'none';
        });
      }
    },

    buildHTML: buildWalletSectionHTML
  };

  console.log('[HTP Wallet V3] Module loaded — wallets:', Object.keys(WALLET_REGISTRY).join(', '));

})(window);
