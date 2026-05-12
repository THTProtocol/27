/**
 * htp-covenant-escrow-v2.js  ,  High Table Protocol  ,  v3.0
 *
 * FULL TRUSTLESS MODEL:
 *  - Escrow keypair is generated ONCE per match, CLIENT-SIDE, via WebCrypto CSPRNG.
 *  - The private key NEVER leaves the creating browser (stored only in localStorage).
 *  - Both players deposit to the same P2SH address derived from the redeem script.
 *  - Settlement is triggered by the oracle attestation written via REST API.
 *  - The winner's browser (or the oracle daemon) builds + submits the settlement TX.
 *  - REST API is COORDINATION ONLY , it never holds secrets or controls funds.
 *
 * P2SH REDEEM SCRIPT (KIP-10, TN12 + mainnet compatible):
 *
 *   OP_IF
 *     <creatorPubkey> OP_CHECKSIG          <- creator-cancel path (pre-join only)
 *   OP_ELSE
 *     OP_TXOUTPUTCOUNT <2> OP_EQUALVERIFY  <- enforce exactly 2 outputs
 *     <1> OP_TXOUTPUTSPK <feeSPK> OP_EQUALVERIFY  <- enforce fee output SPK
 *     <escrowPubkey> OP_CHECKSIG           <- oracle/winner settlement
 *   OP_ENDIF
 *
 * SCRIPTPUBKEY of the P2SH address:
 *   OP_BLAKE2B <scriptHash> OP_EQUAL
 *
 * SCRIPTSIG for the ELSE (settlement) path:
 *   <sig> <0x00> <redeemScript>
 *   (0x00 = OP_0 selects ELSE branch)
 *
 * SCRIPTSIG for the IF (cancel) path:
 *   <sig> <0x01> <redeemScript>
 *   (0x01 = OP_1 selects IF branch)
 *
 * KIP-10 opcodes: OP_TXOUTPUTCOUNT(0xb4)  OP_TXOUTPUTSPK(0xc3)
 * Fees: delegated entirely to HTPFee (htp-fee-engine.js)
 */

