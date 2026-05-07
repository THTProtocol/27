(function() {
'use strict';

function hideLegacyViews() {
  var legacyIds = ['v-overview','v-markets','v-create','v-skill',
    'v-oracle','v-portfolio','v-wallet','v-kaspa','v-lobby',
    'v-game','v-terms','v-status','v-admin','v-docs','v-tx',
    'v-tournament','v-market','v-settle','v-dispute'];
  legacyIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.style.visibility = 'hidden'; }
  });
}

function ensureRoot() {
  var root = document.getElementById('htp-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'htp-root';
    root.style.cssText = 'min-height:100vh;padding:24px;max-width:1100px;margin:0 auto';
    var shell = document.querySelector('.shell') || document.body;
    shell.insertBefore(root, shell.firstChild);
  }
  return root;
}

function overrideGo() {
  window.go = function(v) {
    var map = {
      overview: '#/lobby', lobby: '#/lobby', wallet: '#/wallet',
      create: '#/create', markets: '#/markets', status: '#/status',
      admin: '#/admin', docs: '#/docs', skill: '#/lobby',
      kaspa: '#/status', oracle: '#/status', portfolio: '#/wallet',
      terms: '#/docs', game: '#/lobby'
    };
    window.location.hash = map[v] || ('#/' + v);
    document.querySelectorAll('.nav-btn').forEach(function(b) {
      b.classList.toggle('act', b.dataset.v === v);
    });
    window.scrollTo(0, 0);
  };
}

function ensureHash() {
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/lobby';
  }
}

function setupNavPill() {
  window.addEventListener('htp:wallet:connected', function(e) {
    var addr = (e.detail && e.detail.address) ? e.detail.address : '';
    if (!addr) return;
    var short = addr.slice(0, 10) + '...' + addr.slice(-4);
    document.querySelectorAll('.nav-btn[data-v="wallet"]').forEach(function(b) {
      b.textContent = short;
      b.style.color = 'var(--htp-gold, #c9a84c)';
    });
    ['htp-nav-addr','htp-connect-btn','htp-wallet-pill'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = short;
    });
    setTimeout(function() {
      if (window.htpRouter && typeof window.htpRouter.screenWallet === 'function') {
        window.htpRouter.screenWallet();
      }
    }, 200);
  });
}

// ───────────────────────────────────────────
// INLINE IMPORT (bypasses wallet-v3.js chain)
// ───────────────────────────────────────────
window._htpImportMnemonic = function() {
  var ta = document.getElementById('mnemonic-input');
  var phrase = ta ? ta.value.trim() : '';
  var st = document.getElementById('wallet-status');

  if (!phrase) {
    var t = document.createElement('div'); t.className = 'htp-toast';
    t.textContent = 'Paste your 12-word seed phrase first.';
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3000);
    return;
  }
  var words = phrase.split(/\s+/).filter(Boolean);
  if (words.length < 12) {
    var e2 = document.createElement('div'); e2.className = 'htp-toast';
    e2.style.borderColor = 'rgba(255,80,80,0.4)';
    e2.textContent = 'Need 12 words, got ' + words.length + '.';
    document.body.appendChild(e2); setTimeout(function(){ e2.remove(); }, 3000);
    return;
  }

  if (st) st.textContent = 'Deriving address...';

  if (!window.whenWasmReady) {
    if (st) st.textContent = 'Error: WASM not ready — reload and retry';
    return;
  }

  window.whenWasmReady(function() {
    try {
      var mn = window.kaspaSDK.Mnemonic.new(phrase);
      var xPriv = mn.toXPrv('');
      var dp = window.kaspaSDK.DerivationPath.new("m/44'/111111'/0'/0/0'");
      var pk = xPriv.derivePrivateKey(dp);
      var address = window.kaspaSDK.Address.fromPublicKey(
        pk.publicKey(),
        window.HTP_PREFIX || 'kaspatest'
      ).toString();

      window.connectedAddress = address;
      window.htpAddress = address;
      localStorage.setItem('htp_mnemonic_session', JSON.stringify({
        mnemonic: phrase, address: address, ts: Date.now()
      }));
      window.dispatchEvent(new CustomEvent('htp:wallet:connected',
        { detail: { address: address } }));

      try {
        var base = (window.HTP_CONFIG && window.HTP_CONFIG.API_ORIGIN) || 'https://hightable.duckdns.org';
        fetch(base + '/api/balance/' + address, { signal: AbortSignal.timeout(8000) })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(d) {
            if (d) {
              window.htpBalance = parseFloat(((d.balance_sompi || 0) / 1e8).toFixed(4));
              var bel = document.getElementById('htp-wallet-balance');
              if (bel) bel.textContent = window.htpBalance + ' KAS';
            }
          });
      } catch(err) { console.warn('[HTP] Balance fetch error:', err); }

      if (st) st.textContent = 'Connected!';
      setTimeout(function() {
        if (window.htpRouter && typeof window.htpRouter.screenWallet === 'function') {
          window.htpRouter.screenWallet();
        }
      }, 150);

    } catch(err) {
      if (st) st.textContent = 'Error: ' + err.message;
      var e3 = document.createElement('div'); e3.className = 'htp-toast';
      e3.style.borderColor = 'rgba(255,80,80,0.4)';
      e3.textContent = 'Import failed: ' + err.message;
      document.body.appendChild(e3);
      setTimeout(function(){ e3.remove(); }, 5000);
    }
  });
};

function overrideWalletImport() {
  if (window.htpWalletV3 && window.htpWalletV3.importMnemonic) {
    window.htpWalletV3.importMnemonic = window._htpImportMnemonic;
  } else {
    setTimeout(overrideWalletImport, 200);
  }
}

