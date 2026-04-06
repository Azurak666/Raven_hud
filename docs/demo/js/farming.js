/**
 * Farming Tab - Crop selection and farming simulation
 * Allows users to select multiple crops and simulate farming for material production and XP
 * Demo version - adapted for web
 */

// State
let cropData = null;
const selectedCrops = new Set(); // Set of crop IDs
let farmingUserProfile = null;
let farmingSimulationModal = null;
let farmingOwnedLandsData = null;
const currentCropWeights = {}; // User-specified weights per crop (percentage, default 100)
let lastFarmingSimulationResults = null; // Store for Start Session

/**
 * Initialize the farming tab
 */
async function initFarming() {
  const container = document.getElementById('cropItems');
  try {
    // Initialize crop icons cache first (shared utility)
    if (window.CropIcons) {
      await window.CropIcons.init();
    }

    // Load crop data
    cropData = await window.electronAPI.getCropData();
    farmingUserProfile = await window.electronAPI.getProfile();

    // Render initial UI
    renderCropList();
    renderSelectionPanel();

    // Setup filters
    setupFarmingFilters();

    // Render lands summary panel
    renderFarmingLandsSummary();
    setupFarmingLandsSummaryHandlers();

    // Create simulation modal
    createFarmingSimulationModal();

    // Listen for owned lands updates from other tabs
    window.addEventListener('ownedLandsUpdated', () => {
      renderFarmingLandsSummary();
    });
  } catch (err) {
    console.error('Failed to initialize farming tab:', err);
    if (container) {
      container.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-state';
      errorDiv.textContent = `Failed to load crop data: ${err.message}`;
      container.appendChild(errorDiv);
    }
  }
}

/**
 * Setup filter event handlers
 */
function setupFarmingFilters() {
  const searchInput = document.getElementById('cropSearch');
  const categoryFilter = document.getElementById('cropCategoryFilter');

  if (searchInput) {
    // Use shared debounce from utils/debounce.js
    searchInput.addEventListener('input', window.debounce(renderCropList, 200));
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', renderCropList);
  }
}

/**
 * Render the lands summary panel in farming tab
 */
async function renderFarmingLandsSummary() {
  const container = document.getElementById('farmingLandsSummaryContent');
  if (!container) return;

  try {
    const ownedLandsData = await window.electronAPI.getOwnedLands();

    if (!ownedLandsData.totalTiles || ownedLandsData.totalTiles.total === 0) {
      container.innerHTML = `
        <div class="lands-empty-state">
          <p>No lands configured yet</p>
          <p class="empty-state-hint">Use the button below or visit the Land Simulator tab to configure your lands.</p>
        </div>
      `;
      return;
    }

    const landNames = {
      SMALL_COMMUNITY: 'Small Community',
      MEDIUM_COMMUNITY: 'Medium Community',
      LARGE_COMMUNITY: 'Large Community',
      NFT_SMALL: 'NFT Small',
      NFT_MEDIUM: 'NFT Medium',
      NFT_LARGE: 'NFT Large',
      NFT_STRONGHOLD: 'NFT Stronghold',
      NFT_FORT: 'NFT Fort'
    };

    let landsHtml = '<div class="lands-summary-section">';
    landsHtml += '<div class="lands-summary-section-title">Owned Lands</div>';

    Object.entries(ownedLandsData.ownedLands || {}).forEach(([type, count]) => {
      if (count > 0) {
        landsHtml += `
          <div class="land-summary-row">
            <span>${landNames[type]}</span>
            <span class="count">\u00d7${count}</span>
          </div>
        `;
      }
    });

    landsHtml += `
      <div class="land-summary-total">
        <span>Total Tiles</span>
        <span>${ownedLandsData.totalTiles.total}</span>
      </div>
    </div>`;

    container.innerHTML = landsHtml;
  } catch (error) {
    console.error('Error loading farming lands summary:', error);
    container.innerHTML =
      '<div class="lands-empty-state"><p>Error loading lands</p><p class="empty-state-hint">Try reloading or check the Land Simulator tab.</p></div>';
  }
}

