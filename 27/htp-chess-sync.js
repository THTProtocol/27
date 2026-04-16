// htp-chess-sync.js — WS shim v2
// Firebase RTDB relay replaced by Rust WebSocket: ws://<HTP_RUST_API>/ws/game/<matchId>
// All clock/color/move logic now in game_ws.rs — this shim wires the existing chess UI to it.

(function () {
  'use strict';

  function myPlayerId() {
    return (typeof matchLobby !== 'undefined' && matchLobby.myPlayerId)
      || window._htpPlayerId || 'unknown';
  }

  function activeMatch() {
    return (typeof matchLobby !== 'undefined') ? matchLobby.activeMatch : null;
  }

  function patchChessGame() {
    var orig = window.startChessGame;
    if (!orig || orig._wsPatchedV2) return;

    window.startChessGame = function (opts) {
      var match   = activeMatch();
      var matchId = (match && match.id) || opts.id || 'unknown';
      var isCreator = match && (match.creator === myPlayerId());

      // Open WS connection
      var ws = window.htpGameSync(matchId, function (msg) {
        switch (msg.type) {
          case 'colors':
            var myColor = msg.data.white === myPlayerId() ? 'white' : 'black';
            window._htpMyColor = myColor;
            applyOrientation(myColor);
            break;
          case 'clock':
            renderClock(msg.data);
            break;
          case 'move':
            // Let existing chess UI handle the move render
            if (msg.data.player !== myPlayerId() && typeof chessUI !== 'undefined') {
              chessUI.applyOpponentMove && chessUI.applyOpponentMove(msg.data.mv);
            }
            break;
          case 'game_over':
            if (typeof handleMatchGameOver === 'function')
              handleMatchGameOver(msg.data.reason, msg.data.winner);
            break;
        }
      });

      // Start the original chess game
      orig.call(this, opts);

      // Assign colors via WS
      if (ws && isCreator) {
        var myColor = Math.random() < 0.5 ? 'white' : 'black';
        var oppColor = myColor === 'white' ? 'black' : 'white';
        window._htpMyColor = myColor;
        ws.htpSend({
          type: 'colors',
          data: { white: myColor === 'white' ? myPlayerId() : 'TBD',
                  black: myColor === 'black' ? myPlayerId() : 'TBD',
                  assigned: true }
        });
        applyOrientation(myColor);
      }

      // Hook move submission
      var origMove = window.submitChessMove;
      if (origMove && !origMove._wsPatchedV2) {
        window.submitChessMove = function (move) {
          origMove.call(this, move);
          ws && ws.htpSend({
            type: 'move',
            data: { player: myPlayerId(), game: 'chess', mv: move, ts: Date.now() }
          });
        };
        window.submitChessMove._wsPatchedV2 = true;
      }

      console.log('[HTP Chess WS] patched for match', matchId);
    };

    window.startChessGame._wsPatchedV2 = true;
  }

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

  // Patch when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchChessGame);
  } else {
    patchChessGame();
  }
  // Re-attempt after events load
  setTimeout(patchChessGame, 1500);

  console.log('[HTP Chess WS] shim v2 loaded');
})();
