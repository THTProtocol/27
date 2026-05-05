'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const https = require('https');
const fs = require('fs');

const KaspaRPC = require('./lib/kaspa-rpc');
const TxBuilder = require('./lib/tx-builder');
const Database = require('./lib/db');
const UtxoIndexer = require('./lib/utxo-indexer');
const SettlementEngine = require('./lib/settlement');
const OracleDaemon = require('./lib/oracle-daemon');
const ScriptValidator = require('./lib/script-validator');
const { getOdds, estimatePayout, FEE_SCHEDULE, calculateGamePayout } = require('./lib/fees');
const GameManager = require('./lib/game-manager');
const { signTx, toRestTx } = require('./lib/kaspa-signer');
const { TicTacToeEngine } = require('./lib/games/tictactoe');

const PORT = process.env.PORT || 3000;
const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://hightable420.web.app,https://hightable420.firebaseapp.com').split(',');
const KASPA_RPC_URL = process.env.KASPA_WRPC_URL || 'ws://127.0.0.1:16210';
const MAINNET_API = process.env.MAINNET_API || 'https://api.kaspa.org';
const REST_URL = process.env.KASPA_REST_URL || 'https://api-tn12.kaspa.org';
const SOMPI_PER_KAS = 100000000;
const DUST_SOMPI = 300;
const TX_FEE_SOMPI = 30000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// ─── CORS ──────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.railway.app') || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/config', (req, res) => {
  const WS_HOST = process.env.HTP_WS_HOST || '178.105.76.81';
  res.json({ wsUrl: 'wss://' + WS_HOST + '/ws', network: process.env.HTP_NETWORK || 'tn12', version: '9.0.0' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

app.use((req, res, next) => {
  if (/\.(wasm|js|css|json|map|png|jpe?g|svg|ico|gif|webp)$/i.test(req.path)) {
    return res.status(404).send('Not found: ' + req.path);
  }
  next();
});

// ─── REST Helpers ──────────────────────────────────
function restGet(path) {
  return new Promise((resolve, reject) => {
    https.get(REST_URL + path, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', reject);
  });
}

function restPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(REST_URL + path);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
        else { try { resolve(JSON.parse(d)); } catch { resolve(d); } }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// addrToSpk is unreliable — always use real scriptPubKey from on-chain UTXOs.
// See kaspa-signer.js for the canonical approach.

// ─── Server Wallet ─────────────────────────────────
let serverWallet = null;
function getServerWallet() {
  if (serverWallet) return serverWallet;
  try {
    serverWallet = JSON.parse(fs.readFileSync('/root/htp/.e2e-wallet.json'));
    console.log('[WALLET] Loaded server wallet:', serverWallet.address);
  } catch(e) {
    console.warn('[WALLET] No .e2e-wallet.json found — some endpoints need privkey in body');
  }
  return serverWallet;
}

// ─── Initialize Services ───────────────────────────
const db = new Database();
const rpc = new KaspaRPC(KASPA_RPC_URL);
const validator = new ScriptValidator();

const txBuilder = new TxBuilder(rpc, {
  protocolSpkHex: db.getConfig('protocolSpkHex') || '',
  protocolFeeBps: 200,
  oraclePubkeys: [],
  multisigThreshold: 2,
});

const indexer = new UtxoIndexer(rpc, db);
const settlement = new SettlementEngine(txBuilder, rpc, db, indexer, null);
const oracle = new OracleDaemon(rpc, db, settlement, indexer);

// ─── WebSocket Clients ─────────────────────────────
const clients = new Set();
const gameRooms = new Map();

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function broadcastToGame(gameId, event, data) {
  const msg = JSON.stringify({ event, data });
  const room = gameRooms.get(gameId);
  if (!room) return;
  for (const ws of room) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const gameManager = new GameManager(db, settlement, broadcastToGame);
const tictactoe = new TicTacToeEngine();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.gameRooms = new Set();

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleWsMessage(ws, msg);
    } catch {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    for (const gid of ws.gameRooms) {
      const room = gameRooms.get(gid);
      if (room) { room.delete(ws); if (room.size === 0) gameRooms.delete(gid); }
    }
  });
});

