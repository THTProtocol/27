/**
 * htp-wallet-logos.js — v14.0
 * KEY CHANGE: No longer overrides window.selWallet.
 * index.html closure's selWallet() handles all connections.
 * We only polyfill kastle.requestAccounts() so the closure works with Kastle.
 * Mobile toggle intact. Install redirect for undetected wallets.
 */

// ── LOGOS (LOCKED) ───────────────────────────────────────────────────────────
var _WL_LOGOS = {
  KasWare:  'https://lh3.googleusercontent.com/GWR2Bode3QAzDrsZJHVRsYhCN60azRCtL1xoOBxqCYcDpbMD_avwiFkuiAOAkuyLnEh9DGOAoZSbWDcNUhiZ7X6RZE8=s128-rj-sc0x00ffffff',
  Kastle:   'https://lh3.googleusercontent.com/byDg7ykj9UUJRur0v8jFr9orcj7N1_M6LuqtwnJxlnVNk4GV0JrhFmS0Xp0U9QRgxGZa4wf7-8M29v7kfEBc-Ha9kg=s128-rj-sc0x00ffffff',
  Kasperia: 'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128-rj-sc0x00ffffff',
  OKX:      'https://lh3.googleusercontent.com/2bBevW79q6gRZTFdm42CzUetuEKndq4fn41HQGknMpKMF_d-Ae2sJJzgfFUAVb1bJKCBb4ptZ9EAPp-QhWYIvc35yw=s128-rj-sc0x00ffffff',
  Kasanova: 'https://kasanova.app/favicon.ico',
  Kaspium:  'https://kaspium.io/favicon.ico',
  KaspaCom: 'https://wallet.kaspa.com/favicon.ico'
};

// ── Install URLs ──────────────────────────────────────────────────────────────
var _WL_INSTALL = {
  KasWare:  'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  Kastle:   'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  Kasperia: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
  OKX:      'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  Kasanova: 'https://kasanova.app',
  Kaspium:  'https://kaspium.io',
  KaspaCom: 'https://wallet.kaspa.com'
};

// ── Wallet definitions ────────────────────────────────────────────────────────
var _WL_DESKTOP = [
  { id:'KasWare',  name:'KasWare',  sub:'Chrome · Firefox', detect:function(){ return !!(window.kasware||window.kasWare); } },
  { id:'Kastle',   name:'Kastle',   sub:'Chrome',            detect:function(){ return !!window.kastle; } },
  { id:'Kasperia', name:'Kasperia', sub:'Chrome',            detect:function(){ return !!window.kasperia; } },
  { id:'OKX',      name:'OKX',      sub:'Chrome · Mobile',   detect:function(){ return !!(window.okxwallet&&window.okxwallet.kaspa); } }
];

var _WL_MOBILE = [
  { id:'Kasanova', name:'Kasanova', sub:'iOS · Android', detect:function(){ return !!(window.kasanova&&window.kasanova.kasware); } },
  { id:'Kaspium',  name:'Kaspium',  sub:'iOS · Android', detect:function(){ return !!(window.kaspium||window.KaspiumWallet); } },
  { id:'KaspaCom', name:'KaspaCom', sub:'Web · Mobile',  detect:function(){ return !!(window.kaspacom||(window.kaspa&&typeof window.kaspa.connect==='function')); } }
];

function _isPhone(){ return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); }
window._htpMobOn = window._htpMobOn !== undefined ? window._htpMobOn
  : (_isPhone() ? true : localStorage.getItem('htpMob')==='1');

