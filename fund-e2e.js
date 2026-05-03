#!/usr/bin/env node
'use strict';
// fund-e2e.js — Send 5 KAS from Creator to E2E wallet

const https = require('https');
const nacl = require('tweetnacl');
const blake = require('blakejs');
const bip39 = require('bip39');
const hdkey = require('ed25519-hd-key');

const REST = 'https://api-tn12.kaspa.org';
const SOMPI_PER_KAS = 100000000;
const FEE = 30000;
const DUST = 300;

function jget(path) {
  return new Promise((resolve) => {
    https.get(REST + path, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function jpost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(REST + path);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
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

function makeSighash(txIdHex, outIdx) {
  const txId = Buffer.from(txIdHex, 'hex');
  const buf = Buffer.alloc(32+4+1);
  txId.copy(buf, 0); buf.writeUInt32LE(outIdx, 32); buf.writeUInt8(1, 36);
  return blake.blake2b(buf, null, 32);
}

async function main() {
  const TARGET = 'kaspatest:qr3nl3ekjrwsp3gdkt5cry2c70sm2k3z3xhj2983wp7fkfhemdhk6qqqqqq90mkgn';
  const AMOUNT_KAS = 5;
  const amountSompi = AMOUNT_KAS * SOMPI_PER_KAS;

  // Derive Creator keypair (different path formats tried)
  const mnemonic = 'fitness narrow gap scheme fold regret faint neck blanket discover feel machine';
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  
  // Try path with all hardened (library requires it)
  // But the correct derivation for the known address might need a different path
  // The CREATOR_ADDR = kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353
  // Let's try multiple paths
  
  const paths = [
    "m/44'/111111'/0'/0'/0'",
    "m/44'/972'/0'/0'/0'",   // Kaspa uses 972 or 111111
    "m/44'/111111'/0'/0'",
    "m/44'/972'/0'/0'",       // non-hardened final with 972
  ];
  
  // The address we need: kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353
  const CREATOR_ADDR = 'kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353';
  
  let creator = null;
  for (const p of paths) {
    try {
      const d = hdkey.derivePath(p, seed.toString('hex'));
      const pkey = d.key.subarray(0, 32);
      const kp = nacl.sign.keyPair.fromSeed(pkey);
      const addr = pubToAddr(Buffer.from(kp.publicKey), 'kaspatest');
      console.log('Path:', p, '->', addr);
      if (addr === CREATOR_ADDR) {
        creator = { privkey: pkey, pubkey: Buffer.from(kp.publicKey), address: addr };
        console.log('  MATCH! Found correct derivation path:', p);
        break;
      }
    } catch(e) {
      console.log('Path:', p, '-> ERROR:', e.message);
    }
  }
  
  if (!creator) {
    console.log('\nCould not derive Creator address via ed25519-hd-key.');
    console.log('Falling back: use raw private key from known wallet...');
    
    // The Creator address is known: kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353
    // We can compute its SPK and send to it from the .server-wallet if that has funds
    
    // Alternative: the .server-wallet has address kaspatest:qqm59hpa7wmvpx3pmzm44afhupr5mkd647wc8vl9xufv64k4uvnjjf5nxfy
    // but 0 balance. Let's just use the Creator's known address on chain.
    
    // Check if there's already a UTXO we can use directly
    const utxos = await jget('/addresses/' + CREATOR_ADDR + '/utxos');
    console.log('UTXOs for Creator:', Array.isArray(utxos) ? utxos.length : 'none');
    
    if (!utxos || !utxos.length) {
      console.log('No UTXOs found. Exiting.');
      process.exit(1);
    }
    
    // We need the private key. Let's try generating from mnemonic with the working path...
    // Actually, the send-escrow.js uses raw nacl keypairs, not derivation.
    // Let me try direct nacl key generation and check:
    
    // The gen-wallet.js used: "m/44'/111111'/0'/0/0" but same library version
    // Let me check if the path regex issue is the only problem - just use full hardened
    try {
      const d = hdkey.derivePath("m/44'/111111'/0'/0'/0'", seed.toString('hex'));
      const pkey = d.key.subarray(0, 32);
      const kp = nacl.sign.keyPair.fromSeed(pkey);
      const addr = pubToAddr(Buffer.from(kp.publicKey), 'kaspatest');
      console.log('Last attempt addr:', addr);
      
      // If it doesn't match, we have the wrong seed/lib combo
      // Let me just create a raw nacl keypair and check
    } catch(e) {
      console.log('Derivation error:', e.message);
    }
    
    // Final fallback: create new wallet and fund it
    console.log('\nUsing fresh keypair approach...');
    process.exit(1);
  }
  
  // Got the Creator keypair, now send funds
  console.log('\nFetching UTXOs...');
  let utxos = await jget('/addresses/' + creator.address + '/utxos');
  if (!utxos || !utxos.length) { console.log('No UTXOs.'); process.exit(1); }
  
  utxos = (Array.isArray(utxos) ? utxos : []).sort((a,b) => (
    parseInt(b.utxoEntry?.amount || b.amount || '0') - parseInt(a.utxoEntry?.amount || a.amount || '0')
  ));
  
  const target = amountSompi + FEE;
  let consumed = 0, selected = [];
  for (const u of utxos) {
    const amt = parseInt(u.utxoEntry?.amount || u.amount || '0');
    selected.push(u); consumed += amt;
    if (consumed >= target) break;
  }
  if (consumed < target) { console.log('Insufficient funds'); process.exit(1); }
  
  const change = consumed - amountSompi - FEE;
  console.log('Selected', selected.length, 'UTXOs, consumed', consumed, 'sompi');
  
  // Sign inputs
  const inputs = [];
  for (const u of selected) {
    const txId = u.outpoint?.transactionId || u.transactionId || u.txid;
    const idx = u.outpoint?.index ?? u.index ?? 0;
    const sh = makeSighash(txId, idx);
    const sig = nacl.sign.detached(sh, creator.privkey);
    const spkTarget = pubToAddr(Buffer.from(Buffer.from(TARGET.split(':')[1] || '', 'base32').toString()), 'kaspatest');
    // Actually compute target SPK properly
    const tgtPayload = TARGET.split(':')[1];
    const tgtSpk = tgtPayload ? '20' + tgtPayload.slice(0, 64) + 'ac' : '';
    
    inputs.push({
      previousOutpoint: { transactionId: txId, index: idx },
      signatureScript: Buffer.concat([
        Buffer.from([0x41]), sig, Buffer.from([0x21]), creator.pubkey
      ]).toString('hex'),
      sequence: '0'
    });
  }
  
  // Build outputs
  const outputs = [
    { value: String(amountSompi), scriptPublicKey: { version: 0, script: '20' + TARGET.split(':')[1].slice(0, 64) + 'ac' } }
  ];
  if (change > DUST) {
    outputs.push({ value: String(change), scriptPublicKey: { version: 0, script: '20' + creator.pubkey.toString('hex') + 'ac' } });
  }
  
  const rawTx = { version: 0, inputs, outputs, lockTime: '0', subnetworkId: '0000000000000000000000000000000000000000', gas: '0', payload: '' };
  
  console.log('Broadcasting...');
  try {
    const res = await jpost('/transactions', { transaction: rawTx, allowOrphan: true });
    const txId = res.transactionId || res.txid || res.tx_id;
    console.log('TX:', txId);
    console.log('Explorer: https://explorer-tn12.kaspa.org/txs/' + txId);
  } catch(e) {
    console.log('ERROR:', e.message);
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
