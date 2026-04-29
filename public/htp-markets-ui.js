// =============================================================================
// htp-markets-ui.js  –  Dynamic Category Slider + Improved Market Cards
// Replaces static filter pills with a live-data-driven horizontal slider.
// Drop this file after htp-events-v3.js in index.html
// =============================================================================
(function(W) {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  var allMarkets  = [];
  var activeFilter = 'all';  // 'all' | category string | 'open'|'pending'|'closed'|'cancelled'
  var activeStatus = 'all';
  var searchQuery  = '';

  // ─── Category metadata (icon + colour) ────────────────────────────────────
  var CAT_META = {
    'Macro':    { icon: '🌐', color: '#6366f1' },
    'Crypto':   { icon: '₿',  color: '#f59e0b' },
    'Politics': { icon: '🏛️', color: '#ef4444' },
    'Sports':   { icon: '⚽', color: '#10b981' },
    'Kaspa':    { icon: '◈',  color: '#49e8c2' },
    'Skill':    { icon: '🎯', color: '#8b5cf6' },
    'Tech':     { icon: '💻', color: '#3b82f6' },
    'Finance':  { icon: '📈', color: '#f97316' },
    'Gaming':   { icon: '🎮', color: '#ec4899' },
    'Other':    { icon: '📌', color: '#94a3b8' },
  };

  // ─── Inject CSS ───────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('htp-markets-ui-css')) return;
    var style = document.createElement('style');
    style.id = 'htp-markets-ui-css';
    style.textContent = [
      /* ── Wrapper ── */
      '.htp-markets-wrap { padding: 0 0 40px; }',

      /* ── Category slider ── */
      '.htp-cat-slider-wrap {',
      '  position: relative;',
      '  margin: 0 0 20px;',
      '}',
      '.htp-cat-slider {',
      '  display: flex;',
      '  gap: 8px;',
      '  overflow-x: auto;',
      '  scroll-behavior: smooth;',
      '  padding: 4px 2px 10px;',
      '  scrollbar-width: none;',
      '  -ms-overflow-style: none;',
      '}',
      '.htp-cat-slider::-webkit-scrollbar { display: none; }',
      '.htp-cat-pill {',
      '  flex-shrink: 0;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 6px 14px;',
      '  border-radius: 20px;',
      '  border: 1px solid rgba(73,232,194,.18);',
      '  background: rgba(73,232,194,.04);',
      '  color: #94a3b8;',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  cursor: pointer;',
      '  transition: all .18s;',
      '  white-space: nowrap;',
      '  user-select: none;',
      '}',
      '.htp-cat-pill:hover { background: rgba(73,232,194,.10); color: #cbd5e1; }',
      '.htp-cat-pill.active {',
      '  background: rgba(73,232,194,.15);',
      '  border-color: #49e8c2;',
      '  color: #49e8c2;',
      '  box-shadow: 0 0 12px rgba(73,232,194,.18);',
      '}',
      '.htp-cat-pill .pill-count {',
      '  font-size: 10px;',
      '  font-weight: 800;',
      '  padding: 1px 5px;',
      '  border-radius: 8px;',
      '  background: rgba(73,232,194,.12);',
      '  color: #49e8c2;',
      '  min-width: 16px;',
      '  text-align: center;',
      '}',
      '.htp-cat-pill.active .pill-count { background: rgba(73,232,194,.25); }',

      /* fade edges */
      '.htp-cat-slider-wrap::after {',
      '  content: \'\';',
      '  position: absolute;',
      '  right: 0; top: 0; bottom: 10px;',
      '  width: 48px;',
      '  background: linear-gradient(to right, transparent, rgba(6,10,18,.95));',
      '  pointer-events: none;',
      '}',

      /* ── Toolbar row (search + sort) ── */
      '.htp-mkt-toolbar {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  margin-bottom: 18px;',
      '  flex-wrap: wrap;',
      '}',
      '.htp-mkt-search {',
      '  flex: 1;',
      '  min-width: 180px;',
      '  padding: 9px 14px 9px 36px;',
      '  background: rgba(10,15,30,.8);',
      '  border: 1px solid rgba(73,232,194,.14);',
      '  border-radius: 10px;',
      '  color: #e2e8f0;',
      '  font-size: 13px;',
      '  font-family: inherit;',
      '  outline: none;',
      '  transition: border-color .18s;',
      '  background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'m21 21-4.35-4.35\'/%3E%3C/svg%3E");',
      '  background-repeat: no-repeat;',
      '  background-position: 12px center;',
      '}',
      '.htp-mkt-search:focus { border-color: rgba(73,232,194,.4); }',
      '.htp-mkt-search::placeholder { color: #475569; }',
      '.htp-mkt-sort {',
      '  padding: 9px 12px;',
      '  background: rgba(10,15,30,.8);',
      '  border: 1px solid rgba(73,232,194,.14);',
      '  border-radius: 10px;',
      '  color: #94a3b8;',
      '  font-size: 12px;',
      '  font-family: inherit;',
      '  cursor: pointer;',
      '  outline: none;',
      '}',

      /* ── Market cards grid ── */
      '.htp-markets-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));',
      '  gap: 16px;',
      '}',

      /* ── Market card ── */
      '.htp-mkt-card {',
      '  background: rgba(10,15,30,.85);',
      '  border: 1px solid rgba(73,232,194,.1);',
      '  border-radius: 16px;',
      '  overflow: hidden;',
      '  transition: border-color .2s, transform .2s, box-shadow .2s;',
      '  cursor: pointer;',
      '}',
      '.htp-mkt-card:hover {',
      '  border-color: rgba(73,232,194,.35);',
      '  transform: translateY(-2px);',
      '  box-shadow: 0 8px 32px rgba(73,232,194,.08);',
      '}',
      '.htp-mkt-card.expanded { border-color: #49e8c2; cursor: default; }',

      /* card top accent bar */
      '.htp-mkt-card-bar {',
      '  height: 3px;',
      '  background: linear-gradient(90deg, #49e8c2, #6366f1);',
      '}',

      /* card header */
      '.htp-mkt-card-head {',
      '  padding: 14px 16px 10px;',
      '}',
      '.htp-mkt-card-top {',
      '  display: flex;',
      '  align-items: flex-start;',
      '  justify-content: space-between;',
      '  gap: 10px;',
      '  margin-bottom: 8px;',
      '}',
      '.htp-mkt-title {',
      '  font-size: 14px;',
      '  font-weight: 800;',
      '  color: #f1f5f9;',
      '  line-height: 1.4;',
      '  flex: 1;',
      '}',
      '.htp-mkt-cat-badge {',
      '  flex-shrink: 0;',
      '  font-size: 10px;',
      '  font-weight: 800;',
      '  padding: 3px 9px;',
      '  border-radius: 20px;',
      '  letter-spacing: .04em;',
      '}',
      '.htp-mkt-status-badge {',
      '  flex-shrink: 0;',
      '  font-size: 9px;',
      '  font-weight: 800;',
      '  padding: 2px 7px;',
      '  border-radius: 10px;',
      '  text-transform: uppercase;',
      '  letter-spacing: .06em;',
      '}',
      '.htp-mkt-status-badge.open   { background:rgba(73,232,194,.1); color:#49e8c2; border:1px solid rgba(73,232,194,.25); }',
      '.htp-mkt-status-badge.pending{ background:rgba(245,158,11,.1); color:#f59e0b; border:1px solid rgba(245,158,11,.25); }',
      '.htp-mkt-status-badge.closed { background:rgba(100,116,139,.1);color:#64748b; border:1px solid rgba(100,116,139,.2); }',
      '.htp-mkt-status-badge.cancelled{background:rgba(239,68,68,.1); color:#ef4444; border:1px solid rgba(239,68,68,.2); }',

      /* meta row */
      '.htp-mkt-meta {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 8px;',
      '  margin-bottom: 12px;',
      '}',
      '.htp-mkt-meta-item {',
      '  font-size: 11px;',
      '  color: #64748b;',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '}',
      '.htp-mkt-meta-item svg { opacity: .6; }',

      /* pool bar */
      '.htp-mkt-pool-row {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  margin-bottom: 8px;',
      '}',
      '.htp-mkt-pool-val {',
      '  font-size: 20px;',
      '  font-weight: 900;',
      '  color: #49e8c2;',
      '  font-variant-numeric: tabular-nums;',
      '}',
      '.htp-mkt-pool-lbl { font-size: 10px; color: #475569; margin-top: 1px; }',
      '.htp-mkt-outcomes-preview {',
      '  display: flex;',
      '  gap: 6px;',
      '  flex-wrap: wrap;',
      '  margin-bottom: 4px;',
      '}',
      '.htp-mkt-outcome-chip {',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  padding: 3px 9px;',
      '  border-radius: 8px;',
      '  background: rgba(99,102,241,.08);',
      '  border: 1px solid rgba(99,102,241,.2);',
      '  color: #a5b4fc;',
      '}',

      /* expanded body */
      '.htp-mkt-body {',
      '  padding: 0 16px 16px;',
      '  border-top: 1px solid rgba(73,232,194,.08);',
      '  margin-top: 4px;',
      '  padding-top: 14px;',
      '}',
      '.htp-mkt-desc {',
      '  font-size: 12px;',
      '  color: #94a3b8;',
      '  line-height: 1.6;',
      '  margin-bottom: 14px;',
      '}',
      '.htp-outcome-row {',
      '  margin-bottom: 10px;',
      '}',
      '.htp-outcome-label {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  font-size: 12px;',
      '  margin-bottom: 4px;',
      '}',
      '.htp-outcome-name { font-weight: 700; color: #cbd5e1; }',
      '.htp-outcome-odds { font-weight: 800; color: #49e8c2; }',
      '.htp-outcome-track {',
      '  height: 6px;',
      '  background: rgba(255,255,255,.05);',
      '  border-radius: 4px;',
      '  overflow: hidden;',
      '  margin-bottom: 6px;',
      '}',
      '.htp-outcome-fill {',
      '  height: 100%;',
      '  background: linear-gradient(90deg,#49e8c2,#6366f1);',
      '  border-radius: 4px;',
      '  transition: width .4s ease;',
      '}',
      '.htp-bet-row {',
      '  display: flex;',
      '  gap: 6px;',
      '  margin-top: 4px;',
      '}',
      '.htp-bet-input {',
      '  flex: 1;',
      '  padding: 7px 10px;',
      '  background: rgba(6,10,18,.9);',
      '  border: 1px solid rgba(73,232,194,.15);',
      '  border-radius: 8px;',
      '  color: #e2e8f0;',
      '  font-size: 12px;',
      '  font-family: inherit;',
      '  outline: none;',
      '}',
      '.htp-bet-input:focus { border-color: rgba(73,232,194,.4); }',
      '.htp-bet-btn {',
      '  padding: 7px 14px;',
      '  background: linear-gradient(135deg,rgba(73,232,194,.15),rgba(99,102,241,.1));',
      '  border: 1px solid rgba(73,232,194,.3);',
      '  border-radius: 8px;',
      '  color: #49e8c2;',
      '  font-size: 12px;',
      '  font-weight: 800;',
      '  cursor: pointer;',
      '  transition: all .15s;',
      '  white-space: nowrap;',
      '}',
      '.htp-bet-btn:hover { background: rgba(73,232,194,.2); }',
      '.htp-mkt-footer {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  margin-top: 14px;',
      '  padding-top: 12px;',
      '  border-top: 1px solid rgba(73,232,194,.07);',
      '  font-size: 11px;',
      '  color: #475569;',
      '}',
      '.htp-mkt-footer a { color: #49e8c2; text-decoration: none; word-break: break-all; font-size: 10px; }',

      /* empty state */
      '.htp-mkt-empty {',
      '  grid-column: 1/-1;',
      '  text-align: center;',
      '  padding: 60px 20px;',
      '  color: #475569;',
      '}',
      '.htp-mkt-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: .5; }',
      '.htp-mkt-empty-title { font-size: 15px; font-weight: 800; color: #64748b; margin-bottom: 6px; }',
      '.htp-mkt-empty-sub { font-size: 12px; }',

      /* results count */
      '.htp-mkt-count { font-size: 11px; color: #475569; margin-bottom: 12px; }',
      '.htp-mkt-count strong { color: #49e8c2; }',

      '@media(max-width:600px){',
      '  .htp-markets-grid { grid-template-columns: 1fr; }',
      '  .htp-mkt-pool-val { font-size: 16px; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function timeUntil(ts) {
    if (!ts) return '--';
    var t = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts;
    var diff = t - Date.now();
    if (diff <= 0) return 'Expired';
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    return d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + Math.floor((diff % 3600000) / 60000) + 'm';
  }

  function truncate(addr) {
    if (!addr || addr.length < 16) return addr || '--';
    return addr.slice(0, 10) + '…' + addr.slice(-6);
  }

  function getCatMeta(cat) {
    return CAT_META[cat] || CAT_META['Other'];
  }

  // ─── Build dynamic category list from current markets ────────────────────
  function buildCategoryList(markets) {
    var counts = {};
    counts['all'] = markets.length;
    markets.forEach(function(m) {
      var c = (m.category || 'Other').trim();
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }

  // ─── Render slider ────────────────────────────────────────────────────────
  function renderSlider(markets) {
    var wrap = document.getElementById('htp-cat-slider');
    if (!wrap) return;
    var counts = buildCategoryList(markets);

    var pills = [];
    // "Show All" first
    pills.push(makePill('all', '✦', 'Show All', counts['all'], activeFilter === 'all'));
    // Then every category found in data, sorted by count desc
    Object.keys(counts).filter(function(k) { return k !== 'all'; }).sort(function(a, b) {
      return counts[b] - counts[a];
    }).forEach(function(cat) {
      var meta = getCatMeta(cat);
      pills.push(makePill(cat, meta.icon, cat, counts[cat], activeFilter === cat));
    });

    wrap.innerHTML = pills.join('');
  }

  function makePill(key, icon, label, count, isActive) {
    return '<button class="htp-cat-pill' + (isActive ? ' active' : '') + '" onclick="htpMktFilter(\'' + key + '\')">' +
      '<span>' + icon + '</span>' +
      '<span>' + label + '</span>' +
      '<span class="pill-count">' + (count || 0) + '</span>' +
      '</button>';
  }

  // ─── Filter logic ─────────────────────────────────────────────────────────
  function applyFilter(markets) {
    return markets.filter(function(m) {
      // category filter
      if (activeFilter !== 'all') {
        var cat = (m.category || 'Other').trim();
        if (cat !== activeFilter) return false;
      }
      // search
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        var title = (m.title || '').toLowerCase();
        var desc  = (m.description || '').toLowerCase();
        if (title.indexOf(q) === -1 && desc.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // ─── Render market cards ──────────────────────────────────────────────────
  var expandedId = null;

  function renderCards(markets) {
    var grid = document.getElementById('htp-markets-grid');
    var countEl = document.getElementById('htp-mkt-count');
    if (!grid) return;

    var filtered = applyFilter(markets);
    if (countEl) {
      countEl.innerHTML = 'Showing <strong>' + filtered.length + '</strong> of <strong>' + markets.length + '</strong> markets';
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="htp-mkt-empty"><div class="htp-mkt-empty-icon">📭</div>' +
        '<div class="htp-mkt-empty-title">No markets found</div>' +
        '<div class="htp-mkt-empty-sub">Try a different category or clear your search</div></div>';
      return;
    }

    grid.innerHTML = filtered.map(function(m) { return buildCard(m); }).join('');
  }

  function buildCard(m) {
    var id      = m.marketId || m.id || '';
    var cat     = m.category || 'Other';
    var meta    = getCatMeta(cat);
    var status  = m.status || 'active';
    var statusLabel = status === 'active' ? 'open' : status;
    var isExp   = expandedId === id;
    var pool    = (m.totalPool || 0).toFixed(2);
    var outcomes = m.outcomes || [];

    // accent bar colour based on category
    var barColor = meta.color;

    var html = '<div class="htp-mkt-card' + (isExp ? ' expanded' : '') + '" data-market-id="' + id + '">';
    html += '<div class="htp-mkt-card-bar" style="background:linear-gradient(90deg,' + barColor + ',#6366f1)"></div>';

    // clickable header
    html += '<div class="htp-mkt-card-head" onclick="htpMktToggle(\'' + id + '\')">';
    html += '<div class="htp-mkt-card-top">';
    html += '<div class="htp-mkt-title">' + (m.title || 'Untitled') + '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">';
    html += '<span class="htp-mkt-cat-badge" style="background:' + barColor + '22;color:' + barColor + ';border:1px solid ' + barColor + '44">' + meta.icon + ' ' + cat + '</span>';
    html += '<span class="htp-mkt-status-badge ' + statusLabel + '">' + statusLabel + '</span>';
    html += '</div>';
    html += '</div>'; // card-top

    // meta row
    html += '<div class="htp-mkt-meta">';
    html += metaItem('<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>', truncate(m.creatorAddress));
    html += metaItem('<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>', timeUntil(m.resolutionDate));
    html += metaItem('<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-8 0v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>', (Object.keys(m.positions || {}).length) + ' bettors');
    html += '</div>';

    // pool + outcomes preview
    html += '<div class="htp-mkt-pool-row">';
    html += '<div><div class="htp-mkt-pool-val">' + pool + '</div><div class="htp-mkt-pool-lbl">KAS pool</div></div>';
    html += '<div class="htp-mkt-outcomes-preview">';
    outcomes.slice(0, 3).forEach(function(o) {
      html += '<span class="htp-mkt-outcome-chip">' + o + '</span>';
    });
    if (outcomes.length > 3) html += '<span class="htp-mkt-outcome-chip">+' + (outcomes.length - 3) + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>'; // card-head

    // expanded body
    if (isExp) {
      html += buildExpandedBody(m);
    }

    html += '</div>'; // card
    return html;
  }

  function metaItem(icon, text) {
    return '<span class="htp-mkt-meta-item">' + icon + text + '</span>';
  }

  function buildExpandedBody(m) {
    var id = m.marketId || m.id || '';
    var outcomes = m.outcomes || [];
    var totalPos = 0;
    var counts = [];
    outcomes.forEach(function(_, idx) {
      var c = 0;
      if (m.positions) {
        Object.keys(m.positions).forEach(function(k) {
          var p = m.positions[k];
          if (p && p.outcomeIndex === idx) c += (p.size || 0);
        });
      }
      counts.push(c);
      totalPos += c;
    });

    var html = '<div class="htp-mkt-body">';
    if (m.description) html += '<p class="htp-mkt-desc">' + m.description + '</p>';

    outcomes.forEach(function(o, idx) {
      var odds = totalPos > 0 ? ((counts[idx] / totalPos) * 100).toFixed(1) : (100 / outcomes.length).toFixed(1);
      html += '<div class="htp-outcome-row">';
      html += '<div class="htp-outcome-label"><span class="htp-outcome-name">' + o + '</span><span class="htp-outcome-odds">' + odds + '%</span></div>';
      html += '<div class="htp-outcome-track"><div class="htp-outcome-fill" style="width:' + odds + '%"></div></div>';
      html += '<div class="htp-bet-row">';
      html += '<input type="number" class="htp-bet-input" placeholder="KAS amount" min="' + (m.minPosition || 1) + '" data-outcome-idx="' + idx + '" data-market-id="' + id + '">';
      html += '<button class="htp-bet-btn" onclick="event.stopPropagation();window.htpPlaceBet(\'' + id + '\', ' + idx + ')">Bet ' + o + '</button>';
      html += '</div>';
      html += '</div>';
    });

    html += '<div class="htp-mkt-footer">';
    html += '<span>Min: ' + (m.minPosition || 1) + ' KAS</span>';
    if (m.sourceUrl) html += '<a href="' + m.sourceUrl + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Source ↗</a>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  W.htpMktFilter = function(cat) {
    activeFilter = cat;
    renderSlider(allMarkets);
    renderCards(allMarkets);
    // scroll slider pill into view
    var pill = document.querySelector('.htp-cat-pill.active');
    if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  W.htpMktSearch = function(q) {
    searchQuery = q;
    renderCards(allMarkets);
  };

  W.htpMktToggle = function(marketId) {
    expandedId = expandedId === marketId ? null : marketId;
    renderCards(allMarkets);
    // scroll card into view
    if (expandedId) {
      setTimeout(function() {
        var card = document.querySelector('.htp-mkt-card.expanded');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // also keep old toggle working
  W.htpToggleMarket = W.htpMktToggle;

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  function upgradeMarketsSection() {
    // Find the markets container in the DOM
    var container = document.getElementById('active-markets') ||
                    document.getElementById('markets-container') ||
                    document.querySelector('[data-section="markets"] .section-content');
    if (!container) return;

    // Replace with upgraded structure
    var parent = container.parentNode;
    var upgraded = document.createElement('div');
    upgraded.className = 'htp-markets-wrap';
    upgraded.innerHTML =
      '<div class="htp-cat-slider-wrap"><div class="htp-cat-slider" id="htp-cat-slider">' +
        '<button class="htp-cat-pill active" onclick="htpMktFilter(\'all\')">✦ Show All <span class="pill-count">0</span></button>' +
      '</div></div>' +
      '<div class="htp-mkt-toolbar">' +
        '<input class="htp-mkt-search" id="htp-mkt-search" type="search" placeholder="Search markets…" oninput="htpMktSearch(this.value)">' +
        '<select class="htp-mkt-sort" id="htp-mkt-sort" onchange="htpMktSort(this.value)">' +
          '<option value="newest">Newest</option>' +
          '<option value="pool">Highest Pool</option>' +
          '<option value="expiry">Expiring Soon</option>' +
        '</select>' +
      '</div>' +
      '<div class="htp-mkt-count" id="htp-mkt-count"></div>' +
      '<div class="htp-markets-grid" id="htp-markets-grid">' +
        '<div class="htp-mkt-empty"><div class="htp-mkt-empty-icon">⏳</div>' +
        '<div class="htp-mkt-empty-title">Loading markets…</div></div>' +
      '</div>';

    parent.replaceChild(upgraded, container);
    // keep old id so other scripts can still find it
    upgraded.id = 'active-markets';
  }

  // Sort
  W.htpMktSort = function(mode) {
    if (mode === 'pool') {
      allMarkets.sort(function(a, b) { return (b.totalPool || 0) - (a.totalPool || 0); });
    } else if (mode === 'expiry') {
      allMarkets.sort(function(a, b) { return (a.resolutionDate || 0) - (b.resolutionDate || 0); });
    } else {
      allMarkets.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    }
    renderCards(allMarkets);
  };

  // Called by htp-events-v3.js (we override renderMarkets)
  W.htpMarketsUIUpdate = function(markets) {
    allMarkets = markets || [];
    renderSlider(allMarkets);
    renderCards(allMarkets);
  };

  function init() {
    injectCSS();
    upgradeMarketsSection();

    // Hook into Firebase directly to keep slider + cards live
    function connectFirebase() {
      var db = W.firebase && W.firebase.database ? W.firebase.database() : null;
      if (!db) return;
      db.ref('markets').on('value', function(snap) {
        var markets = [];
        if (snap.exists()) {
          snap.forEach(function(child) {
            var m = child.val();
            if (m) { m.marketId = m.marketId || child.key; markets.push(m); }
          });
        }
        markets.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        allMarkets = markets;
        renderSlider(allMarkets);
        renderCards(allMarkets);
      });
    }

    if (W.firebase && W.firebase.apps && W.firebase.apps.length) {
      connectFirebase();
    } else {
      W.addEventListener('htp:firebase:ready', connectFirebase);
      setTimeout(function() {
        if (W.firebase && W.firebase.apps && W.firebase.apps.length) connectFirebase();
      }, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
