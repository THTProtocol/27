/** htp-wallet-logos.js — v17.0
 * KEY FIXES:
 * 1. Patch waitForProvider in index.html to retry 60x500ms (30s) instead of 20x150ms
 * 2. Cards use direct onclick="selWallet(...)" just like the original .w-card HTML
 * 3. No pointer-events:none on buttons — buttons have full onclick handlers
 * 4. Kastle polyfill applied earlier and more aggressively
 * 5. KSPR removed
 */

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
  {id:'KasWare', name:'KasWare', sub:'Chrome \u00b7 Firefox',detect:function(){return !!(window.kasware||window.kasWare);}},
  {id:'Kastle',  name:'Kastle',  sub:'Chrome',           detect:function(){return !!window.kastle;}},
  {id:'Kasperia',name:'Kasperia',sub:'Chrome',           detect:function(){return !!window.kasperia;}},
  {id:'OKX',     name:'OKX',     sub:'Chrome \u00b7 Mobile',  detect:function(){return !!(window.okxwallet&&window.okxwallet.kaspa);}},
  {id:'KaspaCom',name:'KaspaCom',sub:'Web \u00b7 Mobile',     detect:function(){return !!(window.kaspacom||(window.kaspa&&typeof window.kaspa.connect==='function'));}}
];

// ── Mobile-only apps ────────────────────────────────────────────────────────────
var _WL_MOBILE=[
  {id:'Kasanova',name:'Kasanova',sub:'iOS \u00b7 Android',         detect:function(){return !!(window.kasanova&&window.kasanova.kasware);}},
  {id:'Kaspium', name:'Kaspium', sub:'iOS \u00b7 Android',         detect:function(){return !!(window.kaspium||window.KaspiumWallet);}},
  {id:'Tangem',  name:'Tangem',  sub:'iOS \u00b7 Android (NFC)',   detect:function(){return !!(window.tangem||window.tangemWallet);}}
];

function _isPhone(){return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);}
window._htpMobOn=window._htpMobOn!==undefined?window._htpMobOn:(_isPhone()?true:localStorage.getItem('htpMob')==='1');

// ── PATCH waitForProvider to be much more patient (60 retries x 500ms = 30s) ───
// index.html's original is only 20x150ms = 3 seconds which is not enough for Kastle.
(function patchWaitForProvider(){
  // We replace it after DOMContentLoaded so index.html's version is already defined
  function install(){
    if(typeof waitForProvider==='function'&&!waitForProvider._wl17patched){
      var _orig=waitForProvider;
      // Redefine on window so the inline script's call uses the patched version
      window.waitForProvider=async function(name){
        // Try fast path first (20x150ms like original)
        var fast=await _orig(name);
        if(fast) return fast;
        // Slow path: keep trying for 30s more (60x500ms)
        for(var i=0;i<60;i++){
          var p=typeof getProvider==='function'?getProvider(name):null;
          if(p) return p;
          await new Promise(function(r){setTimeout(r,500);});
        }
        return null;
      };
      window.waitForProvider._wl17patched=true;
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install);
  }else{
    install();
  }
  // Also try after a tick in case index.html defines it after us
  setTimeout(install,500);
  setTimeout(install,1500);
})();

