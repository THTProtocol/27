(function(window) {
  'use strict';

  // ── Identity ───────────────────────────────────────────────────────────────
  function getViewerId() {
    try {
      if (window.connectedAddress) return window.connectedAddress;
      if (window.htpAddress) return window.htpAddress;
      let localId = window.localStorage.getItem('htpPlayerId');
      if (!localId && window.matchLobby && window.matchLobby.myPlayerId) {
        localId = window.matchLobby.myPlayerId;
        window.localStorage.setItem('htpPlayerId', localId);
      }
      return localId;
    } catch (e) { return null; }
  }

  function initIdentity() {
    const vid = getViewerId();
    if (!vid) {
      const newId = 'P-' + Math.random().toString(36).substr(2,8).toUpperCase();
      window.localStorage.setItem('htpPlayerId', newId);
      console.log("[HTP Init] New identity:", newId);
    } else {
      console.log("[HTP Init] Identity:", vid);
    }
  }

  // ── Seat recovery ──────────────────────────────────────────────────────────
  function getMySeat(match) {
    const viewerId = getViewerId();
    if (!viewerId) return { seat: 'spectator', viewerId: null };
    const cId   = match.creatorId || match.creator || match.p1 || (match.info && match.info.creatorId);
    const jId   = match.joinerId  || match.opponent || match.p2 || (match.info && match.info.joinerId);
    const cAddr = match.creatorAddrFull || match.creatorAddr;
    const jAddr = match.opponentAddrFull || match.opponentAddr;
    const isP1  = (viewerId === cId || (cAddr && viewerId === cAddr));
    const isP2  = (viewerId === jId || (jAddr && viewerId === jAddr));
    if (isP1) return { seat: 'player1', viewerId };
    if (isP2) return { seat: 'player2', viewerId };
    if (match.seats) {
      if (viewerId === match.seats.player1Id || viewerId === match.seats.creatorId) return { seat: 'player1', viewerId };
      if (viewerId === match.seats.player2Id || viewerId === match.seats.joinerId)  return { seat: 'player2', viewerId };
    }
    return { seat: 'spectator', viewerId };
  }

  function getOrientation(match, gameTypeOverride) {
    const { seat } = getMySeat(match);
    const g = (gameTypeOverride || match.gameType || match.game || '').toLowerCase();
    if (seat === 'spectator') return { playerColor:'w', playerSide:1, isFlipped:false, seat:'spectator' };
    return {
      playerColor: seat === 'player2' ? 'b' : 'w',
      playerSide:  seat === 'player2' ? (g === 'checkers' || g === 'ck' ? 3 : 2) : 1,
      isFlipped:   seat === 'player2',
      seat
    };
  }

  // ── Board CSS ──────────────────────────────────────────────────────────────
  function injectBoardCss() {
    if (document.getElementById('htp-skill-style')) return;
    const style = document.createElement('style');
    style.id = 'htp-skill-style';
    style.textContent = `
      .htp-board-container {
        width:100%;max-width:100%;aspect-ratio:1/1;background:#1e293b;border-radius:12px;
        position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;
        box-shadow:0 20px 50px rgba(0,0,0,0.5),0 0 20px rgba(73,232,194,0.1);
        border:1px solid rgba(255,255,255,0.05);
      }
      .htp-board-grid { display:grid;width:100%;height:100%;padding:4px;box-sizing:border-box; }
      .htp-board-cell { display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;user-select:none;transition:transform 0.1s ease; }
      .htp-board-cell:active { transform:scale(0.95); }
      .chess-sq-light { background:#ebecd0;color:#779556; }
      .chess-sq-dark  { background:#779556;color:#ebecd0; }
      .htp-board-cell.selected { background:rgba(255,255,0,0.45)!important;box-shadow:inset 0 0 10px rgba(0,0,0,0.2); }
      .htp-board-cell.legal-move::after { content:"";width:22%;height:22%;background:rgba(0,0,0,0.15);border-radius:50%; }
      .htp-board-cell.legal-capture::after { content:"";width:85%;height:85%;border:5px solid rgba(0,0,0,0.15);border-radius:50%; }
      .htp-board-cell.last-from,.htp-board-cell.last-to { background:rgba(255,255,0,0.25)!important; }
      .htp-board-cell.check { background:radial-gradient(circle,#ff4d4d 30%,transparent 80%)!important; }
      .chess-piece-w { color:#fff;text-shadow:0 4px 8px rgba(0,0,0,0.5);font-size:min(44px,8.8vw);filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));transition:all 0.2s; }
      .chess-piece-b { color:#111;text-shadow:0 2px 4px rgba(255,255,255,0.2);font-size:min(44px,8.8vw);filter:drop-shadow(0 2px 2px rgba(0,0,0,0.4));transition:all 0.2s; }
      .htp-board-cell:hover .chess-piece-w,.htp-board-cell:hover .chess-piece-b { transform:scale(1.05); }
      .coord-label { position:absolute;font-size:min(8px,1.8vw);font-weight:800;text-transform:uppercase;user-select:none;pointer-events:none;opacity:0.6; }
      .coord-rank { left:2px;top:2px; }
      .coord-file { right:2px;bottom:2px; }
      .chess-sq-light .coord-label { color:#779556; }
      .chess-sq-dark  .coord-label { color:#ebecd0; }
      @media(max-width:600px){.htp-board-container{border-radius:8px;}.coord-label{font-size:8px;}}
    `;
    document.head.appendChild(style);
  }

  function getIndices(count, flipped) {
    let rows = []; for(let i=7;i>=0;i--) rows.push(i); if(flipped) rows.reverse();
    let cols = []; for(let i=0;i<8;i++) cols.push(i); if(flipped) cols.reverse();
    return { rows, cols };
  }

  // ── Wallet connect — dispatches htp:wallet:connected for HTPRpc ────────────
  function onWalletConnected(address) {
    if (!address) return;

    // Update global state
    window.connectedAddress = address;
    window.htpAddress       = address;
    window.walletAddress    = address;

    // Persist
    try { localStorage.setItem('htpPlayerId', address); } catch(e){}

    // ── Dispatch event so htp-rpc-client.js starts UTXO tracking ──────────
    window.dispatchEvent(new CustomEvent('htp:wallet:connected', {
      detail: { address }
    }));

    // Update UI elements
    const btn = document.getElementById('htp-connect-wallet-btn') || document.getElementById('connectWalletBtn');
    if (btn) {
      btn.textContent = address.substring(0,10) + '...' + address.slice(-4);
      btn.classList.add('connected');
    }
    const statusEl = document.getElementById('htp-wallet-status');
    if (statusEl) statusEl.textContent = address.substring(0,12) + '...';

    console.log('[HTP Init] Wallet connected:', address);
    console.log('[HTP Init] Network:', window.HTP_NETWORK || 'mainnet');
  }

  // ── Auto-detect wallet (KasWare / KaspaWallet extension) ──────────────────
  async function detectAndConnectWallet() {
    // KasWare
    if (window.kasware) {
      try {
        const accounts = await window.kasware.requestAccounts();
        if (accounts && accounts[0]) { onWalletConnected(accounts[0]); return; }
      } catch(e) {}
    }
    // KaspaWallet
    if (window.kaspaWallet) {
      try {
        const addr = await window.kaspaWallet.connect();
        if (addr) { onWalletConnected(addr); return; }
      } catch(e) {}
    }
    // Persisted address from previous session
    try {
      const saved = localStorage.getItem('htpPlayerId');
      if (saved && saved.startsWith('kaspa')) { onWalletConnected(saved); }
    } catch(e) {}
  }

  // ── Connect button handler ─────────────────────────────────────────────────
  function bindConnectButton() {
    const btn = document.getElementById('htp-connect-wallet-btn')
             || document.getElementById('connectWalletBtn')
             || document.querySelector('[data-action="connect-wallet"]');
    if (!btn) return;
    btn.addEventListener('click', async function() {
      btn.textContent = 'Connecting...';
      btn.disabled    = true;
      await detectAndConnectWallet();
      btn.disabled    = false;
    });
  }

  // ── DOMContentLoaded ───────────────────────────────────────────────────────
  function onReady() {
    initIdentity();
    injectBoardCss();
    bindConnectButton();
    detectAndConnectWallet();   // auto-reconnect on page load

    // Restore active match deadlines from Firebase
    if (window.firebase && window.firebase.database) {
      window.firebase.database().ref('matches')
        .orderByChild('status').equalTo('active')
        .once('value')
        .then(function(snap) {
          var matches = [];
          snap.forEach(function(child) {
            var m = child.val(); m.id = child.key; matches.push(m);
          });
          if (matches.length) {
            window.dispatchEvent(new CustomEvent('htp:matches:loaded', { detail: { matches } }));
          }
        })
        .catch(function(){});
    }

    console.log('[HTP Init] v2.1 ready | Network:', window.HTP_NETWORK || 'mainnet');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.htpSkillUI = {
    getViewerId, initIdentity, getMySeat,
    getOrientation, injectBoardCss, getIndices,
  };
  window.onWalletConnected = onWalletConnected;
  window.htpInit = { onWalletConnected, detectAndConnectWallet };

})(window);
