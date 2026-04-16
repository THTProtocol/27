/**
 * htp-address-sync.js — canonical address sync patch
 *
 * Root cause: three different globals hold "the connected address":
 *   window.walletAddress    — written by htpConnectManual (index.html)
 *   window.htpAddress       — written by htp-wallet-v3.js
 *   window.connectedAddress — written by htp-wallet-v3.js
 *
 * Different panels read different ones, so Portfolio "SCANNING FOR"
 * shows the escrow-derived address while the navbar shows the wallet address.
 *
 * Fix: use Object.defineProperty to make all three getters/setters
 * point at a single private backing store. Writing any one syncs all.
 * Also patches htpConnectManual to write the unified setter.
 */
(function(W) {
  'use strict';

  var _addr = W.walletAddress || W.htpAddress || W.connectedAddress || '';

  function defineSync(name) {
    if (W['__htpAddrSynced_' + name]) return;
    try {
      Object.defineProperty(W, name, {
        get: function() { return _addr; },
        set: function(v) {
          _addr = v || '';
          if (_addr) {
            try { localStorage.setItem('htp_last_address', _addr); } catch(e) {}
          }
        },
        configurable: true,
        enumerable: true
      });
      W['__htpAddrSynced_' + name] = true;
    } catch(e) {
      console.warn('[htp-address-sync] Could not proxy', name, e);
    }
  }

  defineSync('walletAddress');
  defineSync('htpAddress');
  defineSync('connectedAddress');

  function patchManual() {
    if (W.htpConnectManual && !W.htpConnectManual._synced) {
      var orig = W.htpConnectManual;
      W.htpConnectManual = function(address) {
        W.walletAddress = address;
        return orig.apply(this, arguments);
      };
      W.htpConnectManual._synced = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchManual);
  } else {
    patchManual();
  }

  W.addEventListener('htp:wallet:connected', function(e) {
    if (e.detail && e.detail.address) { _addr = e.detail.address; }
  });
  W.addEventListener('htp:wallet:disconnected', function() { _addr = ''; });

  if (!_addr) {
    try {
      var saved = localStorage.getItem('htp_last_address') || localStorage.getItem('htpPlayerId');
      if (saved && saved.startsWith('kaspa')) _addr = saved;
    } catch(e) {}
  }

  function patchClaimPanel() {
    if (W.initClaimPanel && !W.initClaimPanel._synced) {
      var orig = W.initClaimPanel;
      W.initClaimPanel = function() {
        if (!W.walletAddress && _addr) W.walletAddress = _addr;
        return orig.apply(this, arguments);
      };
      W.initClaimPanel._synced = true;
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchClaimPanel);
  } else {
    patchClaimPanel();
  }
  setTimeout(patchClaimPanel, 500);
  setTimeout(patchClaimPanel, 1500);

  console.log('[htp-address-sync] Unified address proxy active. Backing:', _addr || '(none)');

})(window);
