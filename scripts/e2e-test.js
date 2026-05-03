#!/usr/bin/env node
'use strict';
// e2e-test.js — Full E2E: generate fresh wallet, fund via faucet-request,
// create game, fund escrow, settle on TN12

console.log('==========================================');
console.log('  HTP E2E TEST — Kaspa TN12');
console.log('==========================================\n');

const https = require('https');
const http = require('http');
const fs = require('fs');
const nacl = require('tweetnacl');
const blake = require('blakejs');

const REST = 'https://api-tn12.kaspa.org';
const LOCAL = 'http://localhost:3333';
const SOMPI_PER_KAS = 100000000;
const FEE = 30000;
const DUST = 300;

// ── HTTP ──
function jget(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('http') ? (url.startsWith('https') ? https : http) : https;
    mod.get(url, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function jpost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + d.slice(0,200)));
          else resolve(r);
        } catch(e) { reject(new Error('Parse: ' + d.slice(0,100))); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ── Bech32 ──
function bech32(hrp, buf) {
  const A = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const G = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
  const pm = v => { let c=1; for(let x of v){ let t=c>>25; c=((c&0x1ffffff)<<5)^x; for(let j=0;j<5;j++) if((t>>j)&1)c^=G[j]; } return c; };
  const he = h => { let r=[]; for(let c of h) r.push(c.charCodeAt(0)>>5); r.push(0); for(let c of h) r.push(c.charCodeAt(0)&31); return r; };
  const cv = (d,f,t,p) => { let a=0,b=0,r=[],m=(1<<t)-1; for(let v of d){ a=(a<<f)|v; b+=f; while(b>=t){b-=t; r.push((a>>b)&m);} } if(p&&b>0) r.push((a<<(t-b))&m); return r; };
  const arr = Array.from(buf);
  const cm = cv(arr,8,5,true).concat([0,0,0,0,0,0]);
  const m = pm(he(hrp).concat(cm));
  const cs = []; for(let i=0;i<6;i++) cs.push((m>>(5*(5-i)))&31);
  return A[cm[0]] + cm.slice(1).map(v=>A[v]).join('') + cs.map(v=>A[v]).join('');
}

function pubToAddr(pubBuf, pfx) {
  const h = blake.blake2b(pubBuf, null, 32);
  const p = Buffer.concat([Buffer.from([0x00]), Buffer.from(h)]);
  return pfx + ':' + bech32(pfx, p);
}

// ── Sign ──
function makeSighash(txIdHex, outIdx) {
  const txId = Buffer.from(txIdHex, 'hex');
  const buf = Buffer.alloc(32+4+1);
  txId.copy(buf, 0); buf.writeUInt32LE(outIdx, 32); buf.writeUInt8(1, 36);
  return blake.blake2b(buf, null, 32);
}

function signInput(txIdHex, outIdx, privkey32) {
  return nacl.sign.detached(makeSighash(txIdHex, outIdx), privkey32);
}

function sigScript(sig, pubkey) {
  return Buffer.concat([Buffer.from([0x41]), sig, Buffer.from([0x21]), pubkey]).toString('hex');
}

// ── Main ──
async function main() {
  // 1. Load or generate wallet
  let w;
  const WALLET_FILE = '/root/htp/.e2e-wallet.json';
  if (fs.existsSync(WALLET_FILE)) {
    w = JSON.parse(fs.readFileSync(WALLET_FILE));
    console.log('[1] Loaded existing wallet:', w.address);
  } else {
    const kp = nacl.sign.keyPair();
    w = {
      privkey: Buffer.from(kp.secretKey).subarray(0, 32).toString('hex'),
      pubkey: Buffer.from(kp.publicKey).toString('hex'),
      address: pubToAddr(Buffer.from(kp.publicKey), 'kaspatest')
    };
    fs.writeFileSync(WALLET_FILE, JSON.stringify(w, null, 2));
    console.log('[1] Generated new wallet:', w.address);
  }

  // 2. Check balance
  console.log('\n[2] Balance check...');
  let bal = await jget(REST + '/addresses/' + w.address + '/balance');
  let kas = (parseInt(bal?.balance || '0')) / SOMPI_PER_KAS;
  console.log('  Address:', w.address);
  console.log('  Balance:', kas.toFixed(2), 'KAS');

  if (kas < 2) {
    console.log('\n[!] Need 2+ KAS for stake + fee. Requesting faucet...');
    console.log('  Faucet URL: https://faucet.kaspa.org/?address=' + encodeURIComponent(w.address));
    console.log('  Address for faucet:', w.address);
    console.log('\n  Manually send ~100 KAS to this address, then re-run.');
    console.log('  Or check if auto-faucet works...');
    
    // Try auto-faucet
    try {
      // Some faucets accept POST
      const faucetRes = await jpost('https://faucet.kaspa.org/send', { address: w.address, amount: 100 * SOMPI_PER_KAS });
      console.log('  Faucet response:', JSON.stringify(faucetRes).slice(0, 200));
    } catch(e) {
      console.log('  Auto-faucet failed:', e.message);
    }

    console.log('\n  Wallet saved to:', WALLET_FILE);
    console.log('  Re-run after funding.');
    process.exit(0);
  }

  console.log('  Funded. Proceeding.\n');

  // 3. Create game
  console.log('[3] Creating game (1 KAS stake)...');
  let resp = await jpost(LOCAL + '/api/games', {
    type: 'chess',
    playerA: w.address,
    playerAPubkey: w.pubkey,
    stakeKas: 1,
    timeoutHours: 4
  });
  const game = resp.game;
  const gameId = game.id;
  const escrowSpk = game.escrowScriptHex;
  console.log('  Game ID:', gameId);
  console.log('  Escrow hex:', escrowSpk.slice(0,32) + '...');

  // 4. Fund escrow
  console.log('\n[4] Funding escrow (1 KAS)...');
  let utxos = await jget(REST + '/addresses/' + w.address + '/utxos');
  utxos = (Array.isArray(utxos) ? utxos : []).sort((a,b) => (
    parseInt(b.utxoEntry?.amount || b.amount || '0') - parseInt(a.utxoEntry?.amount || a.amount || '0')
  ));
  const target = SOMPI_PER_KAS + FEE;
  let consumed = 0, selected = [], priv = Buffer.from(w.privkey, 'hex'), pub = Buffer.from(w.pubkey, 'hex');
  for (const u of utxos) {
    const amt = parseInt(u.utxoEntry?.amount || u.amount || '0');
    selected.push(u); consumed += amt;
    if (consumed >= target) break;
  }
  if (consumed < target) { console.log('[FAIL] Insufficient UTXOs'); process.exit(1); }

  const change = consumed - SOMPI_PER_KAS - FEE;
  console.log('  Using', selected.length, 'UTXOs,', consumed, 'sompi, change', change);

  const inputs = [];
  for (const u of selected) {
    const txId = u.outpoint?.transactionId || u.transactionId || u.txid;
    const idx = u.outpoint?.index ?? u.index ?? 0;
    inputs.push({
      previousOutpoint: { transactionId: txId, index: idx },
      signatureScript: sigScript(signInput(txId, idx, priv), pub),
      sequence: '0'
    });
  }
  const outputs = [{ value: String(SOMPI_PER_KAS), scriptPublicKey: { version: 0, script: escrowSpk } }];
  if (change > DUST) outputs.push({ value: String(change), scriptPublicKey: { version: 0, script: '20' + w.pubkey + 'ac' } });

  const rawTx = { version: 0, inputs, outputs, lockTime: '0', subnetworkId: '0000000000000000000000000000000000000000', gas: '0', payload: '' };

  let escrowTxId;
  try {
    const er = await jpost(REST + '/transactions', { transaction: rawTx, allowOrphan: true });
    escrowTxId = er.transactionId || er.txid || er.tx_id || JSON.stringify(er);
    console.log('  Escrow TX:', escrowTxId);
    console.log('  Explorer: https://explorer-tn12.kaspa.org/txs/' + escrowTxId);
  } catch(e) {
    console.log('  [ERROR]', e.message);
    process.exit(1);
  }

  // 5. Wait, finish, claim
  console.log('\n[5] Waiting 12s for DAG conf...');
  await new Promise(r => setTimeout(r, 12000));

  console.log('\n[6] Checkmate...');
  resp = await jpost(LOCAL + '/api/games/' + gameId + '/checkmate', {
    winner: w.address, loser: 'kaspatest:dummy00000000000000000000000000000000000000000000000000000000', fen: '8/8/8/8/8/8/8/8 w - - 0 1'
  });
  console.log('  Result:', resp.winner ? 'winner set' : ('error: ' + (resp.error||'?')));

  console.log('\n[7] Claim...');
  resp = await jpost(LOCAL + '/api/games/' + gameId + '/claim', {});
  console.log('  Keys:', Object.keys(resp).join(','));

  if (resp.pskt) {
    console.log('  PSKT: YES (' + resp.pskt.length + ' hex chars)');
    const psktObj = JSON.parse(Buffer.from(resp.pskt, 'hex').toString());
    const tx = psktObj.tx;
    
    // Add winner signature
    const in0 = tx.inputs[0].previousOutpoint;
    const wsig = signInput(in0.transactionId, in0.index, priv);
    tx.inputs[0].signatureScript += sigScript(wsig, pub);
    tx.lockTime = '0';
    tx.subnetworkId = tx.subnetworkId || '0000000000000000000000000000000000000000';
    tx.outputs = tx.outputs.map(o => ({ value: o.value, scriptPublicKey: { version: o.scriptPublicKey?.version||0, script: o.scriptPublicKey?.script } }));
    if (!tx.subnetworkId) tx.subnetworkId = '0000000000000000000000000000000000000000';

    console.log('\n[8] Broadcasting settlement...');
    try {
      const sr = await jpost(REST + '/transactions', { transaction: tx, allowOrphan: true });
      const settleTxId = sr.transactionId || sr.txid || sr.tx_id;
      console.log('  Settlement TX:', settleTxId);
      console.log('  Explorer: https://explorer-tn12.kaspa.org/txs/' + settleTxId);
      await jpost(LOCAL + '/api/games/' + gameId + '/settled', { txId: settleTxId, winner: w.address });
      console.log('  Server notified.');
    } catch(e) {
      console.log('  [ERROR]', e.message);
    }
  } else {
    console.log('  [NO PSKT]', resp.error || 'unknown');
  }

  // 6. Report
  console.log('\n==========================================');
  console.log('  FINAL REPORT');
  console.log('==========================================');
  bal = await jget(REST + '/addresses/' + w.address + '/balance');
  const finalKas = (parseInt(bal?.balance || '0')) / SOMPI_PER_KAS;
  console.log('  Wallet:', w.address);
  console.log('  Balance:', finalKas.toFixed(4), 'KAS');
  console.log('  Game:', gameId);
  const gs = await jget(LOCAL + '/api/games/' + gameId);
  console.log('  Status:', gs?.status || '?');
  console.log('  SettleTxId:', gs?.settleTxId || 'none');
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
