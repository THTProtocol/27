'use strict';

class Connect4UI {
  constructor(containerId, game, myColor) {
    this.containerId = containerId;
    this.game = game;
    this.myColor = myColor;
    this.cols = 7;
    this.rows = 6;
    this.board = this._initBoard(game.boardState);
    this.turn = 'red';
    this.moves = game.moves || [];
    this.winner = null;
    this.winningCells = [];
  }

  _initBoard(state) {
    if (state) {
      try { return JSON.parse(state); } catch {}
    }
    return Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const myTurn = this.myColor === 'white' ? 'red' : 'yellow';
    const isMyTurn = this.turn === myTurn && this.game.status === 'playing' && !this.winner;

    let html = '<div class="connect4-board" id="c4-board">';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const isWinning = this.winningCells.some(w => w.r === r && w.c === c);
        let cls = 'connect4-cell';
        if (cell === 'red') cls += ' red';
        else if (cell === 'yellow') cls += ' yellow';
        if (isWinning) cls += ' winning';

        html += '<div class="' + cls + '" data-col="' + c + '" ' +
          (isMyTurn && !cell ? 'style="cursor:pointer"' : '') + '></div>';
      }
    }
    html += '</div>';

    // Column indicators
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:4px 12px">';
    for (let c = 0; c < this.cols; c++) {
      const canDrop = this.board[0][c] === null && !this.winner;
      html += '<div style="text-align:center;font-size:18px;cursor:' + (canDrop && isMyTurn ? 'pointer' : 'default') +
        ';opacity:' + (canDrop && isMyTurn ? '0.7' : '0.2') + '" data-drop="' + c + '">' +
        (isMyTurn && myTurn === 'red' ? '🔴' : isMyTurn && myTurn === 'yellow' ? '🟡' : '⬇') + '</div>';
    }
    html += '</div>';

    // Turn indicator
    if (!this.winner) {
      html += '<div style="text-align:center;margin-top:8px;font-size:13px;color:var(--text-secondary)">' +
        (isMyTurn ? '<span style="color:var(--green)">Your turn</span>' : 'Opponent\'s turn') +
        ' · <span style="color:' + (this.turn === 'red' ? '#ef4444' : '#eab308') + '">' + this.turn + '</span>' +
      '</div>';
    } else {
      html += '<div style="text-align:center;margin-top:8px;font-size:15px;font-weight:700;color:var(--green)">🏆 ' +
        this.winner + ' wins!</div>';
    }

    container.innerHTML = html;

    document.querySelectorAll('.connect4-cell, [data-drop]').forEach(el => {
      const col = parseInt(el.dataset.col ?? el.dataset.drop);
      if (isNaN(col)) return;
      el.addEventListener('click', () => this._onColumnClick(col));
    });
  }

  _onColumnClick(col) {
    if (this.game.status !== 'playing' || this.winner) return;
    const myTurn = this.myColor === 'white' ? 'red' : 'yellow';
    if (this.turn !== myTurn) return;

    const row = this._getDropRow(col);
    if (row === -1) return;

    this._makeMove(col, row);
  }

  _getDropRow(col) {
    for (let r = this.rows - 1; r >= 0; r--) {
      if (!this.board[r][col]) return r;
    }
    return -1;
  }

  _makeMove(col, row) {
    const color = this.turn;
    this.board[row][col] = color;

    const win = this._checkWin(row, col);
    if (win) {
      this.winner = color;
      this.winningCells = win;
    }

    const isDraw = !this.winner && this.board[0].every(cell => cell !== null);

    this.turn = this.turn === 'red' ? 'yellow' : 'red';

    const from = 'col' + col;
    const to = 'r' + row + 'c' + col;
    const boardState = JSON.stringify(this.board);
    const move = { from, to, piece: color, boardState, player: app.wallet?.address };
    this.moves.push(move);

    wsSend('game-move', {
      gameId: this.game.id, from, to, piece: color,
      boardState, player: app.wallet?.address
    });

    if (this.winner) {
      wsSend('game-checkmate', { gameId: this.game.id, winner: app.wallet?.address });
    } else if (isDraw) {
      wsSend('game-draw-accept', { gameId: this.game.id });
    }

    this.render();
  }

  _checkWin(r, c) {
    const color = this.board[r][c];
    if (!color) return null;

    const directions = [
      [[0, 1], [0, -1]],   // horizontal
      [[1, 0], [-1, 0]],   // vertical
      [[1, 1], [-1, -1]],  // diagonal \
      [[1, -1], [-1, 1]],  // diagonal /
    ];

    for (const [dir1, dir2] of directions) {
      const cells = [{ r, c }];

      for (const [dr, dc] of [dir1, dir2]) {
        let cr = r + dr, cc = c + dc;
        while (cr >= 0 && cr < this.rows && cc >= 0 && cc < this.cols && this.board[cr][cc] === color) {
          cells.push({ r: cr, c: cc });
          cr += dr;
          cc += dc;
        }
      }

      if (cells.length >= 4) return cells;
    }

    return null;
  }

  onRemoteMove(data) {
    if (data.boardState) {
      try {
        this.board = JSON.parse(data.boardState);
      } catch {}
    } else if (data.to) {
      const match = data.to.match(/r(\d)c(\d)/);
      if (match) {
        const r = parseInt(match[1]);
        const c = parseInt(match[2]);
        this.board[r][c] = data.piece || this.turn;
      }
    }

    // Check for win after remote move
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c]) {
          const win = this._checkWin(r, c);
          if (win) {
            this.winner = this.board[r][c];
            this.winningCells = win;
          }
        }
      }
    }

    this.turn = this.turn === 'red' ? 'yellow' : 'red';
    if (!this.moves.some(m => m.from === data.from && m.to === data.to && m.player === data.player)) {
      this.moves.push(data);
    }
    this.render();
  }

  getMoves() { return this.moves; }
}

window.Connect4UI = Connect4UI;