function installWalletScreen() {
  if (!window.htpRouter) return;

  window.htpRouter.screenWallet = function() {
    window.htpCurrentView = 'wallet';
    var root = ensureRoot();
    var addr = window.connectedAddress || window.htpAddress || '';

    if (addr) {
      root.innerHTML =
        '<div style="max-width:480px;margin:0 auto;padding:24px 0">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">' +
        '<h2 style="font-size:22px;font-weight:900;color:var(--htp-text,#fff);margin:0">WALLET</h2>' +
        '<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,255,135,0.08);border:1px solid rgba(0,255,135,0.25);border-radius:100px;padding:4px 12px;font-size:10px;font-weight:700;color:#00ff87;letter-spacing:0.1em">' +
        '<span style="width:6px;height:6px;border-radius:50%;background:#00ff87;animation:htp-pulse 1.5s infinite;display:inline-block"></span>CONNECTED</span>' +
        '</div>' +
        '<div style="background:var(--htp-card,#181818);border:1px solid var(--htp-border,#2a2a2a);border-radius:12px;padding:24px">' +
        '<div style="font-size:10px;color:var(--htp-muted,#888);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Address</div>' +
        '<div onclick="navigator.clipboard.writeText(this.dataset.addr);var t=document.createElement(\'div\');t.className=\'htp-toast\';t.textContent=\'Copied!\';document.body.appendChild(t);setTimeout(function(){t.remove()},2000)" ' +
        'data-addr="' + addr + '" ' +
        'style="font-family:monospace;font-size:12px;color:var(--htp-gold,#c9a84c);word-break:break-all;cursor:pointer;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px;margin-bottom:20px;border:1px solid rgba(201,168,76,0.15)" ' +
        'title="Click to copy">' + addr + '<span style="display:block;font-size:10px;color:var(--htp-muted,#888);margin-top:4px;font-family:sans-serif">tap to copy</span></div>' +
        '<div style="font-size:10px;color:var(--htp-muted,#888);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Balance</div>' +
        '<div id="htp-wallet-balance" style="font-size:36px;font-weight:900;color:var(--htp-gold,#c9a84c);letter-spacing:-0.02em;margin-bottom:24px">' + (window.htpBalance ? window.htpBalance + ' KAS' : '\u2014 KAS') + '</div>' +
        '<button class="htp-btn htp-btn-ghost" style="width:100%;padding:12px;font-size:12px;letter-spacing:0.08em" ' +
        'onclick="localStorage.removeItem(\'htp_mnemonic_session\');window.connectedAddress=null;window.htpAddress=null;window.location.reload()">DISCONNECT</button>' +
        '</div></div>';

      if (window.htpWalletV3 && window.htpWalletV3.refreshBalance)
        window.htpWalletV3.refreshBalance();

    } else {
      root.innerHTML =
        '<div style="max-width:480px;margin:0 auto;padding:24px 0">' +
        '<h2 style="font-size:22px;font-weight:900;color:var(--htp-text,#fff);margin:0 0 6px">WALLET</h2>' +
        '<p style="font-size:13px;color:var(--htp-muted,#888);margin:0 0 24px">Connect your Kaspa identity to play</p>' +

        '<div style="background:var(--htp-card,#181818);border:1px solid var(--htp-border,#2a2a2a);border-radius:12px;padding:24px;margin-bottom:12px">' +
        '<div style="font-size:14px;font-weight:700;color:var(--htp-text,#fff);margin-bottom:4px">Import Seed Phrase</div>' +
        '<div style="font-size:12px;color:var(--htp-muted,#888);margin-bottom:14px">Paste your 12 or 24 word mnemonic</div>' +
        '<textarea id="mnemonic-input" rows="3" placeholder="word1 word2 word3 ... word12" ' +
        'style="width:100%;background:rgba(0,0,0,0.4);border:1px solid var(--htp-border,#2a2a2a);border-radius:6px;padding:12px;color:var(--htp-text,#fff);font-size:13px;font-family:monospace;resize:vertical;box-sizing:border-box;outline:none;transition:border-color 0.2s" ' +
        'onfocus="this.style.borderColor=\'rgba(201,168,76,0.5)\'" ' +
        'onblur="this.style.borderColor=\'\'"></textarea>' +
        '<div id="wallet-status" style="font-size:11px;color:var(--htp-muted,#888);min-height:18px;margin:10px 0 12px;padding-left:2px"></div>' +
        '<button class="htp-btn" style="width:100%;padding:13px;font-size:13px;letter-spacing:0.08em" onclick="window._htpImportMnemonic()">IMPORT MNEMONIC</button>' +
        '</div>' +

        '<div style="background:var(--htp-card,#181818);border:1px solid var(--htp-border,#2a2a2a);border-radius:12px;padding:24px">' +
        '<div style="font-size:14px;font-weight:700;color:var(--htp-text,#fff);margin-bottom:4px">New Wallet</div>' +
        '<div style="font-size:12px;color:var(--htp-muted,#888);margin-bottom:14px">Generate a fresh 12-word seed \u2014 write it down first</div>' +
        '<button class="htp-btn htp-btn-ghost" style="width:100%;padding:13px;font-size:13px;letter-spacing:0.08em" onclick="window.htpWalletV3.generateWallet()">GENERATE WALLET</button>' +
        '</div></div>';
    }
  };
}

function boot() {
  hideLegacyViews();
  ensureRoot();
  overrideGo();
  ensureHash();
  setupNavPill();
  overrideWalletImport();
  installWalletScreen();

  if (window.htpRouter && window.htpRouter.render) {
    window.htpRouter.render();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
