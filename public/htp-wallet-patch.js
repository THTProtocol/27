/**
 * htp-wallet-patch.js
 * Patches the static wallet grid:
 * 1. Replaces logos with real ones (SVG inline or img)
 * 2. Sets correct button labels per wallet type (not everything says INSTALL)
 */

(function() {

  // Real logos: inline SVG or img tag
  var LOGOS = {
    'KasWare': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="48" height="48" style="border-radius:10px">
      <rect width="40" height="40" rx="10" fill="#49EACB"/>
      <rect x="3" y="3" width="34" height="34" rx="7" fill="#0a1f1a"/>
      <text x="20" y="27" font-family="monospace" font-size="17" font-weight="900" fill="#49EACB" text-anchor="middle">|&lt;</text>
    </svg>`,
    'Kastle':   `<img src="img/kastle.png"   onerror="this.src='https://kastle.cc/favicon.ico'"   width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Kasperia': `<img src="img/kasperia.png" onerror="this.src='https://kasperia.com/favicon.ico'" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'OKX Wallet': `<img src="https://www.okx.com/favicon.ico" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Kaspa-NG': `<img src="https://kaspa-ng.org/favicon.ico" onerror="this.src='https://kaspa-ng.app/favicon.ico'" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Kaspium':  `<img src="https://kaspium.io/favicon.ico" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Tangem':   `<img src="https://tangem.com/favicon.ico" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'KSPR Bot': `<img src="https://kspr.app/favicon.ico" onerror="this.src='https://telegram.org/favicon.ico'" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Kasanova': `<img src="https://kasanova.app/favicon.ico" onerror="this.src='https://kasanova.io/favicon.ico'" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'Kaspium':  `<img src="https://kaspium.io/favicon.ico" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
    'KaspaCom': `<img src="https://kaspacom.com/favicon.ico" width="48" height="48" style="border-radius:10px;object-fit:contain">`,
  };

  // Smart button labels — only browser extensions say "Install"
  var BTN_LABELS = {
    'KasWare':    { label: 'Install ↗',      url: 'https://chrome.google.com/webstore/detail/hklhheigdmpoolooomdihmhlpjjdbklf' },
    'Kastle':     { label: 'Install ↗',      url: 'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego' },
    'Kasperia':   { label: 'Install ↗',      url: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob' },
    'OKX Wallet': { label: 'Install ↗',      url: 'https://www.okx.com/web3' },
    'Kaspa-NG':   { label: 'Download ↗',     url: 'https://github.com/aspectron/kaspa-ng/releases' },
    'Kasanova':   { label: 'Get App ↗',      url: 'https://kasanova.io' },
    'Kaspium':    { label: 'Get App ↗',      url: 'https://kaspium.io' },
    'Tangem':     { label: 'Buy Card ↗',     url: 'https://tangem.com' },
    'KSPR Bot':   { label: 'Open Bot ↗',     url: 'https://t.me/kspr_home_bot' },
    'KaspaCom':   { label: 'Open Wallet ↗',  url: 'https://kaspa.com' },
  };

  function patchWalletGrid() {
    // Find all wallet cards — try multiple selector patterns
    var cards = document.querySelectorAll('.w-card, .wallet-card, [data-wallet], .wallet-extension-grid > div');
    if (!cards.length) return; // grid not rendered yet

    cards.forEach(function(card) {
      // Get wallet name from heading or data attribute
      var nameEl = card.querySelector('h3, h4, .w-name, [class*="name"]');
      var name = (card.getAttribute('data-wallet') || (nameEl && nameEl.textContent.trim()) || '').trim();
      if (!name) return;

      // Fix logo
      var logoContainer = card.querySelector('.w-logo, .wallet-logo, [class*="logo"], img, svg');
      var logoHTML = LOGOS[name];
      if (logoHTML && logoContainer) {
        var wrapper = logoContainer.closest('.w-logo, [class*="logo-wrap"]') || logoContainer.parentElement;
        if (wrapper && wrapper !== card) {
          wrapper.innerHTML = logoHTML;
        } else {
          logoContainer.outerHTML = logoHTML;
        }
      }

      // Fix button label (only for undetected/install buttons)
      var btn = card.querySelector('button, a.btn, .w-btn');
      var btnData = BTN_LABELS[name];
      if (btn && btnData) {
        var isConnected = btn.textContent.trim().toUpperCase() === 'CONNECT';
        if (!isConnected) {
          btn.textContent = btnData.label;
          if (btnData.url && !btn.getAttribute('data-wallet')) {
            btn.onclick = function(e) { e.preventDefault(); window.open(btnData.url, '_blank'); };
          }
        }
      }
    });
  }

  // Run after DOM + any dynamic grid rendering
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(patchWalletGrid, 300); });
  } else {
    setTimeout(patchWalletGrid, 300);
  }

  // Also re-run when wallet view is shown
  window.addEventListener('htp:view:wallet', function() { setTimeout(patchWalletGrid, 100); });
  window.addEventListener('htp:wallet:grid:ready', function() { setTimeout(patchWalletGrid, 100); });

  // Expose for manual call
  window.htpPatchWalletGrid = patchWalletGrid;

})();
