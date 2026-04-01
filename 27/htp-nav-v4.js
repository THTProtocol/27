/**
 * htp-nav-v4.js  —  High Table Protocol  —  Navigation Engine v4
 *
 * WHAT THIS FILE DOES:
 *  1. DESKTOP  — replaces plain .nav-btn row with glowing pill nav +
 *                live connection badge + wallet balance ticker
 *  2. MOBILE   — injects a fixed bottom tab bar (5 tabs + overflow sheet)
 *  3. BREADCRUMB — always shows current section path under the header
 *  4. FAB      — floating "+" button on Skill / Markets / Create views
 *  5. DEEP-LINK — reads ?tab=XXX on load, writes history.pushState on nav
 *  6. BACK-BTN — browser back/forward works correctly (SVG chevron, no text)
 *  7. SECTION JUMP — within-section anchor links via #htp-jump-XXX ids
 *  8. TRANSITION — smooth fade+slide between views
 *
 * LOAD ORDER: after htp-autopayout-engine.js  (or last in <body>)
 * NO changes to index.html needed — purely additive.
 */

;(function (W) {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
   * CONFIG
   * ───────────────────────────────────────────────────────────────────────── */
  var SECTIONS = [
    { key: 'overview',  label: 'Overview',  icon: '⬡',  mobile: true,  fab: false },
    { key: 'markets',   label: 'Markets',   icon: '◈',  mobile: true,  fab: true,  fabLabel: 'Browse Markets' },
    { key: 'skill',     label: 'Skill',     icon: '♟',  mobile: true,  fab: true,  fabLabel: 'Create Match' },
    { key: 'create',    label: 'Create',    icon: '+',  mobile: false, fab: false },
    { key: 'oracle',    label: 'Oracle',    icon: '⬡',  mobile: false, fab: false },
    { key: 'portfolio', label: 'Portfolio', icon: '◎',  mobile: true,  fab: false },
    { key: 'wallet',    label: 'Wallet',    icon: '◈',  mobile: false, fab: false },
    { key: 'kaspa',     label: 'Kaspa',     icon: '⬡',  mobile: false, fab: false },
    { key: 'terms',     label: 'Terms',     icon: '✦',  mobile: false, fab: false },
  ];

  var MOBILE_TABS = [
    { key: 'overview',  label: 'Home',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    { key: 'markets',   label: 'Markets',   svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
    { key: 'skill',     label: 'Play',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>' },
    { key: 'portfolio', label: 'Portfolio', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' },
    { key: '__more',    label: 'More',      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>' },
  ];

  var _current = 'overview';
  var _history = [];

  /* ─────────────────────────────────────────────────────────────────────────
   * STYLES
   * ───────────────────────────────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('htp-nav-v4-style')) return;
    var s = document.createElement('style');
    s.id = 'htp-nav-v4-style';
    s.textContent = [
      /* ── VIEW TRANSITIONS ── */
      '.view { display:none; opacity:0; transform:translateY(8px); transition:opacity .22s ease, transform .22s ease; }',
      '.view.show { display:block !important; opacity:1; transform:translateY(0); }',

      /* ── DESKTOP NAV PILLS ── */
      '.htp-nav-pill {',
      '  display:inline-flex; align-items:center; gap:6px;',
      '  padding:7px 14px; border-radius:20px;',
      '  font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;',
      '  color:#64748b; background:transparent; border:none; cursor:pointer;',
      '  transition:all .18s; position:relative; flex-shrink:0; white-space:nowrap;',
      '}',
      '.htp-nav-pill:hover { color:#e2e8f0; background:rgba(255,255,255,.05); }',
      '.htp-nav-pill.act {',
      '  color:#49e8c2; background:rgba(73,232,194,.12);',
      '  box-shadow:0 0 14px rgba(73,232,194,.18), inset 0 1px 0 rgba(73,232,194,.2);',
      '}',
      '.htp-nav-pill .pip {',
      '  width:5px; height:5px; border-radius:50%; background:#49e8c2;',
      '  position:absolute; top:5px; right:5px;',
      '  box-shadow:0 0 6px #49e8c2; display:none;',
      '}',
      '.htp-nav-pill.act .pip { display:block; }',

      /* ── CONNECTION BADGE ── */
      '#htpConnBadge {',
      '  display:inline-flex; align-items:center; gap:6px;',
      '  padding:5px 12px; border-radius:20px;',
      '  font-size:11px; font-weight:700;',
      '  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);',
      '  color:#64748b; transition:all .3s; cursor:pointer; white-space:nowrap;',
      '}',
      '#htpConnBadge.connected { color:#49e8c2; border-color:rgba(73,232,194,.3); background:rgba(73,232,194,.06); }',
      '#htpConnBadge .dot { width:7px; height:7px; border-radius:50%; background:#475569; flex-shrink:0; }',
      '#htpConnBadge.connected .dot { background:#49e8c2; box-shadow:0 0 8px #49e8c2; animation:htpDotPulse 2s infinite; }',
      '@keyframes htpDotPulse { 0%,100%{opacity:1} 50%{opacity:.4} }',

      /* ── BREADCRUMB ── */
      '#htpBreadcrumb {',
      '  display:flex; align-items:center; gap:6px;',
      '  padding:8px 20px; font-size:11px; color:#475569;',
      '  border-bottom:1px solid rgba(255,255,255,.04);',
      '  background:rgba(0,0,0,.2); position:sticky; top:56px; z-index:90;',
      '  backdrop-filter:blur(10px);',
      '}',
      '#htpBreadcrumb a { color:#49e8c2; text-decoration:none; font-weight:600; }',
      '#htpBreadcrumb a:hover { text-decoration:underline; }',
      '#htpBreadcrumb .sep { color:#334155; }',
      '#htpBreadcrumb .crumb-back { display:inline-flex; align-items:center; justify-content:center; margin-right:10px; width:26px; height:26px; border-radius:8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#64748b; cursor:pointer; transition:all .15s; flex-shrink:0; }',
      '#htpBreadcrumb .crumb-back:hover { color:#e2e8f0; background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); }',

      /* ── MOBILE BOTTOM TAB BAR ── */
      '#htpBottomBar {',
      '  display:none; position:fixed; bottom:0; left:0; right:0; z-index:9500;',
      '  background:rgba(3,7,18,.96); backdrop-filter:blur(20px);',
      '  border-top:1px solid rgba(255,255,255,.07);',
      '  padding:0 0 env(safe-area-inset-bottom,0);',
      '}',
      '#htpBottomBar .bar-inner {',
      '  display:flex; height:58px; align-items:stretch;',
      '}',
      '#htpBottomBar .tab-item {',
      '  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;',
      '  gap:2px; cursor:pointer; border:none; background:none; padding:6px 2px;',
      '  color:#475569; transition:all .15s; -webkit-tap-highlight-color:transparent;',
      '  position:relative;',
      '}',
      '#htpBottomBar .tab-item svg { width:20px; height:20px; flex-shrink:0; }',
      '#htpBottomBar .tab-item .tab-lbl { font-size:9px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }',
      '#htpBottomBar .tab-item.act { color:#49e8c2; }',
      '#htpBottomBar .tab-item.act::before {',
      '  content:""; position:absolute; top:0; left:20%; right:20%;',
      '  height:2px; border-radius:0 0 3px 3px; background:#49e8c2;',
      '  box-shadow:0 0 10px #49e8c2;',
      '}',
      '#htpBottomBar .tab-item.play-btn {',
      '  color:#0f172a;',
      '}',
      '#htpBottomBar .tab-item.play-btn .play-disc {',
      '  width:44px; height:44px; border-radius:50%;',
      '  background:linear-gradient(135deg,#49e8c2,#3b82f6);',
      '  display:flex; align-items:center; justify-content:center;',
      '  box-shadow:0 4px 16px rgba(73,232,194,.4); margin-bottom:1px; margin-top:-10px;',
      '  transition:transform .15s;',
      '}',
      '#htpBottomBar .tab-item.play-btn.act .play-disc,',
      '#htpBottomBar .tab-item.play-btn:active .play-disc { transform:scale(.92); }',
      '#htpBottomBar .tab-item.play-btn .tab-lbl { color:#49e8c2; }',

      /* ── MORE SHEET ── */
      '#htpMoreSheet {',
      '  display:none; position:fixed; inset:0; z-index:9600;',
      '}',
      '#htpMoreSheet.open { display:flex; flex-direction:column; justify-content:flex-end; }',
      '#htpMoreSheet .sheet-bg {',
      '  position:absolute; inset:0; background:rgba(0,0,0,.6); backdrop-filter:blur(4px);',
      '}',
      '#htpMoreSheet .sheet-body {',
      '  position:relative; background:#0f172a; border-radius:20px 20px 0 0;',
      '  padding:0 0 env(safe-area-inset-bottom,16px); z-index:1;',
      '  animation:htpSheetUp .25s ease;',
      '}',
      '@keyframes htpSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }',
      '#htpMoreSheet .sheet-handle {',
      '  width:36px; height:4px; border-radius:2px; background:rgba(255,255,255,.15);',
      '  margin:12px auto 0;',
      '}',
      '#htpMoreSheet .sheet-title {',
      '  font-size:12px; font-weight:700; color:#475569;',
      '  letter-spacing:.08em; text-transform:uppercase;',
      '  padding:16px 20px 8px; border-bottom:1px solid rgba(255,255,255,.05);',
      '}',
      '#htpMoreSheet .sheet-item {',
      '  display:flex; align-items:center; gap:14px;',
      '  padding:14px 20px; cursor:pointer; border:none; background:none;',
      '  width:100%; text-align:left; color:#e2e8f0; font-size:14px; font-weight:600;',
      '  transition:background .15s; -webkit-tap-highlight-color:transparent;',
      '}',
      '#htpMoreSheet .sheet-item:hover { background:rgba(255,255,255,.04); }',
      '#htpMoreSheet .sheet-item .si-icon {',
      '  width:38px; height:38px; border-radius:10px;',
      '  background:rgba(255,255,255,.06); display:flex; align-items:center; justify-content:center;',
      '  font-size:18px; flex-shrink:0;',
      '}',
      '#htpMoreSheet .sheet-item svg { width:18px; height:18px; flex-shrink:0; }',
      '#htpMoreSheet .sheet-close {',
      '  display:block; width:calc(100% - 32px); margin:8px 16px 16px;',
      '  padding:14px; border-radius:14px; background:rgba(255,255,255,.06); border:none;',
      '  color:#e2e8f0; font-size:14px; font-weight:600; cursor:pointer;',
      '  transition:background .15s;',
      '}',
      '#htpMoreSheet .sheet-close:hover { background:rgba(255,255,255,.1); }',

      /* ── FAB ── */
      '#htpFAB {',
      '  display:none; position:fixed; right:20px; bottom:80px; z-index:9400;',
      '  width:52px; height:52px; border-radius:50%;',
      '  background:linear-gradient(135deg,#49e8c2,#3b82f6); border:none;',
      '  align-items:center; justify-content:center; color:#020617;',
      '  cursor:pointer; box-shadow:0 6px 24px rgba(73,232,194,.35);',
      '  transition:transform .15s, box-shadow .15s;',
      '}',
      '#htpFAB.show { display:flex; animation:htpFabIn .2s ease; }',
      '#htpFAB:active { transform:scale(.94); box-shadow:0 2px 12px rgba(73,232,194,.2); }',
      '@keyframes htpFabIn { from{opacity:0;transform:scale(.8) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }',
      '#htpFAB svg { width:18px; height:18px; flex-shrink:0; }',

      /* ── MOBILE BODY PADDING ── */
      '@media(max-width:959px) {',
      '  #htpBottomBar { display:block; }',
      '  body { padding-bottom:calc(58px + env(safe-area-inset-bottom,0px)); }',
      '}',

      /* ── SECTION HEADERS ── */
      '.htp-section-header {',
      '  padding:28px 20px 0; max-width:1200px; margin:0 auto;',
      '}',
      '.htp-section-header h1 {',
      '  font-size:clamp(22px,5vw,36px); font-weight:900; letter-spacing:-.03em;',
      '  background:linear-gradient(135deg,#e2e8f0 60%,#49e8c2);',
      '  -webkit-background-clip:text; -webkit-text-fill-color:transparent;',
      '  margin:0 0 6px;',
      '}',
      '.htp-section-header p {',
      '  font-size:13px; color:#64748b; margin:0; max-width:500px;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * DESKTOP NAV UPGRADE
   * ───────────────────────────────────────────────────────────────────────── */
  function upgradeDesktopNav() {
    var nav = document.getElementById('nav') || document.querySelector('.hdr-nav');
    if (!nav || nav._v4upgraded) return;
    nav._v4upgraded = true;

    // Swap .nav-btn → .htp-nav-pill + add glow pip
    nav.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.classList.add('htp-nav-pill');
      btn.classList.remove('nav-btn');
      var pip = document.createElement('span');
      pip.className = 'pip';
      btn.appendChild(pip);
    });

    // Inject connection badge + balance into .hdr-r if present
    var hdrR = document.querySelector('.hdr-r');
    if (hdrR && !document.getElementById('htpConnBadge')) {
      var badge = document.createElement('button');
      badge.id = 'htpConnBadge';
      badge.innerHTML = '<span class="dot"></span><span id="htpConnLabel">Connect</span>';
      badge.onclick = function () {
        if (typeof W.connectWallet === 'function') W.connectWallet();
        else if (typeof W.connectKaspa === 'function') W.connectKaspa();
        else if (typeof go === 'function') go('wallet');
      };
      hdrR.insertBefore(badge, hdrR.firstChild);
      startConnBadgePoll();
    }
  }

  function startConnBadgePoll() {
    setInterval(function () {
      var badge = document.getElementById('htpConnBadge');
      var lbl   = document.getElementById('htpConnLabel');
      if (!badge) return;
      var addr = W.connectedAddress || W.htpAddress || W.walletAddress || '';
      if (addr && addr.length > 4) {
        badge.className = 'connected';
        var short = addr.slice(0, 8) + '…' + addr.slice(-4);
        var bal = W.htpBalance || W.walletBalance || '';
        lbl.textContent = bal ? short + ' · ' + parseFloat(bal).toFixed(2) + ' KAS' : short;
      } else {
        badge.className = '';
        lbl.textContent = 'Connect';
      }
    }, 2000);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * BREADCRUMB
   * ───────────────────────────────────────────────────────────────────────── */
  var SECTION_META = {
    overview:  { title: 'Overview',    desc: 'Protocol home and live stats' },
    markets:   { title: 'Markets',     desc: 'Browse and join prediction markets' },
    skill:     { title: 'Skill Games', desc: 'Chess · Connect4 · Checkers — stake KAS' },
    create:    { title: 'Create',      desc: 'Launch a new prediction market' },
    oracle:    { title: 'Oracle',      desc: 'Run a miner oracle node' },
    portfolio: { title: 'Portfolio',   desc: 'Your positions, history, rewards' },
    wallet:    { title: 'Wallet',      desc: 'Connect and manage your Kaspa wallet' },
    kaspa:     { title: 'Kaspa',       desc: 'About the Kaspa network' },
    terms:     { title: 'Terms',       desc: 'Protocol terms and conditions' },
  };

  function injectBreadcrumb() {
    if (document.getElementById('htpBreadcrumb')) return;
    var hdr = document.querySelector('.hdr');
    if (!hdr) return;
    var bc = document.createElement('div');
    bc.id = 'htpBreadcrumb';
    hdr.insertAdjacentElement('afterend', bc);
  }

  function updateBreadcrumb(key) {
    var bc = document.getElementById('htpBreadcrumb');
    if (!bc) return;
    var meta = SECTION_META[key] || { title: key, desc: '' };
    var backBtn = _history.length > 1
      ? '<button class="crumb-back" title="Go back" onclick="window._htpNavBack()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg></button>'
      : '';
    bc.innerHTML = backBtn +
      '<a href="javascript:void(0)" onclick="go(\'overview\')" >HTP</a>' +
      '<span class="sep"> / </span>' +
      '<span style="color:#e2e8f0;font-weight:700">' + meta.title + '</span>' +
      (meta.desc ? '<span class="sep"> — </span><span>' + meta.desc + '</span>' : '');
  }

  W._htpNavBack = function () {
    if (_history.length > 1) {
      _history.pop();
      var prev = _history[_history.length - 1];
      _navigate(prev, false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * MOBILE BOTTOM TAB BAR
   * ───────────────────────────────────────────────────────────────────────── */
  function injectBottomBar() {
    if (document.getElementById('htpBottomBar')) return;
    var bar = document.createElement('div');
    bar.id = 'htpBottomBar';
    var inner = document.createElement('div');
    inner.className = 'bar-inner';

    MOBILE_TABS.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.className = 'tab-item' + (tab.key === 'skill' ? ' play-btn' : '');
      btn.setAttribute('data-tab', tab.key);

      if (tab.key === 'skill') {
        btn.innerHTML =
          '<div class="play-disc">' + tab.svg + '</div>' +
          '<span class="tab-lbl">Play</span>';
      } else if (tab.key === '__more') {
        btn.innerHTML = tab.svg + '<span class="tab-lbl">' + tab.label + '</span>';
        btn.onclick = function () { openMoreSheet(); };
      } else {
        btn.innerHTML = tab.svg + '<span class="tab-lbl">' + tab.label + '</span>';
        btn.onclick = (function (k) { return function () { go(k); }; })(tab.key);
      }

      if (tab.key !== '__more') {
        btn.onclick = (function (k) {
          return function () {
            if (k === '__more') { openMoreSheet(); return; }
            if (k === 'skill') { go('skill'); return; }
            go(k);
          };
        })(tab.key);
      }

      inner.appendChild(btn);
    });

    bar.appendChild(inner);
    document.body.appendChild(bar);
    injectMoreSheet();
  }

  function updateBottomBar(key) {
    var bar = document.getElementById('htpBottomBar');
    if (!bar) return;
    bar.querySelectorAll('.tab-item').forEach(function (btn) {
      var t = btn.getAttribute('data-tab');
      btn.classList.toggle('act', t === key);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * MORE SHEET
   * ───────────────────────────────────────────────────────────────────────── */
  function injectMoreSheet() {
    if (document.getElementById('htpMoreSheet')) return;
    var sheet = document.createElement('div');
    sheet.id = 'htpMoreSheet';

    var MORE_ITEMS = SECTIONS.filter(function (s) {
      return !MOBILE_TABS.some(function (t) { return t.key === s.key; }) && s.key !== '__more';
    });

    var itemsHtml = MORE_ITEMS.map(function (s) {
      return '<button class="sheet-item" onclick="go(\'' + s.key + '\');closeMoreSheet()">' +
        '<div class="si-icon">' + (s.icon || '◈') + '</div>' +
        '<span>' + s.label + '</span>' +
        '</button>';
    }).join('');

    sheet.innerHTML =
      '<div class="sheet-bg" onclick="closeMoreSheet()"></div>' +
      '<div class="sheet-body">' +
        '<div class="sheet-handle"></div>' +
        '<div class="sheet-title">More</div>' +
        itemsHtml +
        '<button class="sheet-close" onclick="closeMoreSheet()">Close</button>' +
      '</div>';

    document.body.appendChild(sheet);
  }

  function openMoreSheet() {
    var s = document.getElementById('htpMoreSheet');
    if (s) s.classList.add('open');
  }

  W.closeMoreSheet = function () {
    var s = document.getElementById('htpMoreSheet');
    if (s) s.classList.remove('open');
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * FAB
   * ───────────────────────────────────────────────────────────────────────── */
  function injectFAB() {
    if (document.getElementById('htpFAB')) return;
    var fab = document.createElement('button');
    fab.id = 'htpFAB';
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    fab.onclick = function () {
      var meta = SECTIONS.find(function (s) { return s.key === _current; });
      if (meta && meta.fabLabel) {
        if (_current === 'skill')   { go('skill'); }
        if (_current === 'markets') { go('create'); }
        if (_current === 'create')  { document.querySelector('[onclick*="createEvent"]') && document.querySelector('[onclick*="createEvent"]').click(); }
      }
    };
    document.body.appendChild(fab);
  }

  function updateFAB(key) {
    var fab = document.getElementById('htpFAB');
    if (!fab) return;
    var meta = SECTIONS.find(function (s) { return s.key === key; });
    var isMobile = window.innerWidth < 960;
    fab.classList.toggle('show', !!meta && !!meta.fab && isMobile);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * DEEP-LINK + HISTORY
   * ───────────────────────────────────────────────────────────────────────── */
  function readDeepLink() {
    var params = new URLSearchParams(W.location.search);
    var tab = params.get('tab') || params.get('section') || 'overview';
    var hash = W.location.hash.replace('#', '');
    if (hash && SECTIONS.some(function (s) { return s.key === hash; })) tab = hash;
    return tab;
  }

  W.addEventListener('popstate', function (e) {
    var state = e.state;
    if (state && state.htpSection) {
      _navigate(state.htpSection, false);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * NAVIGATE
   * ───────────────────────────────────────────────────────────────────────── */
  function _navigate(key, pushState) {
    if (pushState === undefined) pushState = true;
    if (!SECTIONS.some(function (s) { return s.key === key; })) key = 'overview';

    // Hide all views
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('show');
    });

    // Show target
    var target = document.getElementById('v-' + key);
    if (target) {
      target.classList.add('show');
      target.scrollTop = 0;
    }

    _current = key;

    // Add to history stack
    if (pushState) {
      if (_history[_history.length - 1] !== key) {
        _history.push(key);
        if (_history.length > 20) _history.shift();
      }
      W.history.pushState({ htpSection: key }, '', '?tab=' + key);
    } else {
      if (_history.length === 0) _history.push(key);
    }

    // Update UI
    updateBreadcrumb(key);
    updateBottomBar(key);
    updateFAB(key);
    updateDesktopPills(key);

    // Scroll to top
    W.scrollTo({ top: 0, behavior: 'smooth' });

    // Fire event for other modules
    document.dispatchEvent(new CustomEvent('htp:nav', { detail: { key: key } }));
  }

  function updateDesktopPills(key) {
    document.querySelectorAll('.htp-nav-pill').forEach(function (pill) {
      var k = pill.getAttribute('data-section') || pill.getAttribute('onclick');
      if (k && k.indexOf(key) !== -1) {
        pill.classList.add('act');
      } else {
        pill.classList.remove('act');
      }
    });
    // Also update legacy nav-btn
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      var k = btn.getAttribute('onclick') || '';
      btn.classList.toggle('act', k.indexOf("'" + key + "'") !== -1 || k.indexOf('"' + key + '"') !== -1);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * PUBLIC API — override global go() with our version
   * ───────────────────────────────────────────────────────────────────────── */
  var _origGo = W.go;
  W.go = function (key) {
    _navigate(key, true);
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * BOOT
   * ───────────────────────────────────────────────────────────────────────── */
  function boot() {
    injectStyles();
    upgradeDesktopNav();
    injectBreadcrumb();
    injectBottomBar();
    injectFAB();

    // Show initial view
    var initial = readDeepLink();
    _navigate(initial, false);
    if (_history.length === 0) _history.push(initial);

    // Resize FAB on window resize
    W.addEventListener('resize', function () { updateFAB(_current); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
