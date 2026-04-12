/**
 * RavenHUD Interactive World Map
 *
 * Vanilla JS + Leaflet. Loads markers from the repo's data/worldmap-markers.json
 * via raw GitHub URL (single source of truth — never duplicated).
 *
 * Discord OAuth2 PKCE for verified identity. Marker submissions can be
 * auto-sent through a small backend, with direct GitHub issue fallback.
 */

/* global L */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

var BASE_PATH = window.location.pathname.replace(/(?:index\.html)?\/?$/, '');

var DATA_URL = BASE_PATH + '/data/worldmap-markers.json';
var CONTRIBUTIONS_URL = BASE_PATH + '/data/worldmap-contributions.json';

var TILE_URL = 'https://assets.ravenquest.tools/map/{z}/{x}/{y}.png';

var MAP_CONFIG = {
  imageWidth: 8192,
  imageHeight: 4608,
  tileSize: 256,
  maxNativeZoom: 5,
  minZoom: 1,
  maxZoom: 7
};

var CORVID_API_URL = String(window.RAVENHUD_CORVID_API_URL || '').trim();

var DISCORD_CLIENT_ID = '1491050953221079223';
var DISCORD_REDIRECT_URI = window.location.origin + (BASE_PATH ? BASE_PATH + '/' : '/');
var DISCORD_SCOPES = 'identify';
var SUBMISSION_API_URL = window.RAVENHUD_API_URL || '';

var GITHUB_REPO = 'Azurak666/Raven_hud';
var LEGACY_SCREENSHOT_REPO = 'Pix-Elated/ravenhud';
var DONATE_WALLET_ADDRESS = '0xe69165e7781468bf0979419d0def401b13a3ac50';

function buildScreenshotUrl(relativePath) {
  if (!relativePath) return '';
  return BASE_PATH + '/data/' + String(relativePath).replace(/^\/+/, '');
}

function buildLegacyScreenshotUrl(relativePath) {
  if (!relativePath || !LEGACY_SCREENSHOT_REPO) return '';
  return 'https://raw.githubusercontent.com/' + LEGACY_SCREENSHOT_REPO +
    '/master/data/' + String(relativePath).replace(/^\/+/, '');
}

// Category metadata — uses game icon files when available, emoji as fallback
var CATEGORIES = {
  dynamic_event: { label: 'Dynamic Events', emoji: '\u26A1', icon: 'dynamic_event.webp', group: 'Events' },
  expedition: { label: 'Expeditions', emoji: '\uD83E\uDDED', icon: 'expedition.webp', group: 'Exploration' },
  creature_spawn: { label: 'Elite Spawns', emoji: '\uD83D\uDC80', icon: 'elitespawn.webp', group: 'Exploration' },
  reputation_shiny: { label: 'Reputation (Shiny)', emoji: '\u2728', icon: null, group: 'Reputation' },
  npc_reputation: { label: 'Reputation (NPC)', emoji: '\uD83D\uDC64', icon: 'npc_reputation.webp', group: 'Reputation' }
};

// Category groups for sidebar ordering
var GROUP_ORDER = ['Events', 'Exploration', 'Reputation'];

/**
 * POST to a Corvid API endpoint. Returns { ok, data } or throws.
 */
function fetchCorvidAPI(endpoint, body) {
  if (!CORVID_API_URL) {
    return Promise.resolve({ ok: false, skipped: true, data: null });
  }

  return fetch(CORVID_API_URL + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.json().then(function (data) {
      return { ok: res.ok, data: data };
    });
  });
}

var GITHUB_ISSUES_NEW_URL = 'https://github.com/' + GITHUB_REPO + '/issues/new';

function getSubmissionApiBaseUrl() {
  return String(SUBMISSION_API_URL || '').trim().replace(/\/$/, '');
}

function hasSubmissionBackend() {
  return !!getSubmissionApiBaseUrl();
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
  } catch (e) {
    return '';
  }
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
  } catch (e) { /* ignore storage errors */ }
}

function clearDiscordSession() {
  try {
    sessionStorage.removeItem('discord_access_token');
    sessionStorage.removeItem('discord_access_token_expires_at');
  } catch (e) { /* ignore storage errors */ }

  try {
    localStorage.removeItem('discord_access_token');
    localStorage.removeItem('discord_access_token_expires_at');
  } catch (e) { /* ignore storage errors */ }
}

function getSubmissionButtonText(mode) {
  return hasSubmissionBackend()
    ? (mode === 'edit' ? 'Submit Edit' : 'Submit Marker')
    : 'Open GitHub Issue';
}

