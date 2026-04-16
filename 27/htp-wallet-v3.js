/**
 * htp-wallet-v3.js  —  High Table Protocol Wallet Module
 * Handles wallet connection, balance display, and address management.
 */
(function(W) {
  'use strict';

  // ── Session management ──────────────────────────────────────────────────
  const SESSION_KEY = 'htp_mnemonic_session';

  function saveSession(address, encryptedMnemonic) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ address, encryptedMnemonic, ts: Date.now() }));
    } catch(e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function clearMnemonicSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
  }

  // Restore session on load
  var session = loadSession();
  if (session && session.address) {
    W.connectedAddress = session.address;
    W.htpAddress = session.address;
  }

  // ── Balance polling ─────────────────────────────────────────────────────
  var _balancePollInterval = null;

  W.startBalancePoller = function() {
    if (_balancePollInterval) clearInterval(_balancePollInterval);
    _balancePollInterval = setInterval(fetchBalance, 15000);
    fetchBalance();
  };

  async function fetchBalance() {
    var addr = W.connectedAddress || W.htpAddress || W.walletAddress;
    if (!addr) return;
    var net = W.HTP_NETWORK || 'tn12';
    var base = net === 'mainnet' ? 'https://api.kaspa.org' : 'https://api-tn12.kaspa.org';
    try {
      var r = await fetch(base + '/addresses/' + addr + '/balance');
      var d = await r.json();
      var kas = ((d.balance || 0) / 1e8);
      W.htpBalance = kas;
      var balEl = document.getElementById('cBtnBal');
      if (balEl) balEl.textContent = kas.toFixed(2) + ' KAS';
      var cbEl = document.getElementById('connected-balance');
      if (cbEl) cbEl.textContent = kas.toFixed(4);
    } catch(e) {}
  }

  // ── Wallet UI object ─────────────────────────────────────────────────────
  W.HTPWallet = {
    _panelOpen: false,

    toggle() {
      var panel = document.getElementById('wallet-panel');
      if (!panel) return;
      this._panelOpen = !this._panelOpen;
      panel.style.display = this._panelOpen ? 'block' : 'none';
      if (this._panelOpen) this.updateUI();
    },

    close() {
      var panel = document.getElementById('wallet-panel');
      if (panel) panel.style.display = 'none';
      this._panelOpen = false;
    },

    async connectKasware() {
      if (!W.kasware) {
        if (typeof showToast === 'function') showToast('KasWare not detected. Install the extension.', 'error');
        return;
      }
      try {
        var accounts = await W.kasware.requestAccounts();
        if (accounts && accounts[0]) {
          W.connectedAddress = accounts[0];
          W.htpAddress = accounts[0];
          this.updateUI();
          W.startBalancePoller();
          W.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: accounts[0] } }));
          if (typeof showToast === 'function') showToast('KasWare connected', 'success');
        }
      } catch(e) {
        if (typeof showToast === 'function') showToast('KasWare connection failed: ' + e.message, 'error');
      }
    },

    async connectKaspaWallet() {
      if (!W.kaspaWallet && !W.kaspa) {
        if (typeof showToast === 'function') showToast('Kaspa Wallet not detected.', 'error');
        return;
      }
      try {
        var provider = W.kaspaWallet || W.kaspa;
        var result = await provider.connect();
        if (result && result.address) {
          W.connectedAddress = result.address;
          W.htpAddress = result.address;
          this.updateUI();
          W.startBalancePoller();
          W.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: result.address } }));
          if (typeof showToast === 'function') showToast('Kaspa Wallet connected', 'success');
        }
      } catch(e) {
        if (typeof showToast === 'function') showToast('Connection failed: ' + e.message, 'error');
      }
    },

    toggleMnemonicPanel() {
      var mp = document.getElementById('mnemonic-panel');
      if (mp) mp.style.display = (mp.style.display === 'none' || !mp.style.display) ? 'block' : 'none';
    },

    async importMnemonic() {
      var input = document.getElementById('mnemonic-input');
      var status = document.getElementById('mnemonic-status');
      if (!input || !status) return;
      var phrase = input.value.trim();
      if (!phrase) { status.style.display = 'block'; status.textContent = 'Enter a mnemonic phrase'; return; }

      status.style.display = 'block';
      status.style.background = 'rgba(245,158,11,0.1)';
      status.style.color = '#f59e0b';
      status.style.borderLeft = '3px solid #f59e0b';
      status.textContent = 'Importing...';

      try {
        if (!W.htpWalletImportMnemonic) throw new Error('Wallet import not available');
        var result = await W.htpWalletImportMnemonic(phrase);
        if (result.ok) {
          W.connectedAddress = result.address;
          W.htpAddress = result.address;
          saveSession(result.address, result.encryptedMnemonic || phrase);
          this.updateUI();
          W.startBalancePoller();

          status.style.background = 'rgba(34,197,94,0.1)';
          status.style.color = '#22c55e';
          status.style.borderLeft = '3px solid #22c55e';
          status.textContent = 'Wallet imported! Address: ' + formatAddress(result.address) + ' | Balance: ' + result.balance + ' KAS';

          document.getElementById('mnemonic-input').value = '';
          setTimeout(() => this.toggleMnemonicPanel(), 1000);

          W.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: result.address } }));
        } else {
          status.style.background = 'rgba(239,68,68,0.1)';
          status.style.color = '#ef4444';
          status.style.borderLeft = '3px solid #ef4444';
          status.textContent = result.error;
        }
      } catch(e) {
        status.style.background = 'rgba(239,68,68,0.1)';
        status.style.color = '#ef4444';
        status.style.borderLeft = '3px solid #ef4444';
        status.textContent = 'Import failed: ' + e.message;
      }
    },

    clearMnemonicInput() {
      document.getElementById('mnemonic-input').value = '';
      document.getElementById('mnemonic-status').style.display = 'none';
    },

    setManualAddress() {
      var addr = document.getElementById('manual-address-input').value.trim();
      if (!addr) {
        W.showToast('Enter an address', 'error');
        return;
      }
      W.connectedAddress = addr;
      W.htpAddress = addr;
      this.updateUI();
      W.dispatchEvent(new CustomEvent('htp:wallet:connected', { detail: { address: addr } }));
    },

    disconnect() {
      W.connectedAddress = null;
      W.htpAddress = null;
      try { localStorage.removeItem('htpPlayerId'); } catch(e) {}
      clearMnemonicSession();
      this.updateUI();
      W.dispatchEvent(new CustomEvent('htp:wallet:disconnected'));
    },

    setNetwork(net) {
      if (net === 'mainnet') return;
      try { localStorage.setItem('htp_network', net); } catch(e) {}
      W.HTP_NETWORK = net;
      W.location.reload();
    },

    updateUI() {
      var connectedDiv = document.getElementById('wallet-connected-status');
      if (W.connectedAddress) {
        if (connectedDiv) connectedDiv.style.display = 'block';
        var addrEl = document.getElementById('connected-address');
        if (addrEl) addrEl.textContent = W.connectedAddress;
        var balEl = document.getElementById('connected-balance');
        if (balEl) balEl.textContent = (W.htpBalance || '...').toFixed ? (W.htpBalance || 0).toFixed(4) : '...';

        document.querySelectorAll('.wallet-card').forEach(card => {
          card.setAttribute('data-connected', 'false');
          var ind = card.querySelector('.wallet-status-indicator');
          if (ind) ind.style.display = 'none';
          card.style.borderColor = 'var(--border)';
        });
      } else {
        if (connectedDiv) connectedDiv.style.display = 'none';
        document.querySelectorAll('.wallet-card').forEach(card => {
          card.style.borderColor = 'var(--border)';
        });
      }
    }
  };

  function formatAddress(addr) {
    if (!addr) return '';
    return addr.substring(0, 16) + '...' + addr.slice(-8);
  }

  // Restore any saved session address
  if (session && session.address) {
    W.HTPWallet.updateUI();
    W.startBalancePoller();
  }

  console.log('[HTP Wallet V3] Module loaded');

})(window);

