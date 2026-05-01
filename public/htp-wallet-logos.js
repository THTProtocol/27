/**
 * htp-wallet-logos.js — v10.0
 * - REAL logos from Chrome Web Store (lh3.googleusercontent.com)
 * - Desktop: only shows Chrome/browser wallets (KasWare, Kastle, Kasperia, OKX)
 * - Mobile-only wallets (Kasanova, Kaspium, KaspaCom) hidden on desktop, shown in mobile view
 * - Network selector injected ONCE per section (data-net-sel guard)
 * - Mobile toggle button + auto-detect real phone
 */

// ─── Real logo URLs ───────────────────────────────────────────────────────────
var _WL_LOGOS = {
  KasWare:  'https://lh3.googleusercontent.com/GWR2Bode3QAzDrsZJHVRsYhCN60azRCtL1xoOBxqCYcDpbMD_avwiFkuiAOAkuyLnEh9DGOAoZSbWDcNUhiZ7X6RZE8=s128-rj-sc0x00ffffff',
  Kastle:   'https://lh3.googleusercontent.com/byDg7ykj9UUJRur0v8jFr9orcj7N1_M6LuqtwnJxlnVNk4GV0JrhFmS0Xp0U9QRgxGZa4wf7-8M29v7kfEBc-Ha9kg=s128-rj-sc0x00ffffff',
  Kasperia: 'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128-rj-sc0x00ffffff',
  OKX:      'https://lh3.googleusercontent.com/2bBevW79q6gRZTFdm42CzUetuEKndq4fn41HQGknMpKMF_d-Ae2sJJzgfFUAVb1bJKCBb4ptZ9EAPp-QhWYIvc35yw=s128-rj-sc0x00ffffff',
  Kasanova: 'https://kasanova.app/favicon.ico',
  Kaspium:  'https://kaspium.io/favicon.ico',
  KaspaCom: 'https://wallet.kaspa.com/favicon.ico'
};

// ─── Install URLs ─────────────────────────────────────────────────────────────
var _WL_INSTALL = {
  KasWare:  'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  Kastle:   'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  Kasperia: 'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
  OKX:      'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  Kasanova: 'https://kasanova.app',
  Kaspium:  'https://kaspium.io',
  KaspaCom: 'https://wallet.kaspa.com'
};

// Desktop-only wallets (Chrome extensions)
var _WL_DESKTOP = [
  { id:'KasWare',  name:'KasWare',  sub:'Chrome · Firefox', detect:function(){ return !!(window.kasware||window.kasWare); } },
  { id:'Kastle',   name:'Kastle',   sub:'Chrome',           detect:function(){ return !!window.kastle; } },
  { id:'Kasperia', name:'Kasperia', sub:'Chrome',           detect:function(){ return !!window.kasperia; } },
  { id:'OKX',      name:'OKX',      sub:'Chrome · Mobile',  detect:function(){ return !!(window.okxwallet&&window.okxwallet.kaspa); } }
];

// Mobile-only wallets (shown in mobile view / on real phones)
var _WL_MOBILE = [
  { id:'Kasanova', name:'Kasanova', sub:'iOS · Android',  detect:function(){ return !!(window.kasanova||window.KasanovaWallet); } },
  { id:'Kaspium',  name:'Kaspium',  sub:'iOS · Android',  detect:function(){ return !!(window.kaspium||window.KaspiumWallet); } },
  { id:'KaspaCom', name:'KaspaCom', sub:'Web · Mobile',   detect:function(){ return !!(window.kaspacom||(window.kaspa&&window.kaspa.requestAccounts)); } }
];

function _isPhone() { return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); }
function _isMobSim() { return window._htpMobOn === true; }

// ─── Network selector ─────────────────────────────────────────────────────────
window._htpSetConnectNet = function(sid, net) {
  window.activeNet = net;
  if (typeof window.htpSetNetwork === 'function') window.htpSetNetwork(net);
  document.querySelectorAll('[data-net-sel="'+sid+'"] button').forEach(function(b) {
    var on = b.dataset.net === net;
    b.style.cssText = on
      ? 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:#49e8c2;color:#021a10;border:none;transition:all .2s'
      : 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);transition:all .2s';
  });
};

