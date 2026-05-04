'use strict';
/**
 * gen-wallet6.js — correct Kaspa TN12 wallet generator
 *
 * Kaspa P2PK address encoding:
 *   - secp256k1 keypair (NOT ed25519)
 *   - Address payload = 0x00 (version) + 32-byte x-only pubkey (no hashing)
 *   - Bech32 encoded with HRP = 'kaspatest' and separator ':'
 *   - Kaspa uses its own bech32 charset: qpzry9x8gf2tvdw0s3jn54khce6mua7l
 */

const fs   = require('fs');
const https = require('https');
const { execSync } = require('child_process');

// ── bech32 with Kaspa charset ────────────────────────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN     = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

function bech32Polymod(values) {
  let c = 1n;
  for (const v of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(v);
    for (let i = 0; i < 5; i++) if ((c0 >> BigInt(i)) & 1n) c ^= GEN[i];
  }
  return c ^ 1n;
}

function bech32HrpExpand(hrp) {
  const r = [];
  for (const c of hrp) r.push(c.charCodeAt(0) >> 5);
  r.push(0);
  for (const c of hrp) r.push(c.charCodeAt(0) & 31);
  return r;
}

function bech32CreateChecksum(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(data).concat([0,0,0,0,0,0,0,0]);
  const mod = bech32Polymod(values);
  const ret = [];
  for (let p = 0; p < 8; p++) ret.push(Number((mod >> BigInt(5 * (7 - p))) & 31n));
  return ret;
}

function convertbits(data, frombits, tobits, pad) {
  let acc = 0, bits = 0;
  const ret = [];
  const maxv = (1 << tobits) - 1;
  for (const v of data) {
    acc = (acc << frombits) | v;
    bits += frombits;
    while (bits >= tobits) { bits -= tobits; ret.push((acc >> bits) & maxv); }
  }
  if (pad && bits > 0) ret.push((acc << (tobits - bits)) & maxv);
  return ret;
}

function encode(hrp, payload) {
  const data  = convertbits(Array.from(payload), 8, 5, true);
  const check = bech32CreateChecksum(hrp, data);
  return hrp + ':' + data.concat(check).map(v => CHARSET[v]).join('');
}

// ── secp256k1 via Node.js built-in crypto (Node 17+) ────────────────────────
function generateSecp256k1() {
  const { generateKeyPairSync, createPrivateKey } = require('crypto');
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
  const der    = privateKey.export({ type: 'sec1', format: 'der' });
  // SEC1 DER: 0x30 len 0x02 01 01 0x04 20 <32-byte privkey> ...
  const privOff = der.indexOf(0x04, 4) + 2;   // skip 0x04 + length byte
  const priv    = der.slice(privOff, privOff + 32);

  // Derive compressed pubkey using Node crypto
  const pubKey  = createPrivateKey({ key: privateKey }).asymmetricKeyDetails;
  // Use SubtleCrypto-style: just compute via small helper
  // Fallback: call openssl
  const privHex = priv.toString('hex');
  let pubHex;
  try {
    const out = execSync(
      `echo '${privHex}' | openssl ec -inform DER -noout 2>/dev/null || true`,
      { stdio: ['pipe','pipe','pipe'] }
    );
    // Use openssl to get pubkey from privkey hex
    const pem = execSync(
      `openssl ec -inform DER -text -noout <<< '' 2>/dev/null || true`
    );
  } catch(_) {}

  // Simpler: use the existing secp256k1 npm package if available,
  // otherwise derive x-only pubkey via tiny-secp256k1 wasm
  try {
    const secp = require('tiny-secp256k1');
    const pub  = secp.pointFromScalar(priv, true);  // compressed 33 bytes
    pubHex     = Buffer.from(pub).toString('hex');
    return { priv: privHex, pub: pubHex, xonly: Buffer.from(pub).slice(1) };
  } catch(_) {}

  try {
    const { secp256k1 } = require('@noble/curves/secp256k1');
    const pub  = secp256k1.getPublicKey(priv, true);
    pubHex     = Buffer.from(pub).toString('hex');
    return { priv: privHex, pub: pubHex, xonly: Buffer.from(pub).slice(1) };
  } catch(_) {}

  throw new Error('No secp256k1 library found. Run: npm install tiny-secp256k1');
}

// ── address from x-only pubkey ───────────────────────────────────────────────
function pubkeyToAddress(xonlyPubkey32, hrp = 'kaspatest') {
  // Kaspa P2PK payload: version byte 0x00 + 32-byte x-only pubkey (NO hashing)
  const payload = Buffer.concat([Buffer.from([0x00]), xonlyPubkey32]);
  return encode(hrp, payload);
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  let kp;
  try {
    kp = generateSecp256k1();
  } catch(e) {
    console.error('Key generation failed:', e.message);
    console.error('Run: cd /root/htp && npm install tiny-secp256k1');
    process.exit(1);
  }

  const address = pubkeyToAddress(kp.xonly);

  console.log('Privkey:', kp.priv);
  console.log('Pubkey (compressed):', kp.pub);
  console.log('Address:', address);
  console.log('Address length:', address.length);

  const wallet = {
    privkey:  kp.priv,
    pubkey:   kp.pub,
    xonly:    kp.xonly.toString('hex'),
    address
  };

  fs.writeFileSync('/root/htp/.e2e-wallet.json', JSON.stringify(wallet, null, 2));
  console.log('Saved to .e2e-wallet.json');

  // Validate against TN12 API
  const url = `https://api-tn12.kaspa.org/addresses/${address}/balance`;
  https.get(url, { rejectUnauthorized: false }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(d);
        if (j.address || j.balance !== undefined) {
          console.log('\n✅ VALID ADDRESS — Balance:', (parseInt(j.balance||'0')/1e8).toFixed(4), 'KAS');
          console.log('Faucet: https://faucet.kaspa.org/?address=' + address);
        } else {
          console.log('\n⚠ API response:', JSON.stringify(j).slice(0,200));
        }
      } catch(_) { console.log('Raw:', d.slice(0,200)); }
    });
  }).on('error', e => console.log('API error:', e.message));
})();
