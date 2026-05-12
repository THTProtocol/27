/**
 * HTP Theme Toggle — Dark/Light mode switcher
 * htp-theme-toggle.js v1
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'htp-theme';
  var html = document.documentElement;

  // Initialize theme from localStorage or system preference
  function initTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      html.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      html.setAttribute('data-theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
    }
  }

  function getTheme() {
    return html.getAttribute('data-theme') || 'dark';
  }

  function isDark() {
    return getTheme() === 'dark';
  }

  function adjustDagOpacity() {
    var dark = isDark();
    var dagCanvas = document.getElementById('dagCanvas');
    if (dagCanvas) {
      var ctx = dagCanvas.getContext('2d');
      if (ctx) {
        ctx.globalAlpha = dark ? 0.15 : 0.06;
        // force redraw if possible
        if (window.htpDagCanvas && typeof window.htpDagCanvas.draw === 'function') {
          window.htpDagCanvas.draw();
        }
      }
    }
  }

  function createToggleButton() {
    var hdr = document.querySelector('.hdr');
    if (!hdr) return setTimeout(createToggleButton, 300);

    // Check if already injected
    if (document.getElementById('htpThemeToggle')) return;

    var btn = document.createElement('button');
    btn.id = 'htpThemeToggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.title = 'Toggle theme';
    btn.style.cssText = [
      'width:36px','height:36px',
      'background:transparent',
      'border:1px solid ' + (isDark() ? 'rgba(0,255,163,0.08)' : 'rgba(0,200,122,0.10)'),
      'border-radius:50%',
      'cursor:pointer',
      'color:' + (isDark() ? '#8BA89A' : '#3D5C4A'),
      'font-size:18px',
      'line-height:1',
      'display:flex','align-items:center','justify-content:center',
      'flex-shrink:0',
      'transition: color 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms cubic-bezier(0.16,1,0.3,1), transform 180ms cubic-bezier(0.16,1,0.3,1)',
      'outline:none'
    ].join(';');

    updateIcon(btn);

    btn.addEventListener('mouseenter', function() {
      btn.style.color = '#00ffa3';
      btn.style.borderColor = 'rgba(0,255,163,0.40)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.color = isDark() ? '#8BA89A' : '#3D5C4A';
      btn.style.borderColor = isDark() ? 'rgba(0,255,163,0.08)' : 'rgba(0,200,122,0.10)';
    });

    btn.addEventListener('click', function() {
      // rotate icon
      btn.style.transform = 'rotate(180deg)';
      setTimeout(function() { btn.style.transform = 'rotate(360deg)'; }, 180);

      var next = isDark() ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      updateIcon(btn);
      adjustDagOpacity();

      // Update border colors after toggle
      btn.style.color = isDark() ? '#8BA89A' : '#3D5C4A';
      btn.style.borderColor = isDark() ? 'rgba(0,255,163,0.08)' : 'rgba(0,200,122,0.10)';
    });

    // Insert near the right side of header (before wallet balance if present)
    var hdrRight = hdr.querySelector('.hdr-r');
    if (hdrRight) {
      hdrRight.insertBefore(btn, hdrRight.firstChild);
    } else {
      hdr.appendChild(btn);
    }
  }

  function updateIcon(btn) {
    btn.textContent = isDark() ? '\u2600' : '\uD83C\uDF19';  // ☀ or 🌙
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      html.setAttribute('data-theme', e.matches ? 'light' : 'dark');
      adjustDagOpacity();
    }
  });

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initTheme();
      createToggleButton();
      adjustDagOpacity();
    });
  } else {
    initTheme();
    createToggleButton();
    adjustDagOpacity();
  }
})();
