/** htp-wallet-logos.js v19d
 * Fix: mobile button text was empty because _updMobBtn called getElementById
 * before btn was in DOM. Now sets innerHTML directly on the element reference.
 */

// ── Inject htp-mobile.css ────────────────────────────────────────────────
(function(){
  if(document.getElementById('htp-mobile-css')) return;
  var l=document.createElement('link');
  l.id='htp-mobile-css'; l.rel='stylesheet'; l.href='htp-mobile.css?v=19d';
  document.head.appendChild(l);
})();

// ── Logos ────────────────────────────────────────────────────────────
var _WL={
  KasWare:  { logo:'https://lh3.googleusercontent.com/GWR2Bode3QAzDrsZJHVRsYhCN60azRCtL1xoOBxqCYcDpbMD_avwiFkuiAOAkuyLnEh9DGOAoZSbWDcNUhiZ7X6RZE8=s128', install:'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf', sub:'Chrome · Firefox' },
  Kastle:   { logo:'https://lh3.googleusercontent.com/byDg7ykj9UUJRur0v8jFr9orcj7N1_M6LuqtwnJxlnVNk4GV0JrhFmS0Xp0U9QRgxGZa4wf7-8M29v7kfEBc-Ha9kg=s128', install:'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego', sub:'Chrome' },
  Kasperia: { logo:'https://lh3.googleusercontent.com/b08QPuruZqIwLRmpcTrN54hmxY6YEQgVKS4y1s7LAYiIulTlZAaxvsWRUK2SIivLecsxgoCuoH66jNLnQLzjMWXtFr0=s128', install:'https://chromewebstore.google.com/detail/kasperia/ffalcabgggegkejjlknofllbaledgcob', sub:'Chrome' },
  OKX:      { logo:'https://lh3.googleusercontent.com/2bBevW79q6gRZTFdm42CzUetuEKndq4fn41HQGknMpKMF_d-Ae2sJJzgfFUAVb1bJKCBb4ptZ9EAPp-QhWYIvc35yw=s128', install:'https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge', sub:'Chrome · Mobile' },
  Kasanova: { logo:'https://kasanova.app/favicon.ico',     install:'https://kasanova.app',          sub:'iOS · Android' },
  Kaspium:  { logo:'https://kaspium.io/favicon.ico',       install:'https://kaspium.io',            sub:'iOS · Android' },
  KaspaCom: { logo:'https://wallet.kaspa.com/favicon.ico', install:'https://wallet.kaspa.com',      sub:'Web · Mobile'  },
  Tangem:   { logo:'https://tangem.com/favicon.ico',       install:'https://tangem.com/kaspa',      sub:'iOS · Android' }
};

function _det(name){
  var w=window;
  switch(name){
    case 'KasWare':  return !!(w.kasware||w.kasWare);
    case 'Kastle':   return !!w.kastle;
    case 'Kasperia': return !!w.kasperia;
    case 'OKX':      return !!(w.okxwallet&&w.okxwallet.kaspa);
    case 'Kasanova': return !!(w.kasanova&&(w.kasanova.kasware||w.kasanova.requestAccounts));
    case 'Kaspium':  return !!(w.kaspium||w.KaspiumWallet);
    case 'KaspaCom': return !!(w.kaspacom||(w.kaspa&&typeof w.kaspa.connect==='function'));
    case 'Tangem':   return !!(w.tangem||w.tangemWallet);
  }
  return false;
}

var _DESK=['KasWare','Kastle','Kasperia','OKX','KaspaCom'];
var _MOB =['Kasanova','Kaspium','OKX','KaspaCom','Tangem'];

function _isPhone(){return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);}
window._htpMobOn=_isPhone();

// ── Patch waitForProvider to 30s ─────────────────────────────────────────
(function(){
  function ins(){
    if(typeof waitForProvider!=='function'||waitForProvider._v19d) return;
    var orig=waitForProvider;
    window.waitForProvider=async function(name){
      var p=await orig(name); if(p) return p;
      for(var i=0;i<60;i++){
        p=typeof getProvider==='function'?getProvider(name):null;
        if(p) return p;
        await new Promise(function(r){setTimeout(r,500);});
      }
      return null;
    };
    window.waitForProvider._v19d=true;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ins);
  else ins();
  setTimeout(ins,400); setTimeout(ins,1200);
})();

