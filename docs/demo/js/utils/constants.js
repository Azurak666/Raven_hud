/**
 * Shared UI Constants
 * Centralized definitions for icons, colors, and display values
 */

// Action display icons for farming timeline
const ACTION_ICONS = {
  plant: '🌱',
  harvest: '🌾',
  replant: '🔄'
};

// Action display colors for farming timeline
const ACTION_COLORS = {
  plant: '#4caf50',
  harvest: '#ff9800',
  replant: '#2196f3'
};

// Expose to window for non-module scripts
window.UIConstants = {
  ACTION_ICONS,
  ACTION_COLORS
};
