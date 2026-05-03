'use strict';

const { OP } = require('./scripts/market-pool');

const ALLOWED_OPCODES = new Set([
  OP.FALSE, OP.TRUE, OP.IF, OP.NOTIF, OP.ELSE, OP.ENDIF,
  OP.VERIFY, OP.TOALTSTACK, OP.FROMALTSTACK,
  OP.DUP, OP.NIP, OP.OVER, OP.PICK, OP.ROLL, OP.ROT,
  OP.SWAP, OP.TUCK, OP.DROP, OP.DEPTH, OP.SIZE,
  OP.IFDUP, OP.TWO_DROP, OP.TWO_DUP,
  OP.EQUAL, OP.EQUALVERIFY,
  OP.ADD, OP.SUB, OP.MUL, OP.DIV, OP.MOD,
  OP.NEGATE, OP.ABS, OP.NOT, OP.NOTEQUAL,
  OP.LESSTHAN, OP.GREATERTHAN,
  OP.LESSTHANOREQUAL, OP.GREATERTHANOREQUAL,
  OP.NUMEQUAL, OP.NUMEQUALVERIFY,
  OP.MIN, OP.MAX, OP.WITHIN,
  OP.SHA256, OP.BLAKE2B,
  OP.CHECKSIG, OP.CHECKSIGVERIFY,
  OP.CHECKMULTISIG, OP.CHECKMULTISIGVERIFY,
  OP.TXVERSION, OP.TXINPUTCOUNT, OP.TXOUTPUTCOUNT,
  OP.TXLOCKTIME, OP.TXSUBNETID, OP.TXGAS, OP.TXPAYLOAD,
  OP.TXINPUTINDEX, OP.OUTPOINTTXID, OP.OUTPOINTINDEX,
  OP.TXINPUTSCRIPTSIG, OP.TXINPUTSEQ,
  OP.TXINPUTAMOUNT, OP.TXINPUTSPK,
  OP.TXINPUTBLOCKDAASCORE, OP.TXINPUTISCOINBASE,
  OP.TXOUTPUTAMOUNT, OP.TXOUTPUTSPK,
  OP.AUTHOUTPUTCOUNT, OP.AUTHOUTPUTIDX,
  OP.NUM2BIN, OP.BIN2NUM,
  OP.COVINPUTCOUNT, OP.COVINPUTIDX,
]);

const BANNED_OPCODES = new Set([
  OP.RETURN,
]);

const MAX_SCRIPT_SIZE = 10000;
const MAX_STACK_DEPTH = 200;
const MAX_IF_DEPTH = 10;
const MAX_OPS_COUNT = 500;

class ScriptValidator {
  constructor(config = {}) {
    this.maxScriptSize = config.maxScriptSize || MAX_SCRIPT_SIZE;
    this.maxStackDepth = config.maxStackDepth || MAX_STACK_DEPTH;
    this.maxIfDepth = config.maxIfDepth || MAX_IF_DEPTH;
    this.maxOpsCount = config.maxOpsCount || MAX_OPS_COUNT;
    this.requireTimeLock = config.requireTimeLock !== false;
    this.requireOracleKey = config.requireOracleKey !== false;
  }

  validate(scriptHex, options = {}) {
    const errors = [];
    const warnings = [];
    const buf = Buffer.from(scriptHex, 'hex');

    if (buf.length === 0) {
      errors.push('Script is empty');
      return { valid: false, errors, warnings, analysis: { size: 0, opsCount: 0, maxIfDepth: 0, hasTimeLock: false, hasChecksig: false, hasMultisig: false, usedOpcodes: [], usesIntrospection: false, usesCovenantOps: false } };
    }

    if (buf.length > this.maxScriptSize) {
      errors.push('Script exceeds max size: ' + buf.length + ' > ' + this.maxScriptSize);
    }

    let pos = 0;
    let opsCount = 0;
    let ifDepth = 0;
    let maxIfDepthSeen = 0;
    let hasTimeLock = false;
    let hasChecksig = false;
    let hasMultisig = false;
    const usedOpcodes = new Set();

    while (pos < buf.length) {
      const opcode = buf[pos++];

      if (opcode > 0x00 && opcode <= 0x4e) {
        let dataLen = 0;
        if (opcode <= 0x4b) {
          dataLen = opcode;
        } else if (opcode === 0x4c) {
          if (pos >= buf.length) { errors.push('Truncated PUSHDATA1 at ' + (pos - 1)); break; }
          dataLen = buf[pos++];
        } else if (opcode === 0x4d) {
          if (pos + 1 >= buf.length) { errors.push('Truncated PUSHDATA2 at ' + (pos - 1)); break; }
          dataLen = buf[pos] | (buf[pos + 1] << 8);
          pos += 2;
        } else if (opcode === 0x4e) {
          if (pos + 3 >= buf.length) { errors.push('Truncated PUSHDATA4 at ' + (pos - 1)); break; }
          dataLen = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24);
          pos += 4;
        }
        if (pos + dataLen > buf.length) {
          errors.push('Push data overflow at ' + (pos - 1) + ': needs ' + dataLen + ' bytes');
          break;
        }
        pos += dataLen;
        continue;
      }

      if (opcode >= 0x50 && opcode <= 0x60) continue;
      if (opcode === 0x4f) continue;

      opsCount++;
      usedOpcodes.add(opcode);

      if (BANNED_OPCODES.has(opcode)) {
        errors.push('Banned opcode 0x' + opcode.toString(16) + ' at position ' + (pos - 1));
      }

      if (!ALLOWED_OPCODES.has(opcode) && opcode > 0x60) {
        warnings.push('Unknown opcode 0x' + opcode.toString(16) + ' at position ' + (pos - 1));
      }

      if (opcode === OP.IF || opcode === OP.NOTIF) {
        ifDepth++;
        maxIfDepthSeen = Math.max(maxIfDepthSeen, ifDepth);
        if (ifDepth > this.maxIfDepth) {
          errors.push('IF depth exceeds limit: ' + ifDepth + ' > ' + this.maxIfDepth);
        }
      }
      if (opcode === OP.ENDIF) {
        if (ifDepth <= 0) errors.push('ENDIF without matching IF at ' + (pos - 1));
        else ifDepth--;
      }
      if (opcode === OP.ELSE && ifDepth <= 0) {
        errors.push('ELSE without matching IF at ' + (pos - 1));
      }

      if (opcode === OP.TXINPUTBLOCKDAASCORE || (opcode >= 0xb0 && opcode <= 0xb2) || opcode === 0xb8) hasTimeLock = true;
      if (opcode === OP.CHECKSIG || opcode === OP.CHECKSIGVERIFY) hasChecksig = true;
      if (opcode === OP.CHECKMULTISIG || opcode === OP.CHECKMULTISIGVERIFY) hasMultisig = true;
    }

