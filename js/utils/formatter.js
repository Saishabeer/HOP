// js/utils/formatter.js
// Standardized formatting logic

const Formatter = (() => {
  function currency(amount) {
    if (typeof CONFIG !== 'undefined' && CONFIG.CURRENCY) {
      return `${CONFIG.CURRENCY}${Number(amount).toFixed(2).replace(/\\.00$/, '')}`;
    }
    return `Rs.${Number(amount).toFixed(2).replace(/\\.00$/, '')}`;
  }

  function date(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }

  return {
    currency,
    date
  };
})();
