/**
 * htp-board-engine-fix.js — HTP Chess Core Fix v2.0
 * 
 * Fixes:
 *  1. chess.js API normalisation (isCheckmate / incheckmate both work)
 *  2. Clock parser handles "105", "10", "600", "5:00" formats
 *  3. renderChessBoardFull crash guard
 *  4. Orphan lobby broadcast TX suppressed
 *  5. Board orientation persistence after re-render
 *  6. Firebase relay path sanitisation
 *  7. Clock drift correction — re-syncs if > 2s off server timestamp
 * 
 * LOAD ORDER: after htp-board-engine.js
 *   <script src="htp-board-engine.js"></script>
 *   <script src="htp-board-engine-fix.js"></script>
 */

(function () {
  'use strict';

  // ── 1. Chess.js API Normaliser ─────────────────────────────────────────────
  function normaliseChessGame(g) {
    if (!g) return g;
    // Add missing new→old aliases
    if (typeof g.incheckmate !== 'function' && typeof g.isCheckmate === 'function') {
      g.incheckmate  = () => g.isCheckmate();
      g.instalemate  = () => g.isStalemate();
      g.indraw       = () => g.isDraw();
      g.incheck      = () => (typeof g.inCheck === 'function' ? g.inCheck() : false);
      g.gameover     = () => g.isGameOver();
    }
    // Add missing old→new aliases
    if (typeof g.isCheckmate !== 'function' && typeof g.incheckmate === 'function') {
      g.isCheckmate  = () => g.incheckmate();
      g.isStalemate  = () => g.instalemate();
      g.isDraw       = () => g.indraw();
      g.inCheck      = () => g.incheck();
      g.isGameOver   = () => g.gameover();
    }
    return g;
  }

  // Patch constructor
  const OrigChess = window.Chess;
  if (typeof OrigChess === 'function' && !OrigChess._htpPatched) {
    window.Chess = function (...args) {
      const g = new OrigChess(...args);
      return normaliseChessGame(g);
    };
    window.Chess.prototype = OrigChess.prototype;
    window.Chess._htpPatched = true;
  }

  // Poll for chessGame / game globals
  const _gPoll = setInterval(() => {
    ['chessGame', 'game'].forEach(k => {
      if (window[k] && typeof window[k].move === 'function') normaliseChessGame(window[k]);
    });
  }, 300);
  setTimeout(() => clearInterval(_gPoll), 30000);

  // ── 2. Time Control Parser ─────────────────────────────────────────────────
  // Handles: "105" (1min5s), "10" (10min), "600" (600s), "5:00" (MM:SS)
  window.htpParseTimeControl = function (tc) {
    if (!tc) return 600;
    const s = String(tc).trim();
    // MM:SS format
    if (s.includes(':')) {
      const [mm, ss] = s.split(':');
      return parseFloat(mm) * 60 + parseFloat(ss || 0);
    }
    const n = parseFloat(s);
    if (!n || isNaN(n)) return 600;
    // If looks like MMSS compact notation (e.g. 105 = 1min 5sec)
    if (s.length >= 3 && n >= 100 && n < 9999) {
      const mm = Math.floor(n / 100);
      const ss = n % 100;
      if (ss < 60) return mm * 60 + ss;
    }
    // Raw seconds if >= 60, else treat as minutes
    return n >= 60 ? n : n * 60;
  };

  // Patch htpSyncClock.start to use correct time + drift correction
  let _clockPatchAttempts = 0;
  function patchClockStart() {
    if (!window.htpSyncClock) {
      if (_clockPatchAttempts++ < 30) setTimeout(patchClockStart, 300);
      return;
    }
    if (window.htpSyncClock._htpFixed) return;

    const origStart = window.htpSyncClock.start.bind(window.htpSyncClock);
    window.htpSyncClock.start = function (matchId, color, initialMs) {
      // Re-derive from match if initialMs is absent or suspiciously small
      if (!initialMs || initialMs < 1000) {
        const match = typeof matchLobby !== 'undefined' ? matchLobby.activeMatch : null;
        const tc    = match ? match.timeControl : 10;
        initialMs   = window.htpParseTimeControl(tc) * 1000;
        console.log(`[HTP-FIX] Clock recalculated: ${(initialMs/60000).toFixed(1)} min from tc=${tc}`);
      }
      return origStart(matchId, color, initialMs);
    };

    // Drift correction: if elapsed diverges > 2s from Firebase server ts, resync
    const origTick = window.htpSyncClock.tick && window.htpSyncClock.tick.bind(window.htpSyncClock);
    if (origTick) {
      window.htpSyncClock.tick = function (...args) {
        const serverTs = window._htpServerTimestamp; // set by firebase-config.js if available
        if (serverTs && window.htpSyncClock._startTs) {
          const serverElapsed = Date.now() - serverTs;
          const localElapsed  = Date.now() - window.htpSyncClock._startTs;
          if (Math.abs(serverElapsed - localElapsed) > 2000) {
            window.htpSyncClock._startTs = Date.now() - serverElapsed;
          }
        }
        return origTick(...args);
      };
    }

    window.htpSyncClock._htpFixed = true;
    console.log('[HTP-FIX] Clock start patched — time control parser active');
  }
  patchClockStart();

  // ── 3. renderChessBoardFull crash guard ────────────────────────────────────
  function patchBoardEngine() {
    if (!window.renderChessBoardFull) { setTimeout(patchBoardEngine, 200); return; }
    if (window.renderChessBoardFull._fixed) return;
    const orig = window.renderChessBoardFull;
    window.renderChessBoardFull = function (...args) {
      if (window.chessGame) normaliseChessGame(window.chessGame);
      if (window.game)      normaliseChessGame(window.game);
      try {
        const r = orig.apply(this, args);
        // Re-apply board orientation after render
        setTimeout(reapplyOrientation, 30);
        return r;
      } catch (e) {
        console.warn('[HTP-FIX] renderChessBoardFull error, falling back:', e.message);
        if (typeof renderChessBoard === 'function') renderChessBoard();
      }
    };
    window.renderChessBoardFull._fixed = true;
    console.log('[HTP-FIX] renderChessBoardFull crash guard active');
  }
  patchBoardEngine();
  setTimeout(patchBoardEngine, 500);

  // ── 4. Suppress orphan lobby broadcast TX ─────────────────────────────────
  function suppressOrphanBroadcast() {
    const orig = window.createMatchWithLobby;
    if (!orig || orig._broadcastSuppressed) return;
    window.createMatchWithLobby = async function (...args) {
      let callCount = 0;
      const origSend = window.htpSendTx;
      window.htpSendTx = async function (to, amount, ...rest) {
        callCount++;
        // Suppress the second TX if it is the small lobby broadcast (~0.2 KAS)
        if (callCount > 1 && amount <= 20000000) {
          console.log('[HTP-FIX] Orphan lobby broadcast TX suppressed');
          return `suppressed-${Date.now()}`;
        }
        return origSend.apply(this, [to, amount, ...rest]);
      };
      try {
        return await orig.apply(this, args);
      } finally {
        window.htpSendTx = origSend;
      }
    };
    window.createMatchWithLobby._broadcastSuppressed = true;
    console.log('[HTP-FIX] Lobby broadcast TX suppressor active');
  }
  setTimeout(suppressOrphanBroadcast, 1000);
  setTimeout(suppressOrphanBroadcast, 3000);

  // ── 5. Board orientation persistence ──────────────────────────────────────
  function reapplyOrientation() {
    const color = window.htpMyColor;
    if (!color || color === 'white') return;
    const boards = document.querySelectorAll(
      '#chessBoard, .chess-board, [data-board], .cg-board, #chessBoardEl'
    );
    boards.forEach(b => {
      if (b.getAttribute('data-orientation') !== 'black') {
        b.setAttribute('data-orientation', 'black');
        b.style.transform = 'rotate(180deg)';
        b.querySelectorAll('.piece, td, cg-piece').forEach(p => {
          p.style.transform = 'rotate(180deg)';
        });
      }
    });
  }

  const _orientObs = new MutationObserver(() => {
    if (window.htpMyColor === 'black') reapplyOrientation();
  });
  const _bodyReady = setInterval(() => {
    if (document.body) {
      _orientObs.observe(document.body, { childList: true, subtree: true });
      clearInterval(_bodyReady);
      console.log('[HTP-FIX] Board orientation observer active');
    }
  }, 100);

  // ── 6. Firebase relay path sanitisation ───────────────────────────────────
  function fixRelayPath() {
    const orig = window.connectRelay;
    if (!orig || orig._pathFixed) return;
    window.connectRelay = function (matchId, gameType) {
      if (matchId && matchId.startsWith('/')) matchId = matchId.slice(1);
      return orig.call(this, matchId, gameType);
    };
    window.connectRelay._pathFixed = true;
    console.log('[HTP-FIX] connectRelay path sanitised');
  }
  setTimeout(fixRelayPath, 1000);
  setTimeout(fixRelayPath, 3000);

  console.log('[HTP-FIX] Board Engine Fix v2.0 loaded');
})();