    if (ifDepth !== 0) errors.push('Unmatched IF blocks: ' + ifDepth + ' still open');
    if (opsCount > this.maxOpsCount) errors.push('Op count exceeds limit: ' + opsCount + ' > ' + this.maxOpsCount);

    if (this.requireTimeLock && !hasTimeLock) {
      warnings.push('No time-lock (TXINPUTBLOCKDAASCORE) found. Users may not have timeout protection.');
    }
    if (this.requireOracleKey && !hasChecksig && !hasMultisig) {
      warnings.push('No signature verification found. Script may be unprotected.');
    }

    const analysis = {
      size: buf.length,
      opsCount,
      maxIfDepth: maxIfDepthSeen,
      hasTimeLock,
      hasChecksig,
      hasMultisig,
      usedOpcodes: Array.from(usedOpcodes).map(o => '0x' + o.toString(16)),
      usesIntrospection: usedOpcodes.has(OP.TXINPUTAMOUNT) || usedOpcodes.has(OP.TXOUTPUTAMOUNT) || [...usedOpcodes].some(op => op >= 0xb3 && op <= 0xbf) ||
                          usedOpcodes.has(OP.TXINPUTSPK) || usedOpcodes.has(OP.TXOUTPUTSPK),
      usesCovenantOps: usedOpcodes.has(OP.AUTHOUTPUTCOUNT) || usedOpcodes.has(OP.AUTHOUTPUTIDX),
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      analysis,
    };
  }

  validateMarketScript(scriptHex, expectedOraclePubkey) {
    const result = this.validate(scriptHex);

    if (!result.analysis.hasTimeLock) {
      result.errors.push('Market scripts must include time-lock for timeout protection');
      result.valid = false;
    }
    if (!result.analysis.hasChecksig && !result.analysis.hasMultisig) {
      result.errors.push('Market scripts must include signature verification');
      result.valid = false;
    }
    if (!result.analysis.usesIntrospection) {
      result.warnings.push('Market script does not use introspection — pool growth cannot be enforced on-chain');
    }

    if (expectedOraclePubkey) {
      const scriptBuf = Buffer.from(scriptHex, 'hex');
      const pubkeyBuf = Buffer.from(expectedOraclePubkey, 'hex');
      if (!scriptBuf.includes(pubkeyBuf)) {
        result.errors.push('Expected oracle pubkey not found in script');
        result.valid = false;
      }
    }

    return result;
  }

  validateCustomScript(scriptHex) {
    const result = this.validate(scriptHex, { requireTimeLock: true });

    if (result.analysis && result.analysis.size > 5000) {
      result.warnings.push('Large custom script (' + result.analysis.size + ' bytes). Higher TX fees expected.');
    }

    result.isCustom = true;
    result.badge = result.valid ? 'CUSTOM_VERIFIED' : 'CUSTOM_UNVERIFIED';
    return result;
  }

  disassemble(scriptHex) {
    const buf = Buffer.from(scriptHex, 'hex');
    const ops = [];
    let pos = 0;
    const opNames = {};
    for (const [name, code] of Object.entries(OP)) {
      opNames[code] = 'OP_' + name;
    }

    while (pos < buf.length) {
      const opcode = buf[pos];
      const offset = pos;
      pos++;

      if (opcode === 0x00) {
        ops.push({ offset, op: 'OP_FALSE', hex: '00' });
        continue;
      }
      if (opcode >= 0x01 && opcode <= 0x4b) {
        const data = buf.slice(pos, pos + opcode);
        pos += opcode;
        ops.push({ offset, op: 'PUSH_' + opcode, hex: data.toString('hex') });
        continue;
      }
      if (opcode === 0x4c) {
        const len = buf[pos++];
        const data = buf.slice(pos, pos + len);
        pos += len;
        ops.push({ offset, op: 'PUSHDATA1', len, hex: data.toString('hex') });
        continue;
      }
      if (opcode >= 0x51 && opcode <= 0x60) {
        ops.push({ offset, op: 'OP_' + (opcode - 0x50), hex: opcode.toString(16) });
        continue;
      }

      const name = opNames[opcode] || 'UNKNOWN_0x' + opcode.toString(16);
      ops.push({ offset, op: name, hex: opcode.toString(16) });
    }

    return ops;
  }
}

module.exports = ScriptValidator;
