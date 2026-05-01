/** htp-wallet-logos.js — v18.0
 * FIXES:
 * 1. Injects htp-mobile.css for full site mobile responsive + hover twitch fix
 * 2. Mobile toggle uses html.htp-mob-preview class (clean, no inline style hacks)
 * 3. waitForProvider patched to 30s retry
 * 4. Direct onclick handlers on cards — no delegation
 * 5. Kastle requestAccounts polyfill
 */

// ── Inject htp-mobile.css ──────────────────────────────────────────────────────
(function(){
  if(document.getElementById('htp-mobile-css')) return;
  var l=document.createElement('link');
  l.id='htp-mobile-css';
  l.rel='stylesheet';
  l.href='htp-mobile.css?v=18';
  document.head.appendChild(l);
})();

// ── LOGOS ──────────────────────────────────────────────────────────────────────
var _WL_LOGOS={
  KasWare: 'https://lh3.googleusercontent.com/GWR2Bode3QAzDrsZJHVRsYhCN60azRCtL1xoOBxqCYcDpbMD_avwiFkuiAOAkuyLnEh9DGOAoZSbWDcNUhiZ7X6RZE8=s128',
  Kastle:  'https://lh3.googleusercontent.com/byDg7ykj9UUJRur0v8jFr9orcj7N1_M6LuqtwnJxlnVNk4GV0JrhFmS0Xp0U9QRgxGZa4wf7-8M29v7kfEBc-Ha9kg=s128',
  Kasperia:'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128',
  OKX:     'https://lh3.googleusercontent.com/2bBevW79q6gRZTFdm42CzUetuEKndq4fn41HQGknMpKMF_d-Ae2sJJzgfFUAVb1bJKCBb4ptZ9EAPp-QhWYIvc35yw=s128',
  Kasanova:'https://kasanova.app/favicon.ico',
  Kaspium: 'https://kaspium.io/favicon.ico',
  KaspaCom:'https://wallet.kaspa.com/favicon.ico',
  Tangem:  'https://tangem.com/favicon.ico'
};

// ── Install URLs ────────────────────────────────────────────────────────────────
var _WL_INSTALL={
  KasWare: 'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  Kastle:  'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  Kasperia:'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob',
  OKX:     'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge',
  Kasanova:'https://kasanova.app',
  Kaspium: 'https://kaspium.io',
  KaspaCom:'https://wallet.kaspa.com',
  Tangem:  'https://tangem.com/kaspa'
};

// ── Desktop wallet list ─────────────────────────────────────────────────────────
var _WL_DESKTOP=[
  {id:'KasWare', name:'KasWare', sub:'Chrome · Firefox', detect:function(){return !!(window.kasware||window.kasWare);}},
  {id:'Kastle',  name:'Kastle',  sub:'Chrome',            detect:function(){return !!window.kastle;}},
  {id:'Kasperia',name:'Kasperia',sub:'Chrome',            detect:function(){return !!window.kasperia;}},
  {id:'OKX',     name:'OKX',     sub:'Chrome · Mobile',   detect:function(){return !!(window.okxwallet&&window.okxwallet.kaspa);}},
  {id:'KaspaCom',name:'KaspaCom',sub:'Web · Mobile',      detect:function(){return !!(window.kaspacom||(window.kaspa&&typeof window.kaspa.connect==='function'));}}
];

// ── Mobile-only wallet list ─────────────────────────────────────────────────────
var _WL_MOBILE=[
  {id:'Kasanova',name:'Kasanova',sub:'iOS · Android',       detect:function(){return !!(window.kasanova&&window.kasanova.kasware);}},
  {id:'Kaspium', name:'Kaspium', sub:'iOS · Android',       detect:function(){return !!(window.kaspium||window.KaspiumWallet);}},
  {id:'OKX',     name:'OKX',     sub:'Mobile App',           detect:function(){return !!(window.okxwallet&&window.okxwallet.kaspa);}},
  {id:'Tangem',  name:'Tangem',  sub:'iOS · Android (NFC)', detect:function(){return !!(window.tangem||window.tangemWallet);}},
  {id:'KaspaCom',name:'KaspaCom',sub:'Web · Mobile',        detect:function(){return !!(window.kaspacom||(window.kaspa&&typeof window.kaspa.connect==='function'));}}
];

function _isPhone(){return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);}

// Persist mobile preview preference; auto-on for real phones
if(window._htpMobOn===undefined){
  window._htpMobOn=_isPhone()?true:(localStorage.getItem('htpMob')==='1');
}

