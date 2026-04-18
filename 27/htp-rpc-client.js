/**
 * htp-rpc-client.js — SHIM v4.0
 *
 * WebSocket DAA subscription stays via Kaspa WASM SDK (browser-only).
 * Balance + UTXO queries are proxied to the Rust backend.
 */
(function (W) {
  'use strict';

  var BASE          = W.HTP_RUST_API || 'https://htp-backend-<YOUR_CLOUD_RUN_HASH>.run.app';
  var MAX_BACKOFF   = 30000;
  var BASE_BACKOFF  = 2000;
  var _retryCount   = 0;

  function backoff() { return Math.min(BASE_BACKOFF * Math.pow(2, _retryCount), MAX_BACKOFF) + Math.random() * 1000; }

  // ── Balance (via Rust) ──────────────────────────────────────────────────
  W.htpFetchBalance = async function(address) {
    var r = await fetch(BASE + '/wallet/balance/' + encodeURIComponent(address));
    if (!r.ok) throw new Error('balance fetch failed: ' + r.status);
    var d = await r.json();
    W.htpBalance = d.balance_kas;
    W.dispatchEvent(new CustomEvent('htp:balance:updated', { detail: { kas: d.balance_kas, sompi: d.balance, address: address } }));
    return d;
  };

  // ── BlockDAG (via Rust) ─────────────────────────────────────────────────
  W.htpFetchBlockDAG = async function() {
    var r = await fetch(BASE + '/blockdag/live');
    if (!r.ok) throw new Error('blockdag fetch failed: ' + r.status);
    return r.json();
  };

  // ── DAA score (via Rust) ────────────────────────────────────────────────
  W.htpFetchDaa = async function() {
    var r = await fetch(BASE + '/deadline/daa');
    if (!r.ok) return;
    var d = await r.json();
    W.htpDaaScore = BigInt(d.virtual_daa_score);
    W.dispatchEvent(new CustomEvent('htp:daa:updated', { detail: { daa: d.virtual_daa_score } }));
    return d.virtual_daa_score;
  };

  // Poll DAA every 500ms (replaces WebSocket subscription for non-WASM path)
  if (!W.kaspaSDK) {
    setInterval(function() { W.htpFetchDaa && W.htpFetchDaa().catch(function(){}); }, 500);
  }

  // ── WASM WebSocket subscription (browser-only, unchanged) ──────────────
  function connectWasm() {
    if (!W.kaspaSDK || !W.kaspaSDK.RpcClient) {
      setTimeout(connectWasm, 500);
      return;
    }
    var sdk = W.kaspaSDK;
    try {
      var rpc = new sdk.RpcClient({ resolver: new sdk.Resolver(), networkId: W.HTP_NETWORK_ID || 'testnet-12' });
      rpc.addEventListener('virtual-daa-score-changed', function(e) {
        W.htpDaaScore = BigInt(e.data.virtualDaaScore);
        W.dispatchEvent(new CustomEvent('htp:daa:updated', { detail: { daa: e.data.virtualDaaScore } }));
      });
      rpc.connect().then(function() {
        W._htpRpcConnected = true;
        _retryCount = 0;
        W.dispatchEvent(new CustomEvent('htp:rpc:connected'));
      }).catch(function(err) {
        _retryCount++;
        setTimeout(connectWasm, backoff());
      });
      W.htpRpc = rpc;
    } catch(e) { _retryCount++; setTimeout(connectWasm, backoff()); }
  }

  W.addEventListener('htp:wasm:ready', connectWasm);
  if (W.wasmReady) connectWasm();

  console.log('[HTP RPC Shim v4.0] balance+dag via Rust, DAA via WASM WebSocket');
})(window);

W.htpFetchDaa = async function(network) {
  try {
    var r = await fetch(W.HTP_RUST_API + '/deadline/daa', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error('status ' + r.status);
    var data = await r.json();
    if (data && data.daa) window._htpDaaCache = data.daa;
    return data;
  } catch(e) {
    return { daa: window._htpDaaCache || 58000000 };
  }
};


/* DAA 500 silent-fail patch */
var _origFetchDaa = W.htpFetchDaa;
W.htpFetchDaa = function(network) {
  return _origFetchDaa(network).catch(function(e) {
    // silently return cached value on 500
    var cached = W._htpDaaScore || 0;
    return cached;
  });
};
