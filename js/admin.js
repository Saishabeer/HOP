// admin.js
// Handles ONLY the admin login form on admin.html.
//
// Flow:
//   1. If a valid token already exists in sessionStorage → redirect straight to
//      index.html where admin-controls.js will activate the inline edit overlay.
//   2. Otherwise, show the login form.
//   3. On successful login, store the token and redirect to index.html.
//
// All product CRUD (add/edit/delete) is handled by js/admin-controls.js
// via the inline overlay on the storefront — NOT here.

// --- STATE ---
let sessionToken = sessionStorage.getItem('admin_token');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// --- INITIALIZATION ---
function init() {
  const loginSection = document.getElementById('login-section');
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('admin-password');
  const toast = document.getElementById('toast');

  // Guard: if elements are missing the page HTML is out of sync
  if (!loginSection || !loginBtn || !passwordInput) {
    console.error('[Admin] Required DOM elements missing from admin.html');
    return;
  }

  // If already authenticated, go straight to the storefront admin overlay
  if (sessionToken) {
    window.location.href = 'index.html';
    return;
  }

  // Show login form
  loginSection.style.display = 'block';

  // Bind login triggers
  loginBtn.addEventListener('click', login);
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
}

// --- AUTHENTICATION ---
async function login() {
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('login-btn');
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!password) {
    showToast('Please enter the admin password.', 'error');
    return;
  }

  // Disable button to prevent double-submit
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';
  }

  try {
    const response = await fetch(CONFIG.AUTH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      sessionStorage.setItem('admin_token', data.token);
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } else {
      showToast(data.error || 'Incorrect password. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[Admin] Login request failed:', error);
    showToast('Connection error. Check that the Netlify function is running.', 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  }
}

// --- TOAST (standalone — admin.html has no cart.js) ---
function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type === 'error' ? 'error' : 'success'}`;
  clearTimeout(window._adminToastTimer);
  window._adminToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}
