'use strict';

// ============================================================
// HIGH TABLE PROTOCOL v8.0 , Frontend Application
// ============================================================

const API = '';
const WS_URL = 'wss://hightable.pro/ws';

const app = {
  wallet: new WalletUI(),
  ws: null,
  currentView: 'dashboard',
  markets: [],
  games: [],
  feedItems: [],
  dagBlocks: [],
  dagInterval: null,
  mainnetPollInterval: null,
};

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initWallet();
  initWebSocket();
  loadDashboard();
  initCreateForm();
});

// ─── ROUTER ──────────────────────────────────────────────
function initRouter() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.view);
    });
  });

  document.getElementById('logo').addEventListener('click', () => navigateTo('dashboard'));

  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1) || 'dashboard';
    const parts = hash.split('/');
    if (parts[0] === 'market' && parts[1]) {
      showMarketDetail(parts[1]);
    } else if (parts[0] === 'game' && parts[1]) {
      showGamePlay(parts[1]);
    } else {
      switchView(parts[0]);
    }
  });

  const initialHash = location.hash.slice(1);
  if (initialHash) {
    const parts = initialHash.split('/');
    if (parts[0] === 'market' && parts[1]) showMarketDetail(parts[1]);
    else if (parts[0] === 'game' && parts[1]) showGamePlay(parts[1]);
    else switchView(parts[0]);
  }
}

function navigateTo(view, sub) {
  location.hash = sub ? view + '/' + sub : view;
  if (!sub) switchView(view);
}

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });

  app.currentView = view;

  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'markets': loadMarkets(); break;
    case 'games': loadGames(); break;
    case 'portfolio': loadPortfolio(); break;
    case 'vault': loadVault(); break;
    case 'terms': loadTerms(); break;
  }
}

// ─── WALLET ──────────────────────────────────────────────
function initWallet() {
  app.wallet.renderConnectButton('wallet-container');

  app.wallet.on('connected', () => {
    app.wallet.renderConnectButton('wallet-container');
    app.wallet.startBalancePolling(15000);
    if (app.currentView === 'portfolio') loadPortfolio();
    toast('Wallet connected', 'success');
  });

  app.wallet.on('disconnected', () => {
    app.wallet.renderConnectButton('wallet-container');
    app.wallet.stopBalancePolling();
    if (app.currentView === 'portfolio') loadPortfolio();
  });

  app.wallet.on('balanceChanged', () => {
    app.wallet.renderConnectButton('wallet-container');
  });
}

// ─── WEBSOCKET ───────────────────────────────────────────
function initWebSocket() {
  app.ws = new WebSocket(WS_URL);

  app.ws.onopen = () => {
    document.querySelector('.net-dot').style.background = '#00ffa3';
  };

  app.ws.onclose = () => {
    document.querySelector('.net-dot').style.background = '#f59e0b';
    setTimeout(initWebSocket, 3000);
  };

  app.ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleWsEvent(msg.event, msg.data);
    } catch {}
  };
}

function wsSend(type, data) {
  if (app.ws && app.ws.readyState === 1) {
    app.ws.send(JSON.stringify({ type, ...data }));
  }
}

function handleWsEvent(event, data) {
  switch (event) {
    case 'market-created':
      addFeedItem('New market: ' + (data.market?.title || ''));
      if (app.currentView === 'dashboard') loadDashboard();
      if (app.currentView === 'markets') loadMarkets();
      break;
    case 'position-taken':
      addFeedItem('Position taken on market');
      break;
    case 'pool-updated':
      break;
    case 'market-resolved':
      addFeedItem('Market resolved: ' + data.marketId);
      if (app.currentView === 'dashboard') loadDashboard();
      if (app.currentView === 'markets') loadMarkets();
      break;
    case 'game-created':
      addFeedItem('New game: ' + (data.game?.type || ''));
      if (app.currentView === 'games') loadGames();
      break;
    case 'game-started':
      addFeedItem('Game started');
      break;
    case 'game-over':
      addFeedItem('Game over: ' + (data.reason || ''));
      break;
    case 'game-move':
      break;
    case 'game-settled':
      addFeedItem('Game settled on-chain');
      break;
  }
}

