/**
 * Shared UI Helpers (Demo Version)
 * Provides common UI utilities across all renderer modules
 */

const TOAST_DURATION = 3500;

const uiHelpers = {
  /**
   * Debounce a function call
   * Uses shared debounce utility if available
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in ms (default: 150)
   */
  debounce(fn, delay = 150) {
    if (window.debounce) {
      return window.debounce(fn, delay);
    }
    // Fallback if debounce.js not loaded yet
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Throttle using requestAnimationFrame for scroll/resize handlers
   * Syncs with browser repaint cycle and pauses when tab is inactive
   * @param {Function} fn - Function to throttle
   */
  throttleRAF(fn) {
    let rafId = null;
    return (...args) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        fn(...args);
        rafId = null;
      });
    };
  },

  /**
   * Show/hide loading overlay
   * @param {boolean} isLoading - Whether to show loading state
   */
  setLoading(isLoading) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.display = isLoading ? 'flex' : 'none';
    }
    document.body.dataset.loading = isLoading ? 'true' : 'false';
  },

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'info', 'success', 'warning', 'error'
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) {
      // Fallback: create toast container if it doesn't exist
      const newContainer = document.createElement('div');
      newContainer.id = 'toastContainer';
      document.body.appendChild(newContainer);
      return this.showToast(message, type);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('transitionend', () => toast.remove());
    }, TOAST_DURATION);
  },

  /**
   * Safe IPC call wrapper with error handling and validation
   * In demo mode, this just calls the function directly
   * @param {Function} ipcCall - Async function to call
   * @param {*} defaultValue - Value to return on error (default: null)
   * @param {Object} options - Options for error handling
   * @returns {Promise<*>} Result or default value
   */
  async safeIPC(ipcCall, defaultValue = null, options = {}) {
    try {
      const result = await ipcCall();
      if (options.validate && result != null) {
        if (!options.validate(result)) {
          console.warn('Response failed validation');
          return defaultValue;
        }
      }
      return result ?? defaultValue;
    } catch (err) {
      console.error('Call failed:', err);
      if (!options.silent) {
        const message = options.errorMessage || 'Operation failed';
        this.showToast(message, 'error');
      }
      return defaultValue;
    }
  },

  /** Common response validators */
  validators: {
    isObject: (v) => v && typeof v === 'object' && !Array.isArray(v),
    isArray: (v) => Array.isArray(v),
    hasItems: (v) => Array.isArray(v?.items),
    hasSuccess: (v) => typeof v?.success === 'boolean'
  },

  /**
   * Perform an optimistic UI update with automatic rollback on failure
   * @param {Object} options - Optimistic update options
   * @returns {Promise<boolean>} Whether the save succeeded
   */
  async optimisticUpdate({ update, rollback, save, errorMessage, onSuccess }) {
    try {
      update();
    } catch (err) {
      console.error('Optimistic update failed:', err);
      return false;
    }

    try {
      const result = await save();
      if (result?.success === false) {
        throw new Error(result?.error || 'Save failed');
      }
      if (onSuccess) {
        onSuccess(result);
      }
      return true;
    } catch (err) {
      console.error('Optimistic save failed, rolling back:', err);
      try {
        rollback();
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      this.showToast(errorMessage || 'Failed to save change', 'error');
      return false;
    }
  },

  /**
   * Create a pending state tracker for preventing duplicate actions
   * @returns {Object} Tracker with add, has, delete methods
   */
  createPendingTracker() {
    const pending = new Set();
    return {
      add: (key) => pending.add(key),
      has: (key) => pending.has(key),
      delete: (key) => pending.delete(key),
      clear: () => pending.clear()
    };
  },

  /**
   * Create skeleton loading placeholders
   * @param {string} type - Type of skeleton
   * @param {number} count - Number of skeleton items
   * @returns {DocumentFragment} Fragment containing skeleton elements
   */
  createSkeletons(type, count = 8) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const skeleton = this.createSingleSkeleton(type);
      fragment.appendChild(skeleton);
    }
    return fragment;
  },

  createSingleSkeleton(type) {
    const div = document.createElement('div');
    div.className = 'skeleton';
    div.style.height = '60px';
    return div;
  },

  showSkeletons(container, type, count = 8) {
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(this.createSkeletons(type, count));
  },

  clearSkeletons(container) {
    if (!container) return;
    container.innerHTML = '';
  }
};

// Expose globally
window.uiHelpers = uiHelpers;

// Global error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  const message = event.reason?.message || 'An unexpected error occurred';
  uiHelpers.showToast(message, 'error');
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  uiHelpers.showToast('An unexpected error occurred', 'error');
});

// Initialize reset countdown (demo version - simplified)
document.addEventListener('DOMContentLoaded', () => {
  initResetCountdown();
});

function getTimeUntilReset() {
  const now = new Date();
  const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const resetHour = 6;
  const pstReset = new Date(pstNow);
  pstReset.setHours(resetHour, 0, 0, 0);
  if (pstNow.getHours() >= resetHour) {
    pstReset.setDate(pstReset.getDate() + 1);
  }
  const diffMs = pstReset - pstNow;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, totalMs: diffMs };
}

function formatCountdown({ hours, minutes, seconds }) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function initResetCountdown() {
  const countdownEl = document.getElementById('countdownValue');
  const containerEl = document.getElementById('resetCountdown');
  if (!countdownEl || !containerEl) return;

  function updateCountdown() {
    const time = getTimeUntilReset();
    countdownEl.textContent = formatCountdown(time);
    if (time.totalMs < 60 * 60 * 1000) {
      containerEl.classList.add('countdown-urgent');
    } else {
      containerEl.classList.remove('countdown-urgent');
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}