function _mkNetSel(sid) {
  var cur = window.activeNet || 'tn12';
  var base = 'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s;';
  var on  = base+'background:#49e8c2;color:#021a10;border:none;';
  var off = base+'background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);';
  return '<div data-net-sel="'+sid+'" style="display:flex;gap:8px;margin-bottom:18px">'
    +'<button data-net="tn12" onclick="window._htpSetConnectNet(\''+sid+'\',\'tn12\')" style="'+(cur==='tn12'?on:off)+'">TN12 Testnet</button>'
    +'<button data-net="mainnet" onclick="window._htpSetConnectNet(\''+sid+'\',\'mainnet\')" style="'+(cur==='mainnet'?on:off)+'">Mainnet</button>'
    +'</div>';
}

function _injectNetSels() {
  var mn = document.getElementById('recMn');
  if (mn && !document.querySelector('[data-net-sel="ns-mn"]')) {
    var d = document.createElement('div');
    d.innerHTML = _mkNetSel('ns-mn');
    var t = (mn.closest ? mn.closest('.fg') : null) || mn.parentNode;
    t.parentNode.insertBefore(d.firstElementChild, t);
  }
  var hx = document.getElementById('recHexKey');
  if (hx && !document.querySelector('[data-net-sel="ns-hx"]')) {
    var d2 = document.createElement('div');
    d2.innerHTML = _mkNetSel('ns-hx');
    var t2 = (hx.closest ? hx.closest('.fg') : null) || hx.parentNode;
    t2.parentNode.insertBefore(d2.firstElementChild, t2);
  }
}

// ─── selWallet ────────────────────────────────────────────────────────────────
(function(){
  function getProv(name) {
    var w=window;
    switch(name){
      case 'KasWare':  return w.kasware||w.kasWare||null;
      case 'Kastle':   return w.kastle||null;
      case 'Kasperia': return w.kasperia||null;
      case 'OKX':      return (w.okxwallet&&w.okxwallet.kaspa)?w.okxwallet.kaspa:null;
      case 'Kasanova': return w.kasanova||w.KasanovaWallet||null;
      case 'Kaspium':  return w.kaspium||w.KaspiumWallet||null;
      case 'KaspaCom': return w.kaspacom||(w.kaspa&&w.kaspa.requestAccounts?w.kaspa:null)||null;
      default:         return null;
    }
  }
  function exAddr(r){
    if(!r) return null;
    if(Array.isArray(r)) return r[0]||null;
    if(typeof r==='string') return r;
    if(r.address) return r.address;
    if(r.accounts&&r.accounts[0]) return r.accounts[0];
    return null;
  }
  async function doConnect(p){
    if(typeof p.requestAccounts==='function') return exAddr(await p.requestAccounts());
    if(typeof p.connect==='function') return exAddr(await p.connect());
    if(typeof p.enable==='function') return exAddr(await p.enable());
    throw new Error('No connect method found');
  }
  window.selWallet = async function(name){
    var st=document.getElementById('walletStatus');
    function setS(h){if(st){st.style.display='block';st.innerHTML=h;}}
    setS('<span style="color:#94a3b8">Connecting to '+name+'\u2026</span>');
    var p=null;
    for(var i=0;i<20;i++){p=getProv(name);if(p) break; await new Promise(function(r){setTimeout(r,150);});}
    if(!p){
      var url=_WL_INSTALL[name]||'';
      setS('<div style="display:flex;gap:14px;align-items:flex-start">'
        +'<div style="font-size:26px">\uD83D\uDD0C</div>'
        +'<div><div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px">'+name+' not detected</div>'
        +(url?'<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Install the extension, refresh, then connect.</div>'
          +'<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.25);border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Install '+name+' \u2197</a>':'')
        +'<div style="margin-top:10px;font-size:12px;color:#475569">Or use <b style="color:#49e8c2">Mnemonic</b> / <b style="color:#49e8c2">Hex Key</b> below.</div>'
        +'</div></div>');
      return;
    }
    try{
      var addr=await doConnect(p);
      if(!addr) throw new Error('No address returned');
      window.walletAddress=window.htpAddress=window.connectedAddress=addr;
      window.walletProvider=name; window.conn=true;
      var net='unknown'; try{net=await p.getNetwork();}catch(e){}
      try{var bal=await p.getBalance(); window.walletBalance={confirmed:bal.confirmed||bal.mature||0,unconfirmed:bal.unconfirmed||bal.pending||0,total:bal.total||0};}catch(e){window.walletBalance={confirmed:0,unconfirmed:0,total:0};}
      try{window.walletPubKey=await p.getPublicKey();}catch(e){}
      if(typeof window.updateWalletUI==='function') window.updateWalletUI(name,net);
      if(typeof window.startBalancePoller==='function') window.startBalancePoller();
      var dc=document.getElementById('dcBtn'); if(dc) dc.style.display='inline-block';
    }catch(e){
      if(st){st.style.display='block';st.innerHTML='<span style="color:#ef4444">Connection failed: '+(e.message||e)+'</span>';}
      window.conn=false;
    }
  };
})();

