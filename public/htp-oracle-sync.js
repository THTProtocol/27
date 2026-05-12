// HTP Oracle Sync v1 , wires all oracle UI to live data
(function() {
'use strict';

// 1. Refresh oracle stats from Firebase + wallet
window.refreshOracleStats = async function() {
  var addr = window.connectedAddress || window.htpAddress || window.walletAddress;
  if (!addr) return;

  try {
    // Bond stats from REST API
    var r = await fetch('/api/oracle/stats/' + addr);
    if (!r.ok) return;
    var stats = await r.json();
    var totalBond = stats.totalBond || 0;
    var earned = stats.earned || 0;
    var slashed = stats.slashed || 0;
    var resolved = stats.resolved || 0;
    var zkConf = stats.zkConfirmed || 0;

    var set = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('oMyBond', totalBond.toFixed(0));
    set('oMyResolved', resolved);
    set('oMyEarned', earned.toFixed(2));
    set('oMySlashed', slashed.toFixed(2));
    set('oAccuracy', resolved > 0 ? ((resolved - slashed) / resolved * 100).toFixed(1) + '%' : '-');
    set('oZkConf', zkConf);

    // Daemon stats
    set('odStatbond', totalBond.toFixed(0));

  } catch(e) {
    console.warn('[HTP Oracle Sync] refreshOracleStats failed:', e.message);
  }
};

// 2. Patch setOracleMode to also sync display + forms
var _origSetMode = window.setOracleMode;
window.setOracleMode = function(mode) {
  if (_origSetMode) _origSetMode(mode);

  // Sync display label
  var labels = { hybrid: 'Hybrid ZK+Bond Fallback', miner: 'ZK Verified', bonded: 'Bonded' };
  var disp = document.getElementById('oracleModeDisplay');
  if (disp) disp.textContent = labels[mode] || mode;

  // Sync create form oracle field
  var cOracle = document.getElementById('cOracle');
  if (cOracle) cOracle.value = mode === 'bonded' ? 'bondedOracle' : mode === 'miner' ? 'zkOracle' : 'hybridOracle';

  // Sync bond minimum display
  var bondAmt = document.getElementById('oBondAmt');
  if (bondAmt && mode === 'bonded') bondAmt.min = 5000;

  console.log('[HTP Oracle Sync] Mode synced to all forms:', mode);
};

// 3. Populate attestOutcome when oracleQueue market is selected
window.selectOracleMarket = function(eventId, outcomes) {
  // Set active event
  var activeEl = document.getElementById('activeEventId');
  if (activeEl) { activeEl.value = eventId; activeEl.dataset.eventId = eventId; }
  window.htpActiveEvent = eventId;

  // Show attest panel
  var panel = document.getElementById('attestPanel');
  if (panel) panel.style.display = '';

  // Populate outcome dropdown
  var sel = document.getElementById('attestOutcome');
  if (sel && outcomes && outcomes.length) {
    sel.innerHTML = outcomes.map(function(o) {
      return '<option value="' + o + '">' + o + '</option>';
    }).join('');
  }

  // Set market label
  var lbl = document.getElementById('attestMarket');
  if (lbl) lbl.textContent = 'Market: ' + eventId;

  console.log('[HTP Oracle Sync] Market selected:', eventId, 'outcomes:', outcomes);
};

// 4. Wire oracle queue cards to selectOracleMarket on render
var _origRenderQueue = window.renderOracleQueue;
window.renderOracleQueue = function() {
  if (_origRenderQueue) _origRenderQueue.apply(this, arguments);
  // After render, wire click handlers
  setTimeout(function() {
    document.querySelectorAll('#oracleQueue .card, #oracleQueue [data-event-id]').forEach(function(card) {
      if (card._htpOracleWired) return;
      card._htpOracleWired = true;
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var eid = card.dataset.eventId || card.getAttribute('data-event-id');
        var outs = card.dataset.outcomes ? JSON.parse(card.dataset.outcomes) : ['Yes','No'];
        if (eid) window.selectOracleMarket(eid, outs);
      });
    });
  }, 100);
};

// 5. Auto-refresh stats on wallet connect
var _origOnWasmReady = window._onWasmReady;
window._onWasmReady = function() {
  if (_origOnWasmReady) _origOnWasmReady();
  setTimeout(window.refreshOracleStats, 2000);
};

// Also refresh on tab switch to oracle
document.addEventListener('click', function(e) {
  var nav = e.target.closest('[data-nav="oracle"], [onclick*="oracle"]');
  if (nav) setTimeout(window.refreshOracleStats, 300);
});

// Refresh on load if already connected
setTimeout(function() {
  if (window.connectedAddress || window.htpAddress || window.walletAddress) {
    window.refreshOracleStats();
  }
}, 3000);

console.log('[HTP Oracle Sync v1] Loaded , stats, mode, attestation panel wired');
})();


// ── ZK FALLBACK: Oracle attestation when narrow verify fails ───
// Called from htp-zk-pipeline.js when ZK commit times out or fails.
// Falls back to bonded oracle attestation with threshold=3.
window.htpOracleAttest = function (matchId, winner, reason) {
  console.warn('[HTP Oracle] ZK fallback triggered for ' + matchId + ' reason: ' + (reason || 'unknown'));
  
  // Write fallback attestation via REST API
  var entry = {
    matchId: matchId,
    winner: winner,
    reason: reason || 'zk-timeout',
    oracle: window.walletAddress || window.htpAddress || 'unknown',
    attestedAt: Date.now(),
    status: 'attested',
    type: 'oracle-fallback'
  };
  
  fetch('/api/attestations/' + matchId, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(entry)
  }).then(function () {
    console.log('[HTP Oracle] Fallback attestation recorded for ' + matchId);
  }).catch(function (e) {
    console.error('[HTP Oracle] Fallback attestation failed:', e.message);
  });

  // Notify UI
  if (typeof showToast === 'function') {
    showToast('Settlement: oracle attestation (ZK fallback)', 'warning');
  }
  
  return { matchId: matchId, winner: winner, status: 'oracle-attested' };
};

console.log('[HTP Oracle Sync] ZK fallback (htpOracleAttest) registered');

// ORACLE_KEY sanity check
(function(){ if(window.HTP_CONFIG&&window.HTP_CONFIG.ORACLE_KEY){console.log('[HTP Oracle] ORACLE_KEY configured');}else{console.warn('[HTP Oracle] No ORACLE_KEY set in htp-config.js — results unsigned');} })();
