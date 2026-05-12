'use strict';

// ─── Shared Card Renderer ─────────────────────────────────
// Renders a playing card as styled HTML. Used by both PokerUI and BlackjackUI.
// Card format: rank+suit e.g. 'As' = Ace of Spades, 'Th' = Ten of Hearts
// 'back' = face-down card

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR  = { s: '#e8e8e8', h: '#e05', d: '#e05', c: '#e8e8e8' };
const RANK_DISPLAY = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };

function renderCard(card, opts = {}) {
  const { size = 'md', faceDown = false, highlight = false, dim = false } = opts;
  if (faceDown || card === 'back') {
    return `<div class="playing-card card-back ${size}${highlight ? ' card-highlight' : ''}${dim ? ' card-dim' : ''}">
      <div class="card-back-pattern"></div>
    </div>`;
  }
  const rank = card[0];
  const suit = card[1];
  const r = RANK_DISPLAY[rank] || rank;
  const sym = SUIT_SYMBOL[suit] || suit;
  const color = SUIT_COLOR[suit] || '#e8e8e8';
  return `<div class="playing-card ${size}${highlight ? ' card-highlight' : ''}${dim ? ' card-dim' : ''}" style="--card-color:${color}">
    <div class="card-tl">${r}<span class="card-suit">${sym}</span></div>
    <div class="card-center">${sym}</div>
    <div class="card-br">${r}<span class="card-suit">${sym}</span></div>
  </div>`;
}

function renderHand(cards, opts = {}) {
  return `<div class="card-hand ${opts.size||'md'}">${cards.map((c,i) => renderCard(c, { ...opts, highlight: opts.highlightIdx?.includes(i) })).join('')}</div>`;
}

// ─── PokerUI ──────────────────────────────────────────

class PokerUI {
  constructor(containerId, game, myAddr) {
    this.containerId = containerId;
    this.game = game;
    this.myAddr = myAddr;
    this.state = null;     // hydrated from server
    this.raiseAmount = 0;
  }

