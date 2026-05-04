const blake = require('blakejs');
const { schnorr } = require('@noble/secp256k1');
const https = require('https');

// Configure noble to use blakejs for sha256
const { utils } = require('@noble/secp256k1');
utils.hmacSha256Sync = (key, ...msgs) => {
  // Simple HMAC-SHA256 using blake2b (Kaspa uses blake2b everywhere, not sha256)
  // Actually for Schnorr signing, noble needs sha256 for the BIP-340 tagged hash
  // We need to provide this. Kaspa uses blake2b keyed, but BIP-340 Schnorr standard
  // requires SHA256. So we provide a real SHA256.
  const crypto = require('crypto');
  const h = crypto.createHmac('sha256', key);
  for (const msg of msgs) h.update(msg);
  return h.digest();
};

// Now sign
const SIGHASH_KEY = Buffer.from('TransactionSigningHash');

function tsh(data) {
  return Buffer.from(blake.blake2b(data, SIGHASH_KEY, 32));
}

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
function u64(v) {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(Number(BigInt(v) & 0xFFFFFFFFn), 0);
  b.writeUInt32LE(Number((BigInt(v) >> 32n) & 0xFFFFFFFFn), 4);
  return b;
}
function vi(buf, v) {
  const n = Number(v);
  if (n < 0xfd) buf.push(n);
  else if (n <= 0xffff) { buf.push(0xfd); const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); for (let x of b) buf.push(x); }
  else { buf.push(0xfe); const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); for (let x of b) buf.push(x); }
}

const txid = Buffer.from('0d68e1b4fec415d8dca8bf802198605bedd6f7eca5c5deb0bf8abc9951bee423', 'hex');
const spk = Buffer.from('2006fc99d5cdf1485574c6dcf0bc326a607b41f080bd820bf68bf0fee0df2fd127ac', 'hex');
const privkey = Buffer.from('649e2e1435f36954adaddc07ece686459d3c135da5ef0942fdcc745fe27e1496', 'hex');

// Pre-hashes
const poh = tsh(Buffer.concat([txid, u32(0)]));
const sqh = tsh(u64(0n));
const soch = tsh(Buffer.from([1]));

// outputs_hash
let od = Buffer.concat([u64(99999970000n), u16(0)]);
const svl = [];
vi(svl, spk.length);
od = Buffer.concat([od, Buffer.from(svl), spk]);
const ohash = tsh(od);

// payload_hash (empty → zero)
const plh = Buffer.alloc(32, 0);

// Full sighash assembly
const sh = Buffer.concat([
  u16(0), poh, sqh, soch,
  txid, u32(0),
  u16(0), Buffer.from(svl), spk,
  u64(100000000000n),
  u64(0n),
  Buffer.from([1]),
  ohash,
  u64(0n),
  Buffer.alloc(20, 0),
  u64(0n),
  plh,
  Buffer.from([1]),
]);

const sighash = tsh(sh);
console.log('sighash:', sighash.toString('hex'));

// BIP-340 Schnorr sign
const sig = schnorr.sign(sighash, privkey);
const sigHex = Buffer.from(sig).toString('hex');
console.log('sig:', sigHex);

// Verify locally
const pubkey = Buffer.from('06fc99d5cdf1485574c6dcf0bc326a607b41f080bd820bf68bf0fee0df2fd127', 'hex');
const ok = schnorr.verify(sig, sighash, pubkey);
console.log('local verify:', ok);

// Build and submit
function submitTx(sigScript, label) {
  return new Promise((resolve) => {
    const tx = {
      version: 0,
      inputs: [{
        previousOutpoint: { transactionId: '0d68e1b4fec415d8dca8bf802198605bedd6f7eca5c5deb0bf8abc9951bee423', index: 0 },
        signatureScript: sigScript,
        sequence: '0',
        sigOpCount: 1
      }],
      outputs: [{
        amount: '99999970000',
        scriptPublicKey: { version: 0, scriptPublicKey: '2006fc99d5cdf1485574c6dcf0bc326a607b41f080bd820bf68bf0fee0df2fd127ac' }
      }],
      lockTime: '0',
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: '0',
      payload: ''
    };
    const data = JSON.stringify({ transaction: tx, allowOrphan: true });
    const req = https.request({
      hostname: 'api-tn12.kaspa.org', path: '/transactions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ label, status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ label, status: 0, body: e.message }));
    req.write(data); req.end();
  });
}

(async () => {
  // Format A: OP_DATA_64 (0x40) + 64-byte sig
  const ssA = '40' + sigHex;
  const rA = await submitTx(ssA, 'A(OP_DATA_64+sig)');
  console.log(rA.label, rA.status, rA.body.slice(0, 300));

  // Format B: OP_DATA_65 (0x41) + 64-byte sig + 0x01
  const ssB = '41' + sigHex + '01';
  const rB = await submitTx(ssB, 'B(OP_DATA_65+sig+01)');
  console.log(rB.label, rB.status, rB.body.slice(0, 300));
})();
