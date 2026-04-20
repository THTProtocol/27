'use strict';

const ScriptValidator = require('../lib/script-validator');
const { OP } = require('../lib/scripts/market-pool');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✅ ' + msg); }
  else { failed++; console.error('  ❌ ' + msg); }
}

console.log('\n══════════════════════════════════════════');
console.log('  HIGH TABLE — Validator Tests');
console.log('══════════════════════════════════════════\n');

const v = new ScriptValidator();

// ─── Basic Validation ────────────────────────────────────
console.log('▸ Basic Validation');
{
  const r1 = v.validate('');
  assert(!r1.valid, 'Empty script → invalid');
  assert(r1.errors.length > 0, 'Empty script has errors');

  // Simple CHECKSIG: <push 32 bytes> OP_CHECKSIG
  const simpleSig = '20' + 'ab'.repeat(32) + 'ac';
  const r2 = v.validate(simpleSig);
  assert(r2.valid, 'Simple checksig script → valid');
  assert(r2.analysis.hasChecksig, 'Detects checksig');
  assert(r2.analysis.size === 34, 'Size: 34 bytes');

  // DUP CHECKSIG: OP_DUP <push 32> OP_EQUALVERIFY OP_CHECKSIG
  const dupSig = '76' + '20' + 'cd'.repeat(32) + '88ac';
  const r3 = v.validate(dupSig);
  assert(r3.valid, 'DUP+EQUALVERIFY+CHECKSIG → valid');
}

// ─── Size Limits ─────────────────────────────────────────
console.log('\n▸ Size Limits');
{
  const bigScript = 'ac'.repeat(5001);
  const r = v.validate(bigScript);
  assert(!r.valid, 'Oversized script → invalid');
  assert(r.errors.some(e => /size|exceed|limit|max|large|long/i.test(e)), 'Error mentions size limit');

  const okScript = '20' + 'ab'.repeat(32) + 'ac';
  const r2 = v.validate(okScript);
  assert(r2.valid, 'Normal-sized script → valid');
}

// ─── Banned Opcodes ──────────────────────────────────────
console.log('\n▸ Banned Opcodes');
{
  // OP_RETURN = 0x6a
  const withReturn = '6a' + '04' + 'deadbeef';
  const r = v.validate(withReturn);
  assert(!r.valid, 'OP_RETURN script → invalid');
  assert(r.errors.some(e => e.includes('Banned')), 'Error mentions banned opcode');
}

// ─── IF/ENDIF Matching ───────────────────────────────────
console.log('\n▸ IF/ENDIF Matching');
{
  // OP_1 OP_IF OP_1 OP_ENDIF
  const matched = '5163516768';
  const r1 = v.validate(matched);
  assert(r1.valid, 'Matched IF/ENDIF → valid');

  // OP_1 OP_IF OP_1 (no ENDIF)
  const unmatched = '51635167';
  const r2 = v.validate(unmatched);
  assert(!r2.valid, 'Unmatched IF → invalid');
  assert(r2.errors.some(e => e.includes('Unmatched')), 'Error mentions unmatched IF');

  // OP_ENDIF without IF
  const noIf = '5168';
  const r3 = v.validate(noIf);
  assert(!r3.valid, 'ENDIF without IF → invalid');
}

// ─── Deep Nesting ────────────────────────────────────────
console.log('\n▸ Deep Nesting');
{
  let deep = '';
  for (let i = 0; i < 15; i++) deep += '5163'; // OP_1 OP_IF
  deep += '51'; // OP_1
  for (let i = 0; i < 15; i++) deep += '68'; // OP_ENDIF
  const r = v.validate(deep);
  assert(!r.valid, 'Depth 15 → invalid (limit 10)');
  assert(r.errors.some(e => e.includes('depth')), 'Error mentions depth');
}

// ─── Market Script Validation ────────────────────────────
console.log('\n▸ Market Script Validation');
{
  // Script with CHECKSIG + TXINPUTBLOCKDAASCORE + oracle pubkey
  const oraclePub = 'ff'.repeat(32);
  const script = '20' + oraclePub + 'ac' + 'c0'; // push32 + CHECKSIG + TXINPUTBLOCKDAASCORE
  const r = v.validateMarketScript(script, oraclePub);
  assert(r.analysis.hasChecksig, 'Market: has checksig');
  assert(r.analysis.hasTimeLock || r.analysis.hasTimelock || r.analysis.hasDaaCheck || r.analysis.hasCheckSequenceVerify, 'Market: has time-lock');

  const noKey = '20' + 'aa'.repeat(32) + 'ac' + 'c3';
  const r2 = v.validateMarketScript(noKey, 'bb'.repeat(32));
  assert(!r2.valid, 'Market: wrong oracle key → invalid');
  assert(r2.errors.some(e => e.includes('oracle pubkey')), 'Error mentions oracle pubkey');
}

// ─── Custom Script Validation ────────────────────────────
console.log('\n▸ Custom Script Validation');
{
  const custom = '20' + 'ab'.repeat(32) + 'ac' + 'c3';
  const r = v.validateCustomScript(custom);
  assert(r.badge !== undefined, 'Custom script gets badge: ' + r.badge);
  assert(r.isCustom === true, 'Marked as custom');
}

// ─── Disassembler ────────────────────────────────────────
console.log('\n▸ Disassembler');
{
  // OP_DUP OP_PUSH32 <data> OP_EQUALVERIFY OP_CHECKSIG
  const script = '76' + '20' + 'ab'.repeat(32) + '88' + 'ac';
  const ops = v.disassemble(script);
  assert(ops.length === 4, 'Disasm: 4 ops');
  assert(ops[0].op === 'OP_DUP', 'Op 0: OP_DUP');
  assert(ops[1].op === 'PUSH_32', 'Op 1: PUSH_32');
  assert(ops[1].hex === 'ab'.repeat(32), 'Op 1 data matches');
  assert(ops[2].op === 'OP_EQUALVERIFY', 'Op 2: OP_EQUALVERIFY');
  assert(ops[3].op === 'OP_CHECKSIG', 'Op 3: OP_CHECKSIG');

  // Small int opcodes
  const smalls = '00' + '51' + '52' + '53' + '60';
  const ops2 = v.disassemble(smalls);
  assert(ops2[0].op === 'OP_FALSE', 'Disasm OP_FALSE');
  assert(ops2[1].op === 'OP_1', 'Disasm OP_1');
  assert(ops2[2].op === 'OP_2', 'Disasm OP_2');
  assert(ops2[4].op === 'OP_16', 'Disasm OP_16');
}

// ─── Introspection Detection ─────────────────────────────
console.log('\n▸ Introspection Detection');
{
  // TXINPUTAMOUNT + TXOUTPUTAMOUNT
  const introScript = '20' + 'aa'.repeat(32) + 'ac' + 'be' + 'c2';
  const r = v.validate(introScript);
  assert(r.analysis.usesIntrospection, 'Detects introspection opcodes');

  const noIntro = '20' + 'aa'.repeat(32) + 'ac';
  const r2 = v.validate(noIntro);
  assert(!r2.analysis.usesIntrospection, 'No introspection when absent');
}

console.log('\n══════════════════════════════════════════');
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
