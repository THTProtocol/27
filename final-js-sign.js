// Correct sighash implementation matching rusty-kaspa
const blake = require("blakejs");
const https = require("https");
const { execSync } = require("child_process");

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
// write_len = u64 LE (NOT varint)
function write_len(v) { return u64(BigInt(v)); }
function write_var_bytes_inline(data, bytes) {
  return Buffer.concat([data, write_len(bytes.length), bytes]);
}

const TXID = "634f28bf82407f999c04decf52f795c0a7940805bb5207d3195e47341b3f32df";
const SPK = "204da4d24a10735bfdcc29267bfdfb166b62a521d256f4ee2ed1dc1d612bd24fb9ac";
const PRIV = "03b17217d6cecbf0980b8ce9545df5cad2d95606f23921fcab661c70f60cc7ed";

const txidBuf = Buffer.from(TXID, "hex");
const spkBuf = Buffer.from(SPK, "hex");
const privBuf = Buffer.from(PRIV, "hex");

const inputs = [{ txid: txidBuf, index: 0, sigOpCount: 1, sequence: 0n, amount: 200000000000n, spk: spkBuf }];
const outputs = [{ amount: 199999699000n, spk: spkBuf }];
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

// outputs_hash
let oh_data = Buffer.alloc(0);
for (const o of outputs) {
  oh_data = Buffer.concat([oh_data, u64(o.amount), u16(0)]);
  oh_data = write_var_bytes_inline(oh_data, o.spk);
}
const ohash = tsh(oh_data);

// payload_hash (empty -> zero)
const plh = Buffer.alloc(32, 0);

// hash_script_public_key inline
let spk_inline = u16(0);
spk_inline = write_var_bytes_inline(spk_inline, inp.spk);

// Full sighash
const sh = Buffer.concat([
  u16(0), poh, sqh, soch,
  inp.txid, u32(inp.index),
  spk_inline,
  u64(inp.amount), u64(inp.sequence),
  Buffer.from([inp.sigOpCount]),
  ohash,
  u64(0n), Buffer.alloc(20, 0), u64(0n), plh,
  Buffer.from([1]),
]);

const sighash = tsh(sh);
console.log("JS sighash:", sighash.toString("hex"));

// Sign and submit
const { schnorr } = require("@noble/secp256k1");
const sig = schnorr.sign(sighash, privBuf);
const sigHex = Buffer.from(sig).toString("hex");

// Verify locally
const xonly = spkBuf.slice(1, 33);
const ok = schnorr.verify(sig, sighash, xonly);
console.log("Local verify:", ok);

// Submit: sigScript = 40 + 64sig + 51
const sigScript = "40" + sigHex + "51";
console.log("sigScript:", sigScript.slice(0,10) + "..." + sigScript.slice(-5));
console.log("sigScript len:", sigScript.length);

const rawTx = {
  version:0,
  inputs:[{previousOutpoint:{transactionId:TXID,index:0},signatureScript:sigScript,sequence:"0",sigOpCount:1}],
  outputs:[{amount:"199999699000",scriptPublicKey:{version:0,scriptPublicKey:SPK}}],
  lockTime:"0",subnetworkId:"0000000000000000000000000000000000000000",gas:"0",payload:""
};

const data = JSON.stringify({transaction:rawTx,allowOrphan:true});
const req = https.request({
  hostname:"api-tn12.kaspa.org",path:"/transactions",method:"POST",
  headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}
}, res => {
  let d="";res.on("data",c=>d+=c);
  res.on("end",()=>{
    console.log("Status:",res.statusCode);
    console.log(d);
    try{const j=JSON.parse(d);if(j.transactionId)console.log("\n*** TXID:",j.transactionId,"***");}catch(e){}
  });
});
req.on("error",e=>console.error("ERR:",e.message));
req.write(data);req.end();
