// =============================================================================
// htp-markets-ui.js  –  Dynamic Category Slider + Premium Market Cards
// Overrides buildF() and renderM() defined in the inline <script> of index.html
// Must be loaded AFTER the main inline script block.
// =============================================================================
(function(W) {
  'use strict';

  // ---- Category metadata: icon + accent colour --------------------------------
  var CAT_META = {
    'Macro':    { icon: '🌐', col: '#0ea5e9' },
    'Crypto':   { icon: '₿',  col: '#a855f7' },
    'Politics': { icon: '🏛️', col: '#ef4444' },
    'Sports':   { icon: '⚽', col: '#f59e0b' },
    'Kaspa':    { icon: '◈',  col: '#22c55e' },
    'Skill':    { icon: '🎯', col: '#06b6d4' },
    'Tech':     { icon: '💻', col: '#3b82f6' },
    'Finance':  { icon: '📈', col: '#f97316' },
    'Gaming':   { icon: '🎮', col: '#ec4899' },
    'Other':    { icon: '📌', col: '#94a3b8' },
  };
  function catMeta(c) { return CAT_META[c] || { icon: '📌', col: '#94a3b8' }; }

  // ---- Inject CSS once -------------------------------------------------------
  function injectCSS() {
    if (document.getElementById('htp-mkt-ui-css')) return;
    var s = document.createElement('style');
    s.id = 'htp-mkt-ui-css';
    s.textContent = [
      /* === Markets section wrapper === */
      '#v-markets .sh { margin-bottom: 24px; }',
      '#v-markets .sh h2 { font-size: 28px; font-weight: 900; color: #f1f5f9; margin: 0 0 4px; }',
      '#v-markets .sh p  { font-size: 13px; color: #64748b; margin: 0; }',

      /* === Create Event button === */
      '#v-markets .cta1 {',
      '  background: linear-gradient(135deg, rgba(73,232,194,.15), rgba(99,102,241,.1));',
      '  border: 1px solid rgba(73,232,194,.35);',
      '  color: #49e8c2;',
      '  font-weight: 800;',
      '  letter-spacing: .03em;',
      '  border-radius: 10px;',
      '  transition: all .18s;',
      '}',
      '#v-markets .cta1:hover { background: rgba(73,232,194,.22); box-shadow: 0 0 18px rgba(73,232,194,.18); }',

      /* === Filter bar === */
      '.fb { margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px; }',
      '.fc { position: relative; }',

      /* === Category Slider === */
      '.htp-slider {',
      '  display: flex;',
      '  gap: 8px;',
      '  overflow-x: auto;',
      '  scroll-behavior: smooth;',
      '  padding-bottom: 6px;',
      '  scrollbar-width: none;',
      '  -ms-overflow-style: none;',
      '}',
      '.htp-slider::-webkit-scrollbar { display: none; }',

      '.htp-pill {',
      '  flex-shrink: 0;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  padding: 7px 16px;',
      '  border-radius: 99px;',
      '  border: 1px solid rgba(73,232,194,.15);',
      '  background: rgba(255,255,255,.03);',
      '  color: #64748b;',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  cursor: pointer;',
      '  transition: all .18s;',
      '  white-space: nowrap;',
      '  user-select: none;',
      '}',
      '.htp-pill:hover { background: rgba(73,232,194,.08); color: #94a3b8; transform: translateY(-1px); }',
      '.htp-pill.act {',
      '  background: rgba(73,232,194,.12);',
      '  border-color: #49e8c2;',
      '  color: #49e8c2;',
      '  box-shadow: 0 0 14px rgba(73,232,194,.15);',
      '}',
      '.htp-pill .pc {',
      '  font-size: 10px;',
      '  font-weight: 900;',
      '  padding: 0 5px;',
      '  line-height: 16px;',
      '  border-radius: 8px;',
      '  background: rgba(73,232,194,.1);',
      '  color: #49e8c2;',
      '  min-width: 18px;',
      '  text-align: center;',
      '}',
      '.htp-pill.act .pc { background: rgba(73,232,194,.2); }',

      /* right fade edge */
      '.fc::after {',
      '  content: \'\';',
      '  position: absolute;',
      '  right: 0; top: 0; bottom: 0;',
      '  width: 60px;',
      '  background: linear-gradient(to right, transparent, rgba(6,10,18,.96));',
      '  pointer-events: none;',
      '}',

      /* === Status chips + search row === */
      '.fr {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  flex-wrap: wrap;',
      '}',
      /* hide the ugly old status chips row - status is shown on cards now */
      '#stC { display: none !important; }',

      /* search input */
      '.fi {',
      '  flex: 1;',
      '  min-width: 180px;',
      '  padding: 9px 14px 9px 36px;',
      '  background: rgba(10,15,30,.8);',
      '  border: 1px solid rgba(73,232,194,.12);',
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
      '.fi:focus { border-color: rgba(73,232,194,.35); }',
      '.fi::placeholder { color: #334155; }',

      /* === Market grid === */
      '.mg {',
      '  display: grid;',
      '  grid-template-columns: repeat(auto-fill, minmax(300px,1fr));',
      '  gap: 16px;',
      '}',

      /* === Market card === */
      '.htp-mc {',
      '  background: rgba(10,15,30,.85);',
      '  border: 1px solid rgba(73,232,194,.09);',
      '  border-radius: 16px;',
      '  overflow: hidden;',
      '  cursor: pointer;',
      '  transition: border-color .2s, transform .2s, box-shadow .2s;',
      '  display: flex;',
      '  flex-direction: column;',
      '}',
      '.htp-mc:hover {',
      '  border-color: rgba(73,232,194,.32);',
      '  transform: translateY(-3px);',
      '  box-shadow: 0 10px 36px rgba(0,0,0,.35);',
      '}',

      /* accent bar */
      '.htp-mc-bar { height: 3px; }',

      /* card body */
      '.htp-mc-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }',

      /* top badges row */
      '.htp-mc-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }',
      '.htp-mc-badge {',
      '  font-size: 10px; font-weight: 800; padding: 3px 9px;',
      '  border-radius: 99px; letter-spacing: .04em;',
      '}',
      '.htp-mc-status {',
      '  font-size: 9px; font-weight: 800; padding: 3px 8px;',
      '  border-radius: 99px; text-transform: uppercase; letter-spacing: .06em;',
      '}',
      '.htp-mc-status.open     { background:rgba(34,197,94,.1);  color:#22c55e; border:1px solid rgba(34,197,94,.25); }',
      '.htp-mc-status.pending  { background:rgba(245,158,11,.1); color:#f59e0b; border:1px solid rgba(245,158,11,.25); }',
      '.htp-mc-status.closed   { background:rgba(100,116,139,.1);color:#64748b; border:1px solid rgba(100,116,139,.2); }',
      '.htp-mc-status.cancelled{ background:rgba(239,68,68,.1);  color:#ef4444; border:1px solid rgba(239,68,68,.2); }',

      /* deadline  */
      '.htp-mc-dl { margin-left: auto; font-size: 10px; color: #334155; }',

      /* title */
      '.htp-mc-title { font-size: 14px; font-weight: 700; color: #e2e8f0; line-height: 1.5; margin: 0 0 14px; flex: 1; }',

      /* outcomes bar */
      '.htp-mc-bar2 { height: 6px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,.04); display: flex; margin-bottom: 6px; }',
      '.htp-mc-bar2-yes { border-radius: 4px 0 0 4px; transition: width .3s; }',
      '.htp-mc-bar2-no  { border-radius: 0 4px 4px 0; transition: width .3s; background: rgba(239,68,68,.65); }',
      '.htp-mc-odds { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 14px; }',

      /* pool footer */
      '.htp-mc-foot {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding-top: 12px;',
      '  border-top: 1px solid rgba(255,255,255,.04);',
      '  margin-top: auto;',
      '}',
      '.htp-mc-pool { display: flex; align-items: baseline; gap: 4px; }',
      '.htp-mc-pool-val { font-size: 20px; font-weight: 900; color: #49e8c2; font-variant-numeric: tabular-nums; }',
      '.htp-mc-pool-unit { font-size: 11px; color: #334155; }',
      '.htp-mc-ent { font-size: 11px; color: #334155; }',
      '.htp-mc-creator { font-size: 10px; color: #1e293b; }',

      /* === Empty state === */
      '.htp-empty {',
      '  grid-column: 1/-1;',
      '  text-align: center;',
      '  padding: 70px 20px;',
      '}',
      '.htp-empty-icon { font-size: 44px; opacity: .35; margin-bottom: 14px; }',
      '.htp-empty-title { font-size: 16px; font-weight: 800; color: #334155; margin-bottom: 6px; }',
      '.htp-empty-sub   { font-size: 12px; color: #1e293b; }',
      '.htp-empty-cta   {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  margin-top: 20px; padding: 9px 20px;',
      '  border-radius: 10px; border: 1px solid rgba(73,232,194,.3);',
      '  background: rgba(73,232,194,.08); color: #49e8c2;',
      '  font-size: 12px; font-weight: 800; cursor: pointer;',
      '  transition: all .18s;',
      '}',
      '.htp-empty-cta:hover { background: rgba(73,232,194,.15); }',

      /* === Results count === */
      '#htp-count { font-size: 11px; color: #334155; margin-bottom: 12px; }',
      '#htp-count strong { color: #49e8c2; }',

      /* responsive */
      '@media(max-width:600px){',
      '  .mg { grid-template-columns: 1fr; }',
      '  .htp-mc-pool-val { font-size: 16px; }',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- Build dynamic slider -------------------------------------------------
  // Reads window.mkts (the main app's market array) for live category counts
  function getMkts() { return (W.mkts && W.mkts.length) ? W.mkts : []; }

  function buildDynamicSlider() {
    var cc = document.getElementById('catC');
    if (!cc) return;

    // Wrap once in .htp-slider
    if (!cc.querySelector('.htp-slider')) {
      cc.innerHTML = '<div class="htp-slider" id="htp-slider-inner"></div>';
    }
    var sl = document.getElementById('htp-slider-inner') || cc.querySelector('.htp-slider');
    if (!sl) return;

    var mkts = getMkts();
    var fCat = W.fCat || 'All';

    // Count per category
    var counts = {};
    mkts.forEach(function(m) { var c = m.cat || 'Other'; counts[c] = (counts[c]||0)+1; });

    var pills = [];
    // "Show All Events" always first
    pills.push(pill('All', '✶', 'Show All Events', mkts.length, fCat === 'All'));

    // Sort categories by count desc, then alpha
    var cats = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a] || a.localeCompare(b); });
    cats.forEach(function(c) {
      var m = catMeta(c);
      pills.push(pill(c, m.icon, c, counts[c], fCat === c));
    });

    sl.innerHTML = pills.join('');

    // Scroll active pill into view
    var active = sl.querySelector('.htp-pill.act');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function pill(key, icon, label, count, isActive) {
    return '<button class="htp-pill' + (isActive ? ' act' : '') + '" onclick="window._htpSetCat(\'' + key + '\')">' +
      '<span>' + icon + '</span>' +
      '<span>' + label + '</span>' +
      '<span class="pc">' + (count || 0) + '</span>' +
      '</button>';
  }

  // ---- Override app globals --------------------------------------------------
  // Replaces buildF() from the inline script (called by setCat, setSt, renderM)
  var _origBuildF = W.buildF;
  W.buildF = function() {
    buildDynamicSlider();
    // Rebuild count line
    ensureCountEl();
    updateCount();
  };

  // Override setCat so the slider reflects the correct active state
  var _origSetCat = W.setCat;
  W._htpSetCat = function(c) {
    W.fCat = c;
    W.buildF();
    W.renderM();
  };
  W.setCat = W._htpSetCat;

  // Override renderM with premium card renderer
  var _origRenderM = W.renderM;
  W.renderM = function() {
    var g = document.getElementById('mG');
    if (!g) { if (_origRenderM) _origRenderM(); return; }

    var mkts = getMkts();
    var fCat = W.fCat || 'All';
    var fSr  = W.fSr  || '';
    var _net;
    try { _net = (typeof W.net !== 'undefined' && W.net) ? W.net : (W.HTP_NETWORK || (typeof W.activeNet !== 'undefined' ? W.activeNet : 'tn12')); }
    catch(e) { _net = W.HTP_NETWORK || 'tn12'; }

    var filtered = mkts.filter(function(m) {
      if (fCat !== 'All' && m.cat !== fCat) return false;
      if (_net !== 'both' && m.net !== 'both' && m.net !== _net) return false;
      if (fSr && !(m.title||'').toLowerCase().includes(fSr.toLowerCase())) return false;
      return true;
    });

    updateCount(filtered.length, mkts.length);
    buildDynamicSlider(); // keep slider counts fresh

    if (!filtered.length) {
      g.innerHTML = emptyHTML(fCat);
      return;
    }

    g.innerHTML = filtered.map(renderCard).join('');
  };

  // ---- Card renderer ---------------------------------------------------------
  function renderCard(m) {
    var col    = (catMeta(m.cat)).col;
    var status = m.st || 'open';
    var pool   = m.pool || ((m.yesTotal||0)+(m.noTotal||0));
    var poolFmt= pool >= 1000 ? (pool/1000).toFixed(1)+'K' : (pool||0).toLocaleString();
    var img    = m.img
      ? '<div style="height:120px;background:url('+m.img+') center/cover no-repeat;"></div>'
      : '';
    var yW = Math.max(m.yP||0, 2);
    var nW = Math.max(m.nP||0, 2);

    return [
      '<div class="htp-mc" onclick="openM(\'' + m.id + '\')"' +
        ' onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 10px 36px rgba(0,0,0,.35)\'"' +
        ' onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' ,
      '<div class="htp-mc-bar" style="background:linear-gradient(90deg,' + col + ',#6366f1)"></div>',
      img,
      '<div class="htp-mc-body">',
        '<div class="htp-mc-top">',
          '<span class="htp-mc-badge" style="background:'+col+'18;color:'+col+';border:1px solid '+col+'33">' +
            catMeta(m.cat).icon + ' ' + (m.cat||'Other') + '</span>',
          '<span class="htp-mc-status ' + status + '">' + status.toUpperCase() + '</span>',
          '<span class="htp-mc-dl">' + (m.cl||'') + '</span>',
        '</div>',
        '<p class="htp-mc-title">' + (m.title||'Untitled') + '</p>',
        '<div class="htp-mc-bar2">',
          '<div class="htp-mc-bar2-yes" style="width:'+yW+'%;background:'+col+'"></div>',
          '<div class="htp-mc-bar2-no"  style="width:'+nW+'%"></div>',
        '</div>',
        '<div class="htp-mc-odds">',
          '<span style="color:'+col+'">↑ Yes ' + (m.yP||0) + '%</span>',
          '<span style="color:rgba(239,68,68,.8)">↓ No ' + (m.nP||0) + '%</span>',
        '</div>',
        '<div class="htp-mc-foot">',
          '<div class="htp-mc-pool">',
            '<span class="htp-mc-pool-val">' + poolFmt + '</span>',
            '<span class="htp-mc-pool-unit">KAS pool</span>',
          '</div>',
          '<span class="htp-mc-ent">' + (m.ent||0) + ' positions</span>',
        '</div>',
      '</div>',
      '</div>',
    ].join('');
  }

  // ---- Empty state HTML ------------------------------------------------------
  function emptyHTML(fCat) {
    var isCatFilter = fCat && fCat !== 'All';
    return [
      '<div class="htp-empty">',
        '<div class="htp-empty-icon">' + (isCatFilter ? catMeta(fCat).icon : '📭') + '</div>',
        '<div class="htp-empty-title">' + (isCatFilter
          ? 'No ' + fCat + ' markets yet'
          : 'No markets yet') + '</div>',
        '<div class="htp-empty-sub">' + (isCatFilter
          ? 'Be the first to create a ' + fCat + ' prediction market.'
          : 'Prediction markets will appear here once created.') + '</div>',
        '<button class="htp-empty-cta" onclick="go(\'create\')">+ Create the first event</button>',
      '</div>',
    ].join('');
  }

  // ---- Count helper ----------------------------------------------------------
  function ensureCountEl() {
    if (document.getElementById('htp-count')) return;
    var g = document.getElementById('mG');
    if (!g || !g.parentNode) return;
    var el = document.createElement('div');
    el.id = 'htp-count';
    g.parentNode.insertBefore(el, g);
  }
  function updateCount(shown, total) {
    var el = document.getElementById('htp-count');
    if (!el) return;
    if (shown === undefined) {
      var mkts = getMkts(); shown = mkts.length; total = mkts.length;
    }
    el.innerHTML = shown === total
      ? '<strong>' + total + '</strong> market' + (total !== 1 ? 's' : '')
      : 'Showing <strong>' + shown + '</strong> of <strong>' + total + '</strong> markets';
  }

  // ---- Watch mkts for changes so slider stays live --------------------------
  function watchMkts() {
    var last = 0;
    setInterval(function() {
      var m = getMkts();
      if (m.length !== last) {
        last = m.length;
        W.buildF();
      }
    }, 1500);
  }

  // ---- Bootstrap ------------------------------------------------------------
  function init() {
    injectCSS();
    // Wait for DOM + inline script to fully initialise before overriding
    function tryInit() {
      if (document.getElementById('catC') && typeof W.buildF !== 'undefined') {
        W.buildF();
        W.renderM();
        watchMkts();
      } else {
        setTimeout(tryInit, 200);
      }
    }
    tryInit();

    // Also refresh when navigating to the markets tab
    var _origGo = W.go;
    if (typeof _origGo === 'function') {
      W.go = function(v) {
        _origGo(v);
        if (v === 'markets') {
          setTimeout(function() { W.buildF(); W.renderM(); }, 120);
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
