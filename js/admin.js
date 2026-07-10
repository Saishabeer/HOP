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
    // Add a small visual delay and alert so the user understands what is happening
    loginSection.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="color: var(--primary-rose); margin-bottom: 1rem;">Admin Session Active</h2>
        <p style="color: var(--warm-gray); margin-bottom: 2rem;">You are already logged in!</p>
        <p>Redirecting you to the <strong>Storefront Inline Editor</strong>...</p>
      </div>
    `;
    loginSection.style.display = 'block';
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2500);
    return;
  }

  // Show login form
  loginSection.style.display = 'block';

  // Bind login triggers
  loginBtn.addEventListener('click', login);
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });

  // Show/hide password toggle
  const toggleBtn = document.getElementById('toggle-password-visibility');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      toggleBtn.querySelector('.eye-open').style.display = isHidden ? 'none' : 'block';
      toggleBtn.querySelector('.eye-closed').style.display = isHidden ? 'block' : 'none';
      toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  }
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

    if (response.status === 404) {
      showToast('Login service not found. If testing locally, restart your dev server (node dev-server.js).', 'error');
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch(e) {
      showToast('Unexpected response from the server. Please try again shortly.', 'error');
      return;
    }

    if (response.ok && data.success) {
      sessionStorage.setItem('admin_token', data.token);
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } else if (data.error && data.error !== 'Incorrect password') {
      // Surface server-side errors (e.g. "Server misconfiguration") as-is
      showToast(data.error, 'error');
    } else {
      showToast('Wrong password. Please check and try again.', 'error');
    }
  } catch (error) {
    console.error('[Admin] Login request failed:', error);
    showToast('Connection error. Please check your internet connection and try again.', 'error');
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