// ─── DASHBOARD ───────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, markets, games, leaderboard] = await Promise.all([
      apiFetch('/api/stats'),
      apiFetch('/api/markets?status=open'),
      apiFetch('/api/games?status=waiting'),
      apiFetch('/api/leaderboard?limit=10'),
    ]);

    document.getElementById('stat-markets').textContent = stats.openMarkets || 0;
    document.getElementById('stat-volume').textContent = formatKas(stats.totalVolumeSompi || 0) + ' KAS';
    document.getElementById('stat-games').textContent = stats.activeGames || 0;
    document.getElementById('stat-users').textContent = stats.totalUsers || 0;

    renderTrendingMarkets(markets.slice(0, 5));
    renderOpenGames(games.slice(0, 5));
    renderLeaderboard(leaderboard);
    renderFeed();
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function renderTrendingMarkets(markets) {
  const el = document.getElementById('trending-markets');
  if (!markets.length) {
    el.innerHTML = '<div class="empty-state">No active markets yet. <a href="#" data-view="create">Create one →</a></div>';
    return;
  }
  el.innerHTML = markets.map(m => {
    const odds = m.odds || { impliedProbA: 0.5, impliedProbB: 0.5 };
    const pctA = Math.round(odds.impliedProbA * 100);
    const pctB = 100 - pctA;
    return '<div class="market-card" onclick="navigateTo(\'market\',\'' + m.id + '\')">' +
      '<div class="market-card-header">' +
        '<span class="market-category cat-' + m.category + '">' + m.category + '</span>' +
        '<span class="market-badge badge-open">OPEN</span>' +
      '</div>' +
      '<div class="market-title">' + esc(m.title) + '</div>' +
      '<div class="market-odds-bar">' +
        '<div class="odds-side-a" style="width:' + pctA + '%">' + m.outcomeA + ' ' + pctA + '%</div>' +
        '<div class="odds-side-b" style="width:' + pctB + '%">' + m.outcomeB + ' ' + pctB + '%</div>' +
      '</div>' +
      '<div class="market-meta">' +
        '<span>' + m.positionCount + ' positions</span>' +
        '<span class="market-volume">' + formatKas(m.poolAmountSompi) + ' KAS</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderOpenGames(games) {
  const el = document.getElementById('open-games');
  if (!games.length) {
    el.innerHTML = '<div class="empty-state">No open games. <a href="#" id="link-create-game">Create one →</a></div>';
    return;
  }
  const icons = { chess: '♚', checkers: '⛀', connect4: '◉' };
  el.innerHTML = games.map(g => {
    return '<div class="game-card" onclick="navigateTo(\'game\',\'' + g.id + '\')">' +
      '<div class="game-type-icon">' + (icons[g.type] || '') + '</div>' +
      '<div class="game-stake">' + formatKas(g.stakeSompi) + ' KAS</div>' +
      '<div class="game-players">' + shortAddr(g.playerA) + ' vs ???</div>' +
      '<div class="game-time-control"> ' + (g.timeControl || '10+0') + ' · ' + g.type + '</div>' +
    '</div>';
  }).join('');
}

function renderLeaderboard(users) {
  const el = document.getElementById('leaderboard');
  if (!users.length) { el.innerHTML = '<div class="empty-state">No data yet</div>'; return; }
  el.innerHTML = users.map((u, i) => {
    return '<div class="lb-row">' +
      '<span class="lb-rank">' + (i < 3 ? ['','',''][i] : '#' + (i+1)) + '</span>' +
      '<span class="lb-addr">' + shortAddr(u.addr) + '</span>' +
      '<span class="lb-won">+' + formatKas(u.totalWon) + '</span>' +
    '</div>';
  }).join('');
}

function renderFeed() {
  const el = document.getElementById('live-feed');
  if (!app.feedItems.length) { el.innerHTML = '<div class="empty-state">Waiting for activity...</div>'; return; }
  el.innerHTML = app.feedItems.slice(0, 20).map(f => {
    return '<div class="feed-item"><span>' + f.text + '</span><span class="feed-time">' + f.time + '</span></div>';
  }).join('');
}

function addFeedItem(text) {
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  app.feedItems.unshift({ text, time });
  if (app.feedItems.length > 50) app.feedItems.pop();
  if (app.currentView === 'dashboard') renderFeed();
}

// ─── UTILITIES ───────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

function formatKas(sompi) {
  const kas = (sompi || 0) / 1e8;
  if (kas >= 1000000) return (kas / 1000000).toFixed(1) + 'M';
  if (kas >= 1000) return (kas / 1000).toFixed(1) + 'K';
  return kas.toFixed(kas < 1 ? 4 : 2);
}

function shortAddr(addr) {
  if (!addr) return '???';
  const parts = addr.split(':');
  const a = parts.length > 1 ? parts[1] : parts[0];
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.classList.add('toast-visible'), 10);
  setTimeout(() => {
    t.classList.remove('toast-visible');
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

function timeAgo(timestamp) {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// ─── MARKETS VIEW ────────────────────────────────────────
async function loadMarkets() {
  try {
    const markets = await apiFetch('/api/markets');
    app.markets = markets;
    renderMarkets(markets);
    initMarketFilters();
  } catch (e) {
    console.error('Load markets error:', e);
  }
}

function renderMarkets(markets) {
  const el = document.getElementById('markets-grid');
  if (!markets.length) {
    el.innerHTML = '<div class="empty-state">No markets found. <a href="#" data-view="create">Create the first one →</a></div>';
    return;
  }
  el.innerHTML = markets.map(m => {
    const odds = m.odds || { impliedProbA: 0.5, impliedProbB: 0.5 };
    const pctA = Math.round(odds.impliedProbA * 100);
    const pctB = 100 - pctA;
    const statusClass = m.status === 'open' ? 'badge-open' : m.status === 'resolved' ? 'badge-resolved' : 'badge-closed';
    const modeLabel = m.marketMode === 1 ? '<span class="market-badge badge-maximizer">MAX</span>' :
                      m.marketMode === 2 ? '<span class="market-badge badge-custom">OPEN</span>' : '';

    return '<div class="market-card" onclick="navigateTo(\'market\',\'' + m.id + '\')">' +
      '<div class="market-card-header">' +
        '<span class="market-category cat-' + m.category + '">' + m.category + '</span>' +
        '<div>' + modeLabel + ' <span class="market-badge ' + statusClass + '">' + m.status.toUpperCase() + '</span></div>' +
      '</div>' +
      '<div class="market-title">' + esc(m.title) + '</div>' +
      '<div class="market-odds-bar">' +
        '<div class="odds-side-a" style="width:' + Math.max(pctA, 8) + '%">' + esc(m.outcomeA) + ' ' + pctA + '%</div>' +
        '<div class="odds-side-b" style="width:' + Math.max(pctB, 8) + '%">' + esc(m.outcomeB) + ' ' + pctB + '%</div>' +
      '</div>' +
      '<div class="market-meta">' +
        '<span>' + m.positionCount + ' positions · ' + timeAgo(m.createdAt) + '</span>' +
        '<span class="market-volume">' + formatKas(m.poolAmountSompi) + ' KAS</span>' +
      '</div>' +
      (m.customScript ? '<div style="margin-top:8px"><span class="market-badge badge-custom">CUSTOM SCRIPT</span></div>' : '') +
    '</div>';
  }).join('');
}

function initMarketFilters() {
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      const filtered = f === 'all' ? app.markets : app.markets.filter(m => m.category === f);
      renderMarkets(filtered);
    };
  });

  const sortEl = document.getElementById('market-sort');
  if (sortEl) {
    sortEl.onchange = () => {
      const sorted = [...app.markets];
      switch (sortEl.value) {
        case 'volume': sorted.sort((a, b) => b.poolAmountSompi - a.poolAmountSompi); break;
        case 'closing': sorted.sort((a, b) => a.closeDaa - b.closeDaa); break;
        default: sorted.sort((a, b) => b.createdAt - a.createdAt);
      }
      renderMarkets(sorted);
    };
  }
}

// ─── MARKET DETAIL ───────────────────────────────────────
async function showMarketDetail(marketId) {
  switchView('market-detail');
  const el = document.getElementById('market-detail-content');
  el.innerHTML = '<div class="empty-state">Loading...</div>';

  try {
    const m = await apiFetch('/api/markets/' + marketId);
    const odds = m.odds || { oddsA: 2, oddsB: 2, impliedProbA: 0.5, impliedProbB: 0.5 };
    const pctA = Math.round(odds.impliedProbA * 100);
    const pctB = 100 - pctA;
    const isOpen = m.status === 'open';
    const modeLabels = { 0: 'Spot Only', 1: 'Maximizer Only', 2: 'Open (User Picks)' };

    el.innerHTML =
      '<div class="detail-header">' +
        '<a href="#markets" class="link" style="font-size:12px">← Back to Markets</a>' +
        '<div class="detail-title">' + esc(m.title) + '</div>' +
        '<div class="detail-meta">' +
          '<span class="market-badge badge-' + m.status + '">' + m.status.toUpperCase() + '</span>' +
          '<span class="market-category cat-' + m.category + '">' + m.category + '</span>' +
          '<span>' + (modeLabels[m.marketMode] || 'Open') + '</span>' +
          '<span>Created ' + timeAgo(m.createdAt) + '</span>' +
          (m.customScript ? '<span class="market-badge badge-custom">CUSTOM SCRIPT</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="detail-grid">' +
        '<div>' +
          '<div class="card" style="margin-bottom:20px">' +
            '<h3 style="margin-bottom:12px">Pool Distribution</h3>' +
            '<div class="market-odds-bar" style="height:48px;font-size:14px">' +
              '<div class="odds-side-a" style="width:' + Math.max(pctA, 10) + '%">' + esc(m.outcomeA) + ' ' + pctA + '%</div>' +
              '<div class="odds-side-b" style="width:' + Math.max(pctB, 10) + '%">' + esc(m.outcomeB) + ' ' + pctB + '%</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">' +
              '<div class="stat-card"><span class="stat-value">' + formatKas(m.poolAmountSompi) + '</span><span class="stat-label">Pool (KAS)</span></div>' +
              '<div class="stat-card"><span class="stat-value">' + m.positionCount + '</span><span class="stat-label">Positions</span></div>' +
              '<div class="stat-card"><span class="stat-value">' + odds.oddsA.toFixed(2) + 'x / ' + odds.oddsB.toFixed(2) + 'x</span><span class="stat-label">Odds A / B</span></div>' +
            '</div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:20px">' +
            '<h3 style="margin-bottom:12px">Description</h3>' +
            '<p style="color:var(--text-secondary);line-height:1.6">' + esc(m.description || 'No description provided.') + '</p>' +
          '</div>' +

          '<div class="card">' +
            '<h3 style="margin-bottom:12px">Positions (' + m.positions.length + ')</h3>' +
            '<div style="max-height:300px;overflow-y:auto">' +
              (m.positions.length === 0 ? '<div class="empty-state">No positions yet</div>' :
              m.positions.map(p => {
                const sideLabel = p.side === 1 ? m.outcomeA : m.outcomeB;
                const sideColor = p.side === 1 ? '#00ffa3' : 'var(--red)';
                const riskLabel = p.riskMode === 1 ? 'MAX' : 'SPOT';
                return '<div class="feed-item">' +
                  '<span><span style="color:' + sideColor + ';font-weight:600">' + sideLabel + '</span> · ' +
                    formatKas(p.amountSompi) + ' KAS · ' + riskLabel + ' · ' + shortAddr(p.userAddr) + '</span>' +
                  '<span class="feed-time">' + timeAgo(p.createdAt) + '</span>' +
                '</div>';
              }).join('')) +
            '</div>' +
          '</div>' +

          (m.status === 'resolved' ? renderResolutionCard(m) : '') +
        '</div>' +

        (isOpen ? renderPositionPanel(m) : '<div></div>') +
      '</div>';

    if (isOpen) initPositionPanel(m);
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Error loading market: ' + esc(e.message) + '</div>';
  }
}

function renderResolutionCard(m) {
  const winSide = m.outcome === 1 ? m.outcomeA : m.outcomeB;
  return '<div class="card" style="margin-top:20px;border-color:var(--green)">' +
    '<h3 style="margin-bottom:12px;color:var(--green)">Resolved</h3>' +
    '<p style="color:var(--text-secondary)">Winner: <strong style="color:var(--green)">' + esc(winSide) + '</strong></p>' +
    (m.resolutionTxId ? '<p style="margin-top:8px;font-size:12px;color:var(--text-muted)">TX: ' + m.resolutionTxId.slice(0, 16) + '...</p>' : '') +
  '</div>';
}

function renderPositionPanel(m) {
  const showRisk = m.marketMode === 2;
  return '<div class="position-panel">' +
    '<h3>Take Position</h3>' +
    '<div class="side-selector">' +
      '<button class="side-btn" id="side-a-btn" onclick="selectSide(1)">' + esc(m.outcomeA) + '</button>' +
      '<button class="side-btn" id="side-b-btn" onclick="selectSide(2)">' + esc(m.outcomeB) + '</button>' +
    '</div>' +
    (showRisk ?
      '<label style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;display:block">Risk Mode</label>' +
      '<div class="risk-selector">' +
        '<button class="risk-btn active" id="risk-spot-btn" onclick="selectRisk(0)">Spot</button>' +
        '<button class="risk-btn" id="risk-max-btn" onclick="selectRisk(1)">Maximizer</button>' +
      '</div>' : '') +
    '<div class="form-group">' +
      '<label>Amount (KAS)</label>' +
      '<input type="number" id="pos-amount" class="input" value="10" min="1" step="1" oninput="updateEstimate(\'' + m.id + '\')">' +
    '</div>' +
    '<div class="payout-preview">' +
      '<div style="font-size:12px;color:var(--text-secondary)">Estimated Payout</div>' +
      '<div class="payout-value" id="est-payout">-- KAS</div>' +
      '<div style="font-size:11px;color:var(--text-muted)" id="est-odds">Select a side</div>' +
    '</div>' +
    '<button class="btn btn-primary btn-lg" id="btn-take-position" onclick="takePosition(\'' + m.id + '\')" disabled>' +
      'Select a Side' +
    '</button>' +
  '</div>';
}

// ─── POSITION PANEL LOGIC ────────────────────────────────
let selectedSide = null;
let selectedRisk = 0;

function selectSide(side) {
  selectedSide = side;
  document.getElementById('side-a-btn').className = 'side-btn' + (side === 1 ? ' selected-a' : '');
  document.getElementById('side-b-btn').className = 'side-btn' + (side === 2 ? ' selected-b' : '');
  const btn = document.getElementById('btn-take-position');
  btn.disabled = false;
  btn.textContent = 'Place Position';
  const marketId = location.hash.split('/')[1];
  if (marketId) updateEstimate(marketId);
}

function selectRisk(mode) {
  selectedRisk = mode;
  const spotBtn = document.getElementById('risk-spot-btn');
  const maxBtn = document.getElementById('risk-max-btn');
  if (spotBtn) spotBtn.className = 'risk-btn' + (mode === 0 ? ' active' : '');
  if (maxBtn) maxBtn.className = 'risk-btn' + (mode === 1 ? ' active' : '');
  const marketId = location.hash.split('/')[1];
  if (marketId) updateEstimate(marketId);
}

function initPositionPanel(m) {
  selectedSide = null;
  selectedRisk = 0;
}

async function updateEstimate(marketId) {
  if (!selectedSide) return;
  const amount = Math.floor(parseFloat(document.getElementById('pos-amount').value || '0') * 1e8);
  if (amount <= 0) return;

  try {
    const data = await apiFetch('/api/markets/' + marketId + '/estimate?side=' + selectedSide + '&amount=' + amount + '&riskMode=' + selectedRisk);
    document.getElementById('est-payout').textContent = formatKas(data.estimatedPayout) + ' KAS';
    const mult = (data.estimatedPayout / amount).toFixed(2);
    document.getElementById('est-odds').textContent = mult + 'x return · ' + (selectedRisk === 1 ? 'Maximizer' : 'Spot') + ' mode';
  } catch {}
}

async function takePosition(marketId) {
  if (!selectedSide) return toast('Select a side first', 'error');
  if (!app.wallet.isConnected()) return toast('Connect your wallet first', 'error');

  const amountKas = parseFloat(document.getElementById('pos-amount').value || '0');
  if (amountKas < 1) return toast('Minimum 1 KAS', 'error');

  const btn = document.getElementById('btn-take-position');
  btn.disabled = true;
  btn.textContent = 'Signing...';

  try {
    const result = await apiFetch('/api/markets/' + marketId + '/position', {
      method: 'POST',
      body: JSON.stringify({
        userAddr: app.wallet.address,
        userPubkey: app.wallet.pubkey,
        side: selectedSide,
        riskMode: selectedRisk,
        amountKas: amountKas,
      }),
    });

    const { txId } = await app.wallet.signAndBroadcast(result.pskt);
    if (txId) {
      toast('Position placed! TX: ' + txId.slice(0, 12) + '...', 'success');
    } else {
      toast('Position signed. Broadcasting...', 'info');
    }

    setTimeout(() => showMarketDetail(marketId), 2000);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Place Position';
  }
}

// ─── GAMES VIEW ──────────────────────────────────────────
async function loadGames() {
  try {
    const games = await apiFetch('/api/games');
    app.games = games;
    renderGames(games);
    initGameFilters();
  } catch (e) {
    console.error('Load games error:', e);
  }

  const createBtn = document.getElementById('btn-create-game');
  if (createBtn) createBtn.onclick = () => showCreateGameModal();
}

function renderGames(games) {
  const el = document.getElementById('games-grid');
  if (!games.length) {
    el.innerHTML = '<div class="empty-state">No games yet. Click + New Game to start.</div>';
    return;
  }
  const icons = { chess: '♚', checkers: '⛀', connect4: '◉' };
  const statusColors = { waiting: 'badge-open', playing: 'badge-custom', finished: 'badge-resolved' };

  el.innerHTML = games.map(g => {
    const playerB = g.playerB ? shortAddr(g.playerB) : 'Waiting...';
    return '<div class="game-card" onclick="navigateTo(\'game\',\'' + g.id + '\')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<div class="game-type-icon">' + (icons[g.type] || '') + '</div>' +
        '<span class="market-badge ' + (statusColors[g.status] || '') + '">' + g.status.toUpperCase() + '</span>' +
      '</div>' +
      '<div class="game-stake">' + formatKas(g.stakeSompi) + ' KAS</div>' +
      '<div class="game-players">' + shortAddr(g.playerA) + ' vs ' + playerB + '</div>' +
      '<div class="game-time-control"> ' + (g.timeControl || '10+0') + ' · ' + g.type + '</div>' +
      (g.status === 'finished' && g.winner ? '<div style="margin-top:8px;font-size:12px;color:var(--green)"> ' + (g.winner === 'draw' ? 'Draw' : shortAddr(g.winner)) + '</div>' : '') +
    '</div>';
  }).join('');
}

function initGameFilters() {
  document.querySelectorAll('[data-game-filter]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-game-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.gameFilter;
      const filtered = f === 'all' ? app.games : app.games.filter(g => g.type === f);
      renderGames(filtered);
    };
  });
}

function showCreateGameModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  overlay.classList.add('active');
  modal.classList.add('active');

  modal.innerHTML =
    '<div class="modal-header"><h2>New Game</h2><button class="modal-close" onclick="closeModal()">×</button></div>' +
    '<div class="form-group">' +
      '<label>Game Type</label>' +
      '<select id="game-type" class="select">' +
        '<option value="chess">♚ Chess</option>' +
        '<option value="checkers">⛀ Checkers</option>' +
        '<option value="connect4">◉ Connect 4</option>' +
      '</select>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Stake (KAS)</label>' +
      '<input type="number" id="game-stake" class="input" value="10" min="1" step="1">' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Time Control</label>' +
      '<select id="game-time" class="select">' +
        '<option value="5+0">5 min (Blitz)</option>' +
        '<option value="10+0" selected>10 min (Rapid)</option>' +
        '<option value="15+10">15+10 (Rapid)</option>' +
        '<option value="30+0">30 min (Classical)</option>' +
        '<option value="0">No Clock</option>' +
      '</select>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Timeout (hours)</label>' +
      '<input type="number" id="game-timeout" class="input" value="4" min="1" max="72">' +
    '</div>' +
    '<div class="bond-notice">Stake will be locked in an on-chain escrow covenant. 2% protocol fee on payout.</div>' +
    '<button class="btn btn-primary btn-lg" id="btn-submit-game" onclick="createGame()">Create & Stake</button>';

  overlay.onclick = closeModal;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal').classList.remove('active');
}

