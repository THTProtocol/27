const fs = require("fs");
let src = fs.readFileSync("/root/htp/scripts/e2e-test.js", "utf8");

// Add kaspa require at top
if (src.indexOf("@dfns/kaspa-wasm") === -1) {
  src = src.replace(
    "const nacl = require",
    "const kaspaWasm = require(\"@dfns/kaspa-wasm\");\nconst nacl = require"
  );
}

// Replace sign section
const signSection = `// -- Sign --
function makeSighash(txIdHex, outIdx) {
  const blake = require("blakejs");
  const txId = Buffer.from(txIdHex, "hex");
  const buf = Buffer.alloc(37);
  txId.copy(buf, 0); buf.writeUInt32LE(outIdx, 32); buf.writeUInt8(1, 36);
  return Buffer.from(blake.blake2b(buf, null, 32));
}
function signInput(txIdHex, outIdx, privkeyHex) {
  const hash = makeSighash(txIdHex, outIdx);
  const pk = new kaspaWasm.PrivateKey(privkeyHex.slice(0, 64));
  return Buffer.from(pk.signSchnorr(hash));
}
function sigScript(sig, pubkey) {
  return Buffer.concat([Buffer.from([0x41]), sig, Buffer.from([0x21]), pubkey]).toString("hex");
}`;

src = src.replace(/\/\/ ── Sign ──[\s\S]*?^}(?=\s*\n\/\/ ──)/m, signSection);
src = src.replace(/signInput\([^,]+,\s*[^,]+,\s*Buffer\.from\(w\.privkey,\s*["'"]hex["'"]\)[^)]*\)/g,
  function(m) { return m.replace(/,\s*Buffer\.from\(w\.privkey.*?\)/, ", w.privkey"); });

fs.writeFileSync("/root/htp/scripts/e2e-test.js", src);
console.log("Patched OK");
