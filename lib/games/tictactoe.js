'use strict';

class TicTacToeEngine {
  constructor() {
    this.games = new Map();
  }

  startGame(gameId, players) {
    const state = {
      board: Array(9).fill(null),
      turn: 'X',
      players,
      winner: null,
      finished: false
    };
    this.games.set(gameId, state);
    return this.getPublicState(gameId);
  }

  applyMove(gameId, playerAddr, position) {
    const state = this.games.get(gameId);
    if (!state) return { error: 'Game not found' };
    if (state.finished) return { error: 'Game finished' };
    if (position < 0 || position > 8) return { error: 'Invalid position' };
    if (state.board[position] !== null) return { error: 'Cell occupied' };

    const player = state.players.find(p => p.addr === playerAddr);
    if (!player) return { error: 'Player not found' };
    if (player.symbol !== state.turn) return { error: 'Not your turn' };

    state.board[position] = player.symbol;

    const win = checkWin(state.board, player.symbol);
    if (win) {
      state.winner = playerAddr;
      state.finished = true;
      return { state: this.getPublicState(gameId), finished: true, winner: playerAddr, winLine: win };
    }

    const draw = state.board.every(c => c !== null);
    if (draw) {
      state.winner = 'draw';
      state.finished = true;
      return { state: this.getPublicState(gameId), finished: true, winner: 'draw' };
    }

    state.turn = state.turn === 'X' ? 'O' : 'X';
    return { state: this.getPublicState(gameId), finished: false };
  }

  getPublicState(gameId) {
    const state = this.games.get(gameId);
    if (!state) return null;
    const { players, ...pub } = state;
    return pub;
  }

  endGame(gameId) {
    this.games.delete(gameId);
  }
}

function checkWin(board, symbol) {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  for (const line of wins) {
    if (line.every(i => board[i] === symbol)) return line;
  }
  return null;
}

module.exports = { TicTacToeEngine, checkWin };