async function createGame() {
  if (!app.wallet.isConnected()) return toast('Connect your wallet first', 'error');

  const type = document.getElementById('game-type').value;
  const stakeKas = parseFloat(document.getElementById('game-stake').value || '10');
  const timeControl = document.getElementById('game-time').value;
  const timeoutHours = parseInt(document.getElementById('game-timeout').value || '4');

  const btn = document.getElementById('btn-submit-game');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const privkey = app.wallet.privkey || sessionStorage.getItem('htp_privkey');
    const result = await apiFetch('/api/games', {
      method: 'POST',
      body: JSON.stringify({
        type,
        playerA: app.wallet.address,
        stakeKas,
        privkey,
        timeControl,
        timeoutHours,
      }),
    });

    toast('Game created! Escrow TX: ' + (result.escrowTxId || '').slice(0,12) + '...', 'success');
    closeModal();
    navigateTo('game', result.game.id);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Create & Stake';
  }
}

// ─── GAME PLAY ───────────────────────────────────────────
async function showGamePlay(gameId) {
  switchView('game-play');
  const el = document.getElementById('game-play-content');
  el.innerHTML = '<div class="empty-state">Loading game...</div>';

  try {
    const game = await apiFetch('/api/games/' + gameId);
    wsSend('join-game', { gameId });

    if (game.status === 'waiting') {
      renderWaitingRoom(el, game);
    } else {
      renderGameBoard(el, game);
    }
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Error: ' + esc(e.message) + '</div>';
  }
}

