// js/theme.js - Light/Dark theme toggle
// The actual color swap happens via CSS custom properties in tokens.css
// ([data-theme="dark"] block + a prefers-color-scheme fallback for visitors
// who haven't toggled yet). This file only: reflects the effective theme on
// the toggle button's icon, persists an explicit choice to localStorage, and
// applies it. A tiny inline script in each page's <head> (see theme-init.js
// snippet) sets the attribute before first paint to avoid a flash of the
// wrong theme -- this file takes over from there for the interactive part.

const Theme = (() => {
  const STORAGE_KEY = 'hop_theme';

  function getEffective() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'dark' || explicit === 'light') return explicit;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  function updateButtons() {
    const isDark = getEffective() === 'dark';
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.classList.toggle('is-dark', isDark);
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      logger.warn('[Theme]', 'Failed to save preference:', e);
    }
    updateButtons();
  }

  function toggle() {
    apply(getEffective() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { toggle, apply, getEffective };
})();
