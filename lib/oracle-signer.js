'use strict';
require('dotenv').config();

const nacl = require('tweetnacl');
const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

class OracleSigner {
  constructor(db) {
    this.db = db;
    this.seedKeys = [];
    this.keyPairs = [];
    this.restBase = process.env.KASPA_REST_URL || 'https://api-tn12.kaspa.org';
    this._loadKeys();
  }

  _loadKeys() {
    for (let i = 1; i <= 5; i++) {
      const envKey = process.env['ORACLE_KEY_' + i];
      if (envKey && envKey.length === 64) {
        const seed = Buffer.from(envKey, 'hex');
        if (seed.length === 32 && !this.seedKeys.some(s => s.equals(seed))) {
          this.seedKeys.push(seed);
          this.keyPairs.push(nacl.sign.keyPair.fromSeed(seed));
        }
      }
    }
    console.log('[ORACLE] Loaded', this.keyPairs.length, 'oracle key(s)');
    if (this.keyPairs.length > 0) {
      console.log('[ORACLE] Pubkeys:', this.keyPairs.map(kp => Buffer.from(kp.publicKey).toString('hex').slice(0,16)+'...').join(', '));
    }
  }

  getPubkeys() {
    return this.keyPairs.map(kp => Buffer.from(kp.publicKey).toString('hex'));
  }

  sign(dataBytes, idx = 0) {
    if (idx >= this.keyPairs.length) throw new Error('Oracle key index ' + idx + ' not available');
    const msg = Buffer.isBuffer(dataBytes) ? dataBytes : Buffer.from(dataBytes);
    return nacl.sign.detached(msg, this.keyPairs[idx].secretKey);
  }

  // Submit a game settlement transaction to Kaspa TN12
  async settleGameOnChain(game, escrowUtxo, winnerAddr) {
    if (!escrowUtxo) throw new Error('No escrow UTXO');
    if (this.keyPairs.length < 2) throw new Error('Need >=2 oracle keys, have ' + this.keyPairs.length);

    const escrowAmount = parseInt(escrowUtxo.utxoEntry.amount);
    const GAME_FEE_BPS = 200;
    const fee = Math.floor(escrowAmount * GAME_FEE_BPS / 10000);
    const payout = escrowAmount - fee - 30000;
    const protocolAddr = this.db.getProtocolAddress() || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
    const winnerByte = winnerAddr === game.playerA ? 0x01 : 0x02;

    const msg = Buffer.from(game.id);
    const sig1 = this.sign(msg, 0);
    const sig2 = this.sign(msg, 1);

    const script = Buffer.concat([
      Buffer.from([sig1.length]), sig1,
      Buffer.from([sig2.length]), sig2,
      Buffer.from([0x01, winnerByte]),
      Buffer.from([0x01, 0x01])
    ]);

    return this._postTx(
      escrowUtxo, script.toString('hex'),
      winnerAddr, payout, fee, protocolAddr
    );
  }

  // Submit a draw settlement
  async settleDrawOnChain(game, escrowUtxo) {
    if (!escrowUtxo) throw new Error('No escrow UTXO');
    if (this.keyPairs.length < 2) throw new Error('Need >=2 oracle keys');

    const escrowAmount = parseInt(escrowUtxo.utxoEntry.amount);
    const GAME_FEE_BPS = 200;
    const fee = Math.floor(escrowAmount * GAME_FEE_BPS / 10000);
    const perPlayer = Math.floor((escrowAmount - fee - 30000) / 2);
    const protocolAddr = this.db.getProtocolAddress() || '';

    const msg = Buffer.from(game.id);
    const sig1 = this.sign(msg, 0);
    const sig2 = this.sign(msg, 1);

    const script = Buffer.concat([
      Buffer.from([sig1.length]), sig1,
      Buffer.from([sig2.length]), sig2,
      Buffer.from([0x01, 0x02])  // path 2 = draw
    ]);

    return this._postDrawTx(
      escrowUtxo, script.toString('hex'),
      game.playerA, game.playerB, perPlayer, fee, protocolAddr
    );
  }