function renderWaitingRoom(el, game) {
  const isCreator = app.wallet.isConnected() && app.wallet.address === game.playerA;
  const canJoin = app.wallet.isConnected() && app.wallet.address !== game.playerA;
  const icons = { chess: '♚', checkers: '⛀', connect4: '◉' };

  el.innerHTML =
    '<div style="max-width:500px;margin:60px auto;text-align:center">' +
      '<div style="font-size:64px;margin-bottom:20px">' + (icons[game.type] || '') + '</div>' +
      '<h2>Waiting for Opponent</h2>' +
      '<p style="color:var(--text-secondary);margin:12px 0">Game: ' + game.type + ' · Stake: ' + formatKas(game.stakeSompi) + ' KAS ·  ' + game.timeControl + '</p>' +
      '<p style="color:var(--text-muted);font-size:12px">Created by ' + shortAddr(game.playerA) + '</p>' +
      '<div style="margin:24px 0;padding:16px;background:var(--bg-secondary);border-radius:var(--radius);font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--text-muted)">' +
        'Share link: ' + location.origin + '/#game/' + game.id +
      '</div>' +
      (canJoin ? '<button class="btn btn-primary btn-lg" onclick="joinGame(\'' + game.id + '\')">Join Game (' + formatKas(game.stakeSompi) + ' KAS)</button>' : '') +
      (isCreator ? '<p style="color:var(--text-muted);margin-top:16px;font-size:13px">Share the link above with your opponent.</p>' +
        '<button class="btn btn-danger" style="margin-top:12px" onclick="cancelGame(\'' + game.id + '\')">Cancel Game</button>' : '') +
      (!app.wallet.isConnected() ? '<p style="color:var(--yellow);margin-top:16px">Connect wallet to join this game.</p>' : '') +
    '</div>';
}

