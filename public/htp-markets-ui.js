// =============================================================================
// htp-markets-ui.js  v4 - single square dot / no lobby circle / robust tabs
// =============================================================================
(function(W) {
  'use strict';

  var CAT_META = {
    'Macro':    { col: '#0ea5e9' },
    'Crypto':   { col: '#a855f7' },
    'Politics': { col: '#ef4444' },
    'Sports':   { col: '#f59e0b' },
    'Kaspa':    { col: '#22c55e' },
    'Skill':    { col: '#06b6d4' },
    'Tech':     { col: '#3b82f6' },
    'Finance':  { col: '#f97316' },
    'Gaming':   { col: '#ec4899' },
    'Other':    { col: '#94a3b8' }
  };
  function catCol(c) { return (CAT_META[c] || { col: '#94a3b8' }).col; }

  function injectCSS() {
    if (document.getElementById('htp-ui4-css')) return;
    var s = document.createElement('style');
    s.id = 'htp-ui4-css';
    s.textContent = [
      '.view{opacity:0;transform:translateY(6px)}',
      '.view.show{display:block;opacity:1;transform:translateY(0);animation:htpFade .2s ease}',
      '@keyframes htpFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
      /* NAV underline - no nodeStatus CSS here, handled by MutationObserver */
      '.nav-btn{position:relative}',
      '.nav-btn.act::after{content:"";position:absolute;left:10px;right:10px;bottom:6px;height:2px;border-radius:2px;background:rgba(73,232,194,.95);box-shadow:0 0 10px rgba(73,232,194,.24)}',
      '.nav-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(73,232,194,.12);color:#49e8c2;border:1px solid rgba(73,232,194,.22);vertical-align:middle}',
      /* Hide Open Matches circle dot */
      '.sgv2-lobby-hdr span>span[style*="border-radius:50%"],.sgv2-lobby-hdr span>span[style*="border-radius: 50%"]{display:none!important}',
      /* Portfolio tabs */
      '#ptSwitchSkill,#ptSwitchEvent,#ptSwitchClaim{padding:9px 20px!important;border-radius:999px!important;border:1px solid rgba(73,232,194,.14)!important;background:rgba(255,255,255,.03)!important;color:#64748b!important;font-size:12px!important;font-weight:700!important;letter-spacing:.04em!important;cursor:pointer!important;transition:all .18s!important;white-space:nowrap}',
      '#ptSwitchSkill:hover,#ptSwitchEvent:hover,#ptSwitchClaim:hover{background:rgba(73,232,194,.08)!important;color:#94a3b8!important}',
      '#ptSwitchSkill.pt-act,#ptSwitchEvent.pt-act,#ptSwitchClaim.pt-act{background:rgba(73,232,194,.12)!important;border-color:#49e8c2!important;color:#49e8c2!important;box-shadow:0 0 14px rgba(73,232,194,.14)!important}',
      /* Markets page */
      '#v-markets .mkt-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:12px;flex-wrap:wrap}',
      '#v-markets .mkt-hdr-left h2{font-size:28px;font-weight:900;color:#f1f5f9;margin:0 0 4px;letter-spacing:-.02em}',
      '#v-markets .mkt-hdr-left p{font-size:12px;color:#475569;margin:0}',
      '#v-markets .mkt-create-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:12px;border:1px solid rgba(73,232,194,.35);background:linear-gradient(135deg,rgba(73,232,194,.14),rgba(99,102,241,.08));color:#49e8c2;font-size:13px;font-weight:800;letter-spacing:.03em;cursor:pointer;white-space:nowrap;transition:all .18s;box-shadow:0 6px 20px rgba(0,0,0,.18)}',
      '#v-markets .mkt-create-btn:hover{background:rgba(73,232,194,.22);box-shadow:0 0 22px rgba(73,232,194,.2),0 8px 24px rgba(0,0,0,.22);transform:translateY(-1px)}',
      '.mkt-fc{position:sticky;top:70px;z-index:14;padding:10px 0;margin-bottom:16px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);background:linear-gradient(180deg,rgba(6,10,18,.96),rgba(6,10,18,.82));border-bottom:1px solid rgba(73,232,194,.07)}',
      '.mkt-slider{display:flex;gap:8px;overflow-x:auto;scroll-behavior:smooth;padding-bottom:4px;scrollbar-width:none;-ms-overflow-style:none}',
      '.mkt-slider::-webkit-scrollbar{display:none}',
      '.mkt-pill{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;border:1px solid rgba(73,232,194,.13);background:rgba(255,255,255,.025);color:#4b5563;font-size:12px;font-weight:700;cursor:pointer;transition:all .17s;white-space:nowrap;user-select:none;position:relative}',
      '.mkt-pill:hover{background:rgba(73,232,194,.07);color:#94a3b8;transform:translateY(-1px)}',
      '.mkt-pill.act{background:rgba(73,232,194,.11);border-color:#49e8c2;color:#49e8c2;box-shadow:0 0 12px rgba(73,232,194,.12)}',
      '.mkt-pill.act::after{content:"";position:absolute;left:14px;right:14px;bottom:2px;height:2px;border-radius:2px;background:var(--pill-col,#49e8c2);opacity:.9}',
      '.mkt-pill .pc{font-size:10px;font-weight:900;padding:0 5px;line-height:16px;border-radius:7px;background:rgba(73,232,194,.08);color:#49e8c2;min-width:18px;text-align:center}',
      '.mkt-sr{display:flex!important;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:nowrap}',
      '.mkt-fi{flex:1;min-width:0;padding:10px 14px 10px 36px;background:rgba(8,13,26,.85);border:1px solid rgba(73,232,194,.11);border-radius:12px;color:#e2e8f0;font-size:13px;font-family:inherit;outline:none;transition:border-color .18s,box-shadow .18s;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'m21 21-4.35-4.35\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center}',
      '.mkt-fi:focus{border-color:rgba(73,232,194,.32);box-shadow:0 0 0 3px rgba(73,232,194,.07)}',
      '.mkt-fi::placeholder{color:#2d3748}',
      '.mkt-sort{flex-shrink:0;width:150px;padding:10px 12px;background:rgba(8,13,26,.85);border:1px solid rgba(73,232,194,.11);border-radius:12px;color:#64748b;font-size:12px;font-weight:600;font-family:inherit;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2349e8c2\' stroke-width=\'2.5\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:calc(100% - 10px) center;padding-right:28px}',
      '#htp-count{font-size:11px;color:#3d4f67;margin-bottom:14px}',
      '#htp-count strong{color:#49e8c2}',
      '.mg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}',
      '.htp-mc{background:rgba(8,13,26,.9);border:1px solid rgba(73,232,194,.08);border-radius:18px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:border-color .2s,transform .2s,box-shadow .2s;box-shadow:0 8px 24px rgba(0,0,0,.2)}',
      '.htp-mc:hover{border-color:rgba(73,232,194,.3);transform:translateY(-3px);box-shadow:0 16px 44px rgba(0,0,0,.32)}',
      '.htp-mc-bar{height:3px}',
      '.htp-mc-cover{height:112px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}',
      '.htp-mc-cover-img{width:100%;height:100%;object-fit:cover}',
      '.htp-mc-cover-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center}',
      '.htp-mc-body{padding:14px 16px;flex:1;display:flex;flex-direction:column}',
      '.htp-mc-top{display:flex;align-items:center;gap:6px;margin-bottom:9px;flex-wrap:wrap}',
      '.htp-mc-badge{font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;letter-spacing:.04em}',
      '.htp-mc-status{font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.06em}',
      '.htp-mc-status.open{background:rgba(34,197,94,.08);color:#22c55e;border:1px solid rgba(34,197,94,.22)}',
      '.htp-mc-status.pending{background:rgba(245,158,11,.08);color:#f59e0b;border:1px solid rgba(245,158,11,.22)}',
      '.htp-mc-status.closed{background:rgba(100,116,139,.08);color:#64748b;border:1px solid rgba(100,116,139,.18)}',
      '.htp-mc-status.cancelled{background:rgba(239,68,68,.08);color:#ef4444;border:1px solid rgba(239,68,68,.18)}',
      '.htp-mc-urgency{font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.2)}',
      '.htp-mc-dl{margin-left:auto;font-size:10px;color:#2d3a50}',
      '.htp-mc-title{font-size:14px;font-weight:700;color:#dde3ed;line-height:1.5;margin:0 0 12px;flex:1}',
      '.htp-mc-bar2{height:7px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.03);display:flex;margin-bottom:6px}',
      '.htp-mc-bar2-yes{border-radius:999px 0 0 999px;transition:width .3s}',
      '.htp-mc-bar2-no{border-radius:0 999px 999px 0;transition:width .3s;background:rgba(239,68,68,.6)}',
      '.htp-mc-odds{display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:12px}',
      '.htp-mc-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(255,255,255,.04);margin-top:auto}',
      '.htp-mc-pool{display:flex;align-items:baseline;gap:4px}',
      '.htp-mc-pool-val{font-size:19px;font-weight:900;color:#49e8c2;font-variant-numeric:tabular-nums;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.htp-mc-pool-unit{font-size:11px;color:#2d3a50}',
      '.htp-mc-ent{font-size:11px;color:#2d3a50}',
      '.htp-empty{grid-column:1/-1;text-align:center;padding:72px 20px;border:1px solid rgba(73,232,194,.07);border-radius:22px;background:linear-gradient(180deg,rgba(8,13,26,.75),rgba(8,13,26,.42))}',
      '.htp-empty-icon{width:64px;height:64px;margin:0 auto 18px;border-radius:18px;background:rgba(73,232,194,.06);border:1px solid rgba(73,232,194,.12);display:flex;align-items:center;justify-content:center}',
      '.htp-empty-title{font-size:17px;font-weight:800;color:#c8d3e0;margin-bottom:8px}',
      '.htp-empty-sub{font-size:12px;color:#475569;max-width:400px;margin:0 auto;line-height:1.6}',
      '.htp-empty-cta{display:inline-flex;align-items:center;gap:6px;margin-top:20px;padding:10px 20px;border-radius:12px;border:1px solid rgba(73,232,194,.28);background:rgba(73,232,194,.07);color:#49e8c2;font-size:12px;font-weight:800;cursor:pointer;transition:all .18s}',
      '.htp-empty-cta:hover{background:rgba(73,232,194,.14);box-shadow:0 0 16px rgba(73,232,194,.12)}',
      '.htp-sk{background:rgba(8,13,26,.72);border:1px solid rgba(73,232,194,.07);border-radius:18px;overflow:hidden;position:relative;min-height:250px}',
      '.htp-sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);animation:htpShim 1.6s infinite}',
      '.htp-sk-top{height:112px;background:linear-gradient(135deg,rgba(73,232,194,.06),rgba(99,102,241,.06))}',
      '.htp-sk-body{padding:14px}',
      '.htp-sk-ln{height:9px;border-radius:5px;background:rgba(255,255,255,.04);margin-bottom:11px}',
      '.htp-sk-ln.a{width:42%}.htp-sk-ln.b{width:80%}.htp-sk-ln.c{width:62%}.htp-sk-ln.d{width:75%}',
      '@keyframes htpShim{100%{transform:translateX(100%)}}',
      '#htp-btt{position:fixed;right:20px;bottom:24px;width:42px;height:42px;border-radius:13px;border:1px solid rgba(73,232,194,.22);background:rgba(8,13,26,.88);color:#49e8c2;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(0,0,0,.26);z-index:50;backdrop-filter:blur(10px)}',
      '#htp-btt:hover{background:rgba(73,232,194,.1);box-shadow:0 0 16px rgba(73,232,194,.16)}',
      '@media(max-width:480px){.mkt-sort{width:120px}.mg{grid-template-columns:1fr}.htp-mc-pool-val{font-size:16px}}'
    ].join('');
    document.head.appendChild(s);
  }

  // --- SQUARE DOT: MutationObserver replaces any circle in nodeStatus -----------
  function squareSpan(col) {
    return '<span style="display:inline-block;width:7px;height:7px;background:' + col + ';border-radius:2px;vertical-align:middle;margin-right:4px;flex-shrink:0"></span>';
  }

  function fixNodeStatus(ns) {
    if (!ns) return;
    var html = ns.innerHTML;
    var hasCircle = html.indexOf('\u25cf') !== -1 || html.indexOf('&#9679;') !== -1 ||
                    html.indexOf('border-radius:50%') !== -1 || html.indexOf('border-radius: 50%') !== -1;
    // Also fix if first child is a bare colored character span wrapping bullet
    if (!hasCircle && html.indexOf('\u25cf') === -1) return;
    var colMatch = html.match(/color\s*:\s*(#[0-9a-fA-F]{3,6})/);
    var col = colMatch ? colMatch[1] : '#22c55e';
    var txtMatch = html.match(/<span[^>]*font-size[^>]*>([^<]+)<\/span>/);
    var txt = txtMatch ? txtMatch[1].trim() : '';
    if (txt) {
      ns.innerHTML = squareSpan(col) + '<span style="font-size:11px;color:var(--muted)">' + txt + '</span>';
    } else {
      var clean = html.replace(/&#9679;|\u25cf/g, '').replace(/<span[^>]*border-radius:\s*50%[^>]*>\s*<\/span>/g, '');
      ns.innerHTML = squareSpan(col) + clean;
    }
  }

  function patchNodeStatus() {
    var ns = document.getElementById('nodeStatus');
    if (!ns) { setTimeout(patchNodeStatus, 300); return; }
    fixNodeStatus(ns);
    var mo = new MutationObserver(function() { setTimeout(function(){ fixNodeStatus(ns); }, 0); });
    mo.observe(ns, { childList: true, subtree: false });
  }

  // --- HELPERS -------------------------------------------------------------------
  function getMkts() { return (W.mkts && W.mkts.length) ? W.mkts : []; }

  var kaspaIconSVG = '<svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M28 4L28 36M28 20L10 4M28 20L10 36" stroke="#49e8c2" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function urgencyChip(m) {
    var raw = m.deadline || m.dead || m.expiresAt || m.resolutionDate || m.cl;
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d) && typeof raw === 'number') d = new Date(raw < 1e12 ? raw * 1000 : raw);
    if (isNaN(d)) return '';
    var diff = d - Date.now();
    if (diff <= 0 || diff > 172800000) return '';
    var hrs = Math.max(1, Math.floor(diff / 3600000));
    return '<span class="htp-mc-urgency">Closes ' + (hrs >= 24 ? Math.floor(hrs / 24) + 'd' : hrs + 'h') + '</span>';
  }

  function renderCard(m) {
    var col = catCol(m.cat);
    var st = m.st || 'open';
    var pool = m.pool || ((m.yesTotal || 0) + (m.noTotal || 0));
    var pFmt = pool >= 1000 ? (pool / 1000).toFixed(1) + 'K' : (pool || 0).toLocaleString();
    var yW = Math.max(m.yP || 0, 2), nW = Math.max(m.nP || 0, 2);
    var cover = m.img
      ? '<div class="htp-mc-cover"><img class="htp-mc-cover-img" src="' + m.img + '" loading="lazy"/></div>'
      : '<div class="htp-mc-cover htp-mc-cover-fallback" style="background:linear-gradient(135deg,' + col + '1a,#060a12 75%)"><svg width="36" height="36" viewBox="0 0 40 40" fill="none"><path d="M28 4L28 36M28 20L10 4M28 20L10 36" stroke="' + col + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/></svg></div>';
    return '<div class="htp-mc" onclick="openM(\'' + m.id + '\')">'
      + '<div class="htp-mc-bar" style="background:linear-gradient(90deg,' + col + ',#6366f1)"></div>'
      + cover
      + '<div class="htp-mc-body">'
      + '<div class="htp-mc-top">'
      + '<span class="htp-mc-badge" style="background:' + col + '15;color:' + col + ';border:1px solid ' + col + '2e">' + (m.cat || 'Other') + '</span>'
      + '<span class="htp-mc-status ' + st + '">' + st.toUpperCase() + '</span>'
      + urgencyChip(m)
      + '<span class="htp-mc-dl">' + (m.cl || '') + '</span>'
      + '</div>'
      + '<p class="htp-mc-title">' + (m.title || 'Untitled') + '</p>'
      + '<div class="htp-mc-bar2"><div class="htp-mc-bar2-yes" style="width:' + yW + '%;background:' + col + '"></div><div class="htp-mc-bar2-no" style="width:' + nW + '%"></div></div>'
      + '<div class="htp-mc-odds"><span style="color:' + col + '">Yes ' + (m.yP || 0) + '%</span><span style="color:rgba(239,68,68,.8)">No ' + (m.nP || 0) + '%</span></div>'
      + '<div class="htp-mc-foot"><div class="htp-mc-pool"><span class="htp-mc-pool-val">' + pFmt + '</span><span class="htp-mc-pool-unit"> KAS pool</span></div><span class="htp-mc-ent">' + (m.ent || 0) + ' positions</span></div>'
      + '</div></div>';
  }

  function skeletonHTML() {
    var c = '<div class="htp-sk"><div class="htp-sk-top"></div><div class="htp-sk-body"><div class="htp-sk-ln a"></div><div class="htp-sk-ln b"></div><div class="htp-sk-ln c"></div><div class="htp-sk-ln d"></div></div></div>';
    return c + c + c;
  }

  function emptyHTML(fCat) {
    var isCat = fCat && fCat !== 'All';
    var title = isCat ? 'No ' + fCat + ' markets yet' : 'No markets yet';
    var sub = isCat ? 'Be the first to create a ' + fCat + ' prediction market on Kaspa.' : 'Prediction markets appear here once created.';
    return '<div class="htp-empty"><div class="htp-empty-icon">' + kaspaIconSVG + '</div>'
      + '<div class="htp-empty-title">' + title + '</div>'
      + '<div class="htp-empty-sub">' + sub + '</div>'
      + '<button class="htp-empty-cta" onclick="go(\'create\')">+ Create the first event</button></div>';
  }

  // --- LAYOUT -------------------------------------------------------------------
  function ensureMarketsLayout() {
    var sec = document.querySelector('#v-markets .mx.sec-pad');
    if (!sec || sec.dataset.htpLayout) return;
    sec.dataset.htpLayout = '1';
    var sh = sec.querySelector('.sh');
    if (sh) sh.outerHTML = '<div class="mkt-hdr"><div class="mkt-hdr-left"><h2>Markets</h2><p>Parimutuel information markets and skill events on Kaspa.</p></div><button class="mkt-create-btn" onclick="go(\'create\')">+ Create Event</button></div>';
    var fb = sec.querySelector('.fb');
    if (fb) {
      var sI = document.getElementById('sI');
      var stC = document.getElementById('stC');
      if (sI) {
        var wrap = document.createElement('div'); wrap.id = 'htpFiltWrap';
        var fcDiv = document.createElement('div'); fcDiv.className = 'mkt-fc';
        var slDiv = document.createElement('div'); slDiv.className = 'mkt-slider'; slDiv.id = 'htpSlider';
        fcDiv.appendChild(slDiv); wrap.appendChild(fcDiv);
        var srDiv = document.createElement('div'); srDiv.className = 'mkt-sr';
        sI.className = 'mkt-fi'; sI.placeholder = 'Search markets...'; srDiv.appendChild(sI);
        var sortSel = document.createElement('select'); sortSel.id = 'htpSort'; sortSel.className = 'mkt-sort';
        sortSel.innerHTML = '<option value="newest">Newest</option><option value="pool">Highest Pool</option><option value="expiry">Expiring Soon</option>';
        sortSel.onchange = function() { W._htpSort = this.value; W.renderM(); };
        srDiv.appendChild(sortSel); wrap.appendChild(srDiv);
        fb.replaceWith(wrap);
        if (stC) stC.style.display = 'none';
      }
    }
    var mG = document.getElementById('mG');
    if (mG && !document.getElementById('htp-count')) {
      var ct = document.createElement('div'); ct.id = 'htp-count';
      mG.parentNode.insertBefore(ct, mG);
    }
  }

  // --- SLIDER -------------------------------------------------------------------
  function buildSlider() {
    var sl = document.getElementById('htpSlider'); if (!sl) return;
    var mkts = getMkts(), fCat = W.fCat || 'All', counts = {};
    mkts.forEach(function(m) { var c = m.cat || 'Other'; counts[c] = (counts[c] || 0) + 1; });
    var html = mktPill('All', 'Show All Events', mkts.length, fCat === 'All', '#49e8c2');
    Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a] || a.localeCompare(b); })
      .forEach(function(c) { html += mktPill(c, c, counts[c], fCat === c, catCol(c)); });
    sl.innerHTML = html;
    var act = sl.querySelector('.mkt-pill.act');
    if (act) act.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function mktPill(key, label, n, isAct, col) {
    return '<button class="mkt-pill' + (isAct ? ' act' : '') + '" style="--pill-col:' + col + '" onclick="window._htpCat(\'' + key + '\')">'
      + '<span>' + label + '</span><span class="pc">' + (n || 0) + '</span></button>';
  }

  function updateNavBadge() {
    var btn = document.querySelector('.nav-btn[data-v="markets"]'); if (!btn) return;
    var b = btn.querySelector('.nav-badge');
    var n = getMkts().length;
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; btn.appendChild(b); }
    b.textContent = n; b.style.display = n > 0 ? 'inline-flex' : 'none';
  }

  function updateCount(shown, total) {
    var el = document.getElementById('htp-count'); if (!el) return;
    if (shown === undefined) { var m = getMkts(); shown = m.length; total = m.length; }
    el.innerHTML = shown === total
      ? '<strong>' + total + '</strong> market' + (total !== 1 ? 's' : '')
      : 'Showing <strong>' + shown + '</strong> of <strong>' + total + '</strong>';
  }

  // --- BACK TO TOP --------------------------------------------------------------
  function ensureBackTop() {
    if (document.getElementById('htp-btt')) return;
    var b = document.createElement('button');
    b.id = 'htp-btt'; b.setAttribute('aria-label', 'Back to top');
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>';
    b.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.body.appendChild(b);
    window.addEventListener('scroll', function() { b.style.display = window.scrollY > 300 ? 'flex' : 'none'; }, { passive: true });
  }

  // --- PORTFOLIO TABS (robust with retry) ----------------------------------------
  var TAB_LABELS = { ptSwitchSkill: 'Games', ptSwitchEvent: 'Markets', ptSwitchClaim: 'Rewards' };

  function applyTabLabels() {
    Object.keys(TAB_LABELS).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = TAB_LABELS[id];
    });
  }

  function patchPortfolioTabs() {
    applyTabLabels();
    var _orig = W.setPortfolioType;
    if (_orig && !_orig._patched) {
      W.setPortfolioType = function(type) {
        _orig(type);
        applyTabLabels();
        var map = { skill: 'ptSwitchSkill', events: 'ptSwitchEvent', claim: 'ptSwitchClaim' };
        Object.keys(map).forEach(function(t) {
          var el = document.getElementById(map[t]);
          if (!el) return;
          el.style.color = '';
          el.style.borderBottomColor = '';
          el.classList.toggle('pt-act', t === type);
        });
      };
      W.setPortfolioType._patched = true;
    }
    var init = document.getElementById('ptSwitchSkill');
    if (init && !document.querySelector('.pt-act')) init.classList.add('pt-act');
    setTimeout(applyTabLabels, 500);
    setTimeout(applyTabLabels, 1500);
    setTimeout(applyTabLabels, 3000);
  }

  // --- MAIN OVERRIDES -----------------------------------------------------------
  W._htpCat = function(c) { W.fCat = c; buildSlider(); W.renderM(); };
  W.setCat = W._htpCat;

  W.buildF = function() { ensureMarketsLayout(); buildSlider(); updateNavBadge(); updateCount(); };

  var _origRenderM = W.renderM;
  W.renderM = function() {
    var g = document.getElementById('mG');
    if (!g) { if (_origRenderM) _origRenderM(); return; }
    var mkts = getMkts().slice(), fCat = W.fCat || 'All', fSr = W.fSr || '', sort = W._htpSort || 'newest', _net;
    try { _net = (W.net || W.HTP_NETWORK || (typeof W.activeNet !== 'undefined' ? W.activeNet : 'tn12')); } catch (e) { _net = 'tn12'; }
    if (!W._htpLoaded && mkts.length === 0) { g.innerHTML = skeletonHTML(); W._htpLoaded = true; setTimeout(function() { if (!getMkts().length) W.renderM(); }, 800); return; }
    var filtered = mkts.filter(function(m) {
      if (fCat !== 'All' && m.cat !== fCat) return false;
      if (_net !== 'both' && m.net !== 'both' && m.net !== _net) return false;
      if (fSr && !(m.title || '').toLowerCase().includes(fSr.toLowerCase())) return false;
      return true;
    });
    filtered.sort(function(a, b) {
      if (sort === 'pool') return (b.pool || 0) - (a.pool || 0);
      if (sort === 'expiry') return new Date(a.deadline || a.cl || 0) - new Date(b.deadline || b.cl || 0);
      return new Date(b.created || 0) - new Date(a.created || 0);
    });
    updateCount(filtered.length, mkts.length); updateNavBadge(); buildSlider();
    g.innerHTML = filtered.length ? filtered.map(renderCard).join('') : emptyHTML(fCat);
  };

  function watchMkts() {
    var last = '';
    setInterval(function() {
      var sig = JSON.stringify((getMkts() || []).map(function(m) { return [m.id, m.cat, m.st, m.pool]; }));
      if (sig !== last) { last = sig; W.buildF(); W.renderM(); }
    }, 1500);
  }

  // --- BOOT ---------------------------------------------------------------------
  function boot() {
    injectCSS();
    ensureBackTop();
    patchNodeStatus();  // watch nodeStatus immediately, replace circles with squares

    function tryInit() {
      if (document.getElementById('mG')) {
        ensureMarketsLayout(); W.buildF(); W.renderM();
        patchPortfolioTabs(); watchMkts();
        var _go = W.go;
        if (typeof _go === 'function' && !_go._htpW) {
          W.go = function(v) { _go(v); if (v === 'markets') setTimeout(function() { W.buildF(); W.renderM(); }, 120); };
          W.go._htpW = true;
        }
      } else { setTimeout(tryInit, 200); }
    }
    tryInit();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
