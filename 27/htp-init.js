/**
 * htp-init.js — HTP bootstrap, wallet connect button, WASM lifecycle
 *
 * Sets window.HTP_RUST_API before any shim loads.
 * Order: .cloud-run-url injection (CI) > HTP_RUST_API env > Railway autodiscovery.
 */
(function(W) {
  'use strict';

  // ── Set Rust API base URL ────────────────────────────────────────────────
  // Priority:
  //   1. Already set by CI injection (deploy-hosting.yml injects into index.html)
  //   2. Railway: project 3ab9253c, service htp-backend (europe-west4)
  if (!W.HTP_RUST_API) {
    W.HTP_RUST_API = 'https://htp-backend-production.up.railway.app';
  }
  if (!W.HTP_NETWORK_ID) {
    W.HTP_NETWORK_ID = 'testnet-12';
  }

  // ── Connect Wallet button ────────────────────────────────────────────────
  var _btnReady = false;

  function initConnectBtn() {
    if (_btnReady) return;
    var btn = document.getElementById('connectWalletBtn') || document.getElementById('cBtn');
    if (!btn) return;
    _btnReady = true;
    btn.addEventListener('click', function() {
      if (typeof W.togConn === 'function') W.togConn();
    });
  }

  // ── Wallet event handlers ────────────────────────────────────────────────
  W.addEventListener('htp:wallet:connected', function(e) {
    var btn = document.getElementById('connectWalletBtn') || document.getElementById('cBtn');
    if (btn) {
      var addr = e.detail && e.detail.address;
      btn.textContent = addr ? addr.substring(0, 12) + '…' : 'Connected';
      btn.classList.add('connected');
    }
    // Store address everywhere shims look for it
    var address = e.detail && e.detail.address;
    if (address) {
      W.connectedAddress = address;
      W.htpAddress = address;
      W.walletAddress = address;
      try { localStorage.setItem('htp_last_address', address); } catch(e2) {}
      // Propagate to Firebase auth listeners
      W.htpPlayerId = address;
    }
  });

  W.addEventListener('htp:wallet:disconnected', function() {
    var btn = document.getElementById('connectWalletBtn') || document.getElementById('cBtn');
    if (btn) { btn.textContent = 'Connect Wallet'; btn.classList.remove('connected'); }
    W.connectedAddress = null; W.htpAddress = null; W.walletAddress = null;
  });

  // ── WASM lifecycle ───────────────────────────────────────────────────────
  W.addEventListener('htp:wasm:ready', function() {
    document.body.classList.add('htp-wasm-ready');
    if (typeof W._onWasmReady === 'function') W._onWasmReady();
  });

  W.addEventListener('htp:wasm:fatal', function(e) {
    console.error('[HTP Init] WASM fatal:', e.detail);
    var msg  = (e.detail && e.detail.message) || 'Kaspa WASM SDK Failed to Load';
    var hint = 'If this persists, restart your browser and clear cache.';
    // Show toast
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #ef4444;color:#ef4444;padding:12px 24px;border-radius:8px;z-index:9999;font-family:Inter,sans-serif;font-size:14px;max-width:500px;text-align:center;cursor:pointer;';
    el.innerHTML = '<strong style="font-size:20px;font-weight:600;margin:0 0 16px 0;color:#ef4444;display:block">' + msg + '</strong>' +
      '<p style="margin:0 0 12px;color:#94a3b8">' + hint + ' ' + 'Please try again in a moment or check your internet connection.' + '</p>' +
      '<button style="background:#ef4444;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:700">Refresh Page</button>';
    el.querySelector('button').addEventListener('click', function() { W.location.reload(); });
    el.addEventListener('click', function(ev) { if (ev.target === el) el.remove(); });
    document.body.appendChild(el);
  });

  // ── WASM offline banner (non-fatal) ─────────────────────────────────────
  W.addEventListener('htpWasmFailed', function() {
    var existing = document.getElementById('htp-wasm-offline-banner');
    if (existing) return;
    var banner = document.createElement('div');
    banner.id = 'htp-wasm-offline-banner';
    banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #f59e0b;color:#f59e0b;padding:12px 24px;border-radius:8px;z-index:9999;font-family:Inter,sans-serif;font-size:14px;opacity:0;transition:opacity 0.5s;';
    banner.innerHTML = 'Kaspa WASM SDK unavailable &mdash; blockchain features offline. <u style="cursor:pointer">Dismiss</u>';
    banner.querySelector('u').addEventListener('click', function() { banner.remove(); });
    document.body.appendChild(banner);
    setTimeout(function() { banner.style.opacity = '1'; }, 10);
  });

  // ── Nav tab routing ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    initConnectBtn();
    // Restore last address
    try {
      var saved = localStorage.getItem('htp_last_address');
      if (saved && !W.connectedAddress) {
        W.connectedAddress = saved; W.htpAddress = saved; W.walletAddress = saved; W.htpPlayerId = saved;
      }
    } catch(e) {}
  });

  // ── htp:matches:loaded → reveal skeleton ───────────────────────────────
  W.addEventListener('htp:matches:loaded', function() {
    document.body.classList.add('htp-matches-loaded');
  });

  console.log('[HTP Init] Rust API:', W.HTP_RUST_API, '| Network:', W.HTP_NETWORK_ID);
})(window);
