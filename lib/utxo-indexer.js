'use strict';

const EventEmitter = require('events');
const { parseReceiptData } = require('./scripts/position-receipt');

class UtxoIndexer extends EventEmitter {
  constructor(rpc, db) {
    super();
    this.rpc = rpc;
    this.db = db;
    this.tracked = new Map();
    this.pollInterval = null;
    this.pollMs = 5000;
  }

  async start() {
    console.log('[INDEXER] Starting UTXO indexer...');
    await this._pollAll();
    this.pollInterval = setInterval(() => this._pollAll().catch(e => {
      console.error('[INDEXER] Poll error:', e.message);
    }), this.pollMs);

    this.rpc.on('notifyUtxosChangedNotification', (params) => {
      this._handleUtxoNotification(params);
    });
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  trackMarket(marketId, poolScriptHex, bondScriptHex) {
    this.tracked.set(marketId, {
      type: 'market',
      poolScript: poolScriptHex,
      bondScript: bondScriptHex,
      poolUtxo: null,
      bondUtxo: null,
      receiptUtxos: [],
    });
  }

  trackGame(gameId, escrowScriptHex) {
    this.tracked.set(gameId, {
      type: 'game',
      escrowScript: escrowScriptHex,
      escrowUtxo: null,
    });
  }

  untrack(id) {
    this.tracked.delete(id);
  }

  getMarketUtxos(marketId) {
    const entry = this.tracked.get(marketId);
    if (!entry || entry.type !== 'market') return null;
    return {
      poolUtxo: entry.poolUtxo,
      bondUtxo: entry.bondUtxo,
      receiptUtxos: [...entry.receiptUtxos],
    };
  }

  getGameUtxo(gameId) {
    const entry = this.tracked.get(gameId);
    if (!entry || entry.type !== 'game') return null;
    return entry.escrowUtxo;
  }

  getPoolAmount(marketId) {
    const entry = this.tracked.get(marketId);
    if (!entry || !entry.poolUtxo) return 0;
    return parseInt(entry.poolUtxo.utxoEntry.amount || '0');
  }

  getReceiptCount(marketId) {
    const entry = this.tracked.get(marketId);
    if (!entry) return 0;
    return entry.receiptUtxos.length;
  }

  getPositionsByUser(marketId, userPubkey) {
    const entry = this.tracked.get(marketId);
    if (!entry) return [];
    return entry.receiptUtxos.filter(r => {
      try {
        const data = parseReceiptData(r.utxoEntry.scriptPublicKey.script);
        return data.userPubkey === userPubkey;
      } catch { return false; }
    });
  }

  getMarketSideTotals(marketId) {
    const entry = this.tracked.get(marketId);
    if (!entry) return { sideA: 0, sideB: 0 };
    let sideA = 0, sideB = 0;
    for (const r of entry.receiptUtxos) {
      try {
        const data = parseReceiptData(r.utxoEntry.scriptPublicKey.script);
        if (data.side === 1) sideA += data.amountSompi;
        else if (data.side === 2) sideB += data.amountSompi;
      } catch {}
    }
    return { sideA, sideB };
  }

  async _pollAll() {
    for (const [id, entry] of this.tracked) {
      try {
        if (entry.type === 'market') await this._pollMarket(id, entry);
        else if (entry.type === 'game') await this._pollGame(id, entry);
      } catch (e) {
        console.error('[INDEXER] Poll failed for', id, e.message);
      }
    }
  }

  async _pollMarket(marketId, entry) {
    const allUtxos = await this._getUtxosByScript(entry.poolScript);
    const poolUtxo = allUtxos.length > 0
      ? allUtxos.reduce((a, b) => parseInt(a.utxoEntry.amount) > parseInt(b.utxoEntry.amount) ? a : b)
      : null;

    const prevAmount = entry.poolUtxo ? parseInt(entry.poolUtxo.utxoEntry.amount) : 0;
    const newAmount = poolUtxo ? parseInt(poolUtxo.utxoEntry.amount) : 0;
    entry.poolUtxo = poolUtxo;

    if (newAmount !== prevAmount) {
      this.emit('pool-updated', { marketId, amount: newAmount, utxo: poolUtxo });
      if (this.db) {
        await this.db.updateMarketPool(marketId, newAmount);
      }
    }

    const receiptUtxos = await this._findReceipts(marketId);
    const prevCount = entry.receiptUtxos.length;
    entry.receiptUtxos = receiptUtxos;

    if (receiptUtxos.length !== prevCount) {
      const totals = this.getMarketSideTotals(marketId);
      this.emit('receipts-updated', { marketId, count: receiptUtxos.length, totals });
    }

    if (entry.bondScript) {
      const bondUtxos = await this._getUtxosByScript(entry.bondScript);
      entry.bondUtxo = bondUtxos.length > 0 ? bondUtxos[0] : null;
    }
  }

  async _pollGame(gameId, entry) {
    const utxos = await this._getUtxosByScript(entry.escrowScript);
    const prev = entry.escrowUtxo;
    entry.escrowUtxo = utxos.length > 0 ? utxos[0] : null;

    if (!prev && entry.escrowUtxo) {
      this.emit('escrow-funded', { gameId, utxo: entry.escrowUtxo });
    } else if (prev && !entry.escrowUtxo) {
      this.emit('escrow-spent', { gameId });
    }
  }

  async _getUtxosByScript(scriptHex) {
    try {
      // Scan mempool for transactions that might contain our covenant scripts
      const mempool = await this.rpc.getMempoolEntries().catch(() => []);
      const results = [];
      const entries = Array.isArray(mempool) ? mempool : [];
      
      for (const entry of entries) {
        const txId = typeof entry === 'string' ? entry : (entry.transactionId || entry.txId || '');
        if (!txId) continue;
        try {
          const tx = await this.rpc.getTransaction(txId);
          for (let i = 0; i < (tx.outputs || []).length; i++) {
            const out = tx.outputs[i];
            if (out.scriptPublicKey && out.scriptPublicKey.script === scriptHex) {
              results.push({
                outpoint: { transactionId: txId, index: i },
                utxoEntry: {
                  amount: String(out.value),
                  scriptPublicKey: out.scriptPublicKey
                }
              });
            }
          }
        } catch (e) {
          // Transaction might not be available, skip
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async _findReceipts(marketId) {
    const market = this.db ? await this.db.getMarket(marketId) : null;
    if (!market || !market.receiptScripts) return [];

    const receipts = [];
    for (const rScript of market.receiptScripts) {
      const utxos = await this._getUtxosByScript(rScript);
      receipts.push(...utxos);
    }
    return receipts;
  }

  async _handleUtxoNotification(params) {
    if (!params) return;
    const added = params.added || [];
    const removed = params.removed || [];

    for (const utxo of added) {
      const script = utxo.utxoEntry?.scriptPublicKey?.script;
      if (!script) continue;

      for (const [id, entry] of this.tracked) {
        if (entry.type === 'market' && script === entry.poolScript) {
          entry.poolUtxo = utxo;
          const amount = parseInt(utxo.utxoEntry.amount);
          this.emit('pool-updated', { marketId: id, amount, utxo });
        }
        if (entry.type === 'game' && script === entry.escrowScript) {
          entry.escrowUtxo = utxo;
          this.emit('escrow-funded', { gameId: id, utxo });
        }
      }

      try {
        const data = parseReceiptData(script);
        if (data) {
          this.emit('receipt-detected', { data, utxo });
        }
      } catch {}
    }

    for (const outpoint of removed) {
      for (const [id, entry] of this.tracked) {
        if (entry.type === 'market' && entry.poolUtxo &&
            entry.poolUtxo.outpoint.transactionId === outpoint.transactionId) {
          entry.poolUtxo = null;
          this.emit('pool-spent', { marketId: id });
        }
        if (entry.type === 'game' && entry.escrowUtxo &&
            entry.escrowUtxo.outpoint.transactionId === outpoint.transactionId) {
          entry.escrowUtxo = null;
          this.emit('escrow-spent', { gameId: id });
        }
      }
    }
  }

  needsBatching(marketId) {
    const entry = this.tracked.get(marketId);
    if (!entry) return false;
    return entry.receiptUtxos.length > 50;
  }

  getBatches(marketId, batchSize = 50) {
    const entry = this.tracked.get(marketId);
    if (!entry) return [];
    const receipts = entry.receiptUtxos;
    const batches = [];
    for (let i = 0; i < receipts.length; i += batchSize) {
      batches.push(receipts.slice(i, i + batchSize));
    }
    return batches;
  }
}

module.exports = UtxoIndexer;
