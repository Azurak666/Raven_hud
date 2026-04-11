/**
 * Land Sidebar Component
 * Size palette for layout optimization (matches in-app UI)
 * Demo version - adapted for web
 */

class LandSidebar {
  constructor(container, options = {}) {
    this.container = container;
    this.onItemSelect = options.onItemSelect || (() => {});
    this.onLayoutLoad = options.onLayoutLoad || (() => {});
    this.onLandSelect = options.onLandSelect || (() => {});
    this.currentLandType = null;
    this.currentGrid = [];
    this.selectedSize = null;
    this.isNftLand = false;
    this.housePosition = null;
    this.ownedLandEntries = [];
    this.selectedOwnedLandId = null;

    // Size options matching in-app palette
    this.sizeOptions = [
      { size: '1x1', label: '1x1', color: '#FBBF24', item: { id: 'generic_1x1', name: '1x1', icon: '', width: 1, height: 1, size: '1x1', silverCost: 0 } },
      { size: '2x2', label: '2x2', color: '#3B82F6', item: { id: 'generic_2x2', name: '2x2', icon: '', width: 2, height: 2, size: '2x2', silverCost: 0 } },
      { size: '3x3', label: '3x3', color: '#A855F7', item: { id: 'generic_3x3', name: '3x3', icon: '', width: 3, height: 3, size: '3x3', silverCost: 0 } },
      { size: '4x4', label: '4x4', color: '#10B981', item: { id: 'generic_4x4', name: '4x4', icon: '', width: 4, height: 4, size: '4x4', silverCost: 0 } }
    ];

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.className = 'land-sidebar';
    this.render();
    this.refreshOwnedLands().catch((error) => {
      console.error('[LandSidebar] Failed to load owned lands:', error);
    });
  }

  async refreshOwnedLands() {
    if (!window.electronAPI?.getOwnedLands || !window.electronAPI?.getLandTypes) return;

    const [ownedLandsData, landTypes] = await Promise.all([
      window.electronAPI.getOwnedLands(),
      window.electronAPI.getLandTypes()
    ]);

    this.ownedLandEntries = this.buildOwnedLandEntries(
      ownedLandsData?.ownedLands || {},
      Array.isArray(landTypes) ? landTypes : []
    );

    if (
      this.selectedOwnedLandId &&
      !this.ownedLandEntries.some((entry) => entry.id === this.selectedOwnedLandId)
    ) {
      this.selectedOwnedLandId = null;
    }

    if (!this.selectedOwnedLandId && this.currentLandType) {
      const matchingEntry = this.ownedLandEntries.find(
        (entry) => entry.landType === this.currentLandType
      );
      this.selectedOwnedLandId = matchingEntry?.id || null;
    }

    this.render();
  }

  buildOwnedLandEntries(ownedLands, landTypes) {
    const landTypeMap = new Map((landTypes || []).map((land) => [land.id, land]));
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

    const entries = [];
    order.forEach((landType) => {
      const count = Number(ownedLands?.[landType] || 0);
      const landInfo = landTypeMap.get(landType) || {};
      const baseName = this.getLandDisplayName(landType, landInfo);
      const tileCount = landInfo.tiles?.length || landInfo.tileCount || 0;

      for (let i = 0; i < count; i++) {
        entries.push({
          id: `${landType}_${i + 1}`,
          landType,
          label: `${baseName} #${i + 1}`,
          tiles: tileCount,
          hasHouse: Boolean(landInfo.hasHouse)
        });
      }
    });

    return entries;
  }

  getLandDisplayName(landType, landInfo = {}) {
    const names = {
      SMALL_COMMUNITY: 'Small Community',
      MEDIUM_COMMUNITY: 'Medium Community',
      LARGE_COMMUNITY: 'Large Community',
      NFT_SMALL: 'NFT Small',
      NFT_MEDIUM: 'NFT Medium',
      NFT_LARGE: 'NFT Large',
      NFT_STRONGHOLD: 'NFT Stronghold',
      NFT_FORT: 'NFT Fort'
    };

    return names[landType] || (landInfo.name || landType).replace(/\s+Land$/i, '');
  }

