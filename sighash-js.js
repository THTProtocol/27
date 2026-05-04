const blake = require('blakejs');
const secp = require('@noble/secp256k1');

const SIGHASH_KEY = Buffer.from('TransactionSigningHash');

function tsh(data) {
  return Buffer.from(blake.blake2b(data, SIGHASH_KEY, 32));
}

function u16_le(v) { const b = Buffer.alloc(2); b.writeUInt16LE(Number(v),0); return b; }
function u32_le(v) { const b = Buffer.alloc(4); b.writeUInt32LE(Number(v),0); return b; }
function u64_le_buf(v) {
  const b = Buffer.alloc(8);
  const n = BigInt(v);
  b.writeUInt32LE(Number(n & 0xFFFFFFFFn), 0);
  b.writeUInt32LE(Number((n >> 32n) & 0xFFFFFFFFn), 4);
  return b;
}

function write_varint(buf, val) {
  const n = Number(val);
  if (n < 0xfd) buf.push(n);
  else if (n <= 0xffff) { buf.push(0xfd); const b=Buffer.alloc(2); b.writeUInt16LE(n,0); for(let x of b) buf.push(x); }
  else { buf.push(0xfe); const b=Buffer.alloc(4); b.writeUInt32LE(n,0); for(let x of b) buf.push(x); }
}

const txid = '0d68e1b4fec415d8dca8bf802198605bedd6f7eca5c5deb0bf8abc9951bee423';
const txidBuf = Buffer.from(txid, 'hex');
const privkey = '649e2e1435f36954adaddc07ece686459d3c135da5ef0942fdcc745fe27e1496';
const spk = '2006fc99d5cdf1485574c6dcf0bc326a607b41f080bd820bf68bf0fee0df2fd127ac';
const spkBuf = Buffer.from(spk, 'hex');

// Build tx
const input = { txidBuf, index: 0, sigOpCount: 1, sequence: 0n };
const output = { amount: 99999970000n, spkBuf };

// 1. previous_outputs_hash
let poh_data = Buffer.concat([txidBuf, u32_le(0)]);
const poh = tsh(poh_data);
console.log('poh:', poh.toString('hex'));

// 2. sequences_hash
let sqh_data = u64_le_buf(0n);
const sqh = tsh(sqh_data);
console.log('sqh:', sqh.toString('hex'));

// 3. sig_op_counts_hash
const soch = tsh(Buffer.from([1]));
console.log('soch:', soch.toString('hex'));

// 4. outputs_hash
let od = Buffer.concat([u64_le_buf(output.amount), u16_le(0)]);
const vl = [];
write_varint(vl, output.spkBuf.length);
od = Buffer.concat([od, Buffer.from(vl), output.spkBuf]);
const oh = tsh(od);
const ohash = tsh(oh);
console.log('ohash:', ohash.toString('hex'));

// 5. payload_hash (empty)
const plh = Buffer.alloc(32, 0);
console.log('plh:', plh.toString('hex'));

// Compose full sighash
const sh = Buffer.concat([
  u16_le(0),            // version
  poh,                   // previous_outputs_hash
  sqh,                   // sequences_hash
  soch,                  // sig_op_counts_hash
  txidBuf,              // outpoint txid
  u32_le(0),            // outpoint index
  u16_le(0),            // spk version
  Buffer.from(vl),      // spk varint length
  spkBuf,               // spk bytes
  u64_le_buf(100000000000n), // amount
  u64_le_buf(0n),       // sequence
  Buffer.from([1]),     // sig_op_count
  ohash,                // outputs_hash
  u64_le_buf(0n),       // lock_time
  Buffer.alloc(20, 0),  // subnetwork_id
  u64_le_buf(0n),       // gas
  plh,                  // payload_hash
  Buffer.from([1]),     // hash_type SIGHASH_ALL
]);

const sighash = tsh(sh);
console.log('\nJS sighash:', sighash.toString('hex'));

// Sign with noble
const sig = secp.signSchnorr(sighash, privkey);
console.log('JS sig:', Buffer.from(sig).toString('hex'));

const sigScript = '41' + Buffer.from(sig).toString('hex') + '01';
console.log('JS sigScript:', sigScript);
console.log('Len:', sigScript.length, 'chars');
