/**
 * htp-chess-ui.js — HTP Chess Visual Layer v3.0
 *
 * v3.0 changes:
 *  - White pieces: PURE #ffffff, dark outline for contrast on light squares
 *  - Black pieces: PURE #1a1a1a (near-black), no brown tint
 *  - Waiting room: injected via htpShowWaitingRoom() — beautiful pregame lobby
 *  - Pawn promotion modal
 *  - C4 win-line highlight pulse
 */

(function () {
  'use strict';

  // ── Piece colour styles — truly white / truly black ───────────────────────
  // White pieces: solid #ffffff fill, dark stroke so they read on ivory squares
  const WHITE_STYLE = [
    'color:#ffffff',
    '-webkit-text-stroke:2px #2a2a2a',
    'paint-order:stroke fill',
    'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.6))',
    'text-shadow:none',
    'font-size:46px',
    'line-height:1',
    'display:block',
    'pointer-events:none',
    'user-select:none'
  ].join(';');

  // Black pieces: near-black fill, very subtle shadow — NO brown, no filter glow
  const BLACK_STYLE = [
    'color:#1a1a1a',
    '-webkit-text-stroke:0.5px #000000',
    'paint-order:stroke fill',
    'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
    'text-shadow:none',
    'font-size:46px',
    'line-height:1',
    'display:block',
    'pointer-events:none',
    'user-select:none'
  ].join(';');

  const WHITE_PIECES = new Set(['♔','♕','♖','♗','♘','♙']);
  const BLACK_PIECES = new Set(['♚','♛','♜','♝','♞','♟']);

  function colourPiece(el) {
    if (!el || el.nodeType !== 1) return;
    const tag = el.tagName;
    if (tag !== 'SPAN' && tag !== 'TD' && tag !== 'DIV') return;
    const txt = el.textContent.trim();
    if (!txt || txt.length > 2) return;
    if (WHITE_PIECES.has(txt)) {
      el.setAttribute('style', WHITE_STYLE);
      el.dataset.htpColoured = 'w';
    } else if (BLACK_PIECES.has(txt)) {
      el.setAttribute('style', BLACK_STYLE);
      el.dataset.htpColoured = 'b';
    }
  }

  function colourSubtree(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('span, td, div').forEach(colourPiece);
    colourPiece(root);
  }

  // MutationObserver — intercepts the moment any piece hits the DOM
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) { colourPiece(n); colourSubtree(n); }
      }
      if (m.type === 'characterData') colourPiece(m.target.parentElement);
      if (m.type === 'attributes' && m.attributeName === 'style') colourPiece(m.target);
    }
  });

  function startObserver() {
    colourSubtree(document.body);
    observer.observe(document.body, {
      childList: true, subtree: true,
      characterData: true, attributes: true,
      attributeFilter: ['style', 'class']
    });
    console.log('[HTP-UI v3] Chess piece colourer active — pure white/black');
  }

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  // Patch render functions
  const RENDER_FNS = [
    'renderChessBoard','renderChessBoardFull','renderChessBoardUI',
    'renderBoard','drawBoard','updateBoard'
  ];
  function patchRenderFunctions() {
    RENDER_FNS.forEach(fn => {
      if (typeof window[fn] === 'function' && !window[fn]._htpColourPatched) {
        const orig = window[fn];
        window[fn] = function (...args) {
          const r = orig.apply(this, args);
          setTimeout(() => colourSubtree(document.body), 30);
          return r;
        };
        window[fn]._htpColourPatched = true;
      }
    });
  }
  const _patchPoll = setInterval(() => {
    if (RENDER_FNS.some(fn => typeof window[fn] === 'function' && !window[fn]._htpColourPatched)) {
      patchRenderFunctions();
    }
  }, 500);
  setTimeout(() => clearInterval(_patchPoll), 30000);

  // ── Layout CSS ─────────────────────────────────────────────────────────────
  const LAYOUT_CSS = `
    #chessBoardWrap,.chess-board-wrap,#chessBoard,.chess-board,.chessboard {
      box-shadow:0 0 0 2px #4effe5,0 0 20px 4px rgba(78,255,229,0.15)!important;
      border-radius:4px!important;overflow:hidden!important;
    }
    .sq.light,td.light,[data-sq="light"],.light-sq{background:#eeeed2!important}
    .sq.dark,td.dark,[data-sq="dark"],.dark-sq{background:#769656!important}
    .sq.selected,.sq.sel,td.selected{
      background:rgba(246,246,105,0.35)!important;
      box-shadow:inset 0 0 0 3px rgba(246,246,105,0.8)!important;
    }
    .move-dot,.legal-dot{
      background:rgba(0,0,0,0.2)!important;
      box-shadow:none!important;
    }
    .capture-ring{border-color:rgba(0,0,0,0.18)!important;box-shadow:none!important}
    .coord,.sq-coord,.board-coord{
      color:#4effe5!important;font-weight:700!important;opacity:0.75!important;
      font-size:9.5px!important;
    }
    .timer.active,.clock.active{color:#4effe5!important;border-color:rgba(78,255,229,0.4)!important}
    .timer.low,.clock.low{color:#ff5555!important;border-color:rgba(255,85,85,0.5)!important}
    /* Remove any inherited tint from lobby previews */
    .match-preview,.lobby-card,.preview-board,[class*="preview"]{
      filter:none!important;-webkit-filter:none!important;
    }
  `;

  if (!document.getElementById('htp-chess-ui-layout')) {
    const st = document.createElement('style');
    st.id = 'htp-chess-ui-layout';
    st.textContent = LAYOUT_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ── Waiting Room ───────────────────────────────────────────────────────────
  // Called by htp-events.js after escrow TX is confirmed, before opponent joins.
  // Usage: htpShowWaitingRoom({ matchId, game, timeControl, series, stakeKas, myAddr })
  window.htpShowWaitingRoom = function (opts) {
    opts = opts || {};
    const game        = opts.game || 'chess';
    const timeControl = opts.timeControl || '5+0';
    const series      = opts.series || 'Single game';
    const stakeKas    = parseFloat(opts.stakeKas || 5);
    const matchId     = opts.matchId || '—';
    const myAddr      = opts.myAddr || '';
    const shortAddr   = myAddr ? myAddr.slice(0,10) + '…' + myAddr.slice(-6) : 'kaspa:qr…';

    const gameIcons = { chess: '♟', connect4: '🔴', c4: '🔴', checkers: '⬛' };
    const gameLabels = { chess: 'Chess', connect4: 'Connect 4', c4: 'Connect 4', checkers: 'Checkers' };
    const icon  = gameIcons[game]  || '♟';
    const label = gameLabels[game] || 'Chess';

    // Remove stale waiting room if exists
    const stale = document.getElementById('htp-waiting-room');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'htp-waiting-room';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.82);
      display:flex;align-items:center;justify-content:center;
      z-index:8888;padding:16px;backdrop-filter:blur(4px);
    `;

    overlay.innerHTML = `
      <div style="
        background:#141416;border:1px solid rgba(255,255,255,0.08);
        border-radius:16px;width:100%;max-width:440px;overflow:hidden;
        box-shadow:0 24px 80px rgba(0,0,0,0.7);
      ">
        <!-- Header -->
        <div style="
          background:#1a1a1d;padding:18px 22px;
          border-bottom:1px solid rgba(255,255,255,0.06);
          display:flex;align-items:center;gap:12px;
        ">
          <div style="
            width:40px;height:40px;border-radius:9px;
            background:rgba(73,232,194,0.08);border:1.5px solid rgba(73,232,194,0.2);
            display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;
          ">${icon}</div>
          <div>
            <div style="font-size:15px;font-weight:600;color:#e8e8ea">${label} · ${timeControl}</div>
            <div style="font-size:11px;color:#7a7a82;margin-top:2px">${series}</div>
          </div>
          <div style="
            margin-left:auto;background:rgba(73,232,194,0.08);
            border:1px solid rgba(73,232,194,0.22);color:#49e8c2;
            font-size:11px;font-weight:600;padding:4px 11px;border-radius:20px;
          ">ESCROW LOCKED</div>
        </div>

        <!-- Body -->
        <div style="padding:22px;display:flex;flex-direction:column;gap:18px;">

          <!-- Players -->
          <div style="display:grid;grid-template-columns:1fr 36px 1fr;align-items:center;gap:8px;">
            <!-- You -->
            <div style="
              background:#1a1a1d;border:1px solid rgba(73,232,194,0.25);
              border-radius:10px;padding:14px 10px;text-align:center;
              background:rgba(73,232,194,0.03);
            ">
              <div style="
                width:36px;height:36px;border-radius:50%;
                background:rgba(73,232,194,0.12);border:1.5px solid rgba(73,232,194,0.35);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 8px;font-size:16px;
              ">🧑</div>
              <div style="font-size:12px;font-weight:600;color:#e8e8ea;">You</div>
              <div style="font-size:9px;color:#7a7a82;font-family:monospace;margin-top:3px;">${shortAddr}</div>
            </div>
            <div style="text-align:center;font-size:11px;font-weight:700;color:#3a3a42;">VS</div>
            <!-- Opponent waiting -->
            <div style="
              background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);
              border-radius:10px;padding:14px 10px;text-align:center;
            ">
              <div id="htp-wr-opp-avatar" style="
                width:36px;height:36px;border-radius:50%;
                background:#242428;border:1.5px solid rgba(255,255,255,0.1);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 8px;font-size:18px;color:#3a3a42;
              ">?</div>
              <div id="htp-wr-opp-name" style="font-size:12px;font-weight:600;color:#3a3a42;">Waiting…</div>
              <div style="font-size:9px;color:#3a3a42;margin-top:3px;">open challenge</div>
            </div>
          </div>

          <!-- Match details grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:11px 13px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#7a7a82;margin-bottom:4px;">Game</div>
              <div style="font-size:13px;font-weight:600;color:#e8e8ea;">${label}</div>
            </div>
            <div style="background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:11px 13px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#7a7a82;margin-bottom:4px;">Time Control</div>
              <div style="font-size:13px;font-weight:600;color:#e8e8ea;font-family:monospace;">${timeControl}</div>
            </div>
            <div style="background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:11px 13px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#7a7a82;margin-bottom:4px;">Series</div>
              <div style="font-size:13px;font-weight:600;color:#e8e8ea;">${series}</div>
            </div>
            <div style="background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:11px 13px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.07em;color:#7a7a82;margin-bottom:4px;">Colors</div>
              <div style="font-size:13px;font-weight:600;color:#49e8c2;">Random ⟳</div>
            </div>
          </div>

          <!-- Escrow -->
          <div style="background:#1a1a1d;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;">
            <div style="
              font-size:10px;color:#7a7a82;margin-bottom:10px;
              display:flex;align-items:center;gap:6px;
            ">
              <span style="width:6px;height:6px;border-radius:50%;background:#49e8c2;display:inline-block;flex-shrink:0;"></span>
              Escrow locked on-chain · Auto-payout on result
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:20px;font-weight:700;color:#49e8c2;font-family:monospace;">${stakeKas} KAS</div>
                <div style="font-size:11px;color:#7a7a82;margin-top:1px;">Winner takes all · No KYC</div>
              </div>
              <div style="
                font-size:11px;color:#49e8c2;
                background:rgba(73,232,194,0.08);padding:5px 12px;
                border-radius:20px;border:1px solid rgba(73,232,194,0.2);
              ">🔒 On-chain</div>
            </div>
          </div>

          <!-- Status row -->
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="htp-wr-spinner" style="
              width:14px;height:14px;border-radius:50%;
              border:2px solid rgba(255,255,255,0.08);border-top-color:#49e8c2;
              animation:htpSpin .7s linear infinite;flex-shrink:0;
            "></div>
            <span id="htp-wr-status" style="font-size:12px;color:#7a7a82;">
              Sharing match link · Anyone can join
            </span>
          </div>

          <!-- Cancel -->
          <button id="htp-wr-cancel" style="
            width:100%;padding:12px;
            background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);
            color:#ef4444;font-size:13px;font-weight:600;border-radius:9px;
            cursor:pointer;font-family:inherit;transition:background .2s;
          ">Cancel &amp; Refund Escrow</button>
        </div>
      </div>

      <style>
        @keyframes htpSpin { to { transform:rotate(360deg); } }
        @keyframes htpOppIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
        #htp-wr-cancel:hover { background:rgba(239,68,68,0.14)!important; }
      </style>
    `;

    document.body.appendChild(overlay);

    // Cancel button
    overlay.querySelector('#htp-wr-cancel').addEventListener('click', () => {
      if (typeof window.htpCancelMatch === 'function') window.htpCancelMatch(matchId);
      overlay.remove();
    });

    // Status cycle
    const msgs = [
      'Sharing match link · Anyone can join',
      'Waiting for opponent to deposit escrow…',
      'Match ID copied to clipboard',
      'Opponent will be assigned colors randomly…'
    ];
    let phase = 0;
    const statusInterval = setInterval(() => {
      phase = (phase + 1) % msgs.length;
      const el = document.getElementById('htp-wr-status');
      if (el) el.textContent = msgs[phase];
    }, 4000);

    // Return controller so caller can dismiss when opponent joins
    return {
      dismiss: function () {
        clearInterval(statusInterval);
        overlay.remove();
      },
      setOpponent: function (addr) {
        clearInterval(statusInterval);
        const sp = document.getElementById('htp-wr-spinner');
        const st = document.getElementById('htp-wr-status');
        const av = document.getElementById('htp-wr-opp-avatar');
        const nm = document.getElementById('htp-wr-opp-name');
        if (sp) { sp.style.borderTopColor = '#4ade80'; }
        if (st) { st.textContent = 'Opponent joined! Starting game…'; st.style.color = '#4ade80'; }
        if (av) { av.textContent = '🧑'; av.style.color = '#e8e8ea'; av.style.animation = 'htpOppIn .4s ease'; av.style.background = 'rgba(73,232,194,0.08)'; av.style.borderColor = 'rgba(73,232,194,0.35)'; }
        if (nm) { nm.textContent = addr ? addr.slice(0,10)+'…' : 'Opponent'; nm.style.color = '#e8e8ea'; }
        setTimeout(() => overlay.remove(), 1800);
      }
    };
  };

  // ── Pawn Promotion Modal ───────────────────────────────────────────────────
  window.htpShowPromotionModal = function (color, callback) {
    const pieces = color === 'w'
      ? [{ sym: '♕', name: 'q' }, { sym: '♖', name: 'r' }, { sym: '♗', name: 'b' }, { sym: '♘', name: 'n' }]
      : [{ sym: '♛', name: 'q' }, { sym: '♜', name: 'r' }, { sym: '♝', name: 'b' }, { sym: '♞', name: 'n' }];

    const overlay = document.createElement('div');
    overlay.id = 'htp-promotion-modal';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.75);display:flex;align-items:center;
      justify-content:center;z-index:9999;backdrop-filter:blur(3px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#141416;border:1px solid rgba(73,232,194,0.3);border-radius:14px;
      padding:28px;display:flex;gap:16px;flex-direction:column;align-items:center;
      box-shadow:0 20px 60px rgba(0,0,0,0.8);
    `;
    box.innerHTML = '<div style="color:#49e8c2;font-size:13px;font-weight:600;letter-spacing:0.06em;">PROMOTE PAWN</div>';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;';

    let resolved = false;
    function choose(piece) {
      if (resolved) return;
      resolved = true;
      overlay.remove();
      clearTimeout(timer);
      callback(piece);
    }

    pieces.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = p.sym;
      btn.style.cssText = `
        font-size:42px;background:#1a1a1d;border:1.5px solid rgba(255,255,255,0.1);
        border-radius:10px;cursor:pointer;padding:10px 14px;
        color:${color === 'w' ? '#ffffff' : '#1a1a1a'};
        ${color === 'w' ? '-webkit-text-stroke:1.5px #2a2a2a;' : ''}
        transition:border-color .15s,background .15s;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(73,232,194,0.5)'; btn.style.background = 'rgba(73,232,194,0.06)'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.background = '#1a1a1d'; });
      btn.addEventListener('click', () => choose(p.name));
      row.appendChild(btn);
    });

    box.appendChild(row);
    const countdown = document.createElement('div');
    countdown.style.cssText = 'color:#3a3a42;font-size:11px;margin-top:4px;';
    countdown.textContent = 'Auto-selects Queen in 10s';
    box.appendChild(countdown);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const timer = setTimeout(() => choose('q'), 10000);
  };

  console.log('[HTP-UI v3] Loaded — pure white/black pieces + waiting room + promotion modal');
})();
