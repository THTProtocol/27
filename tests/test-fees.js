'use strict';

const {
  calculateSpotPayouts, calculateMaximizerPayouts, calculateOpenPayouts,
  calculateGamePayout, getOdds, estimatePayout, FEE_SCHEDULE, SOMPI_PER_KAS,
} = require('../lib/fees');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.error('  ❌ ' + msg); }
}

function approxEqual(a, b, tolerance = 1) {
  return Math.abs(a - b) <= tolerance;
}

console.log('\n══════════════════════════════════════════');
console.log('  HIGH TABLE — Fee & Payout Tests');
console.log('══════════════════════════════════════════\n');

// ─── Fee Schedule ────────────────────────────────────────
console.log('▸ Fee Schedule Constants');
{
  assert(FEE_SCHEDULE.SPOT_PROTOCOL_BPS === 200, 'Spot fee: 200 bps (2%)');
  assert(FEE_SCHEDULE.MAXIMIZER_HEDGE_BPS === 3000, 'Maximizer hedge fee: 3000 bps (30%)');
  assert(FEE_SCHEDULE.GAME_PROTOCOL_BPS === 200, 'Game fee: 200 bps (2%)');
  assert(FEE_SCHEDULE.BOND_AMOUNT_KAS === 1000, 'Bond: 1000 KAS');
  assert(FEE_SCHEDULE.CHALLENGE_BOND_KAS === 250, 'Challenge bond: 250 KAS');
}

// ─── Spot Payouts ────────────────────────────────────────
console.log('\n▸ Spot Payouts — Symmetric');
{
  const positions = [
    { userPubkey: 'aaa', userAddr: 'addr_a1', side: 1, amountSompi: 100 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'bbb', userAddr: 'addr_b1', side: 2, amountSompi: 100 * SOMPI_PER_KAS, riskMode: 0 },
  ];
  const result = calculateSpotPayouts(positions, 1, 200 * SOMPI_PER_KAS);

  assert(result.payouts.length === 1, 'One winner');
  const winner = result.payouts[0];
  assert(winner.userPubkey === 'aaa', 'Correct winner: aaa');
  assert(winner.originalStake === 100 * SOMPI_PER_KAS, 'Stake preserved');

  const expectedFee = Math.floor(100 * SOMPI_PER_KAS * 200 / 10000);
  assert(result.protocolFeeSompi === expectedFee, 'Protocol fee: ' + (expectedFee / SOMPI_PER_KAS) + ' KAS');

  const expectedPayout = 100 * SOMPI_PER_KAS + (100 * SOMPI_PER_KAS - expectedFee);
  assert(approxEqual(winner.amountSompi, expectedPayout), 'Winner payout: ' + (winner.amountSompi / SOMPI_PER_KAS).toFixed(2) + ' KAS');
}

console.log('\n▸ Spot Payouts — Asymmetric (3 winners, 1 loser)');
{
  const positions = [
    { userPubkey: 'w1', userAddr: 'a1', side: 1, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'w2', userAddr: 'a2', side: 1, amountSompi: 30 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'w3', userAddr: 'a3', side: 1, amountSompi: 20 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'l1', userAddr: 'a4', side: 2, amountSompi: 200 * SOMPI_PER_KAS, riskMode: 0 },
  ];
  const result = calculateSpotPayouts(positions, 1, 300 * SOMPI_PER_KAS);

  assert(result.payouts.length === 3, 'Three winners');
  const totalPaid = result.payouts.reduce((s, p) => s + p.amountSompi, 0);
  const totalIn = 300 * SOMPI_PER_KAS;
  assert(totalPaid + result.protocolFeeSompi <= totalIn, 'Total out <= total in (conservation)');

  const w1 = result.payouts.find(p => p.userPubkey === 'w1');
  const w2 = result.payouts.find(p => p.userPubkey === 'w2');
  assert(w1.amountSompi > w2.amountSompi, 'Larger stake → larger payout');
  assert(w1.profit > 0, 'w1 profit positive: ' + (w1.profit / SOMPI_PER_KAS).toFixed(2));
}

// ─── Maximizer Payouts ───────────────────────────────────
console.log('\n▸ Maximizer Payouts');
{
  const positions = [
    { userPubkey: 'w1', userAddr: 'a1', side: 1, amountSompi: 100 * SOMPI_PER_KAS, riskMode: 1 },
    { userPubkey: 'l1', userAddr: 'a2', side: 2, amountSompi: 100 * SOMPI_PER_KAS, riskMode: 1 },
  ];
  const result = calculateMaximizerPayouts(positions, 1, 200 * SOMPI_PER_KAS);

  assert(result.payouts.length === 2, 'Both sides get payouts in maximizer');

  const winner = result.payouts.find(p => p.userPubkey === 'w1');
  const loser = result.payouts.find(p => p.userPubkey === 'l1');
  assert(winner.amountSompi > loser.amountSompi, 'Winner gets more than loser');
  assert(loser.amountSompi > 0, 'Loser gets hedge return: ' + (loser.amountSompi / SOMPI_PER_KAS).toFixed(2) + ' KAS');
  assert(loser.profit < 0, 'Loser still net negative: ' + (loser.profit / SOMPI_PER_KAS).toFixed(2));

  const hedgeReturn = Math.floor(100 * SOMPI_PER_KAS * 0.5);
  const hedgeFee = Math.floor(hedgeReturn * 3000 / 10000);
  const netHedge = hedgeReturn - hedgeFee;
  assert(approxEqual(loser.amountSompi, netHedge, SOMPI_PER_KAS), 'Hedge ~35 KAS: ' + (loser.amountSompi / SOMPI_PER_KAS).toFixed(2));
}

