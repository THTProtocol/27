/**
 * htp-rpc-client.js — Live Kaspa RPC layer for HTP
 * Replaces Firebase-based balance polling with direct on-chain reads.
 *
 * Provides:
 *   - window.htpRpc         → live RpcClient (Resolver, auto-reconnect)
 *   - window.htpDaaScore    → current virtual DAA score (updates ~10x/sec)
 *   - window.htpUtxoContext → UtxoContext for the connected wallet address
 *   - window.htpBalance     → live balance in KAS (float, updates on chain events)
 *   - HTPRpc.getBalance(address) → one-shot balance fetch (bigint sompi)
 *   - HTPRpc.waitForDaaScore(target) → resolves when DAA score reaches target
 *   - HTPRpc.onBalance(cb)  → subscribe to balance changes
 *   - HTPRpc.networkId      → "mainnet" | "testnet-12"
 *
 * Load order requirement: AFTER wasm-bridge.js, BEFORE htp-init.js
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  // Change to "testnet-12" for TN12 testing
  const NETWORK_ID = (window.HTP_NETWORK || 'testnet-12');
  const SOMPI_PER_KAS = 100_000_000n;
  const RECONNECT_DELAY_MS = 3000;

  // ── State ─────────────────────────────────────────────────────────────────
  let rpc = null;
  let utxoProcessor = null;
  let utxoContext = null;
  let connected = false;
  let daaScore = 0n;
  let balanceSompi = 0n;
  let trackedAddress = null;
  const balanceCallbacks = new Set();
  const daaWaiters = [];   // [{target: bigint, resolve}]

  // ── Helpers ───────────────────────────────────────────────────────────────
  function sompiToKas(sompi) {
    const s = sompi.toString().padStart(9, '0');
    return parseFloat(s.slice(0, -8) + '.' + s.slice(-8));
  }

  function notifyBalance(newSompi) {
    balanceSompi = newSompi;
    window.htpBalance = sompiToKas(newSompi);
    balanceCallbacks.forEach(cb => { try { cb(window.htpBalance, newSompi); } catch(e) {} });
    // Also push to Firebase mirror (keeps legacy code working)
    if (trackedAddress && window.firebase && window.firebase.database) {
      try {
        window.firebase.database()
          .ref(`balances/${trackedAddress}`)
          .set({ kas: window.htpBalance, sompi: newSompi.toString(), ts: Date.now() });
      } catch(e) {}
    }
  }

  function fireDaaWaiters() {
    for (let i = daaWaiters.length - 1; i >= 0; i--) {
      if (daaScore >= daaWaiters[i].target) {
        daaWaiters[i].resolve(daaScore);
        daaWaiters.splice(i, 1);
      }
    }
  }

  // ── Core init ─────────────────────────────────────────────────────────────
  async function initRpc() {
    // Wait for WASM to be ready
    const kaspa = await waitForKaspaWasm();
    if (!kaspa) { console.error('[HTPRpc] WASM not available'); return; }

    const { RpcClient, Resolver, UtxoProcessor, UtxoContext } = kaspa;

    rpc = new RpcClient({
      resolver: new Resolver(),
      networkId: NETWORK_ID,
    });

    // ── Event: connected ──────────────────────────────────────────────────
    rpc.addEventListener('connect', async () => {
      connected = true;
      console.log(`[HTPRpc] Connected to ${rpc.url} (${NETWORK_ID})`);
      window.dispatchEvent(new CustomEvent('htp:rpc:connected', { detail: { url: rpc.url } }));

      // Re-subscribe every reconnect (required by SDK)
      await rpc.subscribeVirtualDaaScoreChanged();

      // If wallet already connected, re-register UTXO tracking
      if (trackedAddress) {
        await startUtxoTracking(kaspa, trackedAddress);
      }
    });

    rpc.addEventListener('disconnect', () => {
      connected = false;
      console.warn('[HTPRpc] Disconnected — will retry in', RECONNECT_DELAY_MS, 'ms');
      window.dispatchEvent(new Event('htp:rpc:disconnected'));
    });

    // ── Event: DAA score ──────────────────────────────────────────────────
    rpc.addEventListener('virtual-daa-score-changed', (e) => {
      daaScore = BigInt(e.data.virtualDaaScore);
      window.htpDaaScore = daaScore;
      fireDaaWaiters();
    });

    try {
      await rpc.connect();
    } catch (err) {
      console.error('[HTPRpc] Initial connect failed:', err);
      setTimeout(initRpc, RECONNECT_DELAY_MS);
    }
  }

  async function startUtxoTracking(kaspa, address) {
    const { UtxoProcessor, UtxoContext } = kaspa;

    // Teardown existing processor if any
    if (utxoProcessor) {
      try { await utxoProcessor.stop(); } catch(e) {}
    }

    utxoProcessor = new UtxoProcessor({ rpc, networkId: NETWORK_ID });
    utxoContext = new UtxoContext({ processor: utxoProcessor });

    utxoProcessor.addEventListener('utxo-proc-start', async () => {
      await utxoContext.trackAddresses([address]);
    });

    utxoContext.addEventListener('balance', (e) => {
      const mature = BigInt(e.data?.balance?.mature ?? 0n);
      notifyBalance(mature);
    });

    await utxoProcessor.start();
    window.htpUtxoContext = utxoContext;
  }

  // ── WASM wait ─────────────────────────────────────────────────────────────
  function waitForKaspaWasm(timeout = 10000) {
    return new Promise((resolve) => {
      if (window.kaspa && window.kaspa.RpcClient) return resolve(window.kaspa);
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.kaspa && window.kaspa.RpcClient) {
          clearInterval(iv); resolve(window.kaspa);
        } else if (Date.now() - start > timeout) {
          clearInterval(iv); resolve(null);
        }
      }, 100);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.HTPRpc = {
    get networkId() { return NETWORK_ID; },
    get isConnected() { return connected; },
    get daaScore() { return daaScore; },

    /** One-shot balance fetch — returns sompi as BigInt */
    async getBalance(address) {
      if (!rpc || !connected) throw new Error('RPC not connected');
      const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });
      return entries.reduce((sum, e) => sum + BigInt(e.utxoEntry.amount), 0n);
    },

    /** Start tracking balance for a wallet address (call after wallet connect) */
    async trackAddress(address) {
      trackedAddress = address;
      if (!connected) return;                // will auto-start on next connect event
      const kaspa = await waitForKaspaWasm();
      if (kaspa) await startUtxoTracking(kaspa, address);
    },

    /** Subscribe to balance changes. cb(kasFloat, sompi) */
    onBalance(cb) {
      balanceCallbacks.add(cb);
      return () => balanceCallbacks.delete(cb);   // returns unsubscribe fn
    },

    /**
     * Resolves when the live DAA score reaches or passes `targetDaa`.
     * Use for chain-verified match deadlines.
     * @param {bigint|number} targetDaa
     */
    waitForDaaScore(targetDaa) {
      const target = BigInt(targetDaa);
      if (daaScore >= target) return Promise.resolve(daaScore);
      return new Promise(resolve => daaWaiters.push({ target, resolve }));
    },

    /**
     * Returns a DAA score that is `secondsFromNow` in the future.
     * Kaspa ~= 10 blocks/sec, so 1 DAA ≈ 100ms.
     */
    daaScoreAfter(secondsFromNow) {
      return daaScore + BigInt(Math.ceil(secondsFromNow * 10));
    },

    sompiToKas,
    get rpc() { return rpc; },
  };

  // Expose on window for legacy code
  window.htpDaaScore = 0n;
  window.htpBalance  = 0;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRpc);
  } else {
    initRpc();
  }

})();