function renderGameBoard(el, game) {
  const myColor = app.wallet.isConnected() && app.wallet.address === game.playerA ? 'white' : 'black';

  el.innerHTML =
    '<div class="game-container">' +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<a href="#games" class="link" style="font-size:12px">← Back</a>' +
          '<span class="market-badge badge-' + (game.status === 'playing' ? 'custom' : 'resolved') + '">' + game.status.toUpperCase() + '</span>' +
        '</div>' +
        '<div class="board-wrapper" id="board-container"></div>' +
      '</div>' +
      '<div class="game-sidebar">' +
        '<div class="game-clock" id="clock-opponent">--:--</div>' +
        '<div class="card" style="flex:1">' +
          '<h3 style="margin-bottom:8px;font-size:14px">Moves</h3>' +
          '<div class="move-list" id="move-list"></div>' +
        '</div>' +
        '<div class="game-clock clock-active" id="clock-self">--:--</div>' +
        '<div style="font-size:12px;color:var(--text-secondary);text-align:center">' +
          'Stake: ' + formatKas(game.stakeSompi) + ' KAS per side · ' + game.type +
        '</div>' +
        (game.status === 'playing' ? '<div class="game-actions">' +
          '<button class="btn btn-secondary" style="flex:1" onclick="offerDraw(\'' + game.id + '\')">½ Draw</button>' +
          '<button class="btn btn-danger" style="flex:1" onclick="resignGame(\'' + game.id + '\')">Resign</button>' +
        '</div>' : '') +
        (game.status === 'finished' ? '<div style="text-align:center;padding:12px;background:var(--green-bg);border-radius:var(--radius);color:var(--green);font-weight:600">' +
          (game.winner === 'draw' ? '½ Draw' : 'Winner: ' + shortAddr(game.winner)) +
        '</div>' : '') +
      '</div>' +
    '</div>';

  if (game.type === 'chess' && typeof ChessUI !== 'undefined') {
    const chess = new ChessUI('board-container', game, myColor);
    chess.render();
    window._currentGame = chess;
  } else if (game.type === 'checkers' && typeof CheckersUI !== 'undefined') {
    const checkers = new CheckersUI('board-container', game, myColor);
    checkers.render();
    window._currentGame = checkers;
  } else if (game.type === 'connect4' && typeof Connect4UI !== 'undefined') {
    const c4 = new Connect4UI('board-container', game, myColor);
    c4.render();
    window._currentGame = c4;
  }

  renderMoveList(game.moves || []);
}

