'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const KaspaRPC = require('./lib/kaspa-rpc');
const TxBuilder = require('./lib/tx-builder');
const Database = require('./lib/db');
const UtxoIndexer = require('./lib/utxo-indexer');
const SettlementEngine = require('./lib/settlement');
const OracleDaemon = require('./lib/oracle-daemon');
const ScriptValidator = require('./lib/script-validator');
const { getOdds, estimatePayout, FEE_SCHEDULE, calculateGamePayout } = require('./lib/fees');

const PORT = process.env.PORT || 3000;
const KASPA_RPC_URL = process.env.KASPA_WRPC_URL || 'ws://127.0.0.1:16210';
const MAINNET_API = process.env.MAINNET_API || 'https://api.kaspa.org';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Refuse to serve HTML SPA fallback for asset-typed paths (wasm, js, css, json, map, png, jpg, ico).
// Without this, missing /kaspa_bg.wasm returns index.html and breaks WebAssembly.instantiate.
app.use((req, res, next) => {
  if (/\.(wasm|js|css|json|map|png|jpe?g|svg|ico|gif|webp)$/i.test(req.path)) {
    return res.status(404).send('Not found: ' + req.path);
  }
  next();
});

// ─── Initialize Services ────────────────────────────────
const db = new Database();
const rpc = new KaspaRPC(KASPA_RPC_URL);
const validator = new ScriptValidator();

const oracleKeys = db.getOracleKeys();
const txBuilder = new TxBuilder(rpc, {
  protocolSpkHex: db.getConfig('protocolSpkHex') || '',
  protocolFeeBps: 200,
  oraclePubkeys: oracleKeys,
  multisigThreshold: 2,
});

const indexer = new UtxoIndexer(rpc, db);
const settlement = new SettlementEngine(txBuilder, rpc, db, indexer);
const oracle = new OracleDaemon(rpc, db, settlement, indexer);

// ─── WebSocket Clients ──────────────────────────────────
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
      // Generic action for poker/blackjack (fold, call, raise, hit, stand, etc.)
      const game = db.getGame(msg.gameId);
      if (!game || game.status !== 'playing') return;
      db.addMove(msg.gameId, { action: msg.action, data: msg.data, player: msg.player });
      broadcastToGame(msg.gameId, 'game-action', { gameId: msg.gameId, action: msg.action, data: msg.data, player: msg.player });
      break;
    }
    case 'game-state-update': {
      // Full state sync for card games (server-authoritative state push)
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
      settlement.settleGame(msg.gameId, winner).catch(e => console.error('[WS] Settle error:', e.message));
      break;
    }
    case 'game-draw-offer': {
      broadcastToGame(msg.gameId, 'draw-offered', { gameId: msg.gameId, from: msg.player });
      break;
    }
    case 'game-draw-accept': {
      db.updateGame(msg.gameId, { winner: 'draw', status: 'finished', endedAt: Date.now() });
      broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: 'draw', reason: 'agreement' });
      settlement.settleGame(msg.gameId, 'draw').catch(e => console.error('[WS] Settle error:', e.message));
      break;
    }
    case 'game-checkmate': {
      db.updateGame(msg.gameId, { winner: msg.winner, status: 'finished', endedAt: Date.now() });
      broadcastToGame(msg.gameId, 'game-over', { gameId: msg.gameId, winner: msg.winner, reason: 'checkmate' });
      settlement.settleGame(msg.gameId, msg.winner).catch(e => console.error('[WS] Settle error:', e.message));
      break;
    }
  }
}

// ─── Indexer / Oracle Events → WebSocket ────────────────
indexer.on('pool-updated', (data) => broadcast('pool-updated', data));
indexer.on('receipts-updated', (data) => broadcast('receipts-updated', data));
indexer.on('escrow-funded', (data) => broadcast('escrow-funded', data));
indexer.on('escrow-spent', (data) => broadcast('escrow-spent', data));
oracle.on('resolved', (data) => broadcast('market-resolved', data));
oracle.on('timeout-refunded', (data) => broadcast('market-refunded', data));
oracle.on('game-settled', (data) => broadcast('game-settled', data));

