// js/ui/Toast.js
// Standardized component builder for toast notifications

const Toast = (() => {
  let toastTimer = null;

  /**
   * Displays a toast notification.
   *
   * @param {string} message - The message to display
   * @param {string} type - The type of toast ('success' or 'error')
   */
  function show(message, type = 'success') {
    let toast = document.getElementById('toast');
    
    // If the page doesn't have a toast container, create one
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = `toast show ${type === 'error' ? 'error' : 'success'}`;
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  return { show };
})();