function renderMoveList(moves) {
  const el = document.getElementById('move-list');
  if (!el) return;
  if (!moves.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:12px">No moves yet</div>'; return; }
  let html = '';
  for (let i = 0; i < moves.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const w = moves[i] ? (moves[i].from + '-' + moves[i].to) : '';
    const b = moves[i + 1] ? (moves[i + 1].from + '-' + moves[i + 1].to) : '';
    html += '<div style="display:flex;gap:8px;padding:2px 0"><span style="color:var(--text-muted);width:24px">' + num + '.</span><span style="flex:1">' + w + '</span><span style="flex:1">' + b + '</span></div>';
  }
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

async function joinGame(gameId) {
  if (!app.wallet.isConnected()) return toast('Connect your wallet', 'error');
  try {
    const result = await apiFetch('/api/games/' + gameId + '/join', {
      method: 'POST',
      body: JSON.stringify({
        playerB: app.wallet.address,
        playerBPubkey: app.wallet.pubkey,
      }),
    });
    const { txId } = await app.wallet.signAndBroadcast(result.pskt);
    toast('Joined game!', 'success');
    showGamePlay(gameId);
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function resignGame(gameId) {
  if (!confirm('Are you sure you want to resign?')) return;
  wsSend('game-resign', { gameId, player: app.wallet.address });
}

function offerDraw(gameId) {
  wsSend('game-draw-offer', { gameId, player: app.wallet.address });
  toast('Draw offer sent', 'info');
}

async function cancelGame(gameId) {
  if (!confirm('Cancel this game and reclaim your stake?')) return;
  toast('Cancellation not yet implemented on-chain', 'info');
}

// ─── PORTFOLIO VIEW ──────────────────────────────────────
async function loadPortfolio() {
  if (!app.wallet.isConnected()) {
    document.getElementById('portfolio-not-connected').style.display = 'block';
    document.getElementById('portfolio-content').style.display = 'none';
    return;
  }
  document.getElementById('portfolio-not-connected').style.display = 'none';
  document.getElementById('portfolio-content').style.display = 'block';

  try {
    const data = await apiFetch('/api/users/' + app.wallet.address);
    renderPortfolioStats(data.user);
    renderPortfolioPositions(data.positions);
    renderPortfolioGames(data.games);
  } catch (e) {
    console.error('Portfolio error:', e);
  }
}

function renderPortfolioStats(user) {
  const el = document.getElementById('portfolio-stats');
  el.innerHTML =
    '<div class="stat-card"><span class="stat-value">' + (user.totalBets || 0) + '</span><span class="stat-label">Total Bets</span></div>' +
    '<div class="stat-card"><span class="stat-value">' + formatKas(user.totalWagered) + '</span><span class="stat-label">Total Staked (KAS)</span></div>' +
    '<div class="stat-card"><span class="stat-value" style="color:var(--green)">+' + formatKas(user.totalWon) + '</span><span class="stat-label">Total Won (KAS)</span></div>' +
    '<div class="stat-card"><span class="stat-value">' + (user.gamesWon || 0) + '/' + (user.totalGames || 0) + '</span><span class="stat-label">Games Won</span></div>';
}

function renderPortfolioPositions(positions) {
  const el = document.getElementById('portfolio-positions');
  if (!positions.length) { el.innerHTML = '<div class="empty-state">No positions yet</div>'; return; }
  el.innerHTML = positions.map(p => {
    const sideColor = p.side === 1 ? '#00ffa3' : 'var(--red)';
    return '<div class="feed-item" style="cursor:pointer" onclick="navigateTo(\'market\',\'' + p.marketId + '\')">' +
      '<span>' + esc(p.marketTitle) + ' · <span style="color:' + sideColor + '">' + (p.side === 1 ? 'A' : 'B') + '</span> · ' + formatKas(p.amountSompi) + ' KAS</span>' +
      '<span class="market-badge badge-' + p.marketStatus + '">' + p.marketStatus + '</span>' +
    '</div>';
  }).join('');
}

function renderPortfolioGames(games) {
  const el = document.getElementById('portfolio-games');
  if (!games.length) { el.innerHTML = '<div class="empty-state">No games yet</div>'; return; }
  el.innerHTML = games.map(g => {
    const won = g.winner === app.wallet.address;
    const draw = g.winner === 'draw';
    return '<div class="feed-item" style="cursor:pointer" onclick="navigateTo(\'game\',\'' + g.id + '\')">' +
      '<span>' + g.type + ' · ' + formatKas(g.stakeSompi) + ' KAS · vs ' + shortAddr(g.playerA === app.wallet.address ? g.playerB : g.playerA) + '</span>' +
      '<span style="color:' + (won ? '#00ffa3' : draw ? 'var(--yellow)' : 'var(--red)') + ';font-weight:600">' +
        (g.status === 'finished' ? (won ? 'WON' : draw ? 'DRAW' : 'LOST') : g.status.toUpperCase()) +
      '</span>' +
    '</div>';
  }).join('');
}

// ─── CREATE MARKET ───────────────────────────────────────
function initCreateForm() {
  document.querySelectorAll('[data-create-tab]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('[data-create-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('create-simple').style.display = btn.dataset.createTab === 'simple' ? 'block' : 'none';
      document.getElementById('create-advanced').style.display = btn.dataset.createTab === 'advanced' ? 'block' : 'none';
    };
  });

  document.getElementById('create-oracle-type').onchange = (e) => {
    const fields = document.getElementById('oracle-config-fields');
    if (e.target.value === 'price') {
      fields.innerHTML =
        '<div class="form-row">' +
          '<div class="form-group"><label>API URL</label><input type="text" id="oracle-api-url" class="input" placeholder="https://api.coingecko.com/..."></div>' +
          '<div class="form-group"><label>Price Path</label><input type="text" id="oracle-price-path" class="input" placeholder="bitcoin.usd"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Condition</label><select id="oracle-condition" class="select"><option value="above">Above</option><option value="below">Below</option></select></div>' +
          '<div class="form-group"><label>Threshold</label><input type="number" id="oracle-threshold" class="input" placeholder="100000"></div>' +
        '</div>';
    } else if (e.target.value === 'sports') {
      fields.innerHTML =
        '<div class="form-group"><label>Sports API URL</label><input type="text" id="oracle-sports-url" class="input" placeholder="https://api-football-v1..."></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Status Path</label><input type="text" id="oracle-status-path" class="input" placeholder="fixture.status.short"></div>' +
          '<div class="form-group"><label>Pick Team</label><select id="oracle-pick-team" class="select"><option value="home">Home</option><option value="away">Away</option></select></div>' +
        '</div>';
    } else {
      fields.innerHTML = '';
    }
  };

  document.getElementById('btn-create-market').onclick = createMarket;
  document.getElementById('btn-validate-script').onclick = validateScript;
  document.getElementById('btn-create-custom').onclick = createCustomMarket;
}

async function createMarket() {
  if (!app.wallet.isConnected()) return toast('Connect wallet first', 'error');

  const title = document.getElementById('create-title').value.trim();
  if (!title) return toast('Enter a title', 'error');

  const btn = document.getElementById('btn-create-market');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  const oracleType = document.getElementById('create-oracle-type').value;
  let oracleSource = null;
  if (oracleType === 'price') {
    oracleSource = {
      type: 'price',
      apiUrl: document.getElementById('oracle-api-url')?.value || '',
      pricePath: document.getElementById('oracle-price-path')?.value || '',
      condition: document.getElementById('oracle-condition')?.value || 'above',
      threshold: parseFloat(document.getElementById('oracle-threshold')?.value || '0'),
    };
  } else if (oracleType === 'sports') {
    oracleSource = {
      type: 'sports',
      apiUrl: document.getElementById('oracle-sports-url')?.value || '',
      statusPath: document.getElementById('oracle-status-path')?.value || '',
      pickTeam: document.getElementById('oracle-pick-team')?.value || 'home',
    };
  }

  try {
    const result = await apiFetch('/api/markets', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: document.getElementById('create-description').value,
        category: document.getElementById('create-category').value,
        outcomeA: document.getElementById('create-outcome-a').value || 'Yes',
        outcomeB: document.getElementById('create-outcome-b').value || 'No',
        marketMode: parseInt(document.getElementById('create-mode').value),
        creatorAddr: app.wallet.address,
        creatorPubkey: app.wallet.pubkey,
        closeDaaOffset: parseFloat(document.getElementById('create-close-hours').value || '24'),
        minPositionKas: parseFloat(document.getElementById('create-min-pos').value || '1'),
        oracleSource,
      }),
    });

    const { txId } = await app.wallet.signAndBroadcast(result.pskt);
    toast('Market created!', 'success');
    navigateTo('market', result.market.id);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Create Market (1,001 KAS)';
}

async function validateScript() {
  const script = document.getElementById('create-script').value.trim();
  if (!script) return toast('Paste a script first', 'error');

  try {
    const result = await apiFetch('/api/validate-script', {
      method: 'POST',
      body: JSON.stringify({ script }),
    });

    const el = document.getElementById('script-validation-result');
    if (result.valid) {
      el.innerHTML = '<div style="padding:12px;background:var(--green-bg);border-radius:var(--radius);margin-top:12px;color:var(--green)">' +
        'Script valid · ' + result.analysis.size + ' bytes · ' + result.analysis.opsCount + ' ops' +
        (result.analysis.hasTimeLock ? ' · Time-lock' : '') +
        (result.analysis.hasMultisig ? ' · Multisig' : '') +
        (result.warnings.length ? '<br><span style="color:var(--yellow)"> ' + result.warnings.join('; ') + '</span>' : '') +
      '</div>';
    } else {
      el.innerHTML = '<div style="padding:12px;background:var(--red-bg);border-radius:var(--radius);margin-top:12px;color:var(--red)">' +
        'Invalid: ' + result.errors.join('; ') +
      '</div>';
    }
  } catch (e) {
    toast('Validation error: ' + e.message, 'error');
  }
}

async function createCustomMarket() {
  if (!app.wallet.isConnected()) return toast('Connect wallet first', 'error');
  const script = document.getElementById('create-script').value.trim();
  const title = document.getElementById('create-adv-title').value.trim();
  if (!script || !title) return toast('Fill in title and script', 'error');

  try {
    const result = await apiFetch('/api/markets', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: 'Custom SilverScript market',
        category: 'custom',
        outcomeA: 'Yes', outcomeB: 'No',
        marketMode: 2,
        creatorAddr: app.wallet.address,
        creatorPubkey: app.wallet.pubkey,
        closeDaaOffset: 24,
        customScript: script,
      }),
    });
    const { txId } = await app.wallet.signAndBroadcast(result.pskt);
    toast('Custom market deployed!', 'success');
    navigateTo('market', result.market.id);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

// ─── THE VAULT ───────────────────────────────────────────
function loadVault() {
  renderVaultContent();
  startDagVisualizer();
  loadNetworkStats();
}

