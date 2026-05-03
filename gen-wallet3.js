'use strict';
const bech32 = require('bech32');
const blake = require('blakejs');
const nacl = require('tweetnacl');
const fs = require('fs');
const https = require('https');

const REST_BASE = 'https://api-tn12.kaspa.org';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    https.get(REST_BASE + path, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

function encodeAddress(hrp, words) {
  return bech32.encode(hrp, words, 256); // Kaspa uses 256 as limit
}

function pubkeyToAddress(pubkeyHex, prefix = 'kaspatest') {
  const pk = Buffer.from(pubkeyHex, 'hex');
  const hash = blake.blake2b(pk, null, 32);
  const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);
  const words = bech32.toWords(payload);
  const addr = bech32.encode(prefix, words, 256);
  return addr; // Returns without prefix - bech32.encode adds it
}

// Generate keypair using tweetnacl
const kp = nacl.sign.keyPair();
const privkey = Buffer.from(kp.secretKey).subarray(0, 32).toString('hex');
const pubkey = Buffer.from(kp.publicKey).toString('hex');

console.log('Privkey:', privkey);
console.log('Pubkey:', pubkey);

// Generate Kaspa address
const address = pubkeyToAddress(pubkey, 'kaspatest');
console.log('\nAddress:', address);

// Save wallet
const wallet = { privkey, pubkey, address };
fs.writeFileSync('/root/htp/.server-wallet.json', JSON.stringify(wallet, null, 2));
console.log('Saved to .server-wallet.json');

// Verify via REST API
(async () => {
  try {
    const bal = await httpGet('/addresses/' + address + '/balance');
    console.log('\nREST API response:', JSON.stringify(bal, null, 2));
    if (bal && bal.address) {
      console.log('\n✅ ADDRESS IS VALID!');
      console.log('Balance:', bal.balance, 'sompi =', (parseInt(bal.balance || '0')/1e8).toFixed(4), 'KAS');
    }
    if (bal && bal.detail) {
      console.log('\n❌ Address validation error:', JSON.stringify(bal.detail));
    }
  } catch(e) {
    console.log('API error:', e.message);
  }
})();
