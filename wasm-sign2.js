const kw = require("@dfns/kaspa-wasm");
const https = require("https");

const TXID = "634f28bf82407f999c04decf52f795c0a7940805bb5207d3195e47341b3f32df";
const SPK = "204da4d24a10735bfdcc29267bfdfb166b62a521d256f4ee2ed1dc1d612bd24fb9ac";
const PRIV = "03b17217d6cecbf0980b8ce9545df5cad2d95606f23921fcab661c70f60cc7ed";
const ADDR = "kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj";

(async () => {
  // Try approach: raw hex SPK in both TX outputs and utxoEntry
  try {
    const pk = new kw.PrivateKey(PRIV);
    
    // Try creating tx with raw hex spk
    const tx = new kw.Transaction({
      version: 0,
      inputs: [{
        previousOutpoint: { transactionId: TXID, index: 0 },
        signatureScript: "",
        sequence: 0n,
        sigOpCount: 1
      }],
      outputs: [{
        value: 199999699000n,
        scriptPublicKey: SPK  // raw hex string
      }],
      lockTime: 0n,
      subnetworkId: "0000000000000000000000000000000000000000",
      gas: 0n,
      payload: ""
    });
    console.log("TX created with raw SPK");

    // signTransaction
    const signed = kw.signTransaction(tx, [pk], true);
    console.log("SIGNED!");
    console.log("sigScript:", signed.inputs[0].signatureScript);
    
    // Submit
    const rawTx = {
      version: 0,
      inputs: [{previousOutpoint:{transactionId:TXID,index:0},signatureScript:signed.inputs[0].signatureScript,sequence:"0",sigOpCount:1}],
      outputs: [{amount:"199999699000",scriptPublicKey:{version:0,scriptPublicKey:SPK}}],
      lockTime:"0",subnetworkId:"0000000000000000000000000000000000000000",gas:"0",payload:""
    };
    
    const data = JSON.stringify({transaction:rawTx,allowOrphan:true});
    const req = https.request({hostname:"api-tn12.kaspa.org",path:"/transactions",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}}, res => {
      let d="";res.on("data",c=>d+=c);
      res.on("end",()=>{console.log("Status:",res.statusCode);console.log(d);try{const j=JSON.parse(d);if(j.transactionId)console.log("\n*** TXID:",j.transactionId,"***");}catch(e){}});
    });
    req.on("error",e=>console.error("ERR:",e.message));
    req.write(data);req.end();
    
  } catch(e) {
    console.log("ERROR:", e.message || e);
  }
})();
