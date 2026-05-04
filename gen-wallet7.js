'use strict';
/**
 * gen-wallet7.js — correct Kaspa TN12 P2PK wallet
 * Kaspa P2PK address = kaspatest: + bech32(0x00 + xonly_pubkey_32_bytes)
 * Uses @noble/secp256k1 for secp256k1 key generation
 */
const fs    = require('fs');
const https = require('https');
const crypto = require('crypto');

// ── Kaspa bech32 (different generator polynomial from Bitcoin) ────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

function polymod(values) {
  let c = 1n;
  for (const v of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(v);
    for (let i = 0; i < 5; i++) if ((c0 >> BigInt(i)) & 1n) c ^= GEN[i];
  }
  return c ^ 1n;
}
function hrpExpand(hrp) {
  const r = [];
  for (const c of hrp) r.push(c.charCodeAt(0) >> 5);
  r.push(0);
  for (const c of hrp) r.push(c.charCodeAt(0) & 31);
  return r;
}
function createChecksum(hrp, data) {
  const v = hrpExpand(hrp).concat(data).concat([0,0,0,0,0,0,0,0]);
  const m = polymod(v);
  const r = [];
  for (let p = 0; p < 8; p++) r.push(Number((m >> BigInt(5*(7-p))) & 31n));
  return r;
}
function convertbits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const r = [], maxv = (1 << to) - 1;
  for (const v of data) {
    acc = (acc << from) | v; bits += from;
    while (bits >= to) { bits -= to; r.push((acc >> bits) & maxv); }
  }
  if (pad && bits > 0) r.push((acc << (to - bits)) & maxv);
  return r;
}
function kaspaEncode(hrp, payload) {
  const data  = convertbits(Array.from(payload), 8, 5, true);
  const check = createChecksum(hrp, data);
  return hrp + ':' + data.concat(check).map(v => CHARSET[v]).join('');
}

// ── secp256k1 via @noble/secp256k1 ───────────────────────────────────────────
async function generateWallet() {
  // Try @noble/secp256k1 v2 (esm) first, then v1 (cjs)
  let privBytes, pubBytes;
  try {
    const secp = require('@noble/secp256k1');
    // v1 API
    privBytes = secp.utils.randomPrivateKey();
    pubBytes  = secp.getPublicKey(privBytes, true);  // compressed 33 bytes
  } catch(e1) {
    try {
      // Try @noble/curves
      const { secp256k1 } = require('@noble/curves/secp256k1');
      privBytes = secp256k1.utils.randomPrivateKey();
      pubBytes  = secp256k1.getPublicKey(privBytes, true);
    } catch(e2) {
      // Fallback: generate via Node crypto ECDH
      const ecdh = crypto.createECDH('secp256k1');
      ecdh.generateKeys();
      privBytes = ecdh.getPrivateKey();             // Buffer 32 bytes
      pubBytes  = ecdh.getPublicKey(null, 'compressed'); // Buffer 33 bytes
    }
  }

  const privHex  = Buffer.from(privBytes).toString('hex');
  const pubHex   = Buffer.from(pubBytes).toString('hex');
  const xonly32  = Buffer.from(pubBytes).slice(1);  // drop 0x02/0x03 prefix

  // Kaspa P2PK payload: 0x00 version + 32-byte x-only pubkey
  const payload = Buffer.concat([Buffer.from([0x00]), xonly32]);
  const address = kaspaEncode('kaspatest', payload);

  console.log('Privkey :', privHex);
  console.log('Pubkey  :', pubHex);
  console.log('Address :', address);
  console.log('Length  :', address.length, '(should be 67: "kaspatest:" + 57 chars)');

  const wallet = { privkey: privHex, pubkey: pubHex, xonly: xonly32.toString('hex'), address };
  fs.writeFileSync('/root/htp/.e2e-wallet.json', JSON.stringify(wallet, null, 2));
  console.log('Saved   : /root/htp/.e2e-wallet.json');

  // Validate
  https.get(`https://api-tn12.kaspa.org/addresses/${address}/balance`,
    { rejectUnauthorized: false }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.balance !== undefined) {
            console.log('\n✅ VALID — Balance:', (parseInt(j.balance||0)/1e8).toFixed(4), 'KAS');
            console.log('Faucet: https://faucet.kaspa.org/?address=' + address);
          } else if (Array.isArray(j.detail)) {
            console.log('\n❌ Still invalid:', JSON.stringify(j.detail).slice(0,200));
          } else {
            console.log('\nAPI:', JSON.stringify(j).slice(0,200));
          }
        } catch(_) { console.log('Raw:', d.slice(0,300)); }
      });
    }).on('error', e => console.log('API err:', e.message));
}

generateWallet().catch(e => { console.error(e.message); process.exit(1); });
