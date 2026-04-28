'use strict';

// ─── BlackjackUI ────────────────────────────────────────
// Reuses renderCard / renderHand from poker-ui.js (loaded first).
// Server-authoritative: client sends actions, server broadcasts back updated public state.

class BlackjackUI {
  constructor(containerId, game, myAddr) {
    this.containerId = containerId;
    this.game = game;
    this.myAddr = myAddr;
    this.state = null;
    this.animQueue = [];
  }

  hydrate(state) {
    this.state = state;
    this.render();
  }

  onStateUpdate(newState) {
    this.state = newState;
    this.render();
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container || !this.state) return;
    container.innerHTML = this._buildHTML();
    this._bindEvents();
  }

  _buildHTML() {
    const s = this.state;
    const me = s.players.find(p => p.addr === this.myAddr);
    const isMyTurn = !s.finished && s.phase === 'player-turn' &&
      s.activePlayerIdx === s.players.findIndex(p => p.addr === this.myAddr);

    let html = '<div class="bj-table">';

    // , Dealer
    const dealerTotal = s.finished || s.phase === 'dealer-turn' || s.phase === 'payout'
      ? this._total(s.dealerHand)
      : null;
    html += '<div class="bj-dealer">';
    html += '<div class="bj-section-label">Dealer' + (dealerTotal !== null ? ' · ' + dealerTotal : '') + '</div>';
    html += this._renderBJHand(s.dealerHand, { size: 'md' });
    html += '</div>';

    // , Other players (if multiplayer)
    if (s.players.length > 1) {
      html += '<div class="bj-other-players">';
      for (const p of s.players) {
        if (p.addr === this.myAddr) continue;
        const active = !s.finished && s.activePlayerIdx === s.players.indexOf(p);
        html += `<div class="bj-player-seat ${active ? 'seat-active' : ''}">`;
        html += `<div class="seat-name">${p.name || p.addr.slice(-6)}</div>`;
        html += `<div class="seat-chips">${((p.chips||0)/1e8).toFixed(2)} KAS</div>`;
        for (const hand of p.hands) {
          const t = this._total(hand.cards);
          const result = hand.result;
          html += `<div class="bj-hand-row">`;
          html += this._renderBJHand(hand.cards, { size: 'sm', result });
          html += `<span class="bj-total ${t > 21 ? 'total-bust' : t === 21 ? 'total-bj' : ''}">${hand.cards.some(c => c !== 'back') ? t : ''}</span>`;
          if (result) html += `<span class="bj-result-badge bj-${result}">${result.toUpperCase()}</span>`;
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // , My hands
    if (me) {
      html += '<div class="bj-my-hands">';
      html += `<div class="bj-section-label">You · <span style="color:var(--green)">${((me.chips||0)/1e8).toFixed(2)} KAS</span></div>`;
      me.hands.forEach((hand, i) => {
        const t = this._total(hand.cards);
        const isActiveHand = isMyTurn && i === me.activeHandIdx;
        const result = hand.result;
        html += `<div class="bj-my-hand ${isActiveHand ? 'hand-active' : ''} ${hand.done ? 'hand-done' : ''}">`;
        html += `<div class="bj-hand-meta">`;
        html += `<span>Hand ${i+1}</span>`;
        html += `<span>Bet: ${(hand.bet/1e8).toFixed(2)} KAS</span>`;
        if (hand.doubled) html += `<span class="badge-doubled">2x</span>`;
        if (hand.split) html += `<span class="badge-split">Split</span>`;
        html += '</div>';
        html += this._renderBJHand(hand.cards, { size: 'lg', result });
        html += `<div class="bj-total-row">`;
        html += `<span class="bj-total ${t > 21 ? 'total-bust' : t === 21 ? 'total-bj' : ''}">${t}</span>`;
        if (result) html += `<span class="bj-result-badge bj-${result}">${result.toUpperCase()}</span>`;
        html += '</div>';
        html += '</div>';
      });

      // Insurance
      if (me.insurancePaid) {
        html += `<div class="bj-insurance">Insurance: ${((me.insurance||0)/1e8).toFixed(2)} KAS</div>`;
      }
      html += '</div>';
    }

    // , Results
    if (s.finished && s.results) {
      const myResult = s.results.find(r => r.addr === this.myAddr);
      if (myResult) {
        const net = myResult.netChips || 0;
        html += `<div class="bj-final-result ${net > 0 ? 'result-win' : net < 0 ? 'result-lose' : 'result-push'}">`;
        html += net > 0 ? ` +${(net/1e8).toFixed(2)} KAS` : net < 0 ? ` ${(net/1e8).toFixed(2)} KAS` : `Push · Bet Returned`;
        html += '</div>';
        html += `<div style="text-align:center;margin-top:8px"><button class="btn btn-primary" id="bj-next-round">Next Round</button></div>`;
      }
    }

    // , Insurance phase
    if (!s.finished && s.phase === 'insurance') {
      html += '<div class="bj-insurance-prompt">';
      html += '<div style="color:var(--yellow);font-weight:600">Dealer shows Ace , Take Insurance?</div>';
      html += '<div class="action-buttons" style="margin-top:8px">';
      html += '<button class="btn btn-secondary bj-action" data-action="insurance">Take Insurance</button>';
      html += '<button class="btn btn-outline bj-action" data-action="skip-insurance">No Thanks</button>';
      html += '</div></div>';
    }

    // , Action buttons
    if (isMyTurn) {
      const me2 = s.players[s.activePlayerIdx];
      const hand = me2.hands[me2.activeHandIdx];
      const t = this._total(hand?.cards || []);
      const canDouble = hand?.cards.length === 2 && me2.chips >= hand.bet;
      const canSplit = hand?.cards.length === 2 &&
        hand.cards[0]?.[0] === hand.cards[1]?.[0] && me2.chips >= hand.bet;
      html += '<div class="bj-actions">';
      if (t < 21) {
        html += '<button class="btn btn-primary bj-action" data-action="hit">Hit</button>';
      }
      html += '<button class="btn btn-secondary bj-action" data-action="stand">Stand</button>';
      if (canDouble) html += '<button class="btn btn-outline bj-action" data-action="double">Double</button>';
      if (canSplit)  html += '<button class="btn btn-outline bj-action" data-action="split">Split</button>';
      html += '</div>';
    } else if (!s.finished && s.phase === 'player-turn') {
      html += '<div class="bj-waiting">Waiting for ' + (s.players[s.activePlayerIdx]?.name || 'player') + '...</div>';
    } else if (s.phase === 'dealer-turn') {
      html += '<div class="bj-waiting" style="color:var(--yellow)">Dealer playing...</div>';
    }

    // , Shoe remaining
    html += `<div class="bj-shoe-info"> ${s.shoeRemaining||'?'} cards remaining</div>`;

    html += '</div>'; // bj-table
    return html;
  }

  _renderBJHand(cards, opts = {}) {
    const { size = 'md', result } = opts;
    const wrapCls = result ? `bj-hand-result-${result}` : '';
    return `<div class="card-hand ${size} ${wrapCls}">${(cards||[]).map(c => renderCard(c, { size })).join('')}</div>`;
  }

  _total(cards) {
    if (!cards || cards.length === 0) return 0;
    let total = 0, aces = 0;
    for (const c of cards) {
      if (c === 'back') continue;
      const r = c[0];
      if (r === 'A') { total += 11; aces++; }
      else if (['T','J','Q','K'].includes(r)) total += 10;
      else total += parseInt(r);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  _bindEvents() {
    document.querySelectorAll('.bj-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'skip-insurance') {
          wsSend('game-action', { gameId: this.game.id, action: 'skip-insurance', player: this.myAddr });
        } else {
          wsSend('game-action', { gameId: this.game.id, action, player: this.myAddr });
        }
      });
    });
    const nextBtn = document.getElementById('bj-next-round');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        wsSend('game-action', { gameId: this.game.id, action: 'new-round', player: this.myAddr });
      });
    }
  }
}

