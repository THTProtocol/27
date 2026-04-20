'use strict';

const { buildMarketPoolScript, buildMarketPoolScriptSig, MARKET_MODE, pushInt, pushBytes } = require('./scripts/market-pool');
const { buildPositionReceiptScript, parseReceiptData, RISK_MODE, SIDE } = require('./scripts/position-receipt');
const { buildCreatorBondScript, buildChallengeBondScript, BOND_AMOUNT_SOMPI, CHALLENGE_AMOUNT_SOMPI } = require('./scripts/creator-bond');
const { buildGameEscrowScript, GAME_FEE_BPS } = require('./scripts/game-escrow');

const SOMPI_PER_KAS = 100000000;
const DUST_SOMPI = 300;
const DEFAULT_FEE_SOMPI = 30000;

class TxBuilder {
  constructor(rpc, config = {}) {
    this.rpc = rpc;
    this.protocolSpkHex = config.protocolSpkHex || '';
    this.protocolFeeBps = config.protocolFeeBps || 200;
    this.oraclePubkeys = config.oraclePubkeys || [];
    this.multisigThreshold = config.multisigThreshold || 2;
  }

  _pskt(inputs, outputs, meta = {}) {
    return {
      version: 0,
      inputs: inputs.map(inp => ({
        previousOutpoint: { transactionId: inp.txId, index: inp.index },
        signatureScript: inp.signatureScript || '',
        sequence: BigInt(0).toString(),
        sigOpCount: inp.sigOpCount || 1,
        utxoEntry: inp.utxoEntry || null,
        redeemScript: inp.redeemScript || null,
        sighashType: inp.sighashType || 1,
        owner: inp.owner || null,
      })),
      outputs: outputs.map(out => ({
        value: BigInt(out.value).toString(),
        scriptPublicKey: { version: out.scriptVersion || 0, script: out.script },
      })),
      ...meta,
    };
  }

  // 1. Market Genesis
  buildMarketGenesisTx(params) {
    const {
      creatorAddr, creatorPubkey, creatorUtxos, oraclePubkey,
      closeDaa, oracleWindowDaa, graceDaa,
      minPositionSompi = SOMPI_PER_KAS, marketMode = MARKET_MODE.OPEN,
    } = params;

    const pool = buildMarketPoolScript({
      oraclePubkey, protocolSpkHex: this.protocolSpkHex,
      closeDaa, oracleWindowDaa, graceDaa,
      protocolFeeBps: this.protocolFeeBps, minPositionSompi, marketMode,
    });

    const timeoutDaa = pool.params.timeoutDaa;
    const disputeWindowDaa = closeDaa + oracleWindowDaa + Math.floor(graceDaa / 2);

    const bond = buildCreatorBondScript({
      creatorPubkey, oraclePubkeys: this.oraclePubkeys,
      multisigThreshold: this.multisigThreshold, disputeWindowDaa, timeoutDaa,
    });

    const seedAmount = SOMPI_PER_KAS;
    const totalNeeded = seedAmount + BOND_AMOUNT_SOMPI + DEFAULT_FEE_SOMPI;
    const { selected, total } = this._selectUtxos(creatorUtxos, totalNeeded);
    const change = total - seedAmount - BOND_AMOUNT_SOMPI - DEFAULT_FEE_SOMPI;

    const inputs = selected.map(u => ({
      txId: u.outpoint.transactionId, index: u.outpoint.index,
      utxoEntry: u.utxoEntry, owner: creatorAddr,
    }));
    const outputs = [
      { value: seedAmount, script: pool.hex, scriptVersion: 0 },
      { value: BOND_AMOUNT_SOMPI, script: bond.hex, scriptVersion: 0 },
    ];
    if (change > DUST_SOMPI) outputs.push({ value: change, script: this._addrToSpk(creatorAddr) });

    return { pskt: this._pskt(inputs, outputs, { type: 'marketGenesis' }), poolScript: pool, bondScript: bond, closeDaa, timeoutDaa };
  }