// ── PATCH waitForProvider (60x500ms = 30s) ─────────────────────────────────────
(function patchWFP(){
  function install(){
    if(typeof waitForProvider==='function'&&!waitForProvider._v18){
      var _orig=waitForProvider;
      window.waitForProvider=async function(name){
        var fast=await _orig(name);
        if(fast) return fast;
        for(var i=0;i<60;i++){
          var p=typeof getProvider==='function'?getProvider(name):null;
          if(p) return p;
          await new Promise(function(r){setTimeout(r,500);});
        }
        return null;
      };
      window.waitForProvider._v18=true;
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install);
  else install();
  setTimeout(install,500);
  setTimeout(install,1500);
})();

// ── Kastle polyfill ─────────────────────────────────────────────────────────────
(function(){
  function patch(){
    if(!window.kastle||typeof window.kastle.requestAccounts==='function') return;
    window.kastle.requestAccounts=async function(){
      try{await window.kastle.connect();}catch(e){
        if(!/already|connected/i.test(e.message)) throw new Error('Kastle: '+e.message);
      }
      var a=await window.kastle.getAccount();
      if(!a) throw new Error('Kastle: no account returned');
      var addr=a.address||(typeof a==='string'?a:null);
      if(!addr) throw new Error('Kastle: could not get address');
      return[addr];
    };
    if(typeof window.kastle.getBalance!=='function')
      window.kastle.getBalance=async function(){return{confirmed:0,unconfirmed:0,total:0};};
    if(typeof window.kastle.getNetwork!=='function')
      window.kastle.getNetwork=async function(){return'testnet-12';};
  }
  patch();
  var _pt=setInterval(function(){
    patch();
    if(window.kastle&&typeof window.kastle.requestAccounts==='function') clearInterval(_pt);
  },200);
  setTimeout(function(){clearInterval(_pt);},15000);
  document.addEventListener('click',function o(){patch();document.removeEventListener('click',o,true);},true);
})();

// ── Connect / Install handlers ─────────────────────────────────────────────────
window._htpConnect=function(name){
  if(typeof selWallet==='function'){selWallet(name);return;}
  var tries=0,t=setInterval(function(){
    if(++tries>30){clearInterval(t);return;}
    if(typeof selWallet==='function'){clearInterval(t);selWallet(name);}
  },100);
};

window._htpInstall=function(n){
  var url=(_WL_INSTALL||{})[n]||'';
  var st=document.getElementById('walletStatus');
  if(st){
    st.style.display='block';
    st.innerHTML=
      '<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px">'+n+' not installed</div>'
      +(url?'<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.3);border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Install '+n+' ↗</a><br><br>':'')
      +'<span style="font-size:11px;color:#475569">Or connect via Mnemonic / Hex Key below.</span>';
  }
  if(url) window.open(url,'_blank');
};

// ── Network selector ────────────────────────────────────────────────────────────
window._htpSetConnectNet=function(sid,net){
  window.activeNet=net;
  if(typeof window.htpSetNetwork==='function') window.htpSetNetwork(net);
  document.querySelectorAll('[data-net-sel="'+sid+'"] button').forEach(function(b){
    var on=b.dataset.net===net;
    b.style.cssText=on
      ?'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:#49e8c2;color:#021a10;border:none;transition:all .2s'
      :'flex:1;padding:10px 0;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);transition:all .2s';
  });
};

function _mkNetSel(sid){
  var cur=window.activeNet||'tn12';
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

// ── CSS (card styles only — layout/mobile now in htp-mobile.css) ───────────────
(function(){
  if(document.getElementById('wl18-styles')) return;
  var s=document.createElement('style'); s.id='wl18-styles';
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
    '@media(min-width:480px){#wlGrid{grid-template-columns:repeat(3,1fr)!important;}}',
    '@media(min-width:900px){#wlGrid{grid-template-columns:repeat(5,1fr)!important;}}',
    /* Card — NO bounce easing, smooth ease-out only */
    '.wlCard{position:relative;border-radius:16px;padding:18px 10px 14px;text-align:center;cursor:pointer;transition:transform .18s ease-out,box-shadow .18s ease-out,opacity .18s ease-out;will-change:transform;backface-visibility:hidden;}',
    '.wlCard:hover{transform:translateY(-4px)!important;box-shadow:0 14px 36px rgba(0,0,0,.55)!important;opacity:1!important;}',
    '.wlCard-on{background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.4);}',
    '.wlCard-off{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.07);opacity:.75;}',
    '.wlCard-dot{position:absolute;top:9px;right:9px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 8px #49e8c2;animation:wlPulse 2s ease-in-out infinite;}',
    '.wlCard-logo{width:52px;height:52px;margin:0 auto 11px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);pointer-events:none;}',
    '.wlCard-logo img{width:100%;height:100%;object-fit:cover;border-radius:12px;pointer-events:none;}',
    '.wlCard-name{font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:3px;letter-spacing:.01em;pointer-events:none;}',
    '.wlCard-sub{font-size:9.5px;font-weight:600;margin-bottom:11px;pointer-events:none;}',
    '.wlCard-btn{width:100%;padding:8px 4px;border-radius:10px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;border:none;}',
    '.wlCard-btn-on{background:#49e8c2;color:#021a10;}',
    '.wlCard-btn-on:hover{background:#6fffd8;}',
    '.wlCard-btn-off{background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.22)!important;}',
    '.wlCard-btn-off:hover{background:rgba(73,232,194,.13);}',
    '#walletStatus{margin-top:16px;padding:16px 18px;border-radius:14px;border:1px solid rgba(73,232,194,.12);background:rgba(4,12,28,.7);font-size:13px;backdrop-filter:blur(8px);display:none;}'
  ].join('\n');
  document.head.appendChild(s);
})();

// ── Card builder ────────────────────────────────────────────────────────────────
function _buildCard(w){
  var found=w.detect();
  var logo=_WL_LOGOS[w.id]||'';
  var dot=found?'<div class="wlCard-dot"></div>':'';
  var sub=found?'<span style="color:#49e8c2">Detected</span>':'<span style="color:#64748b">'+w.sub+'</span>';
  var cls='wlCard '+(found?'wlCard-on':'wlCard-off');
  var bCls='wlCard-btn '+(found?'wlCard-btn-on':'wlCard-btn-off');
  var bTxt=found?'Connect':'Install ↗';
  var action=found
    ?'window._htpConnect(\''+w.id+'\')'
    :'window._htpInstall(\''+w.id+'\')';
  return '<div class="'+cls+'" onclick="'+action+'">'
    +dot
    +'<div class="wlCard-logo"><img src="'+logo+'" alt="'+w.name+'" onerror="this.style.display=\'none\'"></div>'
    +'<div class="wlCard-name">'+w.name+'</div>'
    +'<div class="wlCard-sub">'+sub+'</div>'
    +'<button class="'+bCls+'" onclick="event.stopPropagation();'+action+'">'+bTxt+'</button>'
    +'</div>';
}

// ── Mobile toggle (uses html class — matches htp-mobile.css) ───────────────────
function _applyMob(){
  var on=window._htpMobOn;
  if(on){
    document.documentElement.classList.add('htp-mob-preview');
  }else{
    document.documentElement.classList.remove('htp-mob-preview');
  }
  localStorage.setItem('htpMob',on?'1':'0');
  var btn=document.getElementById('htpMobToggle');
  if(btn){
    btn.textContent=on?'📱 Mobile On':'📱 Mobile Preview';
    btn.classList.toggle('mob-on',on);
  }
  // Re-render wallet grid so mobile/desktop list switches
  if(typeof window._wlRefresh==='function') setTimeout(window._wlRefresh,60);
}
window._htpToggleMob=function(){window._htpMobOn=!window._htpMobOn;_applyMob();};

// Auto-apply on real phones immediately
if(_isPhone()&&!document.documentElement.classList.contains('htp-mob-preview')){
  document.documentElement.classList.add('htp-mob-preview');
}

// ── Main builder ────────────────────────────────────────────────────────────────
(function(){
  function getW(){
    return(window._htpMobOn||_isPhone())?_WL_MOBILE.concat(_WL_DESKTOP):_WL_DESKTOP;
  }

  function run(){
    var sec=document.getElementById('v-wallet');
    if(!sec) return;

    var wrap=document.getElementById('wlWrap');
    if(wrap){
      var g=document.getElementById('wlGrid');
      if(g) g.innerHTML=getW().map(_buildCard).join('');
      _injectNetSels();
      _applyMob();
      return;
    }

    wrap=document.createElement('div'); wrap.id='wlWrap';
    wrap.innerHTML=
      '<div class="wlHdr">'
      +'<span class="wlHdr-title">Choose Wallet</span>'
      +'<div class="wlHdr-line"></div>'
      +'<button id="htpMobToggle" onclick="window._htpToggleMob()">&#x1F4F1; Mobile Preview</button>'
      +'<span class="wlHdr-hint">Click to connect &middot; Mnemonic &amp; Key below</span>'
      +'</div>'
      +'<div id="wlGrid">'+getW().map(_buildCard).join('')+'</div>';

    var old=sec.querySelector('.w-grid');
    if(old){
      var wst=document.getElementById('walletStatus');
      old.parentNode.insertBefore(wrap,old);
      old.remove();
      if(wst) wrap.parentNode.insertBefore(wst,wrap.nextSibling);
    }else{
      var mx=sec.querySelector('.mx')||sec;
      var sh=mx.querySelector('.sh');
      mx.insertBefore(wrap,sh?sh.nextSibling:mx.firstChild);
    }

    sec.querySelectorAll('#walletStatus').forEach(function(el,i){if(i>0)el.remove();});
    _injectNetSels();
    _applyMob();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();

  var _g=window.go;
  if(typeof _g==='function'&&!_g._v18){
    window.go=function(v){_g(v);if(v==='wallet') setTimeout(run,200);};
    window.go._v18=true;
  }
  window.addEventListener('htp:view:wallet',function(){setTimeout(run,200);});
  window._wlRefresh=run;
})();
