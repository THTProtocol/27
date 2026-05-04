#!/usr/bin/env node
'use strict';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_DIR = '/root/htp/rusty-kaspa/rpc/grpc/core/proto';

const packageDefinition = protoLoader.loadSync(
  [path.join(PROTO_DIR, 'rpc.proto'), path.join(PROTO_DIR, 'messages.proto')],
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_DIR]
  }
);

const proto = grpc.loadPackageDefinition(packageDefinition);
const RPC = proto.protowire.RPC;

function submitTransaction(host, txPayload) {
  return new Promise((resolve, reject) => {
    const client = new RPC(host, grpc.credentials.createInsecure());
    const stream = client.MessageStream();
    let resolved = false;

    stream.on('data', (response) => {
      if (resolved) return;
      resolved = true;
      const txRes = response.submitTransactionResponse;
      if (txRes) {
        if (txRes.error) {
          reject(new Error('RPC error: ' + txRes.error.message));
        } else {
          resolve(txRes);
        }
      } else {
        reject(new Error('Unexpected response: ' + JSON.stringify(response)));
      }
      stream.end();
    });

    stream.on('error', (e) => {
      if (!resolved) { resolved = true; reject(e); }
    });

    stream.on('end', () => {
      if (!resolved) { resolved = true; reject(new Error('Stream ended before response')); }
    });

    // Convert our rawTx to protobuf RpcTransaction format
    const rpcTx = {
      version: txPayload.version || 0,
      inputs: (txPayload.inputs || []).map(inp => ({
        previousOutpoint: {
          transactionId: inp.previousOutpoint.transactionId,
          index: inp.previousOutpoint.index
        },
        signatureScript: inp.signatureScript || '',
        sequence: Number(inp.sequence) || 0,
        sigOpCount: inp.sigOpCount || 1
      })),
      outputs: (txPayload.outputs || []).map(out => ({
        amount: Number(out.amount) || 0,
        scriptPublicKey: {
          version: out.scriptPublicKey.version || 0,
          scriptPublicKey: out.scriptPublicKey.scriptPublicKey || ''
        }
      })),
      lockTime: Number(txPayload.lockTime) || 0,
      subnetworkId: txPayload.subnetworkId || '0000000000000000000000000000000000000000',
      gas: Number(txPayload.gas) || 0,
      payload: txPayload.payload || ''
    };

    const request = {
      submitTransactionRequest: {
        transaction: rpcTx,
        allowOrphan: true
      }
    };

    stream.write(request);
  });
}

// CLI mode: read JSON from stdin
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', async () => {
    try {
      const args = JSON.parse(input);
      const host = args.host || '127.0.0.1:16211';
      const result = await submitTransaction(host, args.tx);
      console.log(JSON.stringify(result));
    } catch(e) {
      console.log(JSON.stringify({error: 'submit_error', message: e.message}));
      process.exit(1);
    }
  });
}

module.exports = { submitTransaction };
