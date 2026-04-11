/**
 * Material Tooltip - Shows creature drop sources on material hover
 * Demo version - adapted for web
 */

// Singleton tooltip element
let tooltipElement = null;
let hideTimeoutId = null;
let currentMaterialName = null;

// Cache for API responses to avoid repeated calls
const sourceCache = new Map();

/**
 * Creates the tooltip DOM element (singleton)
 */
function getOrCreateTooltip() {
  if (tooltipElement) return tooltipElement;

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'material-tooltip';
  tooltipElement.setAttribute('role', 'tooltip');
  tooltipElement.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltipElement);

  // Keep tooltip visible when hovering over it
  tooltipElement.addEventListener('mouseenter', () => {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  });

  tooltipElement.addEventListener('mouseleave', () => {
    hideTooltip();
  });

  return tooltipElement;
}

/**
 * Fetches creature sources for a material (with caching)
 * @param {string} materialName
 * @returns {Promise<Array>}
 */
async function fetchMaterialSources(materialName) {
  const cacheKey = materialName.toLowerCase();
  if (sourceCache.has(cacheKey)) {
    return sourceCache.get(cacheKey);
  }

  try {
    const sources = await window.electronAPI.getMaterialSources(materialName);
    sourceCache.set(cacheKey, sources);
    return sources;
  } catch (err) {
    console.error('Failed to fetch material sources:', err);
    return [];
  }
}

/**
 * Gets material image path based on material name
 * @param {string} materialName
 * @returns {string}
 */
function getMaterialImagePath(materialName) {
  const imageName = materialName.toLowerCase().replace(/\s+/g, '_');
  // Demo version uses a placeholder
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="%23444" width="32" height="32" rx="4"/><text x="16" y="20" font-size="16" text-anchor="middle" fill="%23fff">📦</text></svg>`;
}

/**
 * Attach fallback onerror handlers to all images in tooltip
 */
function attachImageFallbacks(tooltip) {
  tooltip.querySelectorAll('img').forEach((img) => {
    img.onerror = function () {
      this.style.display = 'none';
    };
  });
}

/**
 * Renders the tooltip content
 * @param {string} materialName
 * @param {Array} creatures
 */
function renderTooltipContent(materialName, creatures) {
  const tooltip = getOrCreateTooltip();
  const materialImg = getMaterialImagePath(materialName);

  if (!creatures || creatures.length === 0) {
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <img
          class="tooltip-material-img"
          src="${materialImg}"
          alt="${escapeHtml(materialName)}"
        />
        <span class="tooltip-title">${escapeHtml(materialName)}</span>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-empty">No known creature sources</div>
      </div>
    `;
    attachImageFallbacks(tooltip);
    return;
  }

  // Show all creatures in a scrollable container
  const creatureList = creatures
    .map((creature) => {
      const levelText = creature.level
        ? `<span class="tooltip-creature-level">Lv.${creature.level}</span>`
        : '';
      const levelRange =
        creature.levelMin && creature.levelMax
          ? `<span class="tooltip-creature-level">Lv.${creature.levelMin}-${creature.levelMax}</span>`
          : levelText;

      return `
        <div class="tooltip-creature">
          <span class="tooltip-creature-name">${escapeHtml(creature.name)}</span>
          ${levelRange}
        </div>
      `;
    })
    .join('');

  tooltip.innerHTML = `
    <div class="tooltip-header">
      <img
        class="tooltip-material-img"
        src="${materialImg}"
        alt="${escapeHtml(materialName)}"
      />
      <div class="tooltip-header-text">
        <span class="tooltip-title">${escapeHtml(materialName)}</span>
        <span class="tooltip-count">${creatures.length} source${creatures.length > 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="tooltip-body">
      <div class="tooltip-label">Dropped by:</div>
      <div class="tooltip-creatures-scroll">
        ${creatureList}
      </div>
    </div>
  `;
  attachImageFallbacks(tooltip);
}

/**
 * Positions the tooltip relative to the anchor element
 * @param {HTMLElement} anchor
 */
function positionTooltip(anchor) {
  const tooltip = getOrCreateTooltip();
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // Default: position below the anchor
  let top = anchorRect.bottom + 8;
  let left = anchorRect.left;

  // Check if tooltip would go off the right edge
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }

  // Check if tooltip would go off the bottom edge
  if (top + tooltipRect.height > window.innerHeight - 10) {
    // Position above the anchor instead
    top = anchorRect.top - tooltipRect.height - 8;
  }

  // Ensure tooltip doesn't go off the left edge
  if (left < 10) {
    left = 10;
  }

  // Ensure tooltip doesn't go off the top edge
  if (top < 10) {
    top = 10;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

/**
 * Shows the tooltip for a material
 * @param {string} materialName
 * @param {HTMLElement} anchor
 */
async function showTooltip(materialName, anchor) {
  if (hideTimeoutId) {
    clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
  }

  const tooltip = getOrCreateTooltip();
  currentMaterialName = materialName;
  const materialImg = getMaterialImagePath(materialName);

  // Show loading state with material image
  tooltip.innerHTML = `
    <div class="tooltip-header">
      <img
        class="tooltip-material-img"
        src="${materialImg}"
        alt="${escapeHtml(materialName)}"
      />
      <span class="tooltip-title">${escapeHtml(materialName)}</span>
    </div>
    <div class="tooltip-body">
      <div class="tooltip-loading">Loading sources...</div>
    </div>
  `;
  attachImageFallbacks(tooltip);

  tooltip.classList.add('visible');
  tooltip.setAttribute('aria-hidden', 'false');
  positionTooltip(anchor);

  // Fetch and render sources
  const creatures = await fetchMaterialSources(materialName);

  // Check if still showing the same material
  if (currentMaterialName === materialName) {
    renderTooltipContent(materialName, creatures);
    positionTooltip(anchor);
  }
}

/**
 * Hides the tooltip with a small delay
 */
function hideTooltip() {
  if (hideTimeoutId) {
    clearTimeout(hideTimeoutId);
  }

  hideTimeoutId = setTimeout(() => {
    const tooltip = getOrCreateTooltip();
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
    currentMaterialName = null;
    hideTimeoutId = null;
  }, 150);
}

/**
 * Escapes HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Attaches tooltip behavior to a material element
 * @param {HTMLElement} element
 * @param {string} materialName
 */
function attachMaterialTooltip(element, materialName) {
  element.classList.add('has-tooltip');
  element.setAttribute('data-material', materialName);

  element.addEventListener('mouseenter', () => {
    showTooltip(materialName, element);
  });

  element.addEventListener('mouseleave', () => {
    hideTooltip();
  });

  element.addEventListener('focus', () => {
    showTooltip(materialName, element);
  });

  element.addEventListener('blur', () => {
    hideTooltip();
  });
}

/**
 * Clears the source cache
 */
function clearSourceCache() {
  sourceCache.clear();
}

// Export for use in other modules
window.MaterialTooltip = {
  attach: attachMaterialTooltip,
  show: showTooltip,
  hide: hideTooltip,
  clearCache: clearSourceCache
};
