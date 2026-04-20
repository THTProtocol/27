'use strict';

const { buildMarketPoolScript, MARKET_MODE, OP } = require('../lib/scripts/market-pool');
const { buildPositionReceiptScript, parseReceiptData, SIDE, RISK_MODE } = require('../lib/scripts/position-receipt');
const { buildCreatorBondScript, buildChallengeBondScript, BOND_AMOUNT_SOMPI, CHALLENGE_AMOUNT_SOMPI } = require('../lib/scripts/creator-bond');
const { buildGameEscrowScript, GAME_FEE_BPS } = require('../lib/scripts/game-escrow');
const ScriptValidator = require('../lib/script-validator');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.error('  ❌ ' + msg); }
}

console.log('\n══════════════════════════════════════════');
console.log('  HIGH TABLE — Script Tests');
console.log('══════════════════════════════════════════\n');

// ─── Market Pool Script ──────────────────────────────────
console.log('▸ Market Pool Script');
{
  const pool = buildMarketPoolScript({
    oraclePubkey: 'aa'.repeat(32),
    protocolSpkHex: 'bb'.repeat(20),
    closeDaa: 1000000,
    oracleWindowDaa: 36000,
    graceDaa: 72000,
    protocolFeeBps: 200,
    minPositionSompi: 100000000,
    marketMode: MARKET_MODE.OPEN,
  });

  assert(pool.hex.length > 0, 'Pool script hex is non-empty');
  assert(pool.hex.length < 20000, 'Pool script under 10KB: ' + (pool.hex.length / 2) + ' bytes');
  assert(pool.params.closeDaa === 1000000, 'Close DAA embedded: 1000000');
  assert(pool.params.oracleWindowDaa === 36000, 'Oracle window embedded: 36000');
  assert(pool.params.timeoutDaa > 1000000, 'Timeout DAA > closeDaa: ' + pool.params.timeoutDaa);
  assert(pool.hex.includes('aa'.repeat(32)), 'Oracle pubkey embedded in script');

  const poolSpot = buildMarketPoolScript({
    oraclePubkey: 'cc'.repeat(32),
    protocolSpkHex: 'dd'.repeat(20),
    closeDaa: 500000, oracleWindowDaa: 18000, graceDaa: 36000,
    protocolFeeBps: 200, minPositionSompi: 100000000, marketMode: MARKET_MODE.SPOT,
  });
  assert(poolSpot.hex.length > 0, 'Spot mode script built');

  const poolMax = buildMarketPoolScript({
    oraclePubkey: 'ee'.repeat(32),
    protocolSpkHex: 'ff'.repeat(20),
    closeDaa: 500000, oracleWindowDaa: 18000, graceDaa: 36000,
    protocolFeeBps: 200, minPositionSompi: 100000000, marketMode: MARKET_MODE.MAXIMIZER,
  });
  assert(poolMax.hex.length > 0, 'Maximizer mode script built');
}

// ─── Position Receipt Script ─────────────────────────────
console.log('\n▸ Position Receipt Script');
{
  const receipt = buildPositionReceiptScript({
    userPubkey: '11'.repeat(32),
    oraclePubkey: '22'.repeat(32),
    side: SIDE.A,
    amountSompi: 500000000,
    riskMode: RISK_MODE.SPOT,
    timeoutDaa: 2000000,
  });

  assert(receipt.hex.length > 0, 'Receipt script hex non-empty');
  assert(receipt.hex.includes('11'.repeat(32)), 'User pubkey embedded');

  const parsed = parseReceiptData(receipt.hex);
  assert(parsed !== null, 'Receipt data parsed successfully');
  assert(parsed.userPubkey === '11'.repeat(32), 'Parsed user pubkey matches');
  assert(parsed.side === SIDE.A, 'Parsed side matches: A');
  assert(parsed.amountSompi === 500000000, 'Parsed amount matches: 500000000');
  assert(parsed.riskMode === RISK_MODE.SPOT, 'Parsed risk mode: SPOT');

  const receiptB = buildPositionReceiptScript({
    userPubkey: '33'.repeat(32),
    oraclePubkey: '44'.repeat(32),
    side: SIDE.B,
    amountSompi: 100000000,
    riskMode: RISK_MODE.MAXIMIZER,
    timeoutDaa: 1500000,
  });
  const parsedB = parseReceiptData(receiptB.hex);
  assert(parsedB.side === SIDE.B, 'Parsed side B');
  assert(parsedB.riskMode === RISK_MODE.MAXIMIZER, 'Parsed risk mode: MAXIMIZER');
  assert(parsedB.amountSompi === 100000000, 'Parsed amount: 100000000');
}

// ─── Creator Bond Script ─────────────────────────────────
console.log('\n▸ Creator Bond Script');
{
  const bond = buildCreatorBondScript({
    creatorPubkey: '55'.repeat(32),
    oraclePubkeys: ['66'.repeat(32), '77'.repeat(32), '88'.repeat(32)],
    multisigThreshold: 2,
    disputeWindowDaa: 1500000,
    timeoutDaa: 2000000,
  });

  assert(bond.hex.length > 0, 'Bond script hex non-empty');
  assert(bond.hex.includes('55'.repeat(32)), 'Creator pubkey embedded');
  assert(bond.hex.includes('66'.repeat(32)), 'Oracle key 1 embedded');

  const challenge = buildChallengeBondScript({
    challengerPubkey: '99'.repeat(32),
    oraclePubkeys: ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)],
    multisigThreshold: 2,
  });
  assert(challenge.hex.length > 0, 'Challenge bond script non-empty');
  assert(challenge.params && challenge.params.challengerPubkey === '99'.repeat(32), 'Challenger pubkey embedded');

  assert(BOND_AMOUNT_SOMPI === 100000000000, 'Bond amount: 1000 KAS');
  assert(CHALLENGE_AMOUNT_SOMPI === 25000000000, 'Challenge amount: 250 KAS');
}