// ── Kastle polyfill ───────────────────────────────────────────────────
(function(){
  function p(){
    if(!window.kastle||typeof window.kastle.requestAccounts==='function') return;
    window.kastle.requestAccounts=async function(){
      try{await window.kastle.connect();}catch(e){
        if(!/already|connected/i.test(e.message)) throw new Error('Kastle: '+e.message);
      }
      var a=await window.kastle.getAccount();
      var addr=(a&&a.address)||(typeof a==='string'?a:null);
      if(!addr) throw new Error('Kastle: no address');
      return [addr];
    };
    if(!window.kastle.getBalance) window.kastle.getBalance=async function(){return{confirmed:0,unconfirmed:0,total:0};};
    if(!window.kastle.getNetwork) window.kastle.getNetwork=async function(){return'testnet-12';};
  }
  p();
  var iv=setInterval(function(){
    p();
    if(window.kastle&&typeof window.kastle.requestAccounts==='function') clearInterval(iv);
  },200);
  setTimeout(function(){clearInterval(iv);},15000);
  document.addEventListener('click',function o(){p();document.removeEventListener('click',o,true);},true);
})();

// ── Connect / Install ──────────────────────────────────────────────────
window._htpConnect=function(name){
  if(typeof selWallet==='function'){selWallet(name);return;}
  var n=0,t=setInterval(function(){
    if(++n>30){clearInterval(t);return;}
    if(typeof selWallet==='function'){clearInterval(t);selWallet(name);}
  },100);
};

window._htpInstall=function(name){
  var url=((_WL[name])||{}).install||'';
  var st=document.getElementById('walletStatus');
  if(st){
    st.style.display='block';
    st.innerHTML='<span style="color:#f1f5f9;font-weight:700">'+name+' not installed.</span>'
      +(url?'<br><br><a href="'+url+'" target="_blank" rel="noopener" '
        +'style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;'
        +'background:rgba(73,232,194,.08);border:1px solid rgba(73,232,194,.3);'
        +'border-radius:10px;color:#49e8c2;font-size:11px;font-weight:800;'
        +'letter-spacing:.06em;text-transform:uppercase;text-decoration:none">'
        +'Install '+name+' &#x2197;</a><br><br>':'')
      +'<span style="font-size:11px;color:#64748b">Or use Mnemonic / Hex Key below.</span>';
  }
  if(url) window.open(url,'_blank');
};

// ── Network selector ─────────────────────────────────────────────────
window._htpSetNet=function(sid,net){
  window.activeNet=net;
  if(typeof window.htpSetNetwork==='function') window.htpSetNetwork(net);
  document.querySelectorAll('[data-ns="'+sid+'"] button').forEach(function(b){
    var on=b.dataset.net===net;
    b.style.cssText=on
      ?'flex:1;padding:9px 0;border-radius:9px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;background:#49e8c2;color:#021a10;border:none'
      :'flex:1;padding:9px 0;border-radius:9px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2)';
  });
};
function _netSel(sid){
  var cur=window.activeNet||'tn12';
  var b='flex:1;padding:9px 0;border-radius:9px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;';
  var on =b+'background:#49e8c2;color:#021a10;border:none;';
  var off=b+'background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2);';
  return '<div data-ns="'+sid+'" style="display:flex;gap:8px;margin-bottom:16px">'
    +'<button data-net="tn12" onclick="window._htpSetNet(\''+sid+'\',\'tn12\')" style="'+(cur==='tn12'?on:off)+'">TN12 Testnet</button>'
    +'<button data-net="mainnet" onclick="window._htpSetNet(\''+sid+'\',\'mainnet\')" style="'+(cur==='mainnet'?on:off)+'">Mainnet</button>'
    +'</div>';
}
function _injectNetSels(){
  [['recMn','ns0'],['recHexKey','ns1']].forEach(function(pair){
    var el=document.getElementById(pair[0]); if(!el) return;
    var sid=pair[1];
    if(document.querySelector('[data-ns="'+sid+'"]')) return;
    var wrap=(el.closest&&el.closest('.fg'))||el.parentNode;
    if(wrap&&wrap.parentNode){
      var d=document.createElement('div'); d.innerHTML=_netSel(sid);
      wrap.parentNode.insertBefore(d.firstElementChild,wrap);
    }
  });
}

