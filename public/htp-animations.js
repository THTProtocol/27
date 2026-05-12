/* ═══════════════════════════════════════════════════
   HTP-DESIGN-V2.0 — SETTLEMENT ANIMATION
   ═══════════════════════════════════════════════════ */

/**
 * htp-animations.js — On-chain settlement animation v1
 */
window.htpSettle = function(cardEl) {
  if (!cardEl) return;
  // 0ms: border flash
  cardEl.style.transition = 'none';
  cardEl.style.borderColor = '#00ffa3';
  cardEl.style.boxShadow = '0 0 0 2px #00ffa3';
  // 100ms: bg pulse
  setTimeout(function() {
    cardEl.style.background = 'rgba(0,255,163,0.08)';
  }, 100);
  // 200ms: terminal overlay
  setTimeout(function() {
    var ov = document.createElement('div');
    ov.className = 'settle-overlay';
    ov.style.cssText = [
      'position:absolute','top:0','left:0','right:0','bottom:0',
      'display:flex','align-items:center','justify-content:center',
      'z-index:10','border-radius:inherit',
      'background:rgba(0,8,4,0.80)','backdrop-filter:blur(4px)'
    ].join(';');
    var txt = document.createElement('span');
    txt.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:14px;color:#00ffa3;font-weight:500;letter-spacing:0.05em;';
    ov.appendChild(txt);
    cardEl.style.position = 'relative';
    cardEl.appendChild(ov);
    // Typewriter
    var msg = 'SETTLED ON-CHAIN \u2713';
    var i = 0;
    var t = setInterval(function() {
      txt.textContent += msg[i++];
      if (i >= msg.length) clearInterval(t);
    }, 60);
    // 800ms hold, then dissolve
    setTimeout(function() {
      ov.style.transition = 'opacity 300ms ease-out';
      ov.style.opacity = '0';
      cardEl.style.background = '';
      cardEl.style.boxShadow = '';
      setTimeout(function() {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        // Add claimed badge
        var badge = document.createElement('span');
        badge.className = 'badge-claimed';
        badge.textContent = 'Claimed';
        cardEl.appendChild(badge);
        // restore border
        cardEl.style.borderColor = '';
        cardEl.style.transition = '';
      }, 300);
    }, 800);
  }, 200);
};
