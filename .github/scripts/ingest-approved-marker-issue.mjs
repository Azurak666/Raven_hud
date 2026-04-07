import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CATEGORY_ICONS = {
  dynamic_event: 'dynamic_event.webp',
  creature_spawn: 'elitespawn.webp',
  expedition: 'expedition.webp',
  npc_reputation: 'npc_reputation.webp'
};

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'docs', 'data', 'worldmap-markers.json');

main();

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error('GITHUB_EVENT_PATH is missing.');
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const issue = event.issue;
  const addedLabel = String(event.label?.name || '').toLowerCase();
  const issueLabels = (issue?.labels || []).map((label) => typeof label === 'string' ? label : label.name);

  if (!issue) {
    setOutput('changed', 'false');
    console.log('No issue in event payload; skipping.');
    return;
  }

  if (addedLabel !== 'approved') {
    setOutput('changed', 'false');
    console.log('Label was not "approved"; skipping.');
    return;
  }

  if (!issueLabels.includes('map-markers')) {
    setOutput('changed', 'false');
    console.log('Issue is not a map marker issue; skipping.');
    return;
  }

  if (issueLabels.includes('ingested')) {
    setOutput('changed', 'false');
    console.log('Issue is already ingested; skipping.');
    return;
  }

  const payload = extractIssuePayload(issue.body || '');
  const markers = Array.isArray(payload.markers) ? payload.markers : [];
  if (markers.length === 0) {
    throw new Error('No markers were found in the issue JSON payload.');
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const changes = [];

  for (const marker of markers) {
    const outcome = applyMarkerChange(data, marker, payload);
    if (outcome.changed) changes.push(outcome);
  }

  if (changes.length > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
  }

  const mode = inferMode(markers[0], payload);
  const category = markers[0].category || '';
  const summary = buildSummary(changes, category, mode);

  setOutput('changed', changes.length > 0 ? 'true' : 'false');
  setOutput('count', String(changes.length));
  setOutput('mode', mode);
  setOutput('category', category);
  setOutput('summary', summary);

  console.log(summary);
}

function extractIssuePayload(body) {
  const match = body.match(/```json\s*([\s\S]*?)```/i) || body.match(/```\s*([\s\S]*?)```/i);
  if (!match) {
    throw new Error('Could not find a JSON block in the issue body.');
  }

  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    throw new Error('Failed to parse issue JSON: ' + error.message);
  }
}

function inferMode(marker, payload) {
  if (marker?.deletion || payload?.deletionRequest) return 'delete';
  if (marker?.correction || payload?.originalMarker) return 'edit';
  return 'submit';
}

function applyMarkerChange(data, marker, payload) {
  const mode = inferMode(marker, payload);
  const screenshot = resolveScreenshotPath(payload.screenshotUrl || payload.screenshot || marker.screenshot || '');

  if (mode === 'delete') {
    const index = findMarkerIndex(data, marker);
    if (index === -1) {
      throw new Error('Could not find marker to delete: ' + (marker.id || marker.name));
    }
    const [removed] = data.splice(index, 1);
    return { changed: true, action: 'removed', id: removed.id };
  }

  if (mode === 'edit') {
    const index = findMarkerIndex(data, marker);
    if (index === -1) {
      throw new Error('Could not find marker to edit: ' + (marker.id || marker.name));
    }

    const current = data[index];
    const next = { ...current };
    const editableFields = ['category', 'name', 'description', 'x', 'y', 'floor', 'region', 'label', 'trigger'];

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(marker, field)) {
        next[field] = normalizeFieldValue(field, marker[field], next[field]);
      }
    }

    next.source = 'base';
    if (payload.authorName) next.contributedBy = payload.authorName;
    if (screenshot) next.screenshot = screenshot;
    applyCategoryDefaults(next, marker.category);

    if (JSON.stringify(current) === JSON.stringify(next)) {
      return { changed: false, action: 'unchanged', id: current.id };
    }

    data[index] = next;
    return { changed: true, action: 'updated', id: next.id };
  }

  const duplicate = data.find((entry) => isSameMarker(entry, marker));
  if (duplicate) {
    return { changed: false, action: 'duplicate', id: duplicate.id };
  }

  const entry = buildNewMarker(data, marker, payload, screenshot);
  data.push(entry);
  return { changed: true, action: 'added', id: entry.id };
}

function buildNewMarker(data, marker, payload, screenshot) {
  const entry = {
    id: createUniqueMarkerId(data),
    source: 'base',
    category: String(marker.category),
    name: String(marker.name),
    description: String(marker.description || ''),
    x: Number(marker.x),
    y: Number(marker.y),
    floor: String(marker.floor || 'surface'),
    label: String(marker.label || ''),
    region: String(marker.region || ''),
    trigger: String(marker.trigger || '')
  };

  if (payload.authorName) entry.contributedBy = payload.authorName;
  if (screenshot) entry.screenshot = screenshot;

  applyCategoryDefaults(entry, entry.category);
  return entry;
}

function applyCategoryDefaults(entry, category) {
  const icon = CATEGORY_ICONS[category];
  if (icon) {
    entry.icon = icon;
  } else if (category === 'reputation_shiny') {
    delete entry.icon;
  }
}

function createUniqueMarkerId(data) {
  let id = '';
  do {
    id = 'c_' + crypto.randomBytes(4).toString('hex');
  } while (data.some((entry) => entry.id === id));
  return id;
}

function resolveScreenshotPath(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('[')) return '';
  if (trimmed.startsWith('community-screenshots/')) return trimmed;

  const rawMatch = trimmed.match(/\/docs\/data\/(.+)$/);
  if (rawMatch) return rawMatch[1];

  return '';
}

function normalizeFieldValue(field, value, fallback) {
  if (field === 'x' || field === 'y') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  if (field === 'description' || field === 'region' || field === 'label' || field === 'trigger') {
    return String(value || '');
  }

  return String(value || fallback || '');
}

function findMarkerIndex(data, marker) {
  if (marker.id) {
    const byId = data.findIndex((entry) => entry.id === marker.id);
    if (byId >= 0) return byId;
  }

  return data.findIndex((entry) => isSameMarker(entry, marker));
}

function isSameMarker(existing, marker) {
  return String(existing.category || '') === String(marker.category || '') &&
    String(existing.name || '').trim().toLowerCase() === String(marker.name || '').trim().toLowerCase() &&
    Number(existing.x) === Number(marker.x) &&
    Number(existing.y) === Number(marker.y) &&
    String(existing.floor || 'surface') === String(marker.floor || 'surface');
}

function buildSummary(changes, category, mode) {
  const count = changes.length;
  if (count === 0) {
    return 'No marker changes were needed for category ' + (category || 'unknown') + '.';
  }

  const actionWord = mode === 'delete' ? 'removed' : mode === 'edit' ? 'updated' : 'added';
  return 'Ingested ' + count + ' marker' + (count === 1 ? '' : 's') +
    ' for category ' + (category || 'unknown') + ' (' + actionWord + ').';
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`);
}
