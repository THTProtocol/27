/**
 * HTP Featured Event Hero -- May 2026
 * Fetches real events from /api/events, renders featured hero
 * No synthetic data. No fake addresses. No filler markets.
 */
(function() {
  'use strict';
  var API = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || '';

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderFeaturedEvent(events) {
    var wrap = document.getElementById('htpFeaturedEvent');
    if (!wrap) return;

    events = Array.isArray(events) ? events : [];
    // Pick first open, non-untitled event
    var ev = null;
    for (var i = 0; i < events.length; i++) {
      if (events[i].title && events[i].title !== 'Untitled Event' && events[i].status === 'open') {
        ev = events[i]; break;
      }
    }
    if (!ev && events.length > 0 && events[0].status === 'open') ev = events[0];

    if (ev) {
      var isPrice = ev.oracle_type === 'price';
      var badgeBg = isPrice ? 'rgba(59,130,246,0.20)' : 'rgba(0,255,163,0.18)';
      var badgeClr = isPrice ? '#60a5fa' : '#00ffa3';
      var oracleLabel = isPrice ? 'Price Feed' : 'Bonded Oracle';
      var quorumM = ev.quorum_m || '?';
      var quorumN = ev.quorum_n || '?';
      var resCond = ev.resolution_condition || '';
      var resInfo = resCond
        ? ', Condition: <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:3px">' + esc(resCond) + '</code>'
        : '';

      wrap.innerHTML =
        '<div class="htp-featured-glass">' +
        '  <div class="htp-featured-left">' +
        '    <span class="htp-featured-badge" style="background:' + badgeBg + ';color:' + badgeClr + '">' + oracleLabel + '</span>' +
        '    <span class="htp-featured-badge" style="background:rgba(34,197,94,0.16);color:#22c55e;margin-left:8px">ACTIVE</span>' +
        '    <h3 class="htp-featured-title">' + esc(ev.title || 'Untitled Event') + '</h3>' +
        '    <p class="htp-featured-detail">' +
        '      Oracle: <strong>' + esc(ev.oracle_type || 'oracle') + '</strong>' +
        '      &middot; Quorum: <strong>' + quorumM + ' of ' + quorumN + '</strong>' +
        '      &middot; ID: <code style="font-size:10px">' + esc(ev.id || '???') + '</code>' +
        resInfo +
        '    </p>' +
        '    <button class="htp-featured-cta" onclick="go(\'markets\')">VIEW MARKET &rarr;</button>' +
        '  </div>' +
        '  <div class="htp-featured-right">' +
        '    <div class="htp-featured-stat"><span>' + quorumN + '</span><small>Oracles</small></div>' +
        '    <div class="htp-featured-stat"><span>' + quorumM + '</span><small>Threshold</small></div>' +
        '    <div class="htp-featured-stat"><span>OPEN</span><small>Status</small></div>' +
        '  </div>' +
        '</div>';
    } else {
      wrap.innerHTML =
        '<div class="htp-featured-glass htp-featured-empty">' +
        '  <div class="htp-featured-left">' +
        '    <span class="htp-featured-badge" style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.50)">NO ACTIVE EVENTS</span>' +
        '    <h3 class="htp-featured-title">No active events yet</h3>' +
        '    <p class="htp-featured-detail">Create a prediction event and it will appear here. All data sourced from real on-chain events via the HTP REST API. No synthetic filler.</p>' +
        '    <button class="htp-featured-cta" onclick="go(\'create\')">CREATE EVENT &rarr;</button>' +
        '  </div>' +
        '  <div class="htp-featured-right">' +
        '    <div class="htp-featured-stat"><span>&mdash;</span><small>Oracles</small></div>' +
        '    <div class="htp-featured-stat"><span>&mdash;</span><small>Threshold</small></div>' +
        '    <div class="htp-featured-stat"><span>&mdash;</span><small>Status</small></div>' +
        '  </div>' +
        '</div>';
    }
  }

  async function fetchAndRender() {
    try {
      var resp = await fetch(API + '/api/events');
      if (!resp.ok) { renderFeaturedEvent([]); return; }
      var data = await resp.json();
      renderFeaturedEvent(data.events || []);
    } catch(e) {
      console.warn('[htp-featured] /api/events fetch failed:', e.message);
      renderFeaturedEvent([]);
    }
  }

  function init() {
    if (!document.getElementById('htpFeaturedEvent')) return;
    fetchAndRender();
    setInterval(fetchAndRender, 120000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
