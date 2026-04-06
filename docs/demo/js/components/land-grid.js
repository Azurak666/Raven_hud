/**
 * Land Grid Component
 * Renders an interactive grid for land layout planning
 * Supports movable house placement for NFT lands
 * Demo version - adapted for web
 */

class LandGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.landType = options.landType || null;
    this.tileSize = options.tileSize || 40;
    this.selectedItem = null;
    this.grid = []; // Array of placed items: { x, y, item }
    this.validTiles = [];
    this.onGridChange = options.onGridChange || (() => {});
    this.onItemDeselect = options.onItemDeselect || (() => {});
    this.onHouseStateChange = options.onHouseStateChange || (() => {});

    // House placement state for NFT lands
    this.housePosition = null; // { x, y } or null if not placed
    this.houseRotation = 0; // 0, 90, 180, 270
    this.isPlacingHouse = false;
    this.housePreviewPosition = null;

    this.init();
  }

  /**
   * Initialize the grid
   */
  async init() {
    console.log('[LandGrid.init] Starting with landType:', this.landType);
    this.container.innerHTML = '';
    this.container.className = 'land-grid-container';

    if (!this.landType) {
      console.log('[LandGrid.init] No landType, showing placeholder');
      this.showPlaceholder('Select a land type to begin');
      return;
    }

    // Get land type data
    console.log('[LandGrid.init] Fetching land types via API...');
    let landTypes;
    try {
      landTypes = await window.electronAPI.getLandTypes();
      console.log('[LandGrid.init] Got', landTypes?.length || 0, 'land types:', landTypes?.map((l) => l.id).join(', '));
    } catch (err) {
      console.error('[LandGrid.init] API getLandTypes FAILED:', err);
      this.showPlaceholder('Failed to load land types');
      return;
    }

    if (!landTypes || landTypes.length === 0) {
      console.error('[LandGrid.init] No land types returned from API!');
      this.showPlaceholder('No land types available');
      return;
    }

    const land = landTypes.find((l) => l.id === this.landType);
    console.log('[LandGrid.init] Looking for id:', this.landType, '- Found:', land ? 'YES' : 'NO');

    if (!land) {
      console.error(
        '[LandGrid] Land type not found:',
        this.landType,
        '- Available:',
        landTypes.map((l) => l.id)
      );
      this.showPlaceholder('Invalid land type');
      return;
    }

    this.landData = land;
    this.validTiles = land.tiles;

    // Create controls container for NFT lands
    if (land.hasHouse) {
      this.createHouseControls();
    }

    // Create grid wrapper
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'land-grid-wrapper';
    const wrapperWidth = land.width * this.tileSize;
    const wrapperHeight = land.height * this.tileSize;
    gridWrapper.style.width = `${wrapperWidth}px`;
    gridWrapper.style.height = `${wrapperHeight}px`;
    gridWrapper.style.position = 'relative';
    gridWrapper.style.background = 'transparent';
    console.log(`[LandGrid.init] Grid wrapper size: ${wrapperWidth}x${wrapperHeight}px (${land.width}x${land.height} tiles @ ${this.tileSize}px each)`);

    // Render all tiles
    this.renderTiles(gridWrapper);

    // Add event listeners
    gridWrapper.addEventListener('click', (e) => this.handleGridClick(e));
    gridWrapper.addEventListener('contextmenu', (e) => this.handleRightClick(e));
    gridWrapper.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    gridWrapper.addEventListener('mouseleave', () => this.handleMouseLeave());

    this.container.appendChild(gridWrapper);
    this.gridWrapper = gridWrapper;
    console.log('[LandGrid.init] Grid rendered successfully - tiles:', this.validTiles.length, 'hasHouse:', land.hasHouse);

    // Add coordinate tooltip for debugging
    const coordTooltip = document.createElement('div');
    coordTooltip.id = 'grid-coord-tooltip';
    coordTooltip.style.cssText = `
      position: absolute;
      bottom: -24px;
      left: 0;
      font-size: 11px;
      color: #9CA3AF;
      background: rgba(0,0,0,0.7);
      padding: 2px 6px;
      border-radius: 3px;
      pointer-events: none;
      z-index: 100;
    `;
    coordTooltip.textContent = 'Hover: -';
    gridWrapper.appendChild(coordTooltip);
    this.coordTooltip = coordTooltip;

    // Notify about house state
    this.onHouseStateChange({
      hasHouse: land.hasHouse,
      housePlaced: this.housePosition !== null,
      isPlacingHouse: this.isPlacingHouse
    });
  }

  /**
   * Create house placement controls for NFT lands
   */
  createHouseControls() {
    const controls = document.createElement('div');
    controls.className = 'house-controls';
    controls.style.display = 'flex';
    controls.style.gap = '10px';
    controls.style.marginBottom = '10px';
    controls.style.alignItems = 'center';

    // Place House button (shown when house not placed)
    const placeHouseBtn = document.createElement('button');
    placeHouseBtn.id = 'placeHouseBtn';
    placeHouseBtn.className = 'btn btn-house';
    placeHouseBtn.innerHTML = '🏠 Place House';
    placeHouseBtn.style.background = '#D97706';
    placeHouseBtn.style.color = '#fff';
    placeHouseBtn.style.border = 'none';
    placeHouseBtn.style.padding = '8px 16px';
    placeHouseBtn.style.borderRadius = '4px';
    placeHouseBtn.style.cursor = 'pointer';
    placeHouseBtn.onclick = () => this.startHousePlacement();

    // Placing indicator (shown during placement)
    const placingIndicator = document.createElement('span');
    placingIndicator.id = 'placingIndicator';
    placingIndicator.innerHTML = '🏠 Placing...';
    placingIndicator.style.display = 'none';
    placingIndicator.style.background = '#D97706';
    placingIndicator.style.color = '#fff';
    placingIndicator.style.padding = '8px 16px';
    placingIndicator.style.borderRadius = '4px';

    // Rotate button
    const rotateBtn = document.createElement('button');
    rotateBtn.id = 'rotateHouseBtn';
    rotateBtn.className = 'btn btn-rotate';
    rotateBtn.innerHTML = '🔄 Rotate';
    rotateBtn.style.display = 'none';
    rotateBtn.style.background = '#3B82F6';
    rotateBtn.style.color = '#fff';
    rotateBtn.style.border = 'none';
    rotateBtn.style.padding = '8px 16px';
    rotateBtn.style.borderRadius = '4px';
    rotateBtn.style.cursor = 'pointer';
    rotateBtn.onclick = () => this.rotateHouse();

    // Remove House button (shown when house is placed)
    const removeHouseBtn = document.createElement('button');
    removeHouseBtn.id = 'removeHouseBtn';
    removeHouseBtn.className = 'btn btn-remove';
    removeHouseBtn.innerHTML = '❌ Remove House';
    removeHouseBtn.style.display = 'none';
    removeHouseBtn.style.background = '#EF4444';
    removeHouseBtn.style.color = '#fff';
    removeHouseBtn.style.border = 'none';
    removeHouseBtn.style.padding = '8px 16px';
    removeHouseBtn.style.borderRadius = '4px';
    removeHouseBtn.style.cursor = 'pointer';
    removeHouseBtn.onclick = () => this.removeHouse();

    // Status text
    const statusText = document.createElement('span');
    statusText.id = 'houseStatus';
    statusText.style.color = '#9CA3AF';
    statusText.style.fontSize = '14px';
    statusText.textContent = 'Click to place your house';

    controls.appendChild(placeHouseBtn);
    controls.appendChild(placingIndicator);
    controls.appendChild(rotateBtn);
    controls.appendChild(removeHouseBtn);
    controls.appendChild(statusText);

    this.container.appendChild(controls);
    this.houseControls = controls;
  }

  /**
   * Update house control visibility based on state
   */
  updateHouseControls() {
    if (!this.houseControls) return;

    const placeBtn = document.getElementById('placeHouseBtn');
    const placingIndicator = document.getElementById('placingIndicator');
    const rotateBtn = document.getElementById('rotateHouseBtn');
    const removeBtn = document.getElementById('removeHouseBtn');
    const status = document.getElementById('houseStatus');

    if (this.isPlacingHouse) {
      // Placing mode
      placeBtn.style.display = 'none';
      placingIndicator.style.display = 'inline-block';
      rotateBtn.style.display = 'inline-block';
      removeBtn.style.display = 'none';
      status.textContent = 'Click on the grid to place house. Right-click to cancel.';
    } else if (this.housePosition) {
      // House placed
      placeBtn.style.display = 'none';
      placingIndicator.style.display = 'none';
      rotateBtn.style.display = 'inline-block';
      removeBtn.style.display = 'inline-block';
      status.textContent = 'House placed';
    } else {
      // House not placed
      placeBtn.style.display = 'inline-block';
      placingIndicator.style.display = 'none';
      rotateBtn.style.display = 'none';
      removeBtn.style.display = 'none';
      status.textContent = 'Click to place your house';
    }

    // Notify listeners
    this.onHouseStateChange({
      hasHouse: this.landData?.hasHouse || false,
      housePlaced: this.housePosition !== null,
      isPlacingHouse: this.isPlacingHouse
    });
  }

  /**
   * Start house placement mode
   */
  startHousePlacement() {
    this.isPlacingHouse = true;
    this.selectedItem = null; // Deselect any crop
    this.onItemDeselect();
    this.updateHouseControls();
  }

  /**
   * Rotate house by 90 degrees with edge detection
   * Checks if the new rotation is valid before applying
   */
  rotateHouse() {
    const originalRotation = this.houseRotation;
    const rotations = [90, 180, 270, 0]; // Try all 4 rotations

    if (this.housePosition) {
      // House is placed - find a valid rotation
      const validRotation = rotations.find((testRotation) => {
        const nextRotation = (originalRotation + testRotation) % 360;
        this.houseRotation = nextRotation;
        const validation = this.validateHousePlacement(this.housePosition.x, this.housePosition.y);
        return validation.valid;
      });

      if (validRotation === undefined) {
        // No valid rotation found, revert and show error
        this.houseRotation = originalRotation;
        this.showError('Cannot rotate: house would be outside land bounds or door at edge');
        return;
      }

      // Re-render with new rotation
      this.renderTiles(this.gridWrapper);
      this.renderPlacedItems();

      // Notify about house state change
      this.onHouseStateChange({
        hasHouse: this.landData?.hasHouse || false,
        housePlaced: true,
        isPlacingHouse: false
      });
    } else {
      // House not placed yet - just rotate preview (validation happens on placement)
      this.houseRotation = (this.houseRotation + 90) % 360;
    }
  }

  /**
   * Remove placed house
   */
  removeHouse() {
    this.housePosition = null;
    this.grid = []; // Clear crops too since they depend on house position
    this.renderTiles(this.gridWrapper);
    this.renderPlacedItems();
    this.updateHouseControls();
    this.onGridChange(this.grid);
  }

  /**
   * Get house tiles at a specific position with current rotation
   * Uses the irregular house shape from the JSON land data
   */
  getHouseTilesAtPosition(x, y) {
    if (!this.landData?.hasHouse) return { house: [], door: [], clearance: [] };

    // Get house shape from land data (from JSON)
    const rawHouse = this.landData.houseTiles || [];
    const rawDoor = this.landData.houseDoorTiles || [];
    const rawClearance = this.landData.doorClearanceTiles || [];

    // If no house tiles defined, return empty
    if (rawHouse.length === 0) return { house: [], door: [], clearance: [] };

    // Combine all tiles to find bounding box
    const allTiles = [...rawHouse, ...rawDoor, ...rawClearance];
    const minX = Math.min(...allTiles.map((t) => t.x));
    const minY = Math.min(...allTiles.map((t) => t.y));
    const maxX = Math.max(...allTiles.map((t) => t.x));
    const maxY = Math.max(...allTiles.map((t) => t.y));
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Normalize tiles to be relative to (0, 0)
    const normalizeAndRotate = (tiles) => {
      // First normalize to (0, 0)
      const normalized = tiles.map((t) => ({
        x: t.x - minX,
        y: t.y - minY
      }));

      // Apply rotation around center of bounding box
      const centerX = (width - 1) / 2;
      const centerY = (height - 1) / 2;

      return normalized.map((t) => {
        let rx = t.x;
        let ry = t.y;

        // Apply rotation (90 degree increments)
        const rotations = this.houseRotation / 90;
        for (let r = 0; r < rotations; r++) {
          // Translate to center, rotate 90 CW, translate back
          const dx = rx - centerX;
          const dy = ry - centerY;
          // 90 degree CW rotation: (x, y) -> (y, -x)
          const newDx = dy;
          const newDy = -dx;
          rx = Math.round(newDx + centerX);
          ry = Math.round(newDy + centerY);
        }

        return { x: rx, y: ry };
      });
    };

    // Get rotated tiles and find new bounding box
    const rotatedHouse = normalizeAndRotate(rawHouse);
    const rotatedDoor = normalizeAndRotate(rawDoor);
    const rotatedClearance = normalizeAndRotate(rawClearance);

    // Find new bounding box after rotation (might have negative coords)
    const allRotated = [...rotatedHouse, ...rotatedDoor, ...rotatedClearance];
    const newMinX = Math.min(...allRotated.map((t) => t.x));
    const newMinY = Math.min(...allRotated.map((t) => t.y));

    // Offset to placement position, normalizing so min is at placement origin
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
   * Validate house placement position
   * Rules:
   * - House tiles must be on valid land
   * - Door tile must be on valid land AND not at the edge of the grid
   * - Clearance tile must be on valid land (can be at edge)
   */
  validateHousePlacement(x, y) {
    const tiles = this.getHouseTilesAtPosition(x, y);
    const allTiles = [...tiles.house, ...tiles.door, ...tiles.clearance];

    // Check all tiles are within valid land tiles
    const validSet = new Set(this.validTiles.map((t) => `${t.x},${t.y}`));
    const invalidTile = allTiles.find((tile) => !validSet.has(`${tile.x},${tile.y}`));
    if (invalidTile) {
      return { valid: false, reason: 'House or door area outside land bounds' };
    }

    // Check door is not at edge of grid
    // A tile is at the edge if any of its 4 neighbors is not a valid land tile
    const doorAtEdge = tiles.door.some((doorTile) => {
      const neighbors = [
        { x: doorTile.x - 1, y: doorTile.y }, // left
        { x: doorTile.x + 1, y: doorTile.y }, // right
        { x: doorTile.x, y: doorTile.y - 1 }, // up
        { x: doorTile.x, y: doorTile.y + 1 } // down
      ];
      return neighbors.some((n) => !validSet.has(`${n.x},${n.y}`));
    });

    if (doorAtEdge) {
      return { valid: false, reason: 'Door cannot be placed at the edge of the grid' };
    }

    return { valid: true };
  }

  /**
   * Render all grid tiles
   */
  renderTiles(wrapper) {
    // Clear existing tiles
    wrapper.innerHTML = '';

    // Create lookup maps for different tile types
    const tileMap = {};
    this.validTiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      tileMap[key] = 'land';
    });

    // If house is placed, mark those tiles
    const houseTileMap = {};
    if (this.housePosition) {
      const tiles = this.getHouseTilesAtPosition(this.housePosition.x, this.housePosition.y);
      tiles.house.forEach((tile) => {
        houseTileMap[`${tile.x},${tile.y}`] = 'house';
      });
      tiles.door.forEach((tile) => {
        houseTileMap[`${tile.x},${tile.y}`] = 'door';
      });
      tiles.clearance.forEach((tile) => {
        houseTileMap[`${tile.x},${tile.y}`] = 'clearance';
      });
    }

    // Render all tiles
    for (let y = 0; y < this.landData.height; y++) {
      for (let x = 0; x < this.landData.width; x++) {
        const key = `${x},${y}`;
        const tileType = tileMap[key];
        const houseType = houseTileMap[key];

        // Skip tiles that are not part of land
        if (!tileType) continue;

        const tile = document.createElement('div');
        tile.className = 'land-tile';
        tile.style.position = 'absolute';
        tile.style.left = `${x * this.tileSize}px`;
        tile.style.top = `${y * this.tileSize}px`;
        tile.style.width = `${this.tileSize}px`;
        tile.style.height = `${this.tileSize}px`;
        tile.style.boxSizing = 'border-box';
        tile.style.border = '1px solid rgba(0, 0, 0, 0.2)';
        tile.dataset.x = x;
        tile.dataset.y = y;

        // Style based on tile type
        // Improved colors for better visibility and accessibility
        if (houseType === 'house') {
          tile.style.background = '#6B7280'; // Cool gray - better distinction
          tile.style.boxShadow = 'inset 0 0 3px rgba(255,255,255,0.15)';
          tile.dataset.valid = 'false';
          tile.dataset.house = 'true';
        } else if (houseType === 'door') {
          tile.style.background = '#B45309'; // Dark amber - distinct from farmland
          tile.style.boxShadow = 'inset 0 0 6px rgba(255,200,100,0.5)';
          tile.dataset.valid = 'false';
          tile.dataset.house = 'door';
        } else if (houseType === 'clearance') {
          tile.style.background = '#4B5563'; // Darker gray for clearance
          tile.style.boxShadow = 'inset 0 0 2px rgba(255,255,255,0.1)';
          tile.dataset.valid = 'false';
          tile.dataset.house = 'clearance';
        } else {
          tile.style.background = '#5C4A3D'; // Warm taupe - better visibility
          tile.dataset.valid = 'true';
        }

        wrapper.appendChild(tile);
      }
    }

    // Render house icon and door icon if placed
    if (this.housePosition) {
      this.renderHouseIcon();
      this.renderDoorIcon();
    }
  }

  /**
   * Render door icon at the door tile position
   */
  renderDoorIcon() {
    if (!this.housePosition || !this.gridWrapper) return;

    const tiles = this.getHouseTilesAtPosition(this.housePosition.x, this.housePosition.y);
    if (tiles.door.length === 0) return;

    // Get door tile position
    const doorTile = tiles.door[0];

    const doorIcon = document.createElement('div');
    doorIcon.className = 'door-icon';
    doorIcon.style.position = 'absolute';
    doorIcon.style.left = `${doorTile.x * this.tileSize}px`;
    doorIcon.style.top = `${doorTile.y * this.tileSize}px`;
    doorIcon.style.width = `${this.tileSize}px`;
    doorIcon.style.height = `${this.tileSize}px`;
    doorIcon.style.fontSize = `${this.tileSize * 0.7}px`;
    doorIcon.style.display = 'flex';
    doorIcon.style.alignItems = 'center';
    doorIcon.style.justifyContent = 'center';
    doorIcon.style.pointerEvents = 'none';
    doorIcon.style.zIndex = '20';
    // Rotate door emoji to face the right direction based on house rotation
    doorIcon.style.transform = `rotate(${this.houseRotation}deg)`;
    doorIcon.textContent = '🚪';

    this.gridWrapper.appendChild(doorIcon);
  }

  /**
   * Render house icon at placed position (centered on house tiles)
   */
  renderHouseIcon() {
    if (!this.housePosition || !this.gridWrapper) return;

    // Get house tiles to find center
    const tiles = this.getHouseTilesAtPosition(this.housePosition.x, this.housePosition.y);
    if (tiles.house.length === 0) return;

    // Calculate center of house tiles
    const minX = Math.min(...tiles.house.map((t) => t.x));
    const maxX = Math.max(...tiles.house.map((t) => t.x));
    const minY = Math.min(...tiles.house.map((t) => t.y));
    const maxY = Math.max(...tiles.house.map((t) => t.y));
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;

    const houseIcon = document.createElement('div');
    houseIcon.className = 'house-icon';
    houseIcon.style.position = 'absolute';
    houseIcon.style.left = `${centerX * this.tileSize - this.tileSize / 2}px`;
    houseIcon.style.top = `${centerY * this.tileSize - this.tileSize / 2}px`;
    houseIcon.style.width = `${this.tileSize}px`;
    houseIcon.style.height = `${this.tileSize}px`;
    houseIcon.style.fontSize = `${this.tileSize * 0.8}px`;
    houseIcon.style.display = 'flex';
    houseIcon.style.alignItems = 'center';
    houseIcon.style.justifyContent = 'center';
    houseIcon.style.pointerEvents = 'none';
    houseIcon.style.transform = `rotate(${this.houseRotation}deg)`;
    houseIcon.textContent = '🏠';

    this.gridWrapper.appendChild(houseIcon);
  }

  /**
   * Show placeholder message
   */
  showPlaceholder(message) {
    const placeholder = document.createElement('div');
    placeholder.className = 'land-grid-placeholder';
    placeholder.textContent = message;
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.height = '400px';
    placeholder.style.color = '#808080';
    placeholder.style.fontSize = '16px';
    this.container.appendChild(placeholder);
  }

  /**
   * Set the currently selected item for placement
   */
  setSelectedItem(item) {
    if (this.landData?.hasHouse && !this.housePosition) {
      this.showError('Place your house first before adding crops');
      return;
    }
    this.selectedItem = item;
    this.isPlacingHouse = false;
    this.updateHouseControls();
  }

  /**
   * Handle grid click
   */
  async handleGridClick(e) {
    const tile = e.target.closest('[data-x]');
    if (!tile) return;

    const x = parseInt(tile.dataset.x);
    const y = parseInt(tile.dataset.y);

    // House placement mode
    if (this.isPlacingHouse) {
      const validation = this.validateHousePlacement(x, y);
      if (validation.valid) {
        this.housePosition = { x, y };
        this.isPlacingHouse = false;
        this.renderTiles(this.gridWrapper);
        this.updateHouseControls();
      } else {
        this.showError(validation.reason);
      }
      return;
    }

    // Crop placement
    if (!this.selectedItem) return;

    // Check if ANY tile the item would occupy is over house area or invalid
    // This is critical for 2x2 and 3x3 items
    for (let dy = 0; dy < this.selectedItem.height; dy++) {
      for (let dx = 0; dx < this.selectedItem.width; dx++) {
        const checkTile = this.gridWrapper.querySelector(
          `[data-x="${x + dx}"][data-y="${y + dy}"]`
        );
        if (!checkTile || checkTile.dataset.valid !== 'true') {
          const houseAttr = checkTile?.dataset.house;
          if (houseAttr === 'true' || houseAttr === 'door' || houseAttr === 'clearance') {
            this.showError('Cannot place crops over house area');
          } else {
            this.showError('Invalid placement - tile not available');
          }
          return;
        }
      }
    }

    // Validate placement (adjacency rules, etc.)
    const validation = await window.electronAPI.validateLandPlacement({
      x,
      y,
      item: this.selectedItem,
      landType: this.landType,
      existingGrid: this.grid,
      enforceAdjacency: true
    });

    if (!validation.valid) {
      this.showError(validation.message || 'Invalid placement');
      return;
    }

    // Place the item
    this.grid.push({
      x,
      y,
      item: this.selectedItem
    });

    this.renderPlacedItems();
    this.onGridChange(this.grid);
  }

  /**
   * Handle right-click
   */
  handleRightClick(e) {
    e.preventDefault();

    // Cancel house placement mode
    if (this.isPlacingHouse) {
      this.isPlacingHouse = false;
      this.updateHouseControls();
      this.clearPreview();
      return;
    }

    // Deselect item
    if (this.selectedItem) {
      this.selectedItem = null;
      this.onItemDeselect();
      this.clearPreview();
      return;
    }

    // Remove placed item
    const placedItemEl = e.target.closest('.placed-item');
    if (placedItemEl) {
      const itemX = parseInt(placedItemEl.dataset.gridX);
      const itemY = parseInt(placedItemEl.dataset.gridY);
      const index = this.grid.findIndex((placed) => placed.x === itemX && placed.y === itemY);
      if (index >= 0) {
        this.grid.splice(index, 1);
        this.renderPlacedItems();
        this.onGridChange(this.grid);
      }
      return;
    }

    // Check tile for placed item
    const tile = e.target.closest('[data-x]');
    if (!tile) return;

    const x = parseInt(tile.dataset.x);
    const y = parseInt(tile.dataset.y);

    const index = this.grid.findIndex(
      (placed) =>
        x >= placed.x &&
        x < placed.x + placed.item.width &&
        y >= placed.y &&
        y < placed.y + placed.item.height
    );

    if (index >= 0) {
      this.grid.splice(index, 1);
      this.renderPlacedItems();
      this.onGridChange(this.grid);
    }
  }

  /**
   * Handle mouse move - show preview
   * Preview can overdraw outside grid/over house, showing red blink if invalid
   */
  async handleMouseMove(e) {
    this.clearPreview();

    const tile = e.target.closest('[data-x]');
    if (!tile) return;

    const x = parseInt(tile.dataset.x);
    const y = parseInt(tile.dataset.y);

    // Debug: log coordinate once per tile (using a simple cache)
    const coordKey = `${x},${y}`;
    if (this._lastHoverCoord !== coordKey) {
      this._lastHoverCoord = coordKey;
      console.log(`[LandGrid] Hover tile: (${x}, ${y}) - preview at ${x * this.tileSize}px, ${y * this.tileSize}px`);
      // Update visual tooltip
      if (this.coordTooltip) {
        this.coordTooltip.textContent = `Hover: (${x}, ${y})`;
      }
    }

    // House placement preview
    if (this.isPlacingHouse) {
      this.renderHousePreview(x, y);
      return;
    }

    // Crop placement preview - show even for invalid tiles (over house, etc.)
    if (!this.selectedItem) return;

    // Check if ANY tile the item would occupy is over house area
    // This is critical for 2x2 and 3x3 items
    let isOverHouse = false;
    for (let dy = 0; dy < this.selectedItem.height && !isOverHouse; dy++) {
      for (let dx = 0; dx < this.selectedItem.width && !isOverHouse; dx++) {
        const checkTile = this.gridWrapper.querySelector(
          `[data-x="${x + dx}"][data-y="${y + dy}"]`
        );
        if (checkTile) {
          const houseAttr = checkTile.dataset.house;
          if (houseAttr === 'true' || houseAttr === 'door' || houseAttr === 'clearance') {
            isOverHouse = true;
          }
        }
      }
    }

    // Validate placement
    const validation = await window.electronAPI.validateLandPlacement({
      x,
      y,
      item: this.selectedItem,
      landType: this.landType,
      existingGrid: this.grid,
      enforceAdjacency: true
    });

    // Show preview - allow overdraw over house tiles but mark as invalid
    const isValid = validation.valid && !isOverHouse;
    const message = isOverHouse ? 'Cannot place crops over house area' : validation.message;
    this.renderCropPreview(x, y, isValid, message);
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    this.clearPreview();
    this._lastHoverCoord = null;
    if (this.coordTooltip) {
      this.coordTooltip.textContent = 'Hover: -';
    }
  }

  /**
   * Clear all previews
   */
  clearPreview() {
    if (!this.gridWrapper) return;
    const previews = this.gridWrapper.querySelectorAll(
      '.placement-preview, .house-preview, .blocked-preview'
    );
    previews.forEach((p) => p.remove());
  }

  /**
   * Render house placement preview with blocked zone
   * Overdraws outside grid bounds and shows blinking red for invalid placements
   */
  renderHousePreview(x, y) {
    const tiles = this.getHouseTilesAtPosition(x, y);
    const validation = this.validateHousePlacement(x, y);
    const isValid = validation.valid;

    if (tiles.house.length === 0) return;

    // Add CSS animation for invalid blink if it doesn't exist
    if (!document.getElementById('land-grid-animations')) {
      const style = document.createElement('style');
      style.id = 'land-grid-animations';
      style.textContent = `
        @keyframes invalid-blink {
          0%, 100% {
            background: rgba(239, 68, 68, 0.3);
            border-color: #EF4444;
          }
          50% {
            background: rgba(239, 68, 68, 0.6);
            border-color: #DC2626;
          }
        }
        @keyframes invalid-house-blink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }

    // Create sets for different tile types for coloring
    const doorSet = new Set(tiles.door.map((t) => `${t.x},${t.y}`));
    const clearanceSet = new Set(tiles.clearance.map((t) => `${t.x},${t.y}`));

    // Render blocked zone with different colors for house/door/clearance
    // Use higher z-index to overdraw outside grid bounds
    const allBlockedTiles = [...tiles.house, ...tiles.door, ...tiles.clearance];
    allBlockedTiles.forEach((t) => {
      const key = `${t.x},${t.y}`;
      const preview = document.createElement('div');
      preview.className = 'blocked-preview';
      preview.style.position = 'absolute';
      preview.style.left = `${t.x * this.tileSize}px`;
      preview.style.top = `${t.y * this.tileSize}px`;
      preview.style.width = `${this.tileSize}px`;
      preview.style.height = `${this.tileSize}px`;
      preview.style.pointerEvents = 'none';
      preview.style.zIndex = '25'; // Higher z-index to overdraw
      preview.style.boxSizing = 'border-box';

      if (isValid) {
        // Valid placement colors - matching new accessible color scheme
        if (doorSet.has(key)) {
          preview.style.background = 'rgba(180, 83, 9, 0.7)'; // Dark amber #B45309
        } else if (clearanceSet.has(key)) {
          preview.style.background = 'rgba(75, 85, 99, 0.5)'; // Darker gray #4B5563
        } else {
          preview.style.background = 'rgba(107, 114, 128, 0.7)'; // Cool gray #6B7280
        }
      } else {
        // Invalid placement - show red with blinking
        preview.style.background = 'rgba(239, 68, 68, 0.4)';
        preview.style.border = '2px solid #EF4444';
        preview.style.animation = 'invalid-blink 0.5s ease-in-out infinite';
      }

      this.gridWrapper.appendChild(preview);
    });

    // Calculate center of house tiles for icon placement
    const minX = Math.min(...tiles.house.map((t) => t.x));
    const maxX = Math.max(...tiles.house.map((t) => t.x));
    const minY = Math.min(...tiles.house.map((t) => t.y));
    const maxY = Math.max(...tiles.house.map((t) => t.y));
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;

    // Render house icon preview at center
    const housePreview = document.createElement('div');
    housePreview.className = 'house-preview';
    housePreview.style.position = 'absolute';
    housePreview.style.left = `${centerX * this.tileSize - this.tileSize / 2}px`;
    housePreview.style.top = `${centerY * this.tileSize - this.tileSize / 2}px`;
    housePreview.style.width = `${this.tileSize}px`;
    housePreview.style.height = `${this.tileSize}px`;
    housePreview.style.fontSize = `${this.tileSize * 0.8}px`;
    housePreview.style.display = 'flex';
    housePreview.style.alignItems = 'center';
    housePreview.style.justifyContent = 'center';
    housePreview.style.pointerEvents = 'none';
    housePreview.style.zIndex = '26';
    housePreview.style.transform = `rotate(${this.houseRotation}deg)`;
    if (!isValid) {
      housePreview.style.animation = 'invalid-house-blink 0.5s ease-in-out infinite';
    }
    housePreview.textContent = '🏠';
    if (!isValid && validation.reason) {
      housePreview.title = validation.reason;
    }

    this.gridWrapper.appendChild(housePreview);

    // Render door icon preview
    if (tiles.door.length > 0) {
      const doorTile = tiles.door[0];
      const doorPreview = document.createElement('div');
      doorPreview.className = 'house-preview';
      doorPreview.style.position = 'absolute';
      doorPreview.style.left = `${doorTile.x * this.tileSize}px`;
      doorPreview.style.top = `${doorTile.y * this.tileSize}px`;
      doorPreview.style.width = `${this.tileSize}px`;
      doorPreview.style.height = `${this.tileSize}px`;
      doorPreview.style.fontSize = `${this.tileSize * 0.7}px`;
      doorPreview.style.display = 'flex';
      doorPreview.style.alignItems = 'center';
      doorPreview.style.justifyContent = 'center';
      doorPreview.style.pointerEvents = 'none';
      doorPreview.style.zIndex = '27';
      doorPreview.style.transform = `rotate(${this.houseRotation}deg)`;
      if (!isValid) {
        doorPreview.style.animation = 'invalid-house-blink 0.5s ease-in-out infinite';
      }
      doorPreview.textContent = '🚪';

      this.gridWrapper.appendChild(doorPreview);
    }
  }

  /**
   * Render crop placement preview
   * Preview can overdraw outside grid/over house tiles
   * Shows blinking red animation for invalid placements
   */
  renderCropPreview(x, y, isValid, message) {
    const color = this.getItemColor(this.selectedItem.width, this.selectedItem.height);
    const preview = document.createElement('div');
    preview.className = 'placement-preview';
    preview.style.position = 'absolute';
    preview.style.left = `${x * this.tileSize}px`;
    preview.style.top = `${y * this.tileSize}px`;
    preview.style.width = `${this.selectedItem.width * this.tileSize}px`;
    preview.style.height = `${this.selectedItem.height * this.tileSize}px`;
    preview.style.borderRadius = '4px';
    preview.style.pointerEvents = 'none';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.justifyContent = 'center';
    preview.style.fontSize = `${this.tileSize * 0.6}px`;
    preview.style.zIndex = '25'; // Higher z-index to overdraw house tiles
    preview.style.boxSizing = 'border-box';
    preview.textContent = this.selectedItem.icon;

    if (isValid) {
      preview.style.background = color.bg.replace('0.25', '0.5');
      preview.style.border = `3px solid ${color.border}`;
    } else {
      // Invalid placement - blinking red animation
      preview.style.background = 'rgba(239, 68, 68, 0.4)';
      preview.style.border = '3px solid #EF4444';
      preview.style.animation = 'invalid-blink 0.5s ease-in-out infinite';
      preview.title = message || 'Invalid placement';
    }

    // Add CSS animation if it doesn't exist
    if (!document.getElementById('land-grid-animations')) {
      const style = document.createElement('style');
      style.id = 'land-grid-animations';
      style.textContent = `
        @keyframes invalid-blink {
          0%, 100% {
            background: rgba(239, 68, 68, 0.3);
            border-color: #EF4444;
          }
          50% {
            background: rgba(239, 68, 68, 0.6);
            border-color: #DC2626;
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.gridWrapper.appendChild(preview);
  }

  /**
   * Get color scheme for item size
   * Colorblind-safe palette: Amber (1x1), Blue (2x2), Purple (3x3), Emerald (4x4)
   */
  // eslint-disable-next-line class-methods-use-this
  getItemColor(width, height) {
    const sizeKey = `${width}x${height}`;
    const colors = {
      '1x1': { bg: 'rgba(251, 191, 36, 0.25)', border: '#FBBF24' }, // Amber
      '2x2': { bg: 'rgba(59, 130, 246, 0.25)', border: '#3B82F6' }, // Blue
      '3x3': { bg: 'rgba(168, 85, 247, 0.25)', border: '#A855F7' }, // Purple
      '4x4': { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981' } // Emerald
    };
    return colors[sizeKey] || { bg: 'rgba(90, 62, 27, 0.9)', border: '#5a3e1b' };
  }

  /**
   * Render all placed items on the grid
   */
  renderPlacedItems() {
    if (!this.gridWrapper) return;

    // Remove old item renders
    const oldItems = this.gridWrapper.querySelectorAll('.placed-item');
    oldItems.forEach((item) => item.remove());

    // Render each placed item
    this.grid.forEach((placed) => {
      const color = this.getItemColor(placed.item.width, placed.item.height);
      const itemEl = document.createElement('div');
      itemEl.className = 'placed-item';
      itemEl.dataset.gridX = placed.x;
      itemEl.dataset.gridY = placed.y;
      itemEl.style.position = 'absolute';
      itemEl.style.left = `${placed.x * this.tileSize}px`;
      itemEl.style.top = `${placed.y * this.tileSize}px`;
      itemEl.style.width = `${placed.item.width * this.tileSize}px`;
      itemEl.style.height = `${placed.item.height * this.tileSize}px`;
      itemEl.style.background = color.bg;
      itemEl.style.border = `3px solid ${color.border}`;
      itemEl.style.borderRadius = '4px';
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'center';
      itemEl.style.fontSize = `${this.tileSize * 0.6}px`;
      itemEl.style.cursor = 'pointer';
      itemEl.style.zIndex = '15';
      itemEl.style.boxSizing = 'border-box';
      itemEl.textContent = placed.item.icon;
      itemEl.title = `${placed.item.name} (${placed.item.size}) - ${placed.item.silverCost} silver\nRight-click to remove`;

      this.gridWrapper.appendChild(itemEl);
    });
  }

  /**
   * Load a saved layout into the grid
   */
  loadLayout(layout) {
    if (layout.landType !== this.landType) {
      this.showError('Layout land type does not match');
      return;
    }

    this.grid = layout.grid || [];
    if (layout.housePosition) {
      this.housePosition = layout.housePosition;
      this.houseRotation = layout.houseRotation || 0;
    }
    this.renderTiles(this.gridWrapper);
    this.renderPlacedItems();
    this.updateHouseControls();
    this.onGridChange(this.grid);
  }

  /**
   * Clear the grid
   */
  clear() {
    this.grid = [];
    if (this.landData?.hasHouse) {
      this.housePosition = null;
      this.houseRotation = 0;
      this.renderTiles(this.gridWrapper);
      this.updateHouseControls();
    }
    this.renderPlacedItems();
    this.onGridChange(this.grid);
  }

  /**
   * Get current grid state including house
   */
  getGrid() {
    return this.grid;
  }

  /**
   * Get house state for saving
   */
  getHouseState() {
    return {
      position: this.housePosition,
      rotation: this.houseRotation
    };
  }

  /**
   * Place house at a specific position with rotation (used by optimal layout suggestions)
   * Returns true if placement was successful, false otherwise
   */
  placeHouseAt(x, y, rotation = 0) {
    if (!this.landData?.hasHouse) {
      this.showError('This land type does not have a house');
      return false;
    }

    // Set the rotation first so validation uses the correct rotation
    const originalRotation = this.houseRotation;
    this.houseRotation = rotation;

    // Validate placement
    const validation = this.validateHousePlacement(x, y);
    if (!validation.valid) {
      this.houseRotation = originalRotation;
      this.showError(validation.reason || 'Cannot place house at this position');
      return false;
    }

    // Clear existing crops since they depend on house position
    if (this.housePosition && (this.housePosition.x !== x || this.housePosition.y !== y)) {
      this.grid = [];
    }

    // Place the house
    this.housePosition = { x, y };
    this.isPlacingHouse = false;

    // Re-render
    this.renderTiles(this.gridWrapper);
    this.renderPlacedItems();
    this.updateHouseControls();
    this.onGridChange(this.grid);

    return true;
  }

  /**
   * Change land type and reinitialize
   */
  async setLandType(landType) {
    console.log('[LandGrid.setLandType] Called with:', landType);
    this.landType = landType;
    this.grid = [];
    this.housePosition = null;
    this.houseRotation = 0;
    this.isPlacingHouse = false;
    console.log('[LandGrid.setLandType] Calling init()...');
    await this.init();
    console.log('[LandGrid.setLandType] init() completed');
    this.onGridChange(this.grid);
  }

  /**
   * Show error message
   */
  // eslint-disable-next-line class-methods-use-this
  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'land-error-toast';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.background = '#EF4444';
    toast.style.color = '#fff';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '14px';

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Expose globally for demo
window.LandGrid = LandGrid;
