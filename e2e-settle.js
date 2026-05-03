#!/usr/bin/env node
'use strict';

// e2e-settle.js — Fund escrow + settle on-chain using ORACLE_KEY_1/2
// Deployed to server, executed over SSH

const nacl = require('tweetnacl');
const blake = require('blakejs');
const https = require('https');

const REST = process.env.KASPA_REST_URL || 'https://api-tn12.kaspa.org';
const SOMPI_PER_KAS = 100000000;
const GAME_FEE_BPS = 200;

// ── Helpers ──

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(REST + path);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${d.slice(0,500)}`));
          else resolve(r);
        } catch { reject(new Error(`Parse: ${d.slice(0,100)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ── Kaspa Bech32 (with : separator) ──

function encodeBech32(hrp, data) {
  const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  function polymod(values) {
    let chk = 1;
    for (let v of values) { const top = chk >> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let j = 0; j < 5; j++) if ((top >> j) & 1) chk ^= GENERATOR[j]; }
    return chk;
  }
  function hrpExpand(hrp) {
    const ret = [];
    for (let c of hrp) { ret.push(c.charCodeAt(0) >> 5); } ret.push(0);
    for (let c of hrp) { ret.push(c.charCodeAt(0) & 31); } return ret;
  }
  function convertBits(data, from, to, pad) {
    let acc = 0, bits = 0, ret = [], maxv = (1 << to) - 1;
    for (let v of data) { acc = (acc << from) | v; bits += from; while (bits >= to) { bits -= to; ret.push((acc >> bits) & maxv); } }
    if (pad && bits > 0) ret.push((acc << (to - bits)) & maxv);
    return ret;
  }
  const combined = convertBits(data, 8, 5, true).concat([0,0,0,0,0,0]);
  const mod = polymod(hrpExpand(hrp).concat(combined));
  const checksum = []; for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31);
  return hrp + ':' + ALPHABET[combined[0]] + combined.slice(1).map(v => ALPHABET[v]).join('') + checksum.map(v => ALPHABET[v]).join('');
}

function pubkeyToAddress(pubkeyBuf) {
  const hash = blake.blake2b(pubkeyBuf, null, 32);
  const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);
  return encodeBech32('kaspatest', payload);
}

// ── OP codes ──

const OP = {
  DUP: 0x76, EQUALVERIFY: 0x88, CHECKSIG: 0xac, CHECKMULTISIG: 0xae,
  IF: 0x63, ELSE: 0x67, ENDIF: 0x68, DROP: 0x75,
  NUMEQUAL: 0x9c, GREATERTHANOREQUAL: 0xa2,
  TXINPUTINDEX: 0x01, TXINPUTBLOCKDAASCORE: 0x04,
  RETURN: 0x6a,
};

function pushInt(n) {
  if (n < 0) throw new Error('negative pushInt');
  if (n === 0) return [0x00];
  if (n <= 16) return [0x50 + n];
  if (n <= 0xff) return [0x01, n];
  if (n <= 0xffff) return [0x02, n & 0xff, (n >> 8) & 0xff];
  return [0x04, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function pushPubkey(pkHex) {
  const buf = Buffer.from(pkHex, 'hex');
  if (buf.length < 1 || buf.length > 65) throw new Error('bad pubkey len');
  let prefix = buf.length;
  if (buf.length >= 76) prefix = 0x4c;
  if (buf.length >= 256) prefix = 0x4d;
  return [prefix, ...buf];
}

function pushBytes(bytes) {
  if (typeof bytes === 'string') bytes = Buffer.from(bytes, 'hex');
  if (bytes.length === 0) return [];
  let prefix = bytes.length;
  if (bytes.length >= 76) prefix = 0x4c;
  if (bytes.length >= 256) prefix = 0x4d;
  return [prefix, ...bytes];
}

// ── Build escrow script ──

function buildGameEscrowScript(oraclePubkeys, timeoutDaa) {
  const pk1 = oraclePubkeys[0], pk2 = oraclePubkeys[1];
  const s = [];

  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);         // PATH 1: SETTLE
  s.push(OP.DROP, OP.DROP, 0x02, ...pushPubkey(pk1), ...pushPubkey(pk2), 0x02, OP.CHECKMULTISIG);

  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF); // PATH 2: DRAW
  s.push(OP.DROP, 0x02, ...pushPubkey(pk1), ...pushPubkey(pk2), 0x02, OP.CHECKMULTISIG);

  s.push(OP.ELSE, OP.DUP, ...pushInt(3), OP.NUMEQUAL, OP.IF); // PATH 3: CANCEL
  s.push(OP.DROP, 0x02, ...pushPubkey(pk1), ...pushPubkey(pk2), 0x02, OP.CHECKMULTISIG);

  s.push(OP.ELSE);                                             // PATH 4: TIMEOUT
  s.push(OP.DROP, OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF, OP.ENDIF, OP.ENDIF);

  return Buffer.from(s);
}

