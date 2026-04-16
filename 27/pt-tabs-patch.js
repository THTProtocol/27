// pt-tabs-patch.js — Portfolio segment tab redesign
// Replaces flat underline tabs with pill segment control
(function(){
  'use strict';

  function applyTabStyles(){
    // Inject CSS
    var style = document.createElement('style');
    style.id = 'pt-tabs-style';
    style.textContent = [
      '.pt-tabs{display:flex;background:rgba(6,12,22,0.7);border:1px solid rgba(73,232,194,0.1);border-radius:12px;padding:4px;gap:2px;margin-bottom:24px}',
      '.pt-tab{flex:1;padding:9px 16px;font-size:12px;font-weight:600;letter-spacing:.04em;border:none;border-radius:9px;background:transparent;color:rgba(255,255,255,0.35);cursor:pointer;transition:all 0.18s ease;white-space:nowrap}',
      '.pt-tab:hover{color:rgba(255,255,255,0.65);background:rgba(73,232,194,0.05)}',
      '.pt-tab.pt-active{background:rgba(73,232,194,0.12);color:#49e8c2;box-shadow:0 1px 8px rgba(73,232,194,0.12)}'
    ].join('');
    document.head.appendChild(style);

    // Find the old tab container and replace it
    var sw1 = document.getElementById('ptSwitchSkill');
    if (!sw1) return;
    var oldContainer = sw1.parentElement;
    if (!oldContainer) return;

    // Build new container
    var newContainer = document.createElement('div');
    newContainer.className = 'pt-tabs';

    var tabs = [
      {id:'ptSwitchSkill', label:'Skill Games',   type:'skill'},
      {id:'ptSwitchEvent', label:'Event Markets', type:'events'},
      {id:'ptSwitchClaim', label:'Claim Now',     type:'claim'}
    ];

    tabs.forEach(function(t){
      var btn = document.createElement('button');
      btn.id = t.id;
      btn.className = 'pt-tab';
      btn.textContent = t.label;
      btn.onclick = function(){ window.setPortfolioType(t.type); };
      newContainer.appendChild(btn);
    });

    oldContainer.parentElement.replaceChild(newContainer, oldContainer);

    // Patch setPortfolioType to use classList
    var _orig = window.setPortfolioType;
    window.setPortfolioType = function(type){
      _orig && _orig(type);
      document.querySelectorAll('.pt-tab').forEach(function(b){ b.classList.remove('pt-active'); });
      var idMap = {skill:'ptSwitchSkill', events:'ptSwitchEvent', claim:'ptSwitchClaim'};
      var el = document.getElementById(idMap[type]);
      if (el) el.classList.add('pt-active');
    };

    // Set initial active
    var skillBtn = document.getElementById('ptSwitchSkill');
    if (skillBtn) skillBtn.classList.add('pt-active');

    console.log('[HTP] pt-tabs: segment control applied');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTabStyles);
  } else {
    applyTabStyles();
  }
})();
