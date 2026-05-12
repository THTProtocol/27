/**
 * HTP Search + Filter + Sort Bar
 * htp-search.js v1
 */
(function() {
  'use strict';

  var searchInput = null;
  var debounceTimer = null;

  function injectBar() {
    if (document.getElementById('htpSearchBar')) return;

    var target = document.querySelector('#v-markets .mx, #v-events .mx, .view.show .mx');
    if (!target) {
      setTimeout(injectBar, 300);
      return;
    }

    var bar = document.createElement('div');
    bar.id = 'htpSearchBar';
    bar.innerHTML = [
      '<div class="search-pill">',
        '<span class="search-icon">\u2315</span>',
        '<input type="text" id="htpSearchInput" placeholder="Search markets and events..." autocomplete="off" />',
        '<span class="search-shortcut" aria-hidden="true">/</span>',
      '</div>',
      '<div class="filter-chips" id="htpFilterChips">',
        '<button class="chip active" data-cat="all">All</button>',
        '<button class="chip" data-cat="sports">Sports</button>',
        '<button class="chip" data-cat="crypto">Crypto</button>',
        '<button class="chip" data-cat="politics">Politics</button>',
        '<button class="chip" data-cat="esports">Esports</button>',
        '<button class="chip" data-cat="custom">Custom</button>',
      '</div>',
      '<select id="htpSortSelect">',
        '<option value="trending">Sort: Trending</option>',
        '<option value="newest">Newest</option>',
        '<option value="closing">Closing Soon</option>',
        '<option value="volume">Highest Volume</option>',
      '</select>',
    '</div>'
    ].join('');

    target.insertBefore(bar, target.firstChild);

    // Wire up
    searchInput = document.getElementById('htpSearchInput');

    // Chip clicks
    document.querySelectorAll('#htpFilterChips .chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        document.querySelectorAll('#htpFilterChips .chip').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var cat = chip.dataset.cat;
        filterCards(cat);
        saveState();
      });
    });

    // Sort
    var sortSelect = document.getElementById('htpSortSelect');
    sortSelect.addEventListener('change', function() {
      sortCards(this.value);
      saveState();
    });

    // Search input
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        filterCards(getActiveCat());
        saveState();
      }, 200);
    });

    // Restore state
    restoreState();
  }

  function getActiveCat() {
    var active = document.querySelector('#htpFilterChips .chip.active');
    return active ? active.dataset.cat : 'all';
  }

  function filterCards(cat) {
    var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var cards = document.querySelectorAll('.htp-card, .market-card, [class*="event-card"], .sgv2-card, .sg-card');

    cards.forEach(function(card) {
      var txt = card.textContent.toLowerCase();
      var cardCat = card.dataset.cat || 'custom';
      var matchCat = (cat === 'all' || cardCat === cat);
      var matchSearch = (!query || txt.indexOf(query) !== -1);
      card.style.display = (matchCat && matchSearch) ? '' : 'none';
    });
  }

  function sortCards(method) {
    var container = document.querySelector('#v-markets .mx, #v-events .mx');
    if (!container) return;
    var cards = Array.from(container.querySelectorAll('.htp-card, .market-card, [class*="event-card"], .sgv2-card, .sg-card'));
    if (!cards.length) return;

    cards.sort(function(a, b) {
      if (method === 'newest') {
        return (parseInt(b.dataset.created) || 0) - (parseInt(a.dataset.created) || 0);
      } else if (method === 'closing') {
        return (parseInt(a.dataset.closes) || 0) - (parseInt(b.dataset.closes) || 0);
      } else if (method === 'volume') {
        return (parseFloat(b.dataset.volume) || 0) - (parseFloat(a.dataset.volume) || 0);
      }
      return 0; // trending = keep DOM order
    });

    cards.forEach(function(card) {
      container.appendChild(card);
    });
  }

  function saveState() {
    var cat = getActiveCat();
    var query = searchInput ? searchInput.value.trim() : '';
    var sort = document.getElementById('htpSortSelect') ? document.getElementById('htpSortSelect').value : 'trending';
    var hash = '#/markets';
    var params = [];
    if (query) params.push('search=' + encodeURIComponent(query));
    if (cat !== 'all') params.push('cat=' + cat);
    if (sort !== 'trending') params.push('sort=' + sort);
    if (params.length) hash += '?' + params.join('&');
    try {
      history.replaceState(null, '', hash);
    } catch(e) {}
  }

  function restoreState() {
    var hash = window.location.hash;
    if (!hash) return;
    if (hash.indexOf('?') === -1) return;
    var params = hash.split('?')[1];
    if (!params) return;
    params.split('&').forEach(function(p) {
      var kv = p.split('=');
      if (kv[0] === 'search') {
        if (searchInput) searchInput.value = decodeURIComponent(kv[1]);
        if (searchInput) searchInput.dispatchEvent(new Event('input'));
      } else if (kv[0] === 'cat') {
        document.querySelectorAll('#htpFilterChips .chip').forEach(function(chip) {
          chip.classList.toggle('active', chip.dataset.cat === kv[1]);
        });
        filterCards(kv[1]);
      } else if (kv[0] === 'sort') {
        var sel = document.getElementById('htpSortSelect');
        if (sel) { sel.value = kv[1]; sortCards(kv[1]); }
      }
    });
  }

  // Global keyboard shortcut: "/" focuses search
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== searchInput) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.blur();
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(injectBar, 500);
    });
  } else {
    setTimeout(injectBar, 500);
  }

  window.htpSearch = { inject: injectBar, filter: filterCards, sort: sortCards };
})();
