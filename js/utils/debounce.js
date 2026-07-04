// js/utils/debounce.js
// Returns a debounced version of a function that only fires after
// the specified delay has passed since the last call.
// Used for search input to prevent re-rendering on every keypress.

/**
 * Debounce a function call.
 * @param {Function} fn - Function to debounce.
 * @param {number} delay - Milliseconds to wait after last call.
 * @returns {Function} - Debounced function.
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
