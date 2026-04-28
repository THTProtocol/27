'use strict';

class WalletUI {
  constructor() {
    this.connected = false;
    this.address = null;
    this.publicKey = null;
    this.balance = 0;
    this.network = 'testnet-12';
    this.listeners = [];
  }

  async connect() {
    if (typeof window.kasware === 'undefined') {
      this._showInstallPrompt();
      return false;
    }
    try {
      const accounts = await window.kasware.requestAccounts();
      if (!accounts || !accounts.length) {
        showToast('Wallet connection rejected', 'error');
        return false;
      }
      this.address = accounts[0];
      this.connected = true;
      try {
        this.publicKey = await window.kasware.getPublicKey();
      } catch (e) { console.warn('Could not get public key:', e); }
      await this.refreshBalance();
      this._updateUI();
      this._emit('connected', { address: this.address, publicKey: this.publicKey });
      showToast('Wallet connected: ' + this.shortAddress(), 'success');

      window.kasware.on('accountsChanged', (accounts) => {
        if (accounts.length) {
          this.address = accounts[0];
          this.refreshBalance();
          this._updateUI();
          this._emit('accountChanged', { address: this.address });
        } else { this.disconnect(); }
      });
      window.kasware.on('networkChanged', (network) => {
        this.network = network;
        this._emit('networkChanged', { network });
      });
      return true;
    } catch (e) {
      console.error('Wallet connect error:', e);
      showToast('Connection failed: ' + e.message, 'error');
      return false;
    }
  }

  disconnect() {
    this.connected = false;
    this.address = null;
    this.publicKey = null;
    this.balance = 0;
    this._updateUI();
    this._emit('disconnected');
    showToast('Wallet disconnected', 'info');
  }

  async refreshBalance() {
    if (!this.connected) return;
    try {
      const bal = await window.kasware.getBalance();
      this.balance = bal.total || 0;
      this._updateUI();
    } catch (e) { console.warn('Balance refresh failed:', e); }
  }

  async signPskt(psktHex) {
    if (!this.connected) { showToast('Connect wallet first', 'error'); return null; }
    try {
      showToast('Please approve in KasWare...', 'info');
      const signed = await window.kasware.signPSKT(psktHex);
      showToast('Transaction signed', 'success');
      return signed;
    } catch (e) {
      if (e.message && e.message.includes('reject')) {
        showToast('Transaction rejected by user', 'error');
      } else {
        showToast('Signing failed: ' + e.message, 'error');
      }
      return null;
    }
  }

  async signAndBroadcast(psktHex) {
    const signed = await this.signPskt(psktHex);
    if (!signed) return null;
    try {
      const txid = await window.kasware.pushPSKT(signed);
      showToast('Transaction broadcast: ' + txid.substring(0, 12) + '...', 'success');
      setTimeout(() => this.refreshBalance(), 3000);
      return txid;
    } catch (e) {
      showToast('Broadcast failed: ' + e.message, 'error');
      return null;
    }
  }

  shortAddress() {
    if (!this.address) return '';
    return this.address.substring(0, 14) + '...' + this.address.slice(-6);
  }

  balanceKAS() {
    return (this.balance / 100000000).toFixed(2);
  }

  on(event, fn) { this.listeners.push({ event, fn }); }

  _emit(event, data) {
    this.listeners.filter(l => l.event === event).forEach(l => l.fn(data));
  }

  _updateUI() {
    const btn = document.getElementById('wallet-btn');
    if (!btn) return;
    if (this.connected) {
      btn.className = 'wallet-btn connected';
      btn.innerHTML = '<span class="wallet-addr">' + this.shortAddress() + '</span>' +
        '<span class="wallet-balance">' + this.balanceKAS() + ' KAS</span>';
      btn.onclick = () => this._showWalletMenu();
    } else {
      btn.className = 'wallet-btn';
      btn.innerHTML = 'Connect Wallet';
      btn.onclick = () => this.connect();
    }
    const dot = document.getElementById('net-dot');
    if (dot) dot.style.background = this.connected ? 'var(--green)' : 'var(--red)';
    const netLabel = document.getElementById('net-label');
    if (netLabel) netLabel.textContent = this.connected ? this.network : 'disconnected';
  }

  _showWalletMenu() {
    const existing = document.getElementById('wallet-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'wallet-menu';
    menu.style.cssText = 'position:absolute;top:56px;right:24px;background:var(--bg-card);' +
      'border:1px solid var(--border);border-radius:var(--radius);padding:8px;z-index:150;min-width:200px;';
    menu.innerHTML =
      '<div style="padding:8px;font-size:11px;color:var(--text-muted);font-family:var(--font-mono);word-break:break-all">' + this.address + '</div>' +
      '<div style="border-top:1px solid var(--border);margin:4px 0"></div>' +
      '<div class="link" style="padding:8px;font-size:13px" onclick="navigator.clipboard.writeText(\'' + this.address + '\');showToast(\'Address copied\',\'success\');document.getElementById(\'wallet-menu\').remove()">Copy Address</div>' +
      '<div class="link" style="padding:8px;font-size:13px" onclick="app.wallet.refreshBalance();document.getElementById(\'wallet-menu\').remove()">Refresh Balance</div>' +
      '<div style="border-top:1px solid var(--border);margin:4px 0"></div>' +
      '<div class="link" style="padding:8px;font-size:13px;color:var(--red)" onclick="app.wallet.disconnect();document.getElementById(\'wallet-menu\').remove()">Disconnect</div>';
    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 10);
  }

  _showInstallPrompt() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    if (!overlay || !modal) {
      showToast('Install KasWare Wallet extension from kasware.xyz', 'error');
      return;
    }
    overlay.classList.add('active');
    modal.classList.add('active');
    modal.innerHTML =
      '<div class="modal-header"><h2>KasWare Wallet Required</h2>' +
      '<button class="modal-close" onclick="closeModal()">&times;</button></div>' +
      '<p style="color:var(--text-secondary);line-height:1.7;margin-bottom:16px">' +
      'High Table requires the KasWare browser extension to sign transactions on Kaspa.</p>' +
      '<a href="https://kasware.xyz" target="_blank" class="btn btn-primary btn-lg" style="text-decoration:none">' +
      'Install KasWare Wallet</a>' +
      '<p style="color:var(--text-muted);font-size:12px;margin-top:12px">' +
      'After installing, refresh this page and click Connect Wallet.</p>';
  }
}