const bip39 = require("bip39");
const nacl = require("tweetnacl");
const blake = require("blakejs");
const hdkey = require("ed25519-hd-key");

function bech32(hrp, buf) {
  const A = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const G = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
  const pm = v => { let c=1; for(let x of v){ let t=c>>25; c=((c&0x1ffffff)<<5)^x; for(let j=0;j<5;j++) if((t>>j)&1)c^=G[j]; } return c; };
  const he = h => { let r=[]; for(let c of h) r.push(c.charCodeAt(0)>>5); r.push(0); for(let c of h) r.push(c.charCodeAt(0)&31); return r; };
  const cv = (d,f,t,p) => { let a=0,b=0,r=[],m=(1<<t)-1; for(let v of d){ a=(a<<f)|v; b+=f; while(b>=t){b-=t; r.push((a>>b)&m);} } if(p&&b>0) r.push((a<<(t-b))&m); return r; };
  const arr = Array.from(buf);
  const cm = cv(arr,8,5,true).concat([0,0,0,0,0,0]);
  const m = pm(he(hrp).concat(cm));
  const cs = []; for(let i=0;i<6;i++) cs.push((m>>(5*(5-i)))&31);
  return A[cm[0]] + cm.slice(1).map(v=>A[v]).join("") + cs.map(v=>A[v]).join("");
}
function addr(pb) { const h=blake.blake2b(pb,null,32); const p=Buffer.concat([Buffer.from([0x00]),Buffer.from(h)]); return "kaspatest:"+bech32("kaspatest",p); }

const TARGET = "kaspatest:qrh603rmy6v0jsq58jrh2yr4ewdk02gctjhxg9feg7uwdl98t04dqmzlrt353";
const mn = "fitness narrow gap scheme fold regret faint neck blanket discover feel machine";
const seed = bip39.mnemonicToSeedSync(mn);

// Try seed directly as privkey (Kaspa CLI approach)
for(let off=0; off<seed.length-32; off+=4) {
  let pk = seed.subarray(off, off+32);
  let kp = nacl.sign.keyPair.fromSeed(pk);
  if(addr(Buffer.from(kp.publicKey)) === TARGET) {
    console.log("FOUND at offset", off, "priv:", pk.toString("hex"));
    process.exit(0);
  }
}

// Try with tweaked derivation — override derivePath
const mk = hdkey.getMasterKeyFromSeed(seed.toString("hex"));
let kp = nacl.sign.keyPair.fromSeed(mk.key);
console.log("master:", addr(Buffer.from(kp.publicKey)));

// CKDPriv with index 0x80000000+44=0x8000002C
for(let idx of [0x8000002C, 0x80001B20, 44, 111111]) {
  try {
    let d = hdkey.CKDPriv({key: mk.key, chainCode: mk.chainCode}, idx);
    let kp2 = nacl.sign.keyPair.fromSeed(d.key);
    let a = addr(Buffer.from(kp2.publicKey));
    if(a === TARGET) { console.log("FOUND CKDPriv", idx, "priv:", d.key.toString("hex")); process.exit(0); }
    console.log("CKDPriv", idx.toString(16), "->", a);
  } catch(e) {}
}
