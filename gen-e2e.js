#!/usr/bin/env node
'use strict';
const fs = require('fs');
const nacl = require('tweetnacl');
const blake = require('blakejs');
const https = require('https');
const REST = 'https://api-tn12.kaspa.org';

function bech32(hrp, buf) {
  const A = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const G = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3];
  function pm(v) { let c=1; for(let x of v){ let t=c>>25; c=((c&0x1ffffff)<<5)^x; for(let j=0;j<5;j++) if((t>>j)&1)c^=G[j]; } return c; }
  function he(h) { let r=[]; for(let c of h) r.push(c.charCodeAt(0)>>5); r.push(0); for(let c of h) r.push(c.charCodeAt(0)&31); return r; }
  function cv(d,f,t,p) { let a=0,b=0,r=[],m=(1<<t)-1; for(let v of d){ a=(a<<f)|v; b+=f; while(b>=t){b-=t; r.push((a>>b)&m);} } if(p&&b>0) r.push((a<<(t-b))&m); return r; }
  const arr = Array.from(buf);
  const cm = cv(arr,8,5,true).concat([0,0,0,0,0,0]);
  const m = pm(he(hrp).concat(cm));
  const cs = []; for(let i=0;i<6;i++) cs.push((m>>(5*(5-i)))&31);
  return A[cm[0]] + cm.slice(1).map(v=>A[v]).join('') + cs.map(v=>A[v]).join('');
}
function pubToAddr(pubBuf) {
  const h = blake.blake2b(pubBuf, null, 32);
  const p = Buffer.concat([Buffer.from([0x00]), Buffer.from(h)]);
  return 'kaspatest:' + bech32('kaspatest', p);
}
function jget(path) {
  return new Promise(res => {
    https.get(REST + path, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } });
    }).on('error', () => res(null));
  });
}

async function main() {
  // Generate fresh E2E wallet
  const kp = nacl.sign.keyPair();
  const w = {
    privkey: Buffer.from(kp.secretKey).subarray(0, 32).toString('hex'),
    pubkey: Buffer.from(kp.publicKey).toString('hex'),
    address: pubToAddr(Buffer.from(kp.publicKey))
  };
  fs.writeFileSync('/root/htp/.e2e-wallet.json', JSON.stringify(w, null, 2));

  console.log('E2E Wallet Generated');
  console.log('Address:', w.address);
  console.log('Privkey:', w.privkey);

  const bal = await jget('/addresses/' + w.address + '/balance');
  const kas = (parseInt(bal?.balance || '0')) / 100000000;
  console.log('Balance:', kas, 'KAS');

  if (kas < 5) {
    console.log('\nNEEDS FUNDING: Send 5 KAS to:');
    console.log(w.address);
    console.log('\nFaucet: https://faucet.kaspa.org/?address=' + encodeURIComponent(w.address));
    console.log('After funding: cd /root/htp && node scripts/e2e-test.js');
  } else {
    console.log('FUNDED. Run: node scripts/e2e-test.js');
  }
}
main().catch(e => console.error(e.message));
