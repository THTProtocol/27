'use strict';

const { OP, pushInt, pushBytes, pushPubkey } = require('./market-pool');

const RISK_MODE = Object.freeze({ SPOT: 0x00, MAXIMIZER: 0x01 });
const SIDE = Object.freeze({ A: 0x01, B: 0x02 });
const RECEIPT_MAGIC = '4854';

function buildPositionReceiptScript(params) {
  const { userPubkey, oraclePubkey, side, amountSompi, riskMode = RISK_MODE.SPOT, timeoutDaa } = params;
  if (![0x01, 0x02].includes(side)) throw new Error('side must be 0x01 or 0x02');
  if (![0x00, 0x01].includes(riskMode)) throw new Error('riskMode must be 0x00 or 0x01');

  const s = [];
  s.push(...pushBytes(RECEIPT_MAGIC), ...pushInt(side), ...pushInt(riskMode),
         ...pushInt(amountSompi), ...pushPubkey(userPubkey));
  s.push(OP.DROP, OP.DROP, OP.DROP, OP.DROP, OP.DROP);

  s.push(OP.IF);
  s.push(...pushPubkey(oraclePubkey), OP.CHECKSIG);
  s.push(OP.ELSE);
  s.push(...pushPubkey(userPubkey), OP.CHECKSIGVERIFY);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode, hex: bytecode.toString('hex'), size: bytecode.length,
    params: { userPubkey, oraclePubkey, side, amountSompi, riskMode, timeoutDaa },
    paths: { redeem: { sig: '<oracle_sig> OP_TRUE' }, refund: { sig: '<user_sig> OP_FALSE' } },
  };
}

function parseReceiptData(scriptHex) {
  const buf = Buffer.from(scriptHex, 'hex');
  let pos = 0;

  function readPush() {
    const op = buf[pos++];
    let len;
    if (op === 0x00) return Buffer.alloc(0);
    if (op <= 75) len = op;
    else if (op === 0x4c) { len = buf[pos++]; }
    else if (op === 0x4d) { len = buf[pos] | (buf[pos + 1] << 8); pos += 2; }
    else throw new Error('Unexpected opcode 0x' + op.toString(16));
    const data = buf.slice(pos, pos + len);
    pos += len;
    return data;
  }

  function readInt() {
    const op = buf[pos];
    if (op === 0x00) { pos++; return 0; }
    if (op >= 0x51 && op <= 0x60) { pos++; return op - 0x50; }
    if (op === 0x4f) { pos++; return -1; }
    const data = readPush();
    let val = 0;
    const neg = data[data.length - 1] & 0x80;
    const copy = Buffer.from(data);
    if (neg) copy[copy.length - 1] &= 0x7f;
    for (let i = copy.length - 1; i >= 0; i--) val = val * 256 + copy[i];
    return neg ? -val : val;
  }

  const magic = readPush();
  if (magic.toString('hex') !== RECEIPT_MAGIC) throw new Error('Not a High Table receipt');
  return { side: readInt(), riskMode: readInt(), amountSompi: readInt(), userPubkey: readPush().toString('hex') };
}

function buildReceiptScriptSig(path, args = {}) {
  switch (path) {
    case 'redeem':
      if (!args.oracleSig) throw new Error('redeem needs oracleSig');
      return Buffer.from([...pushBytes(args.oracleSig), OP.TRUE]);
    case 'refund':
      if (!args.userSig) throw new Error('refund needs userSig');
      return Buffer.from([...pushBytes(args.userSig), OP.FALSE]);
    default: throw new Error('Unknown path: ' + path);
  }
}

module.exports = { RISK_MODE, SIDE, RECEIPT_MAGIC, buildPositionReceiptScript, parseReceiptData, buildReceiptScriptSig };
