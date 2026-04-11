(function () {
  var DATA_URL = '../data/creatures.json';
  var DONATE_WALLET_ADDRESS = '0xe69165e7781468bf0979419d0def401b13a3ac50';
  var creatures = [];
  var filteredCreatures = [];
  var selectedCreatureId = '';
  var searchQuery = '';
  var selectedType = '';
  var discordUser = null;

  var elements = {
    searchInput: document.getElementById('search-input'),
    typeFilter: document.getElementById('type-filter'),
    resultCount: document.getElementById('result-count'),
    creatureList: document.getElementById('creature-list'),
    creatureDetail: document.getElementById('creature-detail')
  };

  init();

  function init() {
    loadSavedDiscordUser();
    bindEvents();
    updateAuthUI();

    loadCreatures()
      .then(function (payload) {
        var items = Array.isArray(payload) ? payload : payload.items;
        creatures = normalizeCreatures(Array.isArray(items) ? items : []);
        populateFilters();
        applyFilters();
      })
      .catch(function (error) {
        console.error(error);
        elements.resultCount.textContent = 'Unavailable';
        elements.creatureList.innerHTML = '<div class="empty-state">Creature data is unavailable right now.</div>';
        elements.creatureDetail.innerHTML = '<div class="detail-empty"><div><div class="detail-empty-icon">⚠️</div><p>Refresh the page and try again.</p></div></div>';
      });
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', function (event) {
      searchQuery = String(event.target.value || '').trim().toLowerCase();
      applyFilters();
    });

    elements.typeFilter.addEventListener('change', function (event) {
      selectedType = String(event.target.value || '');
      applyFilters();
    });

    elements.creatureList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-creature-id]');
      if (!button) return;
      selectedCreatureId = String(button.getAttribute('data-creature-id') || '');
      renderList();
      renderDetail(getSelectedCreature());
    });

    bindHeaderControls();
  }

  function bindHeaderControls() {
    var logoutBtn = document.getElementById('btn-discord-logout');
    var infoBtn = document.getElementById('btn-info');
    var donateBtn = document.getElementById('btn-donate');
    var aboutModal = document.getElementById('about-modal');
    var donateModal = document.getElementById('donate-modal');
    var closeAbout = document.getElementById('about-close');
    var closeAboutAlt = document.getElementById('btn-close-about');
    var closeDonate = document.getElementById('donate-close');
    var closeDonateAlt = document.getElementById('btn-close-donate');
    var copyWalletBtn = document.getElementById('btn-copy-wallet');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logoutDiscord();
      });
    }

    if (infoBtn && aboutModal) {
      infoBtn.addEventListener('click', function () {
        aboutModal.hidden = false;
      });
    }

    if (donateBtn && donateModal) {
      donateBtn.addEventListener('click', function () {
        donateModal.hidden = false;
      });
    }

    [closeAbout, closeAboutAlt].forEach(function (button) {
      if (!button || !aboutModal) return;
      button.addEventListener('click', function () {
        aboutModal.hidden = true;
      });
    });

    [closeDonate, closeDonateAlt].forEach(function (button) {
      if (!button || !donateModal) return;
      button.addEventListener('click', function () {
        donateModal.hidden = true;
      });
    });

    [aboutModal, donateModal].forEach(function (modal) {
      if (!modal) return;
      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          modal.hidden = true;
        }
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (aboutModal) aboutModal.hidden = true;
      if (donateModal) donateModal.hidden = true;
    });

    if (copyWalletBtn) {
      copyWalletBtn.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(DONATE_WALLET_ADDRESS).then(function () {
            copyWalletBtn.textContent = 'Copied!';
            setTimeout(function () { copyWalletBtn.textContent = 'Copy Address'; }, 1200);
          });
        }
      });
    }
  }

  function loadCreatures() {
    var candidates = [DATA_URL, '/data/creatures.json'];

    if (window.location.pathname.indexOf('/docs/creatures/') !== -1) {
      candidates.push('/docs/data/creatures.json');
    }

    candidates = candidates.filter(function (url, index, list) {
      return !!url && list.indexOf(url) === index;
    });

    return tryFetchData(candidates, 0);
  }

  function tryFetchData(candidates, index) {
    if (index >= candidates.length) {
      return Promise.reject(new Error('Failed to load creature data.'));
    }

    return fetch(candidates[index], { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load creature data from ' + candidates[index]);
        }
        return response.json();
      })
      .catch(function () {
        return tryFetchData(candidates, index + 1);
      });
  }

  function normalizeCreatures(items) {
    return items.map(function (item) {
      var id = String(item && item.id ? item.id : slugify(item && item.name ? item.name : 'unknown'));
      var name = String(item && item.name ? item.name : 'Unknown Creature');
      var family = String(item && item.family ? item.family : 'Unknown');
      var type = String(item && item.type ? item.type : 'Unknown');
      var region = String(item && item.region ? item.region : '');
      var dropsDetailed = normalizeDrops(item && item.dropsDetailed ? item.dropsDetailed : item && item.drops ? item.drops : []);

      return {
        id: id,
        name: name,
        family: family,
        type: type,
        region: region,
        level: toFiniteNumber(item && item.level),
        health: toFiniteNumber(item && item.health),
        xpPerKill: toFiniteNumber(item && item.xpPerKill),
        dropsDetailed: dropsDetailed,
        searchBlob: [
          name,
          family,
          type,
          region,
          dropsDetailed.map(function (drop) { return drop.name; }).join(' ')
        ].join(' ').toLowerCase()
      };
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  }

  function normalizeDrops(items) {
    if (!Array.isArray(items)) return [];

    return items.map(function (item) {
      if (typeof item === 'string') {
        return {
          name: item,
          category: 'Unknown',
          level: null,
          rarity: 'Unknown',
          junkValue: 0
        };
      }

      return {
        name: String(item && item.name ? item.name : item && item.item ? item.item : 'Unknown Drop'),
        category: String(item && item.category ? item.category : 'Unknown'),
        level: toFiniteNumber(item && item.level),
        rarity: String(item && item.rarity ? item.rarity : 'Unknown'),
        junkValue: toFiniteNumber(item && item.junkValue) || 0
      };
    });
  }

  function populateFilters() {
    populateSelect(elements.typeFilter, getUniqueValues('type'), 'All types');
  }

  function populateSelect(select, values, placeholder) {
    select.innerHTML = ['<option value="">' + escapeHtml(placeholder) + '</option>']
      .concat(values.map(function (value) {
        return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>';
      }))
      .join('');
  }

  function getUniqueValues(key) {
    var values = {};
    creatures.forEach(function (creature) {
      var value = String(creature[key] || '').trim();
      if (!value || value === 'Unknown') return;
      values[value] = true;
    });

    return Object.keys(values).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function applyFilters() {
    filteredCreatures = creatures.filter(function (creature) {
      if (selectedType && creature.type !== selectedType) return false;
      if (searchQuery && creature.searchBlob.indexOf(searchQuery) === -1) return false;
      return true;
    });

    if (!filteredCreatures.some(function (creature) { return creature.id === selectedCreatureId; })) {
      selectedCreatureId = filteredCreatures[0] ? filteredCreatures[0].id : '';
    }

    renderList();
    renderDetail(getSelectedCreature());
    elements.resultCount.textContent = filteredCreatures.length + ' / ' + creatures.length;
  }

  function renderList() {
    if (!filteredCreatures.length) {
      elements.creatureList.innerHTML = '<div class="empty-state">No creatures match the current filters.</div>';
      return;
    }

    elements.creatureList.innerHTML = filteredCreatures.map(function (creature) {
      var isSelected = creature.id === selectedCreatureId;
      var dropCount = creature.dropsDetailed.length;
      var extra = [];

      if (creature.level) extra.push('Lv. ' + creature.level);
      if (creature.region) extra.push(creature.region);

      return [
        '<button class="creature-item' + (isSelected ? ' selected' : '') + '" type="button" data-creature-id="' + escapeHtml(creature.id) + '">',
        '  <span class="creature-thumb"><img src="' + escapeHtml(getCreatureImagePath(creature)) + '" alt="' + escapeHtml(creature.name) + '" loading="lazy" /></span>',
        '  <span class="creature-info">',
        '    <span class="creature-name">' + escapeHtml(creature.name) + '</span>',
        '    <span class="creature-meta">' + escapeHtml(creature.type || 'Unknown') + '</span>',
        (extra.length ? '    <span class="creature-extra muted-text">' + escapeHtml(extra.join(' • ')) + '</span>' : ''),
        '  </span>',
        '  <span class="creature-extra">' + dropCount + ' drop' + (dropCount === 1 ? '' : 's') + '</span>',
        '</button>'
      ].join('');
    }).join('');

    wireImageFallbacks(elements.creatureList);
  }

  function renderDetail(creature) {
    if (!creature) {
      elements.creatureDetail.innerHTML = '<div class="detail-empty"><div><div class="detail-empty-icon">🐺</div><p>Select a creature to view its loot table.</p></div></div>';
      return;
    }

    var stats = [];
    stats.push(renderStatCard('Type', creature.type || 'Unknown'));
    if (creature.level) stats.push(renderStatCard('Level', String(creature.level)));
    if (creature.region) stats.push(renderStatCard('Region', creature.region));
    if (creature.health) stats.push(renderStatCard('Health', formatNumber(creature.health)));
    if (creature.xpPerKill) stats.push(renderStatCard('XP per Kill', formatNumber(creature.xpPerKill)));

    var groupedDrops = groupDrops(creature.dropsDetailed);
    var categoryOrder = ['Material', 'Trophy', 'Cosmetic', 'Junk', 'Unknown'];
    var dropSections = categoryOrder.map(function (category) {
      var drops = groupedDrops[category] || [];
      if (!drops.length) return '';

      return [
        '<section class="drop-group">',
        '  <h3>' + escapeHtml(category) + ' (' + drops.length + ')</h3>',
        '  <div class="drops-grid">',
        drops.map(renderDropCard).join(''),
        '  </div>',
        '</section>'
      ].join('');
    }).join('');

    elements.creatureDetail.innerHTML = [
      '<div class="detail-hero">',
      '  <div class="detail-hero-image"><img src="' + escapeHtml(getCreatureImagePath(creature)) + '" alt="' + escapeHtml(creature.name) + '" /></div>',
      '  <div class="detail-title">',
      '    <h2>' + escapeHtml(creature.name) + '</h2>',
      '    <div class="detail-subtitle">' + escapeHtml(creature.type || 'Unknown') + '</div>',
      '    <p class="muted-text">Loot entries: ' + creature.dropsDetailed.length + '</p>',
      '  </div>',
      '</div>',
      '<div class="stats-grid">' + stats.join('') + '</div>',
      dropSections || '<div class="empty-state">No detailed loot data is available for this creature.</div>'
    ].join('');

    wireImageFallbacks(elements.creatureDetail);
  }

  function renderDropCard(drop) {
    var meta = [];
    if (drop.level) meta.push('Min level ' + drop.level);

    return [
      '<article class="drop-card">',
      '  <div class="drop-topline">',
      '    <span class="drop-name">' + escapeHtml(drop.name) + '</span>',
      '    <span class="rarity-badge ' + escapeHtml(getRarityClass(drop.rarity)) + '">' + escapeHtml(drop.rarity) + '</span>',
      '  </div>',
      '  <div class="drop-meta">' + escapeHtml(meta.join(' • ') || 'No extra info') + '</div>',
      '</article>'
    ].join('');
  }

  function renderStatCard(label, value) {
    return [
      '<div class="stat-card">',
      '  <span class="stat-label">' + escapeHtml(label) + '</span>',
      '  <span class="stat-value">' + escapeHtml(value) + '</span>',
      '</div>'
    ].join('');
  }

  function groupDrops(items) {
    return items.reduce(function (groups, drop) {
      var key = drop.category || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(drop);
      return groups;
    }, {});
  }

  function getSelectedCreature() {
    for (var i = 0; i < filteredCreatures.length; i += 1) {
      if (filteredCreatures[i].id === selectedCreatureId) return filteredCreatures[i];
    }
    return null;
  }

  function getCreatureImagePath(creature) {
    return '../assets/creatures/' + encodeURIComponent(creature.id) + '.webp';
  }

  function wireImageFallbacks(container) {
    var images = container.querySelectorAll('img');
    images.forEach(function (img) {
      img.addEventListener('error', function handleError() {
        img.removeEventListener('error', handleError);
        img.src = '../assets/favicon.png';
      });
    });
  }

  function getRarityClass(rarity) {
    var value = String(rarity || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return 'rarity-' + value.replace(/^-+|-+$/g, '');
  }

  function toFiniteNumber(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function loadSavedDiscordUser() {
    try {
      var raw = localStorage.getItem('discord_user');
      if (!raw) return;
      var user = JSON.parse(raw);
      if (user && user.id) {
        discordUser = user;
      }
    } catch (error) {
      console.warn('Failed to read discord_user from localStorage:', error);
    }
  }

  function logoutDiscord() {
    discordUser = null;

    try {
      localStorage.removeItem('discord_user');
      localStorage.removeItem('discord_access_token');
      localStorage.removeItem('discord_access_token_expires_at');
      sessionStorage.removeItem('discord_access_token');
      sessionStorage.removeItem('discord_access_token_expires_at');
    } catch (error) {
      console.warn('Failed clearing Discord session:', error);
    }

    updateAuthUI();
  }

  function updateAuthUI() {
    var userDisplay = document.getElementById('discord-user-display');
    var userName = document.getElementById('discord-username');

    if (!userDisplay || !userName) return;

    if (discordUser) {
      userDisplay.style.display = 'flex';
      userName.textContent = discordUser.globalName || discordUser.username || discordUser.id;
    } else {
      userDisplay.style.display = 'none';
      userName.textContent = '';
    }
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
