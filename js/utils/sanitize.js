// js/utils/sanitize.js
// Escapes user-controlled strings before insertion into innerHTML.
// Prevents stored XSS when product names/descriptions come from Google Sheets.

/**
 * Escapes HTML special characters in a string.
 * @param {any} value - Value to sanitize. Non-strings are cast first.
 * @returns {string} - Safe string with all HTML entities encoded.
 */
function sanitize(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
