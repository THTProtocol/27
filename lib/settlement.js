'use strict';

const { calculateSpotPayouts, calculateMaximizerPayouts, calculateOpenPayouts } = require('./fees');
const { parseReceiptData } = require('./scripts/position-receipt');
const { MARKET_MODE } = require('./scripts/market-pool');

class SettlementEngine {
  constructor(txBuilder, rpc, db, indexer, oracleSigner) {
    this.txBuilder = txBuilder;
    this.rpc = rpc;
    this.db = db;
    this.indexer = indexer;
  }

  async resolveMarket(marketId, winningSide, oracleSig) {
    const market = this.db.getMarket(marketId);
    if (!market) throw new Error('Market not found: ' + marketId);
    if (market.status !== 'open') throw new Error('Market not open: ' + market.status);

    const utxos = this.indexer.getMarketUtxos(marketId);
    if (!utxos || !utxos.poolUtxo) throw new Error('Pool UTXO not found for market ' + marketId);

    const positions = this._parsePositions(utxos.receiptUtxos, market);
    const poolTotal = parseInt(utxos.poolUtxo.utxoEntry.amount);

    let result;
    const mode = market.marketMode;
    if (mode === MARKET_MODE.SPOT) {
      result = calculateSpotPayouts(positions, winningSide, poolTotal);
    } else if (mode === MARKET_MODE.MAXIMIZER) {
      result = calculateMaximizerPayouts(positions, winningSide, poolTotal);
    } else {
      result = calculateOpenPayouts(positions, winningSide, poolTotal);
    }

    if (this.indexer.needsBatching(marketId)) {
      return this._batchedResolve(market, utxos, winningSide, oracleSig, result);
    }

    const protocolAddr = this.db.getProtocolAddress();
    const tx = this.txBuilder.buildResolutionTx({
      poolUtxo: utxos.poolUtxo,
      receiptUtxos: utxos.receiptUtxos,
      bondUtxo: utxos.bondUtxo,
      outcomeByte: winningSide,
      payouts: result.payouts,
      protocolFeeSompi: result.protocolFeeSompi,
      oracleFeeSompi: 0,
      oracleSig,
      creatorAddr: market.creatorAddr,
      protocolAddr,
    });

    const txResult = await this.rpc.submitTransaction(tx.pskt);
    const txId = txResult.transactionId || txResult;

    this.db.resolveMarket(marketId, winningSide, txId, result.payouts);

    for (const p of result.payouts) {
      const user = this.db.getOrCreateUser(p.address);
      this.db.updateUser(p.address, {
        totalWon: user.totalWon + Math.max(0, p.profit),
      });
    }

    console.log('[SETTLEMENT] Market', marketId, 'resolved. TX:', txId);
    return { txId, payouts: result.payouts, protocolFee: result.protocolFeeSompi };
  }

  async _batchedResolve(market, utxos, winningSide, oracleSig, result) {
    const batches = this.indexer.getBatches(market.id, 50);
    const txIds = [];
    const protocolAddr = this.db.getProtocolAddress();

    for (let i = 0; i < batches.length; i++) {
      const batchReceipts = batches[i];
      const batchPayouts = result.payouts.filter(p =>
        batchReceipts.some(r => {
          try {
            const data = parseReceiptData(r.utxoEntry.scriptPublicKey.script);
            return data.userPubkey === p.userPubkey;
          } catch { return false; }
        })
      );

      const isLast = i === batches.length - 1;
      const batchFee = isLast ? result.protocolFeeSompi : 0;

      const tx = this.txBuilder.buildResolutionTx({
        poolUtxo: i === 0 ? utxos.poolUtxo : null,
        receiptUtxos: batchReceipts,
        bondUtxo: isLast ? utxos.bondUtxo : null,
        outcomeByte: winningSide,
        payouts: batchPayouts,
        protocolFeeSompi: batchFee,
        oracleFeeSompi: 0,
        oracleSig,
        creatorAddr: market.creatorAddr,
        protocolAddr,
      });

      const txResult = await this.rpc.submitTransaction(tx.pskt);
      txIds.push(txResult.transactionId || txResult);
      console.log('[SETTLEMENT] Batch', i + 1, '/', batches.length, 'submitted');
    }

    this.db.resolveMarket(market.id, winningSide, txIds[0], result.payouts);
    return { txIds, payouts: result.payouts, protocolFee: result.protocolFeeSompi };
  }

  async settleGame(gameId, winnerId, oracleSigs) {
    const game = this.db.getGame(gameId);
    if (!game) throw new Error('Game not found: ' + gameId);

    // If oracleSigner available, build PSKT and store as pending — don't self-submit
    if (this.oracleSigner) {
      const escrowUtxo = this.indexer.getGameUtxo(gameId);
      if (escrowUtxo) {
        try {
          const psktResult = winnerId === 'draw'
            ? await this.oracleSigner.buildDrawPskt(game, escrowUtxo)
            : await this.oracleSigner.buildPayoutPskt(game, escrowUtxo);
          this.db.updateGame(gameId, { pendingPskt: psktResult.pskt });
          return { pskt: psktResult.pskt, gameId, winner: winnerId };
        } catch(e) {
          console.error('[Settlement] PSKT build failed:', e.message);
        }
      }
    }
    throw new Error('PSKT not available — escrow UTXO not found');
  }


  async timeoutRefund(marketId) {
    const market = this.db.getMarket(marketId);
    if (!market) throw new Error('Market not found');

    const utxos = this.indexer.getMarketUtxos(marketId);
    if (!utxos || !utxos.poolUtxo) throw new Error('Pool UTXO not found');

    const tx = this.txBuilder.buildTimeoutRefundTx({
      poolUtxo: utxos.poolUtxo,
      receiptUtxos: utxos.receiptUtxos,
      bondUtxo: utxos.bondUtxo,
      creatorAddr: market.creatorAddr,
    });

    const txResult = await this.rpc.submitTransaction(tx.pskt);
    const txId = txResult.transactionId || txResult;

    this.db.updateMarket(marketId, { status: 'refunded', resolutionTxId: txId });
    console.log('[SETTLEMENT] Market', marketId, 'timeout refund. TX:', txId);
    return { txId };
  }

  _parsePositions(receiptUtxos, market) {
    const positions = [];
    for (const r of receiptUtxos) {
      try {
        const data = parseReceiptData(r.utxoEntry.scriptPublicKey.script);
        const dbPos = market.positions.find(p => p.userPubkey === data.userPubkey && p.side === data.side);
        positions.push({
          userPubkey: data.userPubkey,
          userAddr: dbPos ? dbPos.userAddr : '',
          side: data.side,
          riskMode: data.riskMode,
          amountSompi: data.amountSompi,
        });
      } catch (e) {
        console.error('[SETTLEMENT] Failed to parse receipt:', e.message);
      }
    }
    return positions;
  }
}

module.exports = SettlementEngine;
