'use strict';

// ─── Blackjack Game Escrow Script Builder ──────────────────
// Blackjack is player-vs-house so the escrow pattern is:
//   - Player deposits stake into escrow
//   - Oracle (server) acts as "dealer" and signs resolution
//   - Win: player receives 2x stake (minus protocol fee)
//   - Blackjack: player receives 2.5x stake
//   - Lose: stake goes to protocol treasury
//   - Push: stake returned to player

const { OP, pushInt, pushBytes, pushPubkey } = require('./market-pool');
const { GAME_FEE_BPS } = require('./game-escrow');

const BJ_MIN_STAKE_SOMPI = 5e7; // 0.5 KAS minimum
const BJ_MAX_STAKE_SOMPI = 100e8; // 100 KAS maximum

/**
 * buildBlackjackEscrowScript
 *
 * Paths:
 *   1 = Player wins (oracle signs, pay out 2x)
 *   2 = Player wins blackjack (oracle signs, pay out 2.5x)
 *   3 = Push (oracle signs, return stake)
 *   4 = Player loses (oracle signs, send to treasury)
 *   5 = Timeout (player reclaims if oracle never resolves)
 */
function buildBlackjackEscrowScript(params) {
  const {
    playerPubkey,
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

  // PATH 1 — Player wins (normal)
  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 2 — Player wins blackjack
  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 3 — Push (return stake)
  s.push(OP.ELSE, OP.DUP, ...pushInt(3), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 4 — Player loses (protocol claims)
  s.push(OP.ELSE, OP.DUP, ...pushInt(4), OP.NUMEQUAL, OP.IF);
  s.push(OP.DROP, OP.DROP);
  pushMs();
  s.push(OP.CHECKMULTISIG);

  // PATH 5 — Timeout (player reclaims)
  s.push(OP.ELSE);
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE,
    ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(...pushPubkey(playerPubkey), OP.CHECKSIG, OP.BOOLAND);
  s.push(OP.ENDIF, OP.ENDIF, OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode,
    hex: bytecode.toString('hex'),
    size: bytecode.length,
    params: { playerPubkey, oraclePubkeys, multisigThreshold, timeoutDaa, stakeSompi, feeBps: GAME_FEE_BPS },
    paths: {
      playerWin:  { id: 1, payout: stakeSompi * 2 },
      blackjack:  { id: 2, payout: Math.floor(stakeSompi * 2.5) },
      push:       { id: 3, payout: stakeSompi },
      playerLose: { id: 4, payout: 0 },
      timeout:    { id: 5, payout: stakeSompi },
    },
  };
}

function buildBlackjackEscrowScriptSig(path, args = {}) {
  const sigs = [];
  if (args.sig1) sigs.push(...pushBytes(Buffer.from(args.sig1, 'hex')));
  if (args.sig2) sigs.push(...pushBytes(Buffer.from(args.sig2, 'hex')));
  switch (path) {
    case 'playerWin':  return Buffer.from([...sigs, ...pushInt(1)]);
    case 'blackjack':  return Buffer.from([...sigs, ...pushInt(2)]);
    case 'push':       return Buffer.from([...sigs, ...pushInt(3)]);
    case 'playerLose': return Buffer.from([...sigs, ...pushInt(4)]);
    case 'timeout':    return Buffer.from([...pushInt(5)]);
    default: throw new Error('Unknown blackjack escrow path: ' + path);
  }
}

/**
 * buildBlackjackSettleTx (convenience)
 * Returns output instructions for the settlement engine.
 */
function buildBlackjackSettleTx(params) {
  const { escrowUtxo, playerAddr, protocolAddr, path, stakeSompi, txBuilder } = params;
  const escrowAmt = parseInt(escrowUtxo.utxoEntry.amount);
  const fee = Math.floor(escrowAmt * GAME_FEE_BPS / 10000);
  const DEFAULT_FEE = 30000;

  let outputs;
  switch (path) {
    case 'playerWin':
      outputs = [
        { value: escrowAmt - fee - DEFAULT_FEE, script: txBuilder._addrToSpk(playerAddr) },
        { value: fee, script: txBuilder._addrToSpk(protocolAddr) },
      ];
      break;
    case 'blackjack': {
      // Protocol tops up to 2.5x from treasury — here we just distribute what's in escrow
      // (In production: protocol pre-funds the escrow with extra 0.5x at game start)
      const bjPayout = Math.min(Math.floor(stakeSompi * 2.5), escrowAmt) - fee - DEFAULT_FEE;
      outputs = [
        { value: bjPayout, script: txBuilder._addrToSpk(playerAddr) },
        { value: escrowAmt - bjPayout - DEFAULT_FEE, script: txBuilder._addrToSpk(protocolAddr) },
      ];
      break;
    }
    case 'push':
      outputs = [
        { value: escrowAmt - fee - DEFAULT_FEE, script: txBuilder._addrToSpk(playerAddr) },
        { value: fee, script: txBuilder._addrToSpk(protocolAddr) },
      ];
      break;
    case 'playerLose':
      outputs = [
        { value: escrowAmt - DEFAULT_FEE, script: txBuilder._addrToSpk(protocolAddr) },
      ];
      break;
    default:
      throw new Error('Unknown path: ' + path);
  }
  return outputs;
}

module.exports = {
  BJ_MIN_STAKE_SOMPI,
  BJ_MAX_STAKE_SOMPI,
  buildBlackjackEscrowScript,
  buildBlackjackEscrowScriptSig,
  buildBlackjackSettleTx,
  GAME_FEE_BPS,
};
