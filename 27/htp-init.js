/**
 * htp-init.js  —  High Table Protocol  —  v3.0
 *
 * RESPONSIBILITIES:
 *  1. Detect TN12 vs mainnet → set window.HTP_NETWORK + window.activeNet  (ONE place, done first)
 *  2. WASM boot gate  —  unlock all .wasm-gate elements + fire _onWasmReady() callbacks
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

  var NETWORK_MAP = {
    mainnet: {
      prefix:      'kaspa',
      networkId:   'mainnet',
      rpcEndpoint: 'wss://rpc.kaspa.org',
      explorerTx:  'https://explorer.kaspa.org/txs/',
    },
    tn12: {
      prefix:      'kaspatest',
      networkId:   'testnet-12',
      rpcEndpoint: 'wss://rpc-tn12.kaspa.org',
      explorerTx:  'https://explorer-tn12.kaspa.org/txs/',
    },
  };

  function detectNetwork() {
    // Priority order: URL param → localStorage override → default (tn12 for now)
    var param = (new URLSearchParams(window.location.search)).get('net');
    var stored = null;
    try { stored = localStorage.getItem('htp_network'); } catch (e) {}
    var key = (param || stored || 'tn12').toLowerCase();
    if (!NETWORK_MAP[key]) key = 'tn12';
    var net = NETWORK_MAP[key];
    // Expose globally — every other module reads these
    window.HTP_NETWORK    = key;                  // 'tn12' | 'mainnet'
    window.activeNet      = net;                  // full config object
    window.HTP_RPC_URL    = net.rpcEndpoint;
    window.HTP_PREFIX     = net.prefix;
    window.HTP_NETWORK_ID = net.networkId;
    window.HTP_EXPLORER   = net.explorerTx;
    try { localStorage.setItem('htp_network', key); } catch (e) {}
    console.log('[HTP Init] Network:', key, '|', net.rpcEndpoint);
    return net;
  }

  // Run immediately — synchronous
  detectNetwork();

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2.  WASM BOOT GATE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * The inline init in index.html (or external loader) calls
   * window._onWasmReady() once the WASM module is initialised.
   *
   * Pattern:
   *   - Before WASM ready: all .wasm-gate elements are disabled + dimmed.
   *   - After: they are enabled, opacity restored, and any queued callbacks fire.
   */

  var _wasmReadyCallbacks = [];
  var _wasmReadyFired     = false;

  function _unlockGates() {
    document.querySelectorAll('.wasm-gate').forEach(function (el) {
      el.disabled      = false;
      el.style.opacity = '1';
      el.title         = '';
    });
  }

  function _onWasmReady() {
    if (_wasmReadyFired) return;
    _wasmReadyFired      = true;
    window.wasmReady     = true;
    window.kaspaWasmReady = function () { return true; };
    _unlockGates();
    console.log('[HTP Init] WASM ready — gates unlocked');
    _wasmReadyCallbacks.forEach(function (cb) {
      try { cb(); } catch (e) { console.warn('[HTP Init] wasmReady callback error', e); }
    });
    _wasmReadyCallbacks = [];
    window.dispatchEvent(new CustomEvent('htp:wasm:ready'));
  }

  function whenWasmReady(cb) {
    if (_wasmReadyFired) { try { cb(); } catch (e) {} }
    else { _wasmReadyCallbacks.push(cb); }
  }

  // Expose so external loader (inline <script> in index.html) can call it
  window._onWasmReady  = _onWasmReady;
  window.whenWasmReady = whenWasmReady;

  // Safety timeout: if WASM never loads in 12 s, show error, keep UI functional
  setTimeout(function () {
    if (!_wasmReadyFired) {
      console.error('[HTP Init] WASM load timeout — Kaspa SDK unavailable');
      document.querySelectorAll('.wasm-gate').forEach(function (el) {
        el.title = 'Kaspa SDK failed to load — please refresh';
      });
      window.dispatchEvent(new CustomEvent('htp:wasm:timeout'));
    }
  }, 12000);

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3.  IDENTITY & SEAT
   * ═══════════════════════════════════════════════════════════════════════════ */

  function getViewerId() {
    try {
      if (window.connectedAddress) return window.connectedAddress;
      if (window.htpAddress)       return window.htpAddress;
      return localStorage.getItem('htpPlayerId');
    } catch (e) { return null; }
  }

  function initIdentity() {
    var vid = getViewerId();
    if (!vid) {
      var newId = 'P-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      try { localStorage.setItem('htpPlayerId', newId); } catch (e) {}
      console.log('[HTP Init] New anonymous identity:', newId);
    } else {
      console.log('[HTP Init] Identity:', vid.substring(0, 16) + (vid.length > 16 ? '…' : ''));
    }
  }

  function getMySeat(match) {
    var viewerId = getViewerId();
    if (!viewerId) return { seat: 'spectator', viewerId: null };
    var cId   = match.creatorId   || match.creator || match.p1 || (match.info && match.info.creatorId);
    var jId   = match.joinerId    || match.opponent || match.p2 || (match.info && match.info.joinerId);
    var cAddr = match.creatorAddrFull  || match.creatorAddr;
    var jAddr = match.opponentAddrFull || match.opponentAddr;
    var isP1  = (viewerId === cId  || (cAddr && viewerId === cAddr));
    var isP2  = (viewerId === jId  || (jAddr && viewerId === jAddr));
    if (isP1) return { seat: 'player1', viewerId: viewerId };
    if (isP2) return { seat: 'player2', viewerId: viewerId };
    if (match.seats) {
      if (viewerId === match.seats.player1Id || viewerId === match.seats.creatorId) return { seat: 'player1', viewerId: viewerId };
      if (viewerId === match.seats.player2Id || viewerId === match.seats.joinerId)  return { seat: 'player2', viewerId: viewerId };
    }
    return { seat: 'spectator', viewerId: viewerId };
  }

  function getOrientation(match, gameTypeOverride) {
    var ref  = getMySeat(match);
    var seat = ref.seat;
    var g    = (gameTypeOverride || match.gameType || match.game || '').toLowerCase();
    if (seat === 'spectator') return { playerColor: 'w', playerSide: 1, isFlipped: false, seat: 'spectator' };
    return {
      playerColor: seat === 'player2' ? 'b' : 'w',
      playerSide:  seat === 'player2' ? (g === 'checkers' || g === 'ck' ? 3 : 2) : 1,
      isFlipped:   seat === 'player2',
      seat:        seat,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4.  WALLET
   * ═══════════════════════════════════════════════════════════════════════════ */

  function onWalletConnected(address) {
    if (!address) return;
    window.connectedAddress = address;
    window.htpAddress       = address;
    window.walletAddress    = address;
    try { localStorage.setItem('htpPlayerId', address); } catch (e) {}

    // Notify RPC client to start UTXO tracking
    window.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: address } }));

    // Update connect button
    var btn = document.getElementById('htp-connect-wallet-btn')
           || document.getElementById('connectWalletBtn');
    if (btn) {
      btn.textContent = address.substring(0, 10) + '…' + address.slice(-4);
      btn.classList.add('connected');
      btn.disabled = false;
    }
    var statusEl = document.getElementById('htp-wallet-status');
    if (statusEl) statusEl.textContent = address.substring(0, 12) + '…';

    console.log('[HTP Init] Wallet connected:', address, '| Net:', window.HTP_NETWORK);
  }

  async function detectAndConnectWallet() {
    // 1. KasWare browser extension
    if (window.kasware) {
      try {
        var accounts = await window.kasware.requestAccounts();
        if (accounts && accounts[0]) { onWalletConnected(accounts[0]); return; }
      } catch (e) {}
    }
    // 2. KaspaWallet extension
    if (window.kaspaWallet) {
      try {
        var addr = await window.kaspaWallet.connect();
        if (addr) { onWalletConnected(addr); return; }
      } catch (e) {}
    }
    // 3. Persisted address from previous session
    try {
      var saved = localStorage.getItem('htpPlayerId');
      if (saved && (saved.startsWith('kaspa') || saved.startsWith('kaspatest'))) {
        onWalletConnected(saved);
      }
    } catch (e) {}
  }

  function bindConnectButton() {
    var btn = document.getElementById('htp-connect-wallet-btn')
           || document.getElementById('connectWalletBtn')
           || document.querySelector('[data-action="connect-wallet"]');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      btn.textContent = 'Connecting…';
      btn.disabled    = true;
      await detectAndConnectWallet();
      if (!window.connectedAddress) {
        btn.textContent = 'Connect Wallet';
        btn.disabled    = false;
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5.  BOARD CSS
   * ═══════════════════════════════════════════════════════════════════════════ */

  function injectBoardCss() {
    if (document.getElementById('htp-skill-style')) return;
    var style = document.createElement('style');
    style.id   = 'htp-skill-style';
    style.textContent = [
      '.htp-board-container{width:100%;max-width:100%;aspect-ratio:1/1;background:#1e293b;border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 20px rgba(73,232,194,.1);border:1px solid rgba(255,255,255,.05)}',
      '.htp-board-grid{display:grid;width:100%;height:100%;padding:4px;box-sizing:border-box}',
      '.htp-board-cell{display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;user-select:none;transition:transform .1s}',
      '.htp-board-cell:active{transform:scale(.95)}',
      '.chess-sq-light{background:#ebecd0;color:#779556}',
      '.chess-sq-dark{background:#779556;color:#ebecd0}',
      '.htp-board-cell.selected{background:rgba(255,255,0,.45)!important;box-shadow:inset 0 0 10px rgba(0,0,0,.2)}',
      '.htp-board-cell.legal-move::after{content:"";width:22%;height:22%;background:rgba(0,0,0,.15);border-radius:50%}',
      '.htp-board-cell.legal-capture::after{content:"";width:85%;height:85%;border:5px solid rgba(0,0,0,.15);border-radius:50%}',
      '.htp-board-cell.last-from,.htp-board-cell.last-to{background:rgba(255,255,0,.25)!important}',
      '.htp-board-cell.check{background:radial-gradient(circle,#ff4d4d 30%,transparent 80%)!important}',
      '.chess-piece-w{color:#fff;text-shadow:0 4px 8px rgba(0,0,0,.5);font-size:min(44px,8.8vw);filter:drop-shadow(0 2px 2px rgba(0,0,0,.2));transition:all .2s}',
      '.chess-piece-b{color:#111;text-shadow:0 2px 4px rgba(255,255,255,.2);font-size:min(44px,8.8vw);filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));transition:all .2s}',
      '.htp-board-cell:hover .chess-piece-w,.htp-board-cell:hover .chess-piece-b{transform:scale(1.05)}',
      '.coord-label{position:absolute;font-size:min(8px,1.8vw);font-weight:800;text-transform:uppercase;user-select:none;pointer-events:none;opacity:.6}',
      '.coord-rank{left:2px;top:2px}',
      '.coord-file{right:2px;bottom:2px}',
      '.chess-sq-light .coord-label{color:#779556}',
      '.chess-sq-dark .coord-label{color:#ebecd0}',
      '@media(max-width:600px){.htp-board-container{border-radius:8px}.coord-label{font-size:8px}}',
    ].join('');
    document.head.appendChild(style);
  }

  function getIndices(count, flipped) {
    var rows = []; for (var i = 7; i >= 0; i--) rows.push(i); if (flipped) rows.reverse();
    var cols = []; for (var j = 0; j <  8; j++) cols.push(j); if (flipped) cols.reverse();
    return { rows: rows, cols: cols };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6.  DOM READY
   * ═══════════════════════════════════════════════════════════════════════════ */

  function onReady() {
    initIdentity();
    injectBoardCss();
    bindConnectButton();
    detectAndConnectWallet();

    // Restore active match deadlines from Firebase Realtime DB
    if (window.firebase && window.firebase.database) {
      window.firebase.database().ref('matches')
        .orderByChild('status').equalTo('active')
        .once('value')
        .then(function (snap) {
          var matches = [];
          snap.forEach(function (child) {
            var m = child.val();
            m.id = child.key;
            matches.push(m);
          });
          if (matches.length) {
            window.dispatchEvent(new CustomEvent('htp:matches:loaded', { detail: { matches: matches } }));
          }
        })
        .catch(function () {});
    }

    console.log('[HTP Init] v3.0 ready | Network:', window.HTP_NETWORK, '|', window.HTP_RPC_URL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7.  PUBLIC API
   * ═══════════════════════════════════════════════════════════════════════════ */

  window.htpSkillUI = {
    getViewerId:       getViewerId,
    initIdentity:      initIdentity,
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
