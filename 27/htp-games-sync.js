// htp-games-sync.js — WS shim v2
// Firebase RTDB relay replaced by Rust WebSocket: ws://<HTP_RUST_API>/ws/game/<matchId>
// This file is now a thin browser shim only — all game state logic lives in game_ws.rs

(function () {
  'use strict';

  var API = (window.HTP_RUST_API || '').replace(/^http/, 'ws').replace(/^https/, 'wss');

  // Registry of open WS connections per match
  window._htpWS = window._htpWS || {};

  // Connect to the Rust WS relay for a match
  window.htpGameSync = function (matchId, onMessage) {
    if (!API) { console.warn('[HTP WS] HTP_RUST_API not set'); return null; }
    if (window._htpWS[matchId]) return window._htpWS[matchId];

    var ws = new WebSocket(API + '/ws/game/' + matchId);

    ws.onopen = function () {
      console.log('[HTP WS] Connected: match=' + matchId);
      // Keepalive ping every 20s
      ws._ping = setInterval(function () {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'ping' }));
      }, 20000);
    };

    ws.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'pong') return;
        if (typeof onMessage === 'function') onMessage(msg);
      } catch (_) {}
    };

    ws.onclose = function () {
      clearInterval(ws._ping);
      delete window._htpWS[matchId];
      console.log('[HTP WS] Closed: match=' + matchId);
    };

    ws.onerror = function (e) {
      console.error('[HTP WS] Error on match=' + matchId, e);
    };

    // Send helper
    ws.htpSend = function (msg) {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify(msg));
    };

    window._htpWS[matchId] = ws;
    return ws;
  };

  // Disconnect
  window.htpGameSyncClose = function (matchId) {
    var ws = window._htpWS[matchId];
    if (ws) { ws.close(); delete window._htpWS[matchId]; }
  };

  console.log('[HTP WS] Game sync shim loaded — backend:', API || '(not set yet)');
})();