function renderVaultContent() {
  document.getElementById('vault-what-is-kaspa').innerHTML =
    '<p><strong>Kaspa</strong> is a proof-of-work cryptocurrency built on the <strong>blockDAG</strong> (Directed Acyclic Graph) paradigm. ' +
    'Unlike traditional blockchains that produce one block at a time, Kaspa produces multiple parallel blocks per second , currently 10 BPS.</p>' +
    '<p>This means near-instant confirmations, high throughput, and the security guarantees of Nakamoto consensus , all without sacrificing decentralization.</p>' +
    '<p>The core protocol is called <strong>PHANTOM/GhostDAG</strong>, a generalization of Bitcoin\'s longest-chain rule to a DAG structure. ' +
    'Blocks reference multiple parents, allowing the network to process blocks concurrently while still establishing total ordering.</p>' +
    '<p><strong>Key properties:</strong> 10 blocks per second · 1-second visual confirmations · 10-second statistical finality · ' +
    'Optical-speed mining (kHeavyHash) · Fair launched (no premine) · Pure PoW</p>';

  document.getElementById('vault-covenants').innerHTML =
    '<p><strong>Covenants</strong> arrived in Kaspa via the Crescendo hard fork (May 2025). They enable transaction outputs to carry spending conditions , ' +
    'rules that constrain how funds can move, verified by every node.</p>' +
    '<p>Kaspa\'s covenant model uses <strong>introspection opcodes</strong> that let scripts examine their own transaction: ' +
    'input amounts, output amounts, script public keys, DAA scores, and more. This is the foundation for smart contracts on Kaspa.</p>' +
    '<p><strong>SilverScript</strong> is the scripting language (an extended Bitcoin Script). High Table uses these opcodes to build:</p>' +
    '<ul style="margin:8px 0 12px 20px;color:var(--text-secondary)">' +
      '<li><strong>Market Pool covenants</strong> , lock funds with oracle-verified outcomes</li>' +
      '<li><strong>Position Receipts</strong> , on-chain proof of your bet (side, amount, risk mode)</li>' +
      '<li><strong>Creator Bonds</strong> , skin-in-the-game for market creators</li>' +
      '<li><strong>Game Escrows</strong> , 2-of-3 multisig with oracle + timeout protection</li>' +
    '</ul>' +
    '<p>Every market and game on High Table is a <strong>real on-chain covenant</strong> , not an IOU, not a database entry. Your funds are locked in scripts that only release under mathematically verified conditions.</p>';

  document.getElementById('vault-markets').innerHTML =
    '<p><strong>Prediction markets</strong> aggregate information through incentives. Participants stake real value on outcomes, creating price signals that reflect collective belief.</p>' +
    '<p><strong>How it works on High Table:</strong></p>' +
    '<ol style="margin:8px 0 12px 20px;color:var(--text-secondary)">' +
      '<li>A creator deploys a market covenant with a 1,000 KAS bond</li>' +
      '<li>Users take positions (Side A or Side B) by sending KAS to the pool covenant</li>' +
      '<li>Each position mints an on-chain receipt (UTXO with embedded data)</li>' +
      '<li>When the event resolves, an oracle signs the outcome</li>' +
      '<li>The settlement engine distributes funds proportionally to winners</li>' +
      '<li>If the oracle fails, a timeout refunds everyone automatically</li>' +
    '</ol>' +
    '<p><strong>Two risk modes:</strong></p>' +
    '<ul style="margin:8px 0 12px 20px;color:var(--text-secondary)">' +
      '<li><strong>Spot</strong> , winner takes all (minus 2% protocol fee). High risk, high reward.</li>' +
      '<li><strong>Maximizer</strong> , losers get 50% back (minus 30% hedge fee). Lower risk, lower reward.</li>' +
    '</ul>';

  document.getElementById('vault-games').innerHTML =
    '<p>High Table lets you compete in skill-based games: <strong>Chess, Checkers, and Connect 4</strong>. Every game is backed by an on-chain escrow.</p>' +
    '<p><strong>How it works:</strong></p>' +
    '<ol style="margin:8px 0 12px 20px;color:var(--text-secondary)">' +
      '<li>Player A creates a game and stakes KAS into an escrow covenant</li>' +
      '<li>Player B joins and matches the stake</li>' +
      '<li>The game plays out in real-time via WebSocket</li>' +
      '<li>On checkmate, resignation, or draw , the oracle verifies and settles</li>' +
      '<li>Winner receives the pot minus 2% protocol fee</li>' +
      '<li>If a player abandons, timeout protection kicks in</li>' +
    '</ol>' +
    '<p>The escrow uses <strong>2-of-3 multisig</strong>: two oracle keys must agree to release funds. If they fail, a time-lock returns stakes to both players.</p>';

  document.getElementById('vault-resources').innerHTML =
    '<a href="https://kaspa.org" target="_blank" class="resource-card"><h3>kaspa.org</h3><p>Official Kaspa website</p></a>' +
    '<a href="https://wiki.kaspa.org" target="_blank" class="resource-card"><h3>Kaspa Wiki</h3><p>Community knowledge base</p></a>' +
    '<a href="https://github.com/nicholasg" target="_blank" class="resource-card"><h3>GitHub</h3><p>High Table source code</p></a>' +
    '<a href="https://kasplex.org" target="_blank" class="resource-card"><h3>Kasplex</h3><p>KRC-20 token standard</p></a>' +
    '<a href="https://explorer.kaspa.org" target="_blank" class="resource-card"><h3>Block Explorer</h3><p>View transactions on-chain</p></a>' +
    '<a href="https://kasware.xyz" target="_blank" class="resource-card"><h3>KasWare Wallet</h3><p>Browser extension wallet</p></a>';
}