  render() {
    this.container.innerHTML = '';
    this.renderOwnedLandsSection();

    // Size palette section
    if (this.currentLandType) {
      const section = document.createElement('div');
      section.className = 'sidebar-section';

      const header = document.createElement('h3');
      header.className = 'section-title';
      header.textContent = 'Place Items';
      section.appendChild(header);

      const palette = document.createElement('div');
      palette.className = 'size-palette';

      this.sizeOptions.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'size-btn';
        if (this.selectedSize === opt.size) btn.classList.add('selected');
        if (this.isNftLand && !this.housePosition) btn.classList.add('disabled');
        btn.style.setProperty('--size-color', opt.color);
        btn.innerHTML = `<span class="size-label">${opt.label}</span>`;
        btn.addEventListener('click', () => this.selectSize(opt));
        palette.appendChild(btn);
      });

      section.appendChild(palette);

      // Hint for NFT lands without house
      if (this.isNftLand && !this.housePosition) {
        const hint = document.createElement('div');
        hint.className = 'palette-hint';
        hint.textContent = 'Place your house first before placing items';
        section.appendChild(hint);
      }

      this.container.appendChild(section);
    }
  }

  renderOwnedLandsSection() {
    const section = document.createElement('div');
    section.className = 'sidebar-section owned-lands-quick-select';

    const header = document.createElement('h3');
    header.className = 'section-title';
    header.textContent = 'Your Lands';
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'owned-land-list';

    if (!this.ownedLandEntries.length) {
      const empty = document.createElement('div');
      empty.className = 'owned-land-empty';
      empty.textContent = 'No lands configured yet.';
      list.appendChild(empty);

      const configureBtn = document.createElement('button');
      configureBtn.type = 'button';
      configureBtn.className = 'owned-land-configure-btn';
      configureBtn.textContent = 'Configure Lands';
      configureBtn.addEventListener('click', () => {
        document.getElementById('configureLandsOpenBtn')?.click();
      });
      list.appendChild(configureBtn);
    } else {
      this.ownedLandEntries.forEach((entry) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'owned-land-btn';
        if (this.selectedOwnedLandId === entry.id) {
          btn.classList.add('selected');
        }
        btn.innerHTML = `
          <span class="owned-land-name">${entry.label}</span>
          <span class="owned-land-meta">${entry.tiles} tiles${entry.hasHouse ? ' • house' : ''}</span>
        `;
        btn.addEventListener('click', () => this.selectOwnedLand(entry));
        list.appendChild(btn);
      });
    }

    section.appendChild(list);
    this.container.appendChild(section);
  }

  selectOwnedLand(entry) {
    if (!entry?.landType) return;

    this.selectedOwnedLandId = entry.id;
    this.currentLandType = entry.landType;
    this.selectedSize = null;
    this.onItemSelect(null);
    this.render();
    this.onLandSelect(entry);
  }

  selectSize(opt) {
    if (this.isNftLand && !this.housePosition) return;

    if (this.selectedSize === opt.size) {
      // Deselect
      this.selectedSize = null;
      this.onItemSelect(null);
    } else {
      this.selectedSize = opt.size;
      this.onItemSelect(opt.item);
    }
    this.render();
  }

  deselectItem() {
    this.selectedSize = null;
    this.render();
  }

  setLandType(landType) {
    this.currentLandType = landType;
    const nftIds = ['NFT_SMALL', 'NFT_MEDIUM', 'NFT_LARGE', 'NFT_STRONGHOLD', 'NFT_FORT'];
    this.isNftLand = nftIds.includes(landType);
    this.housePosition = null;

    if (!landType) {
      this.selectedOwnedLandId = null;
    } else {
      const matchingEntry =
        this.ownedLandEntries.find(
          (entry) => entry.id === this.selectedOwnedLandId && entry.landType === landType
        ) || this.ownedLandEntries.find((entry) => entry.landType === landType);
      this.selectedOwnedLandId = matchingEntry?.id || this.selectedOwnedLandId;
    }

    this.render();
  }

  setHouseState(position) {
    this.housePosition = position;
    this.render();
  }

  updateGrid(grid) {
    this.currentGrid = grid;
  }
}

// Expose globally for demo
window.LandSidebar = LandSidebar;