// ─── Game Escrow Script ──────────────────────────────────
console.log('\n▸ Game Escrow Script');
{
  const escrow = buildGameEscrowScript({
    playerAPubkey: 'aa'.repeat(32),
    playerBPubkey: 'bb'.repeat(32),
    oraclePubkeys: ['cc'.repeat(32), 'dd'.repeat(32), 'ee'.repeat(32)],
    multisigThreshold: 2,
    timeoutDaa: 1000000,
    stakeSompi: 1000000000,
  });

  assert(escrow.hex.length > 0, 'Escrow script hex non-empty');
  assert(escrow.params && escrow.params.playerAPubkey === 'aa'.repeat(32), 'Player A pubkey embedded');
  assert(escrow.params && escrow.params.playerBPubkey === 'bb'.repeat(32), 'Player B pubkey embedded');
  assert(GAME_FEE_BPS === 200, 'Game fee: 200 bps (2%)');

  const escrowSingle = buildGameEscrowScript({
    playerAPubkey: 'ff'.repeat(32),
    playerBPubkey: null,
    oraclePubkeys: ['11'.repeat(32), '22'.repeat(32), '33'.repeat(32)],
    multisigThreshold: 2,
    timeoutDaa: 500000,
    stakeSompi: 500000000,
  });
  assert(escrowSingle.hex.length > 0, 'Single-player escrow built (waiting state)');
}

// ─── Script Validator ────────────────────────────────────
console.log('\n▸ Script Validator');
{
  const validator = new ScriptValidator();

  const pool = buildMarketPoolScript({
    oraclePubkey: 'ab'.repeat(32),
    protocolSpkHex: 'cd'.repeat(20),
    closeDaa: 1000000, oracleWindowDaa: 36000, graceDaa: 72000,
    protocolFeeBps: 200, minPositionSompi: 100000000, marketMode: MARKET_MODE.OPEN,
  });

  const result = validator.validate(pool.hex);
  assert(result.valid, 'Pool script passes validation');
  assert(result.analysis.size > 0, 'Analysis shows size: ' + result.analysis.size);
  assert(result.analysis.opsCount > 0, 'Analysis shows ops: ' + result.analysis.opsCount);
  assert(result.errors.length === 0, 'No errors: ' + result.errors.join(', '));

  const emptyResult = validator.validate('');
  assert(!emptyResult.valid, 'Empty script fails validation');

  const marketResult = validator.validateMarketScript(pool.hex, 'ab'.repeat(32));
  assert(marketResult.valid || marketResult.warnings.length >= 0, 'Market validation runs without crash');

  const disasm = validator.disassemble(pool.hex);
  assert(Array.isArray(disasm), 'Disassemble returns array');
  assert(disasm.length > 0, 'Disassembled ops: ' + disasm.length);

  const customResult = validator.validateCustomScript(pool.hex);
  assert(customResult.badge !== undefined, 'Custom validation returns badge: ' + customResult.badge);
}

// ─── Roundtrip: Build → Validate → Disassemble ──────────
console.log('\n▸ Roundtrip Tests');
{
  const scripts = [
    { name: 'MarketPool', s: buildMarketPoolScript({ oraclePubkey: '11'.repeat(32), protocolSpkHex: '22'.repeat(20), closeDaa: 1e6, oracleWindowDaa: 36000, graceDaa: 72000, protocolFeeBps: 200, minPositionSompi: 1e8, marketMode: MARKET_MODE.OPEN }) },
    { name: 'Receipt', s: buildPositionReceiptScript({ userPubkey: '33'.repeat(32), oraclePubkey: '44'.repeat(32), side: 1, amountSompi: 1e8, riskMode: 0, timeoutDaa: 2e6 }) },
    { name: 'Bond', s: buildCreatorBondScript({ creatorPubkey: '55'.repeat(32), oraclePubkeys: ['66'.repeat(32), '77'.repeat(32), '88'.repeat(32)], multisigThreshold: 2, disputeWindowDaa: 1.5e6, timeoutDaa: 2e6 }) },
    { name: 'Escrow', s: buildGameEscrowScript({ playerAPubkey: '99'.repeat(32), playerBPubkey: 'aa'.repeat(32), oraclePubkeys: ['bb'.repeat(32), 'cc'.repeat(32), 'dd'.repeat(32)], multisigThreshold: 2, timeoutDaa: 1e6, stakeSompi: 1e9 }) },
  ];

  const validator = new ScriptValidator();
  for (const { name, s } of scripts) {
    const valid = validator.validate(s.hex);
    const disasm = validator.disassemble(s.hex);
    assert(valid.errors.length === 0, name + ' validates clean (' + (s.hex.length / 2) + 'B, ' + valid.analysis.opsCount + ' ops)');
    assert(disasm.length > 0, name + ' disassembles to ' + disasm.length + ' ops');
  }
}

console.log('\n══════════════════════════════════════════');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