// ─── Open Mode (Mixed) ──────────────────────────────────
console.log('\n▸ Open Mode — Mixed Risk');
{
  const positions = [
    { userPubkey: 'sw', userAddr: 'a1', side: 1, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'sl', userAddr: 'a2', side: 2, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 0 },
    { userPubkey: 'mw', userAddr: 'a3', side: 1, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 1 },
    { userPubkey: 'ml', userAddr: 'a4', side: 2, amountSompi: 50 * SOMPI_PER_KAS, riskMode: 1 },
  ];
  const result = calculateOpenPayouts(positions, 1, 200 * SOMPI_PER_KAS);

  assert(result.payouts.length >= 3, 'At least 3 payouts (spot winner + max winner + max loser hedge)');
  const spotWinner = result.payouts.find(p => p.userPubkey === 'sw');
  const maxWinner = result.payouts.find(p => p.userPubkey === 'mw');
  const maxLoser = result.payouts.find(p => p.userPubkey === 'ml');

  assert(spotWinner && spotWinner.amountSompi > 50 * SOMPI_PER_KAS, 'Spot winner profits');
  assert(maxWinner && maxWinner.amountSompi > 50 * SOMPI_PER_KAS, 'Max winner profits');
  assert(maxLoser && maxLoser.amountSompi > 0, 'Max loser gets hedge');
  assert(result.protocolFeeSompi > 0, 'Protocol fee collected: ' + (result.protocolFeeSompi / SOMPI_PER_KAS).toFixed(2));
}

// ─── Game Payouts ────────────────────────────────────────
console.log('\n▸ Game Payouts');
{
  const winResult = calculateGamePayout(200 * SOMPI_PER_KAS, false);
  assert(winResult.winnerPayout + winResult.protocolFeeSompi === 200 * SOMPI_PER_KAS, 'Win: payout + fee = pot');
  assert(winResult.protocolFeeSompi === Math.floor(200 * SOMPI_PER_KAS * 200 / 10000), 'Win fee: 2%');
  assert(winResult.loserPayout === 0, 'Loser gets 0');

  const drawResult = calculateGamePayout(200 * SOMPI_PER_KAS, true);
  assert(drawResult.winnerPayout === drawResult.loserPayout, 'Draw: equal split');
  assert(drawResult.winnerPayout * 2 + drawResult.protocolFeeSompi === 200 * SOMPI_PER_KAS, 'Draw: conservation');
}

// ─── Odds Calculation ────────────────────────────────────
console.log('\n▸ Odds Calculation');
{
  const even = getOdds(100, 100);
  assert(even.oddsA === 2, 'Even odds A: 2.0x');
  assert(even.oddsB === 2, 'Even odds B: 2.0x');
  assert(even.impliedProbA === 0.5, 'Implied prob A: 50%');

  const skewed = getOdds(300, 100);
  assert(skewed.oddsA < 2, 'Heavy A odds < 2: ' + skewed.oddsA);
  assert(skewed.oddsB > 2, 'Light B odds > 2: ' + skewed.oddsB);
  assert(approxEqual(skewed.impliedProbA * 10000, 7500, 1), 'Implied prob A ~75%');

  const empty = getOdds(0, 0);
  assert(empty.oddsA === 2, 'Empty market: default 2x');
  assert(empty.impliedProbA === 0.5, 'Empty market: 50/50');
}

// ─── Estimate Payout ─────────────────────────────────────
console.log('\n▸ Estimate Payout');
{
  const est = estimatePayout(10 * SOMPI_PER_KAS, 1, 100 * SOMPI_PER_KAS, 100 * SOMPI_PER_KAS, 0);
  assert(est > 10 * SOMPI_PER_KAS, 'Estimated payout > stake: ' + (est / SOMPI_PER_KAS).toFixed(2));

  const estMax = estimatePayout(10 * SOMPI_PER_KAS, 1, 100 * SOMPI_PER_KAS, 100 * SOMPI_PER_KAS, 1);
  assert(estMax > 10 * SOMPI_PER_KAS, 'Max estimate > stake');
  assert(estMax < est, 'Max estimate < spot estimate (lower reward for hedge)');
}

console.log('\n══════════════════════════════════════════');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