/**
 * Setup event handlers for the farming lands summary panel
 */
function setupFarmingLandsSummaryHandlers() {
  const configureBtn = document.getElementById('farmingConfigureLandsBtn');
  if (configureBtn) {
    configureBtn.addEventListener('click', () => {
      // Switch to Land tab
      const landTab = document.querySelector('[data-tab="land"]');
      if (landTab) {
        landTab.click();
      }
    });
  }
}

/**
 * Get filtered and sorted crops
 */
function getFilteredCrops() {
  if (!cropData?.items) return [];

  const searchInput = document.getElementById('cropSearch');
  const categoryFilter = document.getElementById('cropCategoryFilter');

  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  const category = categoryFilter?.value || 'all';

  return cropData.items
    .filter((crop) => {
      // Filter by category
      if (category !== 'all' && crop.category !== category) return false;

      // Filter by search term
      if (searchTerm) {
        const nameMatch = crop.name.toLowerCase().includes(searchTerm);
        const materialMatch = (crop.yields || []).some((y) =>
          y.resource.toLowerCase().includes(searchTerm)
        );
        if (!nameMatch && !materialMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by category then name
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Get XP info for a crop
 */
function getCropXP(crop) {
  const gatherXP = crop.gathering?.experience || 0;
  const butcherXP = crop.butchering?.experience || 0;

  if (gatherXP && butcherXP) {
    return { xp: Math.max(gatherXP, butcherXP), type: gatherXP > butcherXP ? 'gather' : 'butcher' };
  }
  if (gatherXP) {
    return { xp: gatherXP, type: 'gather' };
  }
  if (butcherXP) {
    return { xp: butcherXP, type: 'butcher' };
  }
  return { xp: 0, type: null };
}

/**
 * Get growth time for display
 */
function getGrowthTime(crop) {
  // For husbandry, use gathering time if available, else butchering time
  if (crop.category === 'husbandry') {
    return crop.gathering?.time || crop.butchering?.time || crop.growthTime || '?';
  }
  return crop.gathering?.time || crop.growthTime || '?';
}

/**
 * Render the crop list
 */
function renderCropList() {
  const container = document.getElementById('cropItems');
  if (!container) return;

  const crops = getFilteredCrops();

  if (crops.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No crops found matching your filters</p>
      </div>
    `;
    return;
  }

  container.innerHTML = crops
    .map((crop) => {
      const isSelected = selectedCrops.has(crop.id);
      const materials = (crop.yields || []).map((y) => y.resource).join(', ');
      const xpInfo = getCropXP(crop);
      const growthTime = getGrowthTime(crop);
      const size = crop.size || `${crop.width || 1}x${crop.height || 1}`;

      return `
        <div class="crop-item ${isSelected ? 'selected' : ''}" data-id="${crop.id}">
          <div class="crop-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} aria-label="Select ${crop.name}" />
          </div>
          <div class="crop-content">
            <div class="crop-header">
              <span class="crop-icon">${crop.icon || '🌱'}</span>
              <span class="crop-name">${crop.name}</span>
            </div>
            <div class="crop-materials">${materials || 'No yields'}</div>
            <div class="crop-stats">
              <span class="crop-time" title="Growth time">${growthTime}</span>
              <span class="crop-size" title="Size">${size}</span>
              ${xpInfo.xp > 0 ? `<span class="crop-xp" title="${xpInfo.type === 'butcher' ? 'Butchering' : 'Gathering'} XP">${xpInfo.xp.toLocaleString()} XP</span>` : ''}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Add click handlers
  container.querySelectorAll('.crop-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const cropId = item.dataset.id;
      toggleCropSelection(cropId);
    });
  });
}

/**
 * Toggle crop selection
 */
function toggleCropSelection(cropId) {
  if (selectedCrops.has(cropId)) {
    selectedCrops.delete(cropId);
  } else {
    selectedCrops.add(cropId);
  }

  // Update UI
  renderCropList();
  renderSelectionPanel();
}

/**
 * Remove a crop from selection
 */
function removeCropFromSelection(cropId) {
  selectedCrops.delete(cropId);
  renderCropList();
  renderSelectionPanel();
}

/**
 * Clear all selected crops
 */
function clearAllSelections() {
  selectedCrops.clear();
  renderCropList();
  renderSelectionPanel();
}

/**
 * Get selected crop objects
 */
function getSelectedCropObjects() {
  if (!cropData?.items) return [];
  return cropData.items.filter((crop) => selectedCrops.has(crop.id));
}

/**
 * Calculate summary stats for selected crops
 */
function calculateSelectionSummary() {
  const crops = getSelectedCropObjects();

  // Collect materials
  const materials = new Set();
  let totalXP = 0;
  let totalTiles = 0;

  crops.forEach((crop) => {
    // Materials
    (crop.yields || []).forEach((y) => materials.add(y.resource));

    // XP (take max of gathering/butchering)
    const xpInfo = getCropXP(crop);
    totalXP += xpInfo.xp;

    // Tiles
    const width = crop.width || 1;
    const height = crop.height || 1;
    totalTiles += width * height;
  });

  return {
    count: crops.length,
    materials: Array.from(materials),
    totalXP,
    totalTiles
  };
}

/**
 * Render the selection panel
 */
function renderSelectionPanel() {
  const panel = document.getElementById('farmingSelectionPanel');
  if (!panel) return;

  const crops = getSelectedCropObjects();

  if (crops.length === 0) {
    panel.innerHTML = `
      <div class="selection-empty">
        <p class="placeholder-text">Select crops from the list to view farming simulation</p>
      </div>
    `;
    return;
  }

  const summary = calculateSelectionSummary();

  panel.innerHTML = `
    <div class="selection-list">
      ${crops
        .map(
          (crop) => `
        <div class="selection-item" data-id="${crop.id}">
          <span class="selection-icon">${crop.icon || '🌱'}</span>
          <span class="selection-name">${crop.name}</span>
          <button class="selection-remove" title="Remove" data-id="${crop.id}">&times;</button>
        </div>
      `
        )
        .join('')}
    </div>
    <div class="selection-summary">
      <div class="summary-row">
        <span class="summary-label">Materials:</span>
        <span class="summary-value">${summary.materials.slice(0, 5).join(', ')}${summary.materials.length > 5 ? ` +${summary.materials.length - 5} more` : ''}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total XP (base):</span>
        <span class="summary-value">${summary.totalXP.toLocaleString()}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total tiles:</span>
        <span class="summary-value">${summary.totalTiles}</span>
      </div>
    </div>
    <div class="selection-actions">
      <button class="btn-clear-selection" id="clearSelectionBtn">Clear All</button>
      <button class="btn-simulate-farming" id="simulateFarmingBtn">Simulate Farming</button>
    </div>
  `;

  // Add event handlers
  panel.querySelectorAll('.selection-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCropFromSelection(btn.dataset.id);
    });
  });

  const clearBtn = document.getElementById('clearSelectionBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllSelections);
  }

  const simulateBtn = document.getElementById('simulateFarmingBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', openFarmingSimulationModal);
  }
}

