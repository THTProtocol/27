'use strict';
// wallet.html companion — generates TN12 wallet, stores privkey
(function(){
  const STORAGE_KEY = 'htp_privkey';
  const REST = 'https://api-tn12.kaspa.org';
  const SOMPI = 100000000;

  // Use noble/secp256k1 for key generation (pure JS, no wasm needed)
  function loadLibs(cb) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@noble/secp256k1@2.1.0/index.js';
    s.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/@noble/hashes@1.5.0/blake2b.js';
      s2.onload = cb;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }

  function genWallet() {
    if (typeof nobleSecp256k1 === 'undefined') {
      document.getElementById('out').innerHTML = '<p style="color:red">Loading crypto libs...</p>';
      return loadLibs(() => genWallet());
    }
    const priv = nobleSecp256k1.utils.randomPrivateKey();
    const pub = nobleSecp256k1.getPublicKey(priv, true);
    const privHex = Array.from(priv).map(b => b.toString(16).padStart(2,'0')).join('');
    const pubHex = Array.from(pub).map(b => b.toString(16).padStart(2,'0')).join('');

    // Kaspa P2PK address: version(1) + x-only pubkey hash
    const addrHex = pubHex.slice(2); // strip 02/03 prefix for x-only
    // Encode as bech32: "kaspatest" prefix + version 0 + 32-byte hash
    const payload = bech32Encode('kaspatest', 0, hexToBytes(addrHex));

    document.getElementById('out').innerHTML =
      '<div class="card"><h3>Your TN12 Wallet</h3>' +
      '<p>Address: <code class="addr">' + payload + '</code></p>' +
      '<p>Private Key: <code class="key">' + privHex + '</code></p>' +
      '<p style="color:#f0a040;font-size:12px">Save this key! It never leaves your browser.</p>' +
      '<button onclick="copyKey()" class="btn">Copy Private Key</button>' +
      '<button onclick="useKey()" class="btn btn-primary">Use This Key</button></div>';
    window._privkey = privHex;
    window._addr = payload;
  }

  function saveKey() {
    const key = document.getElementById('key-input').value.trim();
    if (key.length < 64) return alert('Invalid key (need 64 hex chars)');
    sessionStorage.setItem(STORAGE_KEY, key);
    document.getElementById('status').textContent = 'Key saved. Go play!';
    document.getElementById('status').style.color = '#4f8';
  }

  function showBalance() {
    const key = sessionStorage.getItem(STORAGE_KEY);
    if (!key) return document.getElementById('bal-out').innerHTML = '<p>No key saved. Generate or paste one first.</p>';
    // Derive address from key
    const priv = hexToBytes(key);
    const pub = nobleSecp256k1.getPublicKey(priv, true);
    const pubHex = Array.from(pub).map(b => b.toString(16).padStart(2,'0')).join('');
    const addrHex = pubHex.slice(2);
    const addr = bech32Encode('kaspatest', 0, hexToBytes(addrHex));
    window._addr = addr;

    fetch(REST + '/addresses/' + addr + '/balance')
      .then(r => r.json())
      .then(d => {
        const kas = (parseInt(d.balance || '0') / SOMPI).toFixed(4);
        document.getElementById('bal-out').innerHTML =
          '<div class="card"><h3>Balance</h3>' +
          '<p>Address: <code class="addr">' + addr + '</code></p>' +
          '<p>Balance: <b>' + kas + ' KAS</b></p>' +
          '<p>Explorer: <a href="https://explorer-tn12.kaspa.org/addresses/' + addr + '" target="_blank">View</a></p></div>';
      }).catch(() => {
        document.getElementById('bal-out').innerHTML = '<p style="color:red">Could not fetch balance. Check console.</p>';
      });
  }

  function bech32Encode(prefix, version, data) {
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const M = 0x2bc830a3;
    let chk = 1;
    const bits = [];
    for (let i = 0; i < data.length; i++) {
      bits.push(data[i] >> 5);
      bits.push(data[i] & 31);
      chk = polymod([version, ...bits]) ^ chk;
    }
    chk = polymod([version, ...bits, ...intTo5(chk, 6)]);
    const checksum = [];
    for (let i = 0; i < 6; i++) { checksum.push((chk >> (5 * (5 - i))) & 31); chk ^= checksum[i] << (5 * (5 - i)); }
    let out = prefix + ':';
    out += CHARSET[version];
    for (const b of bits) out += CHARSET[b];
    for (const b of checksum) out += CHARSET[b];
    return out;
  }

  function polymod(values) { let c = 1; for (const v of values) { const c0 = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ v; if (c0 & 1) c ^= 0x3b6a57b2; if (c0 & 2) c ^= 0x26508e6d; if (c0 & 4) c ^= 0x1ea119fa; if (c0 & 8) c ^= 0x3d4233dd; if (c0 & 16) c ^= 0x2a1462b3; } return c; }

  function intTo5(v, len) { const r = []; for (let i = 0; i < len; i++) { r.unshift(v & 31); v >>>= 5; } return r; }

  function hexToBytes(h) { const b = []; for (let i = 0; i < h.length; i+=2) b.push(parseInt(h.substr(i,2), 16)); return b; }

  window.copyKey = () => { navigator.clipboard.writeText(window._privkey); alert('Copied!'); };
  window.useKey = () => { sessionStorage.setItem(STORAGE_KEY, window._privkey); window._addr = window._addr; document.getElementById('status').textContent = 'Key saved. Go play!'; document.getElementById('status').style.color = '#4f8'; };
  window.genWallet = genWallet;
  window.saveKey = saveKey;
  window.showBalance = showBalance;

  // init
  loadLibs(() => {});
})();