// ── CSS ─────────────────────────────────────────────────────────────────
(function(){
  if(document.getElementById('wl19d')) return;
  var s=document.createElement('style'); s.id='wl19d';
  s.textContent=
    '@keyframes wlDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(.75)}}'
    +'#htpMobBtn{display:inline-flex!important;align-items:center;gap:6px;padding:7px 16px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;background:#49e8c2;color:#021a10!important;border:none!important;box-shadow:0 0 14px rgba(73,232,194,.4);transition:background .15s,box-shadow .15s;margin-left:8px;}'
    +'#htpMobBtn:hover{background:#6fffd8;box-shadow:0 0 22px rgba(73,232,194,.7);}'
    +'#htpMobBtn.mob-off{background:rgba(73,232,194,.1)!important;color:#49e8c2!important;border:1px solid rgba(73,232,194,.3)!important;box-shadow:none!important;}'
    +'#htpMobBtn.mob-off:hover{background:rgba(73,232,194,.2)!important;}'
    +'.w-card,.card.w-card{transition:transform .16s ease-out,box-shadow .16s ease-out!important;}'
    +'.w-card:hover,.card.w-card:hover{transform:translateY(-3px)!important;box-shadow:0 10px 28px rgba(0,0,0,.45)!important;}'
    +'#wlWrap{background:rgba(255,255,255,.02);border:1px solid rgba(73,232,194,.1);border-radius:18px;padding:22px;margin-bottom:20px;}'
    +'.wlHdr{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;}'
    +'.wlHdr-ttl{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#49e8c2;}'
    +'.wlHdr-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(73,232,194,.2),transparent);min-width:16px;}'
    +'.wlHdr-hint{font-size:10px;color:#475569;letter-spacing:.04em;}'
    +'#wlGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}'
    +'@media(min-width:540px){#wlGrid{grid-template-columns:repeat(3,1fr)!important;}}'
    +'@media(min-width:900px){#wlGrid{grid-template-columns:repeat(5,1fr)!important;}}'
    +'.wlCard{position:relative;border-radius:14px;padding:18px 10px 14px;text-align:center;cursor:pointer;'
    +'transition:transform .16s ease-out,box-shadow .16s ease-out,opacity .16s ease-out!important;'
    +'-webkit-backface-visibility:hidden;backface-visibility:hidden;will-change:transform;}'
    +'.wlCard:hover{transform:translateY(-3px)!important;box-shadow:0 12px 32px rgba(0,0,0,.5)!important;}'
    +'.wlCard.on{background:rgba(73,232,194,.04);border:1px solid rgba(73,232,194,.35);}'
    +'.wlCard.off{background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.07);opacity:.78;}'
    +'.wlCard.off:hover{opacity:1!important;}'
    +'.wlDot{position:absolute;top:8px;right:8px;width:7px;height:7px;background:#49e8c2;border-radius:50%;box-shadow:0 0 7px #49e8c2;animation:wlDot 2s ease-in-out infinite;}'
    +'.wlLogo{width:50px;height:50px;margin:0 auto 10px;border-radius:13px;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;}'
    +'.wlLogo img{width:100%;height:100%;object-fit:cover;border-radius:11px;pointer-events:none;}'
    +'.wlName{font-size:11px;font-weight:800;color:#f1f5f9;margin-bottom:2px;pointer-events:none;}'
    +'.wlSub{font-size:9px;font-weight:600;margin-bottom:10px;pointer-events:none;}'
    +'.wlBtn{width:100%;padding:8px 4px;border-radius:9px;font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:background .12s ease-out!important;border:none;outline:none;}'
    +'.wlBtn.on{background:#49e8c2;color:#021a10;}'
    +'.wlBtn.on:hover{background:#6fffd8;}'
    +'.wlBtn.off{background:rgba(73,232,194,.07);color:#49e8c2;border:1px solid rgba(73,232,194,.2)!important;}'
    +'.wlBtn.off:hover{background:rgba(73,232,194,.14);}'
    +'#walletStatus{margin-top:14px;padding:14px 16px;border-radius:12px;border:1px solid rgba(73,232,194,.12);background:rgba(4,12,28,.75);font-size:13px;display:none;}';
  document.head.appendChild(s);
})();

