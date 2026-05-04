#!/usr/bin/env node
'use strict';
// e2e-test.js — Phase 18: Correct sighash (u64 LE lengths), Rust secp256k1 signer
// Working TN12: sigScript = 0x41 + 64-byte-sig + 0x01

console.log('==========================================');
console.log('  HTP E2E TEST — Kaspa TN12 (Phase 18)');
console.log('==========================================\n');

const https = require('https');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const REST = 'https://api-tn12.kaspa.org';
const LOCAL = 'http://localhost:3333';
const SOMPI_PER_KAS = 100000000;
const FEE = 30000;
const DUST = 300;

function jget(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
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
          if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + d.slice(0, 300)));
          else resolve(r);
        } catch(e) { reject(new Error('Parse: ' + d.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ── CANONICAL signTx (u64 LE lengths, keyed Blake2b) ──
function signTx(txObj, privkeyArg, utxoEntries) {
  const privHex = Buffer.isBuffer(privkeyArg)
    ? privkeyArg.toString('hex').slice(0, 64)
    : String(privkeyArg).slice(0, 64);

  const rustUtxos = (utxoEntries || []).map(u => ({
    txid:          u.outpoint?.transactionId || u.txid || u.transactionId || '',
    vout:          u.outpoint?.index ?? u.vout ?? u.index ?? 0,
    amount:        String(u.utxoEntry?.amount ?? u.amount ?? 0),
    scriptPubKey:  u.utxoEntry?.scriptPublicKey?.scriptPublicKey
                || u.scriptPublicKey?.scriptPublicKey
                || u.scriptPublicKey?.script
                || u.script || '',
    isCoinbase:    u.utxoEntry?.isCoinbase   || u.isCoinbase   || false,
    blockDaaScore: String(u.utxoEntry?.blockDaaScore ?? u.blockDaaScore ?? 0)
  }));

  const input = JSON.stringify({
    network: 'tn12',
    tx: JSON.parse(JSON.stringify(txObj, (k, v) =>
          typeof v === 'bigint' ? String(v) : v)),
    utxos:    rustUtxos,
    privkeys: [privHex]
  });

  let out;
  try {
    out = execSync('/root/htp-signer/target/release/htp-signer', {
      input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024
    });
  } catch(e) {
    if (e.stdout) out = e.stdout;
    else throw new Error('Rust signer exec failed: ' + e.message);
  }

  let r;
  try { r = JSON.parse(out); }
  catch(e) { throw new Error('Rust signer invalid JSON: ' + out.slice(0, 200)); }

  if (r.error) throw new Error('Rust signer [' + r.error + ']: ' + r.message);
  return r.tx;
}

function toRestTx(signedTx) {
  return {
    version: 0,
    inputs: signedTx.inputs.map(inp => ({
      previousOutpoint: {
        transactionId: inp.previousOutpoint.transactionId,
        index: inp.previousOutpoint.index
      },
      signatureScript: inp.signatureScript,
      sequence: inp.sequence || '0',
      sigOpCount: inp.sigOpCount || 1
    })),
    outputs: signedTx.outputs.map(o => ({
      amount: o.value,
      scriptPublicKey: {
        version: o.scriptPublicKey.version || 0,
        scriptPublicKey: o.scriptPublicKey.script
      }
    })),
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: ''
  };
}

// ── MAIN ──
async function main() {
  const WALLET_FILE = '/root/htp/.e2e-wallet.json';
  const w = JSON.parse(fs.readFileSync(WALLET_FILE));
  console.log('[1] Wallet:', w.address);

  console.log('\n[2] Balance check...');
  let bal = await jget(REST + '/addresses/' + w.address + '/balance');
  let kas = (parseInt(bal?.balance || '0')) / SOMPI_PER_KAS;
  console.log('  Balance:', kas.toFixed(2), 'KAS');
  if (kas < 2) { console.log('[FAIL] Need 2+ KAS'); process.exit(1); }

  // ── Fund escrow: 1 KAS to self (demonstrates signTx works) ──
  console.log('\n[3] Escrow: 1 KAS to self...');
  let utxos = await jget(REST + '/addresses/' + w.address + '/utxos');
  utxos = (Array.isArray(utxos) ? utxos : []).sort((a, b) =>
    parseInt(b.utxoEntry?.amount || '0') - parseInt(a.utxoEntry?.amount || '0'));

  const target = SOMPI_PER_KAS + FEE;
  let consumed = 0, selected = [];
  for (const u of utxos) {
    selected.push(u);
    consumed += parseInt(u.utxoEntry?.amount || '0');
    if (consumed >= target) break;
  }
  if (consumed < target) { console.log('[FAIL] Insufficient UTXOs'); process.exit(1); }

  const change = consumed - SOMPI_PER_KAS - FEE;
  console.log('  Using', selected.length, 'UTXOs, change', change, 'sompi');

  const escrowSPK = selected[0].utxoEntry?.scriptPublicKey?.scriptPublicKey
                 || selected[0].scriptPublicKey?.script || ('20' + w.xonly + 'ac');

  const escrowUnsignedTx = {
    version: 0,
    inputs: selected.map(u => ({
      previousOutpoint: {
        transactionId: u.outpoint?.transactionId || u.transactionId,
        index: u.outpoint?.index ?? 0
      },
      signatureScript: '',
      sequence: '0',
      sigOpCount: 1
    })),
    outputs: [
      { value: String(SOMPI_PER_KAS), scriptPublicKey: { version: 0, script: escrowSPK } }
    ],
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: ''
  };
  if (change > DUST) {
    escrowUnsignedTx.outputs.push({
      value: String(change),
      scriptPublicKey: { version: 0, script: escrowSPK }
    });
  }

  let escrowTxId;
  try {
    const signed = signTx(escrowUnsignedTx, w.privkey, selected);
    const rawTx = toRestTx(signed);
    const er = await jpost(REST + '/transactions', { transaction: rawTx, allowOrphan: true });
    escrowTxId = er.transactionId || er.txid;
    console.log('  Escrow TX:', escrowTxId);
    console.log('  Explorer: https://explorer-tn12.kaspa.org/txs/' + escrowTxId);
  } catch(e) {
    console.log('  [ERROR]', e.message);
    process.exit(1);
  }

  // ── Wait for confirmation, then payout ──
  console.log('\n[4] Waiting 30s for DAG confirmation...');
  await new Promise(r => setTimeout(r, 30000));

  console.log('\n[5] Polling for escrow UTXO...');
  let escrowUtxo = null;
  for (let i = 0; i < 12; i++) {
    const list = await jget(REST + '/addresses/' + w.address + '/utxos');
    for (const u of (Array.isArray(list) ? list : [])) {
      const amt = parseInt(u.utxoEntry?.amount || '0');
      if (amt >= SOMPI_PER_KAS && amt <= SOMPI_PER_KAS + 200000) {
        escrowUtxo = u;
        break;
      }
    }
    if (escrowUtxo) break;
    await new Promise(r => setTimeout(r, 5000));
    process.stdout.write('.');
  }
  console.log('');

  if (!escrowUtxo) {
    console.log('  [WARN] Escrow UTXO not found, checking explorer...');
    console.log('  https://explorer-tn12.kaspa.org/txs/' + escrowTxId);
    process.exit(1);
  }
  console.log('  UTXO found:', escrowUtxo.outpoint?.transactionId, 'amount:', escrowUtxo.utxoEntry?.amount);

  // Payout: spend escrow UTXO back to wallet
  console.log('\n[6] Payout (simulated winner)...');
  const escrowAmt = parseInt(escrowUtxo.utxoEntry?.amount || '0');
  const payoutFee = 2000;
  const payoutAmt = escrowAmt - payoutFee;

  const payoutUnsignedTx = {
    version: 0,
    inputs: [{
      previousOutpoint: {
        transactionId: escrowUtxo.outpoint?.transactionId,
        index: escrowUtxo.outpoint?.index ?? 0
      },
      signatureScript: '',
      sequence: '0',
      sigOpCount: 1
    }],
    outputs: [
      { value: String(payoutAmt), scriptPublicKey: { version: 0, script: escrowSPK } }
    ],
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: ''
  };

  let payoutTxId;
  try {
    const signed = signTx(payoutUnsignedTx, w.privkey, [escrowUtxo]);
    const rawTx = toRestTx(signed);
    const pr = await jpost(REST + '/transactions', { transaction: rawTx, allowOrphan: true });
    payoutTxId = pr.transactionId || pr.txid;
    console.log('  Payout TX:', payoutTxId);
    console.log('  Explorer: https://explorer-tn12.kaspa.org/txs/' + payoutTxId);
  } catch(e) {
    console.log('  [ERROR]', e.message);
    process.exit(1);
  }

  console.log('\n==========================================');
  console.log('  HTP PHASE 18 — COMPLETE');
  console.log('==========================================');
  console.log('  Wallet:    ', w.address);
  console.log('  Escrow TX: ', escrowTxId);
  console.log('  Payout TX: ', payoutTxId);
  console.log('  Explorer:   https://explorer-tn12.kaspa.org/txs/' + payoutTxId);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