// ── Kastle requestAccounts polyfill ──────────────────────────────────────────
// index.html's selWallet() calls provider.requestAccounts() for ALL wallets.
// Kastle doesn't have requestAccounts — we add it here so the closure works.
(function patchProviders(){
  function patchKastle(){
    if(!window.kastle || typeof window.kastle.requestAccounts === 'function') return;
    window.kastle.requestAccounts = async function(){
      var ok;
      try { ok = await window.kastle.connect(); } catch(e) { throw new Error('Kastle connect: '+e.message); }
      if(ok === false) throw new Error('User denied Kastle connection');
      var acc;
      try { acc = await window.kastle.getAccount(); } catch(e) { throw new Error('Kastle getAccount: '+e.message); }
      if(!acc) throw new Error('Kastle: no account returned');
      var addr = acc.address || (typeof acc === 'string' ? acc : null);
      if(!addr) throw new Error('Kastle: could not read address');
      return [addr];
    };
    // Also polyfill getBalance if missing
    if(typeof window.kastle.getBalance !== 'function'){
      window.kastle.getBalance = async function(){ return {confirmed:0,unconfirmed:0,total:0}; };
    }
  }

  patchKastle();
  setTimeout(patchKastle, 300);
  setTimeout(patchKastle, 1000);
  setTimeout(patchKastle, 2500);
  document.addEventListener('click', function once(){ patchKastle(); document.removeEventListener('click',once,true); }, true);
})();

// ── Install redirect for undetected wallets ───────────────────────────────────
window._htpInstall = function(name){
  var url = (_WL_INSTALL||{})[name]||'';
  var st = document.getElementById('walletStatus');
  if(st){
    st.style.display = 'block';
    st.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px">'+name+' not installed</div>'
      +(url?'<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.3);border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Install '+name+' ↗</a><br><br>':'')
      +'<span style="font-size:11px;color:#475569">Or use Mnemonic / Hex Key below.</span>';
  }
  if(url) window.open(url,'_blank');
};

// ── Network selector ──────────────────────────────────────────────────────────
window._htpSetConnectNet = function(sid, net){
  window.activeNet = net;
  if(typeof window.htpSetNetwork==='function') window.htpSetNetwork(net);
  document.querySelectorAll('[data-net-sel="'+sid+'"] button').forEach(function(b){
    var on = b.dataset.net === net;
    b.style.cssText = on
      ? 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:#49e8c2;color:#021a10;border:none;transition:all .2s'
      : 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);transition:all .2s';
  });
};

function _mkNetSel(sid){
  var cur = window.activeNet||'tn12';
  var base='flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s;';
  var on=base+'background:#49e8c2;color:#021a10;border:none;';
  var off=base+'background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);';
  return '<div data-net-sel="'+sid+'" style="display:flex;gap:8px;margin-bottom:18px">'
    +'<button data-net="tn12" onclick="window._htpSetConnectNet(\''+sid+'\',\'tn12\')" style="'+(cur==='tn12'?on:off)+'">TN12 Testnet</button>'
    +'<button data-net="mainnet" onclick="window._htpSetConnectNet(\''+sid+'\',\'mainnet\')" style="'+(cur==='mainnet'?on:off)+'">Mainnet</button>'
    +'</div>';
}

