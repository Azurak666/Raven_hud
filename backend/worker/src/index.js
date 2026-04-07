const DEFAULT_ALLOWED_ORIGINS = [
  'https://azurak666.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = getCorsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'ravenhud-marker-api' }, 200, cors);
    }

    if (url.pathname === '/api/collection' && request.method === 'POST') {
      try {
        assertCollectedMarksEnv(env);
        const body = await request.json().catch(() => ({}));
        const verifiedUser = await getVerifiedDiscordUser(body.discordAccessToken);

        if (!verifiedUser) {
          throw httpError(401, 'Discord login required to sync collected marks.');
        }

        const existing = await loadCollectedMarksRecord(env, verifiedUser.id);
        const incomingState = Object.prototype.hasOwnProperty.call(body, 'state')
          ? sanitizeCollectedState(body.state)
          : null;
        const incomingUpdatedAt = normalizeTimestamp(body.updatedAt);
        const nextRecord = resolveCollectedMarksRecord(existing, incomingState, incomingUpdatedAt, verifiedUser.id);

        if (nextRecord.shouldSave) {
          await saveCollectedMarksRecord(env, verifiedUser.id, nextRecord.record);
        }

        return json({
          success: true,
          via: 'backend',
          userId: verifiedUser.id,
          state: nextRecord.record.state,
          updatedAt: nextRecord.record.updatedAt
        }, 200, cors);
      } catch (error) {
        const status = error && error.status ? error.status : 500;
        return json({ success: false, error: error.message || 'Unknown error' }, status, cors);
      }
    }

    if (url.pathname === '/api/markers/submit' && request.method === 'POST') {
      try {
        assertEnv(env);
        const body = await request.json();
        const marker = validateMarkerPayload(body);
        const mode = inferMode(marker, body);

        const verifiedUser = await getVerifiedDiscordUser(body.discordAccessToken);
        if (verifiedUser) {
          body.authorName = verifiedUser.displayName;
          body.authorDiscordId = verifiedUser.id;
        }

        const screenshotUrl = await maybeUploadScreenshot(body.screenshot, marker, env);
        const issue = await createGitHubIssue(body, marker, mode, screenshotUrl, env);

        return json({
          success: true,
          via: 'backend',
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          screenshotUrl: screenshotUrl,
          duplicate: !!issue.duplicate
        }, 200, cors);
      } catch (error) {
        const status = error && error.status ? error.status : 500;
        return json({ success: false, error: error.message || 'Unknown error' }, status, cors);
      }
    }

    return json({ success: false, error: 'Not found' }, 404, cors);
  }
};

function assertEnv(env) {
  if (!env.GITHUB_TOKEN) throw httpError(500, 'Missing GITHUB_TOKEN secret.');
  if (!env.GITHUB_REPO) throw httpError(500, 'Missing GITHUB_REPO variable.');
}

function assertCollectedMarksEnv(env) {
  if (!env.COLLECTED_MARKS) {
    throw httpError(503, 'Collected marks sync is not configured yet.');
  }
}

function validateMarkerPayload(body) {
  if (!body || !Array.isArray(body.markers) || body.markers.length === 0) {
    throw httpError(400, 'Missing marker payload.');
  }

  const marker = body.markers[0] || {};
  const required = ['category', 'name', 'x', 'y'];
  for (const key of required) {
    if (marker[key] === undefined || marker[key] === null || marker[key] === '') {
      throw httpError(400, 'Missing required marker field: ' + key);
    }
  }

  return marker;
}

function inferMode(marker, body) {
  if (marker.deletion || body.deletionRequest) return 'delete';
  if (marker.correction || body.originalMarker) return 'edit';
  return 'submit';
}

function getCorsHeaders(origin, env) {
  const allowedOrigins = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...cors
    }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeTimestamp(value) {
  const stamp = Number(value);
  return Number.isFinite(stamp) && stamp > 0 ? Math.round(stamp) : 0;
}

function sanitizeCollectedState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const clean = {};
  for (const [markerId, rawStamp] of Object.entries(value)) {
    if (!markerId) continue;
    clean[String(markerId)] = normalizeTimestamp(rawStamp) || Date.now();
  }
  return clean;
}

function getCollectedMarksKey(userId) {
  return `collected:${String(userId || 'unknown')}`;
}

async function loadCollectedMarksRecord(env, userId) {
  const record = await env.COLLECTED_MARKS.get(getCollectedMarksKey(userId), 'json');
  if (!record || typeof record !== 'object') {
    return { userId, state: {}, updatedAt: 0 };
  }

  return {
    userId,
    state: sanitizeCollectedState(record.state),
    updatedAt: normalizeTimestamp(record.updatedAt)
  };
}

async function saveCollectedMarksRecord(env, userId, record) {
  await env.COLLECTED_MARKS.put(getCollectedMarksKey(userId), JSON.stringify({
    userId,
    state: sanitizeCollectedState(record.state),
    updatedAt: normalizeTimestamp(record.updatedAt) || Date.now()
  }));
}

function resolveCollectedMarksRecord(existingRecord, incomingState, incomingUpdatedAt, userId) {
  const current = existingRecord || { userId, state: {}, updatedAt: 0 };

  if (!incomingState) {
    return { shouldSave: false, record: current };
  }

  const nextUpdatedAt = incomingUpdatedAt || Date.now();
  if (nextUpdatedAt >= current.updatedAt) {
    return {
      shouldSave: true,
      record: {
        userId,
        state: sanitizeCollectedState(incomingState),
        updatedAt: nextUpdatedAt
      }
    };
  }

  return { shouldSave: false, record: current };
}

