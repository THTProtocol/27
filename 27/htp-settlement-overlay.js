/**
 * htp-settlement-overlay.js — v3.0
 * Cinematic win/lose/draw overlay.
 * Depends on: htp-fee-shim.js (window.HTPFee)
 * Listens to: htp:settlement:complete CustomEvent
 */
;(function(W) {
  'use strict';

  var EXPLORER_BASE = 'https://explorer-tn12.kaspa.org/txs/';
  var DISMISS_MS    = 8000;

  function injectStyles() {
    if (document.getElementById('htp-ov3-style')) return;
    var s = document.createElement('style');
    s.id = 'htp-ov3-style';
    s.textContent = [
      '.htp-ov3-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;}',
      '.htp-ov3-card{background:#0f172a;border:1px solid rgba(73,232,194,0.22);border-radius:20px;padding:36px 32px 28px;max-width:440px;width:93%;font-family:Inter,sans-serif;color:#e2e8f0;position:relative;overflow:hidden;animation:htp-ov3-in 0.28s cubic-bezier(.22,.68,0,1.2);}',
      '@keyframes htp-ov3-in{from{opacity:0;transform:translateY(24px) scale(0.96);}to{opacity:1;transform:none;}}',
      '.htp-ov3-headline{font-size:32px;font-weight:900;letter-spacing:-0.03em;text-align:center;margin:0 0 4px;}',
      '.htp-ov3-headline.win{color:#49e8c2;}',
      '.htp-ov3-headline.lose{color:#ef4444;}',
      '.htp-ov3-headline.draw{color:#94a3b8;}',
      '.htp-ov3-amount{font-size:44px;font-weight:900;color:#49e8c2;text-align:center;margin:10px 0 6px;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;}',
      '.htp-ov3-amount.lose{color:#ef4444;font-size:28px;}',
      '.htp-ov3-amount.draw{color:#94a3b8;font-size:30px;}',
      '.htp-ov3-sub{font-size:12px;color:#475569;text-align:center;margin:0 0 20px;}',
      '.htp-ov3-rows{margin:0 0 18px;}',
      '.htp-ov3-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;}',
      '.htp-ov3-row:last-child{border-bottom:none;}',
      '.htp-ov3-row .lbl{color:#64748b;}',
      '.htp-ov3-row .val{font-weight:600;color:#cbd5e1;}',
      '.htp-ov3-row.payout .val{color:#49e8c2;font-size:16px;font-weight:800;}',
      '.htp-ov3-explorer{text-align:center;margin:0 0 20px;}',
      '.htp-ov3-explorer a{color:#49e8c2;font-size:12px;text-decoration:none;border-bottom:1px solid rgba(73,232,194,0.3);}',
      '.htp-ov3-explorer a:hover{border-bottom-color:#49e8c2;}',
      '.htp-ov3-actions{display:flex;gap:10px;}',
      '.htp-ov3-actions button{flex:1;padding:12px;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;font-family:Inter,sans-serif;transition:opacity 0.18s;}',
      '.htp-ov3-btn-lobby{background:#1e293b;color:#94a3b8;}',
      '.htp-ov3-btn-lobby:hover{opacity:0.8;}',
      '.htp-ov3-progress{position:absolute;bottom:0;left:0;height:3px;background:#49e8c2;transition:width linear;}',
      '.htp-ov3-progress.lose{background:#ef4444;}',
      '.htp-ov3-progress.draw{background:#94a3b8;}',
      /* Confetti particles */
      '.htp-confetti-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden;}',
      '.htp-confetti-p{position:absolute;width:8px;height:8px;border-radius:2px;opacity:0;animation:htp-confetti-fly 1.4s ease-out forwards;}',
      '@keyframes htp-confetti-fly{0%{transform:translate(0,0) rotate(0deg);opacity:1;}100%{transform:var(--tx) var(--ty) rotate(var(--tr));opacity:0;}}',
    ].join('');
    document.head.appendChild(s);
  }

  function buildConfetti(card) {
    var wrap = document.createElement('div');
    wrap.className = 'htp-confetti-wrap';
    var colors = ['#49e8c2','#3b82f6','#a78bfa','#f59e0b','#34d399','#fff'];
    for (var i = 0; i < 28; i++) {
      var p = document.createElement('div');
      p.className = 'htp-confetti-p';
      var angle = (Math.random() * 360);
      var dist  = 80 + Math.random() * 160;
      var tx    = Math.round(Math.cos(angle * Math.PI / 180) * dist);
      var ty    = Math.round(Math.sin(angle * Math.PI / 180) * dist - 60);
      p.style.cssText = [
        'left:' + (30 + Math.random() * 40) + '%;',
        'top:' + (20 + Math.random() * 30) + '%;',
        'background:' + colors[i % colors.length] + ';',
        '--tx:translateX(' + tx + 'px);',
        '--ty:translateY(' + ty + 'px);',
        '--tr:' + (Math.random() * 720 - 360) + 'deg;',
        'animation-delay:' + (Math.random() * 0.3) + 's;',
        'animation-duration:' + (1.0 + Math.random() * 0.8) + 's;',
      ].join('');
      wrap.appendChild(p);
    }
    card.appendChild(wrap);
  }

  function animateCounter(el, target, durationMs) {
    var start = performance.now();
    function tick(now) {
      var pct = Math.min((now - start) / durationMs, 1);
      var ease = 1 - Math.pow(1 - pct, 3);
      el.textContent = (target * ease).toFixed(4) + ' KAS';
      if (pct < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(4) + ' KAS';
    }
    requestAnimationFrame(tick);
  }

  function startDismissBar(bar, cls, ms, onDone) {
    bar.style.width = '100%';
    bar.style.transitionDuration = ms + 'ms';
    setTimeout(function() { bar.style.width = '0%'; }, 30);
    setTimeout(onDone, ms);
  }

  function closeOverlay(backdrop) {
    backdrop.style.opacity = '0';
    backdrop.style.transition = 'opacity 0.3s';
    setTimeout(function() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }, 320);
  }

  function addEscDismiss(backdrop) {
    function onKey(e) { if (e.key === 'Escape') { closeOverlay(backdrop); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) { closeOverlay(backdrop); document.removeEventListener('keydown', onKey); } });
  }

  // ── showResult ───────────────────────────────────────────────────────────
  function showResult(opts) {
    injectStyles();
    opts = opts || {};
    var result   = opts.result || 'draw';
    var txId     = opts.txId || '';
    var stakeKas = parseFloat(opts.stakeKas) || 0;
    var isDraw   = result === 'draw';
    var isWin    = result === 'win';
    var isLose   = result === 'lose';

    var Fee = W.HTPFee;
    var payout = 0, fee = 0, pool = 0, treasury = '';
    if (Fee && isWin) {
      var calc = Fee.skillGameSettle(stakeKas);
      payout   = calc.winnerPayout;
      fee      = calc.protocolFee;
      pool     = calc.totalPool;
      treasury = calc.treasuryAddress;
    } else if (Fee && isDraw) {
      var dc   = Fee.drawSettle ? Fee.drawSettle(stakeKas) : { refund: stakeKas * 0.99, protocolFee: stakeKas * 0.01, treasuryAddress: Fee.treasuryAddress() };
      payout   = dc.refund;
      fee      = dc.protocolFee;
      treasury = dc.treasuryAddress;
    }

    var explorerUrl = txId ? (EXPLORER_BASE + txId) : '';

    var backdrop = document.createElement('div');
    backdrop.className = 'htp-ov3-backdrop';

    var card = document.createElement('div');
    card.className = 'htp-ov3-card';

    var progressBar = document.createElement('div');
    progressBar.className = 'htp-ov3-progress ' + result;

    if (isWin) buildConfetti(card);

    // Headline
    var hl = document.createElement('div');
    hl.className = 'htp-ov3-headline ' + result;
    hl.textContent = isWin ? '🏆 YOU WIN' : isLose ? 'DEFEAT' : 'DRAW';
    card.appendChild(hl);

    // Animated amount
    var amountEl = document.createElement('div');
    amountEl.className = 'htp-ov3-amount ' + result;
    if (isWin) {
      amountEl.textContent = '0.0000 KAS';
    } else if (isDraw) {
      amountEl.textContent = payout > 0 ? payout.toFixed(4) + ' KAS' : 'Refund';
    } else {
      amountEl.textContent = '-' + stakeKas.toFixed(4) + ' KAS';
    }
    card.appendChild(amountEl);

    var sub = document.createElement('div');
    sub.className = 'htp-ov3-sub';
    sub.textContent = isWin ? 'Payout breakdown' : isLose ? 'Stake lost' : 'Draw refund';
    card.appendChild(sub);

    // Rows
    var rowsEl = document.createElement('div');
    rowsEl.className = 'htp-ov3-rows';
    var rows = [];
    if (isWin && Fee) {
      rows = [
        { lbl: 'Total pool',     val: pool.toFixed(4) + ' KAS' },
        { lbl: 'Protocol fee',   val: fee.toFixed(4) + ' KAS (2%)', cls: 'muted' },
        { lbl: 'Treasury',       val: treasury ? (treasury.substring(0,14) + '…') : '—' },
        { lbl: 'YOUR PAYOUT',    val: payout.toFixed(4) + ' KAS', cls: 'payout' },
      ];
    } else if (isDraw && Fee) {
      rows = [
        { lbl: 'Your stake',     val: stakeKas.toFixed(4) + ' KAS' },
        { lbl: 'Protocol fee',   val: fee.toFixed(4) + ' KAS (1%)' },
        { lbl: 'REFUND',         val: payout.toFixed(4) + ' KAS', cls: 'payout' },
      ];
    } else if (isLose) {
      rows = [
        { lbl: 'Stake lost', val: stakeKas.toFixed(4) + ' KAS' },
        { lbl: 'Payout',     val: '0 KAS' },
      ];
      if (opts.opponentAddress) rows.push({ lbl: 'Winner', val: opts.opponentAddress.substring(0,16) + '…' });
    }
    rows.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'htp-ov3-row' + (r.cls ? ' ' + r.cls : '');
      row.innerHTML = '<span class="lbl">' + r.lbl + '</span><span class="val">' + r.val + '</span>';
      rowsEl.appendChild(row);
    });
    card.appendChild(rowsEl);

    // Explorer link
    if (explorerUrl) {
      var expDiv = document.createElement('div');
      expDiv.className = 'htp-ov3-explorer';
      expDiv.innerHTML = '<a href="' + explorerUrl + '" target="_blank" rel="noopener">View on Explorer →</a>';
      card.appendChild(expDiv);
    }

    // Actions
    var actions = document.createElement('div');
    actions.className = 'htp-ov3-actions';
    var lobbyBtn = document.createElement('button');
    lobbyBtn.className = 'htp-ov3-btn-lobby';
    lobbyBtn.textContent = 'Back to Lobby';
    lobbyBtn.addEventListener('click', function() {
      closeOverlay(backdrop);
      if (W.htpShowTab) W.htpShowTab('lobby');
    });
    actions.appendChild(lobbyBtn);
    card.appendChild(actions);

    card.appendChild(progressBar);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    addEscDismiss(backdrop);
    startDismissBar(progressBar, result, DISMISS_MS, function() { closeOverlay(backdrop); });

    if (isWin && payout > 0) {
      setTimeout(function() { animateCounter(amountEl, payout, 1500); }, 120);
    }
  }

  // ── showPreview ──────────────────────────────────────────────────────────
  function showPreview(opts, txCb) {
    injectStyles();
    var Fee = W.HTPFee;
    if (!Fee) { console.error('[SettlementOverlay v3] HTPFee shim not loaded'); return; }

    var stakeKas = opts.stakeKas || 0;
    var isDraw   = opts.isDraw   || false;
    var result   = opts.result   || (isDraw ? 'draw' : 'win');
    var rows = [];

    if (isDraw) {
      var dc = Fee.drawSettle ? Fee.drawSettle(stakeKas) : { refund: stakeKas * 0.99, protocolFee: stakeKas * 0.01, treasuryAddress: Fee.treasuryAddress() };
      rows = [
        { lbl: 'Your stake',   val: stakeKas.toFixed(4) + ' KAS' },
        { lbl: 'Protocol fee', val: dc.protocolFee.toFixed(4) + ' KAS (1%)' },
        { lbl: 'You receive',  val: dc.refund.toFixed(4) + ' KAS', cls: 'payout' },
      ];
    } else if (result === 'win') {
      var calc = Fee.skillGameSettle(stakeKas);
      rows = [
        { lbl: 'Total pool',   val: calc.totalPool.toFixed(4) + ' KAS' },
        { lbl: 'Protocol fee', val: calc.protocolFee.toFixed(4) + ' KAS (2%)' },
        { lbl: 'Treasury',     val: Fee.treasuryAddress().substring(0,14) + '…' },
        { lbl: 'Your payout',  val: calc.winnerPayout.toFixed(4) + ' KAS', cls: 'payout' },
      ];
    } else {
      rows = [
        { lbl: 'Result',     val: 'Defeat' },
        { lbl: 'You lose',   val: stakeKas.toFixed(4) + ' KAS' },
        { lbl: 'Payout',     val: '0 KAS' },
      ];
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'htp-ov3-backdrop';
    var card = document.createElement('div');
    card.className = 'htp-ov3-card';

    var titleEl = document.createElement('div');
    titleEl.className = 'htp-ov3-headline ' + result;
    titleEl.style.fontSize = '20px';
    titleEl.textContent = 'Settlement Preview';
    card.appendChild(titleEl);

    var rowsEl = document.createElement('div');
    rowsEl.className = 'htp-ov3-rows';
    rows.forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'htp-ov3-row' + (r.cls ? ' ' + r.cls : '');
      row.innerHTML = '<span class="lbl">' + r.lbl + '</span><span class="val">' + r.val + '</span>';
      rowsEl.appendChild(row);
    });
    card.appendChild(rowsEl);

    var actions = document.createElement('div');
    actions.className = 'htp-ov3-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'htp-ov3-btn-lobby';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function() { closeOverlay(backdrop); });
    var confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = 'flex:1;padding:12px;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;font-family:Inter,sans-serif;background:linear-gradient(135deg,#49e8c2,#3b82f6);color:#0f172a;';
    confirmBtn.textContent = 'Confirm & Sign';
    confirmBtn.addEventListener('click', async function() {
      confirmBtn.textContent = 'Signing…';
      confirmBtn.disabled = true;
      closeOverlay(backdrop);
      if (typeof txCb === 'function') await txCb();
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    addEscDismiss(backdrop);
  }

  // Listen for autopayout engine settlement event
  W.addEventListener('htp:settlement:complete', function(e) {
    var d = e.detail || {};
    var result = d.isDraw ? 'draw' : (d.winner && (d.winner === W.connectedAddress || d.winner === W.htpAddress)) ? 'win' : 'lose';
    showResult({
      result:   result,
      txId:     d.txId,
      stakeKas: d.stakeKas || 0,
      opponentAddress: d.winner,
    });
  });

  W.HTPSettlementOverlay = { showPreview: showPreview, showResult: showResult };
  console.log('[HTPSettlementOverlay v3] loaded');
})(window);
