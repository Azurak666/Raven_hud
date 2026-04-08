(function () {
  var DATA_URL = '../data/trophies.json';
  var DONATE_WALLET_ADDRESS = '0xe69165e7781468bf0979419d0def401b13a3ac50';
  var DISCORD_CLIENT_ID = '1491050953221079223';
  var DISCORD_REDIRECT_URI = window.location.origin + window.location.pathname;
  var DISCORD_SCOPES = 'identify';
  var SUBMISSION_API_URL = window.RAVENHUD_API_URL || '';
  var GROUP_ORDER = ['Carnival', 'Creatures', 'Monuments', 'Ocean'];
  var STAT_ORDER = [
    'Crafting EXP',
    'Drop Rate (Ocean)',
    'Gathering EXP',
    'Healing Power',
    'Impact',
    'Mana Regeneration',
    'Max Mana',
    'Precision',
    'Spell Defense',
    'Vitality',
    'Weapon Power',
    'Dexterity',
    'Fishing Damage',
    'Haste',
    'Health Regeneration',
    'Intelligence',
    'Max Health',
    'Might',
    'Ship Cannon Damage',
    'Spell Power',
    'Weapon Defense',
    'Wisdom'
  ];
  var STORAGE_PREFIX = 'rhud_trophy_owned_';
  var UPDATED_PREFIX = 'rhud_trophy_owned_updated_';
  var TROPHY_ICON_OVERRIDES = {
    moa_carnival_trophy: './icons/special/carnival_moa_trophy.svg',
    munk_carnival_trophy: './icons/special/carnival_tent_trophy.svg',
    orc_trophy: './icons/special/orc_trophy.png'
  };
  var trophies = [];
  var ownedState = {};
  var searchQuery = '';
  var discordUser = null;
  var trophySyncTimer = null;
  var trophySyncInFlight = null;

  var elements = {
    groupGrid: document.getElementById('group-grid'),
    searchInput: document.getElementById('search-input'),
    baseProgressText: document.getElementById('base-progress-text'),
    baseProgressPercent: document.getElementById('base-progress-percent'),
    baseProgressFill: document.getElementById('base-progress-fill'),
    resultSummary: document.getElementById('result-summary'),
    bonusCount: document.getElementById('bonus-count'),
    bonusList: document.getElementById('bonus-list')
  };

  init();

  function init() {
    loadSavedDiscordUser();
    bindEvents();
    updateAuthUI();
    renderLoading();

    handleOAuthCallback().then(function (loggedIn) {
      if (loggedIn) {
        promoteGuestOwnedStateToUser();
        ownedState = loadOwnedState();
        updateAuthUI();
        syncOwnedStateFromBackend().catch(function (err) {
          console.warn('Trophy sync unavailable after login:', err);
        });
      }
    });

    loadTrophyData()
      .then(function (payload) {
        var items = Array.isArray(payload) ? payload : payload.items;
        trophies = normalizeTrophies(Array.isArray(items) ? items : []);
        ownedState = loadOwnedState();
        render();

        if (discordUser) {
          syncOwnedStateFromBackend().catch(function (err) {
            console.warn('Trophy sync unavailable:', err);
          });
        }
      })
      .catch(function (error) {
        console.error(error);
        elements.groupGrid.innerHTML = '<div class="group-empty">Trophy data is unavailable right now.</div>';
        elements.resultSummary.textContent = 'Refresh the page and try again.';
      });
  }

  function loadTrophyData() {
    var candidates = [DATA_URL, '/data/trophies.json'];

    if (window.location.pathname.indexOf('/docs/trophies/') !== -1) {
      candidates.push('/docs/data/trophies.json');
    }

    candidates = candidates.filter(function (url, index, list) {
      return !!url && list.indexOf(url) === index;
    });

    return tryFetchTrophyData(candidates, 0);
  }

  function tryFetchTrophyData(candidates, index) {
    if (index >= candidates.length) {
      return Promise.reject(new Error('Failed to load trophy data.'));
    }

    return fetch(candidates[index], { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load trophy data from ' + candidates[index]);
        }
        return response.json();
      })
      .catch(function () {
        return tryFetchTrophyData(candidates, index + 1);
      });
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', function (event) {
      searchQuery = String(event.target.value || '').trim().toLowerCase();
      render();
    });

    elements.groupGrid.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || !target.classList.contains('owned-checkbox')) return;
      toggleOwned(String(target.getAttribute('data-id') || ''), !!target.checked);
    });

    bindHeaderControls();
  }

  function bindHeaderControls() {
    var loginBtn = document.getElementById('btn-discord-login');
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

    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        startDiscordLogin();
      });
    }

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

  function renderLoading() {
    elements.groupGrid.innerHTML = '<div class="group-empty">Loading trophies…</div>';
  }

  function render() {
    var groups = buildGroupedTrophies();
    var html = GROUP_ORDER.map(function (groupName) {
      return renderGroup(groupName, groups[groupName] || []);
    }).join('');

    elements.groupGrid.innerHTML = html;
    renderProgress();
    renderBonusList();
  }

  function buildGroupedTrophies() {
    var grouped = {
      Carnival: [],
      Creatures: [],
      Monuments: [],
      Ocean: []
    };

    trophies.forEach(function (trophy) {
      if (searchQuery && trophy.searchBlob.indexOf(searchQuery) === -1) {
        return;
      }
      grouped[trophy.group].push(trophy);
    });

    return grouped;
  }

  function renderGroup(groupName, items) {
    var totalForGroup = trophies.filter(function (trophy) { return trophy.group === groupName; }).length;
    var ownedForGroup = trophies.filter(function (trophy) {
      return trophy.group === groupName && !!ownedState[trophy.id];
    }).length;

    var body = items.length
      ? items.map(renderTrophyCard).join('')
      : '<div class="group-empty">No trophies match this search.</div>';

    return [
      '<section class="group-column">',
      '  <div class="group-header">',
      '    <span class="group-title">' + escapeHtml(groupName) + '</span>',
      '    <span class="group-count">' + ownedForGroup + '/' + totalForGroup + '</span>',
      '  </div>',
      '  <div class="group-body">' + body + '</div>',
      '</section>'
    ].join('');
  }

  function renderTrophyCard(trophy) {
    var isOwned = !!ownedState[trophy.id];
    var bonusText = trophy.bonuses.length ? trophy.bonuses.map(formatBonus).join(' • ') : 'No bonus data';

    return [
      '<article class="trophy-card' + (isOwned ? ' owned' : '') + '">',
      '  <img class="trophy-art" src="' + escapeHtml(trophy.iconPath) + '" alt="' + escapeHtml(trophy.name) + '" loading="lazy" onerror="this.src=\'../assets/favicon.png\'" />',
      '  <div class="trophy-content">',
      '    <p class="trophy-name" title="' + escapeHtml(trophy.name) + '">' + escapeHtml(trophy.name) + '</p>',
      '    <p class="trophy-meta">' + escapeHtml(trophy.metaText) + '</p>',
      '    <p class="trophy-bonus">' + escapeHtml(bonusText) + '</p>',
      '    <label class="owned-toggle">',
      '      <input class="owned-checkbox" type="checkbox" data-id="' + escapeHtml(trophy.id) + '" ' + (isOwned ? 'checked' : '') + ' />',
      '      <span>' + (isOwned ? 'Owned' : 'Mark owned') + '</span>',
      '    </label>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderProgress() {
    var total = trophies.length;
    var owned = getOwnedCount();
    var percent = total ? Math.round((owned / total) * 100) : 0;
    var visibleCount = searchQuery ? Object.values(buildGroupedTrophies()).reduce(function (sum, items) { return sum + items.length; }, 0) : total;

    elements.baseProgressText.textContent = owned + ' / ' + total;
    elements.baseProgressPercent.textContent = percent + '%';
    elements.baseProgressFill.style.width = percent + '%';
    elements.resultSummary.textContent = searchQuery
      ? 'Showing ' + visibleCount + ' matching trophies.'
      : 'Tracking ' + total + ' total base trophies.';
  }

  function renderBonusList() {
    var currentTotals = {};
    var maxTotals = {};

    trophies.forEach(function (trophy) {
      trophy.bonuses.forEach(function (bonus) {
        var value = parseBonusValue(bonus.value);
        if (!maxTotals[bonus.stat]) maxTotals[bonus.stat] = 0;
        maxTotals[bonus.stat] += value;

        if (ownedState[trophy.id]) {
          if (!currentTotals[bonus.stat]) currentTotals[bonus.stat] = 0;
          currentTotals[bonus.stat] += value;
        }
      });
    });

    var orderedStats = STAT_ORDER.filter(function (stat) {
      return Object.prototype.hasOwnProperty.call(maxTotals, stat);
    });

    Object.keys(maxTotals)
      .sort(function (a, b) { return a.localeCompare(b); })
      .forEach(function (stat) {
        if (orderedStats.indexOf(stat) === -1) orderedStats.push(stat);
      });

    elements.bonusCount.textContent = String(orderedStats.length);

    if (!orderedStats.length) {
      elements.bonusList.innerHTML = '<p class="empty-state">No bonus stats found in trophy data.</p>';
      return;
    }

    elements.bonusList.innerHTML = orderedStats.map(function (stat) {
      var currentValue = currentTotals[stat] || 0;
      var maxValue = maxTotals[stat] || 0;

      return [
        '<div class="bonus-row">',
        '  <span class="bonus-name" title="' + escapeHtml(stat) + '">' + escapeHtml(stat) + '</span>',
        '  <span class="bonus-values">',
        '    <span class="bonus-current">+' + formatNumber(currentValue) + '%</span>',
        '    <span class="bonus-max"> / +' + formatNumber(maxValue) + '%</span>',
        '  </span>',
        '</div>'
      ].join('');
    }).join('');
  }

  function toggleOwned(id, checked) {
    if (!id) return;

    var updatedAt = Date.now();

    if (checked) {
      ownedState[id] = updatedAt;
    } else {
      delete ownedState[id];
    }

    persistOwnedState(updatedAt);
    render();
    scheduleTrophySync({ allowEmptyState: true });
  }

  function sanitizeOwnedState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return {};
    }

    var clean = {};
    Object.keys(state).forEach(function (trophyId) {
      if (!trophyId) return;
      var stamp = Number(state[trophyId]);
      clean[String(trophyId)] = Number.isFinite(stamp) && stamp > 0 ? Math.round(stamp) : Date.now();
    });
    return clean;
  }

  function getOwnedStateForUser(userId) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + String(userId || 'local')) || '{}';
      return sanitizeOwnedState(JSON.parse(raw));
    } catch (error) {
      console.warn('Failed to load local trophy state:', error);
      return {};
    }
  }

  function getOwnedUpdatedAtForUser(userId) {
    try {
      var stamp = Number(localStorage.getItem(UPDATED_PREFIX + String(userId || 'local')) || '0');
      return Number.isFinite(stamp) && stamp > 0 ? Math.round(stamp) : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveOwnedStateForUser(userId, state, updatedAt) {
    var clean = sanitizeOwnedState(state);
    var stamp = Number(updatedAt);
    if (!Number.isFinite(stamp) || stamp <= 0) {
      stamp = Object.keys(clean).length > 0 ? Date.now() : 0;
    }
    localStorage.setItem(STORAGE_PREFIX + String(userId || 'local'), JSON.stringify(clean));
    localStorage.setItem(UPDATED_PREFIX + String(userId || 'local'), String(stamp));
    return clean;
  }

  function loadOwnedState() {
    return getOwnedStateForUser(getStorageIdentity().userId);
  }

  function persistOwnedState(updatedAt) {
    try {
      ownedState = saveOwnedStateForUser(getStorageIdentity().userId, ownedState, updatedAt);
    } catch (error) {
      console.warn('Failed to persist local trophy state:', error);
    }
  }

  function mergeOwnedStates() {
    var merged = {};
    for (var i = 0; i < arguments.length; i += 1) {
      var source = sanitizeOwnedState(arguments[i]);
      Object.keys(source).forEach(function (trophyId) {
        var stamp = Number(source[trophyId]) || Date.now();
        if (!merged[trophyId] || stamp > merged[trophyId]) {
          merged[trophyId] = stamp;
        }
      });
    }
    return merged;
  }

  function getApiBaseUrl() {
    return String(SUBMISSION_API_URL || '').trim().replace(/\/$/, '');
  }

  function hasTrophySyncBackend() {
    return !!getApiBaseUrl();
  }

  function syncTrophiesToBackend(state, updatedAt, options) {
    if (!discordUser || !hasTrophySyncBackend()) {
      return Promise.resolve(false);
    }

    options = options || {};

    var accessToken = getDiscordAccessToken();
    if (!accessToken) {
      console.warn('Trophy sync requires logging in with Discord again on this domain.');
      return Promise.resolve(false);
    }

    var cleanState = sanitizeOwnedState(state);
    var nextUpdatedAt = Number(updatedAt || getOwnedUpdatedAtForUser(discordUser.id)) || 0;
    var hasEntries = Object.keys(cleanState).length > 0;
    var allowEmptyState = !!options.allowEmptyState;
    var payload = {
      discordAccessToken: accessToken
    };

    if (hasEntries || (allowEmptyState && nextUpdatedAt > 0)) {
      payload.state = cleanState;
      payload.updatedAt = nextUpdatedAt > 0 ? nextUpdatedAt : Date.now();
      payload.allowEmptyState = allowEmptyState;
    }

    return fetch(getApiBaseUrl() + '/api/trophies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data || data.success === false) {
          throw new Error((data && data.error) || 'Trophy sync failed');
        }
        return data;
      });
    });
  }

  function scheduleTrophySync(options) {
    if (trophySyncTimer) {
      clearTimeout(trophySyncTimer);
    }

    var syncOptions = options || {};

    trophySyncTimer = setTimeout(function () {
      trophySyncTimer = null;
      syncTrophiesToBackend(ownedState, getOwnedUpdatedAtForUser(getStorageIdentity().userId), syncOptions)
        .then(function (data) {
          if (data && data.state) {
            ownedState = saveOwnedStateForUser(discordUser.id, data.state, data.updatedAt || Date.now());
            render();
          }
        })
        .catch(function (err) {
          console.warn('Trophy sync unavailable:', err);
        });
    }, 500);
  }

  function syncOwnedStateFromBackend() {
    if (trophySyncInFlight) return trophySyncInFlight;
    if (!discordUser || !hasTrophySyncBackend()) return Promise.resolve(false);

    var localState = getOwnedStateForUser(discordUser.id);
    var localUpdatedAt = getOwnedUpdatedAtForUser(discordUser.id);

    trophySyncInFlight = syncTrophiesToBackend(localState, localUpdatedAt)
      .then(function (data) {
        if (data && data.state) {
          ownedState = saveOwnedStateForUser(discordUser.id, data.state, data.updatedAt || localUpdatedAt || Date.now());
          render();
          return true;
        }
        return false;
      })
      .catch(function (err) {
        console.warn('Trophy sync skipped:', err);
        return false;
      })
      .finally(function () {
        trophySyncInFlight = null;
      });

    return trophySyncInFlight;
  }

  function promoteGuestOwnedStateToUser() {
    if (!discordUser) return;

    var guestState = getOwnedStateForUser('local');
    var userState = getOwnedStateForUser(discordUser.id);
    var merged = mergeOwnedStates(userState, guestState);
    var mergedUpdatedAt = Math.max(
      getOwnedUpdatedAtForUser(discordUser.id),
      getOwnedUpdatedAtForUser('local')
    );

    if (mergedUpdatedAt <= 0 && Object.keys(merged).length > 0) {
      mergedUpdatedAt = Date.now();
    }

    saveOwnedStateForUser(discordUser.id, merged, mergedUpdatedAt);
    ownedState = merged;
  }

  function getStorageIdentity() {
    try {
      if (discordUser && discordUser.id) {
        return { user: discordUser, userId: String(discordUser.id) };
      }
      var raw = localStorage.getItem('discord_user');
      if (!raw) return { user: null, userId: 'local' };
      var user = JSON.parse(raw);
      if (user && user.id) return { user: user, userId: String(user.id) };
    } catch (error) {
      console.warn('Failed to read discord_user from localStorage:', error);
    }

    return { user: null, userId: 'local' };
  }

  function getStorageKey() {
    return STORAGE_PREFIX + getStorageIdentity().userId;
  }

  function getUpdatedKey() {
    return UPDATED_PREFIX + getStorageIdentity().userId;
  }

  function getOwnedCount() {
    return trophies.filter(function (trophy) { return !!ownedState[trophy.id]; }).length;
  }

  function normalizeTrophies(items) {
    return items
      .map(function (item) {
        var trophyId = String(item.id || '');
        var bonuses = normalizeBonuses(item);
        var group = inferGroup(item.type || '');
        var metaText = item.category || item.creature || (item.type || 'Trophy');
        var iconPath = TROPHY_ICON_OVERRIDES[trophyId] || ('./icons/creature/' + encodeURIComponent(trophyId) + '.webp');

        return {
          id: trophyId,
          name: String(item.name || 'Unknown Trophy'),
          type: String(item.type || ''),
          category: String(item.category || ''),
          creature: String(item.creature || ''),
          bonuses: bonuses,
          group: group,
          metaText: metaText,
          iconPath: iconPath,
          searchBlob: [item.name, item.category, item.creature, item.type, bonuses.map(formatBonus).join(' ')].join(' ').toLowerCase()
        };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  function normalizeBonuses(item) {
    if (Array.isArray(item.bonuses) && item.bonuses.length) {
      return item.bonuses.map(function (bonus) {
        return {
          stat: String(bonus && bonus.stat ? bonus.stat : 'Unknown'),
          value: String(bonus && bonus.value ? bonus.value : '0%')
        };
      });
    }

    if (item.bonus && typeof item.bonus === 'object') {
      return [{
        stat: String(item.bonus.stat || 'Unknown'),
        value: String(item.bonus.value || '0%')
      }];
    }

    return [];
  }

  function inferGroup(type) {
    var value = String(type || '').toLowerCase();
    if (value.indexOf('carnival') !== -1) return 'Carnival';
    if (value.indexOf('monument') !== -1) return 'Monuments';
    if (value.indexOf('ocean') !== -1) return 'Ocean';
    return 'Creatures';
  }

  function parseBonusValue(value) {
    var match = String(value || '').match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : 0;
  }

  function formatBonus(bonus) {
    return String(bonus.value || '') + ' ' + String(bonus.stat || '');
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  function generateRandomString(length) {
    var arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode.apply(null, arr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
      .slice(0, length);
  }

  function createCodeChallenge(verifier) {
    var encoder = new TextEncoder();
    var data = encoder.encode(verifier);
    return crypto.subtle.digest('SHA-256', data).then(function (hash) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    });
  }

  function startDiscordLogin() {
    var state = generateRandomString(32);
    var codeVerifier = generateRandomString(64);

    sessionStorage.setItem('discord_state', state);
    sessionStorage.setItem('discord_code_verifier', codeVerifier);

    createCodeChallenge(codeVerifier).then(function (codeChallenge) {
      var url = 'https://discord.com/oauth2/authorize' +
        '?client_id=' + encodeURIComponent(DISCORD_CLIENT_ID) +
        '&redirect_uri=' + encodeURIComponent(DISCORD_REDIRECT_URI) +
        '&response_type=code' +
        '&scope=' + encodeURIComponent(DISCORD_SCOPES) +
        '&state=' + encodeURIComponent(state) +
        '&code_challenge=' + encodeURIComponent(codeChallenge) +
        '&code_challenge_method=S256';
      window.location.href = url;
    });
  }

  function storeDiscordSession(tokenData) {
    if (!tokenData || !tokenData.access_token) return;

    var expiresAt = Number(tokenData.expires_in);
    expiresAt = Number.isFinite(expiresAt) && expiresAt > 0
      ? Date.now() + (expiresAt * 1000) - 60000
      : 0;

    try {
      sessionStorage.setItem('discord_access_token', tokenData.access_token);
      localStorage.setItem('discord_access_token', tokenData.access_token);

      if (expiresAt > 0) {
        sessionStorage.setItem('discord_access_token_expires_at', String(expiresAt));
        localStorage.setItem('discord_access_token_expires_at', String(expiresAt));
      }
    } catch (error) {}
  }

  function handleOAuthCallback() {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    var oauthError = params.get('error');
    var oauthErrorDescription = params.get('error_description');

    if (oauthError) {
      console.error('Discord OAuth rejected:', oauthError, oauthErrorDescription || '');
      window.history.replaceState({}, '', window.location.pathname);
      alert('Discord login was not completed. If this keeps happening, make sure this exact redirect URL is added in the Discord app settings: ' + DISCORD_REDIRECT_URI);
      return Promise.resolve(false);
    }

    if (!code || !state) return Promise.resolve(false);

    window.history.replaceState({}, '', window.location.pathname);

    var savedState = sessionStorage.getItem('discord_state');
    var codeVerifier = sessionStorage.getItem('discord_code_verifier');
    sessionStorage.removeItem('discord_state');
    sessionStorage.removeItem('discord_code_verifier');

    if (state !== savedState || !codeVerifier) {
      console.error('Discord OAuth: state mismatch or missing verifier');
      return Promise.resolve(false);
    }

    return fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_id=' + encodeURIComponent(DISCORD_CLIENT_ID) +
        '&grant_type=authorization_code' +
        '&code=' + encodeURIComponent(code) +
        '&redirect_uri=' + encodeURIComponent(DISCORD_REDIRECT_URI) +
        '&code_verifier=' + encodeURIComponent(codeVerifier)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Token exchange failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        storeDiscordSession(data);
        return fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: 'Bearer ' + data.access_token }
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error('User fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (user) {
        discordUser = {
          id: user.id,
          username: user.username,
          globalName: user.global_name || user.username,
          avatar: user.avatar
        };
        localStorage.setItem('discord_user', JSON.stringify(discordUser));
        updateAuthUI();
        return true;
      })
      .catch(function (err) {
        console.error('Discord OAuth error:', err);
        return false;
      });
  }

  function getDiscordAccessToken() {
    try {
      var token = sessionStorage.getItem('discord_access_token') ||
        localStorage.getItem('discord_access_token') || '';
      var expiresAt = Number(
        sessionStorage.getItem('discord_access_token_expires_at') ||
        localStorage.getItem('discord_access_token_expires_at') || '0'
      );

      if (expiresAt > 0 && Date.now() >= expiresAt) return '';
      return token;
    } catch (error) {
      return '';
    }
  }

  function clearDiscordSession() {
    try {
      sessionStorage.removeItem('discord_access_token');
      sessionStorage.removeItem('discord_access_token_expires_at');
    } catch (error) {}

    try {
      localStorage.removeItem('discord_access_token');
      localStorage.removeItem('discord_access_token_expires_at');
    } catch (error) {}
  }

  function loadSavedDiscordUser() {
    try {
      var saved = localStorage.getItem('discord_user');
      if (!saved) return;

      if (!getDiscordAccessToken()) {
        localStorage.removeItem('discord_user');
        clearDiscordSession();
        return;
      }

      discordUser = JSON.parse(saved);
    } catch (error) {
      localStorage.removeItem('discord_user');
      clearDiscordSession();
    }
  }

  function logoutDiscord() {
    discordUser = null;
    localStorage.removeItem('discord_user');
    clearDiscordSession();
    ownedState = loadOwnedState();
    updateAuthUI();
    render();
  }

  function updateAuthUI() {
    var loginBtn = document.getElementById('btn-discord-login');
    var userDisplay = document.getElementById('discord-user-display');
    var userName = document.getElementById('discord-username');

    if (!loginBtn || !userDisplay || !userName) return;

    if (discordUser) {
      loginBtn.style.display = 'none';
      userDisplay.style.display = 'flex';
      userName.textContent = discordUser.globalName || discordUser.username || discordUser.id;
    } else {
      loginBtn.style.display = '';
      userDisplay.style.display = 'none';
    }
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
