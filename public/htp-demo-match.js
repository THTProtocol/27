/**
 * htp-demo-match.js — injects a demo match/event card into the markets grid
 * so you can see how a real sports/esports event looks with a background image.
 * Remove this file once real events populate from Firebase.
 */
(function() {
  'use strict';

  var DEMO_MARKET = {
    id: 'demo-kaspa-chess-001',
    marketId: 'demo-kaspa-chess-001',
    title: 'Kaspa Open Chess Championship — Will Magnus Carlsen Win Match 1?',
    cat: 'Sports',
    st: 'open',
    // Unsplash free-to-use chess/match image
    img: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=640&q=80&auto=format&fit=crop',
    pool: 4820,
    yP: 67,
    nP: 33,
    ent: 24,
    deadline: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
    cl: new Date(Date.now() + 172800000).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    created: new Date().toISOString(),
    net: 'tn12',
    outcomes: ['Yes — Carlsen Wins', 'No — Carlsen Loses or Draws'],
    minPosition: 1,
    creatorAddress: 'kaspa:qz3hy8demo0000000000000000x',
    description: 'Demo event: parimutuel match prediction. This card shows how a real sports event will look with a cover image.',
    isDemo: true
  };

  function inject() {
    // Only inject if no real markets exist yet
    var existing = window.mkts || [];
    if (existing.length > 0) return; // real data loaded — skip demo

    if (!window.mkts) window.mkts = [];
    // Avoid duplicate injection
    if (window.mkts.find(function(m){ return m.id === DEMO_MARKET.id; })) return;
    window.mkts.unshift(DEMO_MARKET);

    if (typeof window.renderM === 'function') window.renderM();
    if (typeof window.buildF === 'function') window.buildF();
    console.log('[HTP] Demo match event injected');
  }

  // Re-check once real markets load — remove demo if Firebase returns data
  function watchAndRemove() {
    var interval = setInterval(function() {
      var mkts = window.mkts || [];
      var realCount = mkts.filter(function(m){ return !m.isDemo; }).length;
      if (realCount > 0) {
        // Remove the demo card
        window.mkts = mkts.filter(function(m){ return !m.isDemo; });
        if (typeof window.renderM === 'function') window.renderM();
        clearInterval(interval);
        console.log('[HTP] Real markets loaded — demo card removed');
      }
    }, 2000);
  }

  function boot() {
    // Wait for markets UI to be ready
    var tries = 0;
    var timer = setInterval(function() {
      if (document.getElementById('mG') || tries++ > 30) {
        clearInterval(timer);
        inject();
        watchAndRemove();
      }
    }, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();

/* htp-gamefix-sync.js was removed; its fixes are merged into htp-chess-sync.js. */