// ── Kastle polyfill ─────────────────────────────────────────────────────────────
(function(){
  function patch(){
    if(!window.kastle) return;
    if(typeof window.kastle.requestAccounts==='function') return; // already has it
    window.kastle.requestAccounts=async function(){
      try{await window.kastle.connect();}catch(e){
        // connect() may throw even on success if already connected
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
  // Patch immediately and on intervals until kastle is available
  patch();
  var _pt=setInterval(function(){
    patch();
    if(window.kastle&&typeof window.kastle.requestAccounts==='function') clearInterval(_pt);
  },200);
  setTimeout(function(){clearInterval(_pt);},15000);
  document.addEventListener('click',function o(){patch();document.removeEventListener('click',o,true);},true);
})();

// ── Direct connect function ─────────────────────────────────────────────────────
// Called by onclick on each card button directly — no delegation needed.
window._htpConnect=function(name){
  // selWallet is a plain global function in index.html (non-IIFE script block)
  if(typeof selWallet==='function'){
    selWallet(name);
    return;
  }
  // Fallback: wait up to 3s for selWallet to be defined
  var tries=0;
  var t=setInterval(function(){
    if(++tries>30){clearInterval(t);return;}
    if(typeof selWallet==='function'){
      clearInterval(t);
      selWallet(name);
    }
  },100);
};

// ── Install handler ─────────────────────────────────────────────────────────────
window._htpInstall=function(n){
  var url=(_WL_INSTALL||{})[n]||'';
  var st=document.getElementById('walletStatus');
  if(st){
    st.style.display='block';
    st.innerHTML=
      '<div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:8px">'+n+' not installed</div>'
      +(url?'<a href="'+url+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.3);border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Install '+n+' \u2197</a><br><br>':'')
      +'<span style="font-size:11px;color:#475569">Or use Mnemonic / Hex Key below.</span>';
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

// ── CSS ─────────────────────────────────────────────────────────────────────────
(function(){
  if(document.getElementById('wl17-styles')) return;
  var s=document.createElement('style'); s.id='wl17-styles';
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
    // Card: cursor pointer, no overflow hidden so hover glow works
    '.wlCard{position:relative;border-radius:16px;padding:18px 10px 14px;text-align:center;cursor:pointer;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s;}',
    '.wlCard:hover{transform:translateY(-3px) scale(1.02)!important;box-shadow:0 16px 40px rgba(0,0,0,.6)!important;opacity:1!important;}',
    '.wlCard-on{background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.4);}',
    '.wlCard-off{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.07);opacity:.75;}',
    '.wlCard-dot{position:absolute;top:9px;right:9px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 8px #49e8c2;animation:wlPulse 2s ease-in-out infinite;}',
    '.wlCard-logo{width:52px;height:52px;margin:0 auto 11px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);pointer-events:none;}',
    '.wlCard-logo img{width:100%;height:100%;object-fit:cover;border-radius:12px;pointer-events:none;}',
    '.wlCard-name{font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:3px;letter-spacing:.01em;pointer-events:none;}',
    '.wlCard-sub{font-size:9.5px;font-weight:600;margin-bottom:11px;pointer-events:none;}',
    // Button: full pointer-events, its own onclick does the work
    '.wlCard-btn{width:100%;padding:8px 4px;border-radius:10px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;border:none;}',
    '.wlCard-btn-on{background:#49e8c2;color:#021a10;}',
    '.wlCard-btn-on:hover{background:#6fffd8;}',
    '.wlCard-btn-off{background:rgba(73,232,194,.06);color:#49e8c2;border:1px solid rgba(73,232,194,.22)!important;}',
    '.wlCard-btn-off:hover{background:rgba(73,232,194,.13);}',
    '#walletStatus{margin-top:16px;padding:16px 18px;border-radius:14px;border:1px solid rgba(73,232,194,.12);background:rgba(4,12,28,.7);font-size:13px;backdrop-filter:blur(8px);display:none;}'
  ].join('\n');
  document.head.appendChild(s);
})();

// ── Card builder — uses direct onclick just like original .w-card HTML ───────────
function _buildCard(w){
  var found=w.detect();
  var logo=_WL_LOGOS[w.id]||'';
  var dot=found?'<div class="wlCard-dot"></div>':'';
  var sub=found?'<span style="color:#49e8c2">Detected</span>':'<span style="color:#64748b">'+w.sub+'</span>';
  var cls='wlCard '+(found?'wlCard-on':'wlCard-off');
  var bCls='wlCard-btn '+(found?'wlCard-btn-on':'wlCard-btn-off');
  var bTxt=found?'Connect':'Install \u2197';
  // Use direct onclick on both the card AND the button — belt and suspenders
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

// ── Mobile toggle ───────────────────────────────────────────────────────────────
function _applyMob(){
  var on=window._htpMobOn;
  var ms=document.getElementById('htpMobStyle');
  if(!ms){ms=document.createElement('style');ms.id='htpMobStyle';document.head.appendChild(ms);}
  if(on){
    ms.textContent='html,body{overflow-x:hidden!important;}#app{max-width:390px!important;margin:0 auto!important;box-shadow:0 0 80px rgba(0,0,0,.9)!important;}body{background:#000!important;}';
  }else{
    ms.textContent='';
    var a=document.getElementById('app');
    if(a){a.style.maxWidth='';a.style.margin='';a.style.boxShadow='';}
  }
  localStorage.setItem('htpMob',on?'1':'0');
  var btn=document.getElementById('htpMobToggle');
  if(btn){
    btn.textContent=on?'\uD83D\uDCF1 Mobile On':'\uD83D\uDCF1 Mobile';
    btn.classList.toggle('mob-on',on);
  }
  if(typeof window._wlRefresh==='function') setTimeout(window._wlRefresh,60);
}
window._htpToggleMob=function(){window._htpMobOn=!window._htpMobOn;_applyMob();};

// ── Main builder ────────────────────────────────────────────────────────────────
(function(){
  function getW(){return(window._htpMobOn||_isPhone())?_WL_MOBILE.concat(_WL_DESKTOP):_WL_DESKTOP;}

  function run(){
    var sec=document.getElementById('v-wallet');
    if(!sec) return;

    var wrap=document.getElementById('wlWrap');
    if(wrap){
      var g=document.getElementById('wlGrid');
      if(g) g.innerHTML=getW().map(_buildCard).join('');
      _injectNetSels(); _applyMob();
      return;
    }

    wrap=document.createElement('div'); wrap.id='wlWrap';
    wrap.innerHTML=
      '<div class="wlHdr">'
      +'<span class="wlHdr-title">Choose Wallet</span>'
      +'<div class="wlHdr-line"></div>'
      +'<button id="htpMobToggle" onclick="window._htpToggleMob()">\uD83D\uDCF1 Mobile</button>'
      +'<span class="wlHdr-hint">Click to connect \u00b7 Mnemonic &amp; Key below</span>'
      +'</div>'
      +'<div id="wlGrid">'+getW().map(_buildCard).join('')+'</div>';

    var old=sec.querySelector('.w-grid');
    if(old){
      var wst=document.getElementById('walletStatus');
      old.parentNode.insertBefore(wrap,old); old.remove();
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
  if(typeof _g==='function'&&!_g._wl17){
    window.go=function(v){_g(v); if(v==='wallet') setTimeout(run,200);};
    window.go._wl17=true;
  }
  window.addEventListener('htp:view:wallet',function(){setTimeout(run,200);});
  window._wlRefresh=run;
})();
