#!/usr/bin/env node
'use strict';

const nacl = require('tweetnacl');
const blake = require('blakejs');
const https = require('https');
const fs = require('fs');

const REST_BASE = process.env.KASPA_REST_URL || 'https://api-tn12.kaspa.org';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(REST_BASE + path);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${JSON.stringify(r)}`));
          else resolve(r);
        } catch(e) { reject(new Error(`Parse: ${d.slice(0,100)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(REST_BASE + path, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchUTXOs(address) {
  try {
    const data = await get('/addresses/' + address + '/utxos');
    return Array.isArray(data) ? data : [];
  } catch(e) { return []; }
}

// Kaspa bech32 encode
function encodeBech32(hrp, data) {
  const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  
  function polymod(values) {
    let chk = 1;
    for (let v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let j = 0; j < 5; j++) if ((top >> j) & 1) chk ^= GENERATOR[j];
    }
    return chk;
  }
  
  function hrpExpand(hrp) {
    const ret = [];
    for (let c of hrp) { ret.push(c.charCodeAt(0) >> 5); }
    ret.push(0);
    for (let c of hrp) { ret.push(c.charCodeAt(0) & 31); }
    return ret;
  }
  
  function convertBits(data, from, to, pad) {
    let acc = 0, bits = 0, ret = [], maxv = (1 << to) - 1;
    for (let v of data) {
      acc = (acc << from) | v;
      bits += from;
      while (bits >= to) { bits -= to; ret.push((acc >> bits) & maxv); }
    }
    if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
    return ret;
  }

  const combined = convertBits(data, 8, 5, true).concat([0,0,0,0,0,0]);
  const mod = polymod(hrpExpand(hrp).concat(combined));
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31);
  return ALPHABET[combined[0]] + combined.slice(1).map(v => ALPHABET[v]).join('') + checksum.map(v => ALPHABET[v]).join('');
}

// Compute address from pubkey
function pubkeyToAddress(pubkeyBuf, prefix = 'kaspatest') {
  const hash = blake.blake2b(pubkeyBuf, null, 32);
  const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);
  return encodeBech32(prefix, payload);
}

// Build sighash for P2PK input
// Kaspa sighash = blake2b( tx_serialized(blank sigscripts) || hash_type(u8) )
// Serialization is complex; for P2PK we use the simplified approach:
// sign over: txId || outputIndex || hash_type
function buildSighash(txIdHex, outputIndex, hashType = 1) {
  const txId = Buffer.from(txIdHex, 'hex');
  const buf = Buffer.alloc(32 + 4 + 1);
  txId.copy(buf, 0);
  buf.writeUInt32LE(outputIndex, 32);
  buf.writeUInt8(hashType, 36);
  return blake.blake2b(buf, null, 32);
}

async function main() {
  const wallet = JSON.parse(fs.readFileSync('/root/htp/.server-wallet.json'));
  const privkey = Buffer.from(wallet.privkey, 'hex').subarray(0, 32);
  const pubkey = Buffer.from(wallet.pubkey, 'hex');
  const address = pubkeyToAddress(pubkey);
  
  console.log('ADDRESS:', address);
  
  const utxos = await fetchUTXOs(address);
  const balance = utxos.reduce((s, u) => s + parseInt(u.utxoEntry?.amount || '0'), 0);
  console.log('BALANCE:', balance, 'sompi =', (balance/1e8).toFixed(4), 'KAS');
  
  const SOMPI_PER_KAS = 100000000;
  const FEE = 30000;
  const DUST = 300;
  
  if (balance < SOMPI_PER_KAS + FEE) {
    console.log('\nINSUFFICIENT FUNDS. Send testnet KAS to:');
    console.log(address);
    console.log('\nFaucet: https://faucet.kaspa.org');
    
    // Save address
    fs.writeFileSync('/root/htp/.htp-server-address.json', JSON.stringify({address, pubkey: wallet.pubkey}));
    process.exit(0);
  }

  const sorted = [...utxos].sort((a,b) => 
    parseInt(b.utxoEntry?.amount || '0') - parseInt(a.utxoEntry?.amount || '0')
  );

  const needed = SOMPI_PER_KAS + FEE;
  let consumed = 0;
  const selected = [];
  for (const u of sorted) {
    selected.push(u);
    consumed += parseInt(u.utxoEntry?.amount || '0');
    if (consumed >= needed) break;
  }

  const change = consumed - SOMPI_PER_KAS - FEE;
  const spk = '20' + wallet.pubkey + 'ac'; // P2PK

  // Sign each input
  const signedInputs = [];
  for (const u of selected) {
    const txId = u.outpoint?.transactionId || u.transactionId;
    const idx = u.outpoint?.index ?? u.index ?? 0;
    
    const sighash = buildSighash(txId, idx);
    const sig = nacl.sign.detached(sighash, privkey);
    
    // sigScript = 41 (push 65 bytes) || sig(64) || 21 (push 33 bytes) || pubkey(32)
    const sigScript = Buffer.concat([
      Buffer.from([0x41]), sig,           // OP_DATA_65 + signature
      Buffer.from([0x21]), pubkey         // OP_DATA_33 + pubkey
    ]).toString('hex');
    
    signedInputs.push({
      previousOutpoint: { transactionId: txId, index: idx },
      signatureScript: sigScript,
      sequence: '0',
      sigOpCount: 1
    });
  }

  const outputs = [{ value: String(SOMPI_PER_KAS), scriptPublicKey: { version: 0, script: spk } }];
  if (change > DUST) outputs.push({ value: String(change), scriptPublicKey: { version: 0, script: spk } });

  const rawTx = {
    version: 0,
    inputs: signedInputs,
    outputs: outputs,
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: ''
  };

  console.log('\nBroadcasting self-send of', SOMPI_PER_KAS, 'sompi...');
  
  try {
    const result = await post('/transactions', { transaction: rawTx, allowOrphan: true });
    const txId = result.transactionId || result.txid || result.tx_id || JSON.stringify(result);
    console.log('TX ID:', txId);
    console.log('Explorer: https://explorer-tn12.kaspa.org/txs/' + txId);
  } catch(e) {
    console.error('BROADCAST FAILED:', e.message);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