// ─── Inject Blackjack-specific CSS ──────────────────────────

(function injectBJStyles() {
  if (document.getElementById('bj-styles')) return;
  const style = document.createElement('style');
  style.id = 'bj-styles';
  style.textContent = `
    .bj-table { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: #0d2b14; border-radius: var(--radius-lg); border: 1px solid #1a4d24; min-height: 400px; }
    .bj-section-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #8bac62; text-transform: uppercase; margin-bottom: 6px; }
    .bj-dealer { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; background: rgba(0,0,0,0.3); border-radius: var(--radius); }
    .bj-other-players { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    .bj-player-seat { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; min-width: 100px; }
    .bj-my-hands { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .bj-my-hand { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: var(--radius); border: 1px solid transparent; }
    .bj-my-hand.hand-active { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
    .bj-my-hand.hand-done { opacity: 0.7; }
    .bj-hand-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-secondary); }
    .bj-total-row { display: flex; gap: 8px; align-items: center; }
    .bj-total { font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .total-bust { color: var(--red) !important; }
    .total-bj { color: var(--gold) !important; }
    .bj-hand-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .bj-result-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
    .bj-win, .bj-blackjack { background: var(--green-bg); color: var(--green); }
    .bj-lose, .bj-bust { background: var(--red-bg); color: var(--red); }
    .bj-push { background: var(--blue-bg); color: var(--blue); }
    .bj-final-result { text-align: center; font-size: 22px; font-weight: 700; padding: 20px; border-radius: var(--radius); }
    .result-push { color: var(--blue); background: var(--blue-bg); }
    .bj-insurance { font-size: 12px; color: var(--yellow); }
    .bj-insurance-prompt { background: var(--yellow-bg); border: 1px solid rgba(196,168,75,0.3); border-radius: var(--radius); padding: 12px; }
    .bj-actions { display: flex; gap: 8px; justify-content: center; padding: 8px 0; }
    .bj-waiting { text-align: center; font-size: 13px; color: var(--text-secondary); padding: 12px; }
    .bj-shoe-info { font-size: 10px; color: var(--text-muted); text-align: right; }
    .badge-doubled { background: var(--yellow-bg); color: var(--yellow); font-size: 9px; padding: 1px 5px; border-radius: 3px; }
    .badge-split { background: var(--blue-bg); color: var(--blue); font-size: 9px; padding: 1px 5px; border-radius: 3px; }
  `;
  document.head.appendChild(style);
})();

window.BlackjackUI = BlackjackUI;
