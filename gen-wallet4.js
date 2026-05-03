'use strict';
const { bech32 } = require('bech32');
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

function pubkeyToAddress(pubkeyHex, prefix = 'kaspatest') {
  const pk = Buffer.from(pubkeyHex, 'hex');
  const hash = blake.blake2b(pk, null, 32);
  const payload = Buffer.concat([Buffer.from([0x00]), Buffer.from(hash)]);
  const words = bech32.toWords(payload);
  return bech32.encode(prefix, words, 256);
}

// Generate keypair
const kp = nacl.sign.keyPair();
const privkey = Buffer.from(kp.secretKey).subarray(0, 32).toString('hex');
const pubkey = Buffer.from(kp.publicKey).toString('hex');

console.log('Privkey:', privkey);
console.log('Pubkey:', pubkey);

const address = pubkeyToAddress(pubkey, 'kaspatest');
console.log('Address:', address);

const wallet = { privkey, pubkey, address };
fs.writeFileSync('/root/htp/.server-wallet.json', JSON.stringify(wallet, null, 2));

(async () => {
  try {
    const bal = await httpGet('/addresses/' + address + '/balance');
    console.log('\nAPI:', JSON.stringify(bal, null, 2));
  } catch(e) { console.log('API err:', e.message); }
})();