  // 2. Position
  buildPositionTx(params) {
    const { poolUtxo, userAddr, userPubkey, userUtxos, side, riskMode, amountSompi, oraclePubkey, timeoutDaa } = params;

    const receipt = buildPositionReceiptScript({ userPubkey, oraclePubkey, side, amountSompi, riskMode, timeoutDaa });
    const currentPoolAmount = parseInt(poolUtxo.utxoEntry.amount);
    const newPoolAmount = currentPoolAmount + amountSompi;
    const totalNeeded = amountSompi + DEFAULT_FEE_SOMPI;
    const { selected, total } = this._selectUtxos(userUtxos, totalNeeded);
    const change = total - amountSompi - DEFAULT_FEE_SOMPI;

    const inputs = [
      { txId: poolUtxo.outpoint.transactionId, index: poolUtxo.outpoint.index,
        signatureScript: buildMarketPoolScriptSig('addPosition').toString('hex'),
        utxoEntry: poolUtxo.utxoEntry, sigOpCount: 0 },
      ...selected.map(u => ({
        txId: u.outpoint.transactionId, index: u.outpoint.index,
        utxoEntry: u.utxoEntry, owner: userAddr,
      })),
    ];
    const outputs = [
      { value: newPoolAmount, script: poolUtxo.utxoEntry.scriptPublicKey.script, scriptVersion: 0 },
      { value: DUST_SOMPI, script: receipt.hex, scriptVersion: 0 },
    ];
    if (change > DUST_SOMPI) outputs.push({ value: change, script: this._addrToSpk(userAddr) });

    return { pskt: this._pskt(inputs, outputs, { type: 'position' }), receiptScript: receipt };
  }

  // 3. Resolution
  buildResolutionTx(params) {
    const { poolUtxo, receiptUtxos, bondUtxo, outcomeByte, payouts,
            protocolFeeSompi, oracleFeeSompi, oracleSig, creatorAddr, protocolAddr } = params;

    const inputs = [
      { txId: poolUtxo.outpoint.transactionId, index: poolUtxo.outpoint.index,
        signatureScript: buildMarketPoolScriptSig('resolve', { oracleSig, outcomeByte }).toString('hex'),
        utxoEntry: poolUtxo.utxoEntry, sigOpCount: 1 },
      ...receiptUtxos.map(r => ({
        txId: r.outpoint.transactionId, index: r.outpoint.index,
        signatureScript: '', utxoEntry: r.utxoEntry, sigOpCount: 1,
      })),
    ];
    if (bondUtxo) {
      inputs.push({ txId: bondUtxo.outpoint.transactionId, index: bondUtxo.outpoint.index,
        signatureScript: '', utxoEntry: bondUtxo.utxoEntry, sigOpCount: 2 });
    }

    const outputs = [];
    for (const p of payouts) {
      if (p.amountSompi > DUST_SOMPI) outputs.push({ value: p.amountSompi, script: this._addrToSpk(p.address) });
    }
    if (protocolFeeSompi > DUST_SOMPI) outputs.push({ value: protocolFeeSompi, script: this._addrToSpk(protocolAddr) });
    if (oracleFeeSompi > DUST_SOMPI) outputs.push({ value: oracleFeeSompi, script: this._addrToSpk(protocolAddr) });
    if (bondUtxo) outputs.push({ value: BOND_AMOUNT_SOMPI - DEFAULT_FEE_SOMPI, script: this._addrToSpk(creatorAddr) });

    return { pskt: this._pskt(inputs, outputs, { type: 'resolution' }) };
  }

  // 4. Timeout Refund
  buildTimeoutRefundTx(params) {
    const { poolUtxo, receiptUtxos, bondUtxo, creatorAddr } = params;
    const inputs = [
      { txId: poolUtxo.outpoint.transactionId, index: poolUtxo.outpoint.index,
        signatureScript: buildMarketPoolScriptSig('timeout').toString('hex'),
        utxoEntry: poolUtxo.utxoEntry, sigOpCount: 0 },
    ];
    const outputs = [];

    for (const r of receiptUtxos) {
      const script = r.utxoEntry.scriptPublicKey.script;
      const data = parseReceiptData(script);
      inputs.push({ txId: r.outpoint.transactionId, index: r.outpoint.index,
        signatureScript: '', utxoEntry: r.utxoEntry, owner: data.userPubkey });
      outputs.push({ value: data.amountSompi, script: this._pubkeyToSpk(data.userPubkey) });
    }
    if (bondUtxo) {
      inputs.push({ txId: bondUtxo.outpoint.transactionId, index: bondUtxo.outpoint.index,
        signatureScript: '', utxoEntry: bondUtxo.utxoEntry, owner: creatorAddr });
      outputs.push({ value: BOND_AMOUNT_SOMPI - DEFAULT_FEE_SOMPI, script: this._addrToSpk(creatorAddr) });
    }

    return { pskt: this._pskt(inputs, outputs, { type: 'timeoutRefund' }) };
  }