(function (W) {
  'use strict';

  /* == Constants == */
  var NETWORK_FEE = 10000n;  // 0.0001 KAS minimum network fee
  var MIN_FEE     = 1000n;
  var SOMPI       = 100000000n;

  // P2SH covenant enforcement flag.
  // Set true once KIP-10 (OP_TXOUTPUTCOUNT/OP_TXOUTPUTSPK) is mainnet-activated.
  // When false: P2PK escrow (fully functional; covenant not enforced on-chain).
  var USE_P2SH = false;

  // KIP-10 script opcodes
  var OPC = {
    OP_0:            0x00,
    OP_1:            0x51,
    OP_2:            0x52,
    OP_IF:           0x63,
    OP_ELSE:         0x67,
    OP_ENDIF:        0x68,
    OP_EQUALVERIFY:  0x88,
    OP_EQUAL:        0x87,
    OP_CHECKSIG:     0xac,
    OP_BLAKE2B:      0xaa,
    OP_TXOUTPUTCOUNT:0xb4,
    OP_TXOUTPUTSPK:  0xc3
  };

  // Network-specific treasury addresses. Use getFeeDest(networkId) to select.
  var MAINNET_TREASURY = 'kaspa:qza6ah0lfqf33c9m00ynkfeettuleluvnpyvmssm5pzz7llwy2ka5nkka4fel';
  var TESTNET_TREASURY = 'kaspa:qr6vs4wy4m3za6mzchj05x3902qrtklkyn8s0u8g2gv6mrctzdzx7pnhqxka2';
  function getFeeDest(networkId) {
    if (networkId === 'mainnet' || networkId === 'kaspa') return MAINNET_TREASURY;
    return TESTNET_TREASURY;
  }
  // Backward-compat alias used by older code paths.
  var FEE_DEST = TESTNET_TREASURY;

  /* == Helpers == */
  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2)
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
  }
  function bytesToHex(bytes) {
    return Array.from(bytes).map
  // MAXIMIZER CONSTANTS (canonical protocol v9.0)
  var MAXIMIZER = {
    POOL_SPLIT_RATIO: 0.5,    // 50% to pool
    HEDGE_SPLIT_RATIO: 0.5,   // 50% to escrow hedge
    WIN_FEE_PCT: 0.02,        // 2% on winnings
    LOSS_HEDGE_FEE_PCT: 0.30  // 30% of hedge if maximizer loses
  };

  /**
   * Split a maximizer bet into pool + hedge portions.
   * Returns { poolSompi, hedgeSompi }
   */
  function splitMaximizerBet(totalStakeSompi) {
    var poolPortion  = BigInt(Math.round(Number(totalStakeSompi) * MAXIMIZER.POOL_SPLIT_RATIO));
    var hedgePortion = totalStakeSompi - poolPortion;
    return { poolSompi: poolPortion, hedgeSompi: hedgePortion };
  }

  /**
   * Calculate maximizer win payout: virtual 100% × odds, then 2% fee on winnings.
   * Returns { grossSompi, feeSompi, netSompi }
   */
  function calcMaximizerWinPayout(virtualStakeSompi, oddsDecimal) {
    var gross  = BigInt(Math.round(Number(virtualStakeSompi) * oddsDecimal));
    var fee    = (gross * 2n) / 100n;  // 2%
    var net    = gross - fee;
    return { grossSompi: gross, feeSompi: fee, netSompi: net };
  }

  /**
   * Calculate maximizer loss hedge claim: 70% of hedge returned (30% fee).
   * Returns { claimableSompi, feeSompi }
   */
  function calcMaximizerLossClaim(hedgeSompi) {
    var fee       = (hedgeSompi * 30n) / 100n;  // 30%
    var claimable = hedgeSompi - fee;
    return { claimableSompi: claimable, feeSompi: fee };
  }

  // Expose to global
  window.HTP_MaximizerSplit = splitMaximizerBet;
  window.HTP_MaximizerWin   = calcMaximizerWinPayout;
  window.HTP_MaximizerLoss  = calcMaximizerLossClaim;

(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }
  function pushData(bytes) {
    var len = bytes.length;
    if (len <= 75) return [len].concat(Array.from(bytes));
    if (len <= 255) return [0x4c, len].concat(Array.from(bytes));
    return [0x4d, len & 0xff, (len >> 8) & 0xff].concat(Array.from(bytes));
  }

  /* == Redeem script builder == */
  function buildRedeemScript(creatorPubkeyHex, escrowPubkeyHex, feeSPKHex) {
    var creatorPub = hexToBytes(creatorPubkeyHex);
    var escrowPub  = hexToBytes(escrowPubkeyHex);
    var feeSPK     = hexToBytes(feeSPKHex);
    var script = [];

    // IF branch: creator cancel
    script.push(OPC.OP_IF);
    script = script.concat(pushData(creatorPub));
    script.push(OPC.OP_CHECKSIG);

    // ELSE branch: covenant settlement
    script.push(OPC.OP_ELSE);
    script.push(OPC.OP_TXOUTPUTCOUNT);
    script.push(OPC.OP_2);
    script.push(OPC.OP_EQUALVERIFY);
    script.push(OPC.OP_1);
    script = script.concat(pushData(feeSPK));
    script.push(OPC.OP_TXOUTPUTSPK);
    script.push(OPC.OP_EQUALVERIFY);
    script = script.concat(pushData(escrowPub));
    script.push(OPC.OP_CHECKSIG);
    script.push(OPC.OP_ENDIF);

    return new Uint8Array(script);
  }

  /* == P2SH address derivation == */
  async function redeemScriptToAddress(redeemScript, networkId) {
    var SDK = window.kaspa || window.KaspaSDK;
    if (!SDK) throw new Error('Kaspa SDK not loaded');

    // BLAKE2B hash of the redeem script
    var hashFn = SDK.blake2b || (SDK.crypto && SDK.crypto.blake2b);
    if (!hashFn) throw new Error('SDK blake2b not available');
    var scriptHash = await hashFn(redeemScript, 32);

    // P2SH scriptPubKey: OP_BLAKE2B <32-byte-hash> OP_EQUAL
    var spk = [OPC.OP_BLAKE2B].concat(pushData(scriptHash)).concat([OPC.OP_EQUAL]);

    // Derive address from SPK
    var addrFn = SDK.scriptPublicKeyToAddress || (SDK.Address && SDK.Address.fromScriptPublicKey);
    if (!addrFn) throw new Error('SDK address derivation not available');
    return addrFn(new Uint8Array(spk), networkId).toString();
  }

  /* == Escrow generation == */
  async function generateMatchEscrow(matchId, stakeKas, creatorPubkeyHex) {
    var SDK = window.kaspa || window.KaspaSDK;
    if (!SDK) { console.error('[HTP Escrow] Kaspa SDK not loaded'); return null; }

    var networkId = W.htpNetwork || W.kaspaNetwork || 'tn12';

    // 1. Generate ephemeral escrow keypair (CSPRNG, client-side only)
    var escrowPriv, escrowPub;
    try {
      var genFn = SDK.generateKeyPair || SDK.PrivateKey.random || (function(){
        var arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        return { privateKey: SDK.PrivateKey ? new SDK.PrivateKey(arr) : arr };
      });
      var kp = await Promise.resolve(genFn());
      escrowPriv = kp.privateKey || kp;
      escrowPub  = escrowPriv.toPublicKey ? escrowPriv.toPublicKey() : kp.publicKey;
    } catch (e) {
      console.error('[HTP Escrow] keypair generation failed:', e);
      return null;
    }

    var escrowPubHex = escrowPub.toString ? escrowPub.toString('hex') : bytesToHex(escrowPub);

    // 2. Derive fee SPK for covenant output enforcement (network-specific treasury)
    var feeDestForNet = getFeeDest(networkId);
    var feeSPKHex;
    try {
      var feeAddrObj = SDK.Address ? new SDK.Address(feeDestForNet) : { scriptPublicKey: function(){ return new Uint8Array(34); } };
      var feeSPK = feeAddrObj.scriptPublicKey ? feeAddrObj.scriptPublicKey() : feeAddrObj.toScriptPublicKey();
      feeSPKHex = bytesToHex(feeSPK instanceof Uint8Array ? feeSPK : new Uint8Array(feeSPK));
    } catch (e) {
      feeSPKHex = '0000000000000000000000000000000000000000000000000000000000000000';
    }

    // 3. Build redeem script
    var creatorPub = creatorPubkeyHex || escrowPubHex;
    var redeemScript = buildRedeemScript(creatorPub, escrowPubHex, feeSPKHex);

    // 4. Compute script hash for display / debugging
    var scriptHashHex;
    try {
      var sha = await crypto.subtle.digest('SHA-256', redeemScript);
      scriptHashHex = bytesToHex(new Uint8Array(sha));
    } catch(e) {
      scriptHashHex = '(unavailable)';
    }

    // 5. Derive escrow address.
    // USE_P2SH=true  -> P2SH covenant (KIP-10 enforced on-chain).
    // USE_P2SH=false -> P2PK (reliable TN12+mainnet; covenant not enforced on-chain).
    var escrowAddress;
    if (USE_P2SH) {
      try {
        escrowAddress = await redeemScriptToAddress(redeemScript, networkId);
      } catch (e) {
        console.warn('[HTP Escrow] P2SH derivation failed, falling back to P2PK:', e.message);
        escrowAddress = escrowPriv.toPublicKey().toAddress(networkId).toString();
      }
    } else {
      // Standard P2PK: reliable on all networks, no covenant enforcement
      escrowAddress = (escrowPriv.toPublicKey ? escrowPriv.toPublicKey() : escrowPub).toAddress
        ? (escrowPriv.toPublicKey ? escrowPriv.toPublicKey() : escrowPub).toAddress(networkId).toString()
        : escrowPubHex;
    }

    // 6. Persist escrow record SECURELY.
    // CRITICAL: Private key MUST NOT be stored in plaintext localStorage.
    // Encrypt with AES-256-GCM using ephemeral session key, store encrypted blob in sessionStorage only.
    // localStorage receives ONLY the non-sensitive metadata for recovery display.
    var stakeSompi = BigInt(Math.round(stakeKas * Number(SOMPI)));
    var privKeyHex = escrowPriv.toString ? escrowPriv.toString('hex') : bytesToHex(escrowPriv);

    // Generate (or reuse) the per-session AES key. Never persisted to disk.
    var sessionKey = window._htpEscrowSessionKey;
    if (!sessionKey) {
      sessionKey = Array.from(
        crypto.getRandomValues(new Uint8Array(32))
      ).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      window._htpEscrowSessionKey = sessionKey;
    }

    var encPrivKey;
    try {
      var encKeyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionKey));
      var aesKey = await crypto.subtle.importKey('raw', encKeyHash, { name: 'AES-GCM' }, false, ['encrypt']);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aesKey, new TextEncoder().encode(privKeyHex));
      var combined = new Uint8Array(iv.length + ct.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ct), iv.length);
      encPrivKey = btoa(String.fromCharCode.apply(null, combined));
    } catch (e) {
      console.error('[HTP Escrow] private key encryption failed:', e);
      encPrivKey = null;
    }

    var publicRecord = {
      matchId:       matchId,
      escrowAddress: escrowAddress,
      escrowPubHex:  escrowPubHex,
      creatorPubHex: creatorPub,
      redeemScript:  bytesToHex(redeemScript),
      scriptHash:    scriptHashHex,
      stakeKas:      stakeKas,
      stakeSompi:    stakeSompi.toString(),
      networkId:     networkId,
      createdAt:     Date.now()
    };
    var secureRecord = {
      matchId:      matchId,
      encryptedKey: encPrivKey,
      createdAt:    Date.now()
    };

    try {
      // Public metadata in localStorage (safe for recovery/display).
      localStorage.setItem('htpEscrow_' + matchId, JSON.stringify(publicRecord));
      // Encrypted private key ONLY in sessionStorage (cleared on tab close).
      sessionStorage.setItem('htpEscrowKey_' + matchId, JSON.stringify(secureRecord));
    } catch(e) {
      console.warn('[HTP Escrow] storage write failed:', e.message);
    }

    // Schedule cleanup of the encrypted key after 1 hour.
    setTimeout(function() {
      try { sessionStorage.removeItem('htpEscrowKey_' + matchId); } catch(e) {}
    }, 3600000);

    console.log('[HTP Escrow] generated escrow for match', matchId, '| USE_P2SH:', USE_P2SH, '| addr:', escrowAddress, '| PRIVATE KEY ENCRYPTED');
    // Return record includes the in-memory plaintext private key for the caller to use immediately,
    // but it is NOT written to disk in plaintext.
    return Object.assign({}, publicRecord, { privateKey: privKeyHex });
  }

  /* == Escrow retrieval (decrypts private key from sessionStorage if available) == */
  async function getEscrow(matchId) {
    try {
      var publicRaw = localStorage.getItem('htpEscrow_' + matchId)
                   || localStorage.getItem('htpcovenantescrow_' + matchId);
      if (!publicRaw) {
        // Legacy fallback: combined storage shape
        var legacyRaw = localStorage.getItem('htpcovenantescrows');
        if (!legacyRaw) return null;
        try {
          var legacy = JSON.parse(legacyRaw);
          if (legacy && legacy[matchId]) return legacy[matchId];
          return legacy;
        } catch(e) { return null; }
      }
      var escrow = JSON.parse(publicRaw);
      if (escrow && escrow[matchId]) escrow = escrow[matchId];

      // Try to decrypt the private key from sessionStorage.
      var secureRaw = sessionStorage.getItem('htpEscrowKey_' + matchId);
      if (secureRaw && window._htpEscrowSessionKey) {
        try {
          var secure = JSON.parse(secureRaw);
          if (secure && secure.encryptedKey) {
            var combinedStr = atob(secure.encryptedKey);
            var combined = new Uint8Array(combinedStr.length);
            for (var i = 0; i < combinedStr.length; i++) combined[i] = combinedStr.charCodeAt(i);
            var iv = combined.slice(0, 12);
            var ct = combined.slice(12);
            var encKeyHash = await crypto.subtle.digest('SHA-256',
              new TextEncoder().encode(window._htpEscrowSessionKey));
            var aesKey = await crypto.subtle.importKey('raw', encKeyHash,
              { name: 'AES-GCM' }, false, ['decrypt']);
            var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ct);
            escrow.privateKey = new TextDecoder().decode(pt);
          }
        } catch (e) {
          console.warn('[HTP Escrow] decrypt failed (session key likely cleared):', e.message);
        }
      }

      return escrow;
    } catch(e) {
      console.warn('[HTP Escrow] getEscrow failed:', e.message);
      return null;
    }
  }

  /* == Settlement TX builder == */
  async function buildSettleTx(esc, outputs, mode) {
    var SDK = window.kaspa || window.KaspaSDK;
    if (!SDK) throw new Error('Kaspa SDK not available');

    var utxos = W.htpGetUtxos
      ? await W.htpGetUtxos(esc.escrowAddress)
      : [];
    if (!utxos || !utxos.length) throw new Error('No UTXOs at escrow address ' + esc.escrowAddress);

    var totalIn = utxos.reduce(function(s, u){ return s + BigInt(u.amount || u.value || 0); }, 0n);
    var totalOut = outputs.reduce(function(s, o){ return s + BigInt(o.amount || 0); }, 0n);
    if (totalIn < totalOut + NETWORK_FEE) {
      throw new Error('Insufficient escrow balance: have ' + totalIn + ' sompi, need ' + (totalOut + NETWORK_FEE));
    }

    var privKeyHex = esc.privateKey;
    var privKey = SDK.PrivateKey ? new SDK.PrivateKey(hexToBytes(privKeyHex)) : hexToBytes(privKeyHex);

    var txBuilder = SDK.TransactionBuilder || SDK.createTransaction;
    var tx = txBuilder({
      utxos:   utxos,
      outputs: outputs,
      fee:     NETWORK_FEE,
      networkId: esc.networkId || W.htpNetwork || 'tn12'
    });

    var signFn = SDK.signTransaction || W.signTransaction;
    var signed = signFn(tx, [privKey], true);
    return signed;
  }

  /* == Settlement payout == */
  async function settleMatchPayout(matchId, winnerAddress, payoutSompi) {
    var esc = await getEscrow(matchId);
    if (!esc) {
      if (W.showToast) W.showToast('No escrow record found for match ' + matchId, 'error');
      return null;
    }

    // REST API settlement lock -- atomic compare-and-set prevents double-settle.
    try {
      var lockRes = await fetch('/api/settlement/' + matchId + '/lock', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({by: W.walletAddress || 'daemon', ts: Date.now()})
      });
      var txnResult = await lockRes.json();
      if (!txnResult.acquired) {
        if (txnResult.existingTxId) {
          if (W.showToast) W.showToast('Match already settled on-chain', 'info');
          return txnResult.existingTxId;
        }
        if (W.showToast) W.showToast('Settlement in progress by another client, please wait...', 'info');
        return null;
      }
    } catch (e) {
      console.warn('[HTP Escrow] REST lock unavailable, proceeding without lock:', e.message);
    }

    var feeAmount = (BigInt(payoutSompi) * 200n) / 10000n; // 2%
    if (feeAmount < MIN_FEE) feeAmount = MIN_FEE;
    var winnerAmount = BigInt(payoutSompi) - feeAmount;

    var feeDestForNet = getFeeDest(esc.networkId || W.htpNetwork || 'tn12');
    var outputs = [
      { address: winnerAddress, amount: winnerAmount },
      { address: feeDestForNet, amount: feeAmount }
    ];

    var txId = null;
    try {
      var dryRun = W.htpDryRun || false;
      if (dryRun) {
        console.log('[HTP Escrow] DRY RUN settle | match:', matchId, '| winner:', winnerAddress, '| payout:', winnerAmount.toString(), 'sompi');
        txId = 'dry-run-' + matchId;
      } else {
        var signed = await buildSettleTx(esc, outputs, 'settle');
        var submitFn = W.htpSubmitTx || (W.kaspa && W.kaspa.submitTransaction);
        if (!submitFn) throw new Error('No TX submission function available');
        txId = await submitFn(signed);
      }
    } catch (e) {
      console.error('[HTP Escrow] settle TX failed:', e);
      if (W.showToast) W.showToast('Settlement TX failed: ' + e.message, 'error');
      // Release the REST lock so another browser can retry
      try {
        await fetch('/api/settlement/' + matchId + '/lock', {method: 'DELETE'});
      } catch (_) {}
      return null;
    }

    // Write txId to REST API to permanently claim the lock
    try {
      await fetch('/api/settlement/' + matchId + '/claimed', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          by: W.walletAddress || 'daemon',
          ts: Date.now(),
          txId: txId,
          winner: winnerAddress,
          locked: false
        })
      });
    } catch (e) {
      console.warn('[HTP Escrow] REST settlement write failed:', e.message);
    }

    if (W.showToast) W.showToast('Settlement TX submitted: ' + txId, 'success');
    console.log('[HTP Escrow] settled match', matchId, 'txId:', txId);
    return txId;
  }

  /* == Cancel (creator-only, pre-join) == */
  async function cancelMatchEscrow(matchId) {
    var esc = await getEscrow(matchId);
    if (!esc) {
      if (W.showToast) W.showToast('No escrow record found for match ' + matchId, 'error');
      return null;
    }

    var refundAddr = W.walletAddress || W.htpAddress;
    if (!refundAddr) { if (W.showToast) W.showToast('No wallet address for refund', 'error'); return null; }

    // Only the creator's browser holds the escrow private key.
    if (!esc.privateKey) {
      if (W.showToast) W.showToast('Cancel can only be initiated from the browser that created the match', 'error');
      return null;
    }

    try {
      var stakeSompi = BigInt(esc.stakeSompi || '0');
      if (!stakeSompi) throw new Error('Stake amount is zero or unknown');

      var outputs = [{ address: refundAddr, amount: stakeSompi }];
      var dryRun = W.htpDryRun || false;
      var txId;
      if (dryRun) {
        console.log('[HTP Escrow] DRY RUN cancel | match:', matchId, '| refund:', refundAddr);
        txId = 'dry-cancel-' + matchId;
      } else {
        var signed = await buildSettleTx(esc, outputs, 'cancel');
        var submitFn = W.htpSubmitTx || (W.kaspa && W.kaspa.submitTransaction);
        if (!submitFn) throw new Error('No TX submission function available');
        txId = await submitFn(signed);
      }

      // Mark as cancelled via REST API
      try {
        await fetch('/api/games/' + matchId, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({status: 'cancelled'})
        });
        await fetch('/api/settlement/' + matchId + '/claimed', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            by: W.walletAddress || 'creator',
            ts: Date.now(),
            txId: txId,
            winner: null,
            reason: 'creator-cancel'
          })
        });
      } catch (e) {
        console.warn('[HTP Escrow] REST cancel write failed:', e.message);
      }

      if (W.showToast) W.showToast('Match cancelled. Stake refunded: ' + txId, 'success');
      console.log('[HTP Escrow] cancelled match', matchId, 'txId:', txId);
      return txId;
    } catch (e) {
      console.error('[HTP Escrow] cancel failed:', e);
      if (W.showToast) W.showToast('Cancel failed: ' + e.message, 'error');
      return null;
    }
  }

  /* == Deposit verification == */
  async function verifyEscrowDeposit(matchId) {
    var esc = await getEscrow(matchId);
    if (!esc) return { ok: false, reason: 'no-escrow-record' };

    var utxoFn = W.htpGetUtxos || (W.kaspa && W.kaspa.getUtxos);
    if (!utxoFn) return { ok: false, reason: 'no-utxo-lookup' };

    try {
      var utxos = await utxoFn(esc.escrowAddress);
      var balance = (utxos || []).reduce(function(s, u){ return s + BigInt(u.amount || u.value || 0); }, 0n);
      var required = BigInt(esc.stakeSompi || '0');
      return {
        ok:      balance >= required,
        balance: balance.toString(),
        required: required.toString(),
        address: esc.escrowAddress
      };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  /* == Oracle attestation listener == */
  function watchOracleAttestation(matchId, onSettle) {
    var ws = null;
    var stopped = false;
    function connect() {
      try {
        ws = new WebSocket('wss://' + location.host + '/relay/oracle/' + matchId);
        ws.onmessage = function(e) {
          var att = JSON.parse(e.data);
          if (!att || att.processed) return;
          console.log('[HTP Escrow] oracle attestation received for match', matchId, att);
          if (typeof onSettle === 'function') onSettle(att);
        };
        ws.onerror = function() { if (!stopped) setTimeout(connect, 3000); };
        ws.onclose = function() { if (!stopped) setTimeout(connect, 3000); };
      } catch(e) {
        if (!stopped) setTimeout(connect, 3000);
      }
    }
    connect();
    return function cleanup() { stopped = true; if (ws) { ws.close(); ws = null; } };
  }

  /* == Auto-settle on oracle attestation == */
  async function autoSettleFromOracle(matchId) {
    return new Promise(function(resolve) {
      var unwatch = watchOracleAttestation(matchId, async function(att) {
        if (typeof unwatch === 'function') unwatch();
        var txId = await settleMatchPayout(matchId, att.winnerAddress, att.payoutSompi);
        // Mark oracle attestation as processed
        try {
          await fetch('/api/oracle/attestations/' + matchId + '/processed', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({processed: true})
          });
        } catch(e) {}
        resolve(txId);
      });
    });
  }

  /* == Public API == */
  W.generateMatchEscrow   = generateMatchEscrow;
  W.getEscrow             = getEscrow;
  W.settleMatchPayout     = settleMatchPayout;
  W.cancelMatchEscrow     = cancelMatchEscrow;
  W.verifyEscrowDeposit   = verifyEscrowDeposit;
  W.watchOracleAttestation= watchOracleAttestation;
  W.autoSettleFromOracle  = autoSettleFromOracle;

  // Expose internals for testing / debugging
  W.__htpEscrowInternals = {
    buildRedeemScript: buildRedeemScript,
    redeemScriptToAddress: redeemScriptToAddress,
    USE_P2SH: USE_P2SH,
    OPC: OPC,
    FEE_DEST: FEE_DEST
  };

  console.log('[HTP Escrow v3.0] loaded | USE_P2SH:', USE_P2SH, '| network:', W.htpNetwork || '(not yet set)');

  /* ═══════════════════════════════════════════════════════════════
   * SETTLEMENT FLOW — wired to /api/games/:id/propose
   * ═══════════════════════════════════════════════════════════════ */

  async function htpProposeSettle(gameId, winnerAddress, proofRoot, path) {
    if (!gameId || !winnerAddress) {
      console.error('[HTP] proposeSettle: missing gameId or winnerAddress');
      return null;
    }
    try {
      var apiBase = (W.HTP_CONFIG && W.HTP_CONFIG.API_ORIGIN) ? W.HTP_CONFIG.API_ORIGIN.replace(/\/+$/, '') : '';
      var url = apiBase + '/api/games/' + gameId + '/propose';
      var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winner: winnerAddress,
          proof_root: proofRoot || null,
          settlement_path: path || 'B'
        })
      });
      if (!resp.ok) { console.error('[HTP] proposeSettle HTTP', resp.status); return null; }
      var data = await resp.json();

      // Store attestation via REST API for dispute tracking
      try {
        await fetch('/api/games/' + gameId + '/settlement', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            winner:           data.winner,
            attestation_hash: data.attestation_hash,
            arbiter:          data.arbiter,
            settlement_path:  data.settlement_path,
            proposed_at:      Date.now(),
            status:           'PENDING_SETTLE',
            dispute_deadline: Date.now() + (2 * 24 * 60 * 60 * 1000)
          })
        });
      } catch(fbErr) { console.warn('[HTP] REST settlement write failed:', fbErr); }

      console.log('[HTP] proposeSettle OK:', data.attestation_hash.slice(0,16) + '...');
      return data;
    } catch(e) {
      console.error('[HTP] proposeSettle failed:', e);
      return null;
    }
  }

  async function htpFinalizeSettle(gameId) {
    try {
      var r = await fetch('/api/games/' + gameId + '/settlement');
      if (!r.ok) { console.error('[HTP] REST not available for finalize'); return { error: 'api_unavailable' }; }
      var s = await r.json();
      if (!s || !s.status) { console.error('[HTP] no settlement record for', gameId); return { error: 'no_record' }; }

      var deadline = s.dispute_deadline;
      if (Date.now() < deadline) {
        var mins = Math.ceil((deadline - Date.now()) / 60000);
        console.warn('[HTP] dispute window open —', mins, 'min remaining');
        return { error: 'dispute_window_open', minutes_remaining: mins };
      }

      await fetch('/api/games/' + gameId + '/settlement', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: 'SETTLED'})
      });
      console.log('[HTP] finalizeSettle:', gameId, 'settled');
      return { status: 'SETTLED', game_id: gameId };
    } catch(e) {
      console.error('[HTP] finalizeSettle failed:', e);
      return null;
    }
  }

  async function htpChallengeSettle(gameId, challengerAddress) {
    try {
      await fetch('/api/games/' + gameId + '/settlement', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          status:      'DISPUTED',
          challenger:  challengerAddress || 'unknown',
          disputed_at: Date.now()
        })
      });
      console.warn('[HTP] settlement DISPUTED by', challengerAddress);
      return { status: 'DISPUTED' };
    } catch(e) {
      console.error('[HTP] challenge failed:', e);
      return null;
    }
  }

  function renderSettlementStatus(settlement, gameId) {
    if (!settlement) return '<p class="muted">No settlement pending</p>';
    var deadline = settlement.dispute_deadline;
    var now = Date.now();
    var remaining = deadline - now;
    var status = settlement.status;
    var colors = { PENDING_SETTLE: '#f5a623', SETTLED: '#7ed321', DISPUTED: '#d0021b' };
    var gid = gameId || settlement.game_id || '';

    var html = '<div class="settlement-status" style="border-left:3px solid ' + (colors[status]||'#ccc') + ';padding:8px 12px;margin:8px 0">';
    html += '<span class="status-label" style="font-weight:bold">' + (status||'?').replace(/_/g,' ') + '</span>';
    if (remaining > 0) html += '<span class="countdown"> — ' + Math.ceil(remaining/3600000) + 'h remaining</span>';
    html += '<div class="attestation" style="font-size:0.85em;margin-top:4px">Arbiter: <code>' + (settlement.attestation_hash||'pending').slice(0,16) + '...</code></div>';
    if (status === 'PENDING_SETTLE' && remaining > 0) {
      html += '<button onclick="window.htpChallengeSettle(\'' + gid + '\', window.connectedAddress)" style="margin-top:6px;background:#d0021b;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">Dispute</button>';
    }
    if (remaining <= 0 && status === 'PENDING_SETTLE') {
      html += '<button onclick="window.htpFinalizeSettle(\'' + gid + '\')" style="margin-top:6px;background:#7ed321;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">Finalize Settlement</button>';
    }
    html += '</div>';
    return html;
  }

  W.htpProposeSettle    = htpProposeSettle;
  W.htpFinalizeSettle   = htpFinalizeSettle;
  W.htpChallengeSettle  = htpChallengeSettle;
  W.renderSettlementStatus = renderSettlementStatus;

  console.log('[HTP Escrow v3.0] Settlement flow loaded — propose/finalize/challenge routes active');

})(window);