/**
 * Create the farming simulation modal
 */
function createFarmingSimulationModal() {
  if (farmingSimulationModal) return;

  farmingSimulationModal = document.createElement('div');
  farmingSimulationModal.id = 'farmingSimulationModal';
  farmingSimulationModal.className = 'modal-overlay hidden';
  farmingSimulationModal.setAttribute('role', 'dialog');
  farmingSimulationModal.setAttribute('aria-modal', 'true');
  farmingSimulationModal.setAttribute('aria-labelledby', 'farmingSimulationModalTitle');
  farmingSimulationModal.innerHTML = `
    <div class="modal-content simulation-modal">
      <div class="modal-header">
        <h2 id="farmingSimulationModalTitle">Farming Simulation</h2>
        <button class="modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body" id="farmingSimulationModalBody">
        <div class="loading-spinner">Loading...</div>
      </div>
    </div>
  `;

  document.body.appendChild(farmingSimulationModal);

  // Close handlers
  const closeBtn = farmingSimulationModal.querySelector('.modal-close');
  closeBtn?.addEventListener('click', closeFarmingSimulationModal);

  farmingSimulationModal.addEventListener('click', (e) => {
    if (e.target === farmingSimulationModal) {
      closeFarmingSimulationModal();
    }
  });
}

/**
 * Close the farming simulation modal
 */
