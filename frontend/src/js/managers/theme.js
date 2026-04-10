/**
 * CodeGuessr - theme.js
 * Gestisce il toggle tema chiaro/scuro con preferenza persistente
 */

const THEME_KEY = 'codeguessr-theme';
const html = document.documentElement;

function applyTheme(theme) {
  html.classList.toggle('light-mode', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(html.classList.contains('light-mode') ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    applyTheme('light');
  } else {
    applyTheme('dark');
  }

  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
}

initTheme();
