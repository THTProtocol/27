'use strict';

const Database = require('../lib/db');
const { getOdds, calculateSpotPayouts, SOMPI_PER_KAS } = require('../lib/fees');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.error('  ❌ ' + msg); }
}

console.log('\n══════════════════════════════════════════');
console.log('  HIGH TABLE — Settlement Flow Tests');
console.log('══════════════════════════════════════════\n');

// ─── Database CRUD ───────────────────────────────────────
console.log('▸ Database Operations');
{
  const db = new Database();

  const market = db.createMarket({
    title: 'Test Market: BTC > 100k',
    category: 'crypto',
    outcomeA: 'Yes',
    outcomeB: 'No',
    marketMode: 2,
    creatorAddr: 'kaspatest:addr_creator',
    closeDaa: 1000000,
    timeoutDaa: 2000000,
  });

  assert(market.id.startsWith('MKT-'), 'Market ID generated: ' + market.id);
  assert(market.status === 'open', 'Market status: open');
  assert(market.title === 'Test Market: BTC > 100k', 'Title stored');

  const fetched = db.getMarket(market.id);
  assert(fetched !== null, 'Market retrieved');
  assert(fetched.title === market.title, 'Title matches');

  const pos1 = db.addPosition(market.id, {
    userAddr: 'kaspatest:addr_user1', userPubkey: 'pub1',
    side: 1, riskMode: 0, amountSompi: 50 * SOMPI_PER_KAS,
  });
  assert(pos1.id.startsWith('POS-'), 'Position ID: ' + pos1.id);

  const pos2 = db.addPosition(market.id, {
    userAddr: 'kaspatest:addr_user2', userPubkey: 'pub2',
    side: 2, riskMode: 0, amountSompi: 30 * SOMPI_PER_KAS,
  });

  const updated = db.getMarket(market.id);
  assert(updated.positionCount === 2, 'Position count: 2');
  assert(updated.sideATotalSompi === 50 * SOMPI_PER_KAS, 'Side A total: 50 KAS');
  assert(updated.sideBTotalSompi === 30 * SOMPI_PER_KAS, 'Side B total: 30 KAS');

  const odds = getOdds(updated.sideATotalSompi, updated.sideBTotalSompi);
  assert(odds.oddsA < 2, 'Side A odds < 2 (favored): ' + odds.oddsA);
  assert(odds.oddsB > 2, 'Side B odds > 2 (underdog): ' + odds.oddsB);
}

// ─── Settlement Simulation ───────────────────────────────
console.log('\n▸ Settlement Simulation');
{
  const positions = [
    { userPubkey: 'p1', userAddr: 'a1', side: 1, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'p2', userAddr: 'a2', side: 1, amountSompi: 25 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'p3', userAddr: 'a3', side: 2, amountSompi: 60 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'p4', userAddr: 'a4', side: 2, amountSompi: 15 * SOMPI_PER_KAS, riskMode: 0 },
  ];

  const poolTotal = positions.reduce((s, p) => s + p.amountSompi, 0);
  assert(poolTotal === 150 * SOMPI_PER_KAS, 'Pool total: 150 KAS');

  // Side 1 wins
  const result = calculateSpotPayouts(positions, 1, poolTotal);
  assert(result.payouts.length === 2, 'Two winners (side A)');

  const totalPayout = result.payouts.reduce((s, p) => s + p.amountSompi, 0);
  assert(totalPayout + result.protocolFeeSompi <= poolTotal, 'Conservation: payouts + fee <= pool');

  const w1 = result.payouts.find(p => p.userPubkey === 'p1');
  const w2 = result.payouts.find(p => p.userPubkey === 'p2');
  assert(w1.profit > w2.profit, 'Larger staker gets more profit');
  assert(w1.amountSompi > 50 * SOMPI_PER_KAS, 'w1 gets back more than staked');

  const profitRatio1 = w1.profit / w1.originalStake;
  const profitRatio2 = w2.profit / w2.originalStake;
  assert(Math.abs(profitRatio1 - profitRatio2) < 0.01, 'Profit ratios equal (proportional): ' + profitRatio1.toFixed(4) + ' vs ' + profitRatio2.toFixed(4));

  // Side 2 wins
  const result2 = calculateSpotPayouts(positions, 2, poolTotal);
  assert(result2.payouts.length === 2, 'Two winners (side B)');
  const w3 = result2.payouts.find(p => p.userPubkey === 'p3');
  assert(w3.amountSompi > 60 * SOMPI_PER_KAS, 'Side B winner profits');
}

// ─── Game DB Flow ────────────────────────────────────────
console.log('\n▸ Game Database Flow');
{
  const db = new Database();

  const game = db.createGame({
    type: 'chess',
    playerA: 'kaspatest:addr_pa',
    playerAPubkey: 'pubA',
    stakeSompi: 10 * SOMPI_PER_KAS,
    timeControl: '10+0',
  });

  assert(game.id.startsWith('GAME-'), 'Game ID: ' + game.id);
  assert(game.status === 'waiting', 'Status: waiting');
  assert(game.fen !== null, 'Chess FEN initialized');

  db.updateGame(game.id, { playerB: 'kaspatest:addr_pb', status: 'playing', startedAt: Date.now() });
  const playing = db.getGame(game.id);
  assert(playing.status === 'playing', 'Status: playing');

  db.addMove(game.id, { from: 'e2', to: 'e4', piece: 'P', fen: 'test_fen', player: 'kaspatest:addr_pa' });
  const withMove = db.getGame(game.id);
  assert(withMove.moves.length === 1, 'Move recorded');
  assert(withMove.fen === 'test_fen', 'FEN updated');

  db.updateGame(game.id, { winner: 'kaspatest:addr_pa', status: 'finished', endedAt: Date.now() });
  const finished = db.getGame(game.id);
  assert(finished.status === 'finished', 'Status: finished');
  assert(finished.winner === 'kaspatest:addr_pa', 'Winner recorded');
}

// ─── User Tracking ───────────────────────────────────────
console.log('\n▸ User Tracking');
{
  const db = new Database();

  const user = db.getOrCreateUser('kaspatest:addr_test');
  assert(user.addr === 'kaspatest:addr_test', 'User created');
  assert(user.totalBets === 0, 'Initial bets: 0');

  db.updateUser('kaspatest:addr_test', { totalBets: 5, totalWagered: 500 * SOMPI_PER_KAS, totalWon: 100 * SOMPI_PER_KAS });
  const updated = db.getOrCreateUser('kaspatest:addr_test');
  assert(updated.totalBets === 5, 'Bets updated: 5');

  const lb = db.getLeaderboard(10);
  assert(Array.isArray(lb), 'Leaderboard returns array');
}

// ─── Stats ───────────────────────────────────────────────
console.log('\n▸ Stats');
{
  const db = new Database();
  const stats = db.getStats();
  assert(typeof stats.totalMarkets === 'number', 'Stats: totalMarkets is number');
  assert(typeof stats.totalGames === 'number', 'Stats: totalGames is number');
  assert(typeof stats.totalUsers === 'number', 'Stats: totalUsers is number');
}

console.log('\n══════════════════════════════════════════');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('══════════════════════════════════════════\n');

// Cleanup test data
const fs = require('fs');
const path = require('path');
['markets.json', 'games.json', 'users.json', 'config.json'].forEach(f => {
  const p = path.join(__dirname, '..', 'data', f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
});

process.exit(failed > 0 ? 1 : 0);
