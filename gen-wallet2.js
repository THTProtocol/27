'use strict';
const bip39 = require('bip39');
const blake = require('blakejs');
const nacl = require('tweetnacl');
const fs = require('fs');
const https = require('https');

const REST_BASE = 'https://api-tn12.kaspa.org';

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(REST_BASE + path, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

// Kaspa bech32 encode (verified against known addresses)
function encodeBech32(hrp, data) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  
  function polymod(values) {
    let chk = 1;
    for (const v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let j = 0; j < 5; j++) if ((top >> j) & 1) chk ^= GENERATOR[j];
    }
    return chk;
  }
  
  function hrpExpand(hrp) {
    const ret = [];
    for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
    ret.push(0);
    for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
    return ret;
  }
  
  // Convert 8-bit bytes to 5-bit words
  function toWords(bytes) {
    let bits = 0, acc = 0, ret = [], maxv = 31;
    for (const v of bytes) {
      acc = (acc << 8) | v;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        ret.push((acc >>> bits) & maxv);
      }
    }
    if (bits > 0) ret.push((acc << (5 - bits)) & maxv);
    return ret;
  }

  const words = toWords(data);
  const checksumInput = hrpExpand(hrp).concat(words).concat([0,0,0,0,0,0]);
  const mod = polymod(checksumInput);
  let addr = '';
  for (const w of words) addr += CHARSET[w];
  for (let i = 0; i < 6; i++) addr += CHARSET[(mod >>> (5 * (5 - i))) & 31];
  return addr;
}

function pubkeyToAddress(pubkeyHex, prefix) {
  const pk = Buffer.from(pubkeyHex, 'hex');
  const hash = blake.blake2b(pk, null, 32);
  const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);
  const addr = encodeBech32(prefix, payload);
  return prefix + ':' + addr;
}

// Generate mnemonic
const mnemonic = bip39.generateMnemonic();
console.log('Mnemonic:', mnemonic);

const seed = bip39.mnemonicToSeedSync(mnemonic);
console.log('Seed length:', seed.length);

// Use ed25519 from tweetnacl
const keyPair = nacl.sign.keyPair();
const privkey = Buffer.from(keyPair.secretKey).toString('hex');  // 64 bytes (32 seed + 32 pub)
const pubkey = Buffer.from(keyPair.publicKey).toString('hex');   // 32 bytes
const seedBytes = Buffer.from(keyPair.secretKey).subarray(0, 32).toString('hex');

console.log('Privkey:', privkey);
console.log('Pubkey:', pubkey);
console.log('Seed:', seedBytes);

// Kaspa testnet address
const prefix = 'kaspatest';
const address = pubkeyToAddress(pubkey, prefix);
console.log('\nAddress:', address);

// Save wallet
const wallet = { mnemonic, privkey: seedBytes, pubkey };
fs.writeFileSync('/root/htp/.server-wallet.json', JSON.stringify(wallet, null, 2));

// Test: verify via REST API
(async () => {
  try {
    const bal = await get('/addresses/' + address + '/balance');
    console.log('\nREST API check:', JSON.stringify(bal).slice(0, 200));
    if (bal && bal.address) {
      console.log('VALID ADDRESS!');
      console.log('Balance:', bal.balance, 'sompi =', (parseInt(bal.balance || '0')/1e8).toFixed(4), 'KAS');
      console.log('\nFaucet URL: https://faucet.kaspa.org?address=' + address);
    }
  } catch(e) {
    console.log('API error:', e.message);
  }
})();
