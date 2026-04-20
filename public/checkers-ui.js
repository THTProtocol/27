'use strict';

class CheckersUI {
  constructor(containerId, game, myColor) {
    this.containerId = containerId;
    this.game = game;
    this.myColor = myColor;
    this.board = this._initBoard(game.boardState);
    this.selected = null;
    this.legalMoves = [];
    this.turn = 'red';
    this.moves = game.moves || [];
    this.mustJump = false;
    this.flipped = myColor === 'black';
  }

  _initBoard(state) {
    if (state) {
      try { return JSON.parse(state); } catch {}
    }
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let f = 0; f < 8; f++) {
        if ((r + f) % 2 === 1) board[r][f] = { color: 'black', king: false };
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if ((r + f) % 2 === 1) board[r][f] = { color: 'red', king: false };
      }
    }
    return board;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let html = '<div class="checkers-board" id="checkers-board">';
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const r = this.flipped ? 7 - rank : rank;
        const f = this.flipped ? 7 - file : file;
        const piece = this.board[r][f];
        const isLight = (r + f) % 2 === 0;
        const isSelected = this.selected && this.selected.r === r && this.selected.f === f;
        const isLegal = this.legalMoves.some(m => m.r === r && m.f === f);

        let cls = 'checkers-square ' + (isLight ? 'light' : 'dark');
        if (isSelected) cls += ' selected';

        html += '<div class="' + cls + '" data-r="' + r + '" data-f="' + f + '" style="position:relative">';
        if (piece) {
          html += '<div class="checkers-piece ' + piece.color + (piece.king ? ' king' : '') + '"></div>';
        }
        if (isLegal) {
          html += '<div style="position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(119,149,86,0.5)"></div>';
        }
        html += '</div>';
      }
    }
    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('.checkers-square').forEach(sq => {
      sq.addEventListener('click', () => {
        const r = parseInt(sq.dataset.r);
        const f = parseInt(sq.dataset.f);
        this._onClick(r, f);
      });
    });
  }

  _onClick(r, f) {
    if (this.game.status !== 'playing') return;
    const myTurnColor = this.myColor === 'white' ? 'red' : 'black';
    if (this.turn !== myTurnColor) return;

    const piece = this.board[r][f];

    if (this.selected) {
      const move = this.legalMoves.find(m => m.r === r && m.f === f);
      if (move) {
        this._makeMove(this.selected.r, this.selected.f, r, f, move);
        return;
      }
    }

    if (piece && piece.color === myTurnColor) {
      this.selected = { r, f };
      this.legalMoves = this._getLegalMoves(r, f);

      if (this.mustJump) {
        this.legalMoves = this.legalMoves.filter(m => m.isJump);
        if (this.legalMoves.length === 0) {
          this.selected = null;
          this.legalMoves = [];
        }
      }
      this.render();
    } else {
      this.selected = null;
      this.legalMoves = [];
      this.render();
    }
  }

  _makeMove(fr, ff, tr, tf, moveInfo) {
    const piece = this.board[fr][ff];
    this.board[tr][tf] = { ...piece };
    this.board[fr][ff] = null;

    if (moveInfo.isJump && moveInfo.captured) {
      this.board[moveInfo.captured.r][moveInfo.captured.f] = null;
    }

    // King promotion
    if (this.board[tr][tf].color === 'red' && tr === 0) this.board[tr][tf].king = true;
    if (this.board[tr][tf].color === 'black' && tr === 7) this.board[tr][tf].king = true;

    // Multi-jump check
    if (moveInfo.isJump) {
      const further = this._getJumps(tr, tf);
      if (further.length > 0) {
        this.selected = { r: tr, f: tf };
        this.legalMoves = further;
        this.mustJump = true;
        this.render();
        return;
      }
    }

    this.mustJump = false;
    this.selected = null;
    this.legalMoves = [];

    this.turn = this.turn === 'red' ? 'black' : 'red';

    const from = this._toNotation(fr, ff);
    const to = this._toNotation(tr, tf);
    const boardState = JSON.stringify(this.board);
    const move = { from, to, piece: piece.color, boardState, player: app.wallet?.address };
    this.moves.push(move);

    wsSend('game-move', { gameId: this.game.id, from, to, piece: piece.color, boardState, player: app.wallet?.address });

    this._checkMustJump();

    if (this._isGameOver()) {
      const winner = app.wallet?.address;
      wsSend('game-checkmate', { gameId: this.game.id, winner });
    }

    this.render();
  }

  _getLegalMoves(r, f) {
    const piece = this.board[r][f];
    if (!piece) return [];

    const jumps = this._getJumps(r, f);
    if (jumps.length > 0) return jumps;

    const moves = [];
    const dirs = this._getDirs(piece);

    for (const [dr, df] of dirs) {
      const tr = r + dr, tf = f + df;
      if (tr < 0 || tr > 7 || tf < 0 || tf > 7) continue;
      if (!this.board[tr][tf]) {
        moves.push({ r: tr, f: tf, isJump: false });
      }
    }

    return moves;
  }

  _getJumps(r, f) {
    const piece = this.board[r][f];
    if (!piece) return [];
    const jumps = [];
    const dirs = this._getDirs(piece);

    for (const [dr, df] of dirs) {
      const mr = r + dr, mf = f + df;
      const tr = r + dr * 2, tf = f + df * 2;
      if (tr < 0 || tr > 7 || tf < 0 || tf > 7) continue;
      if (mr < 0 || mr > 7 || mf < 0 || mf > 7) continue;
      const mid = this.board[mr][mf];
      if (mid && mid.color !== piece.color && !this.board[tr][tf]) {
        jumps.push({ r: tr, f: tf, isJump: true, captured: { r: mr, f: mf } });
      }
    }

    return jumps;
  }

  _getDirs(piece) {
    if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    if (piece.color === 'red') return [[-1, -1], [-1, 1]];
    return [[1, -1], [1, 1]];
  }

  _checkMustJump() {
    this.mustJump = false;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r][f];
        if (piece && piece.color === this.turn) {
          if (this._getJumps(r, f).length > 0) {
            this.mustJump = true;
            return;
          }
        }
      }
    }
  }

  _isGameOver() {
    let opponentPieces = 0;
    let opponentMoves = 0;
    const opponent = this.turn;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r][f];
        if (piece && piece.color === opponent) {
          opponentPieces++;
          if (this._getLegalMoves(r, f).length > 0) opponentMoves++;
        }
      }
    }

    return opponentPieces === 0 || opponentMoves === 0;
  }

  onRemoteMove(data) {
    if (data.boardState) {
      try {
        this.board = JSON.parse(data.boardState);
      } catch {}
    }
    this.turn = this.turn === 'red' ? 'black' : 'red';
    if (!this.moves.some(m => m.from === data.from && m.to === data.to && m.player === data.player)) {
      this.moves.push(data);
    }
    this.selected = null;
    this.legalMoves = [];
    this._checkMustJump();
    this.render();
  }

  getMoves() { return this.moves; }

  _toNotation(r, f) { return String.fromCharCode(97 + f) + (8 - r); }
}

window.CheckersUI = CheckersUI;
