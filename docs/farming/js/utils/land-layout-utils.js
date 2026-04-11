/**
 * Shared land layout utilities
 * Used by both land-optimized.js and tradepacks.js
 */

/**
 * Get house tiles at a specific position with given rotation
 * Uses the irregular house shape from land data
 * @param {Object} landData - Land data with houseTiles, houseDoorTiles, doorClearanceTiles
 * @param {Object} position - {x, y} position
 * @param {number} rotation - Rotation in degrees (0, 90, 180, 270)
 * @returns {Object} { house: [], door: [], clearance: [] }
 */
function getHouseTilesAtPosition(landData, position, rotation) {
  if (!landData?.hasHouse) return { house: [], door: [], clearance: [] };

  const { x, y } = position;

  // Get house shape from land data
  const rawHouse = landData.houseTiles || [];
  const rawDoor = landData.houseDoorTiles || [];
  const rawClearance = landData.doorClearanceTiles || [];

  if (rawHouse.length === 0) return { house: [], door: [], clearance: [] };

  // Combine all tiles to find bounding box
  const allTiles = [...rawHouse, ...rawDoor, ...rawClearance];
  const minX = Math.min(...allTiles.map((t) => t.x));
  const minY = Math.min(...allTiles.map((t) => t.y));
  const maxX = Math.max(...allTiles.map((t) => t.x));
  const maxY = Math.max(...allTiles.map((t) => t.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  // Normalize tiles and apply rotation
  const normalizeAndRotate = (tiles) => {
    const normalized = tiles.map((t) => ({
      x: t.x - minX,
      y: t.y - minY
    }));

    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;

    return normalized.map((t) => {
      let rx = t.x;
      let ry = t.y;

      const rotations = rotation / 90;
      for (let r = 0; r < rotations; r++) {
        const dx = rx - centerX;
        const dy = ry - centerY;
        const newDx = dy;
        const newDy = -dx;
        rx = Math.round(newDx + centerX);
        ry = Math.round(newDy + centerY);
      }

      return { x: rx, y: ry };
    });
  };

  const rotatedHouse = normalizeAndRotate(rawHouse);
  const rotatedDoor = normalizeAndRotate(rawDoor);
  const rotatedClearance = normalizeAndRotate(rawClearance);

  // Find new bounding box after rotation
  const allRotated = [...rotatedHouse, ...rotatedDoor, ...rotatedClearance];
  const newMinX = Math.min(...allRotated.map((t) => t.x));
  const newMinY = Math.min(...allRotated.map((t) => t.y));

  // Offset to placement position
  const houseTiles = rotatedHouse.map((t) => ({
    x: t.x - newMinX + x,
    y: t.y - newMinY + y
  }));
  const doorTiles = rotatedDoor.map((t) => ({
    x: t.x - newMinX + x,
    y: t.y - newMinY + y
  }));
  const clearanceTiles = rotatedClearance.map((t) => ({
    x: t.x - newMinX + x,
    y: t.y - newMinY + y
  }));

  return { house: houseTiles, door: doorTiles, clearance: clearanceTiles };
}

/**
 * Calculate which tiles are blocked by the house
 * @param {Object} landData - Land data
 * @param {Object} position - {x, y} position
 * @param {number} rotation - Rotation in degrees
 * @returns {Set} Set of blocked tile keys "x,y"
 */
function calculateBlockedTiles(landData, position, rotation) {
  const blocked = new Set();

  if (!landData?.hasHouse) return blocked;

  const tiles = getHouseTilesAtPosition(landData, position, rotation);

  [...tiles.house, ...tiles.door, ...tiles.clearance].forEach((t) => {
    blocked.add(`${t.x},${t.y}`);
  });

  return blocked;
}

/**
 * Validate house placement position
 * @param {Object} houseTiles - { house, door, clearance } tile arrays
 * @param {Array} validLandTiles - Array of valid land tiles
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateHousePlacement(houseTiles, validLandTiles) {
  const allTiles = [...houseTiles.house, ...houseTiles.door, ...houseTiles.clearance];
  const validSet = new Set(validLandTiles.map((t) => `${t.x},${t.y}`));

  // Check all tiles are within valid land
  const invalidTile = allTiles.find((tile) => !validSet.has(`${tile.x},${tile.y}`));
  if (invalidTile) {
    return { valid: false, reason: 'House outside land bounds' };
  }

  // Check door is not at edge (all 4 neighbors must be valid)
  const doorAtEdge = houseTiles.door.some((doorTile) => {
    const neighbors = [
      { x: doorTile.x - 1, y: doorTile.y },
      { x: doorTile.x + 1, y: doorTile.y },
      { x: doorTile.x, y: doorTile.y - 1 },
      { x: doorTile.x, y: doorTile.y + 1 }
    ];
    return neighbors.some((n) => !validSet.has(`${n.x},${n.y}`));
  });

  if (doorAtEdge) {
    return { valid: false, reason: 'Door at edge of grid' };
  }

  return { valid: true };
}

/**
 * Calculate optimal placement for a single crop size
 * Uses stride-based algorithm with 4 strategies
 * @param {number} width - Crop width
 * @param {number} height - Crop height
 * @param {Set} tileSet - Set of available tile keys "x,y"
 * @returns {Object} { placements, filledTiles }
 */
function calculateOptimalPlacement(width, height, tileSet) {
  // Get bounds from available tiles
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  Array.from(tileSet).forEach((key) => {
    const [tx, ty] = key.split(',').map(Number);
    minX = Math.min(minX, tx);
    maxX = Math.max(maxX, tx);
    minY = Math.min(minY, ty);
    maxY = Math.max(maxY, ty);
  });

  if (minX === Infinity) {
    return { placements: [], filledTiles: [] };
  }

  const landWidth = maxX - minX + 1;
  const landHeight = maxY - minY + 1;
  const size = Math.max(width, height);
  const stride = size + 1; // Gap of 1 between chains (matches game rules)

  const canPlaceAt = (x, y) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (!tileSet.has(`${x + dx},${y + dy}`)) {
          return false;
        }
      }
    }
    return true;
  };

  // Strategy 1: All rows
  const rowPositions = [];
  for (let y = minY; y + height <= minY + landHeight; y += stride) {
    for (let x = minX; x + width <= minX + landWidth; x += width) {
      if (canPlaceAt(x, y)) {
        rowPositions.push({ x, y });
      }
    }
  }

  // Strategy 2: All columns
  const colPositions = [];
  for (let x = minX; x + width <= minX + landWidth; x += stride) {
    for (let y = minY; y + height <= minY + landHeight; y += height) {
      if (canPlaceAt(x, y)) {
        colPositions.push({ x, y });
      }
    }
  }

  // Strategy 3: N rows at top + columns below
  let bestRowsPlusCols = [];
  const numRowsMax = Math.floor((landHeight + 1) / stride);
  for (let nRows = 1; nRows < numRowsMax; nRows++) {
    const lastRowY = minY + (nRows - 1) * stride;
    const heightUsedByRows = lastRowY - minY + size;
    const startYForCols = minY + heightUsedByRows + 1;
    const remainingHeight = minY + landHeight - startYForCols;

    if (remainingHeight >= size) {
      const positions = [];
      for (let rowIdx = 0; rowIdx < nRows; rowIdx++) {
        const y = minY + rowIdx * stride;
        for (let x = minX; x + width <= minX + landWidth; x += width) {
          if (canPlaceAt(x, y)) {
            positions.push({ x, y });
          }
        }
      }
      for (let x = minX; x + width <= minX + landWidth; x += stride) {
        for (let y = startYForCols; y + height <= minY + landHeight; y += height) {
          if (canPlaceAt(x, y)) {
            positions.push({ x, y });
          }
        }
      }
      if (positions.length > bestRowsPlusCols.length) {
        bestRowsPlusCols = positions;
      }
    }
  }

  // Strategy 4: N columns at left + rows to the right
  let bestColsPlusRows = [];
  const numColsMax = Math.floor((landWidth + 1) / stride);
  for (let nCols = 1; nCols < numColsMax; nCols++) {
    const lastColX = minX + (nCols - 1) * stride;
    const widthUsedByCols = lastColX - minX + size;
    const startXForRows = minX + widthUsedByCols + 1;
    const remainingWidth = minX + landWidth - startXForRows;

    if (remainingWidth >= size) {
      const positions = [];
      for (let colIdx = 0; colIdx < nCols; colIdx++) {
        const x = minX + colIdx * stride;
        for (let y = minY; y + height <= minY + landHeight; y += height) {
          if (canPlaceAt(x, y)) {
            positions.push({ x, y });
          }
        }
      }
      for (let y = minY; y + height <= minY + landHeight; y += stride) {
        for (let x = startXForRows; x + width <= minX + landWidth; x += width) {
          if (canPlaceAt(x, y)) {
            positions.push({ x, y });
          }
        }
      }
      if (positions.length > bestColsPlusRows.length) {
        bestColsPlusRows = positions;
      }
    }
  }

  // Select best strategy
  const strategies = [rowPositions, colPositions, bestRowsPlusCols, bestColsPlusRows];
  let bestPositions = rowPositions;
  strategies.forEach((s) => {
    if (s.length > bestPositions.length) {
      bestPositions = s;
    }
  });

  // Gap-filling pass for irregular land shapes
  const occupiedTiles = new Set();
  bestPositions.forEach((pos) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        occupiedTiles.add(`${pos.x + dx},${pos.y + dy}`);
      }
    }
  });

  const canAddPosition = (newX, newY, existingPositions) => {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (occupiedTiles.has(`${newX + dx},${newY + dy}`)) {
          return false;
        }
      }
    }

    for (let i = 0; i < existingPositions.length; i++) {
      const ex = existingPositions[i].x;
      const ey = existingPositions[i].y;

      const newRight = newX + width - 1;
      const newBottom = newY + height - 1;
      const exRight = ex + width - 1;
      const exBottom = ey + height - 1;

      const xOverlap = !(newRight < ex || newX > exRight);
      const yOverlap = !(newBottom < ey || newY > exBottom);
      if (xOverlap && yOverlap) return false;

      let xGap = -1;
      if (newX > exRight) {
        xGap = newX - exRight - 1;
      } else if (ex > newRight) {
        xGap = ex - newRight - 1;
      }

      let yGap = -1;
      if (newY > exBottom) {
        yGap = newY - exBottom - 1;
      } else if (ey > newBottom) {
        yGap = ey - newBottom - 1;
      }

      if (xGap === 0 && yGap === 0) {
        return false;
      }

      if (xGap === 0) {
        const overlapStart = Math.max(newY, ey);
        const overlapEnd = Math.min(newBottom, exBottom);
        const overlapAmount = overlapEnd - overlapStart + 1;
        if (overlapAmount < height) {
          return false;
        }
      }

      if (yGap === 0) {
        const overlapStart = Math.max(newX, ex);
        const overlapEnd = Math.min(newRight, exRight);
        const overlapAmount = overlapEnd - overlapStart + 1;
        if (overlapAmount < width) {
          return false;
        }
      }
    }
    return true;
  };

  const scanOrders = [
    { name: 'TL-BR', yDir: 1, xDir: 1 },
    { name: 'TR-BL', yDir: 1, xDir: -1 },
    { name: 'BL-TR', yDir: -1, xDir: 1 },
    { name: 'BR-TL', yDir: -1, xDir: -1 }
  ];

  let bestAdditional = [];

  for (let s = 0; s < scanOrders.length; s++) {
    const scan = scanOrders[s];
    const additionalPositions = [];
    const scanOccupied = new Set(occupiedTiles);

    const yStart = scan.yDir === 1 ? minY : minY + landHeight - height;
    const yEnd = scan.yDir === 1 ? minY + landHeight - height : minY - 1;
    const xStart = scan.xDir === 1 ? minX : minX + landWidth - width;
    const xEnd = scan.xDir === 1 ? minX + landWidth - width : minX - 1;

    for (let y = yStart; scan.yDir === 1 ? y <= yEnd : y >= yEnd; y += scan.yDir) {
      for (let x = xStart; scan.xDir === 1 ? x <= xEnd : x >= xEnd; x += scan.xDir) {
        if (!canPlaceAt(x, y)) continue;

        const alreadyPlaced = bestPositions.some((p) => p.x === x && p.y === y);
        if (alreadyPlaced) continue;

        let tilesOccupied = false;
        for (let dy = 0; dy < height && !tilesOccupied; dy++) {
          for (let dx = 0; dx < width && !tilesOccupied; dx++) {
            if (scanOccupied.has(`${x + dx},${y + dy}`)) {
              tilesOccupied = true;
            }
          }
        }
        if (tilesOccupied) continue;

        const allPositions = [...bestPositions, ...additionalPositions];
        if (canAddPosition(x, y, allPositions)) {
          additionalPositions.push({ x, y });
          for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
              scanOccupied.add(`${x + dx},${y + dy}`);
            }
          }
        }
      }
    }

    if (additionalPositions.length > bestAdditional.length) {
      bestAdditional = additionalPositions;
    }
  }

  const finalPositions = [...bestPositions, ...bestAdditional];

  const placements = [];
  const filledTiles = [];
  finalPositions.forEach((pos) => {
    placements.push({ x: pos.x, y: pos.y, width, height });
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        filledTiles.push({ x: pos.x + dx, y: pos.y + dy });
      }
    }
  });

  return { placements, filledTiles };
}

