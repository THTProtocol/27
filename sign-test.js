const kaspaWasm = require('@dfns/kaspa-wasm');
const fs = require('fs');
const w = JSON.parse(fs.readFileSync('/root/htp/.e2e-wallet.json'));
const pk = new kaspaWasm.PrivateKey(w.privkey.slice(0, 64));
const mySpk = '20' + w.pubkey.slice(2) + 'ac';

// Check if getScriptHashes / setSignatures exist
console.log('getScriptHashes:', typeof kaspaWasm.Transaction.prototype.getScriptHashes);
console.log('setSignatures:', typeof kaspaWasm.Transaction.prototype.setSignatures);

const spk = new kaspaWasm.ScriptPublicKey(0, mySpk);

// Transaction needs UTXOs attached for getScriptHashes — use UtxoEntryReference or plain object
// Try with utxo embedded in input
try {
  const tx = new kaspaWasm.Transaction({
    version: 0,
    inputs: [{
      previousOutpoint: { transactionId: "0d68e1b4fec415d8dca8bf802198605bedd6f7eca5c5deb0bf8abc9951bee423", index: 0 },
      signatureScript: '',
      sequence: 0n,
      sigOpCount: 1,
      utxo: {
        amount: 100000000000n,
        scriptPublicKey: new kaspaWasm.ScriptPublicKey(0, mySpk),
        blockDaaScore: 0n,
        isCoinbase: false
      }
    }],
    outputs: [{ value: 99899970000n, scriptPublicKey: spk }],
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });
  console.log('TX with utxo built OK');

  const hashes = tx.getScriptHashes();
  console.log('hashes:', hashes);

  const sigs = hashes.map(h => kaspaWasm.signScriptHash(h, pk));
  console.log('sigs:', sigs.map(s => Buffer.from(s).toString('hex').slice(0,20) + '...'));

  const signed = tx.setSignatures(sigs);
  const rpc = signed.toRpcTransaction();
  console.log('RPC TX:', JSON.stringify(rpc).slice(0, 200));
} catch(e) {
  console.log('FAIL:', e.message);
  // Inspect what Transaction input fields look like
  console.log('TransactionInput proto:', Object.getOwnPropertyNames(kaspaWasm.TransactionInput?.prototype || {}));
}
