/**
 * API Mock for RavenHUD Web Demo
 * Replaces window.electronAPI with browser-compatible implementations
 * Uses ported handlers from js/handlers/ directory
 */

// Cache for loaded data
const dataCache = {};

const API_NFT_SMALL_FIXED_SINGLE_LAYOUTS = {
  '1x1': {
    housePosition: { x: 1, y: 3 },
    houseRotation: 270,
    doorTiles: [[2, 6]],
    placements: [
      [0, 0], [1, 0], [2, 0], [3, 0], [5, 0], [7, 0], [9, 0],
      [5, 1], [7, 1], [9, 1],
      [0, 2], [1, 2], [2, 2], [3, 2], [5, 2], [7, 2], [9, 2],
      [5, 3], [7, 3], [9, 3],
      [0, 4], [9, 4],
      [0, 5], [9, 5],
      [0, 6], [9, 6],
      [0, 7], [9, 7],
      [9, 8],
      [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [9, 9]
    ]
  },
  '2x2': {
    housePosition: { x: 2, y: 2 },
    houseRotation: 270,
    placements: [
      [0, 0], [2, 0], [4, 0], [6, 0], [8, 0],
      [0, 3], [0, 5], [0, 8],
      [2, 8], [4, 8], [6, 8], [8, 8]
    ]
  },
  '3x3': {
    housePosition: { x: 2, y: 4 },
    houseRotation: 270,
    placements: [[0, 0], [3, 0], [6, 0]]
  },
  '4x4': {
    housePosition: { x: 0, y: 4 },
    houseRotation: 270,
    placements: [[0, 0], [4, 0]]
  }
};

const API_NFT_MEDIUM_FIXED_SINGLE_LAYOUTS = {
  '1x1': {
    housePosition: { x: 4, y: 3 },
    houseRotation: 270,
    doorTiles: [[5, 6]],
    placements: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [11, 0],
      [11, 1],
      [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [11, 2],
      [11, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [11, 4], [11, 5],
      [0, 6], [2, 6], [4, 6], [11, 6],
      [0, 7], [2, 7], [4, 7], [11, 7],
      [0, 8], [2, 8], [4, 8], [11, 8],
      [0, 9], [2, 9], [4, 9], [11, 9], [11, 10],
      [0, 11], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [11, 11]
    ]
  },
  '2x2': {
    housePosition: { x: 2, y: 3 },
    houseRotation: 180,
    placements: [
      [0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10],
      [10, 0], [10, 2], [10, 4], [10, 6], [10, 8], [10, 10],
      [3, 10], [5, 10], [7, 10],
      [3, 1], [5, 1], [7, 1]
    ]
  },
  '3x3': {
    housePosition: { x: 2, y: 4 },
    houseRotation: 270,
    placements: [[0, 0], [0, 3], [0, 9], [9, 0], [9, 3], [9, 6], [9, 9], [4, 0]]
  },
  '4x4': {
    housePosition: { x: 5, y: 4 },
    houseRotation: 270,
    placements: [[0, 0], [4, 0], [8, 0], [0, 5]]
  }
};

const API_NFT_LARGE_FIXED_SINGLE_LAYOUTS = {
  '1x1': {
    housePosition: { x: 5, y: 4 },
    houseRotation: 270,
    placements: [
      [0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [14, 0],
      [0, 1], [2, 1], [4, 1], [6, 1], [8, 1], [10, 1], [12, 1], [14, 1],
      [0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [10, 3], [12, 3], [14, 3],
      [0, 4], [2, 4], [4, 4], [12, 4], [14, 4],
      [0, 5], [2, 5], [4, 5], [12, 5], [14, 5],
      [0, 6], [2, 6], [4, 6], [12, 6], [14, 6],
      [0, 7], [2, 7], [4, 7], [12, 7], [14, 7],
      [0, 8], [2, 8], [4, 8], [12, 8], [14, 8],
      [14, 9],
      [0, 10], [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [14, 10],
      [0, 12], [1, 12], [2, 12], [3, 12], [4, 12], [5, 12], [13, 12], [14, 12],
      [0, 14], [1, 14], [2, 14], [3, 14], [4, 14], [5, 14], [6, 14], [7, 14],
      [8, 14], [9, 14], [10, 14], [11, 14], [12, 14], [13, 14], [14, 14]
    ]
  },
  '2x2': {
    housePosition: { x: 2, y: 3 },
    houseRotation: 270,
    placements: [
      [0, 0], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0],
      [0, 3], [9, 3], [11, 3], [13, 3],
      [0, 5], [9, 6], [11, 6], [13, 6],
      [0, 7], [0, 9], [11, 9], [13, 9],
      [0, 11], [0, 13], [3, 13], [5, 13], [7, 13], [9, 13], [11, 13], [13, 13]
    ]
  },
  '3x3': {
    housePosition: { x: 3, y: 5 },
    houseRotation: 270,
    placements: [[0, 0], [0, 3], [0, 6], [0, 9], [0, 12], [4, 0], [8, 0], [12, 0], [12, 3], [12, 6], [12, 9], [12, 12]]
  },
  '4x4': {
    housePosition: { x: 6, y: 5 },
    houseRotation: 90,
    placements: [[0, 0], [4, 0], [8, 0], [0, 5], [0, 10], [4, 10]]
  }
};

const NFT_SINGLE_CROP_PRESETS = {
  NFT_SMALL: API_NFT_SMALL_FIXED_SINGLE_LAYOUTS,
  NFT_MEDIUM: API_NFT_MEDIUM_FIXED_SINGLE_LAYOUTS,
  NFT_LARGE: API_NFT_LARGE_FIXED_SINGLE_LAYOUTS
};

// Fetch and cache JSON data
async function fetchData(filename) {
  if (dataCache[filename]) return dataCache[filename];

  const tryPaths = [`data/${filename}`, `../data/${filename}`];

  for (const path of tryPaths) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      dataCache[filename] = data;
      return data;
    } catch (err) {
      console.warn(`[API Mock] Failed to load ${path}:`, err.message);
    }
  }

  return null;
}

// Mock user profile (demo defaults)
let mockProfile = {
  simulationTimeWindow: 48,
  defaultLaborCost: 5,
  defaultSellMultiplier: 1.0,
  includeLabor: true
};

// Mock owned lands (with proper structure for demo)
let mockOwnedLands = {
  ownedLands: {
    SMALL_COMMUNITY: 0,
    MEDIUM_COMMUNITY: 0,
    LARGE_COMMUNITY: 0,
    NFT_SMALL: 0,
    NFT_MEDIUM: 0,
    NFT_LARGE: 0,
    NFT_STRONGHOLD: 0,
    NFT_FORT: 0
  },
  totalTiles: { total: 0 }
};

// Calculate total tiles from owned lands
function calculateTotalTiles(ownedLands) {
  const tiles = {
    SMALL_COMMUNITY: 56,
    MEDIUM_COMMUNITY: 91,
    LARGE_COMMUNITY: 137,
    NFT_SMALL: 100,
    NFT_MEDIUM: 144,
    NFT_LARGE: 225,
    NFT_STRONGHOLD: 484,
    NFT_FORT: 900
  };
  let total = 0;
  for (const [type, count] of Object.entries(ownedLands)) {
    total += (count || 0) * (tiles[type] || 0);
  }
  return { total };
}

// Parse growth time string (e.g., "6h", "2H", "15H") to hours
function parseGrowthTimeDemo(timeStr) {
  if (!timeStr) return 6;

  const normalized = String(timeStr).trim();
  let hours = 0;

  const dayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[dD]/);
  if (dayMatch) hours += parseFloat(dayMatch[1]) * 24;

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[hH]/);
  if (hourMatch) hours += parseFloat(hourMatch[1]);

  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[mM]/);
  if (minMatch) hours += parseFloat(minMatch[1]) / 60;

  return hours > 0 ? hours : 6;
}

