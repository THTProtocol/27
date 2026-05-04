'use strict';

const { execSync } = require('child_process');
const SIGNER_BIN = '/root/htp-signer/target/release/htp-signer';

/**
 * Canonical Kaspa transaction signer via Rust CLI.
 * Uses keyed Blake2b("TransactionSigningHash"), u64 LE lengths,
 * and sigScript = OP_DATA_65 + 64-byte Schnorr sig + SIGHASH_ALL.
 *
 * @param {object} txObj   - Unsigned TX: {version, inputs, outputs[{value,scriptSPK:{version,script}}], lockTime, subnetworkId, gas, payload}
 * @param {string} privkey - Hex private key (64 chars)
 * @param {Array}  utxos   - [{txid, vout, amount, scriptPubKey, isCoinbase, blockDaaScore}]
 * @returns {object} signed TX ready for REST remapping
 */
function signTx(txObj, privkey, utxos) {
  const privHex = String(privkey).slice(0, 64);

  const rustUtxos = (utxos || []).map(u => ({
    txid:          u.outpoint?.transactionId || u.txid || u.transactionId || '',
    vout:          u.outpoint?.index ?? u.vout ?? u.index ?? 0,
    amount:        String(u.utxoEntry?.amount ?? u.amount ?? 0),
    scriptPubKey:  u.utxoEntry?.scriptPublicKey?.scriptPublicKey
                || u.scriptPublicKey?.scriptPublicKey
                || u.scriptPublicKey?.script
                || u.script || '',
    isCoinbase:    u.utxoEntry?.isCoinbase   || u.isCoinbase   || false,
    blockDaaScore: String(u.utxoEntry?.blockDaaScore ?? u.blockDaaScore ?? 0)
  }));

  const input = JSON.stringify({
    network: 'tn12',
    tx: JSON.parse(JSON.stringify(txObj, (k, v) =>
          typeof v === 'bigint' ? String(v) : v)),
    utxos:    rustUtxos,
    privkeys: [privHex]
  });

  let out;
  try {
    out = execSync(SIGNER_BIN, {
      input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024
    });
  } catch (e) {
    if (e.stdout) out = e.stdout;
    else throw new Error('htp-signer exec failed: ' + e.message);
  }

  let r;
  try { r = JSON.parse(out); }
  catch (e) { throw new Error('htp-signer invalid JSON: ' + out.slice(0, 200)); }

  if (r.error) throw new Error('htp-signer [' + r.error + ']: ' + r.message);
  return r.tx;
}

/**
 * Remap Rust signer output to Kaspa REST API format.
 * Rust: outputs[{value, scriptPublicKey:{version,script}}]
 * REST: outputs[{amount, scriptPublicKey:{version,scriptPublicKey}}]
 */
function toRestTx(signedTx) {
  return {
    version: 0,
    inputs: signedTx.inputs.map(inp => ({
      previousOutpoint: {
        transactionId: inp.previousOutpoint.transactionId,
        index: inp.previousOutpoint.index
      },
      signatureScript: inp.signatureScript,
      sequence: inp.sequence || '0',
      sigOpCount: inp.sigOpCount || 1
    })),
    outputs: signedTx.outputs.map(o => ({
      amount: o.value,
      scriptPublicKey: {
        version: o.scriptPublicKey.version || 0,
        scriptPublicKey: o.scriptPublicKey.script
      }
    })),
    lockTime: '0',
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: '0',
    payload: ''
  };
}

module.exports = { signTx, toRestTx, SIGNER_BIN };
