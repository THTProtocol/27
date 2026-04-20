'use strict';

const { OP, pushInt, pushBytes, pushPubkey } = require('./market-pool');

const BOND_AMOUNT_SOMPI = 100000000000;
const CHALLENGE_RATIO = 25;
const CHALLENGE_AMOUNT_SOMPI = BOND_AMOUNT_SOMPI * CHALLENGE_RATIO / 100;
const SLASH_CHALLENGER_PCT = 50;
const SLASH_BURN_PCT = 50;

function buildCreatorBondScript(params) {
  const { creatorPubkey, oraclePubkeys, multisigThreshold = 2, disputeWindowDaa, timeoutDaa } = params;
  if (!Array.isArray(oraclePubkeys) || oraclePubkeys.length < multisigThreshold)
    throw new Error('Need >= ' + multisigThreshold + ' oracle pubkeys');

  const s = [];
  function pushMs() {
    s.push(...pushInt(multisigThreshold));
    for (const pk of oraclePubkeys) s.push(...pushPubkey(pk));
    s.push(...pushInt(oraclePubkeys.length));
  }

  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  // PATH 1: REFUND
  s.push(OP.DROP); pushMs(); s.push(OP.CHECKMULTISIGVERIFY);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(disputeWindowDaa), OP.GREATERTHANOREQUAL);

  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  // PATH 2: SLASH
  s.push(OP.DROP); pushMs(); s.push(OP.CHECKMULTISIGVERIFY);
  s.push(OP.TXOUTPUTCOUNT, ...pushInt(2), OP.GREATERTHANOREQUAL);

  s.push(OP.ELSE, OP.DUP, ...pushInt(3), OP.NUMEQUAL, OP.IF);
  // PATH 3: TIMEOUT
  s.push(OP.DROP, ...pushPubkey(creatorPubkey), OP.CHECKSIGVERIFY);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);

  s.push(OP.ELSE);
  s.push(OP.DROP, OP.FALSE);
  s.push(OP.ENDIF, OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode, hex: bytecode.toString('hex'), size: bytecode.length,
    params: { creatorPubkey, oraclePubkeys, multisigThreshold, disputeWindowDaa, timeoutDaa,
              bondAmountSompi: BOND_AMOUNT_SOMPI, challengeAmountSompi: CHALLENGE_AMOUNT_SOMPI },
    paths: { refund: { id: 1 }, slash: { id: 2 }, timeout: { id: 3 } },
  };
}

function buildChallengeBondScript(params) {
  const { challengerPubkey, oraclePubkeys, multisigThreshold = 2 } = params;
  const s = [];
  function pushMs() {
    s.push(...pushInt(multisigThreshold));
    for (const pk of oraclePubkeys) s.push(...pushPubkey(pk));
    s.push(...pushInt(oraclePubkeys.length));
  }

  s.push(OP.IF);
  pushMs(); s.push(OP.CHECKMULTISIG);
  s.push(OP.ELSE);
  pushMs(); s.push(OP.CHECKMULTISIGVERIFY);
  s.push(OP.TXOUTPUTCOUNT, ...pushInt(2), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode, hex: bytecode.toString('hex'), size: bytecode.length,
    params: { challengerPubkey, oraclePubkeys, multisigThreshold, challengeAmountSompi: CHALLENGE_AMOUNT_SOMPI },
    paths: { upheld: { sig: '<sigs> OP_TRUE' }, rejected: { sig: '<sigs> OP_FALSE' } },
  };
}

module.exports = { BOND_AMOUNT_SOMPI, CHALLENGE_RATIO, CHALLENGE_AMOUNT_SOMPI,
  SLASH_CHALLENGER_PCT, SLASH_BURN_PCT, buildCreatorBondScript, buildChallengeBondScript };
