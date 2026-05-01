/**
 * htp-gamefix-sync.js
 * Fixes:
 *  1. "Back to Lobby" button broken (wrong nav selector / undefined goskillGames)
 *  2. Game state sync broken (Firebase relay startAt race, missing C4/CK relay hooks,
 *     renderChessBoard() called with no container so board never updates for remote moves)
 *
 * Load AFTER htp-skill-games-v2 (already at end of index.html).
 */
(function (W) {
  'use strict';

  if (W.__htpGamefixSyncInstalled) return;
  W.__htpGamefixSyncInstalled = true;

  /* ─────────────────────────────────────────────────────────────────
   * FIX 1 — Back to Lobby button
   *
   * The overlay's backToLobbyBtn onclick searches for:
   *   [data-section="skill-games"]   ← doesn't exist
   *   [onclick*="goskillGames"]      ← function doesn't exist
   *   [onclick*="goskill"]           ← doesn't exist either
   *
   * The real nav button is: <button data-v="skill" onclick="go('skill')">
   * Fix: delegate a click listener on document for #backToLobbyBtn that
   * calls go('skill') directly, cleaning up all overlays first.
   * ─────────────────────────────────────────────────────────────────*/
  function patchBackToLobby() {
    document.addEventListener('click', function (e) {
      if (!e.target || e.target.id !== 'backToLobbyBtn') return;

      // 1. Remove all game overlays
      ['gameOverOverlay', 'chessOverlay', 'c4overlay', 'ckoverlay',
        'c4Overlay', 'ckOverlay', 'skill-preview', 'tttoverlay'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
      document.querySelectorAll('.chess-overlay, .htp-game-overlay').forEach(function (el) { el.remove(); });

      // 2. Clear active match
      if (W.matchLobby) W.matchLobby.activeMatch = null;

      // 3. Navigate to skill section using the app's own go() function
      if (typeof W.go === 'function') {
        W.go('skill');
      } else {
        // Fallback: click the nav button directly
        var navBtn = document.querySelector('[data-v="skill"]');
        if (navBtn) navBtn.click();
      }

      // 4. Re-render lobby after navigation
      setTimeout(function () {
        if (typeof W.renderLobby === 'function') W.renderLobby();
      }, 80);
    }, true); // capture phase so it fires before any stopPropagation
  }

  /* ─────────────────────────────────────────────────────────────────
   * FIX 2 — Game state sync
   *
   * Problems:
   *  a) connectRelay uses startAt(Date.now()) — if the opponent's move
   *     arrives before your listener registers (race condition) you miss it.
   *     Fix: use startAt(Date.now() - 5000) to get a 5 s lookback window.
   *
   *  b) hookMoveRelay only wraps chessSquareClick for chess.
   *     Connect4 (dropC4) and Checkers (ckClick) are never hooked.
   *     Fix: also wrap dropC4 and ckClick once relay is active.
   *
   *  c) handleRelayMessage calls renderChessBoard() with no arguments.
   *     The chess board renderer inside htp-skill-games-v2 is not the same
   *     as any global renderChessBoard — the overlay's board lives inside
   *     '#chessOverlay .chess-board' and is rendered by chessUI.renderBoard().
   *     Fix: call chessUI.renderBoard() (or fall back to full re-render via
   *     window.renderChessBoard with the correct container id).
   * ─────────────────────────────────────────────────────────────────*/

  /* ── 2a: patch connectRelay's startAt to use a 5 s lookback ── */
  function patchConnectRelay() {
    // connectRelay is a closure inside htp-skill-games-v2, we can't reference it
    // directly. Instead we override window.connectRelay if it was exported, OR
    // we wait for the Firebase relay object (fbRelay) to appear and then fix the
    // subscription each time a new match starts by hooking hookMoveRelay.
    //
    // The safest approach: patch hookMoveRelay so it re-subscribes with
    // a 5-second lookback.

    var _origHook = W.hookMoveRelay;
    if (typeof _origHook !== 'function') {
      // Not yet defined — retry after scripts settle
      setTimeout(patchConnectRelay, 500);
      return;
    }
    if (_origHook._syncPatched) return;

    W.hookMoveRelay = function (matchId, gameType) {
      // Call original first (sets up Firebase presence, move listener, chess hook)
      _origHook.call(this, matchId, gameType);

      // ── 2a: extend lookback by re-subscribing moves with -5 s ──
      try {
        if (typeof firebase !== 'undefined' && W.fbRelay && W.fbRelay.matchId === matchId) {
          var movesRef = firebase.database().ref('relay/' + matchId + '/moves');
          var lookback = Date.now() - 5000;
          movesRef.orderByChild('ts').startAt(lookback).once('value', function (snap) {
            snap.forEach(function (child) {
              var msg = child.val();
              if (!msg) return;
              // skip own messages and already-processed ones
              if (W.fbRelay && msg.player === W.fbRelay.playerId) return;
              if (W.fbRelay && msg.ts <= W.fbRelay.lastMoveTs) return;
              if (W.fbRelay) W.fbRelay.lastMoveTs = msg.ts;
              if (typeof W.handleRelayMessage === 'function') W.handleRelayMessage(msg);
            });
          });
        }
      } catch (e) {
        console.warn('[HTP GamefixSync] Lookback patch error:', e);
      }

      // ── 2b: hook Connect4 dropC4 ──
      if (gameType === 'c4' || gameType === 'connect4') {
        _patchDropC4(matchId);
      }

      // ── 2b: hook Checkers ckClick ──
      if (gameType === 'ck' || gameType === 'checkers') {
        _patchCkClick(matchId);
      }
    };
    W.hookMoveRelay._syncPatched = true;
    console.log('[HTP GamefixSync] hookMoveRelay patched');
  }

  /* ── 2b: wrap dropC4 so moves are relayed ── */
  function _patchDropC4(matchId) {
    if (typeof W.dropC4 !== 'function' || W.dropC4._fbRelayed) return;
    var orig = W.dropC4;
    W.dropC4 = function (col) {
      var prevTurn = W.C4 && W.C4.turn;
      orig(col);
      var newTurn = W.C4 && W.C4.turn;
      // If turn changed a move was successfully placed
      if (prevTurn !== newTurn || (W.C4 && W.C4.gameOver)) {
        if (typeof W.relaySend === 'function') {
          W.relaySend({
            type: 'move',
            game: 'c4',
            col: col,
            side: prevTurn,
            timeLeft: W.C4 ? W.C4.timeLeft : null
          });
        }
      }
    };
    W.dropC4._fbRelayed = true;
    console.log('[HTP GamefixSync] dropC4 relay hooked for', matchId);
  }

  /* ── 2b: wrap ckClick so moves are relayed ── */
  function _patchCkClick(matchId) {
    if (typeof W.ckClick !== 'function' || W.ckClick._fbRelayed) return;
    var orig = W.ckClick;
    // ckClick(r, c) — internally it tracks selection state via CK.selected
    W.ckClick = function (r, c) {
      var preBoardJson = W.CK ? JSON.stringify(W.CK.board) : null;
      var preFrom = W.CK ? W.CK.selected : null;
      orig(r, c);
      // If board changed a move completed
      if (W.CK && preBoardJson && JSON.stringify(W.CK.board) !== preBoardJson && preFrom) {
        var to = { r: r, c: c };
        if (typeof W.relaySend === 'function') {
          W.relaySend({
            type: 'move',
            game: 'ck',
            from: preFrom,
            to: to,
            side: W.CK.turn === W.CK.myColor ? W.CK.myColor : (W.CK.myColor === 1 ? 3 : 1),
            cktime: W.CK.timeLeft ? [W.CK.timeLeft[0], W.CK.timeLeft[1]] : null
          });
        }
      }
    };
    W.ckClick._fbRelayed = true;
    console.log('[HTP GamefixSync] ckClick relay hooked for', matchId);
  }

  /* ── 2c: fix renderChessBoard() called with no container ── */
  function patchHandleRelayMessage() {
    var _origHandle = W.handleRelayMessage;
    if (typeof _origHandle !== 'function') {
      setTimeout(patchHandleRelayMessage, 500);
      return;
    }
    if (_origHandle._syncPatched) return;

    W.handleRelayMessage = function (msg) {
      _origHandle.call(this, msg);

      // After the original handler loads the FEN into chessGame, force a proper
      // board re-render by calling the overlay's own renderBoard method.
      if (msg && msg.type === 'move' && (msg.game === 'chess') && W.chessUI) {
        try {
          if (typeof W.chessUI.renderBoard === 'function') {
            W.chessUI.renderBoard();
          } else if (typeof W.renderChessBoard === 'function') {
            // fallback: find the board container inside the overlay
            var overlay = document.getElementById('chessOverlay');
            var container = overlay && (overlay.querySelector('.chess-board') || overlay.querySelector('#board'));
            if (container) W.renderChessBoard(container.id || 'chess-board', W._htpBoardState);
          }
        } catch (e) {}
      }
    };
    W.handleRelayMessage._syncPatched = true;
    console.log('[HTP GamefixSync] handleRelayMessage patched');
  }

  /* ─────────────────────────────────────────────────────────────────
   * FIX 3 — Tic-Tac-Toe "back to lobby" inside game over overlay
   *  The same pattern applies — goskillGames undefined. Already fixed
   *  by Fix 1's delegated listener, but also ensure any inline ttt
   *  back buttons are wired up.
   * ─────────────────────────────────────────────────────────────────*/
  function patchTTTBackButton() {
    // TTT overlays use closePreview() which then doesn't navigate. Patch it.
    var _origClosePreview = W.closePreview;
    if (typeof _origClosePreview !== 'function') return;
    if (_origClosePreview._syncPatched) return;
    W.closePreview = function () {
      _origClosePreview.call(this);
      // If we're on a finished match, go back to lobby
      if (W.matchLobby && !W.matchLobby.activeMatch) {
        setTimeout(function () {
          if (typeof W.go === 'function') W.go('skill');
          else { var b = document.querySelector('[data-v="skill"]'); if (b) b.click(); }
        }, 50);
      }
    };
    W.closePreview._syncPatched = true;
  }

  /* ─────────────────────────────────────────────────────────────────
   * INIT — run after DOM ready so all game scripts have executed
   * ─────────────────────────────────────────────────────────────────*/
  function init() {
    patchBackToLobby();          // Fix 1 — always safe, uses event delegation
    patchConnectRelay();          // Fix 2a+2b — waits for hookMoveRelay to exist
    patchHandleRelayMessage();    // Fix 2c — waits for handleRelayMessage to exist
    setTimeout(patchTTTBackButton, 800); // Fix 3 — closePreview patch
    console.log('[HTP GamefixSync] v1 loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
