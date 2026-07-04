// js/utils/logger.js
// Development-aware logger. Logs are silenced automatically on production
// (any hostname that is not localhost or 127.0.0.1).
// Use logger.log / logger.warn / logger.error instead of console.* directly.

const logger = (() => {
  const isDev = (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === ''
  );

  return {
    /**
     * @param {string} tag - Short label, e.g. '[API]', '[Cart]'
     * @param {string} msg - Stable log message string
     * @param {...any} data - Low-cardinality contextual data
     */
    log(tag, msg, ...data) {
      if (isDev) console.log(tag, msg, ...data);
    },
    warn(tag, msg, ...data) {
      if (isDev) console.warn(tag, msg, ...data);
    },
    error(tag, msg, ...data) {
      // Errors always log — even in production — for diagnostics
      console.error(tag, msg, ...data);
    }
  };
})();