// ── Main ──

async function main() {
  console.log('══════════════════════════════════════');
  console.log(' HTP e2e SETTLEMENT TEST');
  console.log('══════════════════════════════════════\n');

  // 1. Load oracle keys
  const k1 = Buffer.from(process.env.ORACLE_KEY_1, 'hex');
  const k2 = Buffer.from(process.env.ORACLE_KEY_2, 'hex');
  if (k1.length !== 32 || k2.length !== 32) throw new Error('ORACLE_KEY_1 or _2 missing from env');

  const oracle1 = nacl.sign.keyPair.fromSeed(k1);
  const oracle2 = nacl.sign.keyPair.fromSeed(k2);
  const oraclePubkeys = [Buffer.from(oracle1.publicKey).toString('hex'), Buffer.from(oracle2.publicKey).toString('hex')];
  console.log('[1] ORACLES:', oraclePubkeys.map(p => p.slice(0,12) + '...').join(', '));

  // 2. Derive wallet from ORACLE_KEY_1 (funding wallet)
  const walletKP = nacl.sign.keyPair.fromSeed(k1);
  const walletPubkey = Buffer.from(walletKP.publicKey).toString('hex');
  const walletAddr = pubkeyToAddress(Buffer.from(walletKP.publicKey));
  console.log('[2] FUNDING WALLET:', walletAddr);
  console.log('    Pubkey:', walletPubkey.slice(0,16) + '...');

  // 3. Get UTXOs and balance
  const utxos = await httpGet(REST + '/addresses/' + walletAddr + '/utxos');
  const balance = (utxos || []).reduce((s, u) => s + parseInt((u.utxoEntry || {}).amount || '0'), 0);
  console.log('[3] BALANCE:', (balance / SOMPI_PER_KAS).toFixed(4), 'KAS | UTXOs:', (utxos || []).length);

  // 4. Build escrow script
  const currentDaa = (await httpGet(REST + '/info/blockdag')).virtualDaaScore;
  const timeoutDaa = parseInt(currentDaa) + 14400; // 4 hours
  const STAKE_SOMPI = SOMPI_PER_KAS; // 1 KAS stake
  const FEE = 30000;
  const DUST = 300;

  const escrowScript = buildGameEscrowScript(oraclePubkeys, timeoutDaa);
  const escrowScriptHex = escrowScript.toString('hex');
  console.log('[4] ESCROW SCRIPT hex:', escrowScriptHex.slice(0,40) + '... (size:', escrowScript.length, 'bytes)');

  // 5. Select UTXOs and build funding tx
  const needed = STAKE_SOMPI + FEE;
  const sorted = [...(utxos || [])].sort((a, b) =>
    parseInt((b.utxoEntry || {}).amount || '0') - parseInt((a.utxoEntry || {}).amount || '0')
  );
  let consumed = 0;
  const selected = [];
  for (const u of sorted) {
    selected.push(u);
    consumed += parseInt((u.utxoEntry || {}).amount || '0');
    if (consumed >= needed) break;
  }
  if (consumed < needed) throw new Error(`Insufficient: need ${needed}, have ${consumed}`);
  const change = consumed - STAKE_SOMPI - FEE;

  // Sign each input
  const inputs = [];
  for (const u of selected) {
    const txId = (u.outpoint || {}).transactionId || u.transactionId;
    const idx = (u.outpoint || {}).index ?? u.index ?? 0;
    const sigMsg = blake.blake2b(Buffer.concat([Buffer.from(txId, 'hex'), Buffer.alloc(4)]), null, 32);
    // write outputIndex into the buffer
    const buf = Buffer.alloc(32 + 4); Buffer.from(txId, 'hex').copy(buf, 0); buf.writeUInt32LE(idx, 32);
    const sighash = blake.blake2b(buf, null, 32);
    const sig = nacl.sign.detached(sighash, walletKP.secretKey);
    const sigScript = Buffer.concat([Buffer.from([0x41]), sig, Buffer.from([0x21]), Buffer.from(walletKP.publicKey)]).toString('hex');
    inputs.push({
      previousOutpoint: { transactionId: txId, index: idx },
      signatureScript: sigScript,
      sequence: '0', sigOpCount: 1
    });
  }

  // Build outputs
  const spk = '20' + walletPubkey + 'ac';
  const outputs = [{ value: String(STAKE_SOMPI), scriptPublicKey: { version: 0, script: escrowScriptHex } }];
  if (change > DUST) outputs.push({ value: String(change), scriptPublicKey: { version: 0, script: spk } });

  // 6. Broadcast funding tx
  console.log('[6] Broadcasting funding TX...');
  const fundingTx = {
    version: 0,
    inputs,
    outputs,
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0', payload: ''
  };

  let fundingResult;
  try {
    fundingResult = await httpPost('/transactions', { transaction: fundingTx, allowOrphan: false });
  } catch (e) {
    console.log('    allowOrphan=false failed:', e.message.slice(0,80));
    console.log('    Retrying with allowOrphan=true...');
    fundingResult = await httpPost('/transactions', { transaction: fundingTx, allowOrphan: true });
  }

  const fundingTxId = fundingResult.transactionId || fundingResult.txid || JSON.stringify(fundingResult);
  console.log('[6] FUNDING TX ID:', fundingTxId);
  console.log('    Explorer: https://explorer-tn12.kaspa.org/txs/' + fundingTxId);

  // 7. Wait briefly then try to settle
  console.log('\n[7] Waiting 5s for TX propagation...');
  await new Promise(r => setTimeout(r, 5000));

  // 8. Sign settlement (PATH 1, winner = 1 = Player A wins)
  const gameId = 'e2e-settle-' + Date.now();
  const msg = Buffer.from(gameId);
  const sig1 = Buffer.from(nacl.sign.detached(msg, oracle1.secretKey));
  const sig2 = Buffer.from(nacl.sign.detached(msg, oracle2.secretKey));
  const winnerByte = 0x01; // Player A wins (just testing settlement path)

  const sigScript = Buffer.concat([
    Buffer.from([sig1.length, ...sig1]),
    Buffer.from([sig2.length, ...sig2]),
    Buffer.from([0x01, 0x01]), // winner byte + path selector
  ]).toString('hex');

  const GAME_FEE = Math.floor(STAKE_SOMPI * GAME_FEE_BPS / 10000);
  const payout = STAKE_SOMPI - GAME_FEE - FEE;
  const protocolAddr = process.env.PROTOCOL_ADDRESS || 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';

  // protocol SPK
  const protocolPayload = protocolAddr.split(':')[1];
  const protoSpk = '20' + (protocolPayload ? protocolPayload.slice(0, 64) : walletPubkey) + 'ac';

  const settleTx = {
    version: 0,
    inputs: [{
      previousOutpoint: { transactionId: fundingTxId, index: 0 },
      signatureScript: sigScript,
      sequence: '0'
    }],
    outputs: [
      { value: String(payout), scriptPublicKey: { version: 0, script: '20' + walletPubkey + 'ac' } },
      { value: String(GAME_FEE), scriptPublicKey: { version: 0, script: protoSpk } },
    ],
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0', payload: ''
  };

  console.log('[8] Broadcasting settlement TX...');
  console.log('    Input:', fundingTxId + ':0');
  console.log('    Payout:', payout, 'sompi =', (payout/SOMPI_PER_KAS).toFixed(4), 'KAS');
  console.log('    Protocol fee:', GAME_FEE, 'sompi');

  let settleResult;
  try {
    settleResult = await httpPost('/transactions', { transaction: settleTx, allowOrphan: false });
  } catch (e) {
    console.log('    allowOrphan=false failed:', e.message.slice(0,80));
    console.log('    Retrying with allowOrphan=true...');
    settleResult = await httpPost('/transactions', { transaction: settleTx, allowOrphan: true });
  }

  const settleTxId = settleResult.transactionId || settleResult.txid || JSON.stringify(settleResult);
  console.log('[8] SETTLE TX ID:', settleTxId);
  console.log('    Explorer: https://explorer-tn12.kaspa.org/txs/' + settleTxId);

  // 9. Check final balances
  const finalUtxos = await httpGet(REST + '/addresses/' + walletAddr + '/utxos');
  const finalBal = (finalUtxos || []).reduce((s, u) => s + parseInt((u.utxoEntry || {}).amount || '0'), 0);
  const spent = balance - finalBal;

  console.log('\n══════════════════════════════════════');
  console.log(' RESULTS');
  console.log('══════════════════════════════════════');
  console.log('Fund TX:', fundingTxId);
  console.log('Settle TX:', settleTxId);
  console.log('Initial:', (balance/SOMPI_PER_KAS).toFixed(4), 'KAS');
  console.log('Final:', (finalBal/SOMPI_PER_KAS).toFixed(4), 'KAS');
  console.log('Spent:', (spent/SOMPI_PER_KAS).toFixed(6), 'KAS (escrow stake)');
  console.log('SUCCESS');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
