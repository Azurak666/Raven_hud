/**
 * Crop Icon Utility
 * Provides crop emoji/icon lookups from actual crops.json data
 * Falls back to category-based defaults for unknown crops
 */

// Cache for crop data
let cropDataCache = null;
let cropIconMap = null;

// Category-based fallback icons (for when specific crop icon is missing)
const CATEGORY_ICONS = {
  farming: '🌾',
  herbalism: '🌿',
  husbandry: '🐄',
  woodcutting: '🌲',
  breeding: '🦤'
};

// Fallback icons for materials that aren't crops (purchased items, yields, etc.)
const MATERIAL_FALLBACKS = {
  // Common purchased/non-farmable materials
  salt: '🧂',
  sugar: '🍬',
  flour: '🌾',
  water: '💧',
  oil: '🫒',
  spices: '🌶️',
  herbs: '🌿',
  meat: '🥩',
  fish: '🐟',
  milk: '🥛',
  egg: '🥚',
  eggs: '🥚',
  honey: '🍯',
  cheese: '🧀',
  butter: '🧈',
  bread: '🍞',
  wine: '🍷',
  beer: '🍺',
  leather: '🪵',
  cloth: '🧵',
  wool: '🧶',
  iron: '⚙️',
  copper: '🔶',
  silver: '⬜',
  gold: '🟡',
  gem: '💎',
  crystal: '💎',
  wood: '🪵',
  stone: '🪨',
  ore: '⛏️',
  // Crop yields (materials from farming)
  acorn: '🌰',
  apple: '🍎',
  orange: '🍊',
  banana: '🍌',
  cherry: '🍒',
  grape: '🍇',
  grapes: '🍇',
  blueberry: '🫐',
  blueberries: '🫐',
  strawberry: '🍓',
  strawberries: '🍓',
  wheat: '🌾',
  corn: '🌽',
  potato: '🥔',
  potatoes: '🥔',
  carrot: '🥕',
  carrots: '🥕',
  cabbage: '🥬',
  cabbages: '🥬',
  lettuce: '🥬',
  pepper: '🌶️',
  peppers: '🌶️',
  onion: '🧅',
  onions: '🧅',
  garlic: '🧄',
  pumpkin: '🎃',
  watermelon: '🍉',
  pea: '🫛',
  peas: '🫛',
  bean: '🫘',
  beans: '🫘',
  broccoli: '🥦',
  brocolli: '🥦',
  sunberry: '☀️',
  sunberries: '☀️',
  moonberry: '🌙',
  cotton: '🧵',
  // Animal products
  raw_meat: '🥩',
  raw_pork: '🥓',
  raw_chicken: '🍗',
  raw_mutton: '🍖',
  raw_beef: '🥩',
  feather: '🪶',
  feathers: '🪶',
  hide: '🦴',
  hare_meat: '🥩',
  pork: '🥓',
  chicken_meat: '🍗',
  goat_meat: '🍖',
  turkey_meat: '🦃',
  mutton: '🍖',
  beef: '🥩',
  moa_egg: '🥚',
  // Wood
  juniper_wood: '🪵',
  fir_wood: '🪵',
  palm_wood: '🌴',
  oak_wood: '🪵',
  wildleaf_wood: '🪵',
  willow_wood: '🪵'
};

/**
 * Initialize the crop icon cache from crops data
 * Call this once when the app loads
 */
async function initCropIconCache() {
  if (cropIconMap) return; // Already initialized

  try {
    cropDataCache = await window.electronAPI.getCropData();
    cropIconMap = new Map();

    if (cropDataCache?.items) {
      cropDataCache.items.forEach((crop) => {
        if (crop.id && crop.icon) {
          cropIconMap.set(crop.id.toLowerCase(), crop.icon);
        }
        // Also map by normalized name
        if (crop.name && crop.icon) {
          const normalizedName = crop.name.toLowerCase().replace(/\s+/g, '_');
          cropIconMap.set(normalizedName, crop.icon);
        }
      });
    }

    console.log(`[CropIcons] Loaded ${cropIconMap.size} crop icons from data`);
  } catch (err) {
    console.error('[CropIcons] Failed to load crop data:', err);
    cropIconMap = new Map();
  }
}

/**
 * Get emoji/icon for a crop by its ID or name
 * @param {string} cropIdOrName - Crop ID or name (e.g., "small_cow_pen" or "Small Cow Pen")
 * @returns {string} Emoji icon
 */
function getCropIcon(cropIdOrName) {
  if (!cropIdOrName) return '🌱';

  // Normalize the input
  const normalized = String(cropIdOrName).toLowerCase().replace(/\s+/g, '_');

  // Try crop icon map first (from crops.json)
  if (cropIconMap?.has(normalized)) {
    return cropIconMap.get(normalized);
  }

  // Try material fallbacks (for non-crop items)
  if (MATERIAL_FALLBACKS[normalized]) {
    return MATERIAL_FALLBACKS[normalized];
  }

  // Try partial match in material fallbacks
  const materialKey = Object.keys(MATERIAL_FALLBACKS).find(
    (key) => normalized.includes(key) || key.includes(normalized)
  );
  if (materialKey) {
    return MATERIAL_FALLBACKS[materialKey];
  }

  // Try to get category from cached crop data for category-based fallback
  if (cropDataCache?.items) {
    const crop = cropDataCache.items.find(
      (c) =>
        c.id?.toLowerCase() === normalized ||
        c.name?.toLowerCase().replace(/\s+/g, '_') === normalized
    );
    if (crop?.category && CATEGORY_ICONS[crop.category]) {
      return CATEGORY_ICONS[crop.category];
    }
  }

  return '🌱'; // Ultimate fallback
}

/**
 * Get crop data by ID
 * @param {string} cropId - Crop ID
 * @returns {Object|null} Crop data or null
 */
function getCropById(cropId) {
  if (!cropDataCache?.items || !cropId) return null;
  return cropDataCache.items.find((c) => c.id === cropId) || null;
}

/**
 * Get all cached crops
 * @returns {Array} Array of crop objects
 */
function getAllCrops() {
  return cropDataCache?.items || [];
}

// Expose globally
window.CropIcons = {
  init: initCropIconCache,
  getIcon: getCropIcon,
  getCrop: getCropById,
  getAllCrops,
  CATEGORY_ICONS,
  MATERIAL_FALLBACKS
};