function handleWsMessage(ws, msg) {
  switch (msg.type) {
    case 'join-game': {
      const gid = msg.gameId;
      if (!gameRooms.has(gid)) gameRooms.set(gid, new Set());
      gameRooms.get(gid).add(ws);
      ws.gameRooms.add(gid);
      ws.send(JSON.stringify({ event: 'joined-game', data: { gameId: gid } }));
      break;
    }
    case 'leave-game': {
      const gid = msg.gameId;
      const room = gameRooms.get(gid);
      if (room) { room.delete(ws); if (room.size === 0) gameRooms.delete(gid); }
      ws.gameRooms.delete(gid);
      break;
    }
    case 'game-move': {
      const game = db.getGame(msg.gameId);
      if (!game || game.status !== 'playing') return;
      db.addMove(msg.gameId, { from: msg.from, to: msg.to, piece: msg.piece, fen: msg.fen, boardState: msg.boardState, player: msg.player });
      broadcastToGame(msg.gameId, 'game-move', { gameId: msg.gameId, from: msg.from, to: msg.to, piece: msg.piece, fen: msg.fen, boardState: msg.boardState, player: msg.player });
      break;
    }
    case 'game-action': {
      const game = db.getGame(msg.gameId);
      if (!game || game.status !== 'playing') return;
      if (game.type === 'poker' || game.type === 'blackjack') {
        const result = gameManager.handleAction(msg.gameId, msg.player, msg.action, msg.data);
        if (result && result.error) {
          ws.send(JSON.stringify({ event: 'action-error', data: { gameId: msg.gameId, error: result.error } }));
        } else if (result && result.finished) {
          db.updateGame(msg.gameId, { status: 'finished', winner: result.winner, endedAt: Date.now() });
          broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: result.winner, reason: result.reason || 'game-over' });
        }
      } else if (game.type === 'tictactoe') {
        const result = tictactoe.applyMove(msg.gameId, msg.player, msg.data?.position);
        if (result.error) {
          ws.send(JSON.stringify({ event: 'action-error', data: { gameId: msg.gameId, error: result.error } }));
        } else {
          broadcastToGame(msg.gameId, 'game-state-update', { gameId: msg.gameId, state: result.state });
          if (result.finished) {
            db.updateGame(msg.gameId, { status: 'finished', winner: result.winner, endedAt: Date.now() });
            broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: result.winner, reason: 'checkmate' });
          }
        }
      } else {
        db.addMove(msg.gameId, { action: msg.action, data: msg.data, player: msg.player });
        broadcastToGame(msg.gameId, 'game-action', { gameId: msg.gameId, action: msg.action, data: msg.data, player: msg.player });
      }
      break;
    }
    case 'game-state-update': {
      const game = db.getGame(msg.gameId);
      if (!game || game.status !== 'playing') return;
      db.updateGame(msg.gameId, { boardState: msg.state });
      broadcastToGame(msg.gameId, 'game-state-update', { gameId: msg.gameId, state: msg.state });
      break;
    }
    case 'game-resign': {
      const game = db.getGame(msg.gameId);
      if (!game || game.status !== 'playing') return;
      const winner = msg.player === game.playerA ? game.playerB : game.playerA;
      db.updateGame(msg.gameId, { winner, status: 'finished', endedAt: Date.now() });
      broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner, reason: 'resignation' });
      break;
    }
    case 'game-draw-offer': {
      broadcastToGame(msg.gameId, 'draw-offered', { gameId: msg.gameId, from: msg.player });
      break;
    }
    case 'game-draw-accept': {
      db.updateGame(msg.gameId, { winner: 'draw', status: 'finished', endedAt: Date.now() });
      broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: 'draw', reason: 'agreement' });
      break;
    }
    case 'game-checkmate': {
      db.updateGame(msg.gameId, { winner: msg.winner, status: 'finished', endedAt: Date.now() });
      broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: msg.winner, reason: 'checkmate' });
      break;
    }
  }
}

// ─── Indexer Events → WS ──────────────────────────
indexer.on('pool-updated', (data) => broadcast('pool-updated', data));
indexer.on('receipts-updated', (data) => broadcast('receipts-updated', data));
indexer.on('escrow-funded', (data) => broadcast('escrow-funded', data));
indexer.on('escrow-spent', (data) => broadcast('escrow-spent', data));
oracle.on('resolved', (data) => broadcast('market-resolved', data));
oracle.on('timeout-refunded', (data) => broadcast('market-refunded', data));
oracle.on('game-settled', (data) => broadcast('game-settled', data));

