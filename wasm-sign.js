const kw = require("@dfns/kaspa-wasm");
const https = require("https");

function submitTx(label, tx) {
  return new Promise(resolve => {
    const d = JSON.stringify({transaction:tx,allowOrphan:true});
    const r = https.request({hostname:"api-tn12.kaspa.org",path:"/transactions",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)}}, res => {
      let b="";res.on("data",c=>b+=c);
      res.on("end",()=>{console.log(label,res.statusCode);console.log(b);try{const j=JSON.parse(b);if(j.transactionId)console.log("\n*** TXID:",j.transactionId,"***");}catch(e){}resolve();});
    });
    r.on("error",e=>{console.log(label,"ERR:",e.message);resolve();});
    r.write(d);r.end();
  });
}

(async()=>{
  const TXID="634f28bf82407f999c04decf52f795c0a7940805bb5207d3195e47341b3f32df";
  const SPK="204da4d24a10735bfdcc29267bfdfb166b62a521d256f4ee2ed1dc1d612bd24fb9ac";
  const PRIV="03b17217d6cecbf0980b8ce9545df5cad2d95606f23921fcab661c70f60cc7ed";
  const ADDR="kaspatest:qpx6f5j2zpe4hlwv9yn8hl0mze4k9ffp6ft0fm3w68wp6cft6f8mjdtt0qzyj";
  
  let pk;
  try {
    pk = new kw.PrivateKey(PRIV);
    console.log("PrivateKey OK");
  } catch(e) { console.log("PK error:",e.message?e.message.slice(0,100):e); return; }
  
  // Try creating a transaction that includes UTXO data
  let tx;
  try {
    tx = new kw.Transaction({
      version: 0,
      inputs: [{
        previousOutpoint: {transactionId: TXID, index: 0},
        signatureScript: "",
        sequence: 0n,
        sigOpCount: 1,
        utxo: {
          address: ADDR,
          outpoint: { transactionId: TXID, index: 0 },
          utxoEntry: {
            amount: 200000000000n,
            scriptPublicKey: { version: 0, scriptPublicKey: SPK },
            blockDaaScore: 3208609n,
            isCoinbase: false
          }
        }
      }],
      outputs: [{
        value: 199999699000n,
        scriptPublicKey: {version: 0, scriptPublicKey: SPK}
      }],
      lockTime: 0n,
      subnetworkId: "0000000000000000000000000000000000000000",
      gas: 0n,
      payload: ""
    });
    console.log("Transaction OK");
  } catch(e) { console.log("TX error:",e.message?e.message.slice(0,100):e); return; }
  
  let signed;
  try {
    signed = kw.signTransaction(tx, [pk], true);
    console.log("SIGNED OK");
    console.log("sigScript:",signed.inputs[0].signatureScript);
    console.log("sigScript len:",signed.inputs[0].signatureScript.length);
    
    const rawTx = {
      version: 0,
      inputs: [{previousOutpoint:{transactionId:TXID,index:0},signatureScript:signed.inputs[0].signatureScript,sequence:"0",sigOpCount:1}],
      outputs: [{amount:"199999699000",scriptPublicKey:{version:0,scriptPublicKey:SPK}}],
      lockTime:"0",subnetworkId:"0000000000000000000000000000000000000000",gas:"0",payload:""
    };
    await submitTx("WASM signed:", rawTx);
  } catch(e) {
    console.log("signTransaction error:", e.message || e);
    if (e.stack) console.log(e.stack.slice(0,400));
  }
})();
