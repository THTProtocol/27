'use strict';

const OP = Object.freeze({
  FALSE:0x00, TRUE:0x51, IF:0x63, NOTIF:0x64, ELSE:0x67, ENDIF:0x68,
  VERIFY:0x69, RETURN:0x6a, TOALTSTACK:0x6b, FROMALTSTACK:0x6c,
  DUP:0x76, NIP:0x77, OVER:0x78, PICK:0x79, ROLL:0x7a, ROT:0x7b,
  SWAP:0x7c, TUCK:0x7d, DROP:0x75, DEPTH:0x74, SIZE:0x82,
  IFDUP:0x73, TWO_DROP:0x6d, TWO_DUP:0x6e,
  EQUAL:0x87, EQUALVERIFY:0x88,
  ADD:0x93, SUB:0x94, MUL:0x95, DIV:0x96, MOD:0x97,
  NEGATE:0x8f, ABS:0x90, NOT:0x91, NOTEQUAL:0x9e,
  LESSTHAN:0x9f, GREATERTHAN:0xa0,
  LESSTHANOREQUAL:0xa1, GREATERTHANOREQUAL:0xa2,
  NUMEQUAL:0x9c, NUMEQUALVERIFY:0x9d,
  MIN:0xa3, MAX:0xa4, WITHIN:0xa5,
  SHA256:0xa8, BLAKE2B:0xaa,
  CHECKSIG:0xac, CHECKSIGVERIFY:0xad,
  CHECKMULTISIG:0xae, CHECKMULTISIGVERIFY:0xaf,
  PUSHDATA1:0x4c, PUSHDATA2:0x4d,
  TXVERSION:0xb2, TXINPUTCOUNT:0xb3, TXOUTPUTCOUNT:0xb4,
  TXLOCKTIME:0xb5, TXSUBNETID:0xb6, TXGAS:0xb7, TXPAYLOAD:0xb8,
  TXINPUTINDEX:0xb9, OUTPOINTTXID:0xba, OUTPOINTINDEX:0xbb,
  TXINPUTSCRIPTSIG:0xbc, TXINPUTSEQ:0xbd,
  TXINPUTAMOUNT:0xbe, TXINPUTSPK:0xbf,
  TXINPUTBLOCKDAASCORE:0xc0, TXINPUTISCOINBASE:0xc1,
  TXOUTPUTAMOUNT:0xc2, TXOUTPUTSPK:0xc3,
  AUTHOUTPUTCOUNT:0xcb, AUTHOUTPUTIDX:0xcc,
  NUM2BIN:0xcd, BIN2NUM:0xce,
  COVINPUTCOUNT:0xd0, COVINPUTIDX:0xd1,
});

function pushInt(n) {
  if (n === 0) return [OP.FALSE];
  if (n >= 1 && n <= 16) return [0x50 + n];
  if (n === -1) return [0x4f];
  const neg = n < 0;
  let abs = neg ? -n : n;
  const bytes = [];
  while (abs > 0) { bytes.push(abs & 0xff); abs = Math.floor(abs / 256); }
  if (bytes[bytes.length - 1] & 0x80) bytes.push(neg ? 0x80 : 0x00);
  else if (neg) bytes[bytes.length - 1] |= 0x80;
  return [bytes.length, ...bytes];
}

function pushBytes(hex) {
  const buf = typeof hex === 'string' ? Buffer.from(hex, 'hex') : hex;
  const len = buf.length;
  if (len === 0) return [OP.FALSE];
  if (len <= 75) return [len, ...buf];
  if (len <= 0xff) return [OP.PUSHDATA1, len, ...buf];
  return [OP.PUSHDATA2, len & 0xff, (len >> 8) & 0xff, ...buf];
}

function pushPubkey(hex) {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error('Pubkey must be 32 bytes, got ' + buf.length);
  return pushBytes(buf);
}

const MARKET_MODE = Object.freeze({ SPOT: 0x00, MAXIMIZER: 0x01, OPEN: 0x02 });

function buildMarketPoolScript(params) {
  const {
    oraclePubkey, protocolSpkHex, closeDaa, oracleWindowDaa, graceDaa,
    protocolFeeBps = 200, minPositionSompi = 100000000, marketMode = MARKET_MODE.OPEN,
  } = params;
  const resolveDeadline = closeDaa + oracleWindowDaa;
  const timeoutDaa = resolveDeadline + graceDaa;
  const s = [];

  s.push(OP.DUP, ...pushInt(1), OP.NUMEQUAL, OP.IF);
  // PATH 1: ADD POSITION
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(closeDaa), OP.LESSTHAN, OP.VERIFY);
  s.push(OP.TXINPUTINDEX, ...pushInt(0), OP.AUTHOUTPUTIDX, OP.TXOUTPUTSPK,
         OP.TXINPUTINDEX, OP.TXINPUTSPK, OP.EQUALVERIFY);
  s.push(OP.TXINPUTINDEX, ...pushInt(0), OP.AUTHOUTPUTIDX, OP.TXOUTPUTAMOUNT,
         OP.TXINPUTINDEX, OP.TXINPUTAMOUNT, ...pushInt(minPositionSompi), OP.ADD,
         OP.GREATERTHANOREQUAL, OP.VERIFY);
  s.push(OP.TXINPUTINDEX, OP.AUTHOUTPUTCOUNT, ...pushInt(2), OP.GREATERTHANOREQUAL);

  s.push(OP.ELSE, OP.DUP, ...pushInt(2), OP.NUMEQUAL, OP.IF);
  // PATH 2: RESOLVE
  s.push(OP.DROP, OP.SWAP, ...pushPubkey(oraclePubkey), OP.CHECKSIGVERIFY);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, OP.DUP,
         ...pushInt(closeDaa), OP.GREATERTHANOREQUAL, OP.VERIFY,
         ...pushInt(resolveDeadline), OP.LESSTHAN, OP.NIP);

  s.push(OP.ELSE);
  // PATH 3: TIMEOUT
  s.push(OP.DROP);
  s.push(OP.TXINPUTINDEX, OP.TXINPUTBLOCKDAASCORE, ...pushInt(timeoutDaa), OP.GREATERTHANOREQUAL);
  s.push(OP.ENDIF, OP.ENDIF);

  const bytecode = Buffer.from(s);
  return {
    bytecode, hex: bytecode.toString('hex'), size: bytecode.length,
    params: { oraclePubkey, protocolSpkHex, closeDaa, oracleWindowDaa, graceDaa,
              resolveDeadline, timeoutDaa, protocolFeeBps, minPositionSompi, marketMode },
    paths: { addPosition:{id:1}, resolve:{id:2}, timeout:{id:3} },
  };
}

function buildMarketPoolScriptSig(path, args = {}) {
  switch (path) {
    case 'addPosition': return Buffer.from([...pushInt(1)]);
    case 'resolve':
      if (!args.oracleSig || args.outcomeByte === undefined) throw new Error('resolve needs oracleSig + outcomeByte');
      return Buffer.from([...pushBytes(args.oracleSig), ...pushInt(args.outcomeByte), ...pushInt(2)]);
    case 'timeout': return Buffer.from([...pushInt(3)]);
    default: throw new Error('Unknown path: ' + path);
  }
}

module.exports = { OP, pushInt, pushBytes, pushPubkey, MARKET_MODE, buildMarketPoolScript, buildMarketPoolScriptSig };