async function getVerifiedDiscordUser(accessToken) {
  if (!accessToken) return null;

  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  if (!response.ok) return null;

  const user = await response.json();
  return {
    id: user.id,
    displayName: user.global_name || user.username || 'Unknown'
  };
}

async function maybeUploadScreenshot(base64Data, marker, env) {
  if (!base64Data) return '';

  const base64 = String(base64Data)
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .trim();

  if (!base64) return '';

  const bytes = base64ToBytes(base64);
  if (!bytes.byteLength) return '';

  const hash = await sha1Hex(bytes);
  const prefix = sanitizeFileStem(
    marker.correction ? 'edit' : (marker.category === 'dynamic_event' ? 'dynamic_event' : marker.category)
  );
  const filePath = `docs/data/community-screenshots/${prefix}_${hash.slice(0, 10)}.webp`;

  await githubApi(env, '/contents/' + encodePath(filePath), {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add marker screenshot for ${marker.name}`,
      content: base64,
      branch: env.GITHUB_BRANCH || 'master'
    })
  });

  return `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${env.GITHUB_BRANCH || 'master'}/${filePath}`;
}

async function createGitHubIssue(body, marker, mode, screenshotUrl, env) {
  const existing = await findExistingOpenMarkerIssue(marker, mode, env);
  if (existing) {
    return { ...existing, duplicate: true };
  }

  const labels = ['map-markers', 'cat:' + marker.category];
  if (mode === 'edit') labels.push('suggested-edit');
  if (mode === 'delete') labels.push('suggested-deletion');

  return githubApi(env, '/issues', {
    method: 'POST',
    body: JSON.stringify({
      title: buildMarkerIssueTitle(marker, body.authorName || 'Unknown', mode),
      body: buildMarkerIssueBody(body, { mode, screenshotUrl }),
      labels
    })
  });
}

async function findExistingOpenMarkerIssue(marker, mode, env) {
  if (!marker || !marker.id) return null;
  if (mode !== 'delete' && mode !== 'edit') return null;

  const labels = ['map-markers', mode === 'delete' ? 'suggested-deletion' : 'suggested-edit'];
  const params = new URLSearchParams({
    state: 'open',
    labels: labels.join(','),
    per_page: '100'
  });

  const issues = await githubApi(env, '/issues?' + params.toString(), {
    method: 'GET'
  });

  const markerId = String(marker.id);
  const needleA = `"id": "${markerId}"`;
  const needleB = `"id":"${markerId}"`;

  return (issues || []).find((issue) => {
    if (!issue || issue.pull_request) return false;
    const body = String(issue.body || '');
    return body.includes(needleA) || body.includes(needleB);
  }) || null;
}

function buildMarkerIssueTitle(marker, authorName, mode) {
  if (mode === 'delete') return `Delete Marker: ${marker.name} (by ${authorName})`;
  if (mode === 'edit') return `Edit Marker: ${marker.name} (by ${authorName})`;
  return `Map Marker: ${marker.name} (by ${authorName})`;
}

function buildMarkerIssueBody(body, options) {
  const marker = (body.markers && body.markers[0]) || {};
  const issuePayload = {
    markers: body.markers || [],
    authorName: body.authorName || '',
    authorDiscordId: body.authorDiscordId || ''
  };

  if (body.originalMarker) issuePayload.originalMarker = body.originalMarker;
  if (options.mode === 'delete') issuePayload.deletionRequest = true;
  if (options.screenshotUrl) issuePayload.screenshotUrl = options.screenshotUrl;

  const lines = [
    '# RavenHUD Map Marker Contribution',
    '',
    'Exported: ' + new Date().toISOString().slice(0, 10),
    'Contributor: ' + (body.authorName || 'Unknown'),
    body.authorDiscordId ? 'Discord ID: ' + body.authorDiscordId : '',
    '',
    '| Category | Name | X | Y | Floor | Description | Author |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ' + [
      escapeMarkdownCell(marker.category || ''),
      escapeMarkdownCell(marker.name || ''),
      escapeMarkdownCell(marker.x || ''),
      escapeMarkdownCell(marker.y || ''),
      escapeMarkdownCell(marker.floor || 'surface'),
      escapeMarkdownCell(marker.description || ''),
      escapeMarkdownCell(body.authorName || '')
    ].join(' | ') + ' |',
    ''
  ];

  if (options.mode === 'edit' && body.originalMarker) {
    lines.push('**Requested change:** update an existing marker entry.');
    lines.push('');
  }

  if (options.mode === 'delete') {
    lines.push('**Requested change:** review and remove this marker if needed.');
    lines.push('');
  }

  if (options.screenshotUrl) {
    lines.push('![Submitted screenshot](' + options.screenshotUrl + ')');
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

function escapeMarkdownCell(value) {
  return String(value == null ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function sanitizeFileStem(value) {
  return String(value || 'marker')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'marker';
}

function encodePath(filePath) {
  return filePath.split('/').map((part) => encodeURIComponent(part)).join('/');
}

async function githubApi(env, path, init) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      'User-Agent': 'RavenHUD Marker API',
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.message || 'GitHub API request failed.');
  }

  return data;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha1Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