const HUSBANDRY_TIMING_OVERRIDES = {
  small_hare_pen: {
    firstGatherMinutes: 180,
    repeatGatherMinutes: 90,
    gathersPerBuild: 3,
    butcheringMinutes: 360
  },
  medium_hare_pen: {
    firstGatherMinutes: 180,
    repeatGatherMinutes: 90,
    gathersPerBuild: 3,
    butcheringMinutes: 360
  },
  small_chicken_pen: {
    firstGatherMinutes: 180,
    repeatGatherMinutes: 90,
    gathersPerBuild: 3,
    butcheringMinutes: 360
  },
  medium_chicken_pen: {
    firstGatherMinutes: 180,
    repeatGatherMinutes: 90,
    gathersPerBuild: 3,
    butcheringMinutes: 360
  },
  small_pig_pen: {
    forceButchering: true,
    butcheringMinutes: 480
  },
  medium_pig_pen: {
    forceButchering: true,
    butcheringMinutes: 480
  },
  small_turkey_pen: {
    forceButchering: true,
    butcheringMinutes: 720
  },
  medium_turkey_pen: {
    forceButchering: true,
    butcheringMinutes: 720
  }
  ,
  small_sheep_pen: {
    firstGatherMinutes: 360,
    repeatGatherMinutes: 180,
    gathersPerBuild: 3,
    butcheringMinutes: 720
  },
  medium_sheep_pen: {
    firstGatherMinutes: 360,
    repeatGatherMinutes: 180,
    gathersPerBuild: 3,
    butcheringMinutes: 720
  }
  ,
  small_goat_pen: {
    firstGatherMinutes: 240,
    repeatGatherMinutes: 120,
    gathersPerBuild: 3,
    butcheringMinutes: 480
  },
  medium_goat_pen: {
    firstGatherMinutes: 240,
    repeatGatherMinutes: 120,
    gathersPerBuild: 3,
    butcheringMinutes: 480
  }
  ,
  small_cow_pen: {
    firstGatherMinutes: 600,
    repeatGatherMinutes: 300,
    gathersPerBuild: 3,
    butcheringMinutes: 1200
  },
  medium_cow_pen: {
    firstGatherMinutes: 600,
    repeatGatherMinutes: 300,
    gathersPerBuild: 3,
    butcheringMinutes: 1200
  }
};

