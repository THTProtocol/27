const { execSync } = require("child_process");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const TXID = "634f28bf82407f999c04decf52f795c0a7940805bb5207d3195e47341b3f32df";
const SPK = "204da4d24a10735bfdcc29267bfdfb166b62a521d256f4ee2ed1dc1d612bd24fb9ac";
const PRIV = "03b17217d6cecbf0980b8ce9545df5cad2d95606f23921fcab661c70f60cc7ed";

// 1. Sign with Rust
const signReq = JSON.stringify({
  network: "tn12",
  tx: {
    version: 0,
    inputs: [{previousOutpoint:{transactionId:TXID,index:0},signatureScript:"",sequence:"0",sigOpCount:1}],
    outputs: [{value:"199999699000",scriptPublicKey:{version:0,script:SPK}}],
    lockTime:"0",subnetworkId:"0000000000000000000000000000000000000000",gas:"0",payload:""
  },
  utxos: [{txid:TXID,vout:0,amount:"200000000000",scriptPubKey:SPK,isCoinbase:false,blockDaaScore:"3208609"}],
  privkeys: [PRIV]
});

const out = execSync("/root/htp-signer/target/release/htp-signer", {input:signReq,encoding:"utf8",timeout:10000});
const signed = JSON.parse(out).tx;
const sigScript = signed.inputs[0].signatureScript;
console.log("Rust sigScript:", sigScript.slice(0,20) + "..." + sigScript.slice(-10));
console.log("SigScript len:", sigScript.length, "chars");

// 2. Submit via local gRPC
const PROTO_DIR = "/root/htp/rusty-kaspa/rpc/grpc/core/proto";
const pkgDef = protoLoader.loadSync(
  [path.join(PROTO_DIR, "rpc.proto"), path.join(PROTO_DIR, "messages.proto")],
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [PROTO_DIR] }
);
const RPC = grpc.loadPackageDefinition(pkgDef).protowire.RPC;

const client = new RPC("127.0.0.1:16211", grpc.credentials.createInsecure());
const stream = client.MessageStream();

stream.on("data", (response) => {
  console.log("\n--- gRPC RESPONSE ---");
  console.log(JSON.stringify(response, null, 2));
  stream.end();
});

stream.on("error", (e) => console.error("Stream err:", e.message));

stream.on("end", () => console.log("Stream ended"));

// Build protobuf-compatible RpcTransaction
const rpcTx = {
  version: 0,
  inputs: [{
    previousOutpoint: { transactionId: TXID, index: 0 },
    signatureScript: sigScript,
    sequence: 0,
    sigOpCount: 1
  }],
  outputs: [{
    amount: 199999699000,
    scriptPublicKey: { version: 0, scriptPublicKey: SPK }
  }],
  lockTime: 0,
  subnetworkId: "0000000000000000000000000000000000000000",
  gas: 0,
  payload: ""
};

stream.write({
  submitTransactionRequest: {
    transaction: rpcTx,
    allowOrphan: true
  }
});
