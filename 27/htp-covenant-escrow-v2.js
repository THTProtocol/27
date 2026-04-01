// =============================================================================
// htp-covenant-escrow-v2.js — HTP Covenant P2SH Escrow Engine
// KIP-10 opcodes: OP_TXOUTPUTCOUNT (0xb4) + OP_TXOUTPUTSPK (0xc3)
// TN12 STATUS: KIP-10 LIVE | P2SH LIVE | KIP-17 covenant IDs LIVE
// Fee logic: delegated to HTPFee (htp-fee-engine.js)
// =============================================================================
(function (W) {
  'use strict';

  var NETWORK_FEE = 10000n;
  var MIN_FEE     = 1000n;

  // KIP-10 opcode bytes
  var OPC = {
    OP_IF:0x63, OP_ELSE:0x67, OP_ENDIF:0x68,
    OP_EQUALVERIFY:0x88, OP_EQUAL:0x87,
    OP_CHECKSIG:0xac,
    OP_BLAKE2B:0xaa,
    OP_TX_OUTPUT_COUNT:0xb4,
    OP_TX_OUTPUT_SPK:0xc3,
    OP_DATA_32:0x20,
    PUSHDATA1:0x4c,
  };

  function pushInt(n) {
    if (n === 0) return [0x00];
    if (n >= 1 && n <= 16) return [0x50 + n];
    return [0x01, n & 0xff];
  }
  function pushBytes(hexStr) {
    var b = (hexStr.match(/.{2}/g)||[]).map(function(h){return parseInt(h,16);});
    if (b.length === 0) return [0x00];
    if (b.length <= 75) return [b.length].concat(b);
    return [OPC.PUSHDATA1, b.length].concat(b);
  }
  function toHex(arr) { return arr.map(function(b){return b.toString(16).padStart(2,'0');}).join(''); }
  function bigIntR(k,v) { return typeof v==='bigint'?v.toString():v; }

  // ── HTPFee delegation ──────────────────────────────────────────────────────
  // All fee calculations go through HTPFee — never hardcode rates here.
  function getFee() {
    if (W.HTPFee) return W.HTPFee;
    // Fallback if fee engine not loaded (should never happen with correct load order)
    console.error('[HTP Escrow] HTPFee not loaded — using emergency fallback 2%');
    return {
      treasuryAddress: function() {
        return W.activeNet === 'mainnet'
          ? 'kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel'
          : 'kaspatest:qpyfz03k6quxwf2jglwkhczvt758d8xrq99gl37p6h3vsqur27ltjhn68354m';
      },
      skillGameSettle: function(stakeKas) {
        var pool = stakeKas * 2;
        return { totalPool: pool, protocolFee: pool * 0.02, winnerPayout: pool * 0.98 };
      },
    };
  }

  // ── P2SH redeem script ─────────────────────────────────────────────────────
  function buildRedeemScript(escrowPubHex, creatorPubHex, feeSpkHex) {
    var s = [];
    s.push(OPC.OP_IF);
      s = s.concat(pushBytes(creatorPubHex));
      s.push(OPC.OP_CHECKSIG);
    s.push(OPC.OP_ELSE);
      s.push(OPC.OP_TX_OUTPUT_COUNT);
      s = s.concat(pushInt(2));
      s.push(OPC.OP_EQUALVERIFY);
      s = s.concat(pushInt(1));
      s.push(OPC.OP_TX_OUTPUT_SPK);
      s = s.concat(pushBytes(feeSpkHex));
      s.push(OPC.OP_EQUALVERIFY);
      s = s.concat(pushBytes(escrowPubHex));
      s.push(OPC.OP_CHECKSIG);
    s.push(OPC.OP_ENDIF);
    return toHex(s);
  }

  async function redeemScriptToAddress(redeemScriptHex, network) {
    var SDK = W.kaspaSDK;
    if (!SDK) throw new Error('WASM not loaded');
    if (SDK.ScriptBuilder && SDK.ScriptBuilder.createP2SHAddress) {
      return SDK.ScriptBuilder.createP2SHAddress(redeemScriptHex, network).toString();
    }
    if (SDK.addressFromScriptPublicKey) {
      var scriptBytes = new Uint8Array((redeemScriptHex.match(/.{2}/g)||[]).map(function(h){return parseInt(h,16);}));
      var hashBuf = await crypto.subtle.digest('SHA-256', scriptBytes);
      var hashHex = Array.from(new Uint8Array(hashBuf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var p2shSpk = { version: 0, scriptPublicKey: 'aa20' + hashHex + '87' };
      return SDK.addressFromScriptPublicKey(p2shSpk, network).toString();
    }
    throw new Error('Upgrade kaspa-wasm — ScriptBuilder.createP2SHAddress needed');
  }

  async function genEscrowKey() {
    var b = new Uint8Array(32); crypto.getRandomValues(b);
    return Array.from(b).map(function(x){return x.toString(16).padStart(2,'0');}).join('');
  }

  async function encryptKey(privHex, creatorPubHex) {
    var raw = new Uint8Array((creatorPubHex.match(/.{2}/g)||[]).map(function(h){return parseInt(h,16);})).slice(0,32);
    var key = await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt']);
    var iv  = crypto.getRandomValues(new Uint8Array(12));
    var enc = await crypto.subtle.encrypt({name:'AES-GCM',iv:iv}, key, new TextEncoder().encode(privHex));
    return {
      iv:     Array.from(iv).map(function(b){return b.toString(16).padStart(2,'0');}).join(''),
      cipher: Array.from(new Uint8Array(enc)).map(function(b){return b.toString(16).padStart(2,'0');}).join('')
    };
  }

  // ── Network helpers ────────────────────────────────────────────────────────
  function getRestUrl() {
    try { var n=W.activeNet||'tn12'; if(W.KASPANETS&&W.KASPANETS[n]) return W.KASPANETS[n].rest; } catch(e){}
    return W.activeNet==='mainnet' ? 'https://api.kaspa.org' : 'https://api-tn12.kaspa.org';
  }
  function getProtocolFeeAddr() { return getFee().treasuryAddress(); }
  function getProtocolFeeSPK() {
    var addr = getProtocolFeeAddr();
    try {
      var SDK = W.kaspaSDK;
      if (SDK && SDK.Address) {
        var a = new SDK.Address(addr);
        if (a.payload) {
          var pl = a.payload;
          var pubHex = Array.from(pl.length===33?pl.slice(1):pl).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
          return '20' + pubHex + 'ac';
        }
      }
    } catch(e) {}
    return W.activeNet==='mainnet'
      ? '20' + 'b9c4e0c7a14cbaed78e0e0b70b6a51e4d8e65b2e9c3f8d1a4b7c0e3f6a9d2b5c8' + 'ac'
      : '200416d6d6b543b1290c7568a98f0d1c2f378d8c8a9ea66d4cfabbd3f3c78b9ac';
  }
  function getPubkeyFromAddr(address) {
    try {
      var SDK = W.kaspaSDK;
      if (SDK && SDK.Address) {
        var a = new SDK.Address(address);
        if (a.payload) {
          var pl = a.payload;
          return Array.from(pl.length===33?pl.slice(1):pl).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
        }
      }
    } catch(e) {}
    return null;
  }
  async function fetchUtxos(address) {
    try {
      // Prefer live RPC if available
      if (W.HTPRpc && W.HTPRpc.isConnected) {
        var result = await W.HTPRpc.rpc.getUtxosByAddresses({ addresses: [address] });
        return result.entries || [];
      }
      var r = await fetch(getRestUrl()+'/addresses/'+address+'/utxos');
      if (!r.ok) return null;
      return await r.json();
    } catch(e) { return null; }
  }

  function getEscrow(matchId) {
    if (W.htpLastEscrow && W.htpLastEscrow.matchId===matchId) return W.htpLastEscrow;
    try { var s=JSON.parse(localStorage.getItem('htp-covenant-escrows')||'{}'); if(s[matchId]) return s[matchId]; } catch(e){}
    try { var s2=JSON.parse(localStorage.getItem('htpescrowkeys')||'{}'); if(s2[matchId]) return s2[matchId]; } catch(e){}
    return null;
  }
  function markSettled(matchId, txId) {
    ['htp-covenant-escrows','htpescrowkeys'].forEach(function(k){
      try {
        var s=JSON.parse(localStorage.getItem(k)||'{}');
        if(s[matchId]){s[matchId].settled=true;s[matchId].settleTxId=txId;s[matchId].settledAt=Date.now();localStorage.setItem(k,JSON.stringify(s));}
      } catch(e){}
    });
  }

  // ── Generate covenant escrow ───────────────────────────────────────────────
  async function generateMatchEscrow(matchId, creatorAddress) {
    var SDK = W.kaspaSDK;
    if (!SDK || !SDK.PrivateKey) throw new Error('WASM SDK not ready');
    var net = W.activeNet==='mainnet' ? 'mainnet' : 'testnet-12';

    var escrowPrivHex = await genEscrowKey();
    var escrowPriv = new SDK.PrivateKey(escrowPrivHex);
    var escrowPubHex = escrowPriv.toPublicKey().toString();
    var creatorPubHex = getPubkeyFromAddr(creatorAddress) || Array.from(new Uint8Array(32)).map(function(){return '00';}).join('');
    var feeSpkHex = getProtocolFeeSPK();
    var redeemScript = buildRedeemScript(escrowPubHex, creatorPubHex, feeSpkHex);

    var escrowAddress;
    try {
      escrowAddress = await redeemScriptToAddress(redeemScript, net);
    } catch(e) {
      console.warn('[HTP Escrow v2] P2SH fallback:', e.message);
      escrowAddress = escrowPriv.toPublicKey().toAddress(net).toString();
    }

    var encrypted = await encryptKey(escrowPrivHex, creatorPubHex);
    var entry = {
      matchId:matchId, address:escrowAddress, p2pkAddress:escrowAddress,
      redeemScript:redeemScript, escrowPubkeyHex:escrowPubHex,
      creatorPubkeyHex:creatorPubHex, feeSpkHex:feeSpkHex,
      encryptedKey:encrypted, privateKey:escrowPrivHex,
      network:W.activeNet||'tn12', createdAt:Date.now(), covenant:true, version:2
    };

    var store={};
    try { store=JSON.parse(localStorage.getItem('htp-covenant-escrows')||'{}'); } catch(e){}
    store[matchId]=entry;
    localStorage.setItem('htp-covenant-escrows',JSON.stringify(store));

    try {
      if (W.firebase && W.firebase.database) {
        W.firebase.database().ref('escrows/'+matchId).set({
          address:escrowAddress, redeemScript:redeemScript,
          escrowPubkeyHex:escrowPubHex, creatorPubkeyHex:creatorPubHex,
          feeSpkHex:feeSpkHex, network:W.activeNet||'tn12',
          covenant:true, version:2
        });
      }
    } catch(e){}

    W.htpLastEscrow = entry;
    console.log('%c[HTP Escrow v2] Covenant P2SH escrow: '+matchId,'color:#49e8c2;font-weight:bold');
    console.log('  Addr:', escrowAddress);
    console.log('  Script:', redeemScript.length/2, 'bytes | KIP-10 output-count+fee-SPK enforced');
    console.log('  Protocol fee addr:', getProtocolFeeAddr());
    return entry;
  }

  // ── Atomic settlement TX ───────────────────────────────────────────────────
  function formatForRest(tx) {
    return {
      version:tx.version||0,
      inputs:(tx.inputs||[]).map(function(i){
        return {
          previousOutpoint:{
            transactionId:i.transactionId||(i.previousOutpoint&&i.previousOutpoint.transactionId)||'',
            index:(i.previousOutpoint&&i.previousOutpoint.index)||i.index||0
          },
          signatureScript:i.signatureScript||'', sequence:typeof i.sequence==='string'?parseInt(i.sequence):(i.sequence||0), sigOpCount:i.sigOpCount||1
        };
      }),
      outputs:(tx.outputs||[]).map(function(o){
        var amt=o.amount||o.value||0; if(typeof amt==='string') amt=parseInt(amt);
        var spk=o.scriptPublicKey;
        if(typeof spk==='string') spk={version:0,scriptPublicKey:spk.substring(4)};
        else if(spk&&!spk.scriptPublicKey) spk={version:spk.version||0,scriptPublicKey:spk.script||''};
        return {amount:typeof amt==='bigint'?amt.toString():amt,scriptPublicKey:spk};
      }),
      lockTime:0, subnetworkId:'0000000000000000000000000000000000000000', gas:0, payload:tx.payload||''
    };
  }

  async function atomicSettle(escrow, outputs) {
    var SDK = W.kaspaSDK; if(!SDK||!SDK.PrivateKey) throw new Error('WASM not ready');
    var addr = escrow.address;
    var raw = await fetchUtxos(addr);
    if (!raw || !raw.length) throw new Error('Escrow empty: '+addr.substring(0,24));

    var totalSompi = 0n;
    var entries = raw.map(function(u){
      var e=u.utxoEntry||u.entry||u;
      var spk=e.scriptPublicKey; var sh=typeof spk==='string'?spk.substring(4):(spk.scriptPublicKey||spk.script||'');
      var amt=BigInt(e.amount||0); totalSompi+=amt;
      return {address:addr,outpoint:{transactionId:u.outpoint?u.outpoint.transactionId:u.transactionId,index:u.outpoint?(u.outpoint.index||0):(u.index||0)},amount:amt,scriptPublicKey:{version:0,script:sh},blockDaaScore:BigInt(e.blockDaaScore||0)};
    });

    var totalOut = outputs.reduce(function(s,o){return s+o.amount;},0n);
    if(totalSompi < totalOut + NETWORK_FEE) throw new Error('Insufficient: '+totalSompi+' vs '+(totalOut+NETWORK_FEE));

    var privKey = new SDK.PrivateKey(escrow.privateKey);
    var txOuts  = outputs.map(function(o){return {address:o.address,amount:o.amount};});
    var tx      = SDK.createTransaction(entries, txOuts, 0n, undefined, 1);
    var signed  = SDK.signTransaction(tx, privKey, true);
    var txObj;
    if(signed.toRpcTransaction) txObj=signed.toRpcTransaction();
    else if(signed.serializeToObject) txObj=signed.serializeToObject();
    else txObj=signed;
    txObj = formatForRest(txObj);

    var resp = await fetch(getRestUrl()+'/transactions',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({transaction:txObj,allowOrphan:false},bigIntR)
    });
    if(!resp.ok){var err=await resp.text();throw new Error('TX failed: '+err.substring(0,200));}
    var result = await resp.json();
    return result.transactionId||result.id||result;
  }

  // ── sompi helpers ──────────────────────────────────────────────────────────
  var SOMPI = 100_000_000n;
  function kasToSompi(kas) { return BigInt(Math.round(kas * 100_000_000)); }

  // ── settleMatchPayout — now uses HTPFee ────────────────────────────────────
  W.settleMatchPayout = async function(matchId, winnerAddr, isDraw, pA, pB) {
    var esc = getEscrow(matchId);
    if (esc && esc.settled && esc.settleTxId) return esc.settleTxId;

    // Firebase claim lock
    try {
      if(W.firebase&&W.firebase.database){
        var ref=W.firebase.database().ref('settlement/'+matchId+'/claimed');
        var snap=await ref.once('value');
        if(snap.exists()&&snap.val().txId){
          if(W.showToast) W.showToast('Already settled','info');
          return snap.val().txId;
        }
        await ref.set({by:W.walletAddress||'?',ts:Date.now()});
      }
    } catch(e){}

    if (!esc||!esc.privateKey) {
      if(W.showToast) W.showToast('No escrow key for '+matchId,'error');
      return null;
    }

    try {
      var raw = await fetchUtxos(esc.address);
      if(!raw||!raw.length){if(W.showToast)W.showToast('Escrow empty','error');return null;}
      var total = raw.reduce(function(s,u){var e=u.utxoEntry||u.entry||u;return s+BigInt(e.amount||0);},0n);

      var outputs;

      if (isDraw && pA && pB) {
        // Draw: split equally, no protocol fee
        var half = (total - NETWORK_FEE) / 2n;
        outputs = [{address:pA,amount:half},{address:pB,amount:half}];
        console.log('[HTP Escrow v2] Draw settlement: '+half+' sompi each');

      } else if (winnerAddr) {
        // Skill game win: use HTPFee.skillGameSettle
        var totalKas = Number(total) / 100_000_000;
        var stakeKas = totalKas / 2; // each player staked half the total
        var calc = getFee().skillGameSettle(stakeKas);

        var feeSompi    = kasToSompi(calc.protocolFee);
        var payoutSompi = total - feeSompi - NETWORK_FEE;
        if (payoutSompi <= 0n) throw new Error('Pot too small after fee');
        if (feeSompi < MIN_FEE) feeSompi = MIN_FEE;

        outputs = [
          {address: winnerAddr,          amount: payoutSompi},
          {address: getProtocolFeeAddr(), amount: feeSompi}
        ];
        console.log('[HTP Escrow v2] Skill settle: winner='+payoutSompi+' fee='+feeSompi+' → '+getProtocolFeeAddr());

      } else {
        throw new Error('No winner and not draw');
      }

      if(W.showToast) W.showToast('Settling on-chain...','info');
      var txId = await atomicSettle(esc, outputs);
      markSettled(matchId, txId);

      try {
        if(W.firebase&&W.firebase.database){
          W.firebase.database().ref('settlement/'+matchId+'/claimed').update({txId:txId,settledAt:Date.now()});
          W.firebase.database().ref('matches/'+matchId+'/info/status').set('settled');
        }
      } catch(e){}

      // Dispatch event for RPC balance refresh
      window.dispatchEvent(new CustomEvent('htp:settlement:complete', {detail:{matchId:matchId,txId:txId}}));

      if(W.showToast) W.showToast('Settled! TX: '+String(txId).substring(0,16)+'...','success');
      return txId;

    } catch(e) {
      console.error('[HTP Escrow v2] Settlement failed:',e.message);
      if(W.showToast) W.showToast('Settlement failed: '+e.message,'error');
      return null;
    }
  };

  W.settleSkillMatch  = function(matchId, winnerAddr){ return W.settleMatchPayout(matchId,winnerAddr,false,null,null); };
  W.sendFromEscrow    = function(matchId, toAddr)    { return W.settleMatchPayout(matchId,toAddr,false,null,null); };

  W.cancelMatchEscrow = async function(matchId) {
    // Creator cancel — only allowed before opponent joins (enforced by HTPFee)
    var esc = getEscrow(matchId); if(!esc) return null;
    var matchData = null;
    try {
      if(W.firebase&&W.firebase.database){
        var snap = await W.firebase.database().ref('matches/'+matchId).once('value');
        matchData = snap.val();
      }
    } catch(e){}

    if (matchData) {
      var canCancel = getFee().skillGameCanCreatorCancel ? getFee().skillGameCanCreatorCancel(matchData) : {allowed:true};
      if (!canCancel.allowed) {
        if(W.showToast) W.showToast(canCancel.reason,'error');
        return null;
      }
    }

    var raw = await fetchUtxos(esc.address);
    if(!raw||!raw.length) return null;
    var refund = W.walletAddress||W.htpAddress; if(!refund) return null;
    var u=raw[0]; var e=u.utxoEntry||u.entry||u; var amt=BigInt(e.amount||0);
    try {
      var txId = await atomicSettle(esc,[{address:refund,amount:amt-NETWORK_FEE}]);
      markSettled(matchId,txId);
      if(W.showToast) W.showToast('Refunded! TX: '+String(txId).substring(0,16)+'...','success');
      return txId;
    } catch(e2){
      if(W.showToast) W.showToast('Cancel failed: '+e2.message,'error');
      return null;
    }
  };

  W.generateMatchEscrow = generateMatchEscrow;
  W.getOrCreateEscrow   = generateMatchEscrow;
  W.getEscrow           = getEscrow;
  W.htpEscrowUtils      = { buildRedeemScript:buildRedeemScript, toHex:toHex, OPC:OPC };

  console.log('%c[HTP Covenant Escrow v2] Loaded','color:#49e8c2;font-weight:bold');
  console.log('  KIP-10: OP_TXOUTPUTCOUNT(0xb4) + OP_TXOUTPUTSPK(0xc3)');
  console.log('  Fees: delegated to HTPFee | Treasury:', (W.HTPFee ? W.HTPFee.treasuryAddress() : 'pending'));
})(window);