function getHusbandryTimingProfile(crop, fallbackMinutes, gatheringMinutes, butcheringMinutes) {
  const override = HUSBANDRY_TIMING_OVERRIDES[crop.id] || {};
  const firstGatherMinutes =
    override.firstGatherMinutes ||
    Math.max(crop.growthTimeMinutes || 0, gatheringMinutes || 0, fallbackMinutes || 0, 60);
  const repeatGatherMinutes =
    override.repeatGatherMinutes || gatheringMinutes || firstGatherMinutes;
  const gathersPerBuild = Math.max(
    Number(override.gathersPerBuild || crop.gatheringMultiplier || 1),
    1
  );
  const effectiveButcheringMinutes =
    override.butcheringMinutes || butcheringMinutes || fallbackMinutes || firstGatherMinutes;

  return {
    firstGatherMinutes,
    repeatGatherMinutes,
    gathersPerBuild,
    butcheringMinutes: effectiveButcheringMinutes
  };
}

function getCropTimingAndXP(crop) {
  const gatheringMinutes = crop.gathering?.timeMinutes;
  const butcheringMinutes = crop.butchering?.timeMinutes;
  const fallbackMinutes = crop.growthTimeMinutes || Math.round(parseGrowthTimeDemo(crop.growthTime) * 60);
  const husbandryOverride = HUSBANDRY_TIMING_OVERRIDES[crop.id] || {};
  const forceButchering = Boolean(husbandryOverride.forceButchering);

  const hasHusbandryGathering =
    crop.category === 'husbandry' &&
    !forceButchering &&
    Boolean(crop.gathering) &&
    Number(crop.gathering?.timeMinutes || 0) > 0;

  const husbandryProfile = crop.category === 'husbandry'
    ? getHusbandryTimingProfile(crop, fallbackMinutes, gatheringMinutes, butcheringMinutes)
    : null;

  // If gathering data exists for husbandry, simulate the repeatable gathering lifecycle.
  const isButchering =
    crop.category === 'husbandry' &&
    (forceButchering || (!hasHusbandryGathering && Boolean(crop.butchering)));
  const timeMinutes = isButchering
    ? (husbandryProfile?.butcheringMinutes || butcheringMinutes || gatheringMinutes || fallbackMinutes || 360)
    : (husbandryProfile?.repeatGatherMinutes || gatheringMinutes || fallbackMinutes || butcheringMinutes || 360);

  const gatheringXP =
    crop.gathering?.professionXP ||
    crop.gathering?.experience ||
    crop.professionXP ||
    crop.experience ||
    crop.legacyXP ||
    0;
  const butcheringXP =
    crop.butchering?.professionXP ||
    crop.butchering?.experience ||
    crop.professionXP ||
    crop.experience ||
    crop.legacyXP ||
    0;

  return {
    isButchering,
    growthHours: Math.max((timeMinutes || 360) / 60, 0.01),
    experience: hasHusbandryGathering ? Math.max(gatheringXP, 0) : Math.max(gatheringXP, butcheringXP, 0),
    husbandryMode: hasHusbandryGathering ? 'gathering' : (isButchering ? 'butchering' : null),
    firstGatherHours: husbandryProfile ? Math.max(husbandryProfile.firstGatherMinutes / 60, 0.01) : null,
    repeatGatherHours: husbandryProfile ? Math.max(husbandryProfile.repeatGatherMinutes / 60, 0.01) : null,
    gathersPerBuild: husbandryProfile ? Math.max(Number(husbandryProfile.gathersPerBuild) || 1, 1) : 1
  };
}

