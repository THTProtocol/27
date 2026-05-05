// Maximizer config
var maximizerLimit=0,expectedVolume=0,maximizerEnabled=false;

// =============================================================================
// htp-event-creator.js – Prediction Market Event Creation
// Validates form, constructs escrow TX, writes to Firebase /markets/{marketId}
// =============================================================================
(function(W) {
  'use strict';

  function generateId() {
    return 'MKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  function getConnectedAddress() {
    return W.walletAddress || W.htpAddress || W.htpConnectedAddress || null;
  }

  function isValidUrl(str) {
    try { var u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (e) { return false; }
  }

  function validate() {
    var errors = [];
    var title  = document.getElementById('event-title');
    var desc   = document.getElementById('event-description');
    var date   = document.getElementById('event-resolution-date');
    var url    = document.getElementById('event-source-url');

    if (!title || !title.value.trim()) errors.push('Event title is required');
    if (!desc  || !desc.value.trim())  errors.push('Description is required');

    if (!date || !date.value) {
      errors.push('Resolution date is required');
    } else {
      if (new Date(date.value) <= new Date()) errors.push('Resolution date must be in the future');
    }

    if (!url || !url.value.trim()) {
      errors.push('Source URL is required');
    } else if (!isValidUrl(url.value.trim())) {
      errors.push('Source URL must be a valid URL');
    }

    var outcomes = [];
    document.querySelectorAll('.outcome-input').forEach(function(inp) {
      if (inp.value.trim()) outcomes.push(inp.value.trim());
    });
    if (outcomes.length < 2) errors.push('At least 2 outcomes are required');

    return { errors: errors, outcomes: outcomes };
  }

  function showErrors(errors) {
    if (W.showToast) errors.forEach(function(e) { W.showToast(e, 'error'); });
    else alert(errors.join('\n'));
  }

  W.createPredictionEvent = function() {
    var addr = getConnectedAddress();
    if (!addr) {
      if (W.openWalletModal) W.openWalletModal();
      else if (W.showToast) W.showToast('Connect wallet first', 'error');
      return;
    }

    var result = validate();
    if (result.errors.length > 0) { showErrors(result.errors); return; }

    var title    = document.getElementById('event-title').value.trim();
    var desc     = document.getElementById('event-description').value.trim();
    var dateVal  = document.getElementById('event-resolution-date').value;
    var url      = document.getElementById('event-source-url').value.trim();
    var minPos   = parseFloat(document.getElementById('event-min-position').value) || 1;
    var maxPEl   = document.getElementById('event-max-participants');
    var maxP     = maxPEl && maxPEl.value ? parseInt(maxPEl.value) : null;
    var timestamp = Math.floor(new Date(dateVal).getTime() / 1000);
    var marketId  = generateId();

    // — Read category from form (select or data-* attribute fallback) —
    var catEl = document.getElementById('event-category') ||
                document.querySelector('select[name="category"]') ||
                document.querySelector('[data-field="category"]');
    var category = (catEl && catEl.value) ? catEl.value.trim() : 'Other';

    var market = {
      marketId:        marketId,
      title:           title,
      description:     desc,
      category:        category,          // ← now saved
      outcomes:        result.outcomes,
      resolutionDate:  timestamp,
      sourceUrl:       url,
      minPosition:     minPos,
      maxParticipants: maxP,
      creatorAddress:  addr,
      status:          'active',
      totalPool:       0,
      positions:       {},
      createdAt:       null
    };

    if (W.showToast) W.showToast('Creating prediction market…', 'info');

    var db = W.firebase && W.firebase.database ? W.firebase.database() : null;
    if (!db) {
      console.warn('[HTP EventCreator] Firebase not available');
      W.dispatchEvent(new CustomEvent('htp:market:created', { detail: market }));
      if (W.showToast) W.showToast('Market created locally (no Firebase)', 'warning');
      return;
    }

    market.createdAt = W.firebase.database.ServerValue.TIMESTAMP;

    db.ref('markets/' + marketId).set(market).then(function() {
      console.log('[HTP EventCreator] Market created:', marketId, 'category:', category);
      if (W.showToast) W.showToast('Market created: ' + title, 'success');
      W.dispatchEvent(new CustomEvent('htp:market:created', { detail: market }));

      // Clear form
      ['event-title','event-description','event-resolution-date','event-source-url','event-min-position'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (maxPEl) maxPEl.value = '';
      if (catEl)  catEl.value = 'Other';

      if (W.updateCharCounter) {
        W.updateCharCounter('event-title', 120);
        W.updateCharCounter('event-description', 1000);
      }
      if (W.compileSilverScript) W.compileSilverScript();
    }).catch(function(err) {
      console.error('[HTP EventCreator] Firebase error:', err);
      if (W.showToast) W.showToast('Failed to create market: ' + err.message, 'error');
    });
  };

  console.log('[HTP EventCreator] loaded (with category support)');
})(window);