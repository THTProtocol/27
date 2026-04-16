/**
 * htp-covenant-escrow-v2.js — SHIM v4.0
 *
 * All escrow logic has been ported to Rust (escrow.rs in htp-rust-backend).
 * This file is a thin browser shim that proxies to the Rust backend.
 *
 * Endpoints proxied:
 *   POST /escrow/create   — generate P2SH address + redeemScript
 *   POST /escrow/payout   — build payout TX
 *   POST /escrow/cancel   — build cancel TX
 */
(function (W) {
  'use strict';

  var BASE = W.HTP_RUST_API || 'https://htp-backend-<YOUR_CLOUD_RUN_HASH>.run.app';

  async function post(path, body) {
    var r = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('[HTP Escrow Shim] ' + path + ' failed: ' + r.status);
    return r.json();
  }

  W.htpEscrowCreateAddress = function (pubkeyA, pubkeyB, network) {
    return post('/escrow/create', { pubkey_a: pubkeyA, pubkey_b: pubkeyB, network: network || W.HTP_NETWORK_ID || 'testnet-12' });
  };

  W.htpEscrowBuildPayout = function (req) {
    return post('/escrow/payout', req);
  };

  W.htpEscrowBuildCancel = function (req) {
    return post('/escrow/cancel', req);
  };

  // localStorage escrow store (private key stays in browser — never sent to backend)
  var STORE_KEY = 'htp-covenant-escrows';
  function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e) { return {}; } }
  function writeStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e) {} }
  W.getEscrow  = function (matchId) { return readStore()[matchId] || null; };
  W.saveEscrow = function (entry)   { var s = readStore(); s[entry.matchId] = entry; writeStore(s); W.htpLastEscrow = entry; };
  W.markEscrowSettled = function (matchId, txId) {
    var s = readStore();
    if (s[matchId]) { s[matchId].settled = true; s[matchId].settleTxId = txId; writeStore(s); }
  };

  console.log('[HTP Escrow Shim v4.0] proxying to', BASE);
})(window);
