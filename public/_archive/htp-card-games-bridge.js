/**
 * htp-card-games-bridge.js — High Table Protocol v1.0
 *
 * Bridges the server-authoritative poker/blackjack engines (PokerUI, BlackjackUI)
 * to the Railway WS server and Firebase lobby system.
 *
 * Replaces the old inline PokerState / BJState client-side stubs with real
 * server-driven state from lib/games/poker.js + lib/games/blackjack.js.
 *
 * Load AFTER: poker-ui.js, blackjack-ui.js, htp-init.js, htp-games-sync.js
 */
(function(W) {
  'use strict';

  if (W.__htpCardGamesBridgeInstalled) return;
  W.__htpCardGamesBridgeInstalled = true;

  var LOG = function() { var a = Array.from(arguments); a.unshift('%c[HTP Cards]', 'color:#d4af37;font-weight:bold'); console.log.apply(console, a); };

  var _pokerUI = null;
  var _bjUI = null;
  var _activeGameId = null;
  var _myAddr = null;

  /* ── POKER LAUNCH ─────────────────────────────────────────────── */
  W.launchPokerFromMatch = function(matchId, time) {
    _activeGameId = matchId;
    _myAddr = W.connectedAddress || W.htpAddress || W.walletAddress || '';

    var overlay = document.getElementById('pokerOverlay') || createOverlay('pokerOverlay');
    var containerId = 'poker-ui-container';
    overlay.innerHTML = '<button onclick="document.getElementById(\'pokerOverlay\').style.display=\'none\'" style="position:fixed;top:16px;right:16px;z-index:9100;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700">&#x2715; Close</button><div id="' + containerId + '" class="card-game-container"></div>';
    overlay.style.display = 'flex';

    if (typeof PokerUI !== 'undefined') {
      _pokerUI = new PokerUI(containerId, { id: matchId, time: time || '5|0' }, _myAddr);
      LOG('PokerUI instantiated for match', matchId);
    } else {
      LOG('PokerUI not loaded — falling back to inline');
      if (typeof W.startPokerGame === 'function') W.startPokerGame({ id: matchId, time: time });
      return;
    }

    if (W.htpJoinGameRoom) W.htpJoinGameRoom(matchId);
    if (W.htpGameAction) W.htpGameAction(matchId, 'init', {}, _myAddr);

    W.addEventListener('htp:game:state', _onPokerState);
    W.addEventListener('htp:game:over', _onGameOver);
  };

  function _onPokerState(e) {
    var d = e.detail;
    if (!_pokerUI || !d || d.gameId !== _activeGameId) return;
    _pokerUI.hydrate(d.state);
  }

  /* ── BLACKJACK LAUNCH ─────────────────────────────────────────── */
  W.launchBlackjackFromMatch = function(matchId, time) {
    _activeGameId = matchId;
    _myAddr = W.connectedAddress || W.htpAddress || W.walletAddress || '';

    var overlay = document.getElementById('bjOverlay') || createOverlay('bjOverlay');
    var containerId = 'bj-ui-container';
    overlay.innerHTML = '<button onclick="document.getElementById(\'bjOverlay\').style.display=\'none\'" style="position:fixed;top:16px;right:16px;z-index:9100;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700">&#x2715; Close</button><div id="' + containerId + '" class="card-game-container"></div>';
    overlay.style.display = 'flex';

    if (typeof BlackjackUI !== 'undefined') {
      _bjUI = new BlackjackUI(containerId, { id: matchId, time: time || '3|0' }, _myAddr);
      LOG('BlackjackUI instantiated for match', matchId);
    } else {
      LOG('BlackjackUI not loaded — falling back to inline');
      if (typeof W.startBlackjackGame === 'function') W.startBlackjackGame({ id: matchId, time: time });
      return;
    }

    if (W.htpJoinGameRoom) W.htpJoinGameRoom(matchId);
    if (W.htpGameAction) W.htpGameAction(matchId, 'init', {}, _myAddr);

    W.addEventListener('htp:game:state', _onBJState);
    W.addEventListener('htp:game:over', _onGameOver);
  };

  function _onBJState(e) {
    var d = e.detail;
    if (!_bjUI || !d || d.gameId !== _activeGameId) return;
    _bjUI.hydrate(d.state);
  }

  /* ── GAME ACTION SENDER ───────────────────────────────────────── */
  W.htpSendCardAction = function(action, data) {
    if (!_activeGameId || !_myAddr) return;
    return W.htpGameAction(_activeGameId, action, data || {}, _myAddr);
  };

  /* ── GAME OVER ────────────────────────────────────────────────── */
  function _onGameOver(e) {
    var d = e.detail;
    if (!d || d.gameId !== _activeGameId) return;
    LOG('Game over:', d.winner, d.reason);
    W.removeEventListener('htp:game:state', _onPokerState);
    W.removeEventListener('htp:game:state', _onBJState);
    W.removeEventListener('htp:game:over', _onGameOver);
    _pokerUI = null;
    _bjUI = null;
    if (typeof W.handleMatchGameOver === 'function') {
      W.handleMatchGameOver(d.reason || 'game-over', d.winner);
    }
  }

  /* ── CARD GAME CSS ────────────────────────────────────────────── */
  function injectCardCSS() {
    if (document.getElementById('htp-card-css')) return;
    var s = document.createElement('style');
    s.id = 'htp-card-css';
    s.textContent = [
      '.card-game-container{width:100%;max-width:760px;margin:0 auto;padding:16px;}',
      '.card-game-overlay{position:fixed;inset:0;background:rgba(0,10,20,.95);z-index:9000;',
        'display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 0;}',
      '.playing-card{display:inline-flex;flex-direction:column;justify-content:space-between;',
        'border-radius:8px;border:1px solid rgba(255,255,255,.15);',
        'background:linear-gradient(145deg,#1a1f2e,#0d1117);',
        'padding:4px 6px;font-weight:700;color:var(--card-color,#e8e8e8);',
        'user-select:none;transition:transform .12s,box-shadow .12s;}',
      '.playing-card.sm{width:44px;height:64px;font-size:12px;}',
      '.playing-card.md{width:60px;height:88px;font-size:15px;}',
      '.playing-card.lg{width:78px;height:112px;font-size:18px;}',
      '.playing-card.card-back{background:repeating-linear-gradient(',
        '45deg,#0d2a1a,#0d2a1a 4px,#0a2016 4px,#0a2016 8px);',
        'border-color:rgba(255,255,255,.25);}',
      '.playing-card.card-highlight{box-shadow:0 0 14px rgba(255,255,255,.6);',
        'border-color:rgba(255,255,255,.6);transform:translateY(-4px);}',
      '.playing-card.card-dim{opacity:.45;}',
      '.card-center{font-size:1.6em;text-align:center;line-height:1;}',
      '.card-suit{font-size:.75em;}',
      '.card-hand{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}',
      '.poker-table{background:radial-gradient(ellipse at center,#0d3320 0%,#081a10 100%);',
        'border-radius:16px;border:2px solid rgba(255,255,255,.2);padding:20px;',
        'min-height:400px;display:flex;flex-direction:column;gap:16px;}',
      '.poker-community{text-align:center;padding:16px;',
        'border:1px solid rgba(255,255,255,.1);border-radius:12px;',
        'background:rgba(0,0,0,.3);}',
      '.poker-pot{font-size:22px;font-weight:800;color:#f59e0b;margin:8px 0;}',
      '.poker-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;}',
      '.poker-btn{padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px;',
        'cursor:pointer;border:none;transition:transform .12s,opacity .12s;}',
      '.poker-btn:active{transform:scale(.96);}',
      '.poker-btn-fold{background:#7f1d1d;color:#fca5a5;}',
      '.poker-btn-call{background:#1e3a5f;color:#93c5fd;}',
      '.poker-btn-raise{background:rgba(255,255,255,.15);color:#ffffff;',
        'border:1px solid rgba(255,255,255,.4);}',
      '.poker-btn-check{background:rgba(255,255,255,.08);color:#e2e8f0;',
        'border:1px solid rgba(255,255,255,.12);}',
      '.bj-table{background:radial-gradient(ellipse at center,#1a0d3a 0%,#0d0820 100%);',
        'border-radius:16px;border:2px solid rgba(167,139,250,.2);padding:20px;',
        'min-height:360px;display:flex;flex-direction:column;gap:16px;}',
      '.bj-section-label{font-size:11px;font-weight:700;letter-spacing:.08em;',
        'text-transform:uppercase;color:#94a3b8;margin-bottom:8px;}',
      '.bj-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}',
      '.bj-btn{padding:10px 18px;border-radius:8px;font-weight:700;font-size:12px;',
        'cursor:pointer;border:1px solid rgba(255,255,255,.12);',
        'background:rgba(255,255,255,.06);color:#e2e8f0;transition:background .15s;}',
      '.bj-btn:hover{background:rgba(255,255,255,.12);}',
      '.bj-btn-hit{border-color:rgba(255,255,255,.4);color:#ffffff;}',
      '.bj-btn-stand{border-color:rgba(239,68,68,.4);color:#fca5a5;}',
      '.bj-btn-double{border-color:rgba(245,158,11,.4);color:#fcd34d;}',
      '.bj-result-badge{display:inline-block;padding:2px 8px;border-radius:4px;',
        'font-size:11px;font-weight:800;text-transform:uppercase;margin-left:6px;}',
      '.bj-win{background:rgba(255,255,255,.2);color:#ffffff;}',
      '.bj-lose{background:rgba(239,68,68,.2);color:#fca5a5;}',
      '.bj-push{background:rgba(148,163,184,.15);color:#94a3b8;}',
      '.bj-bust{background:rgba(239,68,68,.3);color:#fca5a5;}',
      '.total-bust{color:#ef4444!important;}',
      '.total-bj{color:#f59e0b!important;}'
    ].join('');
    document.head.appendChild(s);
  }

  function createOverlay(id) {
    var el = document.createElement('div');
    el.id = id;
    el.className = 'card-game-overlay';
    document.body.appendChild(el);
    return el;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCardCSS);
  } else {
    injectCardCSS();
  }

  LOG('Card games bridge ready — poker + blackjack wired to Railway WS');

})(window);