function escapeMarkdownCell(value) {
  return String(value == null ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function buildMarkerIssueTitle(marker, authorName, mode) {
  if (mode === 'delete') return 'Delete Marker: ' + marker.name + ' (by ' + authorName + ')';
  if (mode === 'edit') return 'Edit Marker: ' + marker.name + ' (by ' + authorName + ')';
  return 'Map Marker: ' + marker.name + ' (by ' + authorName + ')';
}

function buildMarkerIssueBody(body, options) {
  options = options || {};
  var marker = (body.markers && body.markers[0]) || {};
  var originalMarker = body.originalMarker || {};
  var issuePayload = {
    markers: body.markers || [],
    authorName: body.authorName || '',
    authorDiscordId: body.authorDiscordId || ''
  };

  if (body.originalMarker) issuePayload.originalMarker = body.originalMarker;
  if (options.mode === 'delete') issuePayload.deletionRequest = true;
  if (body.screenshot) {
    issuePayload.screenshot = '[Upload screenshot manually in the GitHub issue after it opens]';
  }

  var lines = [
    '# RavenHUD Map Marker Contribution',
    '',
    'Exported: ' + new Date().toISOString().slice(0, 10),
    'Contributor: ' + (body.authorName || 'Unknown'),
    body.authorDiscordId ? 'Discord ID: ' + body.authorDiscordId : '',
    ''
  ];

  if (options.mode === 'edit' && body.originalMarker) {
    lines.push('**Requested change:** update an existing marker entry.');
    lines.push('');
    lines.push('### Changes Requested');
    lines.push('');

    var changeLines = buildMarkerChangeLines(originalMarker, marker);
    if (changeLines.length) {
      lines = lines.concat(changeLines);
    } else {
      lines.push('- No field-level differences were detected in the submitted values.');
    }

    lines.push('');
    lines.push('### Original Marker');
    lines.push('');
    lines.push('| Category | Name | X | Y | Floor | Description | Region |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    lines.push('| ' + [
      escapeMarkdownCell(originalMarker.category || marker.category || ''),
      escapeMarkdownCell(originalMarker.name || ''),
      escapeMarkdownCell(originalMarker.x || ''),
      escapeMarkdownCell(originalMarker.y || ''),
      escapeMarkdownCell(originalMarker.floor || 'surface'),
      escapeMarkdownCell(originalMarker.description || ''),
      escapeMarkdownCell(originalMarker.region || '')
    ].join(' | ') + ' |');
    lines.push('');
    lines.push('### Updated Marker');
    lines.push('');
  } else if (options.mode === 'delete') {
    lines.push('**Requested change:** review and remove this marker if needed.');
    lines.push('');
  }

  lines.push('| Category | Name | X | Y | Floor | Description | Region | Author |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  lines.push('| ' + [
    escapeMarkdownCell(marker.category || ''),
    escapeMarkdownCell(marker.name || ''),
    escapeMarkdownCell(marker.x || ''),
    escapeMarkdownCell(marker.y || ''),
    escapeMarkdownCell(marker.floor || 'surface'),
    escapeMarkdownCell(marker.description || ''),
    escapeMarkdownCell(marker.region || ''),
    escapeMarkdownCell(body.authorName || '')
  ].join(' | ') + ' |');
  lines.push('');

  if (body.screenshot) {
    lines.push('> A screenshot was included in the site form. Please paste or upload it manually in the GitHub issue before submitting.');
    lines.push('');
  }

  lines.push('<details>');
  lines.push('<summary>Raw JSON (for automated import)</summary>');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(issuePayload, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</details>');

  return lines.filter(Boolean).join('\n');
}

function buildMarkerChangeLines(originalMarker, updatedMarker) {
  var fields = [
    ['category', 'Category', ''],
    ['name', 'Name', ''],
    ['x', 'X', ''],
    ['y', 'Y', ''],
    ['floor', 'Floor', 'surface'],
    ['description', 'Description', ''],
    ['region', 'Region', '']
  ];

  return fields.reduce(function (items, field) {
    var key = field[0];
    var label = field[1];
    var fallback = field[2];
    var before = normalizeMarkerFieldValue(originalMarker[key], fallback);
    var after = normalizeMarkerFieldValue(updatedMarker[key], fallback);
    if (before === after) return items;
    items.push('- **' + label + ':** ' + formatMarkerChangeValue(before) + ' → ' + formatMarkerChangeValue(after));
    return items;
  }, []);
}

function normalizeMarkerFieldValue(value, fallback) {
  var normalized = (value == null || value === '') ? (fallback || '') : value;
  return String(normalized == null ? '' : normalized).trim();
}

function formatMarkerChangeValue(value) {
  var text = escapeMarkdownCell(normalizeMarkerFieldValue(value) || '(empty)');
  return '`' + text.replace(/`/g, '\\`') + '`';
}

function openGitHubMarkerIssue(body, options) {
  options = options || {};
  var marker = (body.markers && body.markers[0]) || {};
  var params = new URLSearchParams();
  params.set('title', buildMarkerIssueTitle(marker, body.authorName || 'Unknown', options.mode));
  params.set('labels', 'map-markers');
  params.set('body', buildMarkerIssueBody(body, options));

  var popup = window.open(GITHUB_ISSUES_NEW_URL + '?' + params.toString(), '_blank', 'noopener');
  if (!popup) {
    throw new Error('Popup blocked. Allow pop-ups to open the GitHub issue.');
  }

  return true;
}

function submitMarkerRequest(body, options) {
  options = options || {};

  var payload = Object.assign({}, body);
  if (discordUser) {
    payload.authorName = getVerifiedSubmitAuthorName();
    payload.authorDiscordId = discordUser.id;
  }

  if (!hasSubmissionBackend()) {
    try {
      openGitHubMarkerIssue(payload, options);
      return Promise.resolve({ ok: true, data: { success: true, via: 'github-issue' } });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  try {
    var accessToken = getDiscordAccessToken();
    if (accessToken) payload.discordAccessToken = accessToken;
  } catch (e) { /* ignore storage errors */ }

  return fetch(getSubmissionApiBaseUrl() + '/api/markers/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Submission failed');
      }
      return { ok: true, data: Object.assign({ via: 'backend' }, data) };
    });
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

var map;
var rc;
var clusterGroup;
var allMarkers = [];
var contributionLog = [];
var leafletMarkers = new Map(); // id -> L.Marker
var visibility = {};
var submitCoords = null;
var modalMode = 'submit'; // 'submit' or 'edit'
var editingMarker = null; // marker being edited
var discordUser = null; // { id, username, globalName, avatar }
var previewMarker = null; // L.Marker for position preview
var pendingScreenshot = null; // base64 webp string
var hideCollected = false; // Filter: hide collected shiny/NPC markers
var collectedSyncTimer = null;
var collectedSyncInFlight = null;
var UI_PREFERENCES_KEY = 'rhud_ui_preferences';

function loadUiPreferences() {
  try {
    var raw = localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return {};

    var prefs = JSON.parse(raw);
    return prefs && typeof prefs === 'object' ? prefs : {};
  } catch (e) {
    localStorage.removeItem(UI_PREFERENCES_KEY);
    return {};
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify({
      visibility: visibility,
      hideCollected: !!hideCollected
    }));
  } catch (e) { /* ignore storage errors */ }
}

function applyUiPreferences() {
  var prefs = loadUiPreferences();
  var savedVisibility = prefs && typeof prefs.visibility === 'object' ? prefs.visibility : {};

  Object.keys(CATEGORIES).forEach(function (key) {
    if (typeof savedVisibility[key] === 'boolean') {
      visibility[key] = savedVisibility[key];
    }
  });

  if (typeof prefs.hideCollected === 'boolean') {
    hideCollected = prefs.hideCollected;
  }
}

// Shiny collection checklist (stored locally and synced to the backend when available)
function getShinyCollectedKey(userId) {
  return 'rhud_shiny_collected_' + (userId || (discordUser ? discordUser.id : 'local'));
}

function getShinyCollectedUpdatedKey(userId) {
  return 'rhud_shiny_collected_updated_' + (userId || (discordUser ? discordUser.id : 'local'));
}

function sanitizeCollectedState(state) {
  var clean = {};
  if (!state || typeof state !== 'object') return clean;

  Object.keys(state).forEach(function (markerId) {
    if (!state[markerId]) return;
    var stamp = Number(state[markerId]);
    clean[markerId] = Number.isFinite(stamp) && stamp > 0 ? stamp : Date.now();
  });

  return clean;
}

function getCollectedStateForUser(userId) {
  try {
    return sanitizeCollectedState(JSON.parse(localStorage.getItem(getShinyCollectedKey(userId)) || '{}'));
  } catch (e) {
    return {};
  }
}

function getCollectedUpdatedAtForUser(userId) {
  try {
    var stamp = Number(localStorage.getItem(getShinyCollectedUpdatedKey(userId)) || '0');
    return Number.isFinite(stamp) && stamp > 0 ? stamp : 0;
  } catch (e) {
    return 0;
  }
}

function saveCollectedStateForUser(userId, state, updatedAt) {
  var clean = sanitizeCollectedState(state);
  var stamp = Number(updatedAt);
  if (!Number.isFinite(stamp) || stamp <= 0) {
    stamp = Object.keys(clean).length > 0 ? Date.now() : 0;
  }
  localStorage.setItem(getShinyCollectedKey(userId), JSON.stringify(clean));
  localStorage.setItem(getShinyCollectedUpdatedKey(userId), String(stamp));
  return clean;
}

function getShinyCollected() {
  if (!discordUser) return {};
  return getCollectedStateForUser(discordUser.id);
}

function setShinyCollected(state, updatedAt) {
  if (!discordUser) return {};
  return saveCollectedStateForUser(discordUser.id, state, updatedAt);
}

function getShinyCollectedUpdatedAt() {
  if (!discordUser) return 0;
  return getCollectedUpdatedAtForUser(discordUser.id);
}

function mergeCollectedStates() {
  var merged = {};

  for (var i = 0; i < arguments.length; i += 1) {
    var source = sanitizeCollectedState(arguments[i]);
    Object.keys(source).forEach(function (markerId) {
      var stamp = Number(source[markerId]) || Date.now();
      if (!merged[markerId] || stamp > Number(merged[markerId])) {
        merged[markerId] = stamp;
      }
    });
  }

  return merged;
}

function syncCollectedToBackend(state, updatedAt, options) {
  if (!discordUser || !hasSubmissionBackend()) {
    return Promise.resolve({ ok: false, skipped: true });
  }

  options = options || {};

  var accessToken = getDiscordAccessToken();
  if (!accessToken) {
    console.warn('Collected marks sync requires logging in with Discord again on this domain.');
    return Promise.resolve({ ok: false, skipped: true, reason: 'missing-token' });
  }

  var cleanState = sanitizeCollectedState(state);
  var nextUpdatedAt = Number(updatedAt || getShinyCollectedUpdatedAt()) || 0;
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

  return fetch(getSubmissionApiBaseUrl() + '/api/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Collection sync failed');
      }
      return { ok: true, data: data };
    });
  });
}

function refreshCollectedViews() {
  if (!allMarkers || allMarkers.length === 0) return;
  buildSidebar();
  renderMarkers();
  updateStats();
  if (currentDetailMarker) showDetail(currentDetailMarker);
}

function scheduleCollectedSync(options) {
  if (collectedSyncTimer) {
    clearTimeout(collectedSyncTimer);
  }

  var syncOptions = options || {};

  collectedSyncTimer = setTimeout(function () {
    collectedSyncTimer = null;
    syncCollectedToBackend(getShinyCollected(), getShinyCollectedUpdatedAt(), syncOptions)
      .catch(function (err) {
        console.warn('Collected marks sync unavailable:', err);
      });
  }, 350);
}

function syncCollectedStateFromBackend() {
  if (collectedSyncInFlight) return collectedSyncInFlight;
  if (!discordUser || !hasSubmissionBackend()) return Promise.resolve(false);

  var localState = getShinyCollected();
  var localUpdatedAt = getShinyCollectedUpdatedAt();

  collectedSyncInFlight = syncCollectedToBackend(localState, localUpdatedAt)
    .then(function (result) {
      if (!result || result.skipped) return false;
      var data = result && result.data ? result.data : {};
      setShinyCollected(data.state || localState, data.updatedAt || localUpdatedAt || Date.now());
      refreshCollectedViews();
      return true;
    })
    .catch(function (err) {
      console.warn('Collected marks sync skipped:', err);
      return false;
    })
    .finally(function () {
      collectedSyncInFlight = null;
    });

  return collectedSyncInFlight;
}

function promoteGuestCollectedStateToUser() {
  if (!discordUser) return;

  var guestState = getCollectedStateForUser('local');
  var userState = getCollectedStateForUser(discordUser.id);
  var merged = mergeCollectedStates(userState, guestState);
  var mergedUpdatedAt = Math.max(
    getCollectedUpdatedAtForUser(discordUser.id),
    getCollectedUpdatedAtForUser('local')
  );

  if (mergedUpdatedAt <= 0 && Object.keys(merged).length > 0) {
    mergedUpdatedAt = Date.now();
  }

  saveCollectedStateForUser(discordUser.id, merged, mergedUpdatedAt);
}

function toggleShinyCollected(markerId) {
  if (!discordUser) {
    startDiscordLogin();
    return false;
  }

  var state = getShinyCollected();
  var updatedAt = Date.now();
  if (state[markerId]) {
    delete state[markerId];
  } else {
    state[markerId] = updatedAt;
  }
  setShinyCollected(state, updatedAt);
  scheduleCollectedSync({ allowEmptyState: true });
  return !!state[markerId];
}

function getRepProgress(category) {
  var state = getShinyCollected();
  var markers = allMarkers.filter(function (m) {
    return m.category === category && m.floor === 'surface';
  });
  var collected = markers.filter(function (m) { return state[m.id]; }).length;
  return { collected: collected, total: markers.length };
}

// ---------------------------------------------------------------------------
// Discord OAuth2 PKCE
// ---------------------------------------------------------------------------

function generateRandomString(length) {
  var arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  // base64url encode
  return btoa(String.fromCharCode.apply(null, arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    .slice(0, length);
}

function createCodeChallenge(verifier) {
  var encoder = new TextEncoder();
  var data = encoder.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then(function (hash) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(hash)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
}

function startDiscordLogin() {
  var state = generateRandomString(32);
  var codeVerifier = generateRandomString(64);

  // Store PKCE params for when Discord redirects back
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

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  var savedState = sessionStorage.getItem('discord_state');
  var codeVerifier = sessionStorage.getItem('discord_code_verifier');
  sessionStorage.removeItem('discord_state');
  sessionStorage.removeItem('discord_code_verifier');

  if (state !== savedState || !codeVerifier) {
    console.error('Discord OAuth: state mismatch or missing verifier');
    return Promise.resolve(false);
  }

  // Exchange code for token
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
    .then(async function (user) {
      discordUser = {
        id: user.id,
        username: user.username,
        globalName: user.global_name || user.username,
        avatar: user.avatar
      };
      localStorage.setItem('discord_user', JSON.stringify(discordUser));
      promoteGuestCollectedStateToUser();

      updateAuthUI();
      return true;
    })
    .catch(function (err) {
      console.error('Discord OAuth error:', err);
      return false;
    });
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
    promoteGuestCollectedStateToUser();
  } catch (e) {
    localStorage.removeItem('discord_user');
    clearDiscordSession();
  }
}

function logoutDiscord() {
  // Save current collection to the user's local cache before logging out
  if (discordUser) {
    saveCollectedStateForUser(discordUser.id, getShinyCollected(), getShinyCollectedUpdatedAt());
  }
  discordUser = null;
  localStorage.removeItem('discord_user');
  clearDiscordSession();
  updateAuthUI();
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

var IDENTITY_KEY = 'rhud_identity';
var IDENTITY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ---------------------------------------------------------------------------
// Browser Fingerprint (UEBA)
// ---------------------------------------------------------------------------

// Combines stable browser/device signals into a single hash. Used by Corvid's
// submission logger to cluster evasion attempts across cleared cookies + cache.
// Each signal contributes entropy; together we get enough stability to link
// repeated visits from the same browser/machine even after identity changes.
// ~30-40 bits of entropy in aggregate. Not unique per user but discriminative
// enough for the "same person lying about their name" detection use case.
var fingerprintCache = null;

async function computeFingerprint() {
  if (fingerprintCache) return fingerprintCache;

  var signals = [];
  signals.push(navigator.userAgent || '');
  signals.push(navigator.language || '');
  signals.push(navigator.languages ? navigator.languages.join(',') : '');
  signals.push(screen.width + 'x' + screen.height + 'x' + (screen.colorDepth || 0));
  signals.push(String(window.devicePixelRatio || 1));
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  signals.push(String(navigator.hardwareConcurrency || 0));
  signals.push(String(navigator.deviceMemory || 0));
  signals.push(String(new Date().getTimezoneOffset()));

  // Canvas fingerprint — text rendered to a canvas produces slightly different
  // pixels on every GPU / driver / font stack combination.
  try {
    var canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('RavenHUD fingerprint \uD83D\uDC26', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('RavenHUD fingerprint \uD83D\uDC26', 4, 17);
    signals.push(canvas.toDataURL());
  } catch (e) { /* canvas blocked, skip */ }

  // WebGL renderer — GPU identification string, very stable
  try {
    var gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        signals.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
        signals.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '');
      }
    }
  } catch (e) { /* WebGL blocked, skip */ }

  var combined = signals.join('||');
  var buf = new TextEncoder().encode(combined);
  try {
    var hash = await crypto.subtle.digest('SHA-256', buf);
    var hex = Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
    fingerprintCache = 'fp_' + hex.slice(0, 32);
  } catch (e) {
    // Fallback for browsers without SubtleCrypto (extremely old)
    fingerprintCache = 'fp_fallback_' + combined.length;
  }
  return fingerprintCache;
}

function getSavedIdentity() {
  try {
    var raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    var identity = JSON.parse(raw);
    if (Date.now() - identity.timestamp > IDENTITY_TTL_MS) {
      localStorage.removeItem(IDENTITY_KEY);
      return null;
    }
    return identity;
  } catch (e) {
    localStorage.removeItem(IDENTITY_KEY);
    return null;
  }
}

function saveIdentity(characterName, guildTag, authorName) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({
    characterName: characterName,
    guildTag: guildTag,
    authorName: authorName || '',
    timestamp: Date.now()
  }));
}

function getPreferredAuthorName() {
  var discordName = discordUser ? (discordUser.globalName || discordUser.username || '') : '';
  if (discordName) return discordName;

  var identity = getSavedIdentity() || {};
  var preferred = (identity.authorName || '').trim();
  return preferred;
}

function getVerifiedSubmitAuthorName() {
  return discordUser ? (discordUser.globalName || discordUser.username || '') : getPreferredAuthorName();
}

function rememberPreferredAuthorName(name) {
  var identity = getSavedIdentity() || { characterName: '', guildTag: '' };
  saveIdentity(identity.characterName || '', identity.guildTag || '', (name || '').trim());
}

function normalizeContributorName(name) {
  var trimmed = String(name || '').trim().toLowerCase();
  if (!trimmed) return '';

  var baseName = trimmed.split('|')[0].trim();
  return baseName.replace(/\s+/g, ' ');
}

function getContributorAliases() {
  var aliases = [];
  var names = [
    getPreferredAuthorName(),
    discordUser ? (discordUser.globalName || discordUser.username || '') : '',
    discordUser ? (discordUser.username || '') : ''
  ];

  names.forEach(function (name) {
    var trimmed = String(name || '').trim();
    if (!trimmed) return;
    aliases.push(normalizeContributorName(trimmed));
    var baseName = trimmed.split('|')[0].trim();
    if (baseName) aliases.push(normalizeContributorName(baseName));
  });

  return Array.from(new Set(aliases.filter(Boolean)));
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateAuthUI() {
  var loginBtn = document.getElementById('btn-discord-login');
  var userDisplay = document.getElementById('discord-user-display');
  var userName = document.getElementById('discord-username');
  var submitBtn = document.getElementById('btn-submit');
  var editBtn = document.getElementById('btn-suggest-edit');
  var deleteBtn = document.getElementById('btn-suggest-delete');

  if (discordUser) {
    loginBtn.style.display = 'none';
    userDisplay.style.display = 'flex';
    userName.textContent = discordUser.globalName || discordUser.username;
    submitBtn.disabled = false;
    submitBtn.title = 'Submit a marker';
    if (editBtn) {
      editBtn.disabled = false;
      editBtn.title = '';
    }
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.title = '';
    }
  } else {
    loginBtn.style.display = '';
    userDisplay.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.title = 'Login with Discord to submit';
    if (editBtn) {
      editBtn.disabled = true;
      editBtn.title = 'Login with Discord to submit';
    }
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.title = 'Login with Discord to suggest deletion';
    }
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

async function loadContributionLog() {
  try {
    var res = await fetch(CONTRIBUTIONS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    contributionLog = Array.isArray(data) ? data : [];
  } catch (err) {
    contributionLog = [];
    if (!String((err && err.message) || err || '').includes('HTTP 404')) {
      console.warn('Failed to load contribution log:', err);
    }
  }
}

async function init() {
  var identity = getSavedIdentity() || { characterName: '', guildTag: '' };
  var isNewIdentity = false;

  // Compute the browser fingerprint up-front so we can send it with the
  // identity log. Used by Corvid's /cluster admin command to detect evasion.
  var fingerprint = await computeFingerprint();

  // Optional identity log — send it in the background only when Corvid is configured.
  if (CORVID_API_URL) {
    try {
      fetch(CORVID_API_URL + '/api/identity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: identity.characterName,
          guildTag: identity.guildTag,
          timestamp: new Date().toISOString(),
          isNewIdentity: isNewIdentity,
          fingerprint: fingerprint,
          discordId: discordUser ? discordUser.id : undefined
        })
      }).catch(function () { /* Fail-open: if Corvid is down, continue */ });
    } catch (e) { /* Fail-open: if Corvid is down, continue */ }
  }

  // Discord login is separate — restore saved session and handle OAuth callback
  loadSavedDiscordUser();
  await handleOAuthCallback();

  initMap();
  initSidebar();
  initDetailPanel();
  initModal();
  initAuth();
  initInfoModal();
  initDonate();
  initLeaderboard();
  updateAuthUI();
  syncCollectedStateFromBackend();

  try {
    var res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allMarkers = await res.json();
  } catch (err) {
    console.error('Failed to load markers:', err);
    allMarkers = [];
  }

  await loadContributionLog();

  // Default all categories visible
  for (var key of Object.keys(CATEGORIES)) {
    visibility[key] = true;
  }
  applyUiPreferences();

  // Apply any locally-persisted edits before rendering
  applyLocalEdits();

  buildSidebar();
  renderMarkers();
  updateStats();
}

function initAuth() {
  document.getElementById('btn-discord-login').addEventListener('click', startDiscordLogin);
  document.getElementById('btn-discord-logout').addEventListener('click', logoutDiscord);
}

function initInfoModal() {
  var openBtn = document.getElementById('btn-info');
  var modal = document.getElementById('about-modal');
  var closeBtn = document.getElementById('about-close');
  var closeActionBtn = document.getElementById('btn-close-about');

  function closeInfoModal() {
    modal.hidden = true;
  }

  openBtn.addEventListener('click', function () {
    modal.hidden = false;
  });

  closeBtn.addEventListener('click', closeInfoModal);
  closeActionBtn.addEventListener('click', closeInfoModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeInfoModal();
  });
}

function initDonate() {
  var openBtn = document.getElementById('btn-donate');
  var modal = document.getElementById('donate-modal');
  var closeBtn = document.getElementById('donate-close');
  var closeActionBtn = document.getElementById('btn-close-donate');
  var copyBtn = document.getElementById('btn-copy-wallet');
  var walletEl = document.getElementById('donate-wallet-address');

  function closeDonateModal() {
    modal.hidden = true;
  }

  openBtn.addEventListener('click', function () {
    walletEl.textContent = DONATE_WALLET_ADDRESS;
    modal.hidden = false;
  });

  closeBtn.addEventListener('click', closeDonateModal);
  closeActionBtn.addEventListener('click', closeDonateModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeDonateModal();
  });

  copyBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(DONATE_WALLET_ADDRESS).then(function () {
      copyBtn.textContent = 'Copied!';
      setTimeout(function () {
        copyBtn.textContent = 'Copy Address';
      }, 1400);
    }).catch(function () {
      copyBtn.textContent = 'Copy failed';
      setTimeout(function () {
        copyBtn.textContent = 'Copy Address';
      }, 1400);
    });
  });
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

function initMap() {
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    zoomControl: true,
    attributionControl: true
  });

  rc = new L.RasterCoords(map, [MAP_CONFIG.imageWidth, MAP_CONFIG.imageHeight], MAP_CONFIG.tileSize);
  var southWest = rc.unproject([0, MAP_CONFIG.imageHeight]);
  var northEast = rc.unproject([MAP_CONFIG.imageWidth, 0]);
  var bounds = new L.LatLngBounds(southWest, northEast);

  L.tileLayer(TILE_URL, {
    maxNativeZoom: MAP_CONFIG.maxNativeZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    tileSize: MAP_CONFIG.tileSize,
    noWrap: true,
    bounds: bounds
  }).addTo(map);

  map.setView(
    rc.unproject([MAP_CONFIG.imageWidth / 2, MAP_CONFIG.imageHeight / 2]),
    2
  );

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    disableClusteringAtZoom: 5
  });
  map.addLayer(clusterGroup);

  map.on('click', onMapClick);
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

function createMarkerIcon(category) {
  // Collected shiny — dimmed checkmark
  if (category === '_shiny_collected') {
    return L.divIcon({
      className: '',
      html: '<span style="font-size:18px;color:#4ade80;opacity:0.7;filter:drop-shadow(0 0 3px rgba(0,0,0,0.9))">&#x2714;</span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  var cat = CATEGORIES[category];
  if (!cat) {
    return L.divIcon({
      className: '',
      html: '<span style="font-size:18px;filter:drop-shadow(0 0 2px rgba(0,0,0,0.7))">\uD83D\uDCCD</span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  // Use actual game icon when available
  if (cat.icon) {
    return L.icon({
      iconUrl: BASE_PATH + '/worldmap/markers/' + cat.icon,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  var glow = category === 'npc_reputation'
    ? 'filter:drop-shadow(0 0 4px rgba(100,180,255,0.8)) drop-shadow(0 0 2px rgba(0,0,0,0.7))'
    : 'filter:drop-shadow(0 0 2px rgba(0,0,0,0.7))';

  return L.divIcon({
    className: '',
    html: '<span style="font-size:18px;' + glow + '">' + cat.emoji + '</span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

var iconCache = {};
function getCachedIcon(category) {
  if (!iconCache[category]) {
    iconCache[category] = createMarkerIcon(category);
  }
  return iconCache[category];
}

function renderMarkers() {
  clusterGroup.clearLayers();
  leafletMarkers.clear();

  var shinyState = getShinyCollected();
  for (var m of allMarkers) {
    if (m.floor !== 'surface') continue;
    if (!visibility[m.category]) continue;

    var latlng = rc.unproject([m.x, m.y]);
    var isTrackable = m.category === 'reputation_shiny' || m.category === 'npc_reputation';
    var isCollectedShiny = isTrackable && shinyState[m.id];
    if (hideCollected && isCollectedShiny) continue;
    var icon = isCollectedShiny
      ? getCachedIcon('_shiny_collected')
      : getCachedIcon(m.category);
    var marker = L.marker(latlng, { icon: icon });

    // Lazy tooltip
    (function (mk, mrk) {
      mrk.once('mouseover', function () {
        mrk.bindTooltip(mk.name, {
          direction: 'top',
          offset: [0, -12],
          className: 'marker-tooltip'
        }).openTooltip();
      });
      mrk.on('click', function () {
        setSelectedMarker(mrk);
        showDetail(mk);
      });
    })(m, marker);

    leafletMarkers.set(m.id, marker);
    clusterGroup.addLayer(marker);
  }
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

var currentDetailMarker = null;
var selectedLeafletMarker = null;

function setSelectedMarker(leafletMarker) {
  // Remove glow from previous selection
  if (selectedLeafletMarker) {
    var prevEl = selectedLeafletMarker.getElement();
    if (prevEl) prevEl.classList.remove('marker-selected');
  }
  selectedLeafletMarker = leafletMarker;
  if (leafletMarker) {
    var el = leafletMarker.getElement();
    if (el) el.classList.add('marker-selected');
  }
}

function shouldShowMarkerRegion(marker) {
  return !!(marker && marker.region && marker.category !== 'reputation_shiny');
}


// Helper to get author name for a marker from contributionLog or marker itself
function getMarkerAuthorName(marker) {
  // Try contributionLog first
  if (Array.isArray(contributionLog)) {
    var entry = contributionLog.find(function (c) {
      return c.markerId === marker.id && c.action === 'submit';
    });
    if (entry && entry.authorName) return entry.authorName;
  }
  // Fallback to contributedBy field on marker
  if (marker.contributedBy && typeof marker.contributedBy === 'string' && marker.contributedBy.trim()) {
    return marker.contributedBy.trim();
  }
  return null;
}

function showDetail(m) {
  currentDetailMarker = m;
  var panel = document.getElementById('detail-panel');
  document.getElementById('detail-name').textContent = m.name;
  document.getElementById('detail-coords').textContent = m.x + ', ' + m.y;

  var cat = CATEGORIES[m.category];
  var detailCatEl = document.getElementById('detail-category');
  if (cat && cat.icon) {
    detailCatEl.innerHTML = '<img src="' + BASE_PATH + '/worldmap/markers/' + cat.icon + '" width="16" height="16" style="vertical-align:text-bottom;margin-right:4px">' + cat.label;
  } else {
    detailCatEl.textContent = cat ? cat.emoji + ' ' + cat.label : m.category;
  }

  var regionEl = document.getElementById('detail-region');
  if (shouldShowMarkerRegion(m)) {
    regionEl.textContent = m.region;
    regionEl.style.display = 'block';
  } else {
    regionEl.style.display = 'none';
  }

  var desc = document.getElementById('detail-description');
  desc.textContent = m.description || '';
  desc.style.display = m.description ? 'block' : 'none';

  var ssContainer = document.getElementById('detail-screenshot');
  ssContainer.innerHTML = '';
  if (m.screenshot) {
    var ssUrl = buildScreenshotUrl(m.screenshot);
    var fallbackUrl = buildLegacyScreenshotUrl(m.screenshot);
    var img = document.createElement('img');
    img.src = ssUrl;
    img.alt = m.name + ' screenshot';
    img.loading = 'lazy';
    img.style.cursor = 'pointer';
    img.title = 'Click to enlarge';
    img.addEventListener('error', function () {
      if (fallbackUrl && img.dataset.fallbackApplied !== '1') {
        img.dataset.fallbackApplied = '1';
        img.src = fallbackUrl;
        return;
      }
      img.style.display = 'none';
    });
    img.addEventListener('click', function () { openLightbox(img.currentSrc || img.src); });
    ssContainer.appendChild(img);
  }

  var source = document.getElementById('detail-source');
  if (m.source === 'base') {
    var author = getMarkerAuthorName(m);
    source.textContent = author ? ('Added by: ' + author) : 'Community verified';
  } else {
    source.textContent = 'Source: ' + m.source;
  }

  // Shiny collection toggle
  var shinySection = document.getElementById('detail-shiny');
  if (m.category === 'reputation_shiny' || m.category === 'npc_reputation') {
    if (!discordUser) {
      shinySection.innerHTML =
        '<button type="button" class="btn-secondary">Login with Discord to mark as collected</button>';
      shinySection.querySelector('button').addEventListener('click', function () {
        startDiscordLogin();
      });
      shinySection.style.display = 'block';
    } else {
      var collected = getShinyCollected();
      var isCollected = !!collected[m.id];
      shinySection.innerHTML =
        '<label class="shiny-check-label">' +
        '<input type="checkbox" ' + (isCollected ? 'checked' : '') + ' />' +
        '<span>' + (isCollected ? 'Collected' : 'Mark as Collected') + '</span>' +
        '<span class="save-flash" style="display:none">Saved</span>' +
        '</label>';
      shinySection.querySelector('input').addEventListener('change', function () {
        var nowCollected = toggleShinyCollected(m.id);
        this.nextElementSibling.textContent = nowCollected ? 'Collected' : 'Mark as Collected';
        var flash = shinySection.querySelector('.save-flash');
        flash.style.display = '';
        setTimeout(function () { flash.style.display = 'none'; }, 1500);

        // Swap icon on the single marker instead of rebuilding all markers
        var lm = leafletMarkers.get(m.id);
        if (lm) {
          var newIcon = nowCollected
            ? getCachedIcon('_shiny_collected')
            : getCachedIcon(m.category);
          lm.setIcon(newIcon);
        }

        // Update sidebar item inline instead of rebuilding entire sidebar
        var sidebarItem = document.querySelector('.marker-item[data-marker-id="' + m.id + '"]');
        if (sidebarItem) {
          var nameSpan = sidebarItem.querySelector('.marker-item-name');
          if (nowCollected) {
            sidebarItem.classList.add('shiny-collected');
            nameSpan.textContent = '\u2713 ' + m.name;
            if (hideCollected) sidebarItem.style.display = 'none';
          } else {
            sidebarItem.classList.remove('shiny-collected');
            sidebarItem.style.display = '';
            nameSpan.textContent = m.name;
          }
        }

        // Hide marker on map when filter is active
        if (hideCollected && nowCollected && lm) {
          clusterGroup.removeLayer(lm);
          leafletMarkers.delete(m.id);
        }

        // Update the progress counter in the category row
        var progress = getRepProgress(m.category);
        var catRow = document.querySelector('input[data-category="' + m.category + '"]');
        if (catRow) {
          var countSpan = catRow.parentElement.querySelector('.cat-count');
          if (countSpan) countSpan.textContent = progress.collected + '/' + progress.total;
        }
      });
      shinySection.style.display = 'block';
    }
  } else {
    shinySection.style.display = 'none';
  }

  panel.hidden = false;

  var latlng = rc.unproject([m.x, m.y]);
  map.panTo(latlng);
}

// ---------------------------------------------------------------------------
// Lightbox (click-to-zoom screenshots with zoom/pan)
// ---------------------------------------------------------------------------

var lbZoom = 1;
var lbPanX = 0;
var lbPanY = 0;
var lbDragging = false;
var lbDragStart = { x: 0, y: 0 };
var lbPanStart = { x: 0, y: 0 };

function openLightbox(imageUrl) {
  var overlay = document.getElementById('lightbox-overlay');
  var img = document.getElementById('lightbox-img');
  lbZoom = 1;
  lbPanX = 0;
  lbPanY = 0;
  img.style.transform = '';
  img.src = imageUrl;
  overlay.hidden = false;
}

function closeLightbox() {
  var overlay = document.getElementById('lightbox-overlay');
  overlay.hidden = true;
  document.getElementById('lightbox-img').src = '';
}

function applyLightboxTransform() {
  var img = document.getElementById('lightbox-img');
  img.style.transform = 'translate(' + lbPanX + 'px, ' + lbPanY + 'px) scale(' + lbZoom + ')';
}

function initLightbox() {
  var overlay = document.getElementById('lightbox-overlay');
  var img = document.getElementById('lightbox-img');

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeLightbox();
  });

  // Scroll to zoom
  overlay.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.15 : 0.15;
    lbZoom = Math.max(0.5, Math.min(5, lbZoom + delta));
    if (lbZoom <= 1) { lbPanX = 0; lbPanY = 0; }
    applyLightboxTransform();
  }, { passive: false });

  // Drag to pan (when zoomed)
  img.addEventListener('mousedown', function (e) {
    if (lbZoom <= 1) return;
    e.preventDefault();
    lbDragging = true;
    lbDragStart = { x: e.clientX, y: e.clientY };
    lbPanStart = { x: lbPanX, y: lbPanY };
    img.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', function (e) {
    if (!lbDragging) return;
    lbPanX = lbPanStart.x + (e.clientX - lbDragStart.x);
    lbPanY = lbPanStart.y + (e.clientY - lbDragStart.y);
    applyLightboxTransform();
  });

  window.addEventListener('mouseup', function () {
    if (!lbDragging) return;
    lbDragging = false;
    document.getElementById('lightbox-img').style.cursor = 'grab';
  });

  // Double-click to reset zoom
  img.addEventListener('dblclick', function () {
    lbZoom = 1;
    lbPanX = 0;
    lbPanY = 0;
    applyLightboxTransform();
  });

  // Touch: pinch to zoom
  var lastTouchDist = 0;
  overlay.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && lbZoom > 1) {
      lbDragging = true;
      lbDragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lbPanStart = { x: lbPanX, y: lbPanY };
    }
  }, { passive: false });

  overlay.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var scale = dist / lastTouchDist;
      lbZoom = Math.max(0.5, Math.min(5, lbZoom * scale));
      lastTouchDist = dist;
      applyLightboxTransform();
    } else if (e.touches.length === 1 && lbDragging) {
      e.preventDefault();
      lbPanX = lbPanStart.x + (e.touches[0].clientX - lbDragStart.x);
      lbPanY = lbPanStart.y + (e.touches[0].clientY - lbDragStart.y);
      applyLightboxTransform();
    }
  }, { passive: false });

  overlay.addEventListener('touchend', function () {
    lbDragging = false;
    if (lbZoom <= 1) { lbPanX = 0; lbPanY = 0; applyLightboxTransform(); }
  });
}

function initDetailPanel() {
  document.getElementById('detail-close').addEventListener('click', function () {
    document.getElementById('detail-panel').hidden = true;
    currentDetailMarker = null;
    setSelectedMarker(null);
  });

  document.getElementById('btn-suggest-edit').addEventListener('click', function () {
    if (currentDetailMarker) {
      openModalForEdit(currentDetailMarker);
    }
  });

  document.getElementById('btn-suggest-delete').addEventListener('click', function () {
    if (!currentDetailMarker) return;
    if (!discordUser) {
      startDiscordLogin();
      return;
    }
    suggestDeletion(currentDetailMarker);
  });

  initLightbox();
}

function suggestDeletion(marker) {
  var btn = document.getElementById('btn-suggest-delete');
  var originalText = btn.textContent;
  var usingBackend = hasSubmissionBackend();
  btn.disabled = true;
  btn.textContent = usingBackend ? 'Submitting...' : 'Opening GitHub...';

  submitMarkerRequest({
    markers: [{
      id: marker.id,
      deletion: true,
      category: marker.category,
      name: marker.name,
      x: marker.x,
      y: marker.y,
      floor: marker.floor || 'surface',
      region: marker.region || '',
      description: ''
    }],
    authorName: getPreferredAuthorName(),
    authorDiscordId: discordUser.id
  }, { mode: 'delete' })
    .then(function (result) {
      var wasDuplicate = !!(result && result.data && result.data.duplicate);
      btn.textContent = wasDuplicate ? 'Already Pending' : (usingBackend ? 'Submitted!' : 'Issue Opened!');
      btn.style.color = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      setTimeout(function () {
        btn.textContent = originalText;
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.disabled = false;
      }, 3000);
    })
    .catch(function (err) {
      console.error('Deletion suggestion error:', err);
      btn.textContent = err.message || 'Error — try again';
      btn.style.color = 'var(--danger)';
      setTimeout(function () {
        btn.textContent = originalText;
        btn.style.color = '';
        btn.disabled = false;
      }, 3500);
    });
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function initLeaderboard() {
  document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboard);
  document.getElementById('leaderboard-close').addEventListener('click', function () {
    document.getElementById('leaderboard-modal').hidden = true;
  });
}

function getLeaderboardAction(action) {
  var normalized = String(action || '').trim().toLowerCase();
  if (normalized === 'delete' || normalized === 'removed') return 'delete';
  if (normalized === 'edit' || normalized === 'updated') return 'edit';
  return 'submit';
}

function buildLeaderboardFallbackKey(markerId, author, action) {
  return String(markerId || '') + '|' + normalizeContributorName(author) + '|' + getLeaderboardAction(action);
}

function addLeaderboardContribution(counts, labels, aliases, displayName, author, action, amount) {
  var trimmed = String(author || '').trim();
  if (!trimmed || trimmed === 'Community') return;

  var key = normalizeContributorName(trimmed);
  var isCurrentDiscordIdentity = Array.isArray(aliases) && aliases.indexOf(key) >= 0;
  if (!labels[key] || (isCurrentDiscordIdentity && displayName)) {
    labels[key] = isCurrentDiscordIdentity && displayName ? displayName : trimmed;
  }

  if (!counts[key]) {
    counts[key] = { total: 0, submit: 0, edit: 0, delete: 0 };
  }

  var contributionAction = getLeaderboardAction(action);
  var increment = Number(amount);
  increment = Number.isFinite(increment) && increment > 0 ? increment : 1;

  counts[key].total += increment;
  counts[key][contributionAction] += increment;
}

function showLeaderboard() {
  var body = document.getElementById('leaderboard-body');

  var counts = {};
  var labels = {};
  var myAliases = getContributorAliases();
  var myDisplayName = getPreferredAuthorName();
  var loggedFallbackKeys = {};
  var seenLogIds = {};

  for (var entry of contributionLog) {
    if (!entry) continue;
    if (getLeaderboardAction(entry.action) !== 'submit') continue;

    var logId = String(entry.id || '') || JSON.stringify(entry);
    if (seenLogIds[logId]) continue;
    seenLogIds[logId] = true;

    addLeaderboardContribution(
      counts,
      labels,
      myAliases,
      myDisplayName,
      entry.authorName,
      'submit',
      entry.count
    );

    loggedFallbackKeys[buildLeaderboardFallbackKey(entry.markerId, entry.authorName, 'submit')] = true;
  }

  for (var m of allMarkers) {
    var submitKey = buildLeaderboardFallbackKey(m.id, m.contributedBy, 'submit');
    if (m.contributedBy && !loggedFallbackKeys[submitKey]) {
      addLeaderboardContribution(counts, labels, myAliases, myDisplayName, m.contributedBy, 'submit', 1);
    }
  }

  var sorted = Object.keys(counts)
    .map(function (key) {
      return { name: labels[key] || key, stats: counts[key] };
    })
    .sort(function (a, b) {
      if (b.stats.total !== a.stats.total) return b.stats.total - a.stats.total;
      return a.name.localeCompare(b.name);
    });

  if (sorted.length === 0) {
    body.innerHTML = '<p class="info-modal-empty">No contributors yet.</p>';
  } else {
    body.innerHTML = '';
    for (var i = 0; i < sorted.length; i++) {
      var row = document.createElement('div');
      row.className = 'leaderboard-row';
      var rank = i + 1;
      var medal = rank === 1 ? '\uD83E\uDD47' : rank === 2 ? '\uD83E\uDD48' : rank === 3 ? '\uD83E\uDD49' : '';
      var stats = sorted[i].stats;

      row.innerHTML =
        '<span class="leaderboard-rank">' + (medal || '#' + rank) + '</span>' +
        '<span class="leaderboard-name">' + sorted[i].name + '</span>' +
        '<span class="leaderboard-count">' + stats.submit + ' contribution' + (stats.submit === 1 ? '' : 's') + '</span>';
      body.appendChild(row);
    }
  }

  document.getElementById('leaderboard-modal').hidden = false;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function initSidebar() {
  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.getElementById('sidebar');
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('collapsed');
    toggle.textContent = sidebar.classList.contains('collapsed') ? '\u25B6' : '\u25C0';
    setTimeout(function () { map.invalidateSize(); }, 250);
  });

  document.getElementById('search-input').addEventListener('input', onSearch);
}

var updateSidebar = function () { buildSidebar(); };

function buildSidebar() {
  var container = document.getElementById('category-groups');
  container.innerHTML = '';

  var counts = {};
  var markersByCategory = {};
  for (var m of allMarkers) {
    if (m.floor !== 'surface') continue;
    counts[m.category] = (counts[m.category] || 0) + 1;
    if (!markersByCategory[m.category]) markersByCategory[m.category] = [];
    markersByCategory[m.category].push(m);
  }

  for (var key in markersByCategory) {
    markersByCategory[key].sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  for (var groupName of GROUP_ORDER) {
    var cats = Object.entries(CATEGORIES).filter(function (e) { return e[1].group === groupName; });
    if (cats.length === 0) continue;

    var group = document.createElement('div');
    group.className = 'category-group';

    var header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = '<span>' + groupName + '</span><span class="group-arrow">\u25BC</span>';
    group.appendChild(header);

    var body = document.createElement('div');
    body.className = 'group-body';

    for (var entry of cats) {
      var catKey = entry[0];
      var catMeta = entry[1];
      var count = counts[catKey] || 0;

      // Use div (not label) so checkbox clicks don't interfere with expand
      var row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML =
        '<input type="checkbox" data-category="' + catKey + '" ' +
        (visibility[catKey] ? 'checked' : '') + ' />' +
        '<span class="cat-emoji">' + (catMeta.icon ? '<img src="' + BASE_PATH + '/worldmap/markers/' + catMeta.icon + '" width="16" height="16" style="vertical-align:text-bottom">' : catMeta.emoji) + '</span>' +
        '<span class="cat-label">' + catMeta.label + '</span>' +
        '<span class="cat-count">' + ((catKey === 'reputation_shiny' || catKey === 'npc_reputation') ? getRepProgress(catKey).collected + '/' + count : count) + '</span>' +
        (count > 0 ? '<span class="cat-arrow">\u25B6</span>' : '');
      body.appendChild(row);

      if (count > 0) {
        var list = document.createElement('div');
        list.className = 'marker-list';
        list.id = 'list-' + catKey;
        list.style.display = 'none';

        var shinyState = (catKey === 'reputation_shiny' || catKey === 'npc_reputation') ? getShinyCollected() : {};
        for (var marker of (markersByCategory[catKey] || [])) {
          var item = document.createElement('div');
          item.className = 'marker-item';
          if (shinyState[marker.id]) {
            item.classList.add('shiny-collected');
            if (hideCollected) item.style.display = 'none';
          }
          var nameSpan = document.createElement('span');
          nameSpan.className = 'marker-item-name';
          nameSpan.textContent = (shinyState[marker.id] ? '\u2713 ' : '') + marker.name;
          item.appendChild(nameSpan);
          if (shouldShowMarkerRegion(marker)) {
            var regionSpan = document.createElement('span');
            regionSpan.className = 'marker-item-region';
            regionSpan.textContent = marker.region;
            item.appendChild(regionSpan);
          }
          item.dataset.markerId = marker.id;
          item.dataset.x = marker.x;
          item.dataset.y = marker.y;
          item.addEventListener('click', onMarkerItemClick);
          list.appendChild(item);
        }
        body.appendChild(list);

        (function (listEl, rowEl) {
          rowEl.addEventListener('click', function (e) {
            if (e.target.type === 'checkbox') return;
            var arrow = rowEl.querySelector('.cat-arrow');
            if (listEl.style.display === 'none') {
              listEl.style.display = 'block';
              if (arrow) arrow.textContent = '\u25BC';
            } else {
              listEl.style.display = 'none';
              if (arrow) arrow.textContent = '\u25B6';
            }
          });
        })(list, row);
      }
    }

    // Add "Hide collected" toggle to the Reputation group
    if (groupName === 'Reputation') {
      var filterRow = document.createElement('div');
      filterRow.className = 'cat-row hide-collected-row';
      filterRow.innerHTML =
        '<input type="checkbox" id="hide-collected-toggle" ' + (hideCollected ? 'checked' : '') + (discordUser ? '' : ' disabled') + ' />' +
        '<span class="cat-label" style="font-style:italic;opacity:0.8">' + (discordUser ? 'Hide collected' : 'Hide collected (login required)') + '</span>';
      body.appendChild(filterRow);
      filterRow.querySelector('input').addEventListener('change', function (e) {
        e.stopPropagation();
        if (!discordUser) {
          this.checked = false;
          startDiscordLogin();
          return;
        }
        hideCollected = this.checked;
        saveUiPreferences();
        renderMarkers();
        // Toggle visibility of collected items in sidebar
        var items = document.querySelectorAll('.marker-item.shiny-collected');
        for (var i = 0; i < items.length; i++) {
          items[i].style.display = hideCollected ? 'none' : '';
        }
      });
    }

    group.appendChild(body);

    header.addEventListener('click', function () {
      var b = this.nextElementSibling;
      var a = this.querySelector('.group-arrow');
      if (b.style.display === 'none') {
        b.style.display = 'block';
        a.textContent = '\u25BC';
      } else {
        b.style.display = 'none';
        a.textContent = '\u25B6';
      }
    });

    container.appendChild(group);
  }

  container.addEventListener('change', function (e) {
    if (e.target.dataset.category) {
      visibility[e.target.dataset.category] = e.target.checked;
      saveUiPreferences();
      renderMarkers();
      updateStats();
    }
  });
}

function onMarkerItemClick(e) {
  // Walk up to find the element with data attributes (handles clicks on child spans)
  var el = e.target;
  while (el && !el.dataset.markerId) el = el.parentElement;
  if (!el) return;

  var id = el.dataset.markerId;
  var x = parseInt(el.dataset.x, 10);
  var y = parseInt(el.dataset.y, 10);

  var m = allMarkers.find(function (mk) { return mk.id === id; });
  if (m) showDetail(m);

  var latlng = rc.unproject([x, y]);
  map.setView(latlng, 5);

  var lm = leafletMarkers.get(id);
  if (lm) {
    setSelectedMarker(lm);
    clusterGroup.zoomToShowLayer(lm, function () {
      lm.openTooltip();
    });
  }
}

function updateStats() {
  var visible = 0;
  var total = 0;
  for (var m of allMarkers) {
    if (m.floor !== 'surface') continue;
    total++;
    if (visibility[m.category]) visible++;
  }
  document.getElementById('sidebar-stats').textContent =
    'Showing ' + visible + ' of ' + total + ' markers';
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function onSearch(e) {
  var query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderMarkers();
    document.querySelectorAll('.marker-list').forEach(function (el) { el.style.display = 'none'; });
    document.querySelectorAll('.marker-item').forEach(function (el) { el.style.display = ''; });
    return;
  }

  document.querySelectorAll('.marker-list').forEach(function (list) {
    var hasMatch = false;
    list.querySelectorAll('.marker-item').forEach(function (item) {
      if (item.textContent.toLowerCase().includes(query)) {
        item.style.display = '';
        hasMatch = true;
      } else {
        item.style.display = 'none';
      }
    });
    list.style.display = hasMatch ? 'block' : 'none';
  });

  clusterGroup.clearLayers();
  for (var m of allMarkers) {
    if (m.floor !== 'surface') continue;
    if (!visibility[m.category]) continue;
    if (!m.name.toLowerCase().includes(query)) continue;
    var lm = leafletMarkers.get(m.id);
    if (lm) clusterGroup.addLayer(lm);
  }
}

// ---------------------------------------------------------------------------
// Modal (Submit new / Suggest edit — opens GitHub issues)
// ---------------------------------------------------------------------------

function initModal() {
  var btnOpen = document.getElementById('btn-submit');
  var btnClose = document.getElementById('modal-close');
  var btnCancel = document.getElementById('btn-cancel');
  var btnCreate = document.getElementById('btn-create-issue');

  btnOpen.addEventListener('click', function () {
    if (!discordUser) {
      openModalForSubmit({ loginDisabled: true });
      return;
    }
    openModalForSubmit({ loginDisabled: false });
  });

  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Overlay has pointer-events:none so map clicks pass through;
  // close only via X / Cancel buttons

  var fields = ['submit-category', 'submit-name', 'submit-author-display'];
  fields.forEach(function (id) {
    document.getElementById(id).addEventListener('input', validateForm);
    document.getElementById(id).addEventListener('change', validateForm);
  });

  document.getElementById('submit-category').addEventListener('change', function () {
    if (previewMarker) {
      updatePreviewMarker(previewMarker.getLatLng());
    } else if (!document.getElementById('marker-modal').hidden && map) {
      updatePreviewMarker(map.getCenter());
    }
  });

  btnCreate.addEventListener('click', submitToGitHubIssue);

  // Screenshot paste from clipboard
  document.getElementById('btn-paste-screenshot').addEventListener('click', pasteScreenshot);
  document.getElementById('btn-remove-screenshot').addEventListener('click', function () {
    pendingScreenshot = null;
    clearScreenshotPreview();
  });
}

function openModalForSubmit(options) {
  options = options || {};
  modalMode = 'submit';
  editingMarker = null;

  document.getElementById('submit-category').value = '';
  document.getElementById('submit-name').value = '';
  document.getElementById('submit-description').value = '';
  document.getElementById('submit-region').value = '';
  pendingScreenshot = null;
  clearScreenshotPreview();
  submitCoords = null;
  removePreviewMarker();

  document.getElementById('submit-category').disabled = false;

  var usingBackend = hasSubmissionBackend();
  document.getElementById('modal-title').textContent = 'Submit a Marker';
  document.getElementById('modal-info').textContent =
    options.loginDisabled
      ? 'Login with Discord first, then submit your marker.'
      : (usingBackend
        ? 'Click on the map to place your marker, then fill in the details below. Your submission will be sent automatically for review.'
        : 'Click on the map to place your marker, then fill in the details below. A prefilled GitHub issue will open for final review.');
  document.getElementById('btn-create-issue').textContent = getSubmissionButtonText('submit');

  var authorEl = document.getElementById('submit-author-display');
  authorEl.value = getVerifiedSubmitAuthorName();
  authorEl.readOnly = true;
  authorEl.title = options.loginDisabled ? 'Login with Discord to submit.' : 'Locked to your verified Discord name.';

  updateCoordsDisplay();
  validateForm();
  document.getElementById('marker-modal').hidden = false;
}

function openModalForEdit(m) {
  if (!discordUser) {
    if (confirm('You need to login with Discord to suggest edits. Login now?')) {
      startDiscordLogin();
    }
    return;
  }

  modalMode = 'edit';
  editingMarker = m;

  document.getElementById('submit-category').value = m.category || '';
  document.getElementById('submit-name').value = m.name || '';
  document.getElementById('submit-description').value = m.description || '';
  document.getElementById('submit-region').value = m.region || '';
  pendingScreenshot = null;
  clearScreenshotPreview();
  submitCoords = { x: m.x, y: m.y };

  document.getElementById('submit-category').disabled = true;

  // Hide the original marker and show a movable preview in its place
  var originalLeaflet = leafletMarkers.get(m.id);
  if (originalLeaflet) clusterGroup.removeLayer(originalLeaflet);
  var editLatlng = rc.unproject([m.x, m.y]);
  updatePreviewMarker(editLatlng);

  document.getElementById('modal-title').textContent = 'Suggest Edit';
  document.getElementById('modal-info').textContent =
    'Modify the fields you want to change. You can click the map to update the position. ' +
    (hasSubmissionBackend()
      ? 'Your submission will be sent automatically for review.'
      : 'A prefilled GitHub issue will open for final review.');
  document.getElementById('btn-create-issue').textContent = getSubmissionButtonText('edit');

  var authorEl = document.getElementById('submit-author-display');
  authorEl.value = getVerifiedSubmitAuthorName();
  authorEl.readOnly = true;
  authorEl.title = 'Locked to your verified Discord name.';

  updateCoordsDisplay();
  validateForm();
  document.getElementById('marker-modal').hidden = false;
}

function closeModal() {
  // Restore original marker if we were editing
  if (editingMarker) {
    var originalLeaflet = leafletMarkers.get(editingMarker.id);
    if (originalLeaflet && visibility[editingMarker.category]) {
      clusterGroup.addLayer(originalLeaflet);
    }
  }

  document.getElementById('marker-modal').hidden = true;
  submitCoords = null;
  editingMarker = null;
  pendingScreenshot = null;
  document.getElementById('submit-category').disabled = false;
  removePreviewMarker();
  clearScreenshotPreview();
  var btn = document.getElementById('btn-create-issue');
  btn.classList.remove('btn-success', 'btn-error');
}

function onMapClick(e) {
  var modal = document.getElementById('marker-modal');
  if (modal.hidden) return;

  var px = rc.project(e.latlng);
  submitCoords = { x: Math.round(px.x), y: Math.round(px.y) };
  updateCoordsDisplay();
  validateForm();
  updatePreviewMarker(e.latlng);
}

function updatePreviewMarker(latlng) {
  if (previewMarker) {
    previewMarker.setLatLng(latlng);
  } else {
    var category = document.getElementById('submit-category').value;
    var icon = getCachedIcon(category || '_preview');
    previewMarker = L.marker(latlng, { icon: icon, opacity: 0.8 }).addTo(map);
  }
  // Update icon if category changed
  var category = document.getElementById('submit-category').value;
  if (category) {
    previewMarker.setIcon(getCachedIcon(category));
  }
}

function removePreviewMarker() {
  if (previewMarker) {
    map.removeLayer(previewMarker);
    previewMarker = null;
  }
}

// ---------------------------------------------------------------------------
// Screenshot (paste from clipboard)
// ---------------------------------------------------------------------------

function compressToWebP(blob) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var objectUrl = URL.createObjectURL(blob);
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      var canvas = document.createElement('canvas');
      // Match companion app: 600px wide, quality 0.55 — keeps base64 under GitHub limit
      var maxW = 600;
      var w = img.width;
      var h = img.height;
      if (w > maxW) {
        h = Math.round(h * maxW / w);
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var dataUrl = canvas.toDataURL('image/webp', 0.55);
      resolve(dataUrl);
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

function pasteScreenshot() {
  navigator.clipboard.read().then(function (items) {
    for (var item of items) {
      // Find an image type
      var imageType = item.types.find(function (t) { return t.startsWith('image/'); });
      if (!imageType) continue;

      item.getType(imageType).then(function (blob) {
        compressToWebP(blob).then(function (dataUrl) {
          pendingScreenshot = dataUrl.split(',')[1]; // strip data:... prefix
          showScreenshotPreview(dataUrl);
        });
      });
      return;
    }
    alert('No image found in clipboard. Copy a screenshot first.');
  }).catch(function () {
    alert('Could not read clipboard. Make sure you have an image copied.');
  });
}

function showScreenshotPreview(dataUrl) {
  var preview = document.getElementById('screenshot-preview');
  document.getElementById('screenshot-preview-img').src = dataUrl;
  preview.hidden = false;
  document.getElementById('btn-paste-screenshot').textContent = 'Replace from Clipboard';
}

function clearScreenshotPreview() {
  pendingScreenshot = null;
  var preview = document.getElementById('screenshot-preview');
  preview.hidden = true;
  document.getElementById('screenshot-preview-img').src = '';
  document.getElementById('btn-paste-screenshot').textContent = 'Paste from Clipboard';
}

function updateCoordsDisplay() {
  var el = document.getElementById('submit-coords');
  if (submitCoords) {
    el.textContent = submitCoords.x + ', ' + submitCoords.y;
    el.classList.add('has-coords');
  } else {
    el.textContent = 'Click on the map to set position';
    el.classList.remove('has-coords');
  }
}

function validateForm() {
  var category = document.getElementById('submit-category').value;
  var name = document.getElementById('submit-name').value.trim();
  var authorName = document.getElementById('submit-author-display').value.trim();
  var valid = category && name && authorName && submitCoords && discordUser;
  document.getElementById('btn-create-issue').disabled = !valid;
}

// ---------------------------------------------------------------------------
// Local edit persistence (localStorage)
// ---------------------------------------------------------------------------

var LOCAL_EDITS_KEY = 'rhud_marker_edits';

function getLocalEdits() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_EDITS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalEdit(markerId, fields) {
  var edits = getLocalEdits();
  edits[markerId] = fields;
  localStorage.setItem(LOCAL_EDITS_KEY, JSON.stringify(edits));
}

function applyLocalEdits() {
  var edits = getLocalEdits();
  var keys = Object.keys(edits);
  if (keys.length === 0) return;

  for (var m of allMarkers) {
    if (edits[m.id]) {
      var e = edits[m.id];
      if (e.name) m.name = e.name;
      if (e.x != null) m.x = e.x;
      if (e.y != null) m.y = e.y;
      if (e.description != null) m.description = e.description;
      if (e.region != null) m.region = e.region;
    }
  }
}

// ---------------------------------------------------------------------------
// Submit / Edit
// ---------------------------------------------------------------------------

function submitToGitHubIssue() {
  if (!discordUser || !submitCoords) return;

  var category = document.getElementById('submit-category').value;
  var name = document.getElementById('submit-name').value.trim();
  var authorName = getVerifiedSubmitAuthorName();
  var authorEl = document.getElementById('submit-author-display');
  if (authorEl) authorEl.value = authorName;
  var description = document.getElementById('submit-description').value.trim();
  var region = document.getElementById('submit-region').value.trim();

  rememberPreferredAuthorName(authorName);

  var btn = document.getElementById('btn-create-issue');
  var originalText = btn.textContent;
  var usingBackend = hasSubmissionBackend();
  btn.disabled = true;
  btn.textContent = usingBackend ? 'Submitting...' : 'Opening GitHub...';

  var isEdit = modalMode === 'edit' && editingMarker;

  var markerPayload = {
    category: category,
    name: name,
    x: submitCoords.x,
    y: submitCoords.y,
    floor: 'surface'
  };
  if (description) markerPayload.description = description;
  if (region) markerPayload.region = region;

  if (isEdit) {
    markerPayload.id = editingMarker.id;
    markerPayload.correction = true;
  }

  var body = {
    markers: [markerPayload],
    authorName: authorName,
    authorDiscordId: discordUser.id
  };
  if (pendingScreenshot) body.screenshot = pendingScreenshot;

  if (isEdit) {
    body.originalMarker = {
      id: editingMarker.id,
      category: editingMarker.category || category,
      name: editingMarker.name,
      x: editingMarker.x,
      y: editingMarker.y,
      floor: editingMarker.floor || 'surface',
      description: editingMarker.description || '',
      region: editingMarker.region || ''
    };
  }

  submitMarkerRequest(body, { mode: isEdit ? 'edit' : 'submit' })
    .then(function (result) {
      var wasDuplicate = !!(result && result.data && result.data.duplicate);
      btn.textContent = wasDuplicate ? 'Already Pending' : (usingBackend ? 'Submitted!' : 'Issue Opened!');
      btn.classList.add('btn-success');

      if (isEdit) {
        saveLocalEdit(editingMarker.id, {
          name: name,
          x: submitCoords.x,
          y: submitCoords.y,
          description: description,
          region: region
        });
        var m = allMarkers.find(function (mk) { return mk.id === editingMarker.id; });
        if (m) {
          m.name = name;
          m.x = submitCoords.x;
          m.y = submitCoords.y;
          m.description = description;
          m.region = region;
        }
        renderMarkers();
        updateStats();
      }

      if (pendingScreenshot && !usingBackend) {
        alert('A prefilled GitHub issue has been opened. Paste or upload your screenshot there before you submit it.');
      }

      setTimeout(function () { closeModal(); }, 1200);
    })
    .catch(function (err) {
      console.error('Submission error:', err);
      var msg = (err && err.message) || 'Unknown error';
      btn.textContent = msg.length > 48 ? 'Error — try again' : msg;
      btn.classList.add('btn-error');
      btn.disabled = false;
      setTimeout(function () {
        btn.textContent = originalText;
        btn.classList.remove('btn-error');
        validateForm();
      }, 4000);
    });
}