  hydrate(state) {
    this.state = state;
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
    const myPlayer = s.players.find(p => p.addr === this.myAddr);
    const isMyTurn = s.activePlayerIdx === s.players.findIndex(p => p.addr === this.myAddr);
    const me = myPlayer;
    const pot = s.pot || 0;
    const currentBet = s.currentBet || 0;

    let html = '<div class="poker-table">';

    // , Stage badge
    html += `<div class="poker-stage-badge">${(s.stageName||'').toUpperCase()}</div>`;

    // , Community cards
    html += '<div class="poker-community">';
    html += '<div class="poker-community-label">Community Cards</div>';
    const comm = s.community || [];
    const placeholders = 5 - comm.length;
    html += '<div class="card-hand md">';
    for (const c of comm) html += renderCard(c, { size: 'md' });
    for (let i = 0; i < placeholders; i++) html += '<div class="card-placeholder"></div>';
    html += '</div>';
    html += `<div class="poker-pot">Pot: <strong>${(pot/1e8).toFixed(2)} KAS</strong></div>`;
    html += '</div>';

    // , Other players
    html += '<div class="poker-opponents">';
    for (const p of s.players) {
      if (p.addr === this.myAddr) continue;
      const isActive = s.activePlayerIdx === s.players.indexOf(p);
      html += `<div class="poker-opponent-seat ${isActive ? 'seat-active' : ''} ${p.folded ? 'seat-folded' : ''} ${p.allIn ? 'seat-allin' : ''}">` +
        `<div class="seat-name">${p.name || p.addr.slice(-6)}` +
        (p.folded ? ' <span class="badge-fold">FOLD</span>' : '') +
        (p.allIn ? ' <span class="badge-allin">ALL-IN</span>' : '') +
        `</div>` +
        `<div class="seat-chips">${(p.chips/1e8).toFixed(2)} KAS</div>` +
        `<div class="card-hand sm">${p.holeCards.map(c => renderCard(c, { size: 'sm' })).join('')}</div>` +
        (p.bet ? `<div class="seat-bet">${(p.bet/1e8).toFixed(2)} KAS</div>` : '') +
        (p.handRank ? `<div class="seat-rank">${p.handRank.label}</div>` : '') +
        '</div>';
    }
    html += '</div>';

    // , My seat
    if (me) {
      html += `<div class="poker-my-seat ${isMyTurn ? 'seat-active' : ''}">`;
      html += `<div class="my-seat-top">` +
        `<span>${me.name || 'You'}</span>` +
        `<span class="my-chips">${(me.chips/1e8).toFixed(2)} KAS</span>` +
        `</div>`;
      html += `<div class="card-hand lg">${(me.holeCards||[]).map(c => renderCard(c, { size: 'lg' })).join('')}</div>`;
      if (me.handRank) html += `<div class="my-hand-rank">${me.handRank.label}</div>`;
      html += '</div>';
    }

    // , Action controls
    html += '<div class="poker-actions">';
    if (s.finished) {
      const winner = s.winner === 'draw' ? 'Split Pot' : (s.winner === this.myAddr ? 'You Win!' : s.winner?.slice(-6) + ' Wins');
      html += `<div class="poker-result ${s.winner === this.myAddr ? 'result-win' : 'result-lose'}">` +
        `${winner}${s.winReason ? ' · ' + s.winReason : ''}</div>`;
    } else if (isMyTurn && me && !me.folded) {
      const canCheck = currentBet === 0 || (me.bet || 0) >= currentBet;
      const toCall = Math.max(0, currentBet - (me.bet || 0));
      html += `<div class="action-buttons">`;
      html += `<button class="btn btn-danger btn-sm poker-action" data-action="fold">Fold</button>`;
      if (canCheck) {
        html += `<button class="btn btn-secondary btn-sm poker-action" data-action="check">Check</button>`;
      } else {
        html += `<button class="btn btn-secondary btn-sm poker-action" data-action="call">Call ${(toCall/1e8).toFixed(2)}</button>`;
      }
      html += `<button class="btn btn-primary btn-sm poker-action" data-action="allin">All-In</button>`;
      html += `<div class="raise-control">`;
      html += `<input type="range" id="poker-raise-slider" min="${s.minRaise||0}" max="${me.chips}" step="${Math.floor((me.chips||1e8)/100)||1}" value="${this.raiseAmount || s.minRaise || 0}">`;
      html += `<span id="poker-raise-label">${((this.raiseAmount || s.minRaise || 0)/1e8).toFixed(2)} KAS</span>`;
      html += `<button class="btn btn-outline btn-sm poker-action" data-action="raise">Raise</button>`;
      html += '</div></div>';
    } else if (!s.finished) {
      html += `<div style="color:var(--text-secondary);font-size:13px">Waiting for ${s.players[s.activePlayerIdx]?.name || 'opponent'}...</div>`;
    }
    html += '</div>';

    // , Move log (last 6 moves)
    html += '<div class="poker-log">';
    const moves = this.game.moves || [];
    for (const m of moves.slice(-6).reverse()) {
      if (m.action) {
        html += `<div class="log-entry"><span class="log-player">${m.player?.slice(-6)||'?'}</span> ${m.action}${m.data?.amount ? ' ' + (m.data.amount/1e8).toFixed(2) + ' KAS' : ''}</div>`;
      }
    }
    html += '</div>';

    html += '</div>'; // poker-table
    return html;
  }

  _bindEvents() {
    document.querySelectorAll('.poker-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        let amount = 0;
        if (action === 'raise') {
          amount = parseInt(document.getElementById('poker-raise-slider')?.value || '0');
        }
        wsSend('game-action', { gameId: this.game.id, action, data: { amount }, player: this.myAddr });
      });
    });
    const slider = document.getElementById('poker-raise-slider');
    if (slider) {
      slider.addEventListener('input', () => {
        this.raiseAmount = parseInt(slider.value);
        const lbl = document.getElementById('poker-raise-label');
        if (lbl) lbl.textContent = (this.raiseAmount / 1e8).toFixed(2) + ' KAS';
      });
    }
  }

  onRemoteAction(data) {
    // State is pushed from server as game-state-update
  }

  onStateUpdate(newState) {
    this.state = newState;
    this.render();
  }
}

// ─── CSS Injection for Cards ──────────────────────────────

