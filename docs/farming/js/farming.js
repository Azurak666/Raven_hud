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
const FARMING_MAX_SELECTED_LANDS = 10;
let selectedFarmingLandCounts = {
  SMALL_COMMUNITY: 1,
  MEDIUM_COMMUNITY: 0,
  LARGE_COMMUNITY: 0,
  NFT_SMALL: 0,
  NFT_MEDIUM: 0,
  NFT_LARGE: 0,
  NFT_STRONGHOLD: 0,
  NFT_FORT: 0
};
const FARMING_BUFFS_STORAGE_KEY = 'rhud_farming_plentiful_buffs';
let farmingPlentifulBuffs = {
  passive16: false,
  house5: false,
  house10: false
};
const currentCropWeights = {}; // User-specified weights per crop (percentage, default 100)
const currentCropMarketPrices = {}; // User-entered sell price per yielded material
const HIDDEN_YIELD_RESOURCES = new Set(['three-leaf clover', 'fertilizer', 'dense log']);
let lastFarmingSimulationResults = null; // Store for Start Session
let farmingSimulationWindowMode = 'single'; // 'single' | '24h'

const HUSBANDRY_BUTCHER_HOURS_OVERRIDES = {
  small_hare_pen: 6,
  medium_hare_pen: 6,
  small_chicken_pen: 6,
  medium_chicken_pen: 6,
  small_pig_pen: 8,
  medium_pig_pen: 8,
  small_turkey_pen: 12,
  medium_turkey_pen: 12
  ,
  small_sheep_pen: 12,
  medium_sheep_pen: 12
  ,
  small_goat_pen: 8,
  medium_goat_pen: 8
  ,
  small_cow_pen: 20,
  medium_cow_pen: 20
};

const HUSBANDRY_BUTCHER_ONLY_IDS = new Set([
  'small_pig_pen',
  'medium_pig_pen',
  'small_turkey_pen',
  'medium_turkey_pen'
]);

const HUSBANDRY_GATHER_TIMING_OVERRIDES = {
  small_hare_pen: { firstGatherHours: 3, repeatGatherHours: 1.5 },
  medium_hare_pen: { firstGatherHours: 3, repeatGatherHours: 1.5 },
  small_chicken_pen: { firstGatherHours: 3, repeatGatherHours: 1.5 },
  medium_chicken_pen: { firstGatherHours: 3, repeatGatherHours: 1.5 }
  ,
  small_sheep_pen: { firstGatherHours: 6, repeatGatherHours: 3 },
  medium_sheep_pen: { firstGatherHours: 6, repeatGatherHours: 3 }
  ,
  small_goat_pen: { firstGatherHours: 4, repeatGatherHours: 2 },
  medium_goat_pen: { firstGatherHours: 4, repeatGatherHours: 2 }
  ,
  small_cow_pen: { firstGatherHours: 10, repeatGatherHours: 5 },
  medium_cow_pen: { firstGatherHours: 10, repeatGatherHours: 5 }
};

/**
 * Initialize the farming tab
 */
