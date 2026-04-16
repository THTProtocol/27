/**
 * htp-settlement-overlay.js — Settlement Preview + Result Overlay
 *
 * Shows exact payout breakdown before TX fires, and win/loss/draw result.
 * Depends on: htp-fee-shim.js (window.HTPFee)
 */
(function(W) {
  'use strict';

  function injectStyles() {
    if (document.getElementById('htp-overlay-style')) return;
    const s = document.createElement('style');
    s.id = 'htp-overlay-style';
    s.textContent = `
      .htp-overlay-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
        z-index: 9999;
        display: flex; align-items: center; justify-content: center;
      }
      .htp-overlay-card {
        background: #0f172a;
        border: 1px solid rgba(73,232,194,0.25);
        border-radius: 16px; padding: 28px;
        max-width: 420px; width: 92%;
        font-family: 'Inter', sans-serif; color: #e2e8f0;
        animation: htp-slide-up 0.22s ease;
      }
      @keyframes htp-slide-up {
        from { opacity:0; transform:translateY(16px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .htp-overlay-card h2 {
        font-size: 18px; font-weight: 800; color: #fff;
        margin: 0 0 18px; letter-spacing: -0.02em;
        display: flex; align-items: center; gap: 10px;
      }
      .htp-overlay-card h2 .badge {
        font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
        padding: 3px 10px; border-radius: 99px; text-transform: uppercase;
      }
      .badge.win   { background: rgba(73,232,194,0.15); color: #49e8c2; }
      .badge.lose  { background: rgba(239,68,68,0.15);  color: #ef4444; }
      .badge.draw  { background: rgba(148,163,184,0.15); color: #94a3b8; }
      .htp-overlay-rows { margin-bottom: 18px; }
      .htp-overlay-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 13px;
      }
      .htp-overlay-row:last-child { border-bottom: none; }
      .htp-overlay-row .lbl { color: #64748b; }
      .htp-overlay-row .val { font-weight: 600; color: #fff; }
      .htp-overlay-row.muted .val { color: #64748b; font-weight: 400; }
      .htp-overlay-row.highlight .val { color: #49e8c2; font-size: 16px; font-weight: 800; }
      .htp-overlay-actions { display: flex; gap: 10px; }
      .htp-overlay-actions button {
        flex: 1; padding: 11px; border: none; border-radius: 8px;
        font-weight: 700; font-size: 14px; cursor: pointer;
        font-family: 'Inter', sans-serif; transition: opacity 0.2s;
      }
      .htp-overlay-actions .confirm { background: linear-gradient(135deg, #49e8c2, #3b82f6); color: #0f172a; }
      .htp-overlay-actions .cancel  { background: #1e293b; color: #94a3b8; }
      .htp-overlay-actions button:hover { opacity: 0.88; }
      .htp-overlay-explorer { font-size: 11px; text-align: center; margin-top: 12px; }
      .htp-overlay-explorer a { color: #49e8c2; text-decoration: none; }
      .htp-overlay-explorer a:hover { text-decoration: underline; }
    `;
    document.head.appendChild(s);
  }

  function getFee() {
    return W.HTPFee || null;
  }

  /**
   * Show settlement preview before TX fires.
   * @param {object} opts — { stakeKas, isMaximizer, betKas, isDraw, result: 'win'|'lose'|'draw', txCb }
   */
  function showPreview(opts, txCb) {
    injectStyles();
    const Fee = getFee();
    if (!Fee) { console.error('[SettlementOverlay] HTPFee shim not loaded'); return; }

    const stakeKas    = opts.stakeKas    || 0;
    const isMaximizer = opts.isMaximizer || false;
    const betKas      = opts.betKas      || stakeKas;
    const isDraw      = opts.isDraw      || false;
    const result      = opts.result      || (isDraw ? 'draw' : 'win');

    let rows = [];
    let title = 'Settlement Preview';
    let badge = result;

    if (isDraw) {
      const half = stakeKas; // each player gets their stake back minus small fee
      const fee  = stakeKas * 2 * 0.01; // 1% on draws
      rows = [
        { label: 'Result',       value: 'Draw',                    cls: '' },
        { label: 'Your stake',   value: stakeKas.toFixed(2) + ' KAS', cls: '' },
        { label: 'Protocol fee', value: (fee/2).toFixed(2) + ' KAS (1%)', cls: 'muted' },
        { label: 'You receive',  value: (stakeKas - fee/2).toFixed(2) + ' KAS', cls: 'highlight' },
      ];
    } else if (isMaximizer) {
      if (result === 'win') {
        const calc = Fee.maximizerWinSettle(betKas, opts.odds || 2.0);
        rows = [
          { label: 'Result',         value: 'Maximizer Win',          cls: '' },
          { label: 'Bet',            value: betKas.toFixed(2) + ' KAS', cls: '' },
          { label: 'Protocol fee',   value: calc.protocolFee.toFixed(2) + ' KAS (2%)', cls: 'muted' },
          { label: 'Treasury',       value: Fee.treasuryAddress().substring(0,18)+'…', cls: 'muted' },
          { label: 'Your payout',    value: calc.netPayout.toFixed(2) + ' KAS', cls: 'highlight' },
        ];
      } else {
        const calc = Fee.maximizerLoseSettle(betKas);
        rows = [
          { label: 'Result',       value: 'Maximizer — Claim Hedge', cls: '' },
          { label: 'Bet',          value: betKas.toFixed(2) + ' KAS', cls: '' },
          { label: 'Hedge fee',    value: calc.protocolFee.toFixed(2) + ' KAS (30%)', cls: 'muted' },
          { label: 'Claimable',    value: calc.claimable.toFixed(2) + ' KAS', cls: 'highlight' },
        ];
      }
    } else {
      const calc = Fee.skillGameSettle(stakeKas);
      if (result === 'win') {
        rows = [
          { label: 'Result',       value: 'Winner',                          cls: '' },
          { label: 'Total pool',   value: calc.totalPool.toFixed(2) + ' KAS', cls: '' },
          { label: 'Stake each',   value: stakeKas.toFixed(2) + ' KAS',       cls: '' },
          { label: 'Protocol fee', value: calc.protocolFee.toFixed(2) + ' KAS (2%)', cls: 'muted' },
          { label: 'Treasury',     value: Fee.treasuryAddress().substring(0,18)+'…', cls: 'muted' },
          { label: 'Your payout',  value: calc.winnerPayout.toFixed(2) + ' KAS', cls: 'highlight' },
        ];
      } else {
        rows = [
          { label: 'Result',     value: 'Defeat',    cls: '' },
          { label: 'You lose',   value: stakeKas.toFixed(2) + ' KAS', cls: 'muted' },
          { label: 'Your payout', value: '0 KAS',   cls: '' },
        ];
      }
    }

    const rowsHTML = rows.map(r =>
      `<div class="htp-overlay-row ${r.cls}"><span class="lbl">${r.label}</span><span class="val">${r.value}</span></div>`
    ).join('');

    const backdrop = document.createElement('div');
    backdrop.className = 'htp-overlay-backdrop';
    backdrop.innerHTML = `
      <div class="htp-overlay-card">
        <h2>${title} <span class="badge ${badge}">${badge.toUpperCase()}</span></h2>
        <div class="htp-overlay-rows">${rowsHTML}</div>
        <div class="htp-overlay-actions">
          <button class="cancel" id="htp-ov-cancel">Cancel</button>
          <button class="confirm" id="htp-ov-confirm">Confirm &amp; Sign</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    document.getElementById('htp-ov-cancel').addEventListener('click', function() { backdrop.remove(); });
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById('htp-ov-confirm').addEventListener('click', async function() {
      this.textContent = 'Signing…';
      this.disabled    = true;
      backdrop.remove();
      if (typeof txCb === 'function') await txCb();
    });
  }

  /**
   * Show result after TX is broadcast.
   * @param {object} opts — { result: 'win'|'lose'|'draw', txId, explorerBase }
   */
  function showResult(opts) {
    injectStyles();
    const { result, txId, explorerBase } = opts || {};
    const explorerUrl = txId
      ? (explorerBase || 'https://explorer-tn12.kaspa.org/txs/') + txId
      : null;

    const backdrop = document.createElement('div');
    backdrop.className = 'htp-overlay-backdrop';
    backdrop.innerHTML = `
      <div class="htp-overlay-card" style="text-align:center">
        <h2 style="justify-content:center">Game Over <span class="badge ${result || 'draw'}">${(result||'draw').toUpperCase()}</span></h2>
        ${txId ? `<p style="font-size:12px;color:#64748b;word-break:break-all;margin:0 0 16px">${txId}</p>` : ''}
        ${explorerUrl ? `<div class="htp-overlay-explorer"><a href="${explorerUrl}" target="_blank" rel="noopener">View on Explorer ↗</a></div>` : ''}
        <div class="htp-overlay-actions" style="margin-top:16px">
          <button class="confirm" id="htp-ov-close">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    document.getElementById('htp-ov-close').addEventListener('click', function() { backdrop.remove(); });
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) backdrop.remove(); });
  }

  W.HTPSettlementOverlay = { showPreview, showResult };
  console.log('[HTPSettlementOverlay v2] loaded — uses htp-fee-shim.js');
})(window);