  async _postTx(escrowUtxo, sigScriptHex, winnerAddr, payout, fee, protocolAddr) {
    const tx = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: escrowUtxo.outpoint.transactionId,
          index: escrowUtxo.outpoint.index
        },
        signatureScript: sigScriptHex,
        sequence: '0'
      }],
      outputs: [
        { value: String(payout), scriptPublicKey: { version: 0, script: this._addrToSpk(winnerAddr) } },
        { value: String(fee), scriptPublicKey: { version: 0, script: this._addrToSpk(protocolAddr) } }
      ]
    };
    console.log('[ORACLE] Submitting settlement | Winner: ' + winnerAddr.slice(-8) + ' | Payout: ' + payout + ' | Fee: ' + fee);
    return this._sendTx(tx);
  }

  async _postDrawTx(escrowUtxo, sigScriptHex, addrA, addrB, perPlayer, fee, protocolAddr) {
    const tx = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: escrowUtxo.outpoint.transactionId,
          index: escrowUtxo.outpoint.index
        },
        signatureScript: sigScriptHex,
        sequence: '0'
      }],
      outputs: [
        { value: String(perPlayer), scriptPublicKey: { version: 0, script: this._addrToSpk(addrA) } },
        { value: String(perPlayer), scriptPublicKey: { version: 0, script: this._addrToSpk(addrB) } },
        { value: String(fee), scriptPublicKey: { version: 0, script: this._addrToSpk(protocolAddr) } }
      ]
    };
    console.log('[ORACLE] Submitting draw | Per: ' + perPlayer + ' | Fee: ' + fee);
    return this._sendTx(tx);
  }

  async _sendTx(tx) {
    const body = JSON.stringify({ transaction: tx, allowOrphan: true });
    return new Promise((resolve, reject) => {
      const u = new URL(this.restBase + '/transactions');
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let d = '';
        res.on('data', c => { d += c; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
            return;
          }
          try {
            const r = JSON.parse(d);
            resolve({ txId: r.transactionId || r.txid || r.tx_id || r });
          } catch {
            resolve({ txId: d.trim() });
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // Find escrow UTXO on-chain by scanning mempool
  async findEscrowUtxo(escrowScriptHex) {
    try {
      const mempool = await httpGet(this.restBase + '/mempool/entries').catch(() => []);
      const entries = Array.isArray(mempool) ? mempool : [];
      for (const e of entries) {
        const txId = typeof e === 'object' ? (e.transactionId || e.txid || '') : String(e);
        if (!txId) continue;
        try {
          const tx = await httpGet(this.restBase + '/transactions/' + txId);
          for (let i = 0; i < (tx.outputs || []).length; i++) {
            if (tx.outputs[i].scriptPublicKey?.script === escrowScriptHex) {
              return {
                outpoint: { transactionId: txId, index: i },
                utxoEntry: {
                  amount: String(tx.outputs[i].value),
                  scriptPublicKey: tx.outputs[i].scriptPublicKey
                }
              };
            }
          }
        } catch {}
      }
    } catch {}
    return null;
  }


  // Build PSKT with oracle 2-of-3 sigScript pre-signed. Returns PSKT for browser signing.
  async buildPayoutPskt(game, escrowUtxo) {
    if (!escrowUtxo) throw new Error('No escrow UTXO');
    if (this.keyPairs.length < 2) throw new Error('Need >=2 oracle keys');

    const escrowAmount = parseInt(escrowUtxo.utxoEntry ? escrowUtxo.utxoEntry.amount : (escrowUtxo.amount || 0));
    const GAME_FEE_BPS = 200;
    const protocolFee = Math.floor(escrowAmount * GAME_FEE_BPS / 10000);
    const networkFee = 30000;
    const winnerAddr = game.winner;
    const payout = escrowAmount - protocolFee - networkFee;

    if (payout <= 0) throw new Error('Payout too small to cover fees');
    const protocolAddr = this.db.getProtocolAddress() || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';

    const msg = Buffer.from(game.id);
    const sig1 = this.sign(msg, 0);
    const sig2 = this.sign(msg, 1);

    const sigScript = Buffer.concat([
      Buffer.from([sig1.length]), sig1,
      Buffer.from([sig2.length]), sig2,
      Buffer.from([0x01, 0x01])   // path 1 = winner-takes-all
    ]);

    const tx = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: escrowUtxo.outpoint ? escrowUtxo.outpoint.transactionId : escrowUtxo.transactionId,
          index: escrowUtxo.outpoint ? escrowUtxo.outpoint.index : (escrowUtxo.index || 0)
        },
        signatureScript: sigScript.toString('hex'),
        sequence: '0',
        sigOpCount: 1
      }],
      outputs: [
        { value: String(payout), scriptPublicKey: { version: 0, script: this._addrToSpk(winnerAddr) } },
        { value: String(protocolFee), scriptPublicKey: { version: 0, script: this._addrToSpk(protocolAddr) } }
      ],
      lockTime: 0,
      subnetworkId: '0000000000000000000000000000000000000000'
    };

    const pskt = Buffer.from(JSON.stringify({ tx, escrowScriptHex: game.escrowScriptHex })).toString('hex');
    console.log('[ORACLE] Built payout PSKT | Winner: ' + winnerAddr.slice(-8) + ' | Payout: ' + payout + ' | Fee: ' + protocolFee);
    return { pskt, payout, protocolFee, networkFee };
  }

  // Build PSKT for draw settlement
  async buildDrawPskt(game, escrowUtxo) {
    if (!escrowUtxo) throw new Error('No escrow UTXO');
    if (this.keyPairs.length < 2) throw new Error('Need >=2 oracle keys');

    const escrowAmount = parseInt(escrowUtxo.utxoEntry ? escrowUtxo.utxoEntry.amount : (escrowUtxo.amount || 0));
    const GAME_FEE_BPS = 200;
    const protocolFee = Math.floor(escrowAmount * GAME_FEE_BPS / 10000);
    const networkFee = 30000;
    const eachPayout = Math.floor((escrowAmount - protocolFee - networkFee) / 2);
    const protocolAddr = this.db.getProtocolAddress() || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';

    const msg = Buffer.from(game.id);
    const sig1 = this.sign(msg, 0);
    const sig2 = this.sign(msg, 1);

    const sigScript = Buffer.concat([
      Buffer.from([sig1.length]), sig1,
      Buffer.from([sig2.length]), sig2,
      Buffer.from([0x01, 0x02])   // path 2 = draw
    ]);

    const tx = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: escrowUtxo.outpoint ? escrowUtxo.outpoint.transactionId : escrowUtxo.transactionId,
          index: escrowUtxo.outpoint ? escrowUtxo.outpoint.index : (escrowUtxo.index || 0)
        },
        signatureScript: sigScript.toString('hex'),
        sequence: '0',
        sigOpCount: 1
      }],
      outputs: [
        { value: String(eachPayout), scriptPublicKey: { version: 0, script: this._addrToSpk(game.playerA) } },
        { value: String(eachPayout), scriptPublicKey: { version: 0, script: this._addrToSpk(game.playerB) } },
        { value: String(protocolFee), scriptPublicKey: { version: 0, script: this._addrToSpk(protocolAddr) } }
      ],
      lockTime: 0,
      subnetworkId: '0000000000000000000000000000000000000000'
    };

    const pskt = Buffer.from(JSON.stringify({ tx, escrowScriptHex: game.escrowScriptHex })).toString('hex');
    console.log('[ORACLE] Built draw PSKT | Each: ' + eachPayout + ' | Fee: ' + protocolFee);
    return { pskt, eachPayout, protocolFee, networkFee };
  }


  _addrToSpk(addr) {
    if (!addr) return '';
    const payload = addr.split(':')[1];
    if (!payload || payload.length < 64) return '';
    return '20' + payload.slice(0, 64) + 'ac';
  }
}

// Quick test
if (require.main === module) {
  const Database = require('./lib/db');
  const db = new Database();
  const o = new OracleSigner(db);
  console.log('Keys loaded:', o.keyPairs.length);
  if (o.keyPairs.length > 0) {
    console.log('Pubkeys:', o.getPubkeys().map(p => p.slice(0,16)+'...'));
    const sig = o.sign(Buffer.from('test'), 0);
    console.log('Sig test:', sig.toString('hex').slice(0,16)+'...');
    console.log('SUCCESS');
  }
}

module.exports = OracleSigner;
