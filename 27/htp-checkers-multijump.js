(function() {
  window.HTP_CHECKERS_MULTIJUMP = {
    pendingJumps: null,
    mandatoryPiece: null,

    getJumps: function(board, row, col, isKing, color) {
      const jumps = [];
      const dirs = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                   (color === 'r' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]]);
      dirs.forEach(([dr, dc]) => {
        const midR = row + dr, midC = col + dc;
        const landR = row + dr*2, landC = col + dc*2;
        if (landR < 0 || landR > 7 || landC < 0 || landC > 7) return;
        const mid = board[midR]?.[midC];
        const land = board[landR]?.[landC];
        if (mid && mid !== color && mid !== color.toUpperCase() && !land) {
          jumps.push({ from: [row,col], over: [midR,midC], to: [landR,landC] });
        }
      });
      return jumps;
    },

    executeJump: function(board, jump) {
      const newBoard = board.map(r => [...r]);
      const piece = newBoard[jump.from[0]][jump.from[1]];
      newBoard[jump.from[0]][jump.from[1]] = null;
      newBoard[jump.over[0]][jump.over[1]] = null;
      // King promotion
      const isKing = (jump.to[0] === 0 && piece === 'r') || (jump.to[0] === 7 && piece === 'b');
      newBoard[jump.to[0]][jump.to[1]] = isKing ? piece.toUpperCase() : piece;
      return newBoard;
    },

    handleMove: function(board, from, to, color) {
      const piece = board[from[0]][from[1]];
      if (!piece) return null;
      const isKing = piece === piece.toUpperCase() && piece !== piece.toLowerCase();
      const rowDiff = Math.abs(to[0] - from[0]);
      if (rowDiff === 2) {
        // It's a jump
        const jump = { from, over: [(from[0]+to[0])/2, (from[1]+to[1])/2], to };
        const newBoard = this.executeJump(board, jump);
        const furtherJumps = this.getJumps(newBoard, to[0], to[1], isKing, color.toLowerCase());
        if (furtherJumps.length > 0) {
          this.pendingJumps = furtherJumps;
          this.mandatoryPiece = to;
          return { board: newBoard, mustContinue: true, from: to };
        }
        this.pendingJumps = null;
        this.mandatoryPiece = null;
        return { board: newBoard, mustContinue: false };
      }
      // Normal move
      this.pendingJumps = null;
      this.mandatoryPiece = null;
      const newBoard = board.map(r => [...r]);
      newBoard[to[0]][to[1]] = newBoard[from[0]][from[1]];
      newBoard[from[0]][from[1]] = null;
      return { board: newBoard, mustContinue: false };
    }
  };
  console.log('[HTP Checkers] Multi-jump chain handler installed');
})();