// ─── REST API: Markets ──────────────────────────────────
app.get('/api/markets', (req, res) => {
  const { status, category } = req.query;
  let markets = db.getAllMarkets();
  if (status) markets = markets.filter(m => m.status === status);
  if (category) markets = markets.filter(m => m.category === category);
  markets = markets.map(m => ({
    ...m, odds: getOdds(m.sideATotalSompi, m.sideBTotalSompi),
  }));
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

    const oraclePubkey = oracleKeys[0] || '';

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
      minPositionSompi: (minPositionKas || 1) * 1e8,
      poolAmountSompi: 1e8, oracleSource, customScript,
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

    if (amountSompi < market.minPositionSompi) {
      return res.status(400).json({ error: 'Below minimum position: ' + (market.minPositionSompi / 1e8) + ' KAS' });
    }

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
  if (!address || !side || !amountKAS)
    return res.status(400).json({ error: 'address, side, amountKAS required' });
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
    if (available < amountSompi)
      return res.status(400).json({ error: 'insufficient balance', required: amountSompi, available });
    const odds = getOdds((m.sideATotalSompi||0) + (side==='A'?amountSompi:0), (m.sideBTotalSompi||0) + (side==='B'?amountSompi:0));
    res.json({ status: 'unsigned', market: { id: m.id, title: m.title, side },
      position: { address, side, amountSompi, amountKAS, estimatedOdds: side==='A' ? odds.oddsA : odds.oddsB },
      inputs: selected, fee: 5000, change: available - amountSompi - 5000 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/markets/:id/confirm-position', (req, res) => {
  const { address, side, amountSompi, transactionId } = req.body;
  if (!address || !side || !amountSompi || !transactionId)
    return res.status(400).json({ error: 'address, side, amountSompi, transactionId required' });
  const evt = db.getMarket(req.params.id);
  if (!evt) return res.status(404).json({ error: 'market not found' });
  const posId = require('crypto').randomUUID().replace(/-/g,'').substring(0,16);
  db.addPosition(evt.id, { userAddr: address, side: side === evt.outcomeA ? 1 : 2, amountSompi, txId: transactionId });
  broadcast('position-confirmed', { eventId: evt.id, side, amount: amountSompi, txId: transactionId });
  res.json({ positionId: posId, eventId: evt.id, address, side, amountSompi, transactionId });
});

app.post('/api/markets/:id/resolve', async (req, res) => {
  try {
    const { outcome, oracleSig } = req.body;
    const result = await settlement.resolveMarket(req.params.id, outcome, oracleSig || 'manual');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/markets/:id/odds', (req, res) => {
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const odds = getOdds(m.sideATotalSompi, m.sideBTotalSompi);
  const total = (m.sideATotalSompi || 0) + (m.sideBTotalSompi || 0);
  res.json({
    marketId: m.id, totalPool: total, totalPoolKAS: total / 1e8,
    outcomeA: { name: m.outcomeA || 'A', pool: m.sideATotalSompi || 0, odds: odds.oddsA },
    outcomeB: { name: m.outcomeB || 'B', pool: m.sideBTotalSompi || 0, odds: odds.oddsB },
  });
});

app.get('/api/markets/:id/estimate', (req, res) => {
  const m = db.getMarket(req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { side, amount, riskMode } = req.query;
  const est = estimatePayout(parseInt(amount) || 1e8, parseInt(side) || 1, m.sideATotalSompi, m.sideBTotalSompi, parseInt(riskMode) || 0);
  res.json({ estimatedPayout: est, estimatedPayoutKas: est / 1e8 });
});

// ─── REST API: Node Info ─────────────────────────────────
app.get('/api/node/info', async (req, res) => {
  try {
    const info = await rpc.getInfo();
    const dag = await rpc.getBlockDagInfo();
    res.json({
      synced: !!info.isSynced, utxoIndexed: !!info.isUtxoIndexed,
      mempoolSize: info.mempoolSize || 0, serverVersion: info.serverVersion || '',
      networkId: dag.networkId || dag.network || 'testnet-12',
      blockCount: dag.blockCount || dag.headerCount || 0,
      virtualDaaScore: dag.virtualDaaScore || dag.virtual_daa_score || '0',
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

app.get('/api/node/dag', async (req, res) => {
  try {
    const dag = await rpc.getBlockDagInfo();
    const tips = dag.tipHashes || dag.tips || [];
    const blocks = [];
    for (const h of tips.slice(0, 10)) {
      try {
        const b = await rpc.getBlockByHash(h);
        blocks.push({ hash: h.substring(0,16)+'...', hashFull: h,
          txCount: b.transactions ? b.transactions.length : 0,
          daaScore: b.verboseData ? b.verboseData.daaScore : null,
          timestamp: b.header ? b.header.timestamp : null });
      } catch {}
    }
    res.json({ virtualDaaScore: dag.virtualDaaScore||'0', blockCount: dag.blockCount||0, tipCount: tips.length, tips: blocks });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/tx/submit', async (req, res) => {
  try {
    const { transaction } = req.body;
    if (!transaction) return res.status(400).json({ error: 'transaction required' });
    const result = await rpc.submitTransaction(transaction);
    res.json({ success: true, transactionId: result.transactionId || result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── REST API: Games ────────────────────────────────────
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

app.post('/api/games', async (req, res) => {
  try {
    const { type, playerA, playerAPubkey, stakeKas, timeControl, timeoutHours, options } = req.body;
    const stakeSompi = Math.floor((stakeKas || 1) * 1e8);
    const currentDaa = await rpc.getCurrentDaaScore();
    const timeoutDaa = currentDaa + rpc.hoursToDAATicks(timeoutHours || 4);

    const playerUtxos = await rpc.getUtxosByAddress(playerA);
    const utxos = playerUtxos.entries || playerUtxos || [];

    const escrow = txBuilder.buildGameEscrowTx({
      playerAPubkey, playerAddr: playerA, playerUtxos: utxos, stakeSompi, timeoutDaa,
    });

    const game = db.createGame({
      type: type || 'chess', playerA, playerAPubkey, stakeSompi,
      escrowScriptHex: escrow.escrowScript.hex, timeoutDaa, timeControl: timeControl || '10+0',
      options: options || {},
    });

    indexer.trackGame(game.id, escrow.escrowScript.hex);
    const user = db.getOrCreateUser(playerA);
    db.updateUser(playerA, { totalGames: user.totalGames + 1, pubkey: playerAPubkey });

    broadcast('game-created', { game });
    res.json({ game, pskt: escrow.pskt });
  } catch (e) {
    console.error('[API] Create game error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/games/:id/join', async (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'waiting') return res.status(400).json({ error: 'Game not waiting' });

    const { playerB, playerBPubkey } = req.body;
    const playerBUtxos = await rpc.getUtxosByAddress(playerB);
    const utxos = playerBUtxos.entries || playerBUtxos || [];
    const escrowUtxo = indexer.getGameUtxo(game.id);

    const joinTx = txBuilder.buildGameJoinTx({
      escrowUtxo, playerBPubkey, playerBAddr: playerB, playerBUtxos: utxos,
      stakeSompi: game.stakeSompi, playerAPubkey: game.playerAPubkey, timeoutDaa: game.timeoutDaa,
    });

    db.updateGame(game.id, { playerB, playerBPubkey, status: 'playing', startedAt: Date.now() });
    const user = db.getOrCreateUser(playerB);
    db.updateUser(playerB, { totalGames: user.totalGames + 1, pubkey: playerBPubkey });

    broadcastToGame(game.id, 'game-started', { gameId: game.id, playerB });
    broadcast('game-joined', { gameId: game.id, playerB });

    res.json({ game: db.getGame(game.id), pskt: joinTx.pskt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─── REST API: Game Claim / Payout ─────────────────────
app.post('/api/games/:id/claim', async (req, res) => {
  try {
    const game = db.getGame(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (game.status !== 'finished') return res.status(400).json({ error: 'Game not finished' });
    if (game.settleTxId) return res.json({ txId: game.settleTxId, message: 'Already settled' });
    if (!game.winner) return res.status(400).json({ error: 'No winner determined' });
    const result = await settlement.settleGame(game.id, game.winner);
    res.json({ txId: result.txId, message: 'Payout sent to wallet' });
  } catch (e) {
    console.error('[API] Claim error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/games/:id/payout', (req, res) => {
  const game = db.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const stakeSompi = game.stakeSompi || 0;
  const pool = stakeSompi * 2;
  const fee = Math.floor(pool * 200 / 10000);
  const winnerPayout = pool - fee - 30000;
  res.json({
    gameId: game.id, status: game.status, winner: game.winner,
    pool: pool, poolKas: pool / 1e8,
    fee: fee, feeKas: fee / 1e8,
    winnerPayout: winnerPayout, winnerPayoutKas: winnerPayout / 1e8,
    settled: !!game.settleTxId, settleTxId: game.settleTxId || null,
  });
});

// ─── REST API: Users / Stats ────────────────────────────
app.get('/api/users/:addr', (req, res) => {
  const user = db.getOrCreateUser(req.params.addr);
  const positions = db.getUserPositions(req.params.addr);
  const games = db.getUserGames(req.params.addr);
  res.json({ user, positions, games });
});

app.get('/api/leaderboard', (req, res) => {
  res.json(db.getLeaderboard(parseInt(req.query.limit) || 20));
});

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

app.get('/api/fees', (req, res) => {
  res.json(FEE_SCHEDULE);
});

// ─── REST API: Script Validator ─────────────────────────
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

// ─── REST API: Oracle ───────────────────────────────────
app.get('/api/oracle/status', (req, res) => {
  res.json(oracle.getStatus());
});

app.post('/api/oracle/resolve', async (req, res) => {
  try {
    const { marketId, outcome } = req.body;
    const result = await oracle.manualResolve(marketId, outcome);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REST API: Mainnet Proxy ────────────────────────────
app.get('/api/mainnet/:path(*)', async (req, res) => {
  try {
    const url = MAINNET_API + '/' + req.params.path;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Mainnet API error: ' + e.message });
  }
});

// ─── REST API: Network Info ─────────────────────────────
app.get('/api/network', async (req, res) => {
  try {
    const info = await rpc.getBlockDagInfo();
    const hashrate = rpc.calculateHashrate ? rpc.calculateHashrate(info.difficulty) : 0;
    res.json({
      networkName: info.networkName || 'testnet-12',
      blockCount: info.blockCount,
      headerCount: info.headerCount,
      tipHashes: info.tipHashes,
      difficulty: info.difficulty,
      virtualDaaScore: info.virtualDaaScore,
      hashrate: rpc.formatHashrate ? rpc.formatHashrate(hashrate) : hashrate,
      hashrateRaw: hashrate,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SPA Fallback ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────
async function start() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   HIGH TABLE PROTOCOL v8.0               ║');
  console.log('║   Prediction Markets + Games on Kaspa    ║');
  console.log('╚══════════════════════════════════════════╝');

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
  for (const m of existingMarkets) {
    indexer.trackMarket(m.id, m.poolScriptHex, m.bondScriptHex);
  }
  const existingGames = db.getGamesByStatus('waiting').concat(db.getGamesByStatus('playing'));
  for (const g of existingGames) {
    indexer.trackGame(g.id, g.escrowScriptHex);
  }

  await indexer.start();
  await oracle.start();

  server.listen(PORT, () => {
    console.log('[SERVER] Listening on http://localhost:' + PORT);
    console.log('[SERVER] Kaspa node:', KASPA_RPC_URL);
    console.log('[SERVER] Mainnet API:', MAINNET_API);
  });
}

start().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
