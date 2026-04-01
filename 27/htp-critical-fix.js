(function(){
  'use strict';
  setTimeout(function(){
    for(var k of Object.keys(window)){try{var v=window[k];if(v&&typeof v==='object'&&typeof v.disconnect==='function'&&typeof v.connect==='function'&&k!=='firebase'){v.disconnect();console.log('[HTP Fix] Killed RpcClient:',k);}}catch(e){}}
    console.log('[HTP Fix] WS storm killed');
  },400);
  var _od=Object.defineProperty.bind(Object);
  Object.defineProperty=function(o,p,d){try{var e=Object.getOwnPropertyDescriptor(o,p);if(e&&!e.configurable){return o;}return _od(o,p,d);}catch(e){return o;}};
  var _tc=new Map();
  var _ig=function(){if(!window.htpSendTx||window._tg)return;window._tg=1;var _o=window.htpSendTx;window.htpSendTx=async function(a,b){var to=a&&typeof a==='object'?a.to:a;var am=a&&typeof a==='object'?a.amount:b;var k=to+'|'+am;var n=Date.now();if(_tc.has(k)&&n-_tc.get(k)<4000){console.warn('[HTP Fix] Dup TX blocked');return{blocked:true};}_tc.set(k,n);return _o.apply(this,arguments);};console.log('[HTP Fix] TX guard OK');};
  _ig();setTimeout(_ig,2000);setTimeout(_ig,5000);
  var _jf=function(){if(!window.joinLobbyMatch||window._jf)return;window._jf=1;var _o=window.joinLobbyMatch;window.joinLobbyMatch=async function(id,opts){var s=5;try{if(window.firebase&&firebase.database){var snap=await firebase.database().ref('lobby/'+id).once('value');var d=snap.val();if(d&&d.stake)s=parseFloat(d.stake);}}catch(e){}var m=Object.assign({},opts||{},{amount:BigInt(Math.round(s*1e8))});console.log('[HTP Fix] join amount:',s,'KAS');return _o.call(this,id,m);};console.log('[HTP Fix] join fix OK');};
  _jf();setTimeout(_jf,2000);setTimeout(_jf,5000);
  console.log('[HTP Critical Fix v1] Loaded OK');
})();