function closeFarmingSimulationModal() {
  if (farmingSimulationModal) {
    farmingSimulationModal.classList.add('hidden');
  }
}

/**
 * Open the farming simulation modal
 */
async function openFarmingSimulationModal() {
  if (!farmingSimulationModal) createFarmingSimulationModal();

  farmingSimulationModal.classList.remove('hidden');
  const modalBody = document.getElementById('farmingSimulationModalBody');
  modalBody.innerHTML = '<div class="loading-spinner">Calculating optimal layouts...</div>';

  try {
    // Get owned lands data
    const ownedLandsData = await window.electronAPI.getOwnedLands();
    farmingOwnedLandsData = ownedLandsData;
    const hasOwnedLands = Object.values(ownedLandsData.ownedLands || {}).some((count) => count > 0);

    if (!hasOwnedLands) {
      modalBody.innerHTML = `
        <div class="no-lands-prompt">
          <h3>No Lands Configured</h3>
          <p>Configure your land ownership in the Land Simulator tab to see a personalized farming simulation.</p>
          <p class="demo-note">In this demo, try selecting some lands in the Land Simulator tab first.</p>
        </div>
      `;
      return;
    }

    // Get selected crops
    const crops = getSelectedCropObjects();
    const cropIds = crops.map((c) => c.id);

    // Initialize crop weights for new crops
    cropIds.forEach((id) => {
      if (currentCropWeights[id] === undefined) {
        currentCropWeights[id] = 100;
      }
    });

    // Call simulation API with weights
    const results = await window.electronAPI.simulateFarmingSelection({
      selectedCrops: cropIds,
      ownedLands: ownedLandsData.ownedLands,
      timeWindowHours: farmingUserProfile?.simulationTimeWindow || 48,
      cropWeights: currentCropWeights
    });

    // Store for Start Session
    lastFarmingSimulationResults = results;

    // Render results
    renderFarmingSimulationResults(results, crops);
  } catch (err) {
    console.error('Farming simulation error:', err);
    modalBody.innerHTML = `
      <div class="error-state">
        <p>Failed to run farming simulation</p>
        <p class="error-detail">${err.message}</p>
        <p class="demo-note">Note: Full simulation is available in the desktop app.</p>
      </div>
    `;
  }
}

/**
 * Sort land simulations by type: Community first (small to large), then NFT (small to large)
 */
function sortLandSimulations(landSimulations) {
  if (!landSimulations || !Array.isArray(landSimulations)) return [];

  const LAND_ORDER = [
    'SMALL_COMMUNITY',
    'MEDIUM_COMMUNITY',
    'LARGE_COMMUNITY',
    'NFT_SMALL',
    'NFT_MEDIUM',
    'NFT_LARGE'
  ];

  return [...landSimulations].sort((a, b) => {
    const typeA = a.land?.landType || '';
    const typeB = b.land?.landType || '';
    const orderA = LAND_ORDER.indexOf(typeA);
    const orderB = LAND_ORDER.indexOf(typeB);
    const effectiveA = orderA === -1 ? 999 : orderA;
    const effectiveB = orderB === -1 ? 999 : orderB;
    return effectiveA - effectiveB;
  });
}

/**
 * Render farming simulation results with land minigrids and crop balance sliders
 */
