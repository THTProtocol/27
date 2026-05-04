// Verify sighash against rusty-kaspa test vector with u64 LE lengths
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

// write_len = u64 LE (NOT varint!)
function write_len(v) { return u64(v); }

// write_var_bytes = write_len(N) + bytes
function write_var_bytes(data, bytes) {
  return Buffer.concat([data, write_len(BigInt(bytes.length)), bytes]);
}

const prev_txid_h = "880eb9819a31821d9d2399e2f35e2433b72637e393d71ecc9b8d0250f49153c3";
const prev_txid = Buffer.from(prev_txid_h, "hex");
const spk1 = Buffer.from("208325613d2eeaf7176ac6c670b13c0043156c427438ed72d74b7800862ad884e8ac", "hex");
const spk2 = Buffer.from("20fcef4c106cf11135bbd70f02a726a92162d2fb8b22f0469126f800862ad884e8ac", "hex");

const inputs = [
  { txid: prev_txid, index: 0, sigOpCount: 0, sequence: 0n, amount: 100n, spk: spk1 },
  { txid: prev_txid, index: 1, sigOpCount: 0, sequence: 1n, amount: 200n, spk: spk2 },
  { txid: prev_txid, index: 2, sigOpCount: 0, sequence: 2n, amount: 300n, spk: spk2 },
];
const outputs = [
  { amount: 300n, spk: spk2 },
  { amount: 300n, spk: spk1 },
];

const inputIdx = 0;
const inp = inputs[inputIdx];

// previous_outputs_hash
let poh_data = Buffer.alloc(0);
for (const i of inputs) poh_data = Buffer.concat([poh_data, i.txid, u32(i.index)]);
const poh = tsh(poh_data);

// sequences_hash
let sqh_data = Buffer.alloc(0);
for (const i of inputs) sqh_data = Buffer.concat([sqh_data, u64(i.sequence)]);
const sqh = tsh(sqh_data);

// sig_op_counts_hash
let soch_data = Buffer.alloc(0);
for (const i of inputs) soch_data = Buffer.concat([soch_data, Buffer.from([i.sigOpCount])]);
const soch = tsh(soch_data);

// outputs_hash - each output written sequentially with write_var_bytes (u64 LE len)
let oh_data = Buffer.alloc(0);
for (const o of outputs) {
  oh_data = Buffer.concat([oh_data, u64(o.amount), u16(0)]);
  oh_data = write_var_bytes(oh_data, o.spk);
}
const ohash = tsh(oh_data);

const plh = Buffer.alloc(32, 0);

// hash_script_public_key for this input
let spk_inline = u16(0);
spk_inline = write_var_bytes(spk_inline, inp.spk);

// Full sighash
const sh = Buffer.concat([
  u16(0), poh, sqh, soch,
  inp.txid, u32(inp.index),
  spk_inline,
  u64(inp.amount), u64(inp.sequence),
  Buffer.from([inp.sigOpCount]),
  ohash,
  u64(1615462089000n), Buffer.alloc(20, 0), u64(0n), plh,
  Buffer.from([1]),
]);

const sighash = tsh(sh);
console.log("My sighash:     ", sighash.toString("hex"));
console.log("Expected:        03b7ac6927b2b67100734c3cc313ff8c2e8b3ce3e746d46dd660b706a916b1f5");
console.log("Match:", sighash.toString("hex") === "03b7ac6927b2b67100734c3cc313ff8c2e8b3ce3e746d46dd660b706a916b1f5");
