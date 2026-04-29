// =============================================================================
// htp-markets-ui.js – Dynamic Category Slider + Premium Market Cards + Polish
// Overrides buildF() and renderM() defined in the inline <script> of index.html
// Must be loaded AFTER the main inline script block.
// =============================================================================
(function(W) {
  'use strict';

  var CAT_META = {
    'Macro':    { icon: '', col: '#0ea5e9' },
    'Crypto':   { icon: '', col: '#a855f7' },
    'Politics': { icon: '', col: '#ef4444' },
    'Sports':   { icon: '', col: '#f59e0b' },
    'Kaspa':    { icon: '', col: '#22c55e' },
    'Skill':    { icon: '', col: '#06b6d4' },
    'Tech':     { icon: '', col: '#3b82f6' },
    'Finance':  { icon: '', col: '#f97316' },
    'Gaming':   { icon: '', col: '#ec4899' },
    'Other':    { icon: '', col: '#94a3b8' }
  };
  function catMeta(c) { return CAT_META[c] || { icon: '', col: '#94a3b8' }; }

  function injectCSS() {
    if (document.getElementById('htp-mkt-ui-css')) return;
    var s = document.createElement('style');
    s.id = 'htp-mkt-ui-css';
    s.textContent = [
      '#v-markets .sh { margin-bottom: 24px; }',
      '#v-markets .sh h2 { font-size: 30px; font-weight: 900; color: #f1f5f9; margin: 0 0 6px; letter-spacing:-0.02em; }',
      '#v-markets .sh p  { font-size: 13px; color: #64748b; margin: 0; }',
      '#v-markets .mx.sec-pad { position: relative; }',
      '#v-markets .mx.sec-pad::before { content:""; position:absolute; inset:0 0 auto 0; height:220px; pointer-events:none; background:radial-gradient(circle at 0% 20%, rgba(73,232,194,.12), transparent 38%), linear-gradient(180deg, rgba(255,255,255,.02), transparent 60%); }',
      '#v-markets .cta1 { background: linear-gradient(135deg, rgba(73,232,194,.16), rgba(99,102,241,.10)); border: 1px solid rgba(73,232,194,.38); color: #49e8c2; font-weight: 800; letter-spacing: .035em; border-radius: 12px; transition: all .18s; box-shadow: 0 8px 24px rgba(0,0,0,.18); }',
      '#v-markets .cta1:hover { background: rgba(73,232,194,.22); box-shadow: 0 0 20px rgba(73,232,194,.22), 0 10px 28px rgba(0,0,0,.25); transform: translateY(-1px); }',
      '.fb { margin-bottom: 20px; display: flex; flex-direction: column; gap: 14px; }',
      '.fc { position: sticky; top: 70px; z-index: 14; padding: 10px 0 8px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); background: linear-gradient(180deg, rgba(6,10,18,.94), rgba(6,10,18,.78)); border-bottom: 1px solid rgba(73,232,194,.08); }',
      '.fc::after { content: ""; position: absolute; right: 0; top: 0; bottom: 0; width: 60px; background: linear-gradient(to right, transparent, rgba(6,10,18,.96)); pointer-events: none; }',
      '.htp-slider { display: flex; gap: 8px; overflow-x: auto; scroll-behavior: smooth; padding-bottom: 6px; scrollbar-width: none; -ms-overflow-style: none; }',
      '.htp-slider::-webkit-scrollbar { display: none; }',
      '.htp-pill { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(73,232,194,.14); background: rgba(255,255,255,.03); color: #64748b; font-size: 12px; font-weight: 700; cursor: pointer; transition: all .18s; white-space: nowrap; user-select: none; position: relative; }',
      '.htp-pill:hover { background: rgba(73,232,194,.08); color: #94a3b8; transform: translateY(-1px); }',
      '.htp-pill.act { background: rgba(73,232,194,.12); border-color: #49e8c2; color: #49e8c2; box-shadow: 0 0 14px rgba(73,232,194,.14); }',
      '.htp-pill.act::after { content:""; position:absolute; left:14px; right:14px; bottom:2px; height:2px; border-radius:2px; background: var(--pill-accent, #49e8c2); opacity:.95; }',
      '.htp-pill .pc { font-size: 10px; font-weight: 900; padding: 0 5px; line-height: 16px; border-radius: 8px; background: rgba(73,232,194,.10); color: #49e8c2; min-width: 18px; text-align: center; }',
      '.htp-pill.act .pc { background: rgba(73,232,194,.20); }',
      '.fr { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
      '#stC { display: none !important; }',
      '.fi { flex: 1; min-width: 200px; padding: 10px 14px 10px 36px; background: rgba(10,15,30,.82); border: 1px solid rgba(73,232,194,.12); border-radius: 12px; color: #e2e8f0; font-size: 13px; font-family: inherit; outline: none; transition: border-color .18s, box-shadow .18s; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'m21 21-4.35-4.35\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: 12px center; }',
      '.fi:focus { border-color: rgba(73,232,194,.35); box-shadow: 0 0 0 4px rgba(73,232,194,.07); }',
      '.fi::placeholder { color: #334155; }',
      '.htp-sort { padding: 10px 12px; background: rgba(10,15,30,.82); border: 1px solid rgba(73,232,194,.12); border-radius: 12px; color: #94a3b8; font-size: 12px; font-family: inherit; outline:none; cursor:pointer; }',
      '.mg { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 16px; }',
      '.htp-skeleton { background: rgba(10,15,30,.72); border:1px solid rgba(73,232,194,.08); border-radius: 18px; overflow:hidden; position:relative; min-height: 260px; }',
      '.htp-skeleton::after { content:""; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent); animation: htpShimmer 1.6s infinite; }',
      '.htp-skeleton-top { height: 118px; background: linear-gradient(135deg, rgba(73,232,194,.08), rgba(99,102,241,.08)); }',
      '.htp-skeleton-body { padding: 16px; }',
      '.htp-sk-line { height: 10px; border-radius: 6px; background: rgba(255,255,255,.05); margin-bottom: 12px; }',
      '.htp-sk-line.sm { width: 45%; }',
      '.htp-sk-line.md { width: 68%; }',
      '.htp-sk-line.lg { width: 84%; }',
      '@keyframes htpShimmer { 100% { transform: translateX(100%); } }',
      '.htp-mc { background: rgba(10,15,30,.86); border: 1px solid rgba(73,232,194,.09); border-radius: 20px; overflow: hidden; cursor: pointer; transition: border-color .2s, transform .2s, box-shadow .2s; display: flex; flex-direction: column; box-shadow: 0 10px 28px rgba(0,0,0,.18); }',
      '.htp-mc:hover { border-color: rgba(73,232,194,.32); transform: translateY(-3px); box-shadow: 0 14px 42px rgba(0,0,0,.32); }',
      '.htp-mc-bar { height: 3px; }',
      '.htp-mc-cover { height: 118px; position: relative; overflow: hidden; }',
      '.htp-mc-cover::after { content:""; position:absolute; inset:0; background: linear-gradient(180deg, rgba(0,0,0,.0), rgba(6,10,18,.12) 55%, rgba(6,10,18,.45)); }',
      '.htp-mc-cover-fallback { display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:800; color: rgba(255,255,255,.14); letter-spacing:.08em; }',
      '.htp-mc-body { padding: 16px; flex: 1; display: flex; flex-direction: column; }',
      '.htp-mc-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }',
      '.htp-mc-badge { font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 99px; letter-spacing: .04em; }',
      '.htp-mc-status { font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: .06em; }',
      '.htp-mc-status.open { background:rgba(34,197,94,.1); color:#22c55e; border:1px solid rgba(34,197,94,.25); }',
      '.htp-mc-status.pending { background:rgba(245,158,11,.1); color:#f59e0b; border:1px solid rgba(245,158,11,.25); }',
      '.htp-mc-status.closed { background:rgba(100,116,139,.1); color:#64748b; border:1px solid rgba(100,116,139,.2); }',
      '.htp-mc-status.cancelled { background:rgba(239,68,68,.1); color:#ef4444; border:1px solid rgba(239,68,68,.2); }',
      '.htp-mc-urgency { font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: .05em; background: rgba(245,158,11,.12); color:#f59e0b; border:1px solid rgba(245,158,11,.22); }',
      '.htp-mc-dl { margin-left: auto; font-size: 10px; color: #334155; }',
      '.htp-mc-title { font-size: 14px; font-weight: 700; color: #e2e8f0; line-height: 1.5; margin: 0 0 14px; flex: 1; }',
      '.htp-mc-bar2 { height: 8px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.04); display: flex; margin-bottom: 7px; }',
      '.htp-mc-bar2-yes { border-radius: 999px 0 0 999px; transition: width .3s; }',
      '.htp-mc-bar2-no  { border-radius: 0 999px 999px 0; transition: width .3s; background: rgba(239,68,68,.65); }',
      '.htp-mc-odds { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 14px; }',
      '.htp-mc-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.04); margin-top: auto; }',
      '.htp-mc-pool { display: flex; align-items: baseline; gap: 4px; }',
      '.htp-mc-pool-val { font-size: 20px; font-weight: 900; color: #49e8c2; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }',
      '.htp-mc-pool-unit { font-size: 11px; color: #334155; }',
      '.htp-mc-ent { font-size: 11px; color: #334155; }',
      '.htp-empty { grid-column: 1/-1; text-align: center; padding: 84px 20px; border:1px solid rgba(73,232,194,.08); border-radius: 24px; background: linear-gradient(180deg, rgba(10,15,30,.70), rgba(10,15,30,.44)); box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }',
      '.htp-empty-icon { width: 74px; height: 74px; margin: 0 auto 16px; border-radius: 20px; position:relative; background: radial-gradient(circle at 50% 35%, rgba(73,232,194,.18), rgba(73,232,194,.04)); border:1px solid rgba(73,232,194,.14); box-shadow: 0 0 30px rgba(73,232,194,.08); animation: htpKaspaShimmer 2.4s ease-in-out infinite; }',
      '.htp-empty-icon::before, .htp-empty-icon::after { content:""; position:absolute; left:50%; top:50%; transform-origin:center; background: rgba(73,232,194,.56); border-radius: 999px; }',
      '.htp-empty-icon::before { width: 3px; height: 34px; transform: translate(-50%, -50%) rotate(0deg); }',
      '.htp-empty-icon::after  { width: 3px; height: 34px; transform: translate(-50%, -50%) rotate(60deg); }',
      '.htp-empty-icon span { position:absolute; inset:0; }',
      '.htp-empty-icon span::before { content:""; position:absolute; left:50%; top:50%; width:3px; height:34px; transform:translate(-50%, -50%) rotate(-60deg); background: rgba(73,232,194,.56); border-radius:999px; }',
      '@keyframes htpKaspaShimmer { 0%,100% { box-shadow:0 0 20px rgba(73,232,194,.06); transform: translateY(0); } 50% { box-shadow:0 0 28px rgba(73,232,194,.14); transform: translateY(-1px); } }',
      '.htp-empty-title { font-size: 18px; font-weight: 800; color: #cbd5e1; margin-bottom: 7px; }',
      '.htp-empty-sub { font-size: 12px; color: #64748b; max-width: 460px; margin: 0 auto; }',
      '.htp-empty-cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 20px; padding: 10px 20px; border-radius: 12px; border: 1px solid rgba(73,232,194,.3); background: rgba(73,232,194,.08); color: #49e8c2; font-size: 12px; font-weight: 800; cursor: pointer; transition: all .18s; }',
      '.htp-empty-cta:hover { background: rgba(73,232,194,.15); box-shadow: 0 0 18px rgba(73,232,194,.14); }',
      '#htp-count { font-size: 11px; color: #475569; margin-bottom: 12px; }',
      '#htp-count strong { color: #49e8c2; }',
      '.nav-btn { position: relative; }',
      '.nav-btn.act::after { content:""; position:absolute; left:10px; right:10px; bottom:6px; height:2px; border-radius:2px; background: rgba(73,232,194,.95); box-shadow: 0 0 10px rgba(73,232,194,.24); }',
      '.nav-badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; margin-left:6px; padding:0 5px; border-radius:999px; font-size:10px; font-weight:800; background:rgba(73,232,194,.12); color:#49e8c2; border:1px solid rgba(73,232,194,.22); vertical-align:middle; }',
      '.view { opacity: 0; transform: translateY(6px); }',
      '.view.show { display:block; opacity: 1; transform: translateY(0); animation: htpFade .22s ease; }',
      '@keyframes htpFade { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }',
      '#nodeStatus { display:flex; align-items:center; gap:7px; }',
      '#nodeStatus > span:first-child { position:relative; width:8px !important; height:8px !important; border:none !important; background:#49e8c2; box-shadow:0 0 0 0 rgba(73,232,194,.65); animation: htpPulseDot 2s infinite; }',
      '@keyframes htpPulseDot { 0% { box-shadow:0 0 0 0 rgba(73,232,194,.6); } 70% { box-shadow:0 0 0 10px rgba(73,232,194,0); } 100% { box-shadow:0 0 0 0 rgba(73,232,194,0); } }',
      '.ftr-in > span:first-child::before { content:"◈"; color:#49e8c2; margin-right:8px; text-shadow:0 0 12px rgba(73,232,194,.16); }',
      '#htp-backTop { position: fixed; right: 20px; bottom: 24px; width: 44px; height: 44px; border-radius: 14px; border:1px solid rgba(73,232,194,.24); background: rgba(10,15,30,.86); color:#49e8c2; cursor:pointer; display:none; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(0,0,0,.26); z-index:50; backdrop-filter: blur(10px); }',
      '#htp-backTop:hover { background: rgba(73,232,194,.10); box-shadow:0 0 18px rgba(73,232,194,.18); }',
      '@media(max-width:700px){ .fr { display:grid; grid-template-columns:1fr; } .fi { width:100%; } .htp-sort { width:100%; } .fc { top:62px; } }',
      '@media(max-width:600px){ .mg { grid-template-columns: 1fr; } .htp-mc-pool-val { font-size: 16px; } }'
    ].join('\n');
    document.head.appendChild(s);
  }

  function getMkts() { return (W.mkts && W.mkts.length) ? W.mkts : []; }
  function ensureSortControl() { var fr = document.querySelector('#v-markets .fr'); if (!fr) return; if (!document.getElementById('htpSort')) { var sel = document.createElement('select'); sel.id = 'htpSort'; sel.className = 'htp-sort'; sel.innerHTML = '<option value="newest">Newest</option><option value="pool">Highest Pool</option><option value="expiry">Expiring Soon</option>'; sel.onchange = function() { W._htpSortMode = this.value; W.renderM(); }; fr.insertBefore(sel, document.getElementById('sI') ? document.getElementById('sI').nextSibling : null); } }
  function ensureCountEl() { if (document.getElementById('htp-count')) return; var g = document.getElementById('mG'); if (!g || !g.parentNode) return; var el = document.createElement('div'); el.id = 'htp-count'; g.parentNode.insertBefore(el, g); }
  function ensureBackTop() { if (document.getElementById('htp-backTop')) return; var b = document.createElement('button'); b.id = 'htp-backTop'; b.setAttribute('aria-label', 'Back to top'); b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>'; b.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }; document.body.appendChild(b); window.addEventListener('scroll', function() { b.style.display = window.scrollY > 300 ? 'flex' : 'none'; }, { passive: true }); }
  function ensureNavBadge() { var btn = document.querySelector('.nav-btn[data-v="markets"]'); if (!btn) return; var badge = btn.querySelector('.nav-badge'); var total = getMkts().length; if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; btn.appendChild(badge); } badge.textContent = total; badge.style.display = total > 0 ? 'inline-flex' : 'none'; }
  function updateCount(shown, total) { var el = document.getElementById('htp-count'); if (!el) return; if (shown === undefined) { var mkts = getMkts(); shown = mkts.length; total = mkts.length; } el.innerHTML = shown === total ? '<strong>' + total + '</strong> market' + (total !== 1 ? 's' : '') : 'Showing <strong>' + shown + '</strong> of <strong>' + total + '</strong> markets'; }

  function buildDynamicSlider() {
    var cc = document.getElementById('catC'); if (!cc) return;
    if (!cc.querySelector('.htp-slider')) cc.innerHTML = '<div class="htp-slider" id="htp-slider-inner"></div>';
    var sl = document.getElementById('htp-slider-inner') || cc.querySelector('.htp-slider'); if (!sl) return;
    var mkts = getMkts(); var fCat = W.fCat || 'All'; var counts = {};
    mkts.forEach(function(m) { var c = m.cat || 'Other'; counts[c] = (counts[c] || 0) + 1; });
    var pills = []; pills.push(pill('All', 'Show All Events', mkts.length, fCat === 'All', '#49e8c2'));
    Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).forEach(function(c) { pills.push(pill(c, c, counts[c], fCat === c, catMeta(c).col)); });
    sl.innerHTML = pills.join('');
    var active = sl.querySelector('.htp-pill.act'); if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function pill(key, label, count, isActive, accent) { return '<button class="htp-pill' + (isActive ? ' act' : '') + '" style="--pill-accent:' + accent + '" onclick="window._htpSetCat(\'' + key + '\')"><span>' + label + '</span><span class="pc">' + (count || 0) + '</span></button>'; }
  function urgencyChip(m) { var raw = m.deadline || m.dead || m.expiresAt || m.resolutionDate || m.cl; if (!raw) return ''; var d = new Date(raw); if (isNaN(d.getTime()) && typeof raw === 'number') d = new Date(raw < 1e12 ? raw * 1000 : raw); if (isNaN(d.getTime())) return ''; var diff = d.getTime() - Date.now(); if (diff <= 0 || diff > 172800000) return ''; var hrs = Math.max(1, Math.floor(diff / 3600000)); return '<span class="htp-mc-urgency">Closes in ' + (hrs >= 24 ? (Math.floor(hrs / 24) + 'd') : (hrs + 'h')) + '</span>'; }

  function renderCard(m) {
    var col = catMeta(m.cat).col, status = m.st || 'open', pool = m.pool || ((m.yesTotal || 0) + (m.noTotal || 0)), poolFmt = pool >= 1000 ? (pool / 1000).toFixed(1) + 'K' : (pool || 0).toLocaleString(), yW = Math.max(m.yP || 0, 2), nW = Math.max(m.nP || 0, 2);
    var cover = m.img ? '<div class="htp-mc-cover" style="background:url(' + m.img + ') center/cover no-repeat"></div>' : '<div class="htp-mc-cover htp-mc-cover-fallback" style="background:linear-gradient(135deg,' + col + '22, #0d1117 70%)">HTP</div>';
    return '<div class="htp-mc" onclick="openM(\'' + m.id + '\')" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 14px 42px rgba(0,0,0,.32)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' + '<div class="htp-mc-bar" style="background:linear-gradient(90deg,' + col + ',#6366f1)"></div>' + cover + '<div class="htp-mc-body">' + '<div class="htp-mc-top">' + '<span class="htp-mc-badge" style="background:' + col + '18;color:' + col + ';border:1px solid ' + col + '33">' + (m.cat || 'Other') + '</span>' + '<span class="htp-mc-status ' + status + '">' + status.toUpperCase() + '</span>' + urgencyChip(m) + '<span class="htp-mc-dl">' + (m.cl || '') + '</span>' + '</div>' + '<p class="htp-mc-title">' + (m.title || 'Untitled') + '</p>' + '<div class="htp-mc-bar2"><div class="htp-mc-bar2-yes" style="width:' + yW + '%;background:' + col + '"></div><div class="htp-mc-bar2-no" style="width:' + nW + '%"></div></div>' + '<div class="htp-mc-odds"><span style="color:' + col + '">Yes ' + (m.yP || 0) + '%</span><span style="color:rgba(239,68,68,.8)">No ' + (m.nP || 0) + '%</span></div>' + '<div class="htp-mc-foot"><div class="htp-mc-pool"><span class="htp-mc-pool-val">' + poolFmt + '</span><span class="htp-mc-pool-unit">KAS pool</span></div><span class="htp-mc-ent">' + (m.ent || 0) + ' positions</span></div>' + '</div></div>';
  }

  function skeletonHTML() { var card = '<div class="htp-skeleton"><div class="htp-skeleton-top"></div><div class="htp-skeleton-body"><div class="htp-sk-line sm"></div><div class="htp-sk-line lg"></div><div class="htp-sk-line md"></div><div class="htp-sk-line lg"></div></div></div>'; return card + card + card; }
  function emptyHTML(fCat) { var isCat = fCat && fCat !== 'All'; return '<div class="htp-empty"><div class="htp-empty-icon"><span></span></div><div class="htp-empty-title">' + (isCat ? ('No ' + fCat + ' markets yet') : 'No markets yet') + '</div><div class="htp-empty-sub">' + (isCat ? ('Be the first to create a ' + fCat + ' prediction market.') : 'Prediction markets will appear here once created. Categories will populate automatically from real events.') + '</div><button class="htp-empty-cta" onclick="go(\'create\')">+ Create the first event</button></div>'; }

  var _origBuildF = W.buildF;
  W.buildF = function() { buildDynamicSlider(); ensureCountEl(); ensureSortControl(); ensureNavBadge(); updateCount(); };
  W._htpSetCat = function(c) { W.fCat = c; W.buildF(); W.renderM(); };
  W.setCat = W._htpSetCat;

  var _origRenderM = W.renderM;
  W.renderM = function() {
    var g = document.getElementById('mG'); if (!g) { if (_origRenderM) _origRenderM(); return; }
    var mkts = getMkts().slice(), fCat = W.fCat || 'All', fSr = W.fSr || '', sortMode = W._htpSortMode || 'newest', _net;
    try { _net = (typeof W.net !== 'undefined' && W.net) ? W.net : (W.HTP_NETWORK || (typeof W.activeNet !== 'undefined' ? W.activeNet : 'tn12')); } catch (e) { _net = W.HTP_NETWORK || 'tn12'; }
    if (!W._htpMktsLoadedOnce && mkts.length === 0) { g.innerHTML = skeletonHTML(); W._htpMktsLoadedOnce = true; setTimeout(function() { if ((getMkts().length || 0) === 0) W.renderM(); }, 700); return; }
    var filtered = mkts.filter(function(m) { if (fCat !== 'All' && m.cat !== fCat) return false; if (_net !== 'both' && m.net !== 'both' && m.net !== _net) return false; if (fSr && !(m.title || '').toLowerCase().includes(fSr.toLowerCase())) return false; return true; });
    filtered.sort(function(a, b) { if (sortMode === 'pool') return (b.pool || ((b.yesTotal || 0) + (b.noTotal || 0))) - (a.pool || ((a.yesTotal || 0) + (a.noTotal || 0))); if (sortMode === 'expiry') return new Date(a.deadline || a.cl || 0) - new Date(b.deadline || b.cl || 0); return new Date(b.created || 0) - new Date(a.created || 0); });
    updateCount(filtered.length, mkts.length); ensureNavBadge(); buildDynamicSlider();
    if (!filtered.length) { g.innerHTML = emptyHTML(fCat); return; }
    g.innerHTML = filtered.map(renderCard).join('');
  };

  function watchMkts() { var lastSig = ''; setInterval(function() { var sig = JSON.stringify((getMkts() || []).map(function(m) { return [m.id, m.cat, m.st, m.pool, m.title]; })); if (sig !== lastSig) { lastSig = sig; W.buildF(); W.renderM(); } }, 1500); }

  function init() {
    injectCSS(); ensureBackTop();
    function tryInit() { if (document.getElementById('catC') && typeof W.buildF !== 'undefined') { W.buildF(); W.renderM(); watchMkts(); } else { setTimeout(tryInit, 200); } }
    tryInit();
    var _origGo = W.go;
    if (typeof _origGo === 'function' && !_origGo._htpWrapped) { W.go = function(v) { _origGo(v); if (v === 'markets') setTimeout(function() { W.buildF(); W.renderM(); }, 120); }; W.go._htpWrapped = true; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