// ─── DAG VISUALIZER ──────────────────────────────────────
function startDagVisualizer() {
  const canvas = document.getElementById('dag-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth * 2;
  const H = canvas.height = 600;
  canvas.style.height = '300px';

  app.dagBlocks = [];
  let frameId = null;

  function addBlock() {
    const lanes = 5;
    const lane = Math.floor(Math.random() * lanes);
    const x = W;
    const y = 40 + (lane * (H - 80) / lanes) + Math.random() * 40;
    const parents = [];
    for (const b of app.dagBlocks) {
      if (b.x > W - 300 && b.x < W - 40 && Math.abs(b.lane - lane) <= 2 && Math.random() > 0.3) {
        parents.push(b);
        if (parents.length >= 3) break;
      }
    }
    if (parents.length === 0 && app.dagBlocks.length > 0) {
      const recent = app.dagBlocks.filter(b => b.x > W - 200);
      if (recent.length > 0) parents.push(recent[Math.floor(Math.random() * recent.length)]);
    }
    app.dagBlocks.push({ x, y, lane, parents, hue: 100 + Math.random() * 40, size: 4 + Math.random() * 3 });
  }

  function draw() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    for (const b of app.dagBlocks) {
      b.x -= 1.5;
    }
    app.dagBlocks = app.dagBlocks.filter(b => b.x > -50);

    for (const b of app.dagBlocks) {
      for (const p of b.parents) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        const cpx = (b.x + p.x) / 2;
        ctx.quadraticCurveTo(cpx, (b.y + p.y) / 2, p.x, p.y);
        ctx.strokeStyle = 'rgba(119, 149, 86, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const b of app.dagBlocks) {
      const alpha = Math.min(1, (W - Math.abs(b.x - W / 2)) / (W / 2));
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + b.hue + ', 50%, 55%, ' + (0.6 + alpha * 0.4) + ')';
      ctx.fill();
      ctx.strokeStyle = 'hsla(' + b.hue + ', 60%, 40%, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(26, 26, 26, 0.8)';
    ctx.fillRect(0, 0, 60, H);
    ctx.fillRect(W - 60, 0, 60, H);

    frameId = requestAnimationFrame(draw);
  }

  const blockTimer = setInterval(() => {
    const burst = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burst; i++) setTimeout(addBlock, i * 30);
  }, 100);

  draw();

  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) {
      if (frameId) cancelAnimationFrame(frameId);
      clearInterval(blockTimer);
    }
  });
  observer.observe(canvas);
}

async function loadNetworkStats() {
  try {
    const data = await apiFetch('/api/network');
    document.getElementById('dag-bps').textContent = '10';
    document.getElementById('dag-daa').textContent = data.virtualDaaScore || '--';
    document.getElementById('dag-hashrate').textContent = data.hashrate || '--';
    document.getElementById('dag-difficulty').textContent = data.difficulty ? parseFloat(data.difficulty).toExponential(2) : '--';
    document.getElementById('dag-tips').textContent = data.tipHashes?.length || '--';
    document.getElementById('dag-blocks').textContent = data.blockCount || '--';
  } catch {
    document.getElementById('dag-bps').textContent = '10';
    document.getElementById('dag-daa').textContent = 'offline';
  }

  if (!app.mainnetPollInterval && app.currentView === 'vault') {
    app.mainnetPollInterval = setInterval(loadNetworkStats, 10000);
  }
}

// ─── TERMS ───────────────────────────────────────────────
function loadTerms() {
  document.getElementById('terms-content').innerHTML =
    '<h2>1. Overview</h2>' +
    '<p>High Table Protocol ("the Protocol") is an experimental decentralized application running on the Kaspa testnet (TN12). ' +
    'It provides prediction market and game functionality using on-chain covenants.</p>' +

    '<h2>2. Testnet Only</h2>' +
    '<p>This software operates exclusively on the Kaspa testnet. Testnet KAS has no monetary value. ' +
    'The Protocol is provided for educational and experimental purposes only.</p>' +

    '<h2>3. No Financial Advice</h2>' +
    '<p>Nothing in this application constitutes financial, investment, or gambling advice. ' +
    'Users interact with the Protocol at their own risk and discretion.</p>' +

    '<h2>4. Smart Contract Risk</h2>' +
    '<p>Covenants and scripts deployed on-chain may contain bugs. While scripts are validated before deployment, ' +
    'no guarantee is made regarding the correctness or security of any on-chain code. Users should review scripts before interacting.</p>' +

    '<h2>5. Oracle Risk</h2>' +
    '<p>Market resolution depends on oracle operators providing accurate outcome data. While the 2-of-3 multisig and timeout ' +
    'mechanisms provide safeguards, oracle failures or disagreements may delay or prevent resolution.</p>' +

    '<h2>6. User Responsibility</h2>' +
    '<ul>' +
      '<li>Users are responsible for verifying market conditions before taking positions</li>' +
      '<li>Users must ensure they understand the risk mode (Spot vs Maximizer) before staking</li>' +
      '<li>Custom SilverScript markets are user-deployed and may behave unexpectedly</li>' +
      '<li>Game outcomes are determined by play; technical disconnections may result in timeouts</li>' +
    '</ul>' +

    '<h2>7. Protocol Fees</h2>' +
    '<ul>' +
      '<li>Spot markets: 2% protocol fee on loser pool</li>' +
      '<li>Maximizer markets: 30% fee on hedge return (effectively ~7.5% of loser pool)</li>' +
      '<li>Games: 2% protocol fee on total pot</li>' +
      '<li>Market creation: 1,000 KAS refundable bond</li>' +
    '</ul>' +

    '<h2>8. Open Source</h2>' +
    '<p>The Protocol is open source. Users are encouraged to audit the code, review covenant scripts, ' +
    'and verify on-chain transactions independently.</p>' +

    '<h2>9. Jurisdiction</h2>' +
    '<p>This is a decentralized protocol running on a public blockchain testnet. Users are responsible for ensuring ' +
    'compliance with their local laws and regulations.</p>';
}

// ─── HANDLE WS GAME EVENTS ──────────────────────────────
const _origHandleWs = handleWsEvent;
handleWsEvent = function(event, data) {
  _origHandleWs(event, data);

  if (event === 'game-move' && window._currentGame) {
    window._currentGame.onRemoteMove(data);
    renderMoveList(window._currentGame.getMoves ? window._currentGame.getMoves() : []);
  }
  if (event === 'game-over' && window._currentGame) {
    const gameId = location.hash.split('/')[1];
    if (data.gameId === gameId) {
      toast(data.winner === 'draw' ? 'Game drawn!' : 'Game over! Winner: ' + shortAddr(data.winner), data.winner === app.wallet?.address ? 'success' : 'info');
      setTimeout(() => showGamePlay(gameId), 1000);
    }
  }
  if (event === 'draw-offered') {
    if (data.from !== app.wallet?.address) {
      const accept = confirm('Your opponent offers a draw. Accept?');
      if (accept) wsSend('game-draw-accept', { gameId: data.gameId });
    }
  }
};

console.log('[HIGH TABLE] v8.0 initialized');

async function claimGameFromServer(gameId) {
  try {
    showToast('Requesting payout...', 'info');
    const resp = await fetch('/api/games/' + gameId + '/claim', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    const data = await resp.json();
    if (data.alreadySettled) { showToast('Already settled. TX: ' + data.txId, 'success'); return; }
    if (data.error) { showToast('Error: ' + data.error, 'error'); return; }
    if (!data.pskt) { showToast('No PSKT returned from server', 'error'); return; }
    if (!window.kasware) { showToast('KasWare wallet required — install at kasware.xyz', 'error'); return; }
    showToast('Sign the payout in KasWare...', 'info');
    const txId = await window.kasware.signAndBroadcastPskt(data.pskt);
    await fetch('/api/games/' + gameId + '/settled', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({txId, winner: data.winner})});
    showToast('Payout sent! View TX: <a href="https://explorer-tn12.kaspa.org/txs/' + txId + '" target="_blank">' + txId.slice(0,12) + '...</a>', 'success');
  } catch(e) { showToast('Claim failed: ' + e.message, 'error'); }
}