async function initFarming() {
  const container = document.getElementById('cropItems');
  try {
    loadFarmingBuffState();

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

function isHiddenYieldResource(resourceName) {
  return HIDDEN_YIELD_RESOURCES.has(String(resourceName || '').trim().toLowerCase());
}

function getVisibleCropYields(crop) {
  return (crop?.yields || []).filter((yieldInfo) => !isHiddenYieldResource(yieldInfo.resource));
}

function filterVisibleYieldTotals(yields) {
  return Object.fromEntries(
    Object.entries(yields || {}).filter(([resource]) => !isHiddenYieldResource(resource))
  );
}

const FARMING_LAND_LABELS = {
  SMALL_COMMUNITY: 'Small Community',
  MEDIUM_COMMUNITY: 'Medium Community',
  LARGE_COMMUNITY: 'Large Community',
  NFT_SMALL: 'NFT Small',
  NFT_MEDIUM: 'NFT Medium',
  NFT_LARGE: 'NFT Large',
  NFT_STRONGHOLD: 'NFT Stronghold',
  NFT_FORT: 'NFT Fort'
};

const FARMING_LAND_TILES = {
  SMALL_COMMUNITY: 56,
  MEDIUM_COMMUNITY: 91,
  LARGE_COMMUNITY: 137,
  NFT_SMALL: 100,
  NFT_MEDIUM: 144,
  NFT_LARGE: 225,
  NFT_STRONGHOLD: 484,
  NFT_FORT: 900
};

function buildFarmingOwnedLandEntries() {
  const order = [
    'SMALL_COMMUNITY',
    'MEDIUM_COMMUNITY',
    'LARGE_COMMUNITY',
    'NFT_SMALL',
    'NFT_MEDIUM',
    'NFT_LARGE',
    'NFT_STRONGHOLD',
    'NFT_FORT'
  ];

  return order.map((landType) => ({
    id: landType,
    landType,
    label: FARMING_LAND_LABELS[landType] || landType,
    tiles: FARMING_LAND_TILES[landType] || 0,
    hasHouse: landType.startsWith('NFT_')
  }));
}

function getSelectedFarmingLandTotalCount() {
  return Object.values(selectedFarmingLandCounts).reduce(
    (sum, count) => sum + Math.max(Number(count) || 0, 0),
    0
  );
}

function getSelectedFarmingOwnedLands() {
  return Object.fromEntries(
    Object.entries(selectedFarmingLandCounts).filter(([, count]) => Number(count) > 0)
  );
}

function getSelectedFarmingLandEntries() {
  return buildFarmingOwnedLandEntries()
    .map((entry) => ({ ...entry, count: Number(selectedFarmingLandCounts[entry.landType] || 0) }))
    .filter((entry) => entry.count > 0);
}

function getSelectedFarmingLandTotals() {
  const selectedEntries = getSelectedFarmingLandEntries();
  const totalLands = selectedEntries.reduce((sum, entry) => sum + entry.count, 0);
  const totalTiles = selectedEntries.reduce((sum, entry) => sum + (entry.tiles * entry.count), 0);

  return {
    totalLands,
    totalTiles,
    selectedEntries
  };
}

function isCommunityLandType(landType) {
  return String(landType || '').endsWith('_COMMUNITY');
}

function getLandTypeMaxCount(landType) {
  return isCommunityLandType(landType) ? 1 : FARMING_MAX_SELECTED_LANDS;
}

function setSelectedFarmingLandCount(landType, nextCount) {
  if (!landType || !Object.prototype.hasOwnProperty.call(FARMING_LAND_LABELS, landType)) {
    return false;
  }

  const currentCount = Math.max(Number(selectedFarmingLandCounts[landType]) || 0, 0);
  const requestedCount = Math.max(Number(nextCount) || 0, 0);
  const boundedCount = Math.min(requestedCount, getLandTypeMaxCount(landType));

  if (boundedCount === currentCount) return false;

  const totalWithoutCurrent = getSelectedFarmingLandTotalCount() - currentCount;
  const allowedForType = Math.max(FARMING_MAX_SELECTED_LANDS - totalWithoutCurrent, 0);
  const finalCount = Math.min(boundedCount, allowedForType);

  if (finalCount === currentCount) return false;

  selectedFarmingLandCounts[landType] = finalCount;
  renderFarmingLandsSummary();
  renderSelectionPanel();

  if (farmingSimulationModal && !farmingSimulationModal.classList.contains('hidden')) {
    openFarmingSimulationModal();
  }

  return true;
}

function loadFarmingBuffState() {
  try {
    const raw = localStorage.getItem(FARMING_BUFFS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    farmingPlentifulBuffs = {
      passive16: Boolean(parsed?.passive16),
      house5: Boolean(parsed?.house5),
      house10: Boolean(parsed?.house10)
    };

    if (farmingPlentifulBuffs.house5 && farmingPlentifulBuffs.house10) {
      farmingPlentifulBuffs.house5 = false;
    }
  } catch (error) {
    console.warn('Failed to load farming buffs state:', error);
  }
}

function saveFarmingBuffState() {
  try {
    localStorage.setItem(FARMING_BUFFS_STORAGE_KEY, JSON.stringify(farmingPlentifulBuffs));
  } catch (error) {
    console.warn('Failed to save farming buffs state:', error);
  }
}

function getPlentifulChancePercent() {
  let chance = 0;
  if (farmingPlentifulBuffs.passive16) chance += 16;
  if (farmingPlentifulBuffs.house10) {
    chance += 10;
  } else if (farmingPlentifulBuffs.house5) {
    chance += 5;
  }
  return chance;
}

function getPlentifulExpectedMultiplier() {
  const chancePct = getPlentifulChancePercent();
  return 1 + (chancePct / 100) * 0.5;
}

function getPrimaryVisibleYield(crop) {
  const yields = getVisibleCropYields(crop);
  if (!yields.length) return null;
  return yields[0];
}

function getLandYieldRangeForCrop(landEntry, crop, tilesUsedOverride = null) {
  if (!landEntry || !crop) return null;

  const primaryYield = getPrimaryVisibleYield(crop);
  if (!primaryYield) return null;

  const tileFootprint = Math.max((crop.width || 1) * (crop.height || 1), 1);
  // Use tilesUsedOverride if provided, else fall back to landEntry.tiles
  const tilesToUse = tilesUsedOverride != null ? tilesUsedOverride : (landEntry.tiles || 0);
  const slots = Math.max(Math.floor(tilesToUse / tileFootprint), 0);
  const baseMin = Number(primaryYield.min ?? primaryYield.avg ?? 0);
  const baseMax = Number(primaryYield.max ?? primaryYield.avg ?? baseMin);
  const plentifulMultiplier = getPlentifulExpectedMultiplier();

  return {
    resource: primaryYield.resource,
    min: Math.round(baseMin * slots * plentifulMultiplier),
    max: Math.round(baseMax * slots * plentifulMultiplier)
  };
}

function applyPlentifulBonusToYields(yields) {
  const multiplier = getPlentifulExpectedMultiplier();
  const boosted = {};

  Object.entries(yields || {}).forEach(([material, data]) => {
    const baseTotal = Number(data?.totalYield || 0);
    boosted[material] = {
      ...data,
      totalYield: Math.round(baseTotal * multiplier)
    };
  });

  return boosted;
}

function openFarmingLandInspector(landType) {
  if (!landType) return;

  const landTypeSelect = document.getElementById('landTypeSelect');
  const landTab = document.querySelector('[data-tab="land"]');

  if (landTypeSelect) {
    landTypeSelect.value = landType;
    landTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  landTab?.click();
}

/**
 * Render the lands summary panel in farming tab
 */
async function renderFarmingLandsSummary() {
  const container = document.getElementById('farmingLandsSummaryContent');
  if (!container) return;

  try {
    const availableLandEntries = buildFarmingOwnedLandEntries();
    const selectedTotal = getSelectedFarmingLandTotalCount();
    const selectedTotals = getSelectedFarmingLandTotals();
    const canIncrement = selectedTotal < FARMING_MAX_SELECTED_LANDS;

    const plentifulChance = getPlentifulChancePercent();

    let landsHtml = '<div class="lands-summary-section">';
    landsHtml += '<div class="lands-summary-section-title">Choose Lands</div>';
    landsHtml += `<div class="farming-land-select-hint">Pick up to ${FARMING_MAX_SELECTED_LANDS} lands total. Farming results combine all selected lands.</div>`;
    landsHtml += `
      <div class="farming-land-selection-summary">
        <span class="farming-land-selection-count">${selectedTotals.totalLands}/${FARMING_MAX_SELECTED_LANDS} lands</span>
        <span class="farming-land-selection-tiles">${selectedTotals.totalTiles.toLocaleString()} tiles</span>
      </div>
    `;
    landsHtml += '<div class="farming-land-select-list">';

    availableLandEntries.forEach((entry) => {
      const count = Number(selectedFarmingLandCounts[entry.landType] || 0);
      const disableInc = !canIncrement || count >= getLandTypeMaxCount(entry.landType);
      const disableDec = count <= 0;
      landsHtml += `
        <div class="farming-land-select-btn ${count > 0 ? 'selected' : ''}" data-land-type="${entry.landType}" data-land-id="${entry.id}">
          <div class="farming-land-select-main">
            <span class="farming-land-select-name">${entry.label}</span>
            <span class="farming-land-select-meta">${entry.hasHouse ? 'house' : ''}</span>
          </div>
          <div class="farming-land-counter" role="group" aria-label="Adjust ${entry.label} count">
            <button type="button" class="farming-land-counter-btn" data-land-action="decrement" data-land-type="${entry.landType}" ${disableDec ? 'disabled' : ''}>−</button>
            <span class="farming-land-counter-value">${count}</span>
            <button type="button" class="farming-land-counter-btn" data-land-action="increment" data-land-type="${entry.landType}" ${disableInc ? 'disabled' : ''}>+</button>
          </div>
        </div>
      `;
    });

    landsHtml += '</div>';
    landsHtml += `
      <div class="farming-buffs-box">
        <div class="farming-buffs-title">Plentiful Buffs</div>
        <label class="farming-buff-row">
          <input type="checkbox" class="farming-buff-toggle" data-buff="passive16" ${farmingPlentifulBuffs.passive16 ? 'checked' : ''} />
          <span>Plentiful passive 16%</span>
        </label>
        <label class="farming-buff-row">
          <input type="checkbox" class="farming-buff-toggle" data-buff="house5" ${farmingPlentifulBuffs.house5 ? 'checked' : ''} />
          <span>House plentiful 5%</span>
        </label>
        <label class="farming-buff-row">
          <input type="checkbox" class="farming-buff-toggle" data-buff="house10" ${farmingPlentifulBuffs.house10 ? 'checked' : ''} />
          <span>House plentiful 10%</span>
        </label>
        <div class="farming-buff-note">Expected plentiful chance: ${plentifulChance}% for +50% materials</div>
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
  const landsSummaryContent = document.getElementById('farmingLandsSummaryContent');
  if (landsSummaryContent) {
    landsSummaryContent.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-land-action][data-land-type]');
      if (!actionBtn) return;

      const landType = actionBtn.dataset.landType;
      const action = actionBtn.dataset.landAction;
      const currentCount = Number(selectedFarmingLandCounts[landType] || 0);
      const nextCount = action === 'increment' ? currentCount + 1 : currentCount - 1;

      setSelectedFarmingLandCount(landType, nextCount);
    });

    landsSummaryContent.addEventListener('change', (event) => {
      const buffToggle = event.target.closest('.farming-buff-toggle');
      if (!buffToggle) return;

      const buffKey = buffToggle.dataset.buff;
      if (!Object.prototype.hasOwnProperty.call(farmingPlentifulBuffs, buffKey)) return;

      farmingPlentifulBuffs[buffKey] = Boolean(buffToggle.checked);

      if (buffKey === 'house5' && farmingPlentifulBuffs.house5) {
        farmingPlentifulBuffs.house10 = false;
      }
      if (buffKey === 'house10' && farmingPlentifulBuffs.house10) {
        farmingPlentifulBuffs.house5 = false;
      }

      saveFarmingBuffState();
      renderFarmingLandsSummary();

      if (farmingSimulationModal && !farmingSimulationModal.classList.contains('hidden')) {
        openFarmingSimulationModal();
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
  const category = (categoryFilter?.value || 'all').toLowerCase();

  return cropData.items
    .filter((crop) => {
      // Filter by category
      if (category !== 'all' && String(crop.category || '').toLowerCase() !== category) return false;

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
  const gatherXP = crop.gathering?.professionXP || crop.gathering?.experience || crop.professionXP || crop.experience || crop.legacyXP || 0;
  const butcherXP = crop.butchering?.professionXP || crop.butchering?.experience || crop.professionXP || crop.experience || crop.legacyXP || 0;

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
    const overriddenButcherHours = HUSBANDRY_BUTCHER_HOURS_OVERRIDES[crop.id];
    if (HUSBANDRY_BUTCHER_ONLY_IDS.has(crop.id) && overriddenButcherHours) {
      return `${overriddenButcherHours}H`;
    }
    return crop.gathering?.time || crop.butchering?.time || crop.growthTime || '?';
  }
  // Patch: For herbalism 2x2 crops, use the 1x1's growthTime if available
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_glade')) {
    // Brightday Glade special case
    return '8H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_colony')) {
    // Mushroom colonies (Juicy, Earthy, etc.)
    return '8H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_bush')) {
    // Chest Warmer Bush, Rohna Mint Bush, etc.
    return '20H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_bed')) {
    // Dry Mushroom Bed, Crystal Mushroom Bed
    return '20H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_sprawl')) {
    // Bloodthorn Sprawl, Withered Mushroom Sprawl
    return '16H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_thicket')) {
    // Dread Bloom Thicket, Mindbender Thicket
    return '24H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_cluster')) {
    // Green Mushroom Cluster, Twisted Flower Cluster, etc.
    return '9H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_shrub')) {
    // Pirate's Bliss Shrub
    return '12H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_bloom')) {
    // Cerulean Mushroom Bloom
    return '6H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_delight_cluster')) {
    // Lizard's Delight Cluster
    return '9H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_fungi_sprawl')) {
    // Pirate's Fungi Sprawl
    return '12H';
  }
  if (crop.category === 'herbalism' && crop.size === '2x2' && crop.id.endsWith('_mushroom_colony')) {
    // Shadow Mushroom Colony, Earthy Mushroom Colony
    return '6H';
  }
  // Default
  return crop.gathering?.time || crop.growthTime || '?';
}

function parseTimeStringToHours(timeStr) {
  if (!timeStr) return 0;

  const normalized = String(timeStr).trim();
  let hours = 0;

  const dayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[dD]/);
  if (dayMatch) hours += parseFloat(dayMatch[1]) * 24;

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[hH]/);
  if (hourMatch) hours += parseFloat(hourMatch[1]);

  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[mM]/);
  if (minMatch) hours += parseFloat(minMatch[1]) / 60;

  return hours;
}

function getCropCycleHours(crop) {
  if (crop?.category === 'husbandry' && HUSBANDRY_BUTCHER_HOURS_OVERRIDES[crop.id]) {
    return HUSBANDRY_BUTCHER_HOURS_OVERRIDES[crop.id];
  }

  const minutes =
    crop.gathering?.timeMinutes || crop.butchering?.timeMinutes || crop.growthTimeMinutes || 0;

  if (minutes > 0) {
    return minutes / 60;
  }

  return parseTimeStringToHours(getGrowthTime(crop));
}

function getSingleCycleTimeLabel(crops) {
  if (crops.length === 1) {
    return formatGrowthTimeDisplay(getGrowthTime(crops[0]));
  }
  return '1 cycle each';
}

function formatGrowthTimeDisplay(timeStr) {
  if (!timeStr || timeStr === '?') return timeStr;

  const hours = parseTimeStringToHours(timeStr);
  if (hours <= 0) return timeStr;

  // Format: round to 1 decimal, drop trailing zeros, then add unit
  let formatted = Math.round(hours * 10) / 10;
  return `${formatted}H`;
}

function getFarmingSimulationWindowConfig(crops, windowMode = 'single') {
  if (windowMode === '24h') {
    return {
      singleCycleMode: false,
      timeWindowHours: 24,
      displayTimeLabel: '24H'
    };
  }

  const cycleTimeHours = crops.length === 1 ? getCropCycleHours(crops[0]) : 0;
  return {
    singleCycleMode: true,
    timeWindowHours: cycleTimeHours,
    displayTimeLabel: getSingleCycleTimeLabel(crops)
  };
}

function getFarmingWindowCycleSummary(crops, timeWindowHours, singleCycleMode) {
  if (singleCycleMode) return '';

  if (crops.length === 1) {
    const cycleHours = getCropCycleHours(crops[0]);
    if (cycleHours > 0) {
      const cycles = Math.max(1, Math.floor(timeWindowHours / cycleHours));
      return `${cycles} harvest cycles in ${timeWindowHours}h`;
    }
  }

  return `Harvests scaled to a ${timeWindowHours}h window`;
}

function getFarmingHarvestsPer24hSummary(results, selectedCrops) {
  const landSimulations = Array.isArray(results?.landSimulations) ? results.landSimulations : [];
  const cropStats = new Map();

  landSimulations.forEach((landSim) => {
    (landSim?.simulation?.placements || []).forEach((placement) => {
      const crop = placement?.crop;
      if (!crop?.id) return;

      if (!cropStats.has(crop.id)) {
        cropStats.set(crop.id, {
          name: crop.name || crop.id,
          placements: 0,
          harvestsPerTile24h: calculatePlacementHarvestCount(crop, 24, false)
        });
      }

      cropStats.get(crop.id).placements += 1;
    });
  });

  if (!cropStats.size) {
    if (selectedCrops.length === 1) {
      const cycleHours = getCropCycleHours(selectedCrops[0]);
      if (cycleHours > 0) {
        return `${Math.max(1, Math.floor(24 / cycleHours))} harvests per 24h`;
      }
    }
    return '';
  }

  if (cropStats.size === 1) {
    const only = Array.from(cropStats.values())[0];
    const totalHarvests = only.harvestsPerTile24h * only.placements;
    return `${totalHarvests.toLocaleString()} total harvests per 24h`;
  }

  let totalHarvestActions = 0;
  cropStats.forEach((stats) => {
    totalHarvestActions += stats.harvestsPerTile24h * stats.placements;
  });

  return `${totalHarvestActions.toLocaleString()} total harvests per 24h`;
}

function getHusbandryHarvestAndButcherSummary(results, selectedCrops) {
  if (!Array.isArray(selectedCrops) || selectedCrops.length !== 1) return '';

  const selectedCrop = selectedCrops[0];
  if (selectedCrop?.category !== 'husbandry' || !selectedCrop?.butchering) {
    return '';
  }

  const landSimulations = Array.isArray(results?.landSimulations) ? results.landSimulations : [];
  let firstPlacementCrop = null;

  landSimulations.some((landSim) => {
    return (landSim?.simulation?.placements || []).some((placement) => {
      const crop = placement?.crop;
      if (!crop || crop.id !== selectedCrop.id) return false;
      firstPlacementCrop = crop;
      return true;
    });
  });

  if (!firstPlacementCrop) return '';

  const harvestCycles24h = calculatePlacementHarvestCount(firstPlacementCrop, 24, false);

  const butcherHours = HUSBANDRY_BUTCHER_HOURS_OVERRIDES[selectedCrop.id]
    || (selectedCrop?.butchering?.timeMinutes
      ? (Number(selectedCrop.butchering.timeMinutes) / 60)
      : parseTimeStringToHours(selectedCrop?.butchering?.time || ''));
  if (!butcherHours || butcherHours <= 0) {
    return `${harvestCycles24h} harvest cycles in 24h`;
  }

  const butcherCycles24h = Math.floor(24 / butcherHours);

  if (HUSBANDRY_BUTCHER_ONLY_IDS.has(selectedCrop.id) || !selectedCrop?.gathering) {
    return `${butcherCycles24h} butcher cycles in 24h`;
  }

  return `${harvestCycles24h} harvest cycles in 24h and ${butcherCycles24h} butcher cycles in 24h`;
}

function formatHoursForSummary(hours) {
  const value = Number(hours || 0);
  if (!value || value <= 0) return '?';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}H`;
}

function getHusbandryInteractionTimersSummary(results, selectedCrops) {
  if (!Array.isArray(selectedCrops) || selectedCrops.length !== 1) return '';

  const selectedCrop = selectedCrops[0];
  if (
    selectedCrop?.category !== 'husbandry'
    || !selectedCrop?.gathering
    || !selectedCrop?.butchering
    || HUSBANDRY_BUTCHER_ONLY_IDS.has(selectedCrop.id)
  ) {
    return '';
  }

  const landSimulations = Array.isArray(results?.landSimulations) ? results.landSimulations : [];
  let firstPlacementCrop = null;

  landSimulations.some((landSim) => {
    return (landSim?.simulation?.placements || []).some((placement) => {
      const crop = placement?.crop;
      if (!crop || crop.id !== selectedCrop.id) return false;
      firstPlacementCrop = crop;
      return true;
    });
  });

  const timingOverride = HUSBANDRY_GATHER_TIMING_OVERRIDES[selectedCrop.id] || {};
  const repeatGatherHours =
    timingOverride.repeatGatherHours
    || Number(firstPlacementCrop?.repeatGatherHours || 0)
    || (selectedCrop?.gathering?.timeMinutes
      ? (Number(selectedCrop.gathering.timeMinutes) / 60)
      : parseTimeStringToHours(selectedCrop?.gathering?.time || ''));

  const firstGatherHours =
    timingOverride.firstGatherHours
    || Number(firstPlacementCrop?.firstGatherHours || 0)
    || Math.max(
      selectedCrop?.growthTimeMinutes ? (Number(selectedCrop.growthTimeMinutes) / 60) : 0,
      repeatGatherHours || 0
    );

  const butcherHours = HUSBANDRY_BUTCHER_HOURS_OVERRIDES[selectedCrop.id]
    || (selectedCrop?.butchering?.timeMinutes
      ? (Number(selectedCrop.butchering.timeMinutes) / 60)
      : parseTimeStringToHours(selectedCrop?.butchering?.time || ''));

  return `First: ${formatHoursForSummary(firstGatherHours)} • Nexts: ${formatHoursForSummary(repeatGatherHours)} • Butcher: ${formatHoursForSummary(butcherHours)}`;
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
      const materials = getVisibleCropYields(crop).map((y) => y.resource).join(', ');
      const xpInfo = getCropXP(crop);
      const growthTime = formatGrowthTimeDisplay(getGrowthTime(crop));
      const size = crop.size || `${crop.width || 1}x${crop.height || 1}`;

      return `
        <div class="crop-item ${isSelected ? 'selected' : ''}" data-id="${crop.id}" aria-pressed="${isSelected ? 'true' : 'false'}">
          <div class="crop-content">
            <div class="crop-header">
              <span class="crop-icon">${crop.icon || '🌱'}</span>
              <span class="crop-name">${crop.name}</span>
              ${isSelected ? '<span class="crop-selected-badge">Selected</span>' : ''}
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
  const isAlreadySelected = selectedCrops.has(cropId);

  selectedCrops.clear();

  if (!isAlreadySelected) {
    selectedCrops.add(cropId);
  }

  renderCropList();
  renderSelectionPanel();
  renderFarmingLandsSummary();
}

/**
 * Remove a crop from selection
 */
function removeCropFromSelection(cropId) {
  selectedCrops.delete(cropId);
  renderCropList();
  renderSelectionPanel();
  renderFarmingLandsSummary();
}

/**
 * Clear all selected crops
 */
function clearAllSelections() {
  selectedCrops.clear();
  renderCropList();
  renderSelectionPanel();
  renderFarmingLandsSummary();
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
    getVisibleCropYields(crop).forEach((y) => materials.add(y.resource));

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
        <p class="placeholder-text">Select one crop from the list to view farming simulation</p>
      </div>
    `;
    return;
  }

  const summary = calculateSelectionSummary();
  const selectedLandTotals = getSelectedFarmingLandTotals();
  const selectedCrop = crops[0] || null;
  // Try to use actual planted/used tiles from last simulation if available
  let tilesUsedByLandType = {};
  if (lastFarmingSimulationResults && Array.isArray(lastFarmingSimulationResults.landSimulations)) {
    lastFarmingSimulationResults.landSimulations.forEach((landSim) => {
      if (landSim && landSim.landType && landSim.simulation && typeof landSim.simulation.totalTilesUsed === 'number') {
        tilesUsedByLandType[landSim.landType] = landSim.simulation.totalTilesUsed;
      }
    });
  }

  const selectedLandYieldRange = selectedCrop
    ? selectedLandTotals.selectedEntries.reduce(
        (acc, entry) => {
          // Use tilesUsed from simulation if available, else fallback
          const tilesUsed = typeof tilesUsedByLandType[entry.landType] === 'number' ? tilesUsedByLandType[entry.landType] : (typeof entry.tilesUsed === 'number' ? entry.tilesUsed : null);
          const range = getLandYieldRangeForCrop(entry, selectedCrop, tilesUsed);
          if (!range) return acc;

          acc.resource = range.resource;
          acc.min += range.min * entry.count;
          acc.max += range.max * entry.count;
          return acc;
        },
        { resource: '', min: 0, max: 0 }
      )
    : null;
  const selectedLandMixLabel = selectedLandTotals.selectedEntries.length
    ? selectedLandTotals.selectedEntries
      .map((entry) => `${entry.label} x${entry.count}`)
      .join(', ')
    : 'None selected';
  const hasSelectedLands = selectedLandTotals.totalLands > 0;

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
        <span class="summary-label">Selected lands:</span>
        <span class="summary-value">${selectedLandTotals.totalLands}/${FARMING_MAX_SELECTED_LANDS}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Land mix:</span>
        <span class="summary-value">${selectedLandMixLabel}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Materials:</span>
        <span class="summary-value">${summary.materials.slice(0, 5).join(', ')}${summary.materials.length > 5 ? ` +${summary.materials.length - 5} more` : ''}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total XP (base):</span>
        <span class="summary-value">${summary.totalXP.toLocaleString()}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Crop footprint:</span>
        <span class="summary-value">${summary.totalTiles}</span>
      </div>
    </div>
    <div class="selection-actions">
      <button class="btn-clear-selection" id="clearSelectionBtn">Clear All</button>
      <button class="btn-simulate-farming" id="simulateFarmingBtn" ${hasSelectedLands ? '' : 'disabled'}>Simulate ${hasSelectedLands ? `${selectedLandTotals.totalLands} Lands` : 'Lands'}</button>
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
async function openFarmingSimulationModal(windowMode = null) {
  if (!farmingSimulationModal) createFarmingSimulationModal();

  if (windowMode === 'single' || windowMode === '24h') {
    farmingSimulationWindowMode = windowMode;
  }

  farmingSimulationModal.classList.remove('hidden');
  const modalBody = document.getElementById('farmingSimulationModalBody');
  modalBody.innerHTML = '<div class="loading-spinner">Calculating optimal layouts...</div>';

  try {
    const selectedOwnedLands = getSelectedFarmingOwnedLands();
    const selectedTotals = getSelectedFarmingLandTotals();
    if (!Object.keys(selectedOwnedLands).length) {
      modalBody.innerHTML = `
        <div class="no-lands-prompt">
          <h3>No Land Selected</h3>
          <p>Select at least one land from the left sidebar to run combined farming results.</p>
        </div>
      `;
      return;
    }

    const ownedLandsData = {
      ownedLands: selectedOwnedLands,
      totalTiles: { total: selectedTotals.totalTiles }
    };
    farmingOwnedLandsData = ownedLandsData;

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
    const simulationWindow = getFarmingSimulationWindowConfig(crops, farmingSimulationWindowMode);
    const results = await window.electronAPI.simulateFarmingSelection({
      selectedCrops: cropIds,
      ownedLands: ownedLandsData.ownedLands,
      timeWindowHours: simulationWindow.timeWindowHours,
      cropWeights: currentCropWeights,
      singleCycleMode: simulationWindow.singleCycleMode
    });

    results.singleCycleMode = simulationWindow.singleCycleMode;
    results.displayTimeLabel = simulationWindow.displayTimeLabel;
    results.displayTimeHours = simulationWindow.timeWindowHours;

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

function renderFarmingLandMiniGrid(land, simulation) {
  const validTiles = Array.isArray(land?.validTiles) ? land.validTiles : [];
  const width = land?.width || 1;
  const height = land?.height || 1;
  const placements = simulation?.placements || [];

  if (!validTiles.length || !width || !height) return '';

  const validTileSet = new Set(validTiles.map((tile) => `${tile.x},${tile.y}`));
  const houseSet = new Set();

  if (Array.isArray(land?.houseTilesPreview) && land.houseTilesPreview.length) {
    land.houseTilesPreview.forEach((tile) => houseSet.add(`${tile.x},${tile.y}`));
  } else if (land?.hasHouse && land?.housePosition && window.LandLayoutUtils?.getHouseTilesAtPosition) {
    const houseTiles = window.LandLayoutUtils.getHouseTilesAtPosition(
      land,
      land.housePosition,
      land.houseRotation || 0
    );
    houseTiles.house.forEach((tile) => houseSet.add(`${tile.x},${tile.y}`));
    houseTiles.door.forEach((tile) => houseSet.add(`${tile.x},${tile.y}`));
    houseTiles.clearance.forEach((tile) => houseSet.add(`${tile.x},${tile.y}`));
  }

  // Keep all previews inside a consistent card width, including very wide lands like Fort.
  const maxGridWidth = 220;
  const cellSize = Math.max(5, Math.min(30, Math.floor(maxGridWidth / width)));
  const gridWidth = width * cellSize;
  const gridHeight = height * cellSize;
  const iconSize = Math.max(8, Math.min(14, Math.floor(cellSize * 0.75)));

  let cells = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      let className = 'farming-layout-cell empty';
      if (validTileSet.has(key)) className = 'farming-layout-cell soil';
      if (houseSet.has(key)) className = 'farming-layout-cell house';
      cells += `<div class="${className}"></div>`;
    }
  }

  const overlays = placements
    .map((placement) => {
      const itemWidth = placement.crop?.width || 1;
      const itemHeight = placement.crop?.height || 1;
      const sizeClass = `size-${itemWidth}`;
      const icon = placement.crop?.icon || window.CropIcons?.getIcon?.(placement.crop?.id) || '🌱';
      return `
        <div class="farming-layout-item ${sizeClass}" style="left:${placement.x * cellSize}px; top:${placement.y * cellSize}px; width:${itemWidth * cellSize}px; height:${itemHeight * cellSize}px;">
          <span>${icon}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="emoji-grid farming-layout-preview" style="width:${gridWidth}px; height:${gridHeight}px; grid-template-columns: repeat(${width}, ${cellSize}px); grid-template-rows: repeat(${height}, ${cellSize}px); --farming-grid-icon-size:${iconSize}px;">
      ${cells}
      ${overlays}
    </div>
  `;
}

function formatSilver(amount) {
  return `${Math.round(Number(amount) || 0).toLocaleString()} silver`;
}

function getFarmingFallbackPrice(material, selectedCrops) {
  let fallbackPrice = 0;

  (selectedCrops || []).some((crop) =>
    (crop.yields || []).some((yieldInfo) => {
      if (yieldInfo.resource !== material || yieldInfo.unitCost == null) return false;
      fallbackPrice = Number(yieldInfo.unitCost) || 0;
      return true;
    })
  );

  return fallbackPrice;
}

function getDefaultFarmingPriceMap(yields, selectedCrops) {
  const prices = {};

  Object.keys(yields || {}).forEach((material) => {
    if (currentCropMarketPrices[material] !== undefined) {
      prices[material] = Math.max(Number(currentCropMarketPrices[material]) || 0, 0);
      return;
    }

    const fallbackPrice = getFarmingFallbackPrice(material, selectedCrops);
    prices[material] = fallbackPrice;
    currentCropMarketPrices[material] = fallbackPrice;
  });

  return prices;
}

function calculateFarmingProfitSummary(yields, priceMap, plantingCost = 0) {
  const rowTotals = {};
  let totalValue = 0;

  Object.entries(yields || {}).forEach(([material, data]) => {
    const quantity = Number(data?.totalYield || 0);
    const price = Math.max(Number(priceMap?.[material] || 0), 0);
    const total = quantity * price;
    rowTotals[material] = total;
    totalValue += total;
  });

  const safePlantingCost = Math.max(Number(plantingCost) || 0, 0);

  return {
    totalValue,
    plantingCost: safePlantingCost,
    profit: totalValue - safePlantingCost,
    rowTotals
  };
}

function updateFarmingProfitSummary(modalBody, yields, plantingCost = 0) {
  if (!modalBody) return;

  const priceMap = {};
  const priceInputs = modalBody.querySelectorAll('.farming-price-input');

  priceInputs.forEach((input) => {
    const material = input.dataset.material;
    const value = Math.max(Number(input.value || 0), 0);
    priceMap[material] = value;
    currentCropMarketPrices[material] = value;
  });

  const summary = calculateFarmingProfitSummary(yields, priceMap, plantingCost);

  Object.entries(summary.rowTotals).forEach(([material, total]) => {
    const rowTotal = modalBody.querySelector(`[data-price-total="${material}"]`);
    if (rowTotal) {
      rowTotal.textContent = formatSilver(total);
    }
  });

  const totalValueEl = modalBody.querySelector('#farmingTotalValue');
  if (totalValueEl) totalValueEl.textContent = formatSilver(summary.totalValue);

  const plantingCostEl = modalBody.querySelector('#farmingPlantingCost');
  if (plantingCostEl) plantingCostEl.textContent = formatSilver(summary.plantingCost);

  const profitEl = modalBody.querySelector('#farmingNetProfit');
  if (profitEl) {
    profitEl.textContent = formatSilver(summary.profit);
    profitEl.classList.remove('positive', 'negative');
    profitEl.classList.add(summary.profit >= 0 ? 'positive' : 'negative');
  }
}

/**
 * Render farming simulation results with land minigrids and crop balance sliders
 */
function renderFarmingSimulationResults(results, selectedCrops) {
  const modalBody = document.getElementById('farmingSimulationModalBody');
  if (!modalBody) return;

  const timeWindow = results?.displayTimeHours || 0;
  const timeLabel = results?.displayTimeLabel || getSingleCycleTimeLabel(selectedCrops);
  const singleCycleMode = results?.singleCycleMode !== false;
  const windowCycleSummary = getFarmingWindowCycleSummary(selectedCrops, timeWindow, singleCycleMode);
  const harvestsPer24hSummary = getFarmingHarvestsPer24hSummary(results, selectedCrops);
  const husbandryTimersSummary = getHusbandryInteractionTimersSummary(results, selectedCrops);
  const husbandrySplitSummary = getHusbandryHarvestAndButcherSummary(results, selectedCrops);
  const selectedLandSubtitle = singleCycleMode
    ? 'Single-cycle yield and layout preview for all selected lands.'
    : '24-hour total yield and layout preview for all selected lands.';
  const summary = results?.summary || {};
  const baseYields = filterVisibleYieldTotals(results?.yields || {});
  const yields = applyPlentifulBonusToYields(baseYields);
  const totalXP = results?.totalXP || 0;
  const totalPlantingCost = results?.totalPlantingCost || 0;
  const landSimulations = results?.landSimulations || [];
  const cropBreakdown = results?.cropBreakdown || [];

  // Sort lands: community small→large, then NFT small→large
  const sortedLandSimulations = sortLandSimulations(landSimulations);

  // Calculate total materials gathered (sum of all yields)
  const totalMaterials = Object.values(yields).reduce(
    (sum, data) => sum + (data.totalYield || 0),
    0
  );
  const plentifulChance = getPlentifulChancePercent();
  const plentifulMultiplier = getPlentifulExpectedMultiplier();

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

  const priceMap = getDefaultFarmingPriceMap(yields, selectedCrops);
  const profitSummary = calculateFarmingProfitSummary(yields, priceMap, totalPlantingCost);
  const profitCalculatorHtml = Object.keys(yields).length
    ? `
      <div class="farming-profit-panel">
        <div class="farming-market-card">
          <div class="farming-market-title">Expected Yields (average)</div>
          <div class="farming-yield-list">
            ${Object.entries(yields)
              .map(([material, data]) => {
                const emoji =
                  window.CropIcons?.getIcon?.(material.toLowerCase().replace(/\s+/g, '_')) || '📦';
                return `
                  <div class="farming-yield-row">
                    <span class="farming-yield-name">${emoji} ${material}</span>
                    <strong class="farming-yield-amount">${(data.totalYield || 0).toLocaleString()}</strong>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="farming-market-card">
          <div class="farming-market-title-row">
            <span class="farming-market-title">Sale Prices</span>
            <button type="button" class="farming-market-reset" id="resetFarmingPricesBtn">Reset</button>
          </div>
          <div class="farming-price-grid simple">
            ${Object.entries(yields)
              .map(([material]) => {
                const emoji =
                  window.CropIcons?.getIcon?.(material.toLowerCase().replace(/\s+/g, '_')) || '📦';
                const price = priceMap[material] || 0;
                return `
                  <div class="farming-price-row simple">
                    <span class="farming-price-material">${emoji} ${material}</span>
                    <div class="farming-price-input-inline">
                      <input id="price-${material}" class="farming-price-input" type="number" min="0" step="1" value="${price}" data-material="${material}" />
                      <span class="farming-price-unit">s</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="farming-market-card">
          <div class="farming-market-title">Profit Breakdown</div>
          <div class="profit-breakdown">
            <div class="profit-row">
              <span class="profit-label">Planting Costs</span>
              <span class="profit-value cost" id="farmingPlantingCost">${formatSilver(totalPlantingCost)}</span>
            </div>
            <div class="profit-row">
              <span class="profit-label">Est. Revenue</span>
              <span class="profit-value" id="farmingTotalValue">${formatSilver(profitSummary.totalValue)}</span>
            </div>
            <div class="profit-row profit-total">
              <span class="profit-label">Net Profit (avg)</span>
              <span class="profit-value ${profitSummary.profit >= 0 ? 'positive' : 'negative'}" id="farmingNetProfit">${formatSilver(profitSummary.profit)}</span>
            </div>
          </div>
        </div>
      </div>
    `
    : '';

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
      <div class="sim-land-card clickable" data-land-type="${land.landType || ''}" title="Open this land in Land Simulator">
        <div class="sim-land-header">
          <span class="sim-land-name">${land.name}</span>
          <span class="sim-land-util-badge ${getUtilizationClass(utilization)}">${utilization}%</span>
        </div>
        <div class="sim-land-assignment">
          ${cropEmoji} ${primaryCropCount}x ${primaryCropName}
        </div>
        ${renderFarmingLandMiniGrid(land, simulation)}
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
              <span class="label">Grow Time</span>
              <span class="time-value-static">${timeLabel}</span>
            </div>
            <div class="sim-hero-controls-mode" role="group" aria-label="Simulation window">
              <button type="button" class="sim-time-mode-btn ${singleCycleMode ? 'active' : ''}" data-sim-window="single">1 cycle</button>
              <button type="button" class="sim-time-mode-btn ${singleCycleMode ? '' : 'active'}" data-sim-window="24h">24h</button>
            </div>
                ${husbandryTimersSummary ? `<div class="sim-time-window-note">${husbandryTimersSummary}</div>` : ''}
                ${husbandrySplitSummary
              ? `<div class="sim-time-window-note">${husbandrySplitSummary}</div>`
              : `${windowCycleSummary ? `<div class="sim-time-window-note">${windowCycleSummary}</div>` : ''}`}
          </div>
        </div>
        <div class="sim-hero-row">
          <div class="sim-hero-badges">
            <span class="sim-hero-badge lands">${summary.totalLands || 0} land</span>
            <span class="sim-hero-badge tiles">${summary.totalTilesUsed || 0}/${summary.totalTilesAvailable || 0} tiles</span>
            <span class="sim-hero-badge xp" title="Total farming XP">${totalXP.toLocaleString()} XP</span>
            <span class="sim-hero-badge cost" title="Total cost to plant this setup">Planting ${Math.round(totalPlantingCost).toLocaleString()}</span>
          </div>
        </div>
        <div class="sim-hero-materials">
          ${materialPillsHtml || '<span class="no-yields">No yields calculated</span>'}
        </div>
        <div class="sim-lands-subtitle">Plentiful bonus applied: ${plentifulChance}% chance for +50% materials (expected x${plentifulMultiplier.toFixed(2)}).</div>
        ${profitCalculatorHtml}
        ${cropBalanceHtml}
      </div>

      <div class="sim-lands-section">
        <div class="sim-lands-header">
          <span class="sim-lands-title">Selected Lands</span>
        </div>
        <div class="sim-lands-subtitle">${selectedLandSubtitle}</div>
        <div class="sim-lands-grid">
          ${landCardsHtml || '<div class="no-lands">No lands configured</div>'}
        </div>
      </div>
    </div>
  `;

  const priceInputs = modalBody.querySelectorAll('.farming-price-input');
  priceInputs.forEach((input) => {
    input.addEventListener('input', () => {
      updateFarmingProfitSummary(modalBody, yields, totalPlantingCost);
    });
  });

  const resetPricesBtn = modalBody.querySelector('#resetFarmingPricesBtn');
  if (resetPricesBtn) {
    resetPricesBtn.addEventListener('click', () => {
      Object.keys(yields || {}).forEach((material) => {
        const fallbackPrice = getFarmingFallbackPrice(material, selectedCrops);
        currentCropMarketPrices[material] = fallbackPrice;
        const input = modalBody.querySelector(`.farming-price-input[data-material="${material}"]`);
        if (input) {
          input.value = fallbackPrice;
        }
      });
      updateFarmingProfitSummary(modalBody, yields, totalPlantingCost);
    });
  }

  if (priceInputs.length) {
    updateFarmingProfitSummary(modalBody, yields, totalPlantingCost);
  }

  const modeButtons = modalBody.querySelectorAll('.sim-time-mode-btn[data-sim-window]');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.simWindow;
      if (mode !== 'single' && mode !== '24h') return;
      if ((mode === 'single' && singleCycleMode) || (mode === '24h' && !singleCycleMode)) return;
      openFarmingSimulationModal(mode);
    });
  });

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

  const landCards = modalBody.querySelectorAll('.sim-land-card[data-land-type]');
  landCards.forEach((card) => {
    card.addEventListener('click', () => {
      const landType = card.dataset.landType;
      if (!landType) return;

      closeFarmingSimulationModal();
      openFarmingLandInspector(landType);
    });
  });
}

/**
 * Get utilization class for color coding
 */
function getUtilizationClass(pct) {
  if (pct >= 90) return 'util-high';
  if (pct >= 70) return 'util-medium';
  return 'util-low';
}

function calculatePlacementHarvestCount(crop, timeWindow, singleCycleMode = false) {
  if (!crop) return 0;

  if (singleCycleMode) {
    if (crop.husbandryMode === 'gathering') {
      return Math.max(Number(crop.gathersPerBuild) || 1, 1);
    }
    return 1;
  }

  if (crop.husbandryMode === 'gathering') {
    const first = Math.max(Number(crop.firstGatherHours || crop.growthHours) || 0, 0);
    const repeat = Math.max(Number(crop.repeatGatherHours || first) || 0, 0.01);
    const gathersPerBuild = Math.max(Number(crop.gathersPerBuild) || 1, 1);

    if (timeWindow <= 0 || first <= 0) return 0;

    let remaining = timeWindow;
    let totalHarvests = 0;

    while (remaining >= first) {
      totalHarvests += 1;
      remaining -= first;

      const extraPerBuild = Math.max(gathersPerBuild - 1, 0);
      if (extraPerBuild > 0) {
        const extraHarvests = Math.min(extraPerBuild, Math.floor(remaining / repeat));
        totalHarvests += extraHarvests;
        remaining -= extraHarvests * repeat;
      }
    }

    return totalHarvests;
  }

  if (crop.isButchering) {
    const cycleHours = Math.max(Number(crop.growthHours) || 0, 0.01);
    return Math.floor(timeWindow / cycleHours);
  }

  return Math.max(1, Math.floor(timeWindow / Math.max(Number(crop.growthHours) || 0.01, 0.01)));
}

/**
 * Render farming plan overview showing what to plant and when
 */
function renderFarmingPlanOverview(landSimulations, timeWindow, singleCycleMode = false) {
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
        const actualHarvestCount = calculatePlacementHarvestCount(p.crop, timeWindow, singleCycleMode);

        cropPlan[cropName] = {
          cropName,
          cropId,
          emoji: window.CropIcons?.getIcon?.(cropId) || '🌱',
          growthTime: p.crop?.growthTime || 'Unknown',
          growthHours,
          firstGatherHours: p.crop?.firstGatherHours,
          repeatGatherHours: p.crop?.repeatGatherHours,
          gathersPerBuild: p.crop?.gathersPerBuild,
          husbandryMode: p.crop?.husbandryMode || null,
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
                <span class="detail-value">${crop.harvestCount}</span>
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
              ${renderCropHarvestBadges(crop, timeWindow, singleCycleMode)}
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
function renderCropHarvestBadges(crop, timeWindow, singleCycleMode = false) {
  const growthHours = Number(crop?.growthHours || 0);

  if (crop?.husbandryMode === 'gathering') {
    const first = Number(crop?.firstGatherHours || growthHours || 0);
    const repeat = Number(crop?.repeatGatherHours || first || 0);
    const gathersPerBuild = Math.max(Number(crop?.gathersPerBuild) || 1, 1);

    if (!first || first <= 0) return '<span class="harvest-badge">-</span>';
    if (singleCycleMode) {
      return `<span class="harvest-badge">${gathersPerBuild}x per build</span>`;
    }

    const cycleBadges = [`<span class="harvest-badge">${formatHoursCompact(first)}</span>`];
    for (let i = 1; i < gathersPerBuild; i++) {
      cycleBadges.push(
        `<span class="harvest-badge">${formatHoursCompact(first + (repeat * i))}</span>`
      );
    }
    return cycleBadges.join('');
  }

  if (crop?.isButchering || !growthHours || growthHours <= 0) {
    return '<span class="harvest-badge butcher">Once</span>';
  }

  if (singleCycleMode) {
    return `<span class="harvest-badge">${formatHoursCompact(growthHours)}</span>`;
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
