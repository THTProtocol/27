// pt-tabs-patch.js v2 — Portfolio segment tab redesign
// Kills conflicting legacy CSS, replaces old button container, patches setPortfolioType
(function(){
  'use strict';

  function applyTabStyles(){
    // 1. Kill the conflicting old CSS block (#ptSwitchSkill !important overrides)
    document.querySelectorAll('style').forEach(function(s){
      if (s.textContent.indexOf('#ptSwitchSkill, #ptSwitchEvent') > -1) {
        s.textContent = s.textContent
          .replace(/#ptSwitchSkill,\s*#ptSwitchEvent\s*\{[^}]*\}/g, '')
          .replace(/#ptSwitchSkill\s*\{[^}]*\}/g, '')
          .replace(/#ptSwitchEvent\s*\{[^}]*\}/g, '');
      }
    });

    // 2. Inject clean CSS (append last so it wins)
    var old = document.getElementById('pt-tabs-style');
    if (old) old.remove();
    var style = document.createElement('style');
    style.id = 'pt-tabs-style';
    style.textContent = [
      '.pt-tabs{display:flex;background:rgba(6,12,22,0.8);border:1px solid rgba(73,232,194,0.12);border-radius:12px;padding:4px;gap:2px;margin-bottom:24px;width:100%}',
      '.pt-tab{flex:1;padding:9px 16px;font-size:12px!important;font-weight:600!important;letter-spacing:.04em!important;border:none!important;border-radius:9px!important;border-bottom:none!important;background:transparent!important;color:rgba(255,255,255,0.35)!important;cursor:pointer;transition:all 0.18s ease;white-space:nowrap;min-width:unset!important}',
      '.pt-tab:hover{color:rgba(255,255,255,0.7)!important;background:rgba(73,232,194,0.06)!important}',
      '.pt-tab.pt-active{background:rgba(73,232,194,0.13)!important;color:#49e8c2!important;box-shadow:0 1px 10px rgba(73,232,194,0.13)!important;border-bottom:none!important}'
    ].join('');
    document.head.appendChild(style);

    // 3. Find old container and swap it out
    var sw1 = document.getElementById('ptSwitchSkill');
    if (!sw1) { console.warn('[pt-tabs] ptSwitchSkill not found'); return; }
    var oldContainer = sw1.parentElement;
    if (!oldContainer) return;

    var newContainer = document.createElement('div');
    newContainer.className = 'pt-tabs';

    [
      {id:'ptSwitchSkill', label:'Skill Games',   type:'skill'},
      {id:'ptSwitchEvent', label:'Event Markets', type:'events'},
      {id:'ptSwitchClaim', label:'Claim Now',     type:'claim'}
    ].forEach(function(t){
      var btn = document.createElement('button');
      btn.id = t.id;
      btn.className = 'pt-tab';
      btn.textContent = t.label;
      // Clear any lingering inline styles from old buttons
      btn.removeAttribute('style');
      btn.onclick = function(){ window.setPortfolioType(t.type); };
      newContainer.appendChild(btn);
    });

    oldContainer.parentElement.replaceChild(newContainer, oldContainer);

    // 4. Patch setPortfolioType: remove inline style mutations, use classList only
    var _orig = window.setPortfolioType;
    window.setPortfolioType = function(type){
      _orig && _orig(type);
      // clear any inline styles the original function sets
      ['ptSwitchSkill','ptSwitchEvent','ptSwitchClaim'].forEach(function(id){
        var b = document.getElementById(id);
        if (b) { b.removeAttribute('style'); b.classList.remove('pt-active'); }
      });
      var map = {skill:'ptSwitchSkill', events:'ptSwitchEvent', claim:'ptSwitchClaim'};
      var el = document.getElementById(map[type]);
      if (el) el.classList.add('pt-active');
    };

    // 5. Set initial active state
    var skillBtn = document.getElementById('ptSwitchSkill');
    if (skillBtn) skillBtn.classList.add('pt-active');

    console.log('[HTP] pt-tabs v2: segment control active, legacy CSS nuked');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTabStyles);
  } else {
    applyTabStyles();
  }
})();
