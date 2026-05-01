/**
 * htp-init.js  ,  High Table Protocol  ,  v3.0
 *
 * RESPONSIBILITIES:
 *  1. Detect TN12 vs mainnet → set window.HTP_NETWORK + window.activeNet  (ONE place, done first)
 *  2. WASM boot gate  ,  unlock all .wasm-gate elements + fire _onWasmReady() callbacks
 *  3. Identity / seat resolution
 *  4. Wallet auto-connect (KasWare → KaspaWallet → localStorage)
 *  5. Board CSS injection
 *
 * FULL TRUSTLESS MODEL:
 *  - Escrow keypair is generated client-side and NEVER leaves the browser.
 *  - Firebase is coordination-only (match state, oracle attestation).
 *  - Oracle signs the result; the winner's browser sends the settlement TX.
 *  - window.HTP_NETWORK / window.activeNet drives ALL on-chain calls.
 *    Switching TN12 ↔ mainnet is ONE place: the NETWORK_MAP below.
 */

(function (window) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
   * 1.  NETWORK DETECTION  (runs synchronously, before anything else)
   * ═══════════════════════════════════════════════════════════════════════════ */

  // Toccata TN12 resolver abstraction.
  // When Toccata mainnet activates (after audits/rehearsal), flip useResolver=true on toccata
  // and update resolverAlias / endpoints. UI feature flags (covenants, ZK) can probe HTP_TOCCATA_LIVE.
  var TOCCATA_LIVE = false; // mainnet covenants not yet live per kaspa.org/toccata-hard-fork-kaspa-covenants
  var NETWORK_MAP = {
    mainnet: {
      prefix:      'kaspa',
      networkId:   'mainnet',
      resolverAlias: 'mainnet',
      useResolver: true,
      explorerTx:  'https://explorer.kaspa.org/txs/',
      covenants:   TOCCATA_LIVE, // Silverscript / KIP-16/17/20/21 only when activated on mainnet
    },
    tn12: {
      prefix:      'kaspatest',
      networkId:   'testnet-12',
      resolverAlias: 'tn12',
      useResolver: true,
      // Public TN12 wRPC fallbacks when Resolver is unreachable
      directWrpc:  ['wss://tn12.kaspa.stream/wrpc/borsh','wss://tn12-1.kaspa.stream/wrpc/borsh'],
      explorerTx:  'https://tn12.kaspa.stream/txs/',
      covenants:   true, // Toccata feature freeze branch on TN12
    },
    // Forward-compat alias: post-Toccata mainnet. One-flag flip when the hard fork goes live.
    toccata: {
      prefix:      'kaspa',
      networkId:   'mainnet',
      resolverAlias: 'mainnet',
      useResolver: true,
      explorerTx:  'https://explorer.kaspa.org/txs/',
      covenants:   TOCCATA_LIVE,
    },
  };
  window.HTP_TOCCATA_LIVE = TOCCATA_LIVE;

  function detectNetwork() {
    // 1. Explicit override via URL param  ?net=mainnet  or  ?net=tn12
    var p = new URLSearchParams(window.location.search).get('net');
    if (p && NETWORK_MAP[p]) { window.HTP_NETWORK = p; window.activeNet = NETWORK_MAP[p]; return; }
    // 2. Stored preference
    try { p = localStorage.getItem('htpNetwork'); } catch(e) { p = null; }
    if (p && NETWORK_MAP[p]) { window.HTP_NETWORK = p; window.activeNet = NETWORK_MAP[p]; return; }
    // 3. Default: TN12 (testnet) until mainnet covenants go live
    window.HTP_NETWORK = 'tn12';
    window.activeNet   = NETWORK_MAP.tn12;
  }
  detectNetwork();

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2.  WASM BOOT GATE
   * ═══════════════════════════════════════════════════════════════════════════ */
  var _wasmCallbacks = [];
  window.wasmReady   = false;

  window._onWasmReady = function (fn) {
    if (typeof fn !== 'function') return;
    if (window.wasmReady) { try { fn(); } catch(e) { console.error('[HTP] _onWasmReady cb error', e); } return; }
    _wasmCallbacks.push(fn);
  };

  function _fireWasmReady() {
    if (window.wasmReady) return;
    window.wasmReady = true;
    document.querySelectorAll('.wasm-gate').forEach(function(el) { el.classList.remove('wasm-gate'); });
    _wasmCallbacks.forEach(function(fn) { try { fn(); } catch(e) { console.error('[HTP] wasm cb error', e); } });
    _wasmCallbacks = [];
    try { window.dispatchEvent(new Event('htpWasmReady')); } catch(e2) {}
  }

  // Kick off the WASM module.  Catches and ignores missing-file errors gracefully.
  window.whenWasmReady = function(fn) { window._onWasmReady(fn); };

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3.  IDENTITY / SEAT RESOLUTION
   * ═══════════════════════════════════════════════════════════════════════════ */

  function getMySeat(matchData, myAddr) {
    if (!matchData || !myAddr) return null;
    if (matchData.playerA === myAddr) return 'A';
    if (matchData.playerB === myAddr) return 'B';
    return null;
  }

  function getOrientation(seat) {
    // 'A' = white (bottom), 'B' = black (top) for chess-style boards
    return seat === 'B' ? 'black' : 'white';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4.  WALLET AUTO-CONNECT
   * ═══════════════════════════════════════════════════════════════════════════ */

  var _walletConnectListeners = [];

  function onWalletConnected(addr, pubkey) {
    window.connectedAddress = addr;
    window.htpAddress       = addr;
    window.htpPubkey        = pubkey || '';
    try { localStorage.setItem('htpAddress', addr); } catch(e) {}
    _walletConnectListeners.forEach(function(fn) { try { fn(addr, pubkey); } catch(e2) {} });
    try { window.dispatchEvent(new CustomEvent('htpWalletConnected', { detail: { address: addr, pubkey: pubkey } })); } catch(e3) {}
  }

  window.onWalletConnected = onWalletConnected;

  async function detectAndConnectWallet() {
    // 1. KasWare
    if (window.kasware) {
      try {
        var accs = await window.kasware.requestAccounts();
        if (accs && accs[0]) { onWalletConnected(accs[0]); return accs[0]; }
      } catch(e) { console.warn('[HTP] KasWare connect failed:', e.message || e); }
    }
    // 2. KaspaWallet (legacy)
    if (window.kaspaWallet) {
      try {
        var a2 = await window.kaspaWallet.connect();
        if (a2) { onWalletConnected(a2); return a2; }
      } catch(e2) { console.warn('[HTP] KaspaWallet connect failed:', e2.message || e2); }
    }
    // 3. Stored address
    try {
      var stored = localStorage.getItem('htpAddress');
      if (stored) { onWalletConnected(stored); return stored; }
    } catch(e3) {}
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5.  BOARD CSS INJECTION
   * ═══════════════════════════════════════════════════════════════════════════ */

  function injectBoardCss() {
    if (document.getElementById('htp-board-css')) return;
    var s = document.createElement('style');
    s.id = 'htp-board-css';
    s.textContent = [
      '.htp-board{display:grid;border:2px solid rgba(73,232,194,.25);border-radius:4px;overflow:hidden;}',
      '.htp-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:clamp(14px,2.5vw,26px);cursor:pointer;transition:background .12s;}',
      '.htp-cell.light{background:#2a3a2a;}',
      '.htp-cell.dark{background:#1a2a1a;}',
      '.htp-cell.selected{background:rgba(73,232,194,.35)!important;}',
      '.htp-cell.legal{background:rgba(73,232,194,.18)!important;}',
      '.htp-cell.last-move{background:rgba(73,232,194,.22)!important;}',
      '.htp-piece{pointer-events:none;line-height:1;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6.  BOARD INDEX HELPERS
   * ═══════════════════════════════════════════════════════════════════════════ */

  function getIndices(rank, file, orientation) {
    // rank 0-7 = rows 8-1 for white orientation
    if (orientation === 'black') return { row: rank, col: 7 - file };
    return { row: 7 - rank, col: file };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7.  DOMContentLoaded BOOTSTRAP
   * ═══════════════════════════════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', function() {
    injectBoardCss();
    // Non-blocking wallet detection (best-effort)
    setTimeout(function() { detectAndConnectWallet().catch(function() {}); }, 300);

    // WASM gate: listen for htpWasmReady event (fired by patch-games.js suppressWasm)
    window.addEventListener('htpWasmReady', function() { _fireWasmReady(); }, { once: true });
    // Fallback: declare WASM ready after 4s regardless
    setTimeout(function() { _fireWasmReady(); }, 4000);
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8.  PUBLIC API
   * ═══════════════════════════════════════════════════════════════════════════ */

  window.HTPInit = {
    getMySeat:         getMySeat,
    getOrientation:    getOrientation,
    injectBoardCss:    injectBoardCss,
    getIndices:        getIndices,
    detectNetwork:     detectNetwork,
    NETWORK_MAP:       NETWORK_MAP,
  };
  window.onWalletConnected        = onWalletConnected;
  window.htpInit                  = {
    onWalletConnected:      onWalletConnected,
    detectAndConnectWallet: detectAndConnectWallet,
    detectNetwork:          detectNetwork,
    whenWasmReady:          whenWasmReady,
  };

})(window);

/* =============================================================
 * HTP SERVER CONNECTION — auto-fetches Railway WS URL
 * Exposes: window.htpServerSend, window.htpJoinGameRoom, window.htpGameAction
 * ============================================================= */
(function() {
  'use strict';
  function initServerWs(wsUrl) {
    if (!wsUrl || window.__htpServerWs) return;
    window.HTP_SERVER_WS_URL = wsUrl;
    function connect() {
      try {
        var ws = new WebSocket(wsUrl);
        ws.onopen = function() {
          window.__htpServerWs = ws;
          window.dispatchEvent(new CustomEvent('htp:server:connected', { detail: { url: wsUrl } }));
          console.log('[HTP] Server WS connected:', wsUrl);
        };
        ws.onmessage = function(e) {
          try {
            var msg = JSON.parse(e.data);
            window.dispatchEvent(new CustomEvent('htp:server:message', { detail: msg }));
            if (msg.event === 'game-state-update' && msg.data) window.dispatchEvent(new CustomEvent('htp:game:state', { detail: msg.data }));
            if (msg.event === 'game-over' && msg.data) window.dispatchEvent(new CustomEvent('htp:game:over', { detail: msg.data }));
            if (msg.event === 'action-error' && msg.data) window.dispatchEvent(new CustomEvent('htp:game:error', { detail: msg.data }));
          } catch(err) {}
        };
        ws.onclose = function() {
          window.__htpServerWs = null;
          console.warn('[HTP] Server WS closed, retry in 5s');
          setTimeout(connect, 5000);
        };
        ws.onerror = function() { try { ws.close(); } catch(e2) {} };
      } catch(e) { console.warn('[HTP] WS error:', e.message); }
    }
    connect();
  }

  window.htpServerSend = function(msg) {
    var ws = window.__htpServerWs;
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
    return false;
  };
  window.htpJoinGameRoom = function(gameId) {
    return window.htpServerSend({ type: 'join-game', gameId: gameId });
  };
  window.htpGameAction = function(gameId, action, data, playerAddr) {
    return window.htpServerSend({
      type: 'game-action', gameId: gameId, action: action,
      data: data || {}, player: playerAddr || window.connectedAddress || window.htpAddress || ''
    });
  };

  function fetchConfig() {
    var base = (window.HTP_SERVER_URL || '').replace(/\/ws$/, '');
    fetch(base + '/api/config', { signal: AbortSignal.timeout(5000) })
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        if (cfg && cfg.wsUrl) {
          console.log('[HTP] Server config:', cfg);
          initServerWs(cfg.wsUrl);
        }
      })
      .catch(function() {
        var proto = location.protocol === 'https:' ? 'wss' : 'ws';
        var fallback = proto + '://' + location.host + '/ws';
        console.warn('[HTP] /api/config failed, trying fallback:', fallback);
        initServerWs(fallback);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fetchConfig);
  else fetchConfig();
})();
