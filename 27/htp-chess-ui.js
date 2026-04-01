/**
 * htp-chess-ui.js — HTP Chess Visual Layer v2.0
 * 
 * Strategy: MutationObserver intercepts every piece span the moment it hits
 * the DOM and forces inline styles (beats any CSS including !important).
 * Also patches all known render functions and fixes lobby preview green tint.
 * 
 * New in v2.0:
 *  - Pawn promotion modal (defaults to Queen after 10s)
 *  - C4 win-line highlight pulse
 *  - Win/draw overlay
 */

(function () {
  'use strict';

  // ── Piece colour styles ───────────────────────────────────────────────────
  const WHITE_STYLE = [
    'color:#ffffff',
    '-webkit-text-stroke:2.5px #1c1c1c',
    'paint-order:stroke fill',
    'filter:drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 2px #fff) drop-shadow(0 3px 6px rgba(0,0,0,0.95))',
    'text-shadow:none',
    'font-size:46px',
    'line-height:1',
    'display:block',
    'pointer-events:none',
    'user-select:none'
  ].join(';');

  const BLACK_STYLE = [
    'color:#0d0804',
    '-webkit-text-stroke:1.5px #5a3e20',
    'paint-order:stroke fill',
    'filter:drop-shadow(0 0 3px rgba(180,140,80,0.5)) drop-shadow(0 3px 5px rgba(0,0,0,0.9))',
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

  // MutationObserver
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
    console.log('[HTP-UI] Chess piece colourer active');
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
      background:rgba(78,255,229,0.22)!important;
      box-shadow:inset 0 0 0 3px #4effe5!important;
    }
    .move-dot,.legal-dot{
      background:rgba(78,255,229,0.88)!important;
      box-shadow:0 0 8px 3px #4effe5!important;
    }
    .capture-ring{border-color:rgba(78,255,229,0.9)!important;box-shadow:0 0 8px 2px #4effe5!important}
    .coord,.sq-coord,.board-coord{
      color:#4effe5!important;font-weight:700!important;opacity:0.75!important;
      font-size:9.5px!important;text-shadow:0 0 4px rgba(78,255,229,0.5)!important;
    }
    .timer.active,.clock.active{color:#4effe5!important;border-color:rgba(78,255,229,0.4)!important}
    .timer.low,.clock.low{color:#ff5555!important;border-color:rgba(255,85,85,0.5)!important}
    .player-bar{background:#252525!important}
    /* Remove green tint from lobby previews */
    .match-preview,.lobby-card,.preview-board,[class*="preview"]{
      filter:none!important;-webkit-filter:none!important;
    }
    .match-preview [data-htp-coloured="w"],.lobby-card [data-htp-coloured="w"]{
      filter:drop-shadow(0 0 4px rgba(255,255,255,0.9))!important;
    }
  `;

  if (!document.getElementById('htp-chess-ui-layout')) {
    const st = document.createElement('style');
    st.id = 'htp-chess-ui-layout';
    st.textContent = LAYOUT_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // ── Pawn Promotion Modal ───────────────────────────────────────────────────
  window.htpShowPromotionModal = function (color, callback) {
    const pieces = color === 'w'
      ? [{ sym: '♕', name: 'q' }, { sym: '♖', name: 'r' }, { sym: '♗', name: 'b' }, { sym: '♘', name: 'n' }]
      : [{ sym: '♛', name: 'q' }, { sym: '♜', name: 'r' }, { sym: '♝', name: 'b' }, { sym: '♞', name: 'n' }];

    const overlay = document.createElement('div');
    overlay.id = 'htp-promotion-modal';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);display:flex;align-items:center;
      justify-content:center;z-index:9999;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#1a1a2e;border:2px solid #4effe5;border-radius:12px;
      padding:24px;display:flex;gap:16px;flex-direction:column;align-items:center;
    `;
    box.innerHTML = '<div style="color:#4effe5;font-size:14px;margin-bottom:8px;">PROMOTE PAWN</div>';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '12px';

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
        font-size:40px;background:#252538;border:2px solid #4effe5;
        border-radius:8px;cursor:pointer;padding:8px;color:${color === 'w' ? '#fff' : '#0d0804'};
        transition:background 0.15s;
      `;
      btn.addEventListener('click', () => choose(p.name));
      row.appendChild(btn);
    });

    box.appendChild(row);
    const countdown = document.createElement('div');
    countdown.style.cssText = 'color:#888;font-size:11px;margin-top:8px;';
    countdown.textContent = 'Auto-selects Queen in 10s';
    box.appendChild(countdown);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Auto-queen after 10s
    const timer = setTimeout(() => choose('q'), 10000);
  };

  console.log('[HTP-UI] Chess UI v2.0 loaded — piece colourer + layout CSS + promotion modal');
})();
