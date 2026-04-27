'use strict';

// ─── Poker Game Escrow Script ─────────────────────────────
// Extends the base game escrow with poker-specific options:
//   - Heads-up escrow for 2-player cash games
//   - Multi-player tournament escrow (oracle-settled)
//   - Timeout path so players can reclaim if opponent disconnects

const { OP, pushInt, pushBytes, pushPubkey } = require('./market-pool');
const { GAME_FEE_BPS } = require('./game-escrow');

const POKER_MIN_STAKE_SOMPI = 1e8; // 1 KAS minimum
const POKER_MAX_PLAYERS = 9;

/**
 * buildPokerEscrowScript
 * 
 * Options:
 *   mode: 'headsup' | 'tournament'
 *   playerAPubkey: hex string
 *   playerBPubkey: hex string (headsup only)
 *   oraclePubkeys: string[]
 *   multisigThreshold: number
 *   timeoutDaa: number   — DAA score after which players may claim timeout refund
 *   stakeSompi: number
 */
function buildPokerEscrowScript(params) {
  const {
    mode = 'headsup',
    playerAPubkey,
    playerBPubkey,
    oraclePubkeys = [],
    multisigThreshold = 2,
    timeoutDaa,
    stakeSompi,
  } = params;

  const s = [];

  function pushMs() {
    s.push(...pushInt(multisigThreshold));
    for (const pk of oraclePubkeys) s.push(...pushPubkey(pk));
    s.push(...pushInt(oraclePubkeys.length));
  }

  // PATH 1 — Oracle settle (winner payout)
  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 2 — Oracle draw/split
  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 3 — Mutual cancel (both players agree)
  s.push(OP.ELSE, OP.DUP, ...pushInt(3), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 4 — Timeout: either player claims after timeoutDaa
  s.push(OP.ELSE);
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE,
    ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  if (playerAPubkey) {
    s.push(...pushPubkey(playerAPubkey), OP.CHECKSIG, OP.IF,
      OP.TRUE,
      OP.ELSE);
  }
  if (playerBPubkey) {
    s.push(...pushPubkey(playerBPubkey), OP.CHECKSIG);
  } else {
    s.push(OP.TRUE);
  }
  if (playerAPubkey) s.push(OP.ENDIF);

  s.push(OP.BOOLAND);
  s.push(OP.ENDIF, OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode,
    hex: bytecode.toString('hex'),
    size: bytecode.length,
    mode,
    params: {
      playerAPubkey, playerBPubkey, oraclePubkeys,
      multisigThreshold, timeoutDaa, stakeSompi,
      feeBps: GAME_FEE_BPS,
    },
    paths: {
      settle: { id: 1, desc: 'Oracle settles with winner' },
      split:  { id: 2, desc: 'Oracle declares split pot' },
      cancel: { id: 3, desc: 'Mutual cancel, return stakes' },
      timeout:{ id: 4, desc: 'Claim after timeout (player sig required)' },
    },
  };
}

function buildPokerEscrowScriptSig(path, args = {}) {
  const sigs = [];
  if (args.sig1) sigs.push(...pushBytes(Buffer.from(args.sig1, 'hex')));
  if (args.sig2) sigs.push(...pushBytes(Buffer.from(args.sig2, 'hex')));
  switch (path) {
    case 'settle':  return Buffer.from([...sigs, ...pushInt(1)]);
    case 'split':   return Buffer.from([...sigs, ...pushInt(2)]);
    case 'cancel':  return Buffer.from([...sigs, ...pushInt(3)]);
    case 'timeout': return Buffer.from([...pushInt(4)]);
    default: throw new Error('Unknown poker escrow path: ' + path);
  }
}

/**
 * buildPokerTournamentEscrowScript
 * For multi-player tournaments where the oracle distributes prize pool.
 * All deposits go into a single UTXO; oracle multisig required for distribution.
 */
function buildPokerTournamentEscrowScript(params) {
  const {
    oraclePubkeys = [],
    multisigThreshold = 2,
    timeoutDaa,
    buyInSompi,
    maxPlayers = 9,
  } = params;

  const s = [];
  function pushMs() {
    s.push(...pushInt(multisigThreshold));
    for (const pk of oraclePubkeys) s.push(...pushPubkey(pk));
    s.push(...pushInt(oraclePubkeys.length));
  }

  // PATH 1 — Oracle distributes prizes
  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 2 — Oracle cancels, return all buy-ins
  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 3 — Timeout
  s.push(OP.ELSE);
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE,
    ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode,
    hex: bytecode.toString('hex'),
    size: bytecode.length,
    mode: 'tournament',
    params: { oraclePubkeys, multisigThreshold, timeoutDaa, buyInSompi, maxPlayers, feeBps: GAME_FEE_BPS },
    paths: {
      distribute: { id: 1, desc: 'Oracle distributes prize pool to finishers' },
      cancel:     { id: 2, desc: 'Oracle cancels, full refund' },
      timeout:    { id: 3, desc: 'Timeout emergency reclaim' },
    },
  };
}

module.exports = {
  POKER_MIN_STAKE_SOMPI,
  POKER_MAX_PLAYERS,
  buildPokerEscrowScript,
  buildPokerEscrowScriptSig,
  buildPokerTournamentEscrowScript,
  GAME_FEE_BPS,
};