// ── Card builder ────────────────────────────────────────────────────────
function _card(name){
  var found=_det(name);
  var d=_WL[name]||{};
  var sub=found?'<span style="color:#49e8c2">● Detected</span>':'<span style="color:#556">'+d.sub+'</span>';
  var actCard=found
    ?'window._htpConnect(\''+name+'\')'
    :'window._htpInstall(\''+name+'\')'
  var actBtn=found
    ?'event.stopPropagation();window._htpConnect(\''+name+'\')'
    :'event.stopPropagation();window._htpInstall(\''+name+'\')'
  return '<div class="wlCard '+(found?'on':'off')+'" onclick="'+actCard+'">'
    +(found?'<div class="wlDot"></div>':'')
    +'<div class="wlLogo"><img src="'+(d.logo||'')+'" alt="'+name+'" onerror="this.style.opacity=0"></div>'
    +'<div class="wlName">'+name+'</div>'
    +'<div class="wlSub">'+sub+'</div>'
    +'<button class="wlBtn '+(found?'on':'off')+'" onclick="'+actBtn+'">'
    +(found?'Connect':'Install &#x2197;')
    +'</button></div>';
}

// ── Mobile toggle ──────────────────────────────────────────────────────────
function _setBtnState(btn, on) {
  // Set text + class directly on the element reference (works before/after DOM insert)
  btn.innerHTML = on ? '&#x1F4F1;&#160;Mobile On' : '&#x1F4F1;&#160;Mobile';
  if (on) { btn.classList.remove('mob-off'); }
  else    { btn.classList.add('mob-off'); }
}

function _updMobBtn(){
  var btn=document.getElementById('htpMobBtn');
  if(btn) _setBtnState(btn, window._htpMobOn);
}

function _injectMobToggle(){
  if(document.getElementById('htpMobBtn')) return;
  var container=document.querySelector('.hdr-r')||document.querySelector('.hdr-in');
  if(!container) return;
  var btn=document.createElement('button');
  btn.id='htpMobBtn';
  btn.onclick=window._htpToggleMob;
  // Set text NOW, before inserting into DOM
  _setBtnState(btn, window._htpMobOn);
  // Insert before the first child of .hdr-r
  container.insertBefore(btn, container.firstChild);
}

function _applyMob(){
  if(window._htpMobOn) document.documentElement.classList.add('htp-mob-preview');
  else                 document.documentElement.classList.remove('htp-mob-preview');
  _updMobBtn();
  if(typeof window._wlRefresh==='function') setTimeout(window._wlRefresh,60);
}

window._htpToggleMob=function(){
  window._htpMobOn=!window._htpMobOn;
  _applyMob();
};

// Auto-on for real phones
if(_isPhone()) document.documentElement.classList.add('htp-mob-preview');

// ── Main render ──────────────────────────────────────────────────────────
(function(){
  function wallets(){
    return (window._htpMobOn||_isPhone()) ? _MOB.concat(_DESK) : _DESK;
  }

  function render(){
    var sec=document.getElementById('v-wallet'); if(!sec) return;
    var wrap=document.getElementById('wlWrap');
    if(wrap){
      var g=document.getElementById('wlGrid');
      if(g) g.innerHTML=wallets().map(_card).join('');
      _injectNetSels();
      return;
    }
    wrap=document.createElement('div'); wrap.id='wlWrap';
    wrap.innerHTML=
      '<div class="wlHdr">'
        +'<span class="wlHdr-ttl">Choose Wallet</span>'
        +'<div class="wlHdr-line"></div>'
        +'<span class="wlHdr-hint">Detected → Connect · Others → Install</span>'
      +'</div>'
      +'<div id="wlGrid">'+wallets().map(_card).join('')+'</div>';
    var old=sec.querySelector('.w-grid');
    if(old){
      var st=document.getElementById('walletStatus');
      old.parentNode.insertBefore(wrap,old); old.remove();
      if(st) wrap.parentNode.insertBefore(st,wrap.nextSibling);
    } else {
      var mx=sec.querySelector('.mx')||sec;
      var sh=mx.querySelector('.sh');
      mx.insertBefore(wrap,sh?sh.nextSibling:mx.firstChild);
    }
    _injectNetSels();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render);
  else render();

  var _go=window.go;
  if(typeof _go==='function'&&!_go._v19d){
    window.go=function(v){_go(v);if(v==='wallet')setTimeout(render,150);};
    window.go._v19d=true;
  }
  window.addEventListener('htp:view:wallet',function(){setTimeout(render,150);});
  window._wlRefresh=render;

  if(document.readyState==='complete') _injectMobToggle();
  else window.addEventListener('load',_injectMobToggle);
})();
