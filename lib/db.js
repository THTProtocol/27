'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MARKETS_FILE = path.join(DATA_DIR, 'markets.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

class Database {
  constructor() {
    this.markets = new Map();
    this.games = new Map();
    this.users = new Map();
    this.config = {};
    this._ensureDir();
    this._load();
  }

  _ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _load() {
    this.markets = this._loadMap(MARKETS_FILE);
    this.games = this._loadMap(GAMES_FILE);
    this.users = this._loadMap(USERS_FILE);
    try {
      if (fs.existsSync(CONFIG_FILE)) this.config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch { this.config = {}; }
  }

  _loadMap(file) {
    try {
      if (!fs.existsSync(file)) return new Map();
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return new Map(Object.entries(data));
    } catch { return new Map(); }
  }

  _saveMap(file, map) {
    const obj = Object.fromEntries(map);
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  }

  _saveMarkets() { this._saveMap(MARKETS_FILE, this.markets); }
  _saveGames() { this._saveMap(GAMES_FILE, this.games); }
  _saveUsers() { this._saveMap(USERS_FILE, this.users); }
  _saveConfig() { fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2)); }

  // ─── Markets ──────────────────────────────────────────
  createMarket(market) {
    const id = market.id || this._genId('MKT');
    const record = {
      id,
      title: market.title || '',
      description: market.description || '',
      category: market.category || 'custom',
      outcomeA: market.outcomeA || 'Yes',
      outcomeB: market.outcomeB || 'No',
      marketMode: market.marketMode || 0x02,
      creatorAddr: market.creatorAddr || '',
      creatorPubkey: market.creatorPubkey || '',
      oraclePubkey: market.oraclePubkey || '',
      poolScriptHex: market.poolScriptHex || '',
      bondScriptHex: market.bondScriptHex || '',
      genesisTxId: market.genesisTxId || '',
      closeDaa: market.closeDaa || 0,
      oracleWindowDaa: market.oracleWindowDaa || 0,
      graceDaa: market.graceDaa || 0,
      timeoutDaa: market.timeoutDaa || 0,
      minPositionSompi: market.minPositionSompi || 100000000,
      poolAmountSompi: market.poolAmountSompi || 0,
      sideATotalSompi: 0,
      sideBTotalSompi: 0,
      positionCount: 0,
      status: 'open',
      outcome: null,
      resolutionTxId: null,
      receiptScripts: [],
      positions: [],
      createdAt: Date.now(),
      resolvedAt: null,
      customScript: market.customScript || null,
      oracleSource: market.oracleSource || null,
    };
    this.markets.set(id, record);
    this._saveMarkets();
    return record;
  }

  getMarket(id) { return this.markets.get(id) || null; }

  getAllMarkets() { return Array.from(this.markets.values()); }

  getMarketsByStatus(status) {
    return this.getAllMarkets().filter(m => m.status === status);
  }

  getMarketsByCategory(category) {
    return this.getAllMarkets().filter(m => m.category === category);
  }

  updateMarket(id, updates) {
    const m = this.markets.get(id);
    if (!m) return null;
    Object.assign(m, updates);
    this.markets.set(id, m);
    this._saveMarkets();
    return m;
  }

  updateMarketPool(id, amountSompi) {
    return this.updateMarket(id, { poolAmountSompi: amountSompi });
  }

  addPosition(marketId, position) {
    const m = this.markets.get(marketId);
    if (!m) return null;
    const pos = {
      id: this._genId('POS'),
      userAddr: position.userAddr,
      userPubkey: position.userPubkey,
      side: position.side,
      riskMode: position.riskMode || 0,
      amountSompi: position.amountSompi,
      receiptScriptHex: position.receiptScriptHex || '',
      txId: position.txId || '',
      createdAt: Date.now(),
      payout: null,
    };
    m.positions.push(pos);
    m.positionCount = m.positions.length;
    if (pos.receiptScriptHex) m.receiptScripts.push(pos.receiptScriptHex);
    if (pos.side === 1) m.sideATotalSompi += pos.amountSompi;
    else if (pos.side === 2) m.sideBTotalSompi += pos.amountSompi;
    this.markets.set(marketId, m);
    this._saveMarkets();
    return pos;
  }

  resolveMarket(id, outcome, resolutionTxId, payouts = []) {
    const m = this.markets.get(id);
    if (!m) return null;
    m.status = 'resolved';
    m.outcome = outcome;
    m.resolutionTxId = resolutionTxId;
    m.resolvedAt = Date.now();
    for (const p of payouts) {
      const pos = m.positions.find(x => x.userAddr === p.address || x.userPubkey === p.userPubkey);
      if (pos) pos.payout = p.amountSompi;
    }
    this.markets.set(id, m);
    this._saveMarkets();
    return m;
  }

  // ─── Games ────────────────────────────────────────────
  createGame(game) {
    const id = game.id || this._genId('GAME');
    const record = {
      id,
      type: game.type || 'chess',
      playerA: game.playerA || '',
      playerAPubkey: game.playerAPubkey || '',
      playerB: game.playerB || null,
      playerBPubkey: game.playerBPubkey || null,
      stakeSompi: game.stakeSompi || 0,
      escrowScriptHex: game.escrowScriptHex || '',
      escrowTxId: game.escrowTxId || '',
      timeoutDaa: game.timeoutDaa || 0,
      timeControl: game.timeControl || '10+0',
      status: 'waiting',
      winner: null,
      moves: [],
      fen: game.type === 'chess' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : null,
      boardState: null,
      settleTxId: null,
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
    };
    this.games.set(id, record);
    this._saveGames();
    return record;
  }

  getGame(id) { return this.games.get(id) || null; }

  getAllGames() { return Array.from(this.games.values()); }

  getGamesByStatus(status) {
    return this.getAllGames().filter(g => g.status === status);
  }

  updateGame(id, updates) {
    const g = this.games.get(id);
    if (!g) return null;
    Object.assign(g, updates);
    this.games.set(id, g);
    this._saveGames();
    return g;
  }

  addMove(gameId, move) {
    const g = this.games.get(gameId);
    if (!g) return null;
    g.moves.push({ ...move, timestamp: Date.now() });
    if (move.fen) g.fen = move.fen;
    if (move.boardState) g.boardState = move.boardState;
    this.games.set(gameId, g);
    this._saveGames();
    return g;
  }

  // ─── Users ────────────────────────────────────────────
  getOrCreateUser(addr) {
    if (this.users.has(addr)) return this.users.get(addr);
    const user = {
      addr,
      pubkey: null,
      totalBets: 0,
      totalWagered: 0,
      totalWon: 0,
      totalGames: 0,
      gamesWon: 0,
      marketsCreated: 0,
      joinedAt: Date.now(),
    };
    this.users.set(addr, user);
    this._saveUsers();
    return user;
  }

  updateUser(addr, updates) {
    const u = this.getOrCreateUser(addr);
    Object.assign(u, updates);
    this.users.set(addr, u);
    this._saveUsers();
    return u;
  }

  getUserPositions(addr) {
    const positions = [];
    for (const m of this.markets.values()) {
      for (const p of m.positions) {
        if (p.userAddr === addr) {
          positions.push({ ...p, marketId: m.id, marketTitle: m.title, marketStatus: m.status, marketOutcome: m.outcome });
        }
      }
    }
    return positions;
  }

  getUserGames(addr) {
    return this.getAllGames().filter(g => g.playerA === addr || g.playerB === addr);
  }

  getLeaderboard(limit = 20) {
    return Array.from(this.users.values())
      .sort((a, b) => b.totalWon - a.totalWon)
      .slice(0, limit);
  }

  // ─── Config ───────────────────────────────────────────
  getConfig(key) { return this.config[key]; }
  setConfig(key, value) { this.config[key] = value; this._saveConfig(); }

  getOracleKeys() { return this.config.oracleKeys || []; }
  setOracleKeys(keys) { this.config.oracleKeys = keys; this._saveConfig(); }

  getProtocolAddress() { return this.config.protocolAddress || ''; }
  setProtocolAddress(addr) { this.config.protocolAddress = addr; this._saveConfig(); }

  // ─── Utils ────────────────────────────────────────────
  _genId(prefix) {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return prefix + '-' + ts + '-' + rand;
  }

  getStats() {
    const markets = this.getAllMarkets();
    const games = this.getAllGames();
    return {
      totalMarkets: markets.length,
      openMarkets: markets.filter(m => m.status === 'open').length,
      resolvedMarkets: markets.filter(m => m.status === 'resolved').length,
      totalVolumeSompi: markets.reduce((s, m) => s + (m.poolAmountSompi || 0), 0),
      totalGames: games.length,
      activeGames: games.filter(g => g.status === 'playing').length,
      totalUsers: this.users.size,
    };
  }
}

module.exports = Database;