/**
 * Helper function to evaluate a single house position/rotation
 */
function evaluateHousePosition(landData, validTiles, position, rotation, targetCropSize) {
  const houseTilesHere = getHouseTilesAtPosition(landData, position, rotation);
  const validation = validateHousePlacement(houseTilesHere, validTiles);
  if (!validation.valid) return -1;

  const blockedSet = new Set();
  [...houseTilesHere.house, ...houseTilesHere.door, ...houseTilesHere.clearance].forEach((t) => {
    blockedSet.add(`${t.x},${t.y}`);
  });

  const remainingTileSet = new Set();
  validTiles.forEach((t) => {
    const key = `${t.x},${t.y}`;
    if (!blockedSet.has(key)) remainingTileSet.add(key);
  });

  const cropPlacement = calculateOptimalPlacement(targetCropSize, targetCropSize, remainingTileSet);
  return cropPlacement.placements.length;
}

/**
 * Find the optimal house position for NFT lands
 */
function findOptimalHousePosition(landData, validTiles, targetCropSize = 2) {
  if (!landData?.hasHouse) {
    return { position: null, rotation: 0, maxCrops: 0 };
  }

  const { width, height } = landData;

  const allHouseTiles = [
    ...(landData.houseTiles || []),
    ...(landData.houseDoorTiles || []),
    ...(landData.doorClearanceTiles || [])
  ];

  if (allHouseTiles.length === 0) {
    return { position: null, rotation: 0, maxCrops: 0 };
  }

  const houseMinX = Math.min(...allHouseTiles.map((t) => t.x));
  const houseMinY = Math.min(...allHouseTiles.map((t) => t.y));
  const houseMaxX = Math.max(...allHouseTiles.map((t) => t.x));
  const houseMaxY = Math.max(...allHouseTiles.map((t) => t.y));
  const houseWidth = houseMaxX - houseMinX + 1;
  const houseHeight = houseMaxY - houseMinY + 1;

  let bestPosition = null;
  let bestRotation = 0;
  let maxCropsPlaced = -1;

  const maxPosX = width - Math.min(houseWidth, houseHeight);
  const maxPosY = height - Math.min(houseWidth, houseHeight);
  const rotations = [0, 90, 180, 270];

  for (let posX = 0; posX <= maxPosX; posX++) {
    for (let posY = 0; posY <= maxPosY; posY++) {
      for (let r = 0; r < rotations.length; r++) {
        const rotation = rotations[r];
        const position = { x: posX, y: posY };

        const cropCount = evaluateHousePosition(
          landData,
          validTiles,
          position,
          rotation,
          targetCropSize
        );

        if (cropCount > maxCropsPlaced) {
          maxCropsPlaced = cropCount;
          bestPosition = position;
          bestRotation = rotation;
        }
      }
    }
  }

  return { position: bestPosition, rotation: bestRotation, maxCrops: maxCropsPlaced };
}

/**
 * Land type ordering for display
 */
const LAND_ORDER = [
  'SMALL_COMMUNITY',
  'MEDIUM_COMMUNITY',
  'LARGE_COMMUNITY',
  'NFT_SMALL',
  'NFT_MEDIUM',
  'NFT_LARGE',
  'NFT_STRONGHOLD',
  'NFT_FORT'
];

/**
 * Sort lands by type order
 */
function sortLandsByType(lands) {
  return [...lands].sort((a, b) => {
    const typeA = a.land?.type || a.land?.id || a.type || '';
    const typeB = b.land?.type || b.land?.id || b.type || '';
    const orderA = LAND_ORDER.indexOf(typeA);
    const orderB = LAND_ORDER.indexOf(typeB);
    const effectiveA = orderA === -1 ? 999 : orderA;
    const effectiveB = orderB === -1 ? 999 : orderB;
    return effectiveA - effectiveB;
  });
}

// Export for browser use
window.LandLayoutUtils = {
  getHouseTilesAtPosition,
  calculateBlockedTiles,
  validateHousePlacement,
  calculateOptimalPlacement,
  findOptimalHousePosition,
  sortLandsByType,
  LAND_ORDER
};
