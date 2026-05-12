/* ═══════════════════════════════════════════════════
   HTP-DESIGN-V2.0 — SETTLEMENT ANIMATION (2D)
   window.htpSettle(cardEl) — on-chain settlement sequence
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TEXT = 'SETTLED ON-CHAIN \u2713';
  const CHAR_MS = 60;    // ms per character typing rate
  const HOLD_MS = 400;    // hold after full text

  function htpSettle(cardEl) {
    if (!cardEl || !(cardEl instanceof HTMLElement)) {
      console.warn('htpSettle: invalid element');
      return;
    }

    // Preserve original border for reset
    const origBorder = cardEl.style.borderColor || '';
    const origBg = cardEl.style.backgroundColor || '';

    // ── 0ms: border flash ──
    cardEl.style.transition = 'border-color 100ms ease-out';
    cardEl.style.borderColor = '#00ffa3';

    // ── 100ms: bg pulse ──
    setTimeout(function () {
      cardEl.style.backgroundColor = 'rgba(0,255,163,0.08)';
      cardEl.style.transition = 'background-color 300ms ease-out';
      requestAnimationFrame(function () {
        cardEl.style.backgroundColor = 'rgba(0,255,163,0)';
      });
    }, 100);

    // ── 200ms: terminal overlay ──
    setTimeout(function () {
      var overlay = document.createElement('div');
      overlay.className = 'htp-settle-overlay';
      overlay.style.cssText =
        'position:absolute;top:0;left:0;right:0;bottom:0;' +
        'background:rgba(0,8,4,0.92);backdrop-filter:blur(8px);' +
        'display:flex;align-items:center;justify-content:center;' +
        'z-index:10;border-radius:inherit;overflow:hidden;';
      overlay.setAttribute('aria-label', 'Settlement confirmation');

      var terminal = document.createElement('pre');
      terminal.className = 'htp-settle-terminal';
      terminal.style.cssText =
        'font-family:"JetBrains Mono","Cascadia Code",Consolas,monospace;' +
        'font-size:14px;font-weight:500;color:#00ffa3;' +
        'text-shadow:0 0 10px rgba(0,255,163,0.4);' +
        'margin:0;padding:0 16px;text-align:center;' +
        'white-space:pre-wrap;word-break:break-word;' +
        'opacity:1;';
      terminal.textContent = '';

      var cursor = document.createElement('span');
      cursor.className = 'htp-settle-cursor';
      cursor.style.cssText =
        'display:inline-block;width:2px;height:1em;background:#00ffa3;' +
        'animation:htpBlink 0.6s step-end infinite;' +
        'vertical-align:text-bottom;margin-left:2px;';
      terminal.appendChild(cursor);

      overlay.appendChild(terminal);
      // Ensure card has position:relative for absolute overlay
      var cardPos = getComputedStyle(cardEl).position;
      if (cardPos === 'static') cardEl.style.position = 'relative';
      cardEl.appendChild(overlay);

      // ── Type text at 60ms/char ──
      var i = 0;
      var typeInterval = setInterval(function () {
        i++;
        terminal.childNodes[0] && (terminal.removeChild(terminal.childNodes[0]));
        terminal.insertBefore(document.createTextNode(TEXT.slice(0, i)), cursor);
        if (i >= TEXT.length) {
          clearInterval(typeInterval);
          // Remove cursor
          if (cursor.parentNode) cursor.remove();

          // ── 800ms: hold 400ms then dissolve ──
          setTimeout(function () {
            overlay.style.transition = 'opacity 400ms ease-out';
            overlay.style.opacity = '0';
            setTimeout(function () {
              if (overlay.parentNode) overlay.remove();

              // ── 1200ms: add Claimed badge ──
              var badge = cardEl.querySelector('.htp-settled-badge');
              if (!badge) {
                badge = document.createElement('div');
                badge.className = 'htp-settled-badge pill';
                badge.style.cssText =
                  'position:absolute;top:12px;right:12px;z-index:5;' +
                  'background:rgba(0,255,163,0.15)!important;' +
                  'border:1px solid rgba(0,255,163,0.40)!important;' +
                  'color:#00ffa3!important;' +
                  'font-family:"Inter",system-ui,sans-serif!important;' +
                  'font-size:11px!important;font-weight:700!important;' +
                  'letter-spacing:0.04em!important;text-transform:uppercase!important;' +
                  'padding:4px 12px!important;border-radius:9999px!important;' +
                  'opacity:0;transform:scale(0.8);' +
                  'transition:opacity 200ms ease-out,transform 200ms ease-out;';
                badge.textContent = 'Claimed';
                cardEl.appendChild(badge);
                requestAnimationFrame(function () {
                  badge.style.opacity = '1';
                  badge.style.transform = 'scale(1)';
                });
              }

              // Reset border to rest
              cardEl.style.borderColor = origBorder;
              cardEl.style.transition = '';
            }, 420);
          }, 400);
        }
      }, CHAR_MS);
    }, 200);
  }

  // Expose
  window.htpSettle = htpSettle;

  // Ensure blink keyframe exists
  if (!document.querySelector('#htp-settle-keyframes')) {
    var style = document.createElement('style');
    style.id = 'htp-settle-keyframes';
    style.textContent = '@keyframes htpBlink{0%,100%{opacity:1}50%{opacity:0}}';
    document.head.appendChild(style);
  }
})();