(function injectCardStyles() {
  if (document.getElementById('card-styles')) return;
  const style = document.createElement('style');
  style.id = 'card-styles';
  style.textContent = `
    .playing-card {
      display: inline-flex; flex-direction: column; justify-content: space-between;
      background: #fafafa; border-radius: 6px; border: 1px solid #555;
      color: var(--card-color, #e8e8e8); font-weight: 700; font-family: var(--font-mono);
      position: relative; user-select: none; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      transition: transform 0.15s ease;
    }
    .playing-card.sm  { width: 36px; height: 52px; font-size: 11px; padding: 2px 3px; }
    .playing-card.md  { width: 52px; height: 76px; font-size: 13px; padding: 3px 5px; }
    .playing-card.lg  { width: 72px; height: 104px; font-size: 16px; padding: 5px 7px; }
    .playing-card:hover { transform: translateY(-4px); }
    .card-tl { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; }
    .card-br { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; transform: rotate(180deg); }
    .card-center { position: absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:1.4em; }
    .card-suit { display: block; font-size: 0.8em; }
    .card-back { background: linear-gradient(135deg, #1a1a2e 25%, #16213e 25%, #16213e 50%, #1a1a2e 50%, #1a1a2e 75%, #16213e 75%); background-size: 8px 8px; border: 2px solid #779556; }
    .card-back-pattern { width: 100%; height: 100%; border: 2px solid rgba(119,149,86,0.5); border-radius: 4px; }
    .card-highlight { box-shadow: 0 0 0 2px var(--green), 0 2px 12px rgba(119,149,86,0.5); }
    .card-dim { opacity: 0.4; }
    .card-placeholder { display: inline-block; border: 2px dashed #444; border-radius: 6px; }
    .card-placeholder.sm  { width: 36px; height: 52px; }
    .card-placeholder.md  { width: 52px; height: 76px; }
    .card-hand { display: flex; gap: 4px; flex-wrap: nowrap; }
    /* Poker Table */
    .poker-table { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border); }
    .poker-stage-badge { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: var(--green); text-transform: uppercase; }
    .poker-community { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; background: #1a3320; border-radius: var(--radius); border: 1px solid #2d5a3d; }
    .poker-community-label { font-size: 11px; color: #8bac62; text-transform: uppercase; letter-spacing: 1px; }
    .poker-pot { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
    .poker-opponents { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    .poker-opponent-seat { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
    .seat-active { border-color: var(--green) !important; box-shadow: 0 0 0 1px var(--green); }
    .seat-folded { opacity: 0.4; }
    .seat-allin { border-color: var(--yellow) !important; }
    .seat-name { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
    .seat-chips { font-size: 12px; color: var(--green); font-weight: 600; }
    .seat-bet { font-size: 11px; color: var(--yellow); }
    .seat-rank { font-size: 10px; color: var(--blue); font-style: italic; }
    .badge-fold { background: var(--red-bg); color: var(--red); font-size: 9px; padding: 1px 4px; border-radius: 3px; }
    .badge-allin { background: var(--yellow-bg); color: var(--yellow); font-size: 9px; padding: 1px 4px; border-radius: 3px; }
    .poker-my-seat { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .my-seat-top { display: flex; justify-content: space-between; width: 100%; font-size: 13px; font-weight: 600; }
    .my-chips { color: var(--green); }
    .my-hand-rank { font-size: 13px; color: var(--blue); font-weight: 600; }
    .poker-actions { padding: 8px 0; }
    .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .raise-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
    .raise-control input[type=range] { flex: 1; accent-color: var(--green); }
    .poker-result { text-align: center; font-size: 20px; font-weight: 700; padding: 16px; border-radius: var(--radius); }
    .result-win { color: var(--green); background: var(--green-bg); }
    .result-lose { color: var(--red); background: var(--red-bg); }
    .poker-log { max-height: 120px; overflow-y: auto; border-top: 1px solid var(--border); padding-top: 8px; }
    .log-entry { font-size: 11px; color: var(--text-secondary); padding: 2px 0; }
    .log-player { color: var(--text-primary); font-weight: 600; margin-right: 4px; }
  `;
  document.head.appendChild(style);
})();

window.PokerUI = PokerUI;
window.renderCard = renderCard;
window.renderHand = renderHand;
