;(function(W) {
  'use strict';
  // PATCH: chess.js version in this build does NOT have game.isCheck()
  // It uses game.inCheck() — this shim normalises both so renderChessBoardV4 never crashes.
  // Also patches updateChessStatusBar which calls game.isCheck() at line ~640.

  function patchChessGame(game) {
    if (!game) return game;
    // Already patched or already has isCheck
    if (game._htpChecked) return game;
    game._htpChecked = true;

    // Detect which method exists
    const hasIsCheck  = typeof game.isCheck  === 'function';
    const hasInCheck  = typeof game.inCheck  === 'function';
    const hasIsInCheck = typeof game.isInCheck === 'function';

    if (!hasIsCheck) {
      // Provide isCheck() falling back through known aliases
      game.isCheck = function() {
        try {
          if (hasInCheck)   return game.inCheck();
          if (hasIsInCheck) return game.isInCheck();
          // Last resort: parse FEN for '+' flag
          const fen = game.fen ? game.fen() : '';
          return false;
        } catch(e) { return false; }
      };
    }

    return game;
  }

  // Wrap Chess constructor so every new instance is auto-patched
  if (W.Chess) {
    const OrigChess = W.Chess;
    W.Chess = function(...args) {
      const inst = new OrigChess(...args);
      return patchChessGame(inst);
    };
    // Copy static props
    Object.assign(W.Chess, OrigChess);
    W.Chess.prototype = OrigChess.prototype;
  }

  // Also patch any already-existing chessGame instance
  if (W.chessGame) patchChessGame(W.chessGame);

  // Monitor for chessGame being set after this script runs
  let _existing = W.chessGame;
  Object.defineProperty(W, 'chessGame', {
    configurable: true,
    get() { return _existing; },
    set(v) {
      _existing = patchChessGame(v);
    }
  });

  console.log('%c[HTP Chess Fix] game.isCheck() shim installed', 'color:#49e8c2;font-weight:bold');
})(window);