/* ═══════════════════════════════════════════════════════════════════════════
 * ADDRESS SYNC PATCH v1
 * Unifies window.walletAddress / window.htpAddress / window.connectedAddress
 * into a single backing store so ALL panels (navbar, portfolio, claim)
 * always show the same connected wallet.
 *
 * Root cause that was fixed:
 *   - htpConnectManual (index.html) only wrote window.walletAddress
 *   - htp-wallet-v3.js only wrote connectedAddress + htpAddress
 *   - Portfolio initClaimPanel read walletAddress -> showed stale escrow addr
 *   - Navbar read connectedAddress -> showed correct wallet addr
 *   => two different addresses shown simultaneously
 * ═══════════════════════════════════════════════════════════════════════════ */
(function(W) {
  'use strict';
  var _addr = W.connectedAddress || W.htpAddress || W.walletAddress || '';

  function defineSync(name) {
    if (W['__htpAddrSynced_' + name]) return;
    try {
      Object.defineProperty(W, name, {
        get: function() { return _addr; },
        set: function(v) {
          _addr = v || '';
          if (_addr) { try { localStorage.setItem('htp_last_address', _addr); } catch(e) {} }
        },
        configurable: true, enumerable: true
      });
      W['__htpAddrSynced_' + name] = true;
    } catch(e) { console.warn('[htp-address-sync] proxy failed:', name, e); }
  }

  defineSync('walletAddress');
  defineSync('htpAddress');
  defineSync('connectedAddress');

  function patchManual() {
    if (W.htpConnectManual && !W.htpConnectManual._synced) {
      var orig = W.htpConnectManual;
      W.htpConnectManual = function(address) { W.walletAddress = address; return orig.apply(this, arguments); };
      W.htpConnectManual._synced = true;
    }
  }
  document.addEventListener('DOMContentLoaded', patchManual);
  setTimeout(patchManual, 200); setTimeout(patchManual, 800);

  function patchClaimPanel() {
    if (W.initClaimPanel && !W.initClaimPanel._synced) {
      var orig = W.initClaimPanel;
      W.initClaimPanel = function() {
        if (!_addr && W.connectedAddress) _addr = W.connectedAddress;
        return orig.apply(this, arguments);
      };
      W.initClaimPanel._synced = true;
    }
  }
  document.addEventListener('DOMContentLoaded', patchClaimPanel);
  setTimeout(patchClaimPanel, 300); setTimeout(patchClaimPanel, 1000);

  if (!_addr) {
    try { var s = localStorage.getItem('htp_last_address'); if (s && s.startsWith('kaspa')) _addr = s; } catch(e) {}
  }

  W.addEventListener('htp:wallet:connected',    function(e) { if (e.detail && e.detail.address) _addr = e.detail.address; });
  W.addEventListener('htp:wallet:disconnected', function()  { _addr = ''; try { localStorage.removeItem('htp_last_address'); } catch(e) {} });

  console.log('[htp-address-sync v1] Unified address proxy active —', _addr || '(no address yet)');
})(window);