// ─── REST API: Markets (unchanged) ────────────────
app.get('/api/markets', (req, res) => {
  const { status, category } = req.query;
  let markets = db.getAllMarkets();
  if (status) markets = markets.filter(m => m.status === status);
  if (category) markets = markets.filter(m => m.category === category);
  markets = markets.map(m => ({ ...m, odds: getOdds(m.sideATotalSompi, m.sideBTotalSompi) }));
  res.json(markets);
});

app.get('/api/markets/:id', (req, res) => {
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'Market not found' });
  m.odds = getOdds(m.sideATotalSompi, m.sideBTotalSompi);
  m.positions = m.positions.map(p => ({ ...p, amountKas: p.amountSompi / 1e8 }));
  res.json(m);
});

app.post('/api/markets', async (req, res) => {
  try {
    const { title, description, category, outcomeA, outcomeB, marketMode,
            creatorAddr, creatorPubkey, closeDaaOffset, oracleWindowHours,
            graceHours, minPositionKas, oracleSource, customScript } = req.body;
    const currentDaa = await rpc.getCurrentDaaScore();
    const closeDaa = currentDaa + rpc.hoursToDAATicks(closeDaaOffset || 24);
    const oracleWindowDaa = rpc.hoursToDAATicks(oracleWindowHours || 6);
    const graceDaa = rpc.hoursToDAATicks(graceHours || 24);
    const oraclePubkey = '';
    if (customScript) {
      const validation = validator.validateCustomScript(customScript);
      if (!validation.valid) return res.status(400).json({ error: 'Invalid custom script', details: validation.errors });
    }
    const creatorUtxos = await rpc.getUtxosByAddress(creatorAddr);
    const utxos = creatorUtxos.entries || creatorUtxos || [];
    const genesis = txBuilder.buildMarketGenesisTx({
      creatorAddr, creatorPubkey, creatorUtxos: utxos, oraclePubkey,
      closeDaa, oracleWindowDaa, graceDaa,
      minPositionSompi: (minPositionKas || 1) * 1e8, marketMode: marketMode || 2,
    });
    const market = db.createMarket({
      title, description, category, outcomeA, outcomeB, marketMode: marketMode || 2,
      creatorAddr, creatorPubkey, oraclePubkey,
      poolScriptHex: genesis.poolScript.hex, bondScriptHex: genesis.bondScript.hex,
      closeDaa, oracleWindowDaa, graceDaa, timeoutDaa: genesis.timeoutDaa,
      minPositionSompi: (minPositionKas || 1) * 1e8, poolAmountSompi: 1e8, oracleSource, customScript,
    });
    indexer.trackMarket(market.id, genesis.poolScript.hex, genesis.bondScript.hex);
    const user = db.getOrCreateUser(creatorAddr);
    db.updateUser(creatorAddr, { marketsCreated: user.marketsCreated + 1, pubkey: creatorPubkey });
    broadcast('market-created', { market });
    res.json({ market, pskt: genesis.pskt });
  } catch (e) {
    console.error('[API] Create market error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/markets/:id/position', async (req, res) => {
  try {
    const market = db.getMarket(req.params.id);
    if (!market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'open') return res.status(400).json({ error: 'Market not open' });
    const { userAddr, userPubkey, side, riskMode, amountKas } = req.body;
    const amountSompi = Math.floor(amountKas * 1e8);
    if (amountSompi < market.minPositionSompi)
      return res.status(400).json({ error: 'Below minimum position: ' + (market.minPositionSompi / 1e8) + ' KAS' });
    const utxos = indexer.getMarketUtxos(market.id);
    const poolUtxo = utxos?.poolUtxo || { outpoint: { transactionId: market.genesisTxId, index: 0 },
      utxoEntry: { amount: market.poolAmountSompi.toString(), scriptPublicKey: { script: market.poolScriptHex } } };
    const userUtxos = await rpc.getUtxosByAddress(userAddr);
    const userEntries = userUtxos.entries || userUtxos || [];
    const posTx = txBuilder.buildPositionTx({
      poolUtxo, userAddr, userPubkey, userUtxos: userEntries,
      side, riskMode: riskMode || 0, amountSompi,
      oraclePubkey: market.oraclePubkey, timeoutDaa: market.timeoutDaa,
    });
    const pos = db.addPosition(market.id, {
      userAddr, userPubkey, side, riskMode: riskMode || 0,
      amountSompi, receiptScriptHex: posTx.receiptScript.hex,
    });
    const user = db.getOrCreateUser(userAddr);
    db.updateUser(userAddr, {
      totalBets: user.totalBets + 1, totalWagered: user.totalWagered + amountSompi, pubkey: userPubkey,
    });
    const updated = db.getMarket(market.id);
    broadcast('position-taken', { marketId: market.id, position: pos, odds: getOdds(updated.sideATotalSompi, updated.sideBTotalSompi) });
    res.json({ position: pos, pskt: posTx.pskt, estimatedPayout: estimatePayout(amountSompi, side, updated.sideATotalSompi, updated.sideBTotalSompi, riskMode || 0) });
  } catch (e) {
    console.error('[API] Position error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/markets/:id/build-position', async (req, res) => {
  const { address, side, amountKAS } = req.body;
  if (!address || !side || !amountKAS) return res.status(400).json({ error: 'address, side, amountKAS required' });
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'market not found' });
  if (m.status !== 'open') return res.status(400).json({ error: 'market not open' });
  try {
    const amountSompi = Math.round(amountKAS * 1e8);
    const utxoResult = await rpc.getUtxosByAddress(address);
    const entries = utxoResult.entries || utxoResult || [];
    let available = 0;
    const selected = [];
    for (const e of entries) {
      const amt = parseInt(e.utxoEntry ? e.utxoEntry.amount : e.amount || '0', 10);
      if (amt <= 0) continue;
      selected.push({
        transactionId: e.outpoint ? e.outpoint.transactionId : e.transactionId,
        index: e.outpoint ? e.outpoint.index : e.index, amount: amt,
        scriptPublicKey: e.utxoEntry ? e.utxoEntry.scriptPublicKey : e.scriptPublicKey,
      });
      available += amt;
      if (available >= amountSompi + 5000) break;
    }
    if (available < amountSompi) return res.status(400).json({ error: 'insufficient balance', required: amountSompi, available });
    const odds = getOdds((m.sideATotalSompi||0)+(side==='A'?amountSompi:0), (m.sideBTotalSompi||0)+(side==='B'?amountSompi:0));
    res.json({ status: 'unsigned', market: { id: m.id, title: m.title, side },
      position: { address, side, amountSompi, amountKAS, estimatedOdds: side==='A' ? odds.oddsA : odds.oddsB },
      inputs: selected, fee: 5000, change: available - amountSompi - 5000 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/markets/:id/confirm-position', (req, res) => {
  const { address, side, amountSompi, transactionId } = req.body;
  if (!address || !side || !amountSompi || !transactionId) return res.status(400).json({ error: 'missing fields' });
  const evt = db.getMarket(req.params.id);
  if (!evt) return res.status(404).json({ error: 'market not found' });
  const posId = require('crypto').randomUUID().replace(/-/g,'').substring(0,16);
  db.addPosition(evt.id, { userAddr: address, side: side===evt.outcomeA?1:2, amountSompi, txId: transactionId });
  broadcast('position-confirmed', { eventId: evt.id, side, amount: amountSompi, txId: transactionId });
  res.json({ positionId: posId, eventId: evt.id, address, side, amountSompi, transactionId });
});

app.post('/api/markets/:id/resolve', async (req, res) => {
  try {
    const { outcome, oracleSig } = req.body;
    const result = await settlement.resolveMarket(req.params.id, outcome, oracleSig || 'manual');
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/markets/:id/odds', (req, res) => {
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const odds = getOdds(m.sideATotalSompi, m.sideBTotalSompi);
  const total = (m.sideATotalSompi || 0) + (m.sideBTotalSompi || 0);
  res.json({ marketId: m.id, totalPool: total, totalPoolKAS: total / 1e8,
    outcomeA: { name: m.outcomeA || 'A', pool: m.sideATotalSompi || 0, odds: odds.oddsA },
    outcomeB: { name: m.outcomeB || 'B', pool: m.sideBTotalSompi || 0, odds: odds.oddsB } });
});

app.get('/api/markets/:id/estimate', (req, res) => {
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { side, amount, riskMode } = req.query;
  const est = estimatePayout(parseInt(amount)||1e8, parseInt(side)||1, m.sideATotalSompi, m.sideBTotalSompi, parseInt(riskMode)||0);
  res.json({ estimatedPayout: est, estimatedPayoutKas: est / 1e8 });
});

// ─── Node Info ─────────────────────────────────────
app.get('/api/node/info', async (req, res) => {
  try {
    const info = await rpc.getInfo();
    const dag = await rpc.getBlockDagInfo();
    res.json({
      synced: !!info.isSynced, utxoIndexed: !!info.isUtxoIndexed,
      mempoolSize: info.mempoolSize || 0, serverVersion: info.serverVersion || '',
      networkId: dag.networkId || dag.network || 'testnet-12',
      blockCount: dag.blockCount || dag.headerCount || 0,
      virtualDaaScore: dag.virtualDaaScore || '0',
      tipHashes: dag.tipHashes || dag.tips || [],
      difficulty: dag.difficulty || 0,
    });
  } catch (e) { res.status(503).json({ error: 'Node unavailable', detail: e.message }); }
});

app.get('/api/node/balance/:addr', async (req, res) => {
  try {
    const result = await rpc.getBalanceByAddress(req.params.addr);
    const bal = parseInt(result.balance || result || '0', 10);
    res.json({ address: req.params.addr, balance: bal, balanceKAS: bal / 1e8 });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/node/utxos/:addr', async (req, res) => {
  try {
    const result = await rpc.getUtxosByAddress(req.params.addr);
    const entries = result.entries || result || [];
    res.json({ address: req.params.addr, count: entries.length, entries });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/tx/submit', async (req, res) => {
  try {
    const { transaction } = req.body;
    if (!transaction) return res.status(400).json({ error: 'transaction required' });
    const result = await rpc.submitTransaction(transaction);
    res.json({ success: true, transactionId: result.transactionId || result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════
//  GAME ENDPOINTS — Rust signer wired
// ═══════════════════════════════════════════════════

app.get('/api/games/active', (req, res) => {
  const all = db.getAllGames();
  res.json(all.filter(g => g.status === 'waiting'));
});

app.get('/api/games', (req, res) => {
  const { status, type } = req.query;
  let games = db.getAllGames();
  if (status) games = games.filter(g => g.status === status);
  if (type) games = games.filter(g => g.type === type);
  res.json(games);
});

app.get('/api/games/:id', (req, res) => {
  const g = db.getGame(req.params.id);
  if (!g) return res.status(404).json({ error: 'Game not found' });
  res.json(g);
});

// POST /api/games — Create game + sign & broadcast escrow TX
app.post('/api/games', async (req, res) => {
  try {
    const { type, playerA, stakeKas, privkey } = req.body;
    const stakeSompi = Math.floor((stakeKas || 1) * SOMPI_PER_KAS);
    if (stakeSompi < 100000) return res.status(400).json({ error: 'Min stake 0.001 KAS' });

    // Use provided privkey or server wallet
    const pk = privkey || (getServerWallet() ? getServerWallet().privkey : null);
    const addr = playerA || (getServerWallet() ? getServerWallet().address : null);
    if (!pk || !addr) return res.status(400).json({ error: 'privkey + playerA required' });

    // Get UTXOs
    const utxoResult = await restGet('/addresses/' + addr + '/utxos');
    const allUtxos = (Array.isArray(utxoResult) ? utxoResult : []).sort((a,b) =>
      parseInt(b.utxoEntry?.amount || '0') - parseInt(a.utxoEntry?.amount || '0'));

    // Select UTXOs
    const needed = stakeSompi + TX_FEE_SOMPI;
    let consumed = 0, selected = [];
    for (const u of allUtxos) {
      selected.push(u);
      consumed += parseInt(u.utxoEntry?.amount || '0');
      if (consumed >= needed) break;
    }
    if (consumed < needed) return res.status(400).json({ error: 'Insufficient balance', have: consumed, need: needed });

    const change = consumed - stakeSompi - TX_FEE_SOMPI;

    // Use real scriptPubKey from first UTXO (NOT reconstructed from bech32)
    const spk = selected[0]?.utxoEntry?.scriptPublicKey?.scriptPublicKey
             || selected[0]?.scriptPublicKey?.script
             || selected[0]?.scriptPublicKey?.scriptPublicKey
             || '';
    if (!spk) return res.status(500).json({ error: 'Could not determine scriptPubKey from UTXOs' });

    // Build unsigned escrow TX (P2PK to self — standard escrow)
    const unsignedTx = {
      version: 0,
      inputs: selected.map(u => ({
        previousOutpoint: {
          transactionId: u.outpoint?.transactionId || u.transactionId,
          index: u.outpoint?.index ?? u.index ?? 0
        },
        signatureScript: '',
        sequence: '0',
        sigOpCount: 1
      })),
      outputs: [{ value: String(stakeSompi), scriptPublicKey: { version: 0, script: spk } }],
      lockTime: '0',
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: '0',
      payload: ''
    };
    if (change > DUST_SOMPI) unsignedTx.outputs.push({ value: String(change), scriptPublicKey: { version: 0, script: spk } });

    // Sign with Rust signer
    console.log('[GAME] Signing escrow TX with Rust signer...');
    const signed = signTx(unsignedTx, pk, selected);
    const rawTx = toRestTx(signed);

    // Broadcast
    const result = await restPost('/transactions', { transaction: rawTx, allowOrphan: true });
    const escrowTxId = result.transactionId || result.txid;

    // Store game
    const game = db.createGame({
      type: type || 'tictactoe',
      playerA: addr,
      stakeSompi,
      escrowTxId,
      escrowScriptHex: spk,
    });

    // Init game engine
    if (type === 'tictactoe') {
      tictactoe.startGame(game.id, [{ addr, symbol: 'X' }, { addr: 'opponent', symbol: 'O' }]);
      db.updateGame(game.id, { boardState: JSON.stringify(tictactoe.getPublicState(game.id)) });
    }

    broadcast('game-created', { game });
    console.log('[GAME] Created', game.id, '| Escrow TX:', escrowTxId);
    res.json({ game, escrowTxId, explorerUrl: 'https://explorer-tn12.kaspa.org/txs/' + escrowTxId });
  } catch (e) {
    console.error('[API] Create game error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:id/move — TicTacToe move via REST
app.post('/api/games/:id/move', (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'playing') return res.status(400).json({ error: 'Game not playing' });

    const { position, player } = req.body;

    if (game.type === 'tictactoe') {
      const result = tictactoe.applyMove(game.id, player, position);
      if (result.error) return res.status(400).json(result);
      if (result.finished) {
        db.updateGame(game.id, { status: 'finished', winner: result.winner, endedAt: Date.now() });
      }
      db.updateGame(game.id, { boardState: JSON.stringify(result.state) });
      broadcastToGame(game.id, 'game-state-update', { gameId: game.id, state: result.state });
      if (result.finished) {
        broadcastToGame(game.id, 'game-over', { gameId: game.id, winner: result.winner, reason: 'win' });
      }
      return res.json(result);
    }

    // Blackjack / Poker actions via GameManager
    if (game.type === 'blackjack' || game.type === 'poker') {
      const result = gameManager.handleAction(game.id, player, req.body.action, req.body.data || {});
      if (result.error) return res.status(400).json(result);
      if (result.finished) {
        db.updateGame(game.id, { status: 'finished', winner: result.winner, endedAt: Date.now() });
        broadcastToGame(game.id, 'game-over', { gameId: game.id, winner: result.winner, reason: result.reason || 'game-over' });
      }
      return res.json(result);
    }

    // Generic move store for other game types
    game.moves = game.moves || [];
    game.moves.push({ position, player, action: req.body.action, timestamp: Date.now() });
    db.updateGame(game.id, { moves: game.moves });
    broadcastToGame(game.id, 'game-move', { gameId: game.id, position, player });
    res.json({ game });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:id/settle — Sign & broadcast payout TX
app.post('/api/games/:id/settle', async (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.settleTxId) return res.json({ alreadySettled: true, txId: game.settleTxId });
    if (!game.winner || game.winner === 'opponent') return res.status(400).json({ error: 'No winner determined' });

    const { privkey } = req.body;
    const pk = privkey || (getServerWallet() ? getServerWallet().privkey : null);
    const addr = game.playerA;
    if (!pk) return res.status(400).json({ error: 'privkey required' });

    // Find escrow UTXO by scanning for a UTXO with the right amount
    const utxoResult = await restGet('/addresses/' + addr + '/utxos');
    const allUtxos = Array.isArray(utxoResult) ? utxoResult : [];
    const stakeSompi = game.stakeSompi || SOMPI_PER_KAS;
    const escrowUtxo = allUtxos.find(u => {
      const amt = parseInt(u.utxoEntry?.amount || '0');
      return amt >= stakeSompi - 5000 && amt <= stakeSompi + 5000;
    });

    if (!escrowUtxo) {
      // Try the escrow TXID
      const txResult = await restGet('/transactions/' + (game.escrowTxId || ''));
      if (txResult && txResult.outputs) {
        for (let i = 0; i < txResult.outputs.length; i++) {
          const amt = parseInt(txResult.outputs[i].value || txResult.outputs[i].amount || '0');
          if (amt >= stakeSompi - 5000 && amt <= stakeSompi + 5000) {
            return res.status(202).json({
              status: 'waiting_confirmation',
              message: 'Escrow TX pending confirmation. Retry in 30s.',
              escrowTxId: game.escrowTxId
            });
          }
        }
      }
      return res.status(400).json({ error: 'Escrow UTXO not found on chain' });
    }

    const escrowAmt = parseInt(escrowUtxo.utxoEntry?.amount || '0');
    const protocolFee = Math.floor(escrowAmt * GAME_FEE_BPS / 10000);
    const payout = escrowAmt - protocolFee - TX_FEE_SOMPI;
    if (payout <= DUST_SOMPI) return res.status(400).json({ error: 'Payout too small after fees' });

    // Use real SPK from the escrow UTXO
    const winnerSpk = escrowUtxo?.utxoEntry?.scriptPublicKey?.scriptPublicKey
                   || escrowUtxo?.scriptPublicKey?.script
                   || escrowUtxo?.scriptPublicKey?.scriptPublicKey
                   || '';
    const protocolAddr = 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
    // Protocol SPK hardcoded (protocol address doesn't change between games)
    const protocolSpk = '204da4d24a10735bfdcc29267bfdfb166b62a521d256f4ee2ed1dc1d612bd24fb9ac';

    const outputs = [{ value: String(payout), scriptPublicKey: { version: 0, script: winnerSpk } }];
    if (protocolFee > DUST_SOMPI) outputs.push({ value: String(protocolFee), scriptPublicKey: { version: 0, script: protocolSpk } });

    const unsignedTx = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: escrowUtxo.outpoint?.transactionId || escrowUtxo.transactionId,
          index: escrowUtxo.outpoint?.index ?? escrowUtxo.index ?? 0
        },
        signatureScript: '',
        sequence: '0',
        sigOpCount: 1
      }],
      outputs,
      lockTime: '0',
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: '0',
      payload: ''
    };

    console.log('[SETTLE] Signing payout for', game.id, '| Winner:', game.winner, '| Payout:', payout);
    const signed = signTx(unsignedTx, pk, [escrowUtxo]);
    const rawTx = toRestTx(signed);

    const result = await restPost('/transactions', { transaction: rawTx, allowOrphan: true });
    const payoutTxId = result.transactionId || result.txid;

    db.updateGame(game.id, { settleTxId: payoutTxId, status: 'settled' });
    broadcastToGame(game.id, 'game-settled', {
      gameId: game.id, txId: payoutTxId, winner: game.winner,
      explorerUrl: 'https://explorer-tn12.kaspa.org/txs/' + payoutTxId
    });
    broadcast('game-settled', { gameId: game.id, txId: payoutTxId });

    console.log('[SETTLE] Payout TX:', payoutTxId);
    res.json({
      settleTxId: payoutTxId,
      payout: payout,
      fee: protocolFee,
      explorerUrl: 'https://explorer-tn12.kaspa.org/txs/' + payoutTxId
    });
  } catch (e) {
    console.error('[API] Settle error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:id/join
app.post('/api/games/:id/join', async (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'waiting') return res.status(400).json({ error: 'Game not waiting' });
    const { playerB } = req.body;
    db.updateGame(game.id, { playerB, status: 'playing', startedAt: Date.now() });
    if (game.type === 'tictactoe') {
      tictactoe.startGame(game.id, [{ addr: game.playerA, symbol: 'X' }, { addr: playerB, symbol: 'O' }]);
    } else if (game.type === 'poker' || game.type === 'blackjack') {
      gameManager.onGameStarted(db.getGame(game.id));
    }
    broadcastToGame(game.id, 'game-started', { gameId: game.id, playerB });
    broadcast('game-joined', { gameId: game.id, playerB });
    res.json({ game: db.getGame(game.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:id/resign
app.post('/api/games/:id/resign', (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'playing') return res.status(400).json({ error: 'Game not playing' });
    const { player } = req.body;
    const winner = player === game.playerA ? game.playerB : game.playerA;
    db.updateGame(game.id, { winner, status: 'finished', endedAt: Date.now() });
    broadcastToGame(game.id, 'game-over', { gameId: game.id, winner, reason: 'resignation' });
    res.json({ game: db.getGame(game.id), resigned: true, winner });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/games/:id/payout', (req, res) => {
  const game = db.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const stakeSompi = game.stakeSompi || 0;
  const pool = stakeSompi * 2;
  const fee = Math.floor(pool * 200 / 10000);
  const winnerPayout = pool - fee - TX_FEE_SOMPI;
  res.json({
    gameId: game.id, status: game.status, winner: game.winner,
    pool, poolKas: pool / SOMPI_PER_KAS, fee, feeKas: fee / SOMPI_PER_KAS,
    winnerPayout, winnerPayoutKas: winnerPayout / SOMPI_PER_KAS,
    settled: !!game.settleTxId, settleTxId: game.settleTxId || null
  });
});

// ─── Users / Leaderboard ──────────────────────────
app.get('/api/users/:addr', (req, res) => {
  const user = db.getOrCreateUser(req.params.addr);
  const positions = db.getUserPositions(req.params.addr);
  const games = db.getUserGames(req.params.addr);
  res.json({ user, positions, games });
});

app.get('/api/leaderboard', (req, res) => {
  res.json(db.getLeaderboard(parseInt(req.query.limit)||20));
});

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

app.get('/api/fees', (req, res) => {
  res.json(FEE_SCHEDULE);
});

// ─── Status ───────────────────────────────────────
app.get('/api/status', (req, res) => {
  const all = db.getAllGames();
  const active = all.filter(g => g.status === 'playing');
  const sw = getServerWallet();
  res.json({
    status: 'ok',
    network: 'tn12',
    version: '9.0.0',
    gamesActive: active.length,
    gamesTotal: all.length,
    serverWallet: sw ? sw.address : null,
    signerReady: true
  });
});

// ─── Script Validator ─────────────────────────────
app.post('/api/validate-script', (req, res) => {
  const { script } = req.body;
  if (!script) return res.status(400).json({ error: 'script required' });
  res.json(validator.validateCustomScript(script));
});

app.post('/api/disassemble', (req, res) => {
  const { script } = req.body;
  if (!script) return res.status(400).json({ error: 'script required' });
  res.json(validator.disassemble(script));
});

// ─── Oracle ───────────────────────────────────────
app.get('/api/oracle/status', (req, res) => {
  res.json(oracle.getStatus());
});

app.post('/api/oracle/resolve', async (req, res) => {
  try {
    const { marketId, outcome } = req.body;
    const result = await oracle.manualResolve(marketId, outcome);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Mainnet Proxy ────────────────────────────────
app.get('/api/mainnet/:path(*)', async (req, res) => {
  try {
    const url = MAINNET_API + '/' + req.params.path;
    const response = await fetch(url);
    res.json(await response.json());
  } catch (e) { res.status(502).json({ error: 'Mainnet API error: ' + e.message }); }
});

// ─── Network Info ─────────────────────────────────
app.get('/api/network', async (req, res) => {
  try {
    const info = await rpc.getBlockDagInfo();
    res.json({
      networkName: info.networkName || 'testnet-12',
      blockCount: info.blockCount, headerCount: info.headerCount,
      tipHashes: info.tipHashes, difficulty: info.difficulty,
      virtualDaaScore: info.virtualDaaScore
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SPA Fallback ─────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────
async function start() {
  console.log('  HIGH TABLE PROTOCOL v9.0');
  console.log('  Games + Markets on Kaspa TN12');

  try {
    await rpc.connect();
    await rpc.subscribeBlockAdded();
    await rpc.subscribeVirtualDaaScoreChanged();
    console.log('[RPC] Subscriptions active');
  } catch (e) {
    console.warn('[RPC] Could not connect to Kaspa node:', e.message);
    console.warn('[RPC] Running in offline mode. Markets/games will queue.');
  }

  const existingMarkets = db.getMarketsByStatus('open');
  for (const m of existingMarkets) indexer.trackMarket(m.id, m.poolScriptHex, m.bondScriptHex);
  const existingGames = db.getGamesByStatus('waiting').concat(db.getGamesByStatus('playing'));
  for (const g of existingGames) indexer.trackGame(g.id, g.escrowScriptHex);

  await indexer.start();
  await oracle.start();

  getServerWallet();

  server.listen(PORT, () => {
    console.log('[SERVER] Listening on http://localhost:' + PORT);
    console.log('[SERVER] Kaspa REST:', REST_URL);
  });
}

start().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});