function renderFarmingSimulationResults(results, selectedCrops) {
  const modalBody = document.getElementById('farmingSimulationModalBody');
  if (!modalBody) return;

  const timeWindow = farmingUserProfile?.simulationTimeWindow || 48;
  const summary = results?.summary || {};
  const yields = results?.yields || {};
  const totalXP = results?.totalXP || 0;
  const landSimulations = results?.landSimulations || [];
  const cropBreakdown = results?.cropBreakdown || [];

  // Sort lands: community small→large, then NFT small→large
  const sortedLandSimulations = sortLandSimulations(landSimulations);

  // Calculate total materials gathered (sum of all yields)
  const totalMaterials = Object.values(yields).reduce(
    (sum, data) => sum + (data.totalYield || 0),
    0
  );

  // Build material pills with emojis
  const materialPillsHtml = Object.entries(yields)
    .map(([material, data]) => {
      const emoji =
        window.CropIcons?.getIcon?.(material.toLowerCase().replace(/\s+/g, '_')) || '📦';
      return `<span class="sim-hero-pill" title="${data.totalYield?.toLocaleString() || 0} ${material}">
        ${emoji} ${material}: ${data.totalYield?.toLocaleString() || 0}
      </span>`;
    })
    .join('');

  // Build crop balance sliders (only if multiple crops selected)
  let cropBalanceHtml = '';
  if (selectedCrops.length > 1) {
    const sliderMax = selectedCrops.length * 100;
    cropBalanceHtml = `
      <div class="sim-hero-balance farming-balance" data-crop-count="${selectedCrops.length}">
        <div class="balance-header-inline">
          <span class="balance-title">Crop Balance</span>
          <button class="btn-reset-balance btn-sm" id="resetCropBalanceBtn" title="Reset all to 100%">Reset</button>
        </div>
        <div class="balance-sliders-inline">
          ${cropBreakdown
            .map((cb) => {
              const currentWeight = currentCropWeights[cb.cropId] ?? 100;
              const emoji = window.CropIcons?.getIcon?.(cb.cropId) || '🌱';
              return `
              <div class="balance-slider-row-inline">
                <span class="slider-emoji">${emoji}</span>
                <span class="slider-material">${cb.cropName}</span>
                <input type="range" class="balance-slider" data-crop-id="${cb.cropId}"
                       min="10" max="${sliderMax}" value="${currentWeight}" step="10" />
                <span class="balance-value">${currentWeight}%</span>
                <span class="slider-lands">(${cb.landsUsed} lands)</span>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Build land cards
  const landCardsHtml = sortedLandSimulations
    .map((landSim, idx) => {
      const { land, simulation } = landSim;
      const placements = simulation?.placements || [];
      const tilesUsed = simulation?.totalTilesUsed || 0;
      const tilesAvail = simulation?.totalTilesAvailable || land.tiles;
      const utilization = simulation?.utilization || 0;

      // Count crops in this land and find primary crop
      const cropCounts = {};
      placements.forEach((p) => {
        const name = p.crop?.name || 'Unknown';
        const id = p.crop?.id || 'unknown';
        if (!cropCounts[name]) {
          cropCounts[name] = { count: 0, id };
        }
        cropCounts[name].count += 1;
      });

      // Get primary crop (most numerous)
      const primaryCrop = Object.entries(cropCounts).sort((a, b) => b[1].count - a[1].count)[0];
      const primaryCropName = primaryCrop ? primaryCrop[0] : '';
      const primaryCropCount = primaryCrop ? primaryCrop[1].count : 0;
      const primaryCropId = primaryCrop ? primaryCrop[1].id : '';

      // Get emoji for primary crop
      const cropEmoji = window.CropIcons?.getIcon?.(primaryCropId) || '🌱';

      return `
      <div class="sim-land-card">
        <div class="sim-land-header">
          <span class="sim-land-name">${land.name}</span>
          <span class="sim-land-util-badge ${getUtilizationClass(utilization)}">${utilization}%</span>
        </div>
        <div class="sim-land-assignment">
          ${cropEmoji} ${primaryCropCount}x ${primaryCropName}
        </div>
        <div class="sim-land-utilization">
          <div class="sim-land-util-bar">
            <div class="sim-land-util-fill ${getUtilizationClass(utilization)}" style="width: ${utilization}%"></div>
          </div>
          <span class="sim-land-util-text">${tilesUsed}/${tilesAvail} tiles</span>
        </div>
      </div>
    `;
    })
    .join('');

  modalBody.innerHTML = `
    <div class="farming-simulation-results owned-lands-section redesigned">
      <div class="demo-banner">
        <strong>Demo Mode:</strong> Full farming simulation with detailed placements is available in the desktop app.
      </div>
      <div class="sim-hero">
        <div class="sim-hero-header">
          <div class="sim-hero-tradepack">
            <div class="sim-hero-info">
              <span class="sim-hero-name">Farming Simulation</span>
              <div class="sim-hero-count-inline">
                <span class="count">${totalMaterials.toLocaleString()}</span>
                <span class="label">materials</span>
              </div>
            </div>
          </div>
          <div class="sim-hero-controls">
            <div class="sim-hero-controls-time">
              <span class="label">Time</span>
              <input type="number" id="farmingTimeWindowInput" class="time-input-compact" value="${timeWindow}" min="1" max="168" step="1" />
              <span class="time-unit">h</span>
              <button id="updateFarmingTimeBtn" class="btn-update btn-xs">Update</button>
            </div>
          </div>
        </div>
        <div class="sim-hero-row">
          <div class="sim-hero-badges">
            <span class="sim-hero-badge crops">${selectedCrops.length} crops</span>
            <span class="sim-hero-badge lands">${summary.totalLands || 0} lands</span>
            <span class="sim-hero-badge tiles">${summary.totalTilesUsed || 0}/${summary.totalTilesAvailable || 0} tiles</span>
            <span class="sim-hero-badge xp" title="Total farming XP">${totalXP.toLocaleString()} XP</span>
          </div>
        </div>
        <div class="sim-hero-materials">
          ${materialPillsHtml || '<span class="no-yields">No yields calculated</span>'}
        </div>
        ${cropBalanceHtml}
      </div>

      <div class="sim-lands-section">
        <div class="sim-lands-header">
          <span class="sim-lands-title">Your Lands (${sortedLandSimulations.length})</span>
        </div>
        <div class="sim-lands-grid">
          ${landCardsHtml || '<div class="no-lands">No lands configured</div>'}
        </div>
      </div>

      ${renderFarmingPlanOverview(sortedLandSimulations, timeWindow)}
    </div>
  `;

  // Add time window update handler
  const updateBtn = document.getElementById('updateFarmingTimeBtn');
  const timeInput = document.getElementById('farmingTimeWindowInput');
  if (updateBtn && timeInput) {
    updateBtn.addEventListener('click', async () => {
      const newTimeWindow = parseInt(timeInput.value, 10);
      if (Number.isNaN(newTimeWindow) || newTimeWindow < 1 || newTimeWindow > 168) return;

      farmingUserProfile.simulationTimeWindow = newTimeWindow;
      await window.electronAPI.saveProfile({
        ...farmingUserProfile,
        simulationTimeWindow: newTimeWindow
      });
      openFarmingSimulationModal();
    });
  }

  // Add crop balance slider handlers
  const balanceSliders = document.querySelectorAll('.farming-balance .balance-slider');
  balanceSliders.forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const cropId = e.target.dataset.cropId;
      const value = parseInt(e.target.value, 10);
      currentCropWeights[cropId] = value;

      // Update displayed value
      const valueSpan = e.target.nextElementSibling;
      if (valueSpan) valueSpan.textContent = `${value}%`;
    });

    slider.addEventListener('change', () => {
      // Re-run simulation with updated weights
      openFarmingSimulationModal();
    });
  });

  // Reset balance button
  const resetBalanceBtn = document.getElementById('resetCropBalanceBtn');
  if (resetBalanceBtn) {
    resetBalanceBtn.addEventListener('click', () => {
      // Reset all weights to 100
      Object.keys(currentCropWeights).forEach((cropId) => {
        currentCropWeights[cropId] = 100;
      });
      openFarmingSimulationModal();
    });
  }
}

