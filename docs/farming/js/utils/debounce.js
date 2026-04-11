/**
 * Debounce Utility
 * Delays function execution until after wait period
 */

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Wait time in milliseconds (default: 150)
 * @returns {Function} Debounced function
 */
function debounce(fn, delay = 150) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Expose to window for non-module scripts
window.debounce = debounce;
