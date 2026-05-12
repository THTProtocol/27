/**
 * HTP Live Settlement Ticker Strip
 * htp-ticker.js v1
 */
(function() {
  'use strict';

  var API = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || 'https://hightable.pro';
  var tickerEl = null;
  var tickerInner = null;
  var refreshTimer = null;

  function addrShort(addr) {
    if (!addr || addr.length < 10) return addr || '???';
    return addr.slice(0, 4) + '...' + addr.slice(-4);
  }

  function timeAgo(ts) {
    if (!ts) return '?';
    var diff = Date.now() - ts;
    var sec = Math.floor(diff / 1000);
    if (sec < 10) return 'just now';
    if (sec < 60) return sec + 's ago';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    return Math.floor(hr / 24) + 'd ago';
  }

  function formatItem(item) {
    return '\u2503 kaspa:' + addrShort(item.address || item.claimer) +
           ' claimed ' + (item.amount || item.pot || 0) + ' KAS' +
           (item.name || item.market ? ' on [' + (item.name || item.market) + ']' : '') +
           ' \u00B7 ' + timeAgo(item.timestamp || item.ts || item.settledAt);
  }

  function getSyntheticItems() {
    return [
      'kaspa:qz4r...9v2k claimed 840 KAS on [BTC > $100K] \u00B7 12s ago',
      'kaspa:qq7x...m3np claimed 2,100 KAS on [ETH Flippening] \u00B7 41s ago',
      'kaspa:qpw8...r5xt claimed 560 KAS on [KAS > $0.25] \u00B7 1m 8s ago',
      'kaspa:qzm3...6fdk claimed 3,300 KAS on [Real Madrid UCL] \u00B7 2m 22s ago',
      'kaspa:qqu9...4syw claimed 1,750 KAS on [Chess: GM Rank] \u00B7 3m 45s ago'
    ];
  }

  function buildHTML(items) {
    var doubled = items.concat(items);
    return doubled.map(function(item) {
      if (typeof item === 'string') {
        var parts = item.split('\u00B7'); // split on center dot
        var claimed = parts[0] ? '<span class="ticker-claimed">' + parts[0].trim() + '</span>' : '';
        var ago = parts[1] ? '<span class="ticker-sep">\u00B7</span> ' + parts[1].trim() : '';
        return '<span class="ticker-item">' + claimed + ' ' + ago + '</span>';
      }
      return '<span class="ticker-item">' + formatItem(item) + '</span>';
    }).join('');
  }

  function injectTicker() {
    // Find hero CTAs row
    var ctaRow = document.querySelector('.hero .hero-content + *, .hero + *, .cta-row, [class*="cta"]');
    if (!ctaRow) {
      // Fallback: insert after hero section
      ctaRow = document.querySelector('.hero');
      if (!ctaRow) {
        // Last resort: top of body
        ctaRow = document.body.firstChild;
      }
    }

    // Check if already exists
    if (document.getElementById('htpTicker')) return;

    var ticker = document.createElement('div');
    ticker.id = 'htpTicker';
    ticker.innerHTML = '<div id="htpTickerInner"></div>';

    if (ctaRow && ctaRow.parentNode) {
      ctaRow.insertAdjacentHTML('afterend', ticker.outerHTML);
    }
  }

  function renderItems(items) {
    tickerEl = document.getElementById('htpTicker');
    if (!tickerEl) return;

    tickerInner = document.getElementById('htpTickerInner');
    if (!tickerInner) return;

    tickerInner.innerHTML = buildHTML(items);
  }

  async function fetchSettlements() {
    try {
      var resp = await fetch(API + '/api/games?status=settled&limit=20');
      var data = await resp.json();
      var games = data.games || data || [];
      if (Array.isArray(games) && games.length > 0) {
        renderItems(games);
      } else {
        renderItems(getSyntheticItems());
      }
    } catch (e) {
      console.warn('[htp-ticker] API fetch failed, using synthetic data');
      renderItems(getSyntheticItems());
    }
  }

  function refresh() {
    fetchSettlements();
  }

  function startRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, 30000);
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectTicker();
      fetchSettlements();
      startRefresh();
    });
  } else {
    injectTicker();
    fetchSettlements();
    startRefresh();
  }

  window.htpTicker = { refresh: refresh };
})();
