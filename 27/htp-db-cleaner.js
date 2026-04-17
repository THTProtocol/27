/**
 * htp-db-cleaner.js — Ghost match purge v1.0
 * Runs on every portfolio tab open.
 * Deletes Firebase /matches records where:
 *   - stake <= 0 or stake is null/missing
 *   - creator is missing
 *   - status === 'active' AND joiner is null AND createdAt older than 1 hour
 * Also filters DOM render before any ghost card is inserted.
 */
;(function(W) {
  'use strict';

  var GHOST_AGE_MS = 3600000; // 1 hour

  function fdb() {
    return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;
  }

  function isGhost(id, data) {
    if (!data) return true;
    if (!data.creator) return true;
    var stake = parseFloat(data.stake);
    if (isNaN(stake) || stake <= 0) return true;
    if (data.status === 'active' && !data.joiner) {
      var age = Date.now() - (data.createdAt || 0);
      if (age > GHOST_AGE_MS) return true;
    }
    return false;
  }

  async function cleanGhostMatches() {
    var db = fdb();
    if (!db) { console.warn('[HTP DB Cleaner] Firebase not ready'); return 0; }
    var snap = await db.ref('matches').once('value');
    var purged = 0;
    var tasks = [];
    snap.forEach(function(child) {
      if (isGhost(child.key, child.val())) {
        tasks.push(
          db.ref('matches/' + child.key).remove().then(function() {
            return db.ref('relay/' + child.key).remove();
          }).then(function() {
            purged++;
            console.log('[HTP DB Cleaner] purged ghost:', child.key);
          }).catch(function(e) {
            console.warn('[HTP DB Cleaner] failed to purge', child.key, e.message);
          })
        );
      }
    });
    await Promise.all(tasks);
    console.log('[HTP DB Cleaner] Scanned ' + snap.numChildren() + ' match(es), purged ' + purged + ' ghost(s)');
    return purged;
  }

  // Expose manual trigger
  W.htpCleanGhostMatches = cleanGhostMatches;

  // DOM render guard — patches any renderMatchCard / renderPortfolio function
  function patchPortfolioRenderer() {
    var orig = W.renderMatchCard || W.renderPortfolioMatch;
    if (!orig || orig._ghostPatched) return;
    var key = W.renderMatchCard ? 'renderMatchCard' : 'renderPortfolioMatch';
    W[key] = function(id, data) {
      if (isGhost(id, data)) {
        console.log('[HTP DB Cleaner] blocked ghost card render:', id);
        return;
      }
      return orig.call(this, id, data);
    };
    W[key]._ghostPatched = true;
  }

  // Run on load
  function init() {
    patchPortfolioRenderer();
    // Run clean after Firebase is ready
    if (fdb()) {
      cleanGhostMatches();
    } else {
      // Wait for Firebase init
      var tries = 0;
      var iv = setInterval(function() {
        tries++;
        if (fdb()) { clearInterval(iv); cleanGhostMatches(); }
        if (tries > 20) clearInterval(iv);
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run when portfolio tab is activated
  W.addEventListener('htp:tab:portfolio', cleanGhostMatches);

  console.log('[HTP DB Cleaner v1.0] loaded');
})(window);
