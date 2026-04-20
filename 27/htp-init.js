/**
 * High Table Protocol — Initialization (TN12)
 * 
 * Network: Kaspa Testnet 12 (TN12) with Covenants
 * Resolver: tn12 (automatic endpoint discovery)
 */

(function() {
  'use strict';

  // Network configuration
  window.HTP_NETWORK = 'tn12';
  window.HTP_VERSION = '8.0.0';

  // TN12 resolver — automatic endpoint discovery
  window.HTP_RESOLVER = 'tn12';

  // MiroFish endpoints
  window.MIROFISH_MAIN = 'http://localhost:5001';
  window.MIROFISH_FALLBACK = 'http://localhost:3002';

  // Protocol constants
  window.HTP_TREASURY = 'kaspatest:qpn2dp4rutnf7qx7jq94vl6atlu35uu7u3wk8e6yl7a07c5yl7fr6g4t8fzyv';
  window.HTP_FEE_BPS = 200; // 2% fee
  window.HTP_MIN_BET_SOMPI = 1_000_000_000; // 1 KAS minimum

  // Covenant scripts (compiled from .ss files)
  window.HTP_COVENANTS = {
    ParimutuelMarket: null, // Will be loaded from compiled output
    TournamentBracket: null
  };

  // Game types
  window.HTP_GAMES = {
    CHESS: 'chess',
    CHECKERS: 'checkers',
    CONNECT4: 'connect4'
  };

  // Market outcomes
  window.HTP_OUTCOMES = {
    BINARY: ['win', 'lose'],
    CHESS: ['white_win', 'draw', 'black_win'],
    CHECKERS: ['red_win', 'draw', 'black_win'],
    CONNECT4: ['player1_win', 'player2_win']
  };

  console.log('[HTP] Initialized on', window.HTP_NETWORK, 'with resolver:', window.HTP_RESOLVER);
  console.log('[HTP] MiroFish:', window.MIROFISH_MAIN, '(fallback:', window.MIROFISH_FALLBACK + ')');

})();
