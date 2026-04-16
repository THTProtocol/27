// HTP Oracle Sync v3 — accurate mode naming
// Modes: oracle-verified | oracle-bonded | oracle-hybrid
// Firebase: oracle_proofs/<id>, attestations/<id>, oracle_bonds
//
// Display names (post-Toccata accurate):
//   oracle-verified = "L1-Verified (ZK)"        — Groth16/STARK proof verified by L1 nodes
//   oracle-bonded   = "Bond-Attested"            — human attester posts bond, result is challengeable
//   oracle-hybrid   = "ZK-Primary + Bond Fallback" — ZK first, bond escalation if ZK unavailable
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
      confirmed  += parseInt(d.confirmed  || d.zkConfirmed || 0);
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

// ── Unified mode display names ──────────────────────────────────────
// Internal values never change (backward compat with Firestore docs).
// Only the human-visible labels change here.

var MODE_LABELS = {
  'oracle-verified': 'L1-Verified (ZK)',
  'oracle-bonded':   'Bond-Attested',
  'oracle-hybrid':   'ZK-Primary + Bond Fallback'
};

// Backward compat: all legacy strings map to unified internal keys
var MODE_ALIAS = {
  'miner':        'oracle-verified',
  'bonded':       'oracle-bonded',
  'hybrid':       'oracle-hybrid',
  'zk':           'oracle-verified',
  'bond':         'oracle-bonded',
  'zkOracle':     'oracle-verified',
  'bondedOracle': 'oracle-bonded',
  'hybridOracle': 'oracle-hybrid'
};

function normalizeMode(mode) {
  return MODE_ALIAS[mode] || mode;
}

// 2. setOracleMode — accepts any legacy or new mode string
window.setOracleMode = function(rawMode) {
  var mode = normalizeMode(rawMode);

  // Update all display spans
  document.querySelectorAll('#oracleModeDisplay, [id="oracleModeDisplay"]').forEach(function(el) {
    el.textContent = MODE_LABELS[mode] || mode;
  });

  // Sync both select elements to the canonical internal value
  var cOracle = document.getElementById('cOracle');
  var modeSelect = document.getElementById('oracleModeSelect');

  // Map internal oracle-* keys back to the values each select uses
  var cOracleMap = {
    'oracle-verified': 'zkOracle',
    'oracle-bonded':   'bondedOracle',
    'oracle-hybrid':   'hybridOracle'
  };
  var modeSelectMap = {
    'oracle-verified': 'zk',
    'oracle-bonded':   'bond',
    'oracle-hybrid':   'hybrid'
  };

  if (cOracle && cOracleMap[mode]) cOracle.value = cOracleMap[mode];
  if (modeSelect && modeSelectMap[mode]) modeSelect.value = modeSelectMap[mode];

  var bondAmt = document.getElementById('oBondAmt');
  if (bondAmt && mode === 'oracle-bonded') bondAmt.min = 5000;

  console.log('[HTP Oracle Sync] Mode set:', mode, '→', MODE_LABELS[mode] || mode);
};

// 3. Patch the oracleModeSelect dropdown option text on load
function patchDropdownLabels() {
  // oracleModeSelect (oracle tab selector)
  var ms = document.getElementById('oracleModeSelect');
  if (ms) {
    Array.from(ms.options).forEach(function(opt) {
      var mapped = MODE_ALIAS[opt.value] || opt.value;
      if (MODE_LABELS[mapped]) opt.text = MODE_LABELS[mapped];
    });
  }
  // cOracle (event creator selector)
  var co = document.getElementById('cOracle');
  if (co) {
    Array.from(co.options).forEach(function(opt) {
      var mapped = MODE_ALIAS[opt.value] || opt.value;
      if (MODE_LABELS[mapped]) opt.text = MODE_LABELS[mapped];
    });
  }
  // Section header — "ZK Miner Attestation Status" → "ZK Verifier Attestation Status"
  document.querySelectorAll('h3').forEach(function(h) {
    if (h.textContent.trim() === 'ZK Miner Attestation Status') {
      h.textContent = 'ZK Verifier Attestation Status';
    }
  });
  // Paragraph text containing "ZK miners"
  document.querySelectorAll('p').forEach(function(p) {
    if (p.textContent.indexOf('ZK miners') !== -1) {
      p.innerHTML = p.innerHTML.replace(/ZK miners/g, 'ZK verifiers');
    }
  });
  // oracleModeDisplay initial value
  var disp = document.getElementById('oracleModeDisplay');
  if (disp && disp.textContent === 'Hybrid ZK+Bond Fallback') {
    disp.textContent = MODE_LABELS['oracle-hybrid'];
  }
}

// 4. Patch the _OL badge map used in markets list
function patchOracleBadgeMap() {
  if (window._OL) {
    window._OL['hybridOracle'] = 'ZK-Primary + Bond Fallback';
    window._OL['zkOracle']     = 'L1-Verified (ZK)';
    window._OL['bondedOracle'] = 'Bond-Attested';
    window._OL['apiOracle']    = 'API Quorum';
  }
}

// 5. Attest panel — select market from queue
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

// 6. Wire oracle queue cards
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

// 7. Auto-refresh on wallet connect
var _origOnWasmReady = window._onWasmReady;
window._onWasmReady = function() {
  if (_origOnWasmReady) _origOnWasmReady();
  setTimeout(window.refreshOracleStats, 2000);
};

document.addEventListener('click', function(e) {
  var nav = e.target.closest('[data-nav="oracle"], [onclick*="oracle"]');
  if (nav) setTimeout(window.refreshOracleStats, 300);
});

// Run label patches after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    patchDropdownLabels();
    patchOracleBadgeMap();
  });
} else {
  patchDropdownLabels();
  patchOracleBadgeMap();
}
// Re-run after dynamic content loads
setTimeout(function() {
  patchDropdownLabels();
  patchOracleBadgeMap();
  if (window.connectedAddress || window.htpAddress || window.walletAddress) {
    window.refreshOracleStats();
  }
}, 2000);

console.log('[HTP Oracle Sync v3] Loaded — L1-Verified (ZK) / Bond-Attested / ZK-Primary + Bond Fallback');
})();