// ─── CSS ──────────────────────────────────────────────────────────────────────
(function(){
  if(document.getElementById('wl10-styles')) return;
  var s=document.createElement('style');
  s.id='wl10-styles';
  s.textContent=[
    '@keyframes wlPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}',
    '#wlWrap{background:rgba(255,255,255,.025);border:1px solid rgba(73,232,194,.1);border-radius:20px;padding:24px;margin-bottom:20px;backdrop-filter:blur(12px);}',
    '.wlHdr{display:flex;align-items:center;gap:12px;margin-bottom:20px;}',
    '.wlHdr-title{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#49e8c2;white-space:nowrap;}',
    '.wlHdr-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(73,232,194,.25) 0%,transparent 100%);}',
    '.wlHdr-hint{font-size:10px;color:#475569;letter-spacing:.05em;white-space:nowrap;}',
    '#wlGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}',
    '@media(min-width:480px){#wlGrid{grid-template-columns:repeat(4,1fr)!important;}}',
    '.wlCard{position:relative;border-radius:16px;padding:18px 10px 14px;text-align:center;cursor:pointer;overflow:hidden;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s;}',
    '.wlCard:hover{transform:translateY(-5px) scale(1.02)!important;box-shadow:0 20px 50px rgba(0,0,0,.7)!important;opacity:1!important;}',
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

// ─── Card builder ─────────────────────────────────────────────────────────────
function _buildCard(w) {
  var found = w.detect();
  var url   = _WL_INSTALL[w.id]||'';
  var logo  = _WL_LOGOS[w.id]||'';
  var dot   = found ? '<div class="wlCard-dot"></div>' : '';
  var sub   = found ? '<span style="color:#49e8c2">\u25CF Detected</span>' : w.sub;
  var cls   = 'wlCard '+(found?'wlCard-on':'wlCard-off');
  var bCls  = 'wlCard-btn '+(found?'wlCard-btn-on':'wlCard-btn-off');
  var bTxt  = found ? 'Connect' : 'Install \u2197';
  var act   = found ? 'window.selWallet(\''+w.id+'\')' : 'window.open(\''+url+'\')';
  return '<div class="'+cls+'" onclick="'+act+'">'
    +dot
    +'<div class="wlCard-logo"><img src="'+logo+'" alt="'+w.name+'" onerror="this.style.display=\'none\'"></div>'
    +'<div class="wlCard-name">'+w.name+'</div>'
    +'<div class="wlCard-sub">'+sub+'</div>'
    +'<button class="'+bCls+'" onclick="event.stopPropagation();'+act+'">'+bTxt+'</button>'
    +'</div>';
}

// ─── Main builder ─────────────────────────────────────────────────────────────
(function buildWalletPage(){

  function getWallets() {
    return (_isPhone()||_isMobSim()) ? _WL_DESKTOP.concat(_WL_MOBILE) : _WL_DESKTOP;
  }

  function run() {
    var sec = document.getElementById('v-wallet');
    if (!sec) return;

    var wrap = document.getElementById('wlWrap');
    if (wrap) {
      var grid = document.getElementById('wlGrid');
      if (grid) grid.innerHTML = getWallets().map(_buildCard).join('');
      _injectNetSels();
      return;
    }

    wrap = document.createElement('div');
    wrap.id = 'wlWrap';
    wrap.innerHTML =
      '<div class="wlHdr">'
      +'<span class="wlHdr-title">Choose Wallet</span>'
      +'<div class="wlHdr-line"></div>'
      +'<span class="wlHdr-hint">Click to connect \u00B7 Mnemonic &amp; Key below</span>'
      +'</div>'
      +'<div id="wlGrid">'+getWallets().map(_buildCard).join('')+'</div>'
      +'<div id="walletStatus"></div>';

    var mx = sec.querySelector('.mx')||sec;
    var old = sec.querySelector('.w-grid');
    if (old) {
      old.parentNode.replaceChild(wrap, old);
    } else {
      var sh = mx.querySelector('.sh');
      mx.insertBefore(wrap, sh ? sh.nextSibling : mx.firstChild);
    }
    sec.querySelectorAll('#walletStatus').forEach(function(el,i){if(i>0) el.remove();});
    _injectNetSels();
    _injectMobileToggle();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  var _go=window.go;
  if (typeof _go==='function' && !_go._wl10) {
    window.go=function(v){_go(v); if(v==='wallet') setTimeout(run,180);};
    window.go._wl10=true;
  }
  window.addEventListener('htp:view:wallet', function(){setTimeout(run,180);});

  // Expose refresh for mobile toggle
  window._wlRefresh = run;

})();

// ─── Mobile toggle ────────────────────────────────────────────────────────────
window._htpMobOn = false;

function _injectMobileToggle() {
  if (_isPhone()) { _setMob(true); return; }
  if (document.getElementById('htpMobBtn')) return;
  var btn = document.createElement('button');
  btn.id = 'htpMobBtn';
  btn.textContent = '\uD83D\uDCF1 Mobile';
  btn.title = 'Preview mobile layout';
  btn.style.cssText = 'position:fixed;bottom:72px;right:14px;z-index:9999;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.05em;color:#49e8c2;background:rgba(5,14,30,.88);border:1px solid rgba(73,232,194,.22);cursor:pointer;backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,.5);transition:all .2s';
  btn.onclick = function(){ _setMob(!window._htpMobOn); };
  document.body.appendChild(btn);
  if (localStorage.getItem('htpMob')==='1') _setMob(true);
}

function _setMob(on) {
  window._htpMobOn = on;
  var app = document.getElementById('app')||document.body;
  var ms  = document.getElementById('htpMobStyle');
  if (!ms){ms=document.createElement('style');ms.id='htpMobStyle';document.head.appendChild(ms);}
  if (on) {
    app.style.maxWidth='390px'; app.style.margin='0 auto'; app.style.boxShadow='0 0 0 100vw rgba(0,0,0,.75)';
    ms.textContent='body{overflow-x:hidden!important}#app{max-width:390px!important;margin:0 auto!important}';
    var b=document.getElementById('htpMobBtn'); if(b){b.textContent='\uD83D\uDCBB Desktop';b.style.background='rgba(73,232,194,.13)';}
  } else {
    app.style.maxWidth=''; app.style.margin=''; app.style.boxShadow='';
    ms.textContent='';
    var b2=document.getElementById('htpMobBtn'); if(b2){b2.textContent='\uD83D\uDCF1 Mobile';b2.style.background='rgba(5,14,30,.88)';}
  }
  localStorage.setItem('htpMob', on?'1':'0');
  // Refresh wallet grid to show/hide mobile wallets
  if (typeof window._wlRefresh==='function') setTimeout(window._wlRefresh, 50);
}
