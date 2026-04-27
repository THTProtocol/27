'use strict';

// ─── GameManager ───────────────────────────────────────
// Central dispatcher for all game types.
// Poker + Blackjack: server-authoritative (deck stays server-side).
// Chess / Checkers / Connect4: peer-validated via WS moves.

const { PokerEngine } = require('./games/poker');
const { BlackjackEngine } = require('./games/blackjack');

class GameManager {
  constructor(db, settlement, broadcastToGame) {
    this.db = db;
    this.settlement = settlement;
    this.broadcastToGame = broadcastToGame;
    this.poker = new PokerEngine();
    this.blackjack = new BlackjackEngine();
  }

  // Called when a game transitions from 'waiting' → 'playing'
  onGameStarted(game) {
    const g = game;
    if (g.type === 'poker') {
      const players = [
        { addr: g.playerA, name: g.playerAAlias || g.playerA.slice(-6) },
        { addr: g.playerB, name: g.playerBAlias || g.playerB.slice(-6) },
      ];
      const stakeKas = (g.stakeSompi || 1e8) / 1e8;
      const state = this.poker.startGame(g.id, players, stakeKas, g.options || {});
      this.db.updateGame(g.id, { boardState: JSON.stringify(state) });
      this.broadcastToGame(g.id, 'game-state-update', { gameId: g.id, state });
    } else if (g.type === 'blackjack') {
      const players = [
        { addr: g.playerA, name: g.playerAAlias || g.playerA.slice(-6) },
        ...(g.playerB ? [{ addr: g.playerB, name: g.playerBAlias || g.playerB.slice(-6) }] : []),
      ];
      const stakeKas = (g.stakeSompi || 1e8) / 1e8;
      const state = this.blackjack.startGame(g.id, players, stakeKas, g.options || {});
      this.db.updateGame(g.id, { boardState: JSON.stringify(state) });
      this.broadcastToGame(g.id, 'game-state-update', { gameId: g.id, state });
    }
    // Chess / Checkers / Connect4 don't need server-side initialization
  }

  // Called from WS handler: game-action event
  handleAction(gameId, playerAddr, action, data) {
    const game = this.db.getGame(gameId);
    if (!game || game.status !== 'playing') return { error: 'Game not active' };

    if (game.type === 'poker') {
      return this._handlePokerAction(game, playerAddr, action, data);
    } else if (game.type === 'blackjack') {
      return this._handleBlackjackAction(game, playerAddr, action, data);
    }
    return { error: 'game-action not applicable for game type: ' + game.type };
  }

  _handlePokerAction(game, playerAddr, action, data) {
    if (action === 'init') {
      // Re-init after reconnect
      const state = this.poker.getPublicState(game.id, playerAddr);
      if (!state) {
        // Game engine was restarted, re-create from boardState
        const stored = game.boardState ? JSON.parse(game.boardState) : null;
        if (!stored) return { error: 'No poker state available' };
        return { state: stored };
      }
      return { state };
    }

    const result = this.poker.applyAction(game.id, playerAddr, action, data?.amount);
    if (result.error) return result;

    const publicState = this.poker.getPublicState(game.id);
    this.db.updateGame(game.id, { boardState: JSON.stringify(publicState) });

    // Broadcast updated state to all in room
    this.broadcastToGame(game.id, 'game-state-update', { gameId: game.id, state: publicState });

    if (result.finished) {
      const winner = result.winner;
      this.db.updateGame(game.id, { winner, status: 'finished', endedAt: Date.now() });
      this.broadcastToGame(game.id, 'game-over', { gameId: game.id, winner, reason: result.reason });
      this.settlement.settleGame(game.id, winner).catch(e =>
        console.error('[GameManager] Poker settle error:', e.message));
      this.poker.endGame(game.id);
    }

    return { state: publicState, finished: result.finished };
  }

  _handleBlackjackAction(game, playerAddr, action, data) {
    if (action === 'init') {
      const state = this.blackjack.getPublicState(game.id);
      if (!state) {
        const stored = game.boardState ? JSON.parse(game.boardState) : null;
        if (!stored) return { error: 'No blackjack state available' };
        return { state: stored };
      }
      return { state };
    }

    if (action === 'skip-insurance') {
      const result = this.blackjack.confirmInsurancePhase(game.id);
      if (result.error) return result;
      this.broadcastToGame(game.id, 'game-state-update', { gameId: game.id, state: result.publicState });
      return { state: result.publicState };
    }

    if (action === 'new-round') {
      const result = this.blackjack.newRound(game.id);
      if (result.error) return result;
      this.db.updateGame(game.id, { boardState: JSON.stringify(result.publicState) });
      this.broadcastToGame(game.id, 'game-state-update', { gameId: game.id, state: result.publicState });
      return { state: result.publicState };
    }

    const result = this.blackjack.applyAction(game.id, playerAddr, action, data?.amount);
    if (result.error) return result;

    const { publicState, finished } = result;
    this.db.updateGame(game.id, { boardState: JSON.stringify(publicState) });
    this.broadcastToGame(game.id, 'game-state-update', { gameId: game.id, state: publicState });

    if (finished) {
      const winner = publicState.winner;
      this.db.updateGame(game.id, { winner, status: 'finished', endedAt: Date.now() });
      this.broadcastToGame(game.id, 'game-over', { gameId: game.id, winner, reason: 'blackjack-payout', results: publicState.results });
      if (winner !== 'dealer') {
        this.settlement.settleGame(game.id, winner).catch(e =>
          console.error('[GameManager] Blackjack settle error:', e.message));
      }
      this.blackjack.endGame(game.id);
    }

    return { state: publicState, finished };
  }

  // Re-hydrate engines from DB state on server restart
  rehydrateFromDB(games) {
    for (const g of games) {
      if (g.status !== 'playing') continue;
      if (!g.boardState) continue;
      // Engines can't be fully recovered from public state (no deck)
      // — mark these games as needing a new round / manual intervention
      console.warn('[GameManager] Game ' + g.id + ' (' + g.type + ') needs manual re-init after restart');
    }
  }
}

module.exports = GameManager;
