'use strict';

const EventEmitter = require('events');

class OracleDaemon extends EventEmitter {
  constructor(rpc, db, settlement, indexer, config = {}) {
    super();
    this.rpc = rpc;
    this.db = db;
    this.settlement = settlement;
    this.indexer = indexer;
    this.checkInterval = null;
    this.checkMs = config.checkMs || 10000;
    this.autoResolve = config.autoResolve !== false;
    this.oracleSources = new Map();
    this.pendingResolutions = new Map();
  }

  async start() {
    console.log('[ORACLE] Daemon started. Auto-resolve:', this.autoResolve);
    this._registerDefaultSources();

    this.checkInterval = setInterval(() => {
      this._checkMarkets().catch(e => console.error('[ORACLE] Check error:', e.message));
      this._checkTimeouts().catch(e => console.error('[ORACLE] Timeout check error:', e.message));
      this._checkGames().catch(e => console.error('[ORACLE] Game check error:', e.message));
    }, this.checkMs);

    this.rpc.on('notifyVirtualDaaScoreChangedNotification', (params) => {
      const score = parseInt(params?.virtualDaaScore || '0');
      this.emit('daa-tick', score);
    });
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  registerOracleSource(name, handler) {
    this.oracleSources.set(name, handler);
    console.log('[ORACLE] Registered source:', name);
  }

  _registerDefaultSources() {
    this.registerOracleSource('manual', async (market) => {
      return null;
    });

    this.registerOracleSource('price-api', async (market) => {
      if (!market.oracleSource || market.oracleSource.type !== 'price') return null;
      try {
        const config = market.oracleSource;
        const response = await fetch(config.apiUrl);
        const data = await response.json();
        const price = this._extractPrice(data, config.pricePath);
        if (price === null) return null;

        const threshold = config.threshold;
        const condition = config.condition || 'above';

        if (condition === 'above' && price >= threshold) return 1;
        if (condition === 'above' && price < threshold) return 2;
        if (condition === 'below' && price <= threshold) return 1;
        if (condition === 'below' && price > threshold) return 2;
        return null;
      } catch (e) {
        console.error('[ORACLE] Price API error:', e.message);
        return null;
      }
    });

    this.registerOracleSource('time-based', async (market) => {
      if (!market.oracleSource || market.oracleSource.type !== 'time') return null;
      try {
        const currentDaa = await this.rpc.getCurrentDaaScore();
        if (currentDaa >= market.closeDaa) {
          return market.oracleSource.defaultOutcome || 1;
        }
        return null;
      } catch { return null; }
    });

    this.registerOracleSource('sports-api', async (market) => {
      if (!market.oracleSource || market.oracleSource.type !== 'sports') return null;
      try {
        const config = market.oracleSource;
        const response = await fetch(config.apiUrl);
        const data = await response.json();
        const status = this._extractField(data, config.statusPath);
        if (status !== 'final' && status !== 'finished' && status !== 'FT') return null;

        const scoreHome = parseInt(this._extractField(data, config.homeScorePath));
        const scoreAway = parseInt(this._extractField(data, config.awayScorePath));

        if (config.pickTeam === 'home') return scoreHome > scoreAway ? 1 : 2;
        if (config.pickTeam === 'away') return scoreAway > scoreHome ? 1 : 2;
        return null;
      } catch (e) {
        console.error('[ORACLE] Sports API error:', e.message);
        return null;
      }
    });
  }

  async _checkMarkets() {
    if (!this.autoResolve) return;
    const openMarkets = this.db.getMarketsByStatus('open');
    const currentDaa = await this.rpc.getCurrentDaaScore();

    for (const market of openMarkets) {
      if (currentDaa < market.closeDaa) continue;
      if (this.pendingResolutions.has(market.id)) continue;

      const sourceName = market.oracleSource?.type || 'manual';
      const handler = this.oracleSources.get(sourceName) || this.oracleSources.get('manual');

      try {
        const outcome = await handler(market);
        if (outcome !== null) {
          console.log('[ORACLE] Auto-resolving market', market.id, 'outcome:', outcome);
          this.pendingResolutions.set(market.id, true);
          this.emit('resolving', { marketId: market.id, outcome });

          // In production: collect 2-of-3 oracle signatures
          const oracleSig = this.oracleSigner 
            ? Buffer.concat([this.oracleSigner.sign(Buffer.from(market.id, "utf8"), 0), this.oracleSigner.sign(Buffer.from(market.id, "utf8"), 1)]).toString("hex")
            : "placeholder_needs_real_multisig";

          try {
            const result = await this.settlement.resolveMarket(market.id, outcome, oracleSig);
            this.emit('resolved', { marketId: market.id, outcome, txId: result.txId });
          } catch (e) {
            console.error('[ORACLE] Resolution failed:', market.id, e.message);
            this.emit('resolution-failed', { marketId: market.id, error: e.message });
          }
          this.pendingResolutions.delete(market.id);
        }
      } catch (e) {
        console.error('[ORACLE] Source check failed:', market.id, e.message);
      }
    }
  }

  async _checkTimeouts() {
    const openMarkets = this.db.getMarketsByStatus('open');
    const currentDaa = await this.rpc.getCurrentDaaScore();

    for (const market of openMarkets) {
      if (currentDaa < market.timeoutDaa) continue;
      if (this.pendingResolutions.has(market.id)) continue;

      console.log('[ORACLE] Market', market.id, 'timed out. Triggering refund.');
      this.pendingResolutions.set(market.id, true);
      this.emit('timeout', { marketId: market.id });

      try {
        const result = await this.settlement.timeoutRefund(market.id);
        this.emit('timeout-refunded', { marketId: market.id, txId: result.txId });
      } catch (e) {
        console.error('[ORACLE] Timeout refund failed:', market.id, e.message);
      }
      this.pendingResolutions.delete(market.id);
    }
  }

  async _checkGames() {
    const activeGames = this.db.getGamesByStatus('playing');
    const currentDaa = await this.rpc.getCurrentDaaScore();

    for (const game of activeGames) {
      if (game.timeoutDaa && currentDaa >= game.timeoutDaa) {
        console.log('[ORACLE] Game', game.id, 'timed out.');
        this.emit('game-timeout', { gameId: game.id });
      }

      if (game.winner && !game.settleTxId) {
        try {
          const result = await this.settlement.settleGame(game.id, game.winner);
          this.emit('game-settled', { gameId: game.id, txId: result.txId });
        } catch (e) {
          console.error('[ORACLE] Game settle failed:', game.id, e.message);
        }
      }
    }
  }

  async manualResolve(marketId, outcome) {
    console.log('[ORACLE] Manual resolution:', marketId, 'outcome:', outcome);
    const oracleSig = 'manual_resolution_needs_multisig';
    const result = await this.settlement.resolveMarket(marketId, outcome, oracleSig);
    return result;
  }

  _extractPrice(data, pricePath) {
    try {
      const parts = pricePath.split('.');
      let val = data;
      for (const p of parts) {
        if (p.includes('[')) {
          const [key, idx] = p.split('[');
          val = val[key][parseInt(idx)];
        } else {
          val = val[p];
        }
      }
      return typeof val === 'number' ? val : parseFloat(val);
    } catch { return null; }
  }

  _extractField(data, fieldPath) {
    try {
      const parts = fieldPath.split('.');
      let val = data;
      for (const p of parts) val = val[p];
      return val;
    } catch { return null; }
  }

  getStatus() {
    return {
      running: !!this.checkInterval,
      autoResolve: this.autoResolve,
      registeredSources: Array.from(this.oracleSources.keys()),
      pendingCount: this.pendingResolutions.size,
    };
  }
}

module.exports = OracleDaemon;