  // 5. Game Escrow Genesis
  buildGameEscrowTx(params) {
    const { playerAPubkey, playerAddr, playerUtxos, stakeSompi, timeoutDaa } = params;
    const escrow = buildGameEscrowScript({
      playerAPubkey, playerBPubkey: null,
      oraclePubkeys: this.oraclePubkeys, multisigThreshold: this.multisigThreshold,
      timeoutDaa, stakeSompi,
    });
    const totalNeeded = stakeSompi + DEFAULT_FEE_SOMPI;
    const { selected, total } = this._selectUtxos(playerUtxos, totalNeeded);
    const change = total - stakeSompi - DEFAULT_FEE_SOMPI;

    const inputs = selected.map(u => ({
      txId: u.outpoint.transactionId, index: u.outpoint.index,
      utxoEntry: u.utxoEntry, owner: playerAddr,
    }));
    const outputs = [{ value: stakeSompi, script: escrow.hex, scriptVersion: 0 }];
    if (change > DUST_SOMPI) outputs.push({ value: change, script: this._addrToSpk(playerAddr) });

    return { pskt: this._pskt(inputs, outputs, { type: 'gameEscrow' }), escrowScript: escrow };
  }

  // 6. Game Join
  buildGameJoinTx(params) {
    const { escrowUtxo, playerBPubkey, playerBAddr, playerBUtxos, stakeSompi, playerAPubkey, timeoutDaa } = params;
    const newEscrow = buildGameEscrowScript({
      playerAPubkey, playerBPubkey,
      oraclePubkeys: this.oraclePubkeys, multisigThreshold: this.multisigThreshold,
      timeoutDaa, stakeSompi,
    });
    const totalNeeded = stakeSompi + DEFAULT_FEE_SOMPI;
    const { selected, total } = this._selectUtxos(playerBUtxos, totalNeeded);
    const change = total - stakeSompi - DEFAULT_FEE_SOMPI;
    const currentAmount = parseInt(escrowUtxo.utxoEntry.amount);

    const inputs = [
      { txId: escrowUtxo.outpoint.transactionId, index: escrowUtxo.outpoint.index,
        utxoEntry: escrowUtxo.utxoEntry, sigOpCount: 0 },
      ...selected.map(u => ({ txId: u.outpoint.transactionId, index: u.outpoint.index,
        utxoEntry: u.utxoEntry, owner: playerBAddr })),
    ];
    const outputs = [{ value: currentAmount + stakeSompi, script: newEscrow.hex, scriptVersion: 0 }];
    if (change > DUST_SOMPI) outputs.push({ value: change, script: this._addrToSpk(playerBAddr) });

    return { pskt: this._pskt(inputs, outputs, { type: 'gameJoin' }), escrowScript: newEscrow };
  }

  // 7. Game Settle
  buildGameSettleTx(params) {
    const { escrowUtxo, winnerAddr, protocolAddr, potSompi } = params;
    const fee = Math.floor(potSompi * GAME_FEE_BPS / 10000);
    const winnerPayout = potSompi - fee - DEFAULT_FEE_SOMPI;
    const inputs = [{ txId: escrowUtxo.outpoint.transactionId, index: escrowUtxo.outpoint.index,
      signatureScript: '', utxoEntry: escrowUtxo.utxoEntry, sigOpCount: 2 }];
    const outputs = [
      { value: winnerPayout, script: this._addrToSpk(winnerAddr) },
      { value: fee, script: this._addrToSpk(protocolAddr) },
    ];
    return { pskt: this._pskt(inputs, outputs, { type: 'gameSettle' }) };
  }

  // 8. Game Draw
  buildGameDrawTx(params) {
    const { escrowUtxo, playerAAddr, playerBAddr, protocolAddr, stakeSompi } = params;
    const pot = stakeSompi * 2;
    const fee = Math.floor(pot * GAME_FEE_BPS / 10000);
    const perPlayer = Math.floor((pot - fee - DEFAULT_FEE_SOMPI) / 2);
    const inputs = [{ txId: escrowUtxo.outpoint.transactionId, index: escrowUtxo.outpoint.index,
      signatureScript: '', utxoEntry: escrowUtxo.utxoEntry, sigOpCount: 2 }];
    const outputs = [
      { value: perPlayer, script: this._addrToSpk(playerAAddr) },
      { value: perPlayer, script: this._addrToSpk(playerBAddr) },
      { value: fee, script: this._addrToSpk(protocolAddr) },
    ];
    return { pskt: this._pskt(inputs, outputs, { type: 'gameDraw' }) };
  }

