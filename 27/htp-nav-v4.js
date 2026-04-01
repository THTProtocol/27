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
 *  6. BACK-BTN — browser back/forward works correctly
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
      '#htpBreadcrumb .crumb-back {',
      '  display:inline-flex; align-items:center; gap:4px; margin-right:8px;',
      '  color:#64748b; cursor:pointer; font-size:11px; font-weight:600;',
      '  padding:3px 8px; border-radius:10px; border:none; background:none;',
      '  transition:all .15s;',
      '}',
      '#htpBreadcrumb .crumb-back:hover { color:#e2e8f0; background:rgba(255,255,255,.05); }',

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
      '#htpMoreSheet .sheet-item .si-sub { font-size:11px; color:#64748b; font-weight:400; }',
      '#htpMoreSheet .sheet-cancel {',
      '  display:block; width:calc(100% - 32px); margin:8px 16px 8px;',
      '  padding:14px; border-radius:12px;',
      '  background:rgba(255,255,255,.06); border:none; color:#e2e8f0;',
      '  font-size:14px; font-weight:700; cursor:pointer;',
      '}',

      /* ── FAB ── */
      '#htpFAB {',
      '  position:fixed; bottom:74px; right:18px; z-index:9400;',
      '  display:none; align-items:center; gap:8px;',
      '  background:linear-gradient(135deg,#49e8c2,#3b82f6);',
      '  color:#0f172a; border:none; border-radius:28px;',
      '  padding:13px 20px; font-size:13px; font-weight:800;',
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
    overview:  { title: 'Overview',  desc: 'Protocol home and live stats' },
    markets:   { title: 'Markets',   desc: 'Browse and join prediction markets' },
    skill:     { title: 'Skill Games', desc: 'Chess · Connect4 · Checkers — stake KAS' },
    create:    { title: 'Create',    desc: 'Launch a new prediction market' },
    oracle:    { title: 'Oracle',    desc: 'Run a miner oracle node' },
    portfolio: { title: 'Portfolio', desc: 'Your positions, history, rewards' },
    wallet:    { title: 'Wallet',    desc: 'Connect and manage your Kaspa wallet' },
    kaspa:     { title: 'Kaspa',     desc: 'About the Kaspa network' },
    terms:     { title: 'Terms',     desc: 'Protocol terms and conditions' },
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
      ? '<button class="crumb-back" onclick="window._htpNavBack()">&#8592; Back</button>'
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
      btn.dataset.key = tab.key;

      if (tab.key === 'skill') {
        btn.innerHTML =
          '<div class="play-disc">' + tab.svg + '</div>' +
          '<span class="tab-lbl">Play</span>';
      } else {
        btn.innerHTML = tab.svg + '<span class="tab-lbl">' + tab.label + '</span>';
      }

      btn.addEventListener('click', function () {
        if (tab.key === '__more') { openMoreSheet(); return; }
        _navigate(tab.key, true);
      });
      inner.appendChild(btn);
    });

    bar.appendChild(inner);
    document.body.appendChild(bar);
  }

  function updateBottomBar(key) {
    var items = document.querySelectorAll('#htpBottomBar .tab-item');
    items.forEach(function (it) {
      var isMobileKey = MOBILE_TABS.some(function (t) { return t.key === key && t.key === it.dataset.key; });
      it.classList.toggle('act', isMobileKey);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * MORE SHEET
   * ───────────────────────────────────────────────────────────────────────── */
  var MORE_ITEMS = [
    { key: 'create',   icon: '✦', label: 'Create Market',  sub: 'Launch a new prediction market' },
    { key: 'oracle',   icon: '⬡', label: 'Oracle Node',    sub: 'Run a miner oracle' },
    { key: 'wallet',   icon: '◈', label: 'Wallet',         sub: 'Connect your Kaspa wallet' },
    { key: 'kaspa',    icon: '⬡', label: 'About Kaspa',    sub: 'Learn about the network' },
    { key: 'terms',    icon: '✦', label: 'Terms',          sub: 'Protocol terms' },
  ];

  function injectMoreSheet() {
    if (document.getElementById('htpMoreSheet')) return;
    var sheet = document.createElement('div');
    sheet.id = 'htpMoreSheet';
    sheet.innerHTML = '<div class="sheet-bg" onclick="closeMoreSheet()"></div>' +
      '<div class="sheet-body">' +
      '<div class="sheet-handle"></div>' +
      '<div class="sheet-title">More</div>' +
      MORE_ITEMS.map(function (it) {
        return '<button class="sheet-item" onclick="closeMoreSheet();_navigate(\''+it.key+'\',true)">' +
          '<div class="si-icon">' + it.icon + '</div>' +
          '<div><div>' + it.label + '</div><div class="si-sub">' + it.sub + '</div></div>' +
          '</button>';
      }).join('') +
      '<button class="sheet-cancel" onclick="closeMoreSheet()">Cancel</button>' +
      '</div>';
    document.body.appendChild(sheet);
  }

  W.openMoreSheet  = function () { document.getElementById('htpMoreSheet').classList.add('open'); };
  W.closeMoreSheet = function () { document.getElementById('htpMoreSheet').classList.remove('open'); };

  /* ─────────────────────────────────────────────────────────────────────────
   * FAB
   * ───────────────────────────────────────────────────────────────────────── */
  function injectFAB() {
    if (document.getElementById('htpFAB')) return;
    var fab = document.createElement('button');
    fab.id = 'htpFAB';
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      '<span id="htpFABLabel">Create Match</span>';
    fab.addEventListener('click', function () {
      var sec = SECTIONS.find(function (s) { return s.key === _current; });
      if (_current === 'skill') {
        var btn = document.querySelector('[onclick*="createMatchWithLobby"]') ||
                  document.querySelector('[onclick*="createMatch"]');
        if (btn) { btn.click(); return; }
        if (typeof W.createMatchWithLobby === 'function') { W.createMatchWithLobby(); return; }
        _navigate('create', true);
      } else if (_current === 'markets') {
        var fEl = document.querySelector('#v-markets input[type="text"]');
        if (fEl) { fEl.focus(); fEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else {
        _navigate('create', true);
      }
    });
    document.body.appendChild(fab);
  }

  function updateFAB(key) {
    var fab = document.getElementById('htpFAB');
    var lbl = document.getElementById('htpFABLabel');
    if (!fab) return;
    var sec = SECTIONS.find(function (s) { return s.key === key; });
    if (sec && sec.fab) {
      fab.className = 'show';
      if (lbl) lbl.textContent = sec.fabLabel || 'Go';
    } else {
      fab.className = '';
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * SECTION HEADER INJECTION
   * ───────────────────────────────────────────────────────────────────────── */
  function injectSectionHeaders() {
    SECTIONS.forEach(function (sec) {
      var view = document.getElementById('v-' + sec.key);
      if (!view || view.querySelector('.htp-section-header')) return;
      var meta = SECTION_META[sec.key];
      if (!meta) return;
      var hd = document.createElement('div');
      hd.className = 'htp-section-header';
      hd.innerHTML = '<h1>' + meta.title + '</h1><p>' + meta.desc + '</p>';
      view.insertBefore(hd, view.firstChild);
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * CORE NAVIGATION
   * ───────────────────────────────────────────────────────────────────────── */
  function _navigate(key, pushHistory) {
    if (!key || key === _current && document.getElementById('v-' + key)) {
      // If same section, just scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Validate section exists
    var viewEl = document.getElementById('v-' + key);
    if (!viewEl) {
      // Fallback: try calling native go()
      if (typeof W.go === 'function') { W.go(key); }
      return;
    }

    _current = key;
    if (pushHistory) {
      _history.push(key);
      if (_history.length > 30) _history.shift();
    }

    // Hide all views
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('show');
    });

    // Show target with transition
    requestAnimationFrame(function () {
      viewEl.classList.add('show');
      window.scrollTo(0, 0);
    });

    // Update all nav indicators
    updateDesktopNav(key);
    updateBottomBar(key);
    updateBreadcrumb(key);
    updateFAB(key);
    document.body.className = document.body.className
      .replace(/\bon-\S+/g, '').trim() + ' on-' + key;

    // URL deep-link
    if (pushHistory && W.history && W.history.pushState) {
      try {
        W.history.pushState({ htpTab: key }, '', '?tab=' + key);
      } catch (e) {}
    }

    // Close mobile menu
    var nav = document.querySelector('.hdr-nav');
    if (nav) nav.classList.remove('open');

    // Trigger section-specific loaders
    triggerSectionLoad(key);
  }

  function updateDesktopNav(key) {
    document.querySelectorAll('.htp-nav-pill, .nav-btn').forEach(function (btn) {
      var v = btn.dataset.v || btn.dataset.key;
      btn.classList.toggle('act', v === key);
    });
  }

  function triggerSectionLoad(key) {
    if (key === 'portfolio') {
      if (typeof W.renderSkillPortfolio === 'function')  W.renderSkillPortfolio('skill-portfolio');
      if (typeof W.renderClaimableRewards === 'function') W.renderClaimableRewards('claimsList');
      if (typeof W.renderMatchHistory === 'function')     W.renderMatchHistory('historyList');
      if (typeof W.loadPortfolioPositions === 'function') setTimeout(W.loadPortfolioPositions, 80);
    }
    if (key === 'oracle') {
      if (typeof W.renderOracleEventsPanel === 'function')  setTimeout(W.renderOracleEventsPanel, 80);
      if (typeof W.htpOracleDaemonSyncInputs === 'function') W.htpOracleDaemonSyncInputs();
    }
    if (key === 'markets') {
      if (typeof W.loadMarkets === 'function') setTimeout(W.loadMarkets, 80);
    }
    if (key === 'skill') {
      if (typeof W.renderMatchLobby === 'function') setTimeout(W.renderMatchLobby, 80);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * PATCH window.go()
   * ───────────────────────────────────────────────────────────────────────── */
  function patchGoFunction() {
    var orig = W.go;
    if (orig && orig._v4patched) return;
    W.go = function (key) {
      _navigate(key, true);
      if (orig && !orig._v4patched) {
        try { orig.call(W, key); } catch (e) {}
      }
    };
    W.go._v4patched = true;
    W._navigate = _navigate;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * DEEP-LINK ON LOAD
   * ───────────────────────────────────────────────────────────────────────── */
  function handleDeepLink() {
    var params = new URLSearchParams(W.location.search);
    var tab    = params.get('tab');
    var hash   = W.location.hash.replace('#', '');
    var target = tab || hash || 'overview';
    var valid  = SECTIONS.some(function (s) { return s.key === target; });
    if (valid) {
      setTimeout(function () { _navigate(target, true); }, 400);
    } else {
      _navigate('overview', true);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * BROWSER BACK/FORWARD
   * ───────────────────────────────────────────────────────────────────────── */
  W.addEventListener('popstate', function (e) {
    if (e.state && e.state.htpTab) {
      _navigate(e.state.htpTab, false);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────
   * HAMBURGER TOGGLE (mobile header menu)
   * ───────────────────────────────────────────────────────────────────────── */
  function patchHamburger() {
    var toggle = document.querySelector('.menu-toggle') ||
                 document.getElementById('menuToggle')  ||
                 document.querySelector('[onclick*="hdr-nav"]');
    if (toggle && !toggle._v4patched) {
      toggle._v4patched = true;
      var orig = toggle.onclick;
      toggle.onclick = function (e) {
        var nav = document.querySelector('.hdr-nav');
        if (nav) nav.classList.toggle('open');
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * KEYBOARD SHORTCUTS
   * ───────────────────────────────────────────────────────────────────────── */
  function initKeyboard() {
    W.addEventListener('keydown', function (e) {
      // Alt+number to jump sections
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        var idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < SECTIONS.length) {
          e.preventDefault();
          _navigate(SECTIONS[idx].key, true);
        }
      }
      // Escape: close overlays
      if (e.key === 'Escape') {
        W.closeMoreSheet && W.closeMoreSheet();
        var sheet = document.getElementById('htpMoreSheet');
        if (sheet) sheet.classList.remove('open');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * SWIPE GESTURE (mobile left/right to switch main sections)
   * ───────────────────────────────────────────────────────────────────────── */
  function initSwipe() {
    var MOBILE_ORDER = ['overview', 'markets', 'skill', 'portfolio'];
    var startX = 0, startY = 0;
    document.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
      var idx = MOBILE_ORDER.indexOf(_current);
      if (idx === -1) return;
      if (dx < 0 && idx < MOBILE_ORDER.length - 1) _navigate(MOBILE_ORDER[idx + 1], true);
      if (dx > 0 && idx > 0) _navigate(MOBILE_ORDER[idx - 1], true);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * BOOT
   * ───────────────────────────────────────────────────────────────────────── */
  function boot() {
    injectStyles();
    injectBreadcrumb();
    injectBottomBar();
    injectMoreSheet();
    injectFAB();
    upgradeDesktopNav();
    injectSectionHeaders();
    patchGoFunction();
    patchHamburger();
    initKeyboard();
    initSwipe();
    handleDeepLink();
    console.log('%c[HTP Nav v4] ✓ Desktop pill nav · Mobile bottom bar · FAB · Breadcrumb · Deep-link · Swipe', 'color:#49e8c2;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 600); });
  } else {
    setTimeout(boot, 600);
  }
  setTimeout(boot, 2000); // safety re-run

})(window);
