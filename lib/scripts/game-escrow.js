'use strict';

const { OP, pushInt, pushBytes, pushPubkey } = require('./market-pool');

const GAME_FEE_BPS = 200;
const WINNER = Object.freeze({ PLAYER_A: 0x01, PLAYER_B: 0x02 });

function buildGameEscrowScript(params) {
  const { playerAPubkey, playerBPubkey, oraclePubkeys, multisigThreshold = 2, timeoutDaa, stakeSompi } = params;
  const s = [];
  function pushMs() {
    s.push(...pushInt(multisigThreshold));
    for (const pk of oraclePubkeys) s.push(...pushPubkey(pk));
    s.push(...pushInt(oraclePubkeys.length));
  }

  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  // PATH 1: SETTLE
  s.push(OP.DROP, OP.DROP); pushMs(); s.push(OP.CHECKMULTISIG);

  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  // PATH 2: DRAW
  s.push(OP.DROP); pushMs(); s.push(OP.CHECKMULTISIG);

  s.push(OP.ELSE, OP.DUP, ...pushInt(3), OP.NUMEQUAL, OP.IF);
  // PATH 3: CANCEL
  s.push(OP.DROP); pushMs(); s.push(OP.CHECKMULTISIG);

  s.push(OP.ELSE);
  // PATH 4: TIMEOUT
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF, OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode, hex: bytecode.toString('hex'), size: bytecode.length,
    params: { playerAPubkey, playerBPubkey, oraclePubkeys, multisigThreshold, timeoutDaa, stakeSompi, feeBps: GAME_FEE_BPS },
    paths: { settle: { id: 1 }, draw: { id: 2 }, cancel: { id: 3 }, timeout: { id: 4 } },
  };
}

function buildGameEscrowScriptSig(path, args = {}) {
  const sigs = [];
  if (args.sig1) sigs.push(...pushBytes(args.sig1));
  if (args.sig2) sigs.push(...pushBytes(args.sig2));
  switch (path) {
    case 'settle':
      if (!args.winnerByte) throw new Error('settle needs winnerByte');
      return Buffer.from([...sigs, ...pushInt(args.winnerByte), ...pushInt(1)]);
    case 'draw': return Buffer.from([...sigs, ...pushInt(2)]);
    case 'cancel': return Buffer.from([...sigs, ...pushInt(3)]);
    case 'timeout': return Buffer.from([...pushInt(4)]);
    default: throw new Error('Unknown path: ' + path);
  }
}

module.exports = { GAME_FEE_BPS, WINNER, buildGameEscrowScript, buildGameEscrowScriptSig };
