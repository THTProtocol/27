/**
 * htp-covenant-escrow-v2.js — SHIM v4.1
 *
 * Proxies all escrow operations to Rust backend (escrow.rs).
 * Private keys stay in the browser (localStorage) — never sent to backend.
 *
 * Escrow TX structure enforced by Rust (KIP-10 covenant):
 *   Output 0: winner_payout  → winner_address
 *   Output 1: protocol_fee   → treasury_address
 *   (cancel path: output 0+1 split equally between creator + joiner)
 */
(function(W) {
  'use strict';

  function base() { return W.HTP_RUST_API || ''; }

  async function post(path, body) {
    if (!base()) throw new Error('[HTP Escrow] HTP_RUST_API not set');
    var r = await fetch(base() + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!r.ok) throw new Error('[HTP Escrow] ' + path + ' failed: ' + r.status);
    return r.json();
  }

  // ── Escrow creation ──────────────────────────────────────────────────────
  // Creates a KIP-10 P2SH covenant escrow address.
  // pubkeyA = creator pubkey (cancel path signer)
  // pubkeyB = settlement pubkey (winner claim path)
  W.htpEscrowCreateAddress = function(pubkeyA, pubkeyB, network) {
    return post('/escrow/create', {
      pubkey_a: pubkeyA,
      pubkey_b: pubkeyB,
      network:  network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Payout TX ────────────────────────────────────────────────────────────
  // Builds a TX that pays winner (output 0) and treasury (output 1).
  // fee_bps: protocol fee in basis points (200 = 2%).
  W.htpEscrowBuildPayout = function(req) {
    return post('/escrow/payout', req);
  };

  // ── Cancel TX ────────────────────────────────────────────────────────────
  // Refunds escrow equally to both players. Only valid before game starts.
  W.htpEscrowBuildCancel = function(req) {
    return post('/escrow/cancel', req);
  };

  // ── Settlement preview ───────────────────────────────────────────────────
  // Returns payout breakdown before TX is signed.
  W.htpSettlementPreview = function(stakeKas, isDraw, network) {
    return post('/settlement/preview', {
      stake_kas: stakeKas,
      is_draw:   isDraw || false,
      network:   network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Covenant integrity check ─────────────────────────────────────────────
  // Verifies the escrow redeemScript contains the current treasury address.
  // Call before settling any escrow — prevents routing fee to stale address.
  W.htpValidateCovenant = function(redeemScriptHex, network) {
    return post('/settlement/validate-covenant', {
      redeem_script_hex: redeemScriptHex,
      network: network || W.HTP_NETWORK_ID || 'testnet-12',
    });
  };

  // ── Local escrow store ───────────────────────────────────────────────────
  // Private key NEVER leaves the browser. Only escrow metadata is stored.
  var STORE_KEY = 'htp-covenant-escrows';

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function writeStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e) {}
  }

  W.getEscrow = function(matchId) {
    return readStore()[matchId] || null;
  };

  W.saveEscrow = function(entry) {
    if (!entry || !entry.matchId) { console.warn('[HTP Escrow] saveEscrow: entry.matchId missing'); return; }
    var s = readStore();
    s[entry.matchId] = entry;
    writeStore(s);
    W.htpLastEscrow = entry;
  };

  W.markEscrowSettled = function(matchId, txId) {
    var s = readStore();
    if (s[matchId]) {
      s[matchId].settled    = true;
      s[matchId].settleTxId = txId;
      s[matchId].settledAt  = Date.now();
      writeStore(s);
    }
  };

  W.clearEscrow = function(matchId) {
    var s = readStore();
    delete s[matchId];
    writeStore(s);
  };

  console.log('[HTP Escrow Shim v4.1] proxying to', base() || '(HTP_RUST_API pending)');
})(window);
