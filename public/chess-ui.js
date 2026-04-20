'use strict';

class ChessUI {
  constructor(containerId, game, myColor) {
    this.containerId = containerId;
    this.game = game;
    this.myColor = myColor;
    this.board = this._parseFen(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.turn = 'w';
    this.moves = game.moves || [];
    this.castling = 'KQkq';
    this.enPassant = null;
    this.flipped = myColor === 'black';
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let html = '<div class="chess-board" id="chess-board">';
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const r = this.flipped ? 7 - rank : rank;
        const f = this.flipped ? 7 - file : file;
        const sq = this._sq(r, f);
        const piece = this.board[r][f];
        const isLight = (r + f) % 2 === 0;
        const isSelected = this.selected && this.selected.r === r && this.selected.f === f;
        const isLegal = this.legalMoves.some(m => m.r === r && m.f === f);
        const isLast = this.lastMove && ((this.lastMove.fr === r && this.lastMove.ff === f) || (this.lastMove.tr === r && this.lastMove.tf === f));

        let cls = 'chess-square ' + (isLight ? 'light' : 'dark');
        if (isSelected) cls += ' selected';
        if (isLegal) cls += ' legal-move';
        if (isLast) cls += ' last-move';

        html += '<div class="' + cls + '" data-r="' + r + '" data-f="' + f + '">';
        if (piece) {
          html += '<img class="chess-piece" src="' + getPieceDataUrl(piece) + '" alt="' + piece + '">';
        }
        html += '</div>';
      }
    }
    html += '</div>';

    if (!this.flipped) {
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;color:var(--text-muted)">' +
        '<span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span></div>';
    } else {
      html += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;color:var(--text-muted)">' +
        '<span>h</span><span>g</span><span>f</span><span>e</span><span>d</span><span>c</span><span>b</span><span>a</span></div>';
    }

    container.innerHTML = html;