function _injectNetSels(){
  var mn=document.getElementById('recMn');
  if(mn&&!document.querySelector('[data-net-sel="ns-mn"]')){
    var d=document.createElement('div'); d.innerHTML=_mkNetSel('ns-mn');
    var t=(mn.closest&&mn.closest('.fg'))||mn.parentNode;
    if(t&&t.parentNode) t.parentNode.insertBefore(d.firstElementChild,t);
  }
  var hx=document.getElementById('recHexKey');
  if(hx&&!document.querySelector('[data-net-sel="ns-hx"]')){
    var d2=document.createElement('div'); d2.innerHTML=_mkNetSel('ns-hx');
    var t2=(hx.closest&&hx.closest('.fg'))||hx.parentNode;
    if(t2&&t2.parentNode) t2.parentNode.insertBefore(d2.firstElementChild,t2);
  }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
(function(){
  var sid='wl14-styles';
  if(document.getElementById(sid)) return;
  var s=document.createElement('style');
  s.id=sid;
  s.textContent=[
    '@keyframes wlPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}',
    '#wlWrap{background:rgba(255,255,255,.025);border:1px solid rgba(73,232,194,.1);border-radius:20px;padding:24px;margin-bottom:20px;backdrop-filter:blur(12px);}',
    '.wlHdr{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;}',
    '.wlHdr-title{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#49e8c2;white-space:nowrap;}',
    '.wlHdr-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(73,232,194,.25) 0%,transparent 100%);min-width:20px;}',
    '.wlHdr-hint{font-size:10px;color:#475569;letter-spacing:.05em;white-space:nowrap;}',
    '#htpMobToggle{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border:1px solid rgba(73,232,194,.25);color:#49e8c2;background:rgba(73,232,194,.06);white-space:nowrap;transition:all .2s;flex-shrink:0;}',
    '#htpMobToggle:hover{background:rgba(73,232,194,.15);border-color:rgba(73,232,194,.45);}',
    '#htpMobToggle.mob-on{background:rgba(73,232,194,.2);border-color:#49e8c2;box-shadow:0 0 12px rgba(73,232,194,.3);}',
    '#wlGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}',
    '@media(min-width:480px){#wlGrid{grid-template-columns:repeat(4,1fr)!important;}}',
    '.wlCard{position:relative;border-radius:16px;padding:18px 10px 14px;text-align:center;overflow:hidden;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s;}',
    '.wlCard:hover{transform:translateY(-3px) scale(1.01)!important;box-shadow:0 16px 40px rgba(0,0,0,.6)!important;opacity:1!important;}',
    '.wlCard-on{background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.4);}',
    '.wlCard-off{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.07);opacity:.72;}',
    '.wlCard-dot{position:absolute;top:9px;right:9px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 8px #49e8c2;animation:wlPulse 2s ease-in-out infinite;}',
    '.wlCard-logo{width:52px;height:52px;margin:0 auto 11px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);}',
    '.wlCard-logo img{width:100%;height:100%;object-fit:cover;border-radius:12px;}',
    '.wlCard-name{font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:3px;letter-spacing:.01em;}',
    '.wlCard-sub{font-size:9.5px;font-weight:600;margin-bottom:11px;}',
    '.wlCard-btn{width:100%;padding:8px 4px;border-radius:10px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;}',
    '.wlCard-btn-on{background:#49e8c2;color:#021a10;border:none;}',
    '.wlCard-btn-on:hover{background:#6fffd8;}',
    '.wlCard-btn-off{background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.22);}',
    '.wlCard-btn-off:hover{background:rgba(73,232,194,.13);}',
    '#walletStatus{margin-top:16px;padding:16px 18px;border-radius:14px;border:1px solid rgba(73,232,194,.12);background:rgba(4,12,28,.7);font-size:13px;backdrop-filter:blur(8px);display:none;}',
    '.w-sec{background:rgba(255,255,255,.022)!important;border:1px solid rgba(73,232,194,.1)!important;border-radius:16px!important;padding:22px!important;margin-bottom:16px!important;backdrop-filter:blur(8px)!important;}',
    '.w-sec:hover{border-color:rgba(73,232,194,.2)!important;}'
  ].join('\n');
  document.head.appendChild(s);
})();

// ── Card builder ──────────────────────────────────────────────────────────────
// Detected wallets → call index.html closure's selWallet() directly
// Undetected wallets → show install link via _htpInstall()
function _buildCard(w){
  var found=w.detect();
  var logo=_WL_LOGOS[w.id]||'';
  var dot=found?'<div class="wlCard-dot"></div>':'';
  var sub=found?'<span style="color:#49e8c2">Detected</span>':('<span style="color:#64748b">'+w.sub+'</span>');
  var cls='wlCard '+(found?'wlCard-on':'wlCard-off');
  var bCls='wlCard-btn '+(found?'wlCard-btn-on':'wlCard-btn-off');
  var bTxt=found?'Connect':'Install';
  // IMPORTANT: calls window.selWallet which IS the index.html closure version at runtime
  // (logos.js no longer overrides window.selWallet)
  var act=found?'window.selWallet(\''+w.id+'\')':'window._htpInstall(\''+w.id+'\')';
  return '<div class="'+cls+'">'
    +dot
    +'<div class="wlCard-logo"><img src="'+logo+'" alt="'+w.name+'" onerror="this.style.display=\'none\'"></div>'
    +'<div class="wlCard-name">'+w.name+'</div>'
    +'<div class="wlCard-sub">'+sub+'</div>'
    +'<button class="'+bCls+'" onclick="'+act+'">'+bTxt+'</button>'
    +'</div>';
}

// ── Mobile toggle ─────────────────────────────────────────────────────────────
function _applyMob(){
  var on=window._htpMobOn;
  var ms=document.getElementById('htpMobStyle');
  if(!ms){ms=document.createElement('style');ms.id='htpMobStyle';document.head.appendChild(ms);}
  if(on){
    ms.textContent=[
      'html,body{overflow-x:hidden!important;}',
      '#app,body>*:not(#htpMobStyle){max-width:390px!important;margin-left:auto!important;margin-right:auto!important;}',
      'body{background:#000!important;}'
    ].join('');
    var app=document.getElementById('app');
    if(app){app.style.maxWidth='390px';app.style.margin='0 auto';app.style.boxShadow='0 0 80px rgba(0,0,0,.9)';}
  }else{
    ms.textContent='';
    var app2=document.getElementById('app');
    if(app2){app2.style.maxWidth='';app2.style.margin='';app2.style.boxShadow='';}
  }
  localStorage.setItem('htpMob',on?'1':'0');
  var btn=document.getElementById('htpMobToggle');
  if(btn){
    btn.textContent=on?'Mobile On':'Mobile';
    if(on) btn.classList.add('mob-on'); else btn.classList.remove('mob-on');
  }
  if(typeof window._wlRefresh==='function') setTimeout(window._wlRefresh,60);
}

window._htpToggleMob=function(){
  window._htpMobOn=!window._htpMobOn;
  _applyMob();
};

// ── Main wallet section builder ───────────────────────────────────────────────
(function buildWalletPage(){

  function getWallets(){
    return (window._htpMobOn||_isPhone()) ? _WL_DESKTOP.concat(_WL_MOBILE) : _WL_DESKTOP;
  }

  function run(){
    var sec=document.getElementById('v-wallet');
    if(!sec) return;

    // If wlWrap already exists, just refresh the grid
    var wrap=document.getElementById('wlWrap');
    if(wrap){
      var grid=document.getElementById('wlGrid');
      if(grid) grid.innerHTML=getWallets().map(_buildCard).join('');
      _injectNetSels();
      _applyMob();
      return;
    }

    // Build fresh wlWrap
    wrap=document.createElement('div');
    wrap.id='wlWrap';
    wrap.innerHTML=
      '<div class="wlHdr">'
      +'<span class="wlHdr-title">Choose Wallet</span>'
      +'<div class="wlHdr-line"></div>'
      +'<button id="htpMobToggle" onclick="window._htpToggleMob()">Mobile</button>'
      +'<span class="wlHdr-hint">Click to connect &middot; Mnemonic &amp; Key below</span>'
      +'</div>'
      +'<div id="wlGrid">'+getWallets().map(_buildCard).join('')+'</div>';

    // Replace the existing .w-grid or insert before .sh sibling
    var mx=sec.querySelector('.mx')||sec;
    var old=sec.querySelector('.w-grid');
    if(old){
      // Move walletStatus div outside old grid first
      var wst=document.getElementById('walletStatus');
      old.parentNode.insertBefore(wrap, old);
      old.remove();
      // Re-attach walletStatus after wlWrap
      if(wst) wrap.parentNode.insertBefore(wst, wrap.nextSibling);
    } else {
      var sh=mx.querySelector('.sh');
      mx.insertBefore(wrap, sh?sh.nextSibling:mx.firstChild);
    }

    // Remove duplicate walletStatus elements
    var allSt=sec.querySelectorAll('#walletStatus');
    allSt.forEach(function(el,i){if(i>0) el.remove();});

    _injectNetSels();
    _applyMob();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();

  // Re-run when wallet view is navigated to
  var _go=window.go;
  if(typeof _go==='function'&&!_go._wl14){
    window.go=function(v){
      _go(v);
      if(v==='wallet') setTimeout(run,200);
    };
    window.go._wl14=true;
  }
  window.addEventListener('htp:view:wallet',function(){setTimeout(run,200);});
  window._wlRefresh=run;

})();