  // 9. Game Cancel
  buildGameCancelTx(params) {
    const { escrowUtxo, playerAAddr, playerBAddr, stakeSompi, singlePlayer } = params;
    const inputs = [{ txId: escrowUtxo.outpoint.transactionId, index: escrowUtxo.outpoint.index,
      signatureScript: '', utxoEntry: escrowUtxo.utxoEntry, sigOpCount: 2 }];
    const outputs = [];
    if (singlePlayer) {
      outputs.push({ value: stakeSompi - DEFAULT_FEE_SOMPI, script: this._addrToSpk(playerAAddr) });
    } else {
      const pp = stakeSompi - Math.floor(DEFAULT_FEE_SOMPI / 2);
      outputs.push({ value: pp, script: this._addrToSpk(playerAAddr) });
      outputs.push({ value: pp, script: this._addrToSpk(playerBAddr) });
    }
    return { pskt: this._pskt(inputs, outputs, { type: 'gameCancel' }) };
  }

  // 10. Challenge Bond
  buildChallengeTx(params) {
    const { challengerAddr, challengerPubkey, challengerUtxos } = params;
    const challengeScript = buildChallengeBondScript({
      challengerPubkey, oraclePubkeys: this.oraclePubkeys,
      multisigThreshold: this.multisigThreshold,
    });
    const totalNeeded = CHALLENGE_AMOUNT_SOMPI + DEFAULT_FEE_SOMPI;
    const { selected, total } = this._selectUtxos(challengerUtxos, totalNeeded);
    const change = total - CHALLENGE_AMOUNT_SOMPI - DEFAULT_FEE_SOMPI;
    const inputs = selected.map(u => ({ txId: u.outpoint.transactionId, index: u.outpoint.index,
      utxoEntry: u.utxoEntry, owner: challengerAddr }));
    const outputs = [{ value: CHALLENGE_AMOUNT_SOMPI, script: challengeScript.hex, scriptVersion: 0 }];
    if (change > DUST_SOMPI) outputs.push({ value: change, script: this._addrToSpk(challengerAddr) });
    return { pskt: this._pskt(inputs, outputs, { type: 'challenge' }), challengeScript };
  }

  // 11. Slash
  buildSlashTx(params) {
    const { bondUtxo, challengeUtxo, challengerAddr } = params;
    const bondAmt = parseInt(bondUtxo.utxoEntry.amount);
    const chalAmt = parseInt(challengeUtxo.utxoEntry.amount);
    const challengerPayout = Math.floor(bondAmt / 2) + chalAmt;
    const burnAmount = bondAmt - Math.floor(bondAmt / 2) - DEFAULT_FEE_SOMPI;
    const inputs = [
      { txId: bondUtxo.outpoint.transactionId, index: bondUtxo.outpoint.index,
        signatureScript: '', utxoEntry: bondUtxo.utxoEntry, sigOpCount: 2 },
      { txId: challengeUtxo.outpoint.transactionId, index: challengeUtxo.outpoint.index,
        signatureScript: '', utxoEntry: challengeUtxo.utxoEntry, sigOpCount: 2 },
    ];
    const outputs = [
      { value: challengerPayout, script: this._addrToSpk(challengerAddr) },
      { value: burnAmount, script: '6a' },
    ];
    return { pskt: this._pskt(inputs, outputs, { type: 'slash' }) };
  }

  // 12. Bond Refund
  buildBondRefundTx(params) {
    const { bondUtxo, creatorAddr } = params;
    const bondAmt = parseInt(bondUtxo.utxoEntry.amount);
    const inputs = [{ txId: bondUtxo.outpoint.transactionId, index: bondUtxo.outpoint.index,
      signatureScript: '', utxoEntry: bondUtxo.utxoEntry, sigOpCount: 2 }];
    const outputs = [{ value: bondAmt - DEFAULT_FEE_SOMPI, script: this._addrToSpk(creatorAddr) }];
    return { pskt: this._pskt(inputs, outputs, { type: 'bondRefund' }) };
  }

  _selectUtxos(utxos, targetSompi) {
    const sorted = [...utxos].sort((a, b) => {
      const aAmt = parseInt(a.utxoEntry?.amount || a.amount || '0');
      const bAmt = parseInt(b.utxoEntry?.amount || b.amount || '0');
      return bAmt - aAmt;
    });
    const selected = [];
    let total = 0;
    for (const u of sorted) {
      selected.push(u);
      total += parseInt(u.utxoEntry?.amount || u.amount || '0');
      if (total >= targetSompi) break;
    }
    if (total < targetSompi) throw new Error('Insufficient funds: need ' + targetSompi + ' sompi, have ' + total);
    return { selected, total };
  }

  _addrToSpk(addr) {
    if (!addr) return '';
    if (addr.startsWith('kaspa:') || addr.startsWith('kaspatest:')) {
      const parts = addr.split(':');
      return '20' + parts[1].slice(0, 64) + 'ac';
    }
    return addr;
  }

  _pubkeyToSpk(pubkeyHex) {
    return '20' + pubkeyHex + 'ac';
  }
}

module.exports = TxBuilder;
