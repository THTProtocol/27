'use strict';

const EventEmitter = require('events');
const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

class KaspaRPC extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.restBase = process.env.KASPA_REST_URL || 'https://api-tn12.kaspa.org';
    this.connected = false;
    this._polling = false;
    this._pollTimer = null;
    this._lastDaaScore = 0;
    this._lastSinkHash = '';
    this.reconnectDelay = 2000;
  }

  async connect() {
    console.log('[RPC] Connecting via REST API:', this.restBase);
    try {
      await this.getBlockDagInfo();
      this.connected = true;
      console.log('[RPC] Connected to', this.restBase);
      this._startPolling();
      this.emit('connected');
    } catch (e) {
      console.error('[RPC] Connect failed:', e.message, '- retrying in', this.reconnectDelay, 'ms');
      setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
    }
  }

  _startPolling() {
    if (this._polling) return;
    this._polling = true;
    const poll = async () => {
      if (!this._polling) return;
      try {
        const info = await this.getBlockDagInfo();
        const daa = parseInt(info.virtualDaaScore || '0', 10);
        const sink = info.sinkHash || '';
        if (sink && sink !== this._lastSinkHash) {
          this._lastSinkHash = sink;
          this.emit('blockAddedNotification', { block: { verboseData: { hash: sink, daaScore: daa } } });
        }
        if (daa > this._lastDaaScore) {
          this._lastDaaScore = daa;
          this.emit('virtualDaaScoreChangedNotification', { virtualDaaScore: daa });
        }
      } catch (e) {
        console.error('[RPC] Poll error:', e.message);
      }
    };
    this._pollTimer = setInterval(poll, 5000);
    console.log('[RPC] Polling started (5s interval)');
  }

  _stopPolling() {
    this._polling = false;
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  async getBlockDagInfo() {
    const data = await httpGet(this.restBase + '/info/blockdag');
    return {
      virtualDaaScore: String(data.virtualDaaScore || data.virtual_daa_score || '0'),
      sinkHash: data.sinkHash || data.sink || '',
      networkName: data.networkName || 'testnet-12',
      blockCount: data.blockCount || 0,
      headerCount: data.headerCount || 0,
      difficulty: data.difficulty || 0
    };
  }

  async getServerInfo() { return this.getBlockDagInfo(); }
  async getInfo() { return this.getBlockDagInfo(); }

  async getCurrentDaaScore() {
    const info = await this.getBlockDagInfo();
    return parseInt(info.virtualDaaScore || '0', 10);
  }

  hoursToDAATicks(hours) { return Math.floor(hours * 3600); }

  async getDaaScoreTimestampEstimate(scores) {
    return httpGet(this.restBase + '/info/daa-score-timestamp-estimate?daaScores=' + scores.join(','));
  }

  async getUtxosByAddress(address) {
    return this.getUtxosByAddresses([address]);
  }

  async getUtxosByAddresses(addresses) {
    const results = await Promise.all(
      addresses.map(a => httpGet(this.restBase + '/addresses/' + a + '/utxos').catch(() => []))
    );
    return results.flat();
  }

  async getBalanceByAddress(address) {
    return httpGet(this.restBase + '/addresses/' + address + '/balance');
  }

  async submitTransaction(tx, allowOrphan = false) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ transaction: tx, allowOrphan });
      const u = new URL(this.restBase + '/transactions');
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let d = '';
        res.on('data', c => { d += c; });
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async getTransaction(txId) {
    return httpGet(this.restBase + '/transactions/' + txId);
  }

  async getBlockByHash(hash) {
    return httpGet(this.restBase + '/blocks/' + hash + '?includeTransactions=true');
  }

  async getMempoolEntries() {
    return httpGet(this.restBase + '/mempool/entries').catch(() => []);
  }

  async subscribeBlockAdded() { this._startPolling(); return { success: true }; }
  async subscribeUtxosChanged() { return { success: true }; }
  async subscribeSinkBlueScoreChanged() { return { success: true }; }
  async subscribeVirtualDaaScoreChanged() { this._startPolling(); return { success: true }; }

  close() { this._stopPolling(); }
}

module.exports = KaspaRPC;
