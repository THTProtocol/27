/**
 * htp-init-rpc-patch.js — Wires HTPRpc + HTPDeadline into HTP init flow.
 *
 * This is a DROP-IN PATCH for htp-init.js.
 * It hooks into the existing wallet-connect flow and:
 *   1. Starts live RPC balance tracking via UtxoContext (replaces Firebase polling)
 *   2. Wires DAA score to the UI clock
 *   3. Exposes TN12 / mainnet network toggle via window.HTP_NETWORK
 *   4. Restores any active match deadlines from Firebase on page load
 *
 * Load order: AFTER htp-rpc-client.js, htp-match-deadline.js, BEFORE htp-events-v3.js
 *
 * INTEGRATION: Add these lines to htp-init.js after wallet address is confirmed:
 *
 *   // ── HTPRpc integration ──
 *   await HTPRpc.trackAddress(walletAddress);
 *   HTPRpc.onBalance((kas, sompi) => updateBalanceUI(kas));
 */

(function () {
  'use strict';

  // ── Network toggle ─────────────────────────────────────────────────────────
  // Set window.HTP_NETWORK = 'testnet-12' before loading scripts to switch to TN12.
  // Defaults to 'mainnet'. Can also be driven by URL param: ?network=testnet-12
  (function applyNetworkFromURL() {
    const params = new URLSearchParams(window.location.search);
    const net = params.get('network');
    if (net === 'testnet-12' || net === 'mainnet') {
      window.HTP_NETWORK = net;
    }
    if (!window.HTP_NETWORK) window.HTP_NETWORK = 'testnet-12';
    console.log(`[HTP] Network: ${window.HTP_NETWORK}`);
  })();

  // ── RPC status indicator ──────────────────────────────────────────────────
  window.addEventListener('htp:rpc:connected', (e) => {
    console.log(`[HTP] RPC live → ${e.detail.url}`);
    const el = document.getElementById('htp-rpc-status');
    if (el) { el.textContent = '⬢ Chain'; el.style.color = '#4ade80'; }
  });

  window.addEventListener('htp:rpc:disconnected', () => {
    const el = document.getElementById('htp-rpc-status');
    if (el) { el.textContent = '○ Reconnecting…'; el.style.color = '#f87171'; }
  });

  // ── DAA score ticker in UI ─────────────────────────────────────────────────
  setInterval(() => {
    const el = document.getElementById('htp-daa-score');
    if (el && window.htpDaaScore) {
      el.textContent = window.htpDaaScore.toString();
    }
  }, 200);

  // ── Balance UI auto-update ─────────────────────────────────────────────────
  // Called automatically when UtxoContext fires a 'balance' event
  if (window.HTPRpc) {
    HTPRpc.onBalance((kas) => {
      const el = document.getElementById('htp-balance-display');
      if (el) el.textContent = `${kas.toFixed(4)} KAS`;
    });
  }

  // ── Wallet connect hook ───────────────────────────────────────────────────
  // Intercepts the existing connectWallet / handleWalletConnected flow.
  // Works alongside (does not replace) existing htp-init.js logic.
  window.addEventListener('htp:wallet:connected', async (e) => {
    const address = e.detail?.address;
    if (!address) return;
    console.log('[HTP] Wallet connected, starting UTXO tracking for', address);
    try {
      await HTPRpc.trackAddress(address);
    } catch(err) {
      console.error('[HTP] UTXO tracking failed:', err);
    }
  });

  // ── Restore active match deadlines from Firebase ──────────────────────────
  window.addEventListener('htp:matches:loaded', (e) => {
    const matches = e.detail?.matches || [];
    matches.forEach(m => {
      if (m.deadlineDaa && m.status === 'active') {
        HTPDeadline.restore({
          matchId: m.id,
          deadlineDaa: m.deadlineDaa,
          startDaa: m.startDaa,
          label: 'match',
        });
      }
    });
  });

  // ── Deadline expiry → trigger oracle settlement check ────────────────────
  window.addEventListener('htp:deadline:expired', (e) => {
    const { matchId } = e.detail;
    console.warn(`[HTP] Deadline expired for match ${matchId} — triggering settlement check`);
    // Notify oracle daemon via Firebase
    if (window.firebase && window.firebase.database) {
      window.firebase.database()
        .ref(`matches/${matchId}/deadlineExpired`)
        .set({ ts: Date.now(), daaScore: window.htpDaaScore?.toString() });
    }
    window.dispatchEvent(new CustomEvent('htp:settlement:check', { detail: { matchId } }));
  });

})();
