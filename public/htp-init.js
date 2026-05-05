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
    window.HTP_NETWORK = 'mainnet';
    window.activeNet   = NETWORK_MAP.mainnet;
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
    var base = (typeof window !== 'undefined' && window.HTP_SERVER_URL) || 'https://178.105.76.81';
    fetch(base + '/api/config', { signal: AbortSignal.timeout(5000) })
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        if (cfg && cfg.wsUrl) {
          console.log('[HTP] Server config:', cfg);
          initServerWs(cfg.wsUrl);
        }
      })
      .catch(function() {
        initServerWs('wss://178.105.76.81/ws');
      });
  }  // close fetchConfig

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fetchConfig);
  else fetchConfig();
})();

/* =============================================================
 * HTP COSMETIC LAYER  cosmetic, non-destructive UI polish
 *  - DAA counter fallback (Task 4.1)
 *  - Network status indicator dot (Task 4.4)
 *  - Overlay dismissal: Escape key + backdrop click (Task 4.5)
 *
 * Pure additive. Does not change colors, fonts, layout, or theme.
 * ============================================================= */
(function() {
  'use strict';

  /* --- 4.1 DAA counter fallback --- */
  function initDaaFallback() {
    var el = document.getElementById('daaScore');
    if (!el) return;
    var txt = (el.textContent || '').trim();
    if (!txt || txt === '-' || txt === '0') {
      el.textContent = 'syncing...';
    }
    // Watch for the regular updaters; if they leave it empty, restore the fallback.
    try {
      var mo = new MutationObserver(function() {
        var v = (el.textContent || '').trim();
        if (!v) el.textContent = 'syncing...';
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    } catch (e) {}
  }

  /* --- 4.4 Network status indicator dot ---
   * The existing #nodeStatus span already contains a colored dot.
   * We listen for the REST/server connection events and tint the dot
   * green when live, red when reconnecting. We do NOT replace the existing
   * status text; we only update the dot color and append a small label
   * if one is not already present.
   */
  function setStatusDot(state) {
    var ns = document.getElementById('nodeStatus');
    if (!ns) return;
    var dot = ns.querySelector('span');
    if (!dot) return;
    var color = state === 'live' ? '#10b981' : (state === 'down' ? '#ef4444' : '#6b7280');
    dot.style.background = color;
    dot.style.borderColor = color;
    var lbl = ns.querySelector('.htp-net-label');
    if (!lbl) {
      lbl = document.createElement('span');
      lbl.className = 'htp-net-label';
      lbl.style.cssText = 'font-size:11px;margin-left:6px;color:var(--muted)';
      ns.appendChild(lbl);
    }
    lbl.textContent = state === 'live' ? 'Live' : (state === 'down' ? 'Reconnecting' : '');
  }
  function initNetStatus() {
    setStatusDot('idle');
    window.addEventListener('htp:server:connected', function() { setStatusDot('live'); });
    window.addEventListener('htp:server:disconnected', function() { setStatusDot('down'); });
    // Also probe the backend periodically. A successful /api/config = live.
    var base = (typeof window !== 'undefined' && window.HTP_SERVER_URL) || 'https://178.105.76.81';
    function probe() {
      try {
        fetch(base + '/api/config', { signal: AbortSignal.timeout(4000) })
          .then(function(r) { setStatusDot(r.ok ? 'live' : 'down'); })
          .catch(function() { setStatusDot('down'); });
      } catch (e) { setStatusDot('down'); }
    }
    probe();
    setInterval(probe, 15000);
  }

  /* --- 4.5 Overlay dismissal: Escape + backdrop click ---
   * Targets any element marked as a modal/overlay. We treat anything with
   * role="dialog", class containing "overlay" / "modal" / "chooser" /
   * "htp-modal", or a fixed-position full-screen layer with a single inner
   * card as a dismissable overlay.
   */
  function isOverlayLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && el.getAttribute('role') === 'dialog') return true;
    var c = (el.className || '').toString();
    if (/(overlay|modal|chooser|backdrop|htp-prompt)/i.test(c)) return true;
    return false;
  }
  function findVisibleOverlays() {
    var nodes = document.querySelectorAll('[role="dialog"], .overlay, .modal, .htp-modal, .htp-overlay, .wallet-chooser, .promotion-modal, .game-over-overlay, .waiting-room, .htp-backdrop');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var s = window.getComputedStyle(n);
      if (s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0.01) {
        out.push(n);
      }
    }
    return out;
  }
  function dismiss(node) {
    if (!node) return;
    // Prefer a known close hook if the page exposes one.
    var hook = node.getAttribute && node.getAttribute('data-close');
    if (hook && typeof window[hook] === 'function') { try { window[hook](); return; } catch (e) {} }
    // Click an in-card close button if present.
    var closeBtn = node.querySelector('.close, .htp-close, [data-close], [aria-label="Close"]');
    if (closeBtn) { try { closeBtn.click(); return; } catch (e) {} }
    // Fallback: hide the node.
    try {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    } catch (e) {}
  }
  function initOverlayDismissal() {
    document.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Escape' && ev.keyCode !== 27) return;
      var open = findVisibleOverlays();
      if (!open.length) return;
      // Topmost only.
      dismiss(open[open.length - 1]);
    });
    document.addEventListener('click', function(ev) {
      var t = ev.target;
      if (!t || !isOverlayLike(t)) return;
      // Only when the click was on the backdrop itself, not inside a card.
      if (t === ev.currentTarget || t === ev.target) {
        // Distinguish backdrop click from inner card by checking the click
        // happened directly on the overlay container (not bubbled from a child).
        var rect = t.getBoundingClientRect();
        var inner = t.querySelector('.card, .htp-card, .modal-card, .overlay-card, .panel');
        if (inner) {
          var ir = inner.getBoundingClientRect();
          if (ev.clientX >= ir.left && ev.clientX <= ir.right && ev.clientY >= ir.top && ev.clientY <= ir.bottom) return;
        }
        dismiss(t);
      }
    }, true);
  }

  function start() {
    initDaaFallback();
    initNetStatus();
    initOverlayDismissal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* --- DAA counter poller --- */
(function() {
  var daaEl = document.getElementById('daaScore');
  if (!daaEl) return;
  function refreshDaa() {
    var cached = window.htpDaaScore;
    if (cached !== undefined && cached !== null) {
      daaEl.textContent = Number(cached).toLocaleString();
    } else if (daaEl.textContent === '-' || daaEl.textContent === 'syncing...') {
      daaEl.textContent = 'syncing...';
    }
    setTimeout(refreshDaa, 3000);
  }
  refreshDaa();
})();

/* --- Overview stats from API --- */
(function() {
  function fetchStats() {
    fetch('/api/stats')
      .then(function(r) { return r.json(); })
      .then(function(s) {
        var pool = document.getElementById('statPool');
        var mkts = document.getElementById('statMarkets');
        var entr = document.getElementById('statEntrants');
        var mult = document.getElementById('statAvgMult');
        if (pool) pool.textContent = (s.totalVolumeSompi ? (Number(s.totalVolumeSompi)/1e8).toLocaleString() : '0');
        if (mkts) mkts.textContent = String(s.openMarkets || 0);
        if (entr) entr.textContent = String(s.totalUsers || 0);
        if (mult) mult.textContent = '--';
      })
      .catch(function() {});
    setTimeout(fetchStats, 15000);
  }
  if (document.getElementById('statPool')) fetchStats();
})();