'use strict';

const WebSocket = require('ws');
const EventEmitter = require('events');

class KaspaRPC extends EventEmitter {
  constructor(url) {
    super();
    this.url = url || process.env.KASPA_WRPC_URL || 'ws://127.0.0.1:16210';
    this.ws = null;
    this.requestId = 0;
    this.pending = new Map();
    this.connected = false;
    this.reconnectDelay = 2000;
    this.subscriptions = new Set();
    this._polling = false;
    this._pollTimer = null;
    this._lastDaaScore = 0;
    this._lastSinkHash = '';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectDelay = 2000;
        console.log('[RPC] Connected to', this.url);
        this._startPolling();
        this.emit('connected');
        resolve();
      });
      this.ws.on('message', (raw) => this._handleMessage(raw));
      this.ws.on('close', () => {
        this.connected = false;
        this._stopPolling();
        this.emit('disconnected');
        console.log('[RPC] Disconnected. Reconnecting in', this.reconnectDelay, 'ms');
        setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      });
      this.ws.on('error', (err) => {
        console.error('[RPC] Error:', err.message);
        if (!this.connected) reject(err);
      });
    });
  }

  _handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result || msg.params);
      return;
    }
    if (msg.method) {
      this.emit(msg.method, msg.params);
      return;
    }
  }

  async _call(method, params = {}) {
    if (!this.connected) throw new Error('Not connected to Kaspa node');
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('RPC timeout: ' + method));
      }, 30000);
      this.pending.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  _startPolling() {
    if (this._polling) return;
    this._polling = true;
    const poll = async () => {
      if (!this.connected || !this._polling) return;
      try {
        const info = await this._call('getBlockDagInfo', {});
        const daa = parseInt(info.virtualDaaScore || info.virtual_daa_score || '0', 10);
        const sink = info.sinkHash || info.sink || '';
        if (sink && sink !== this._lastSinkHash) {
          this._lastSinkHash = sink;
          this.emit('blockAddedNotification', { block: { verboseData: { hash: sink, daaScore: daa } } });
        }
        if (daa > this._lastDaaScore) {
          this._lastDaaScore = daa;
          this.emit('virtualDaaScoreChangedNotification', { virtualDaaScore: daa });
        }
      } catch (e) { /* reconnect handler will restart */ }
    };
    this._pollTimer = setInterval(poll, 1000);
    console.log('[RPC] Polling started (1s interval)');
  }

  _stopPolling() {
    this._polling = false;
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  async subscribeBlockAdded() {
    this.subscriptions.add({ method: 'blockAdded', params: {} });
    this._startPolling();
    return { success: true };
  }
  async subscribeUtxosChanged(addresses) {
    this.subscriptions.add({ method: 'utxosChanged', params: { addresses } });
    return { success: true };
  }
  async subscribeSinkBlueScoreChanged() {
    this.subscriptions.add({ method: 'sinkBlueScore', params: {} });
    return { success: true };
  }
  async subscribeVirtualDaaScoreChanged() {
    this.subscriptions.add({ method: 'virtualDaaScore', params: {} });
    this._startPolling();
    return { success: true };
  }

  async getBlockDagInfo() { return this._call('getBlockDagInfo'); }
  async getServerInfo() { return this._call('getServerInfo'); }
  async getInfo() { return this._call('getInfo'); }
  async getDaaScoreTimestampEstimate(scores) {
    return this._call('getDaaScoreTimestampEstimate', { daaScores: scores });
  }
  async getCurrentDaaScore() {
    const info = await this.getBlockDagInfo();
    return parseInt(info.virtualDaaScore || info.virtual_daa_score || '0', 10);
  }
  hoursToDAATicks(hours) {
    return Math.floor(hours * 3600);
  }
  async getUtxosByAddress(address) {
    return this._call('getUtxosByAddresses', { addresses: [address] });
  }
  async getUtxosByAddresses(addresses) {
    return this._call('getUtxosByAddresses', { addresses });
  }
  async getBalanceByAddress(address) {
    return this._call('getBalanceByAddress', { address });
  }
  async submitTransaction(tx, allowOrphan = false) {
    return this._call('submitTransaction', { transaction: tx, allowOrphan });
  }
  async getTransaction(txId) {
    return this._call('getTransaction', { transactionId: txId, includeOrphan: true });
  }
  async getBlockByHash(hash) {
    return this._call('getBlock', { hash, includeTransactions: true });
  }
  async getMempoolEntries(includeOrphan = false) {
    return this._call('getMempoolEntries', { includeOrphanPool: includeOrphan, filterTransactionPool: true });
  }

  close() {
    this._stopPolling();
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); }
  }
}

module.exports = KaspaRPC;