function calculateHarvestsInWindow(timing, timeWindowHours, singleCycleMode) {
  if (!timing) return 0;

  if (singleCycleMode) {
    if (timing.husbandryMode === 'gathering') {
      return Math.max(Number(timing.gathersPerBuild) || 1, 1);
    }
    return 1;
  }

  if (timing.husbandryMode === 'gathering') {
    const first = Math.max(Number(timing.firstGatherHours) || Number(timing.growthHours) || 0, 0);
    const repeat = Math.max(Number(timing.repeatGatherHours) || first || 0, 0.01);
    const gathersPerBuild = Math.max(Number(timing.gathersPerBuild) || 1, 1);

    if (timeWindowHours <= 0 || first <= 0) return 0;

    let remaining = timeWindowHours;
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

  if (timing.isButchering) {
    const cycle = Math.max(Number(timing.growthHours) || 0, 0.01);
    return timeWindowHours > 0 ? Math.floor(timeWindowHours / cycle) : 0;
  }

  return Math.max(1, Math.floor(timeWindowHours / Math.max(timing.growthHours, 0.01)));
}

function getCropSizeKey(crop) {
  return `${crop.width || 1}x${crop.height || 1}`;
}

function getPlacementSizeKey(placement) {
  if (placement?.size) return placement.size;

  const width = placement?.w || placement?.width || 1;
  const height = placement?.h || placement?.height || width;
  return `${width}x${height}`;
}

function buildPlacementCropData(crop, timing) {
  return {
    id: crop.id,
    name: crop.name,
    icon: crop.icon,
    width: crop.width || 1,
    height: crop.height || 1,
    size: crop.size || `${crop.width || 1}x${crop.height || 1}`,
    growthTime: crop.growthTime,
    growthHours: timing.growthHours,
    isButchering: timing.isButchering,
    husbandryMode: timing.husbandryMode,
    firstGatherHours: timing.firstGatherHours,
    repeatGatherHours: timing.repeatGatherHours,
    gathersPerBuild: timing.gathersPerBuild,
    experience: timing.experience
  };
}

function buildSimulationPlacementsFromLayout(layout, crop, timing) {
  const cropData = buildPlacementCropData(crop, timing);
  const sizeKey = getCropSizeKey(crop);

  return (layout?.placements || [])
    .filter((placement) => getPlacementSizeKey(placement) === sizeKey)
    .map((placement) => ({
      crop: cropData,
      x: placement.x,
      y: placement.y
    }));
}

function chooseBestLayoutForCrop(layouts, crop, options = {}) {
  const sizeKey = getCropSizeKey(crop);
  const { housePosition = null, houseRotation = null } = options;

  return [...(Array.isArray(layouts) ? layouts : [])]
    .filter((layout) => {
      if (!housePosition || !layout.housePosition) return true;

      const samePosition =
        layout.housePosition.x === housePosition.x && layout.housePosition.y === housePosition.y;
      const sameRotation = (layout.houseRotation || 0) === (houseRotation || 0);
      return samePosition && sameRotation;
    })
    .map((layout) => {
      const counts = layout.counts || {};
      const targetCount = counts[sizeKey] || 0;
      const otherCount = Object.entries(counts).reduce(
        (sum, [key, value]) => sum + (key === sizeKey ? 0 : value || 0),
        0
      );

      return { layout, targetCount, otherCount };
    })
    .filter((entry) => entry.targetCount > 0)
    .sort((a, b) => {
      if (b.targetCount !== a.targetCount) return b.targetCount - a.targetCount;
      if (a.otherCount !== b.otherCount) return a.otherCount - b.otherCount;
      return (b.layout.totalTiles || 0) - (a.layout.totalTiles || 0);
    })[0]?.layout || null;
}

async function calculateLandCropSimulation(land, crop) {
  const timing = getCropTimingAndXP(crop);
  const cropData = buildPlacementCropData(crop, timing);
  const tileSize = (crop.width || 1) * (crop.height || 1);
  const validTiles = Array.isArray(land.validTiles) ? land.validTiles : [];
  const sizeKey = getCropSizeKey(crop);
  const layoutUtils = window.LandLayoutUtils || {};
  const nftPreset = land?.landType ? NFT_SINGLE_CROP_PRESETS[land.landType]?.[sizeKey] : null;
  const presetPlacementCoords = nftPreset?.placements || null;

  let selectedLayout = null;
  let housePosition = land.housePosition || null;
  let houseRotation = land.houseRotation || 0;
  let availableTileCount = validTiles.length || land.tiles || 0;
  let previewHouseTiles = null;
  let previewDoorTiles = null;

  if (land.hasHouse) {
    let nftLayouts = null;
    try {
      nftLayouts = await window.electronAPI.getNFTLayouts(land.landType);
    } catch (err) {
      console.warn(`[API Mock] Failed to load NFT layouts for ${land.landType}:`, err.message);
    }

    const bestKey = {
      '1x1': 'best1x1',
      '2x2': 'best2x2',
      '3x3': 'best3x3',
      '4x4': 'best4x4'
    }[sizeKey];
    const bestPosition = bestKey ? nftLayouts?.bestPositions?.[bestKey] : null;

    if (nftPreset?.housePosition) {
      housePosition = { ...nftPreset.housePosition };
      houseRotation = nftPreset.houseRotation || 0;
      if (layoutUtils.getHouseTilesAtPosition) {
        const presetHouseTiles = layoutUtils.getHouseTilesAtPosition(land, housePosition, houseRotation);
        previewDoorTiles = (nftPreset.doorTiles || []).map(([x, y]) => ({ x, y }));
        if (!previewDoorTiles.length) {
          previewDoorTiles = presetHouseTiles.door || [];
        }
        previewHouseTiles = [...(presetHouseTiles.house || []), ...(presetHouseTiles.clearance || [])];
      }
    } else if (bestPosition) {
      housePosition = { x: bestPosition.x, y: bestPosition.y };
      houseRotation = bestPosition.rotation || 0;
      previewHouseTiles = Array.isArray(bestPosition.houseTiles) ? bestPosition.houseTiles : null;
    } else if (!housePosition && layoutUtils.findOptimalHousePosition) {
      const fallback = layoutUtils.findOptimalHousePosition(land, validTiles, crop.width || 1);
      housePosition = fallback.position;
      houseRotation = fallback.rotation || 0;
    }

    let blockedTiles = new Set();
    if (housePosition && layoutUtils.calculateBlockedTiles) {
      blockedTiles = layoutUtils.calculateBlockedTiles(land, housePosition, houseRotation);
      availableTileCount = validTiles.reduce(
        (sum, tile) => sum + (blockedTiles.has(`${tile.x},${tile.y}`) ? 0 : 1),
        0
      );
    }

    if (nftLayouts?.layouts?.length) {
      selectedLayout =
        chooseBestLayoutForCrop(nftLayouts.layouts, crop, { housePosition, houseRotation }) ||
        chooseBestLayoutForCrop(nftLayouts.layouts, crop);
    }

    if (selectedLayout?.housePosition) {
      housePosition = selectedLayout.housePosition;
    }
    if (selectedLayout?.houseRotation !== undefined) {
      houseRotation = selectedLayout.houseRotation || 0;
    }
    if (selectedLayout?.availableTiles) {
      availableTileCount = selectedLayout.availableTiles;
    }

    if (bestPosition) {
      const matchesBestPosition =
        housePosition?.x === bestPosition.x &&
        housePosition?.y === bestPosition.y &&
        (houseRotation || 0) === (bestPosition.rotation || 0);
      previewHouseTiles = matchesBestPosition && Array.isArray(bestPosition.houseTiles)
        ? bestPosition.houseTiles
        : null;
    }

    if (!selectedLayout && layoutUtils.calculateOptimalPlacement) {
      const remainingTileSet = new Set(
        validTiles
          .filter((tile) => !blockedTiles.has(`${tile.x},${tile.y}`))
          .map((tile) => `${tile.x},${tile.y}`)
      );
      const fallbackLayout = layoutUtils.calculateOptimalPlacement(
        crop.width || 1,
        crop.height || 1,
        remainingTileSet
      );
      const placements = fallbackLayout.placements.map((placement) => ({
        crop: cropData,
        x: placement.x,
        y: placement.y
      }));
      const totalTilesUsed = placements.length * tileSize;

      return {
        crop,
        timing,
        land: { ...land, housePosition, houseRotation },
        simulation: {
          placements,
          totalTilesUsed,
          totalTilesAvailable: availableTileCount,
          utilization:
            availableTileCount > 0 ? Math.round((totalTilesUsed / availableTileCount) * 100) : 0
        }
      };
    }
  } else {
    let communityLayouts = null;
    try {
      communityLayouts = await window.electronAPI.getCommunityLayouts(land.landType);
    } catch (err) {
      console.warn(
        `[API Mock] Failed to load community layouts for ${land.landType}:`,
        err.message
      );
    }

    if (communityLayouts?.layouts?.length) {
      selectedLayout = chooseBestLayoutForCrop(communityLayouts.layouts, crop);
    }

    if (!selectedLayout && layoutUtils.calculateOptimalPlacement) {
      const tileSet = new Set(validTiles.map((tile) => `${tile.x},${tile.y}`));
      const fallbackLayout = layoutUtils.calculateOptimalPlacement(
        crop.width || 1,
        crop.height || 1,
        tileSet
      );
      const placements = fallbackLayout.placements.map((placement) => ({
        crop: cropData,
        x: placement.x,
        y: placement.y
      }));
      const totalTilesUsed = placements.length * tileSize;

      return {
        crop,
        timing,
        land,
        simulation: {
          placements,
          totalTilesUsed,
          totalTilesAvailable: availableTileCount,
          utilization:
            availableTileCount > 0 ? Math.round((totalTilesUsed / availableTileCount) * 100) : 0
        }
      };
    }
  }

  let placements = [];

  if (presetPlacementCoords?.length) {
    placements = presetPlacementCoords.map(([x, y]) => ({ crop: cropData, x, y }));
  }

  if (!placements.length && layoutUtils.calculateOptimalPlacement) {
    const blockedTiles = land.hasHouse && housePosition && layoutUtils.calculateBlockedTiles
      ? layoutUtils.calculateBlockedTiles(land, housePosition, houseRotation)
      : new Set();

    const remainingTileSet = new Set(
      validTiles
        .filter((tile) => !blockedTiles.has(`${tile.x},${tile.y}`))
        .map((tile) => `${tile.x},${tile.y}`)
    );

    const computedLayout = layoutUtils.calculateOptimalPlacement(
      crop.width || 1,
      crop.height || 1,
      remainingTileSet
    );

    placements = (computedLayout?.placements || []).map((placement) => ({
      crop: cropData,
      x: placement.x,
      y: placement.y
    }));
  }

  if (!placements.length) {
    placements = buildSimulationPlacementsFromLayout(selectedLayout, crop, timing);
  }

  const totalTilesUsed = placements.length * tileSize;

  return {
    crop,
    timing,
    land: {
      ...land,
      housePosition,
      houseRotation,
      houseTilesPreview: previewHouseTiles,
      doorTilesPreview: previewDoorTiles
    },
    simulation: {
      placements,
      totalTilesUsed,
      totalTilesAvailable: availableTileCount,
      utilization:
        availableTileCount > 0 ? Math.round((totalTilesUsed / availableTileCount) * 100) : 0
    }
  };
}

// Create the electronAPI mock
window.electronAPI = {
  // === Land Data (uses LandHandlers) ===
  getLandTypes: async () => {
    // Use LandHandlers if available, otherwise fallback
    if (window.LandHandlers) {
      return await window.LandHandlers.getLandTypes();
    }
    console.warn('[API Mock] LandHandlers not loaded, using fallback');
    return [];
  },

  getLandData: async () => {
    if (window.LandHandlers) {
      return await window.LandHandlers.getLandData();
    }
    // Fallback: load from crops.json and transform
    const crops = await fetchData('crops.json');
    if (!crops) return {};

    const result = {
      farming: [],
      herbalism: [],
      husbandry: [],
      Woodcutting: [],
      breeding: []
    };

    (crops.items || []).forEach((item) => {
      const silverCost = item.yields?.[0]?.unitCost || 100;
      const landItem = {
        id: item.id,
        name: item.name,
        size: item.size || '1x1',
        width: item.width || 1,
        height: item.height || 1,
        silverCost,
        icon: item.icon || '🌱',
        level: item.level,
        category: item.category,
        growthTime: item.growthTime,
        yields: (item.yields || []).map(y => ({
          resource: y.resource,
          min: y.min,
          max: y.max,
          avg: y.avg
        }))
      };
      if (result[item.category]) {
        result[item.category].push(landItem);
      }
    });

    return result;
  },

  getCropData: async () => {
    const data = await fetchData('crops.json');
    return data || { items: [] };
  },

  getTradepackData: async () => {
    const data = await fetchData('tradepacks.json');
    return data || { tradepacks: [] };
  },

  getMaterialsData: async () => {
    const data = await fetchData('materials.json');
    return data || { items: [] };
  },

  // === Layout Data ===
  getCommunityLayouts: async (landType) => {
    if (window.LandHandlers) {
      return await window.LandHandlers.getCommunityLayouts(landType);
    }
    const data = await fetchData('community-layouts.json');
    if (!data) return { error: 'Not loaded' };
    return landType ? (data[landType] || { error: 'Not found' }) : data;
  },

  getNFTLayouts: async (landType) => {
    if (window.LandHandlers) {
      return await window.LandHandlers.getNFTLayouts(landType);
    }
    const data = await fetchData('nft-layouts.json');
    if (!data) return { error: 'Not loaded' };
    return landType ? (data[landType] || { error: 'Not found' }) : data;
  },

  // === Profile & Settings ===
  getProfile: async () => mockProfile,

  saveProfile: async (profile) => {
    mockProfile = { ...mockProfile, ...profile };
    return { success: true };
  },

  getSettings: async () => ({
    theme: 'dark',
    animationsEnabled: true,
    developerMode: false
  }),

  // === Owned Lands ===
  getOwnedLands: async () => mockOwnedLands,

  updateOwnedLands: async (lands) => {
    // Update with proper structure
    mockOwnedLands = {
      ownedLands: lands,
      totalTiles: calculateTotalTiles(lands)
    };
    // Dispatch custom event so other tabs can refresh their lands summary
    window.dispatchEvent(new CustomEvent('ownedLandsUpdated', { detail: mockOwnedLands }));
    return { success: true };
  },

  // === Layout Management ===
  getLandLayouts: async () => {
    if (window.LandHandlers) {
      return window.LandHandlers.getLandLayouts();
    }
    return [];
  },

  saveLandLayout: async (layout) => {
    if (window.LandHandlers) {
      return window.LandHandlers.saveLandLayout(layout);
    }
    return { success: false, error: 'Handler not loaded' };
  },

  deleteLandLayout: async (layoutId) => {
    if (window.LandHandlers) {
      return window.LandHandlers.deleteLandLayout(layoutId);
    }
    return { success: false, error: 'Handler not loaded' };
  },

  // === Validation ===
  validateLandPlacement: async (params) => {
    if (window.LandHandlers) {
      return await window.LandHandlers.validatePlacement(params);
    }
    // Fallback basic validation
    return { valid: true };
  },

  // === Material Sources ===
  getMaterialSources: async (materialName) => {
    // Load creatures data and find creatures that drop this material
    const creatures = await fetchData('creatures.json');
    if (!creatures || !creatures.items) return [];

    const searchName = materialName.toLowerCase();
    return creatures.items.filter(creature => {
      const drops = creature.drops || [];
      return drops.some(drop => drop.toLowerCase().includes(searchName));
    }).map(creature => ({
      name: creature.name,
      level: creature.level,
      levelMin: creature.levelMin,
      levelMax: creature.levelMax
    }));
  },

  // === Tradepack Calculations ===
  calculateTradepackProfit: async ({ tradepack, landType, laborCost, sellMultiplier, demandMultiplier }) => {
    const crops = await fetchData('crops.json');
    const tp = tradepack || {};
    const baseValue = tp.total_cost || tp.basePrice || 0;
    const labor = laborCost ?? mockProfile.defaultLaborCost ?? 5;
    const multiplier = sellMultiplier ?? demandMultiplier ?? mockProfile.defaultSellMultiplier ?? 1.0;

    // Calculate material costs from crop yields
    let totalMaterialCost = 0;
    const materialBreakdown = [];

    if (tp.materials && crops?.items) {
      for (const mat of tp.materials) {
        const materialName = mat.item?.toLowerCase() || '';
        const quantity = mat.quantity || 0;

        // Find crop that produces this material
        const crop = crops.items.find(c =>
          c.yields?.some(y => y.resource?.toLowerCase() === materialName)
        );

        if (crop) {
          const yieldData = crop.yields.find(y => y.resource?.toLowerCase() === materialName);
          const unitCost = yieldData?.unitCost || 0;
          const cost = unitCost * quantity;
          totalMaterialCost += cost;
          materialBreakdown.push({
            item: mat.item,
            quantity,
            unitCost,
            totalCost: cost,
            source: crop.name
          });
        } else {
          materialBreakdown.push({
            item: mat.item,
            quantity,
            unitCost: 0,
            totalCost: 0,
            source: 'Unknown'
          });
        }
      }
    }

    const adjustedValue = Math.floor(baseValue * multiplier);
    const profit = adjustedValue - totalMaterialCost;

    return {
      tradepack: { id: tp.id, name: tp.name },
      materials: materialBreakdown,
      totalMaterialCost,
      baseValue,
      demandMultiplier: multiplier,
      adjustedValue,
      profit,
      profitMargin: baseValue > 0 ? ((profit / baseValue) * 100).toFixed(1) : 0
    };
  },

  compareAllLandTypes: async ({ tradepack, laborCost, sellMultiplier }) => {
    const landTypes = await window.electronAPI.getLandTypes();
    const results = [];

    for (const land of landTypes) {
      const farmableTiles = land.tiles?.length || 0;
      const profitCalc = await window.electronAPI.calculateTradepackProfit({
        tradepack,
        landType: land.id,
        laborCost,
        sellMultiplier
      });

      results.push({
        landType: land.id,
        landName: land.name,
        profit: profitCalc.profit,
        profitPerTile: farmableTiles > 0 ? Math.round(profitCalc.profit / farmableTiles) : 0,
        farmableTiles,
        hasHouse: land.hasHouse || false
      });
    }

    return results.sort((a, b) => b.profit - a.profit);
  },

  optimizeCropBalance: async ({ crops, constraints }) => {
    return {
      success: true,
      allocations: [],
      totalProfit: 0,
      message: 'Demo mode - optimization not fully available'
    };
  },

  // === Farming Simulation ===
  simulateFarmingSelection: async ({ selectedCrops = [], ownedLands = {}, timeWindowHours = 48, cropWeights = {}, singleCycleMode = false }) => {
    if (!selectedCrops.length) {
      return {
        summary: { totalLands: 0, totalTilesUsed: 0, totalTilesAvailable: 0 },
        yields: {},
        totalXP: 0,
        landSimulations: [],
        cropBreakdown: []
      };
    }

    const cropsData = await fetchData('crops.json');
    if (!cropsData?.items) {
      return {
        summary: { totalLands: 0, totalTilesUsed: 0, totalTilesAvailable: 0 },
        yields: {},
        totalXP: 0,
        landSimulations: [],
        cropBreakdown: []
      };
    }

    const landTypes = await window.electronAPI.getLandTypes();
    const selectedCropObjects = cropsData.items
      .filter((crop) => selectedCrops.includes(crop.id))
      .map((crop) => ({
        ...crop,
        width: crop.width || 1,
        height: crop.height || 1
      }));

    if (selectedCropObjects.length === 0) {
      return {
        summary: { totalLands: 0, totalTilesUsed: 0, totalTilesAvailable: 0 },
        yields: {},
        totalXP: 0,
        landSimulations: [],
        cropBreakdown: []
      };
    }

    const landsList = [];
    Object.entries(ownedLands).forEach(([landType, count]) => {
      if (!count) return;

      const landInfo = landTypes.find((land) => land.id === landType);
      if (!landInfo) return;

      for (let i = 0; i < count; i++) {
        landsList.push({
          id: `${landType}_${i + 1}`,
          landType,
          name: `${landInfo.name} #${i + 1}`,
          tiles: landInfo.tiles?.length || landInfo.tileCount || 0,
          width: landInfo.width || 8,
          height: landInfo.height || 8,
          hasHouse: landInfo.hasHouse || false,
          farmMultiplier: Math.max(Number(landInfo.farmMultiplier || 1), 1),
          validTiles: Array.isArray(landInfo.tiles) ? landInfo.tiles : [],
          houseTiles: landInfo.houseTiles || [],
          houseDoorTiles: landInfo.houseDoorTiles || [],
          doorClearanceTiles: landInfo.doorClearanceTiles || []
        });
      }
    });

    if (landsList.length === 0) {
      return {
        summary: { totalLands: 0, totalTilesUsed: 0, totalTilesAvailable: 0 },
        yields: {},
        totalXP: 0,
        landSimulations: [],
        cropBreakdown: []
      };
    }

    const yields = {};
    let totalXP = 0;
    let totalPlantingCost = 0;
    const landSimulations = [];

    const cropAllocations = {};
    selectedCropObjects.forEach((crop) => {
      cropAllocations[crop.id] = { crop, lands: [], totalSlots: 0 };
    });

    const totalWeight = selectedCropObjects.reduce(
      (sum, crop) => sum + Math.max(Number(cropWeights[crop.id] ?? 100), 1),
      0
    ) || selectedCropObjects.length;
    const normalizedWeights = Object.fromEntries(
      selectedCropObjects.map((crop) => [
        crop.id,
        Math.max(Number(cropWeights[crop.id] ?? 100), 1) / totalWeight
      ])
    );
    const targetLandsByCrop = Object.fromEntries(
      selectedCropObjects.map((crop) => [crop.id, normalizedWeights[crop.id] * landsList.length])
    );
    const currentLandsByCrop = {};

    const sortedLands = [...landsList].sort(
      (a, b) => (b.validTiles?.length || b.tiles || 0) - (a.validTiles?.length || a.tiles || 0)
    );

    for (const land of sortedLands) {
      const options = await Promise.all(
        selectedCropObjects.map((crop) => calculateLandCropSimulation(land, crop))
      );

      const bestOption = options.sort((a, b) => {
        const remainingNeedA = Math.max(
          (targetLandsByCrop[a.crop.id] || 0) - (currentLandsByCrop[a.crop.id] || 0),
          0
        );
        const remainingNeedB = Math.max(
          (targetLandsByCrop[b.crop.id] || 0) - (currentLandsByCrop[b.crop.id] || 0),
          0
        );
        const scoreA =
          (remainingNeedA + (normalizedWeights[a.crop.id] || 0)) * 1000 +
          (a.simulation?.totalTilesUsed || 0);
        const scoreB =
          (remainingNeedB + (normalizedWeights[b.crop.id] || 0)) * 1000 +
          (b.simulation?.totalTilesUsed || 0);
        return scoreB - scoreA;
      })[0];

      const chosenCrop = bestOption.crop;
      const placementsCount = bestOption.simulation?.placements?.length || 0;
      const landMultiplier = Math.max(Number(bestOption.land?.farmMultiplier || 1), 1);
      const plantingCostPerPlacement = Math.max(Number(chosenCrop.plantingCost || 0), 0);
      const harvestsInWindow = calculateHarvestsInWindow(
        bestOption.timing,
        timeWindowHours,
        singleCycleMode
      );

      cropAllocations[chosenCrop.id].lands.push(bestOption.land);
      cropAllocations[chosenCrop.id].totalSlots += placementsCount;
      currentLandsByCrop[chosenCrop.id] = (currentLandsByCrop[chosenCrop.id] || 0) + 1;


      // Special planting cost logic for trees in 24h mode
      const treeIds = ['apple_tree', 'banana_tree', 'cotton_tree', 'orange_tree'];
      let landPlantingCost;
      if (!singleCycleMode && treeIds.includes(chosenCrop.id)) {
        // Only charge planting cost once per 3 harvests (rounded up)
        const plantingsNeeded = Math.ceil(harvestsInWindow / 3);
        landPlantingCost = Math.round(
          placementsCount * plantingCostPerPlacement * plantingsNeeded * landMultiplier
        );
      } else {
        landPlantingCost = Math.round(
          placementsCount * plantingCostPerPlacement * harvestsInWindow * landMultiplier
        );
      }
      totalPlantingCost += landPlantingCost;

      landSimulations.push({
        land: bestOption.land,
        simulation: bestOption.simulation,
        farmMultiplier: landMultiplier,
        plantingCost: landPlantingCost
      });

      (chosenCrop.yields || []).forEach((yieldInfo) => {
        if (!yields[yieldInfo.resource]) {
          yields[yieldInfo.resource] = { totalYield: 0, harvestCount: 0 };
        }

        const averageYield = yieldInfo.avg || ((yieldInfo.min || 0) + (yieldInfo.max || 0)) / 2;
        yields[yieldInfo.resource].totalYield += Math.round(
          placementsCount * averageYield * harvestsInWindow * landMultiplier
        );
        yields[yieldInfo.resource].harvestCount += harvestsInWindow;
      });

      totalXP += placementsCount * (bestOption.timing.experience || 0) * harvestsInWindow;
    }

    const cropBreakdown = selectedCropObjects
      .map((crop) => {
        const allocation = cropAllocations[crop.id];
        const landsUsed = allocation.lands.length;

        if (!landsUsed) return null;

        return {
          cropId: crop.id,
          cropName: crop.name,
          landsUsed,
          slotsTotal: allocation.totalSlots
        };
      })
      .filter(Boolean);

    const totalTilesAvailable = landSimulations.reduce(
      (sum, landSim) => sum + (landSim.simulation?.totalTilesAvailable || 0),
      0
    );
    const totalTilesUsed = landSimulations.reduce(
      (sum, landSim) => sum + (landSim.simulation?.totalTilesUsed || 0),
      0
    );

    return {
      summary: {
        totalLands: landsList.length,
        totalTilesUsed,
        totalTilesAvailable
      },
      yields,
      totalXP: Math.round(totalXP),
      totalPlantingCost: Math.round(totalPlantingCost),
      landSimulations,
      cropBreakdown,
      singleCycleMode
    };
  },

  simulateTradepackOwnedLands: async (params) => {
    return {
      success: true,
      results: [],
      totalProfit: 0,
      message: 'Demo mode - configure owned lands in the full app'
    };
  },

  // === Session Management (disabled in demo) ===
  startFarmingSession: async () => ({
    success: false,
    error: 'Sessions not available in web demo'
  }),
  getActiveSession: async () => null,
  endFarmingSession: async () => ({ success: true }),

  // === UI Helpers ===
  showToast: (message, type) => {
    // Use UIHelpers if available
    if (window.UIHelpers?.showToast) {
      window.UIHelpers.showToast(message, type);
    }
  }
};

// Expose uiHelpers mock for backward compatibility
window.uiHelpers = {
  showToast: (message, type) => {
    if (window.UIHelpers?.showToast) {
      window.UIHelpers.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  },
  formatNumber: (n) => n?.toLocaleString() || '0',
  formatTime: (ms) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
};

console.log('[Demo] RavenHUD API Mock loaded');
