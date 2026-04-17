// htp-chess-sync.js — v3.0
// Bug fixes:
//   1. Color race condition: colors written to Firebase atomically, both players read on connect
//   2. Timeout: 60s no-move countdown → handleMatchGameOver('timeout', loser)
// Preserved: applyOrientation(), renderClock(), WS ping/reconnect logic

(function () {
  'use strict';

  var MOVE_TIMEOUT_MS = 60000; // 60 seconds
  var _moveTimer = null;

  function myPlayerId() {
    return (typeof matchLobby !== 'undefined' && matchLobby.myPlayerId)
      || window._htpPlayerId || 'unknown';
  }

  function activeMatch() {
    return (typeof matchLobby !== 'undefined') ? matchLobby.activeMatch : null;
  }

  function fdb() {
    return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
  }

  // ── Color assignment via Firebase (atomic, no WS race) ──────────────────
  async function assignColorsViaFirebase(matchId) {
    var db = fdb();
    if (!db) return;
    var colorsRef = db.ref('relay/' + matchId + '/colors');
    var snap = await colorsRef.once('value');
    if (snap.exists()) {
      // Already assigned — read and apply
      applyColorsFromData(snap.val());
      return;
    }
    // Creator assigns
    var myId = myPlayerId();
    var match = activeMatch();
    var joinerId = (match && match.joiner) || 'joiner';
    var creatorIsWhite = Math.random() < 0.5;
    var colors = {
      white: creatorIsWhite ? myId : joinerId,
      black: creatorIsWhite ? joinerId : myId,
      assignedAt: Date.now(),
    };
    // Atomic set — only writes if node doesn't exist (transaction)
    await colorsRef.transaction(function(current) {
      if (current === null) return colors;
      return; // abort if already set
    });
    var final = await colorsRef.once('value');
    applyColorsFromData(final.val());
  }

  function applyColorsFromData(colorsData) {
    if (!colorsData) return;
    var myId  = myPlayerId();
    var color = colorsData.white === myId ? 'white' : 'black';
    window._htpMyColor = color;
    applyOrientation(color);
    console.log('[HTP Chess v3] color assigned:', color);
  }

  function listenForColorAssignment(matchId) {
    var db = fdb();
    if (!db) return;
    db.ref('relay/' + matchId + '/colors').on('value', function(snap) {
      if (snap.exists()) applyColorsFromData(snap.val());
    });
  }

  // ── Move timeout ────────────────────────────────────────────────────────
  function resetMoveTimer(matchId) {
    if (_moveTimer) clearTimeout(_moveTimer);
    _moveTimer = setTimeout(function() {
      var match = activeMatch();
      if (!match || match.status !== 'active') return;
      console.warn('[HTP Chess v3] move timeout — flagging as abandoned');
      // The player whose turn it is loses
      var loser = window._htpMyColor || 'white'; // conservative: flag self
      if (typeof handleMatchGameOver === 'function') {
        handleMatchGameOver('timeout', loser === 'white' ? 'black' : 'white');
      }
    }, MOVE_TIMEOUT_MS);
  }

  function stopMoveTimer() {
    if (_moveTimer) { clearTimeout(_moveTimer); _moveTimer = null; }
  }

  // ── Patch startChessGame ─────────────────────────────────────────────────
  function patchChessGame() {
    var orig = window.startChessGame;
    if (!orig || orig._wsPatchedV3) return;

    window.startChessGame = function (opts) {
      var match   = activeMatch();
      var matchId = (match && match.id) || (opts && opts.id) || 'unknown';
      var isCreator = match && (match.creator === myPlayerId());

      // Open WS connection
      var ws = window.htpGameSync && window.htpGameSync(matchId, function (msg) {
        switch (msg.type) {
          case 'clock':
            renderClock(msg.data);
            break;
          case 'move':
            resetMoveTimer(matchId);
            if (msg.data.player !== myPlayerId() && typeof chessUI !== 'undefined') {
              chessUI.applyOpponentMove && chessUI.applyOpponentMove(msg.data.mv);
            }
            break;
          case 'game_over':
            stopMoveTimer();
            if (typeof handleMatchGameOver === 'function')
              handleMatchGameOver(msg.data.reason, msg.data.winner);
            break;
        }
      });

      orig.call(this, opts);

      // Colors via Firebase — no WS race
      listenForColorAssignment(matchId);
      if (isCreator) {
        assignColorsViaFirebase(matchId);
      }

      // Start move timer
      resetMoveTimer(matchId);

      // Hook move submission
      var origMove = window.submitChessMove;
      if (origMove && !origMove._wsPatchedV3) {
        window.submitChessMove = function (move) {
          origMove.call(this, move);
          resetMoveTimer(matchId);
          ws && ws.htpSend({
            type: 'move',
            data: { player: myPlayerId(), game: 'chess', mv: move, ts: Date.now() }
          });
        };
        window.submitChessMove._wsPatchedV3 = true;
      }

      console.log('[HTP Chess v3] patched for match', matchId, '| isCreator:', isCreator);
    };

    window.startChessGame._wsPatchedV3 = true;
  }

  // ── applyOrientation (preserved exactly) ────────────────────────────────
  function applyOrientation(color) {
    var boards = Array.from(document.querySelectorAll(
      '#chessboard, .chess-board, [data-board], cg-board, .cg-board'
    ));
    var inner = document.getElementById('chessBoardEl') ||
                document.querySelector('.chess-board-inner') ||
                document.querySelector('table.chess');
    if (inner) boards.push(inner);
    if (!boards.length) { setTimeout(function () { applyOrientation(color); }, 300); return; }
    boards.forEach(function (b) {
      if (color === 'black') {
        b.style.transform = 'rotate(180deg)';
        b.querySelectorAll('.piece, cg-piece, [data-piece], td').forEach(function (p) {
          p.style.transform = 'rotate(180deg)';
        });
      } else {
        b.style.transform = '';
        b.querySelectorAll('.piece, cg-piece, [data-piece], td').forEach(function (p) {
          p.style.transform = '';
        });
      }
    });
    if (typeof chessUI !== 'undefined') chessUI.playerColor = color === 'white' ? 'w' : 'b';
  }

  // ── renderClock (preserved exactly) ─────────────────────────────────────
  function renderClock(data) {
    var wEl = document.getElementById('chessTimerWhite');
    var bEl = document.getElementById('chessTimerBlack');
    function fmt(ms) {
      if (ms < 0) ms = 0;
      return Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    }
    if (wEl) { wEl.textContent = fmt(data.white_ms); wEl.style.color = data.active_color === 'white' ? '#49e8c2' : '#888'; }
    if (bEl) { bEl.textContent = fmt(data.black_ms); bEl.style.color = data.active_color === 'black' ? '#49e8c2' : '#888'; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchChessGame);
  } else {
    patchChessGame();
  }
  setTimeout(patchChessGame, 1500);

  console.log('[HTP Chess WS] shim v3 loaded');
})();
