// Verify sighash against rusty-kaspa test vector
const blake = require("blakejs");

const SIGHASH_KEY = Buffer.from("TransactionSigningHash");

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

// Test vector from rusty-kaspa
const prev_txid_h = "880eb9819a31821d9d2399e2f35e2433b72637e393d71ecc9b8d0250f49153c3";
const prev_txid = Buffer.from(prev_txid_h, "hex");

const spk1_h = "208325613d2eeaf7176ac6c670b13c0043156c427438ed72d74b7800862ad884e8ac";
const spk2_h = "20fcef4c106cf11135bbd70f02a726a92162d2fb8b22f0469126f800862ad884e8ac";
const spk1 = Buffer.from(spk1_h, "hex");
const spk2 = Buffer.from(spk2_h, "hex");

// inputs: 3 inputs, all same prev txid
const inputs = [
  { txid: prev_txid, index: 0, sigOpCount: 0, sequence: 0n, amount: 100n, spk: spk1 },
  { txid: prev_txid, index: 1, sigOpCount: 0, sequence: 1n, amount: 200n, spk: spk2 },
  { txid: prev_txid, index: 2, sigOpCount: 0, sequence: 2n, amount: 300n, spk: spk2 },
];

const outputs = [
  { amount: 300n, spk: spk2 },
  { amount: 300n, spk: spk1 },
];

// Compute sighash for input 0 (SIGHASH_ALL)
const inputIdx = 0;
const inp = inputs[inputIdx];

// previous_outputs_hash
let poh_data = Buffer.alloc(0);
for (const i of inputs) {
  poh_data = Buffer.concat([poh_data, i.txid, u32(i.index)]);
}
const poh = tsh(poh_data);
console.log("poh:", poh.toString("hex"));

// sequences_hash
let sqh_data = Buffer.alloc(0);
for (const i of inputs) {
  sqh_data = Buffer.concat([sqh_data, u64(i.sequence)]);
}
const sqh = tsh(sqh_data);
console.log("sqh:", sqh.toString("hex"));

// sig_op_counts_hash
let soch_data = Buffer.alloc(0);
for (const i of inputs) {
  soch_data = Buffer.concat([soch_data, Buffer.from([i.sigOpCount])]);
}
const soch = tsh(soch_data);
console.log("soch:", soch.toString("hex"));

// outputs_hash - each output written sequentially into ONE hasher
let oh_data = Buffer.alloc(0);
for (const o of outputs) {
  oh_data = Buffer.concat([oh_data, u64(o.amount), u16(0)]);
  const vl = [];
  vi(vl, o.spk.length);
  oh_data = Buffer.concat([oh_data, Buffer.from(vl), o.spk]);
}
const ohash = tsh(oh_data);
console.log("ohash:", ohash.toString("hex"));

// payload_hash (empty -> zero)
const plh = Buffer.alloc(32, 0);

// Full sighash
const sh = Buffer.concat([
  u16(0),                   // version
  poh,                      // previous_outputs_hash
  sqh,                      // sequences_hash
  soch,                     // sig_op_counts_hash
  inp.txid,                 // outpoint txid
  u32(inp.index),           // outpoint index
  u16(0),                   // spk version
  ...(()=>{const vl=[];vi(vl,inp.spk.length);return [Buffer.from(vl)];})(),
  inp.spk,                  // spk bytes
  u64(inp.amount),          // amount
  u64(inp.sequence),        // sequence
  Buffer.from([inp.sigOpCount]), // sig_op_count
  ohash,                    // outputs_hash
  u64(1615462089000n),      // lock_time
  Buffer.alloc(20, 0),      // subnetwork_id (native)
  u64(0n),                  // gas
  plh,                      // payload_hash
  Buffer.from([1]),         // hash_type
]);

const sighash = tsh(sh);
console.log("\nMy sighash:     ", sighash.toString("hex"));
console.log("Expected sighash: 03b7ac6927b2b67100734c3cc313ff8c2e8b3ce3e746d46dd660b706a916b1f5");
console.log("Match:", sighash.toString("hex") === "03b7ac6927b2b67100734c3cc313ff8c2e8b3ce3e746d46dd660b706a916b1f5");