    document.querySelectorAll('.chess-square').forEach(sq => {
      sq.addEventListener('click', () => {
        const r = parseInt(sq.dataset.r);
        const f = parseInt(sq.dataset.f);
        this._onClick(r, f);
      });
    });
  }

  _onClick(r, f) {
    if (this.game.status !== 'playing') return;
    const isMyTurn = (this.turn === 'w' && this.myColor === 'white') || (this.turn === 'b' && this.myColor === 'black');
    if (!isMyTurn) return;

    const piece = this.board[r][f];

    if (this.selected) {
      const isLegal = this.legalMoves.some(m => m.r === r && m.f === f);
      if (isLegal) {
        this._makeMove(this.selected.r, this.selected.f, r, f);
        this.selected = null;
        this.legalMoves = [];
        this.render();
        return;
      }
    }

    if (piece && this._isMyPiece(piece)) {
      this.selected = { r, f };
      this.legalMoves = this._getLegalMoves(r, f);
      this.render();
    } else {
      this.selected = null;
      this.legalMoves = [];
      this.render();
    }
  }

  _makeMove(fr, ff, tr, tf) {
    const piece = this.board[fr][ff];
    const captured = this.board[tr][tf];

    // En passant capture
    if (piece.toLowerCase() === 'p' && tf !== ff && !captured) {
      this.board[fr][tf] = null;
    }

    // Castling
    if (piece.toLowerCase() === 'k' && Math.abs(tf - ff) === 2) {
      if (tf > ff) { // Kingside
        this.board[fr][5] = this.board[fr][7];
        this.board[fr][7] = null;
      } else { // Queenside
        this.board[fr][3] = this.board[fr][0];
        this.board[fr][0] = null;
      }
    }

    this.board[tr][tf] = piece;
    this.board[fr][ff] = null;

    // Pawn promotion
    if (piece === 'P' && tr === 0) this.board[tr][tf] = 'Q';
    if (piece === 'p' && tr === 7) this.board[tr][tf] = 'q';

    // En passant tracking
    if (piece.toLowerCase() === 'p' && Math.abs(tr - fr) === 2) {
      this.enPassant = { r: (fr + tr) / 2, f: ff };
    } else {
      this.enPassant = null;
    }

    // Update castling rights
    if (piece === 'K') this.castling = this.castling.replace('K', '').replace('Q', '');
    if (piece === 'k') this.castling = this.castling.replace('k', '').replace('q', '');
    if (piece === 'R' && fr === 7 && ff === 0) this.castling = this.castling.replace('Q', '');
    if (piece === 'R' && fr === 7 && ff === 7) this.castling = this.castling.replace('K', '');
    if (piece === 'r' && fr === 0 && ff === 0) this.castling = this.castling.replace('q', '');
    if (piece === 'r' && fr === 0 && ff === 7) this.castling = this.castling.replace('k', '');

    this.lastMove = { fr, ff, tr, tf };
    this.turn = this.turn === 'w' ? 'b' : 'w';

    const from = this._toAlgebraic(fr, ff);
    const to = this._toAlgebraic(tr, tf);
    const fen = this._toFen();
    const move = { from, to, piece, fen, player: app.wallet?.address };
    this.moves.push(move);

    wsSend('game-move', { gameId: this.game.id, from, to, piece, fen, player: app.wallet?.address });

    // Check for checkmate
    if (this._isCheckmate()) {
      wsSend('game-checkmate', { gameId: this.game.id, winner: app.wallet?.address });
    }
  }

  onRemoteMove(data) {
    if (data.fen) {
      this.board = this._parseFen(data.fen).board || this._parseFen(data.fen);
      const parts = data.fen.split(' ');
      this.turn = parts[1] || 'w';
    } else if (data.from && data.to) {
      const fr = 8 - parseInt(data.from[1]);
      const ff = data.from.charCodeAt(0) - 97;
      const tr = 8 - parseInt(data.to[1]);
      const tf = data.to.charCodeAt(0) - 97;
      this.board[tr][tf] = this.board[fr][ff];
      this.board[fr][ff] = null;
      this.lastMove = { fr, ff, tr, tf };
      this.turn = this.turn === 'w' ? 'b' : 'w';
    }
    if (!this.moves.some(m => m.from === data.from && m.to === data.to)) {
      this.moves.push(data);
    }
    this.selected = null;
    this.legalMoves = [];
    this.render();
  }

  getMoves() { return this.moves; }

  _isMyPiece(piece) {
    if (this.myColor === 'white') return piece === piece.toUpperCase();
    return piece === piece.toLowerCase();
  }

  _isFriendly(piece) {
    if (this.turn === 'w') return piece === piece.toUpperCase();
    return piece === piece.toLowerCase();
  }

  _isEnemy(piece) {
    if (this.turn === 'w') return piece === piece.toLowerCase();
    return piece === piece.toUpperCase();
  }

  _getLegalMoves(r, f) {
    const piece = this.board[r][f];
    if (!piece) return [];
    const moves = [];
    const type = piece.toLowerCase();
    const isWhite = piece === piece.toUpperCase();

    const addMove = (tr, tf) => {
      if (tr < 0 || tr > 7 || tf < 0 || tf > 7) return false;
      const target = this.board[tr][tf];
      if (target && this._isFriendly(target)) return false;
      moves.push({ r: tr, f: tf });
      return !target;
    };

    if (type === 'p') {
      const dir = isWhite ? -1 : 1;
      const startRank = isWhite ? 6 : 1;
      if (!this.board[r + dir]?.[f]) {
        moves.push({ r: r + dir, f });
        if (r === startRank && !this.board[r + dir * 2]?.[f]) {
          moves.push({ r: r + dir * 2, f });
        }
      }
      for (const df of [-1, 1]) {
        const tr = r + dir, tf = f + df;
        if (tf < 0 || tf > 7) continue;
        if (this.board[tr]?.[tf] && this._isEnemy(this.board[tr][tf])) {
          moves.push({ r: tr, f: tf });
        }
        if (this.enPassant && this.enPassant.r === tr && this.enPassant.f === tf) {
          moves.push({ r: tr, f: tf });
        }
      }
    }

    if (type === 'n') {
      for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) addMove(r+dr, f+df);
    }

    if (type === 'k') {
      for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) addMove(r+dr, f+df);
      // Castling
      const rank = isWhite ? 7 : 0;
      if (r === rank && f === 4) {
        const ks = isWhite ? 'K' : 'k';
        const qs = isWhite ? 'Q' : 'q';
        if (this.castling.includes(ks) && !this.board[rank][5] && !this.board[rank][6]) {
          moves.push({ r: rank, f: 6 });
        }
        if (this.castling.includes(qs) && !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1]) {
          moves.push({ r: rank, f: 2 });
        }
      }
    }

    const addSliding = (dirs) => {
      for (const [dr, df] of dirs) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(r + dr * i, f + df * i)) break;
        }
      }
    };

    if (type === 'b') addSliding([[-1,-1],[-1,1],[1,-1],[1,1]]);
    if (type === 'r') addSliding([[-1,0],[1,0],[0,-1],[0,1]]);
    if (type === 'q') addSliding([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);

    return moves;
  }

  _isCheckmate() {
    // Simplified: check if opponent has any legal moves
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r][f];
        if (!piece) continue;
        const isCurrentTurn = (this.turn === 'w' && piece === piece.toUpperCase()) ||
                              (this.turn === 'b' && piece === piece.toLowerCase());
        if (isCurrentTurn) {
          const savedTurn = this.turn;
          if (this.turn === 'w') this.turn = 'w'; else this.turn = 'b';
          const moves = this._getLegalMoves(r, f);
          this.turn = savedTurn;
          if (moves.length > 0) return false;
        }
      }
    }
    return true;
  }

  _sq(r, f) { return String.fromCharCode(97 + f) + (8 - r); }
  _toAlgebraic(r, f) { return String.fromCharCode(97 + f) + (8 - r); }

  _parseFen(fen) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const c of rows[r]) {
        if (c >= '1' && c <= '8') { f += parseInt(c); }
        else { board[r][f] = c; f++; }
      }
    }
    this.turn = parts[1] || 'w';
    this.castling = parts[2] || '-';
    if (parts[3] && parts[3] !== '-') {
      const epF = parts[3].charCodeAt(0) - 97;
      const epR = 8 - parseInt(parts[3][1]);
      this.enPassant = { r: epR, f: epF };
    }
    return board;
  }

  _toFen() {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        if (this.board[r][f]) {
          if (empty > 0) { fen += empty; empty = 0; }
          fen += this.board[r][f];
        } else { empty++; }
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += '/';
    }
    fen += ' ' + this.turn;
    fen += ' ' + (this.castling || '-');
    fen += ' ' + (this.enPassant ? this._toAlgebraic(this.enPassant.r, this.enPassant.f) : '-');
    fen += ' 0 ' + Math.ceil(this.moves.length / 2 + 1);
    return fen;
  }
}

window.ChessUI = ChessUI;
