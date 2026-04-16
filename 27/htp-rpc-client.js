/**
 * htp-rpc-client.js  —  High Table Protocol  —  v3.1
 *
 * RESPONSIBILITIES:
 *  - Connect via Kaspa Resolver when window.HTP_USE_RESOLVER is true (set by htp-init.js)
 *  - Fall back to direct TN12_ENDPOINTS when HTP_USE_RESOLVER is false
 *  - Reconnect with exponential backoff on disconnect
 *  - Subscribe to virtual-daa-score-changed
 *  - Start UTXO tracking when htp:wallet:connected fires
 *  - Expose window.htpRpc public API used by escrow, settlement, oracle modules
 *
 * LOAD ORDER: after htp-init.js (network config must be set)
 *             after WASM is initialised (_onWasmReady must have fired or will fire)
 *
 * HTP_USE_RESOLVER flag (set by htp-init.js NETWORK_MAP):
 *   true  → use sdk.Resolver() for load-balanced connection (tn12 + mainnet default)
 *   false → use direct TN12_ENDPOINTS, rotating on retry
 */

(function (window) {
  'use strict';

  var SOMPI_PER_KAS    = 100000000n;
  var MAX_BACKOFF_MS   = 30000;
  var BASE_BACKOFF_MS  = 2000;

  /* ══ State ════════════════════════════════════════════════════════════════════ */
  var _rpc              = null;
  var _utxoProcessor    = null;
  var _utxoContext      = null;
  var _connected        = false;
  var _daaScore         = 0n;
  var _balanceSompi     = 0n;
  var _trackedAddress   = null;
  var _retryCount       = 0;
  var _retryTimer       = null;
  var _balanceCbs       = new Set();
  var _daaWaiters       = [];  // [{target: bigint, resolve}]

  /* ══ Helpers ══════════════════════════════════════════════════════════════════ */
  function sompiToKas(sompi) {
    var s = sompi.toString().padStart(9, '0');
    return parseFloat(s.slice(0, -8) + '.' + s.slice(-8));
  }

  function backoffMs() {
    var delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, _retryCount), MAX_BACKOFF_MS);
    return delay + Math.random() * 1000; // jitter
  }

  function notifyBalance(newSompi) {
    _balanceSompi       = newSompi;
    window.htpBalance   = sompiToKas(newSompi);
    _balanceCbs.forEach(function (cb) {
      try { cb(window.htpBalance, newSompi); } catch (e) {}
    });
    window.dispatchEvent(new CustomEvent('htp:balance:updated', {
      detail: { kas: window.htpBalance, sompi: newSompi.toString(), address: _trackedAddress }
    }));
  }

  function fireDaaWaiters() {
    for (var i = _daaWaiters.length - 1; i >= 0; i--) {
      if (_daaScore >= _daaWaiters[i].target) {
        _daaWaiters[i].resolve(_daaScore);
        _daaWaiters.splice(i, 1);
      }
    }
  }

  /* ══ WASM wait ════════════════════════════════════════════════════════════════ */
  function waitForWasm() {
    return new Promise(function (resolve) {
      if (window.wasmReady && window.kaspaSDK && window.kaspaSDK.RpcClient) {
        return resolve(window.kaspaSDK);
      }
      if (window.whenWasmReady) {
        window.whenWasmReady(function () {
          resolve(window.kaspaSDK || null);
        });
        return;
      }
      var iv = setInterval(function () {
        if (window.kaspaSDK && window.kaspaSDK.RpcClient) {
          clearInterval(iv);
          resolve(window.kaspaSDK);
        }
      }, 100);
      setTimeout(function () { clearInterval(iv); resolve(null); }, 15000);
    });
  }

  /* ══ UTXO tracking ═════════════════════════════════════════════════════════════════ */
  async function startUtxoTracking(sdk, address) {
    if (_utxoProcessor) {
      try { await _utxoProcessor.stop(); } catch (e) {}
      _utxoProcessor = null;
      _utxoContext   = null;
    }

    var networkId = window.HTP_NETWORK_ID || 'testnet-12';
    _utxoProcessor = new sdk.UtxoProcessor({ rpc: _rpc, networkId: networkId });
    _utxoContext   = new sdk.UtxoContext({ processor: _utxoProcessor });

    _utxoProcessor.addEventListener('utxo-proc-start', async function () {
      await _utxoContext.trackAddresses([address]);
    });

    _utxoContext.addEventListener('balance', function (e) {
      var mature = BigInt((e.data && e.data.balance && e.data.balance.mature) ? e.data.balance.mature : 0);
      notifyBalance(mature);
    });

    await _utxoProcessor.start();
    window.htpUtxoContext  = _utxoContext;
    window.htpUtxoProc     = _utxoProcessor;
    console.log('[HTPRpc] UTXO tracking started for', address);
  }

  /* ══ Core connect ══════════════════════════════════════════════════════════════════ */

  // Direct endpoints used only when HTP_USE_RESOLVER === false
  var TN12_ENDPOINTS = [
    'wss://tn12.kaspa.stream/wrpc/borsh',
    'wss://tn12-1.kaspa.stream/wrpc/borsh',
    'wss://tn12-2.kaspa.stream/wrpc/borsh'
  ];

  async function initRpc() {
    var sdk = await waitForWasm();
    if (!sdk || !sdk.RpcClient) {
      console.error('[HTPRpc] WASM SDK unavailable — RPC not started');
      return;
    }

    var networkId   = window.HTP_NETWORK_ID || 'testnet-12';
    // Read the flag set by htp-init.js NETWORK_MAP (true for both tn12 and mainnet)
    var useResolver = window.HTP_USE_RESOLVER === true;
    var rpcEndpoint = window.HTP_RPC_URL || TN12_ENDPOINTS[_retryCount % TN12_ENDPOINTS.length];

    try {
      if (useResolver && sdk.Resolver) {
        // htp-init.js has requested Resolver-based connection (default for tn12 + mainnet)
        console.log('[HTPRpc] Connecting via Resolver (' + networkId + ') [HTP_USE_RESOLVER=true]');
        _rpc = new sdk.RpcClient({ resolver: new sdk.Resolver(), networkId: networkId });
      } else if (rpcEndpoint) {
        // Direct endpoint — either HTP_USE_RESOLVER=false or Resolver unavailable
        console.log('[HTPRpc] Connecting to', rpcEndpoint, '(', networkId, ')');
        _rpc = new sdk.RpcClient({ url: rpcEndpoint, networkId: networkId });
      } else if (sdk.Resolver) {
        // Last resort fallback
        console.log('[HTPRpc] Fallback — connecting via Resolver for', networkId);
        _rpc = new sdk.RpcClient({ resolver: new sdk.Resolver(), networkId: networkId });
      } else {
        console.error('[HTPRpc] No RpcClient or Resolver available');
        scheduleRetry();
        return;
      }
    } catch (e) {
      console.error('[HTPRpc] RpcClient construction failed:', e);
      scheduleRetry();
      return;
    }

    _rpc.addEventListener('connect', async function () {
      _connected   = true;
      _retryCount  = 0;
      if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
      console.log('[HTPRpc] Connected →', _rpc.url || ('Resolver/' + networkId), '(', networkId, ')');
      window.dispatchEvent(new CustomEvent('htp:rpc:connected', { detail: { url: _rpc.url, networkId: networkId } }));

      try { await _rpc.subscribeVirtualDaaScoreChanged(); } catch (e) {}

      if (_trackedAddress) {
        try { await startUtxoTracking(sdk, _trackedAddress); } catch (e) {}
      }
    });

    _rpc.addEventListener('disconnect', function () {
      _connected = false;
      console.warn('[HTPRpc] Disconnected');
      window.dispatchEvent(new Event('htp:rpc:disconnected'));
      scheduleRetry();
    });

    _rpc.addEventListener('virtual-daa-score-changed', function (e) {
      _daaScore         = BigInt(e.data.virtualDaaScore);
      window.htpDaaScore = _daaScore;
      fireDaaWaiters();
    });

    try {
      await _rpc.connect();
    } catch (err) {
      console.error('[HTPRpc] Connect failed:', err.message || err);
      scheduleRetry();
    }
  }

  function scheduleRetry() {
    if (_retryTimer) return;
    var delay = backoffMs();
    _retryCount++;
    console.log('[HTPRpc] Retry #' + _retryCount + ' in ' + Math.round(delay / 1000) + 's');
    _retryTimer = setTimeout(function () {
      _retryTimer = null;
      if (_rpc) {
        try { _rpc.connect().catch(function () { scheduleRetry(); }); } catch (e) { scheduleRetry(); }
      } else {
        initRpc();
      }
    }, delay);
  }

  /* ══ Public API  (window.htpRpc) ═════════════════════════════════════════════════════ */
  window.htpRpc = {

    get isConnected()  { return _connected; },
    get daaScore()     { return _daaScore; },
    get networkId()    { return window.HTP_NETWORK_ID || 'testnet-12'; },
    get rpc()          { return _rpc; },
    get utxoContext()  { return _utxoContext; },

    async getUtxos(address) {
      if (!_rpc || !_connected) throw new Error('[HTPRpc] Not connected');
      var res = await _rpc.getUtxosByAddresses({ addresses: [address] });
      return res.entries || [];
    },

    async getBalance(address) {
      var entries = await this.getUtxos(address);
      return entries.reduce(function (sum, e) {
        return sum + BigInt(e.utxoEntry.amount);
      }, 0n);
    },

    async submitTransaction(tx) {
      if (!_rpc || !_connected) throw new Error('[HTPRpc] Not connected');
      var res = await _rpc.submitTransaction({ transaction: tx, allowOrphan: false });
      var txId = res.transactionId || res.txId || res;
      console.log('[HTPRpc] TX submitted:', txId);
      window.dispatchEvent(new CustomEvent('htp:tx:submitted', { detail: { txId: txId } }));
      return txId;
    },

    async trackAddress(address) {
      _trackedAddress = address;
      if (!_connected) return;
      var sdk = await waitForWasm();
      if (sdk) await startUtxoTracking(sdk, address);
    },

    onBalance: function (cb) {
      _balanceCbs.add(cb);
      return function () { _balanceCbs.delete(cb); };
    },

    waitForDaaScore: function (targetDaa) {
      var target = BigInt(targetDaa);
      if (_daaScore >= target) return Promise.resolve(_daaScore);
      return new Promise(function (resolve) {
        _daaWaiters.push({ target: target, resolve: resolve });
      });
    },

    daaScoreAfter: function (secondsFromNow) {
      return _daaScore + BigInt(Math.ceil(secondsFromNow * 10));
    },

    sompiToKas: sompiToKas,

    async reconnectTo(url, networkId) {
      if (_rpc) {
        try { await _rpc.disconnect(); } catch (e) {}
        _rpc = null;
      }
      _connected = false;
      if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
      _retryCount = 0;
      window.HTP_RPC_URL    = url;
      window.HTP_NETWORK_ID = networkId;
      await initRpc();
    },
  };

  window.HTPRpc      = window.htpRpc;
  window.htpDaaScore = 0n;
  window.htpBalance  = 0;

  /* ══ Bootstrap ═════════════════════════════════════════════════════════════════════ */
  if (window.whenWasmReady) {
    window.whenWasmReady(initRpc);
  } else {
    window.addEventListener('htp:wasm:ready', function () { initRpc(); }, { once: true });
  }

  window.addEventListener('htp:wallet:connected', function (e) {
    var address = e.detail && e.detail.address;
    if (address && window.htpRpc && window.htpRpc.trackAddress) {
      window.htpRpc.trackAddress(address);
    }
  });

  console.log('[HTPRpc] v3.1 loaded | HTP_USE_RESOLVER:', window.HTP_USE_RESOLVER, '| waiting for WASM...');

})(window);
