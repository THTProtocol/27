/**
 * htp-event-creator.js — SHIM v2.0
 *
 * Validation + market ID generation moved to Rust (markets.rs → POST /markets/create).
 * This shim calls the Rust endpoint, then writes the validated record to Firebase.
 */
(function(W) {
  'use strict';

  var BASE = W.HTP_RUST_API || 'https://htp-backend-<YOUR_CLOUD_RUN_HASH>.run.app';

  W.createPredictionEvent = async function() {
    var addr = W.walletAddress || W.htpAddress || W.htpConnectedAddress;
    if (!addr) { if (W.openWalletModal) W.openWalletModal(); return; }

    var outcomes = [];
    document.querySelectorAll('.outcome-input').forEach(function(inp) { if (inp.value.trim()) outcomes.push(inp.value.trim()); });
    var dateVal = document.getElementById('event-resolution-date');
    var ts = dateVal && dateVal.value ? Math.floor(new Date(dateVal.value).getTime() / 1000) : 0;

    try {
      var r = await fetch(BASE + '/markets/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           (document.getElementById('event-title') || {}).value || '',
          description:     (document.getElementById('event-description') || {}).value || '',
          outcomes:        outcomes,
          resolution_date: ts,
          source_url:      (document.getElementById('event-source-url') || {}).value || undefined,
          min_position:    parseFloat((document.getElementById('event-min-position') || {}).value) || 1,
          creator_address: addr
        })
      });
      if (!r.ok) { var e = await r.text(); throw new Error(e); }
      var market = await r.json();

      // Write validated record to Firebase
      var db = W.firebase && W.firebase.database ? W.firebase.database() : null;
      if (db) {
        market.createdAt = W.firebase.database.ServerValue.TIMESTAMP;
        market.totalPool = 0; market.positions = {};
        await db.ref('markets/' + market.market_id).set(market);
      }
      if (W.showToast) W.showToast('Market created: ' + market.title, 'success');
      W.dispatchEvent(new CustomEvent('htp:market:created', { detail: market }));
    } catch(err) {
      if (W.showToast) W.showToast('Failed: ' + err.message, 'error');
    }
  };

  console.log('[HTP EventCreator Shim v2.0] validation via Rust backend');
})(window);