/**
 * Get utilization class for color coding
 */
function getUtilizationClass(pct) {
  if (pct >= 90) return 'util-high';
  if (pct >= 70) return 'util-medium';
  return 'util-low';
}

/**
 * Render farming plan overview showing what to plant and when
 */
function renderFarmingPlanOverview(landSimulations, timeWindow) {
  // Collect all unique crops from all land simulations
  const cropPlan = {};
  const safeLandSims = Array.isArray(landSimulations) ? landSimulations : [];
  safeLandSims.forEach((landSim) => {
    (landSim.simulation?.placements || []).forEach((p) => {
      const cropId = p.crop?.id || p.crop?.name;
      const cropName = p.crop?.name || 'Unknown';
      const growthHours = p.crop?.growthHours || 6;

      if (!cropPlan[cropName]) {
        const isButchering = p.crop?.isButchering || false;
        const actualHarvestCount = isButchering ? 1 : Math.floor(timeWindow / growthHours);

        cropPlan[cropName] = {
          cropName,
          cropId,
          emoji: window.CropIcons?.getIcon?.(cropId) || '🌱',
          growthTime: p.crop?.growthTime || 'Unknown',
          growthHours,
          harvestCount: actualHarvestCount,
          isButchering,
          experience: p.crop?.experience || 0,
          totalPlacements: 0,
          lands: []
        };
      }
      cropPlan[cropName].totalPlacements += 1;
      if (!cropPlan[cropName].lands.includes(landSim.land.name)) {
        cropPlan[cropName].lands.push(landSim.land.name);
      }
    });
  });

  const crops = Object.values(cropPlan);
  if (crops.length === 0) return '';

  return `
    <div class="farming-plan-overview">
      <h4>Farming Plan (${timeWindow}h window)</h4>
      <div class="plan-crops">
        ${crops
          .map(
            (crop) => `
          <div class="plan-crop-card">
            <div class="plan-crop-header">
              <span class="plan-emoji">${crop.emoji}</span>
              <span class="plan-crop-name">${crop.cropName}</span>
            </div>
            <div class="plan-crop-details">
              <div class="plan-detail">
                <span class="detail-label">Growth:</span>
                <span class="detail-value">${crop.growthTime || formatHoursCompact(crop.growthHours)}${crop.isButchering ? ' (butcher)' : ''}</span>
              </div>
              <div class="plan-detail">
                <span class="detail-label">Harvests:</span>
                <span class="detail-value">${crop.harvestCount}x per tile</span>
              </div>
              <div class="plan-detail">
                <span class="detail-label">Planted:</span>
                <span class="detail-value">${crop.totalPlacements}x across ${crop.lands.length} land(s)</span>
              </div>
              ${
                crop.experience
                  ? `
              <div class="plan-detail xp-detail">
                <span class="detail-label">XP:</span>
                <span class="detail-value xp-value">${(crop.experience * crop.harvestCount * crop.totalPlacements).toLocaleString()}</span>
              </div>
              `
                  : ''
              }
            </div>
            <div class="plan-crop-schedule">
              ${renderCropHarvestBadges(crop.growthHours, timeWindow, crop.isButchering)}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Render small harvest time badges for a crop
 */
function renderCropHarvestBadges(growthHours, timeWindow, isButchering = false) {
  if (isButchering || !growthHours || growthHours <= 0) {
    return '<span class="harvest-badge butcher">Once</span>';
  }

  const badges = [];
  for (let h = growthHours; h <= timeWindow; h += growthHours) {
    badges.push(`<span class="harvest-badge">${formatHoursCompact(h)}</span>`);
  }
  return badges.length > 0 ? badges.join('') : '<span class="harvest-badge">-</span>';
}

/**
 * Format hours compactly (e.g., "6h", "1d 2h")
 */
function formatHoursCompact(hours) {
  if (!hours || hours <= 0) return '?';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFarming);
} else {
  initFarming();
}
