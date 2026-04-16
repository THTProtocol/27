// HTP Oracle Sync v2 — unified naming
// Modes: oracle-verified | oracle-bonded | oracle-hybrid
// Firebase: oracle_proofs/<id>, attestations/<id>, oracle_bonds
(function() {
'use strict';

// 1. Refresh oracle stats from Firebase + wallet
window.refreshOracleStats = async function() {
  var addr = window.connectedAddress || window.htpAddress || window.walletAddress;
  if (!addr) return;

  try {
    var db = window.htpFirestore || (window.firebase && window.firebase.firestore ? window.firebase.firestore() : null);
    if (!db) return;

    var bondSnap = await db.collection('oracle_bonds').where('address','==',addr).get();
    var totalBond = 0, earned = 0, slashed = 0, resolved = 0, confirmed = 0;
    bondSnap.forEach(function(doc) {
      var d = doc.data();
      totalBond  += parseFloat(d.bondKas  || 0);
      earned     += parseFloat(d.earned   || 0);
      slashed    += parseFloat(d.slashed  || 0);
      resolved   += parseInt(d.resolved   || 0);
      confirmed  += parseInt(d.confirmed  || d.zkConfirmed || 0); // compat
    });

    var set = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('oMyBond',     totalBond.toFixed(0));
    set('oMyResolved', resolved);
    set('oMyEarned',   earned.toFixed(2));
    set('oMySlashed',  slashed.toFixed(2));
    set('oAccuracy',   resolved > 0 ? ((resolved - slashed) / resolved * 100).toFixed(1) + '%' : '-');
    set('oZkConf',     confirmed);
    set('odStatbond',  totalBond.toFixed(0));

  } catch(e) {
    console.warn('[HTP Oracle Sync] refreshOracleStats failed:', e.message);
  }
};

// ── Unified mode names ──────────────────────────────────────────────
// oracle-verified = on-chain proof verified (was: zkOracle / miner)
// oracle-bonded   = bond-staked reporter    (was: bondedOracle / bonded)
// oracle-hybrid   = verified + bond fallback (was: hybridOracle / hybrid)

var MODE_LABELS = {
  'oracle-verified': 'Verified',
  'oracle-bonded':   'Bonded',
  'oracle-hybrid':   'Hybrid'
};

// Backward compat: old values silently map to unified names
var MODE_ALIAS = {
  'miner':        'oracle-verified',
  'bonded':       'oracle-bonded',
  'hybrid':       'oracle-hybrid',
  'zkOracle':     'oracle-verified',
  'bondedOracle': 'oracle-bonded',
  'hybridOracle': 'oracle-hybrid'
};

function normalizeMode(mode) {
  return MODE_ALIAS[mode] || mode;
}

// 2. setOracleMode — accepts old or new mode strings
var _origSetMode = window.setOracleMode;
window.setOracleMode = function(rawMode) {
  var mode = normalizeMode(rawMode);
  if (_origSetMode) _origSetMode(mode);

  var disp = document.getElementById('oracleModeDisplay');
  if (disp) disp.textContent = MODE_LABELS[mode] || mode;

  // cOracle always stores the unified mode string
  var cOracle = document.getElementById('cOracle');
  if (cOracle) cOracle.value = mode;

  var bondAmt = document.getElementById('oBondAmt');
  if (bondAmt && mode === 'oracle-bonded') bondAmt.min = 5000;

  console.log('[HTP Oracle Sync] Mode:', mode, '(' + (MODE_LABELS[mode] || mode) + ')');
};

// 3. Attest panel — select market from queue
window.selectOracleMarket = function(eventId, outcomes) {
  var activeEl = document.getElementById('activeEventId');
  if (activeEl) { activeEl.value = eventId; activeEl.dataset.eventId = eventId; }
  window.htpActiveEvent = eventId;

  var panel = document.getElementById('attestPanel');
  if (panel) panel.style.display = '';

  var sel = document.getElementById('attestOutcome');
  if (sel && outcomes && outcomes.length) {
    sel.innerHTML = outcomes.map(function(o) {
      return '<option value="' + o + '">' + o + '</option>';
    }).join('');
  }

  var lbl = document.getElementById('attestMarket');
  if (lbl) lbl.textContent = 'Market: ' + eventId;

  console.log('[HTP Oracle Sync] Market selected:', eventId, 'outcomes:', outcomes);
};

// 4. Wire oracle queue cards
var _origRenderQueue = window.renderOracleQueue;
window.renderOracleQueue = function() {
  if (_origRenderQueue) _origRenderQueue.apply(this, arguments);
  setTimeout(function() {
    document.querySelectorAll('#oracleQueue .card, #oracleQueue [data-event-id]').forEach(function(card) {
      if (card._htpOracleWired) return;
      card._htpOracleWired = true;
      card.style.cursor = 'pointer';
      card.addEventListener('click', function() {
        var eid  = card.dataset.eventId || card.getAttribute('data-event-id');
        var outs = card.dataset.outcomes ? JSON.parse(card.dataset.outcomes) : ['Yes','No'];
        if (eid) window.selectOracleMarket(eid, outs);
      });
    });
  }, 100);
};

// 5. Auto-refresh on wallet connect
var _origOnWasmReady = window._onWasmReady;
window._onWasmReady = function() {
  if (_origOnWasmReady) _origOnWasmReady();
  setTimeout(window.refreshOracleStats, 2000);
};

document.addEventListener('click', function(e) {
  var nav = e.target.closest('[data-nav="oracle"], [onclick*="oracle"]');
  if (nav) setTimeout(window.refreshOracleStats, 300);
});

setTimeout(function() {
  if (window.connectedAddress || window.htpAddress || window.walletAddress) {
    window.refreshOracleStats();
  }
}, 3000);

console.log('[HTP Oracle Sync v2] Loaded — modes: oracle-verified / oracle-bonded / oracle-hybrid');
})();
