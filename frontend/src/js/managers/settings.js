/**
 * CodeGuessr - settings.js
 * Gestisce il modale delle impostazioni (audio, tema, gameplay, notifiche)
 */

const SETTINGS_KEY = 'codeguessr-settings';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  volumeMusic: 60,
  volumeSfx: 80,
  theme: 'dark',
  reducedAnimations: false,
  difficulty: 'normal',
  showTimer: true,
  syntaxHighlight: true,
  notifChallenge: true,
  notifFriends: false,
};

// ─── Persist ─────────────────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[Settings] Impossibile salvare le impostazioni:', e);
  }
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

// ─── Slider ───────────────────────────────────────────────────────────────────

function initSlider(sliderId, valueId, storageKey, settings) {
  const slider = el(sliderId);
  const valueEl = el(valueId);
  if (!slider || !valueEl) return;

  slider.value = settings[storageKey];
  valueEl.textContent = `${settings[storageKey]}%`;

  // Live gradient fill
  function updateFill() {
    const pct = slider.value;
    slider.style.background = `linear-gradient(to right, rgb(var(--darcula-blue, 104,151,187)) 0%, rgb(var(--darcula-blue, 104,151,187)) ${pct}%, rgba(var(--darcula-comment,128,128,128),0.25) ${pct}%, rgba(var(--darcula-comment,128,128,128),0.25) 100%)`;
    valueEl.textContent = `${pct}%`;
  }

  updateFill();
  slider.addEventListener('input', updateFill);
}

// ─── Theme Picker ─────────────────────────────────────────────────────────────

function initThemePicker(settings) {
  const picker = el('theme-picker');
  if (!picker) return;

  const btns = picker.querySelectorAll('.cg-theme-btn');
  btns.forEach(btn => {
    const isActive = btn.dataset.theme === settings.theme;
    btn.setAttribute('aria-pressed', String(isActive));
  });

  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('.cg-theme-btn');
    if (!btn) return;
    btns.forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    applyTempTheme(btn.dataset.theme);
  });
}

function applyTempTheme(theme) {
  const html = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('light-mode', !prefersDark);
  } else {
    html.classList.toggle('light-mode', theme === 'light');
  }
}

// ─── Difficulty Picker ────────────────────────────────────────────────────────

function initDifficultyPicker(settings) {
  const picker = el('difficulty-picker');
  if (!picker) return;

  const btns = picker.querySelectorAll('.cg-diff-btn');
  btns.forEach(btn => {
    const isActive = btn.dataset.diff === settings.difficulty;
    btn.setAttribute('aria-pressed', String(isActive));
  });

  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('.cg-diff-btn');
    if (!btn) return;
    btns.forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
  });
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function initToggle(id, settingKey, settings) {
  const input = el(id);
  if (!input) return;
  input.checked = settings[settingKey];
}

// ─── Read State from DOM ──────────────────────────────────────────────────────

function readCurrentSettings() {
  const getSlider = (id) => parseInt(el(id)?.value ?? 0, 10);
  const getToggle = (id) => el(id)?.checked ?? false;
  const getPicker = (pickerId, attr) => {
    const active = document.querySelector(`#${pickerId} [aria-pressed="true"]`);
    return active?.dataset[attr] ?? null;
  };

  return {
    volumeMusic: getSlider('volume-music'),
    volumeSfx: getSlider('volume-sfx'),
    theme: getPicker('theme-picker', 'theme') ?? 'dark',
    reducedAnimations: getToggle('toggle-animations'),
    difficulty: getPicker('difficulty-picker', 'diff') ?? 'normal',
    showTimer: getToggle('toggle-timer'),
    syntaxHighlight: getToggle('toggle-syntax'),
    notifChallenge: getToggle('toggle-notif-challenge'),
    notifFriends: getToggle('toggle-notif-friends'),
  };
}

// ─── Apply Theme ──────────────────────────────────────────────────────────────

function applyThemeSetting(theme) {
  const html = document.documentElement;
  const THEME_KEY = 'codeguessr-theme';
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('light-mode', !prefersDark);
    localStorage.removeItem(THEME_KEY);
  } else {
    html.classList.toggle('light-mode', theme === 'light');
    localStorage.setItem(THEME_KEY, theme);
  }
}

// ─── Modal Open / Close ───────────────────────────────────────────────────────

function openSettings() {
  const overlay = el('settings-overlay');
  if (!overlay) return;
  overlay.removeAttribute('aria-hidden');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  el('settings-close')?.focus();
}

function revertUnsavedSettings() {
  const current = loadSettings();
  initSlider('volume-music', 'volume-music-val', 'volumeMusic', current);
  initSlider('volume-sfx', 'volume-sfx-val', 'volumeSfx', current);

  document.querySelectorAll('#theme-picker .cg-theme-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.theme === current.theme));
  });
  document.querySelectorAll('#difficulty-picker .cg-diff-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.diff === current.difficulty));
  });

  ['toggle-animations', 'toggle-timer', 'toggle-syntax', 'toggle-notif-challenge', 'toggle-notif-friends'].forEach(id => {
    const map = {
      'toggle-animations': 'reducedAnimations',
      'toggle-timer': 'showTimer',
      'toggle-syntax': 'syntaxHighlight',
      'toggle-notif-challenge': 'notifChallenge',
      'toggle-notif-friends': 'notifFriends',
    };
    const input = el(id);
    if (input) input.checked = current[map[id]];
  });

  applyThemeSetting(current.theme);
}

function closeSettings() {
  const overlay = el('settings-overlay');
  if (!overlay) return;
  revertUnsavedSettings();
  overlay.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initSettings() {
  const settings = loadSettings();

  // Populate controls
  initSlider('volume-music', 'volume-music-val', 'volumeMusic', settings);
  initSlider('volume-sfx', 'volume-sfx-val', 'volumeSfx', settings);
  initThemePicker(settings);
  initDifficultyPicker(settings);
  initToggle('toggle-animations', 'reducedAnimations', settings);
  initToggle('toggle-timer', 'showTimer', settings);
  initToggle('toggle-syntax', 'syntaxHighlight', settings);
  initToggle('toggle-notif-challenge', 'notifChallenge', settings);
  initToggle('toggle-notif-friends', 'notifFriends', settings);

  // Open via menu
  el('menu-btn-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Close dropdown if open
    document.getElementById('profile-dropdown-wrapper')?.classList.remove('active');
    openSettings();
  });

  // Close button
  el('settings-close')?.addEventListener('click', closeSettings);

  // Click outside modal
  el('settings-overlay')?.addEventListener('click', (e) => {
    if (e.target === el('settings-overlay')) closeSettings();
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('settings-overlay')?.classList.contains('open')) {
      closeSettings();
    }
  });

  // Save button
  el('settings-save')?.addEventListener('click', () => {
    const current = readCurrentSettings();
    saveSettings(current);
    applyThemeSetting(current.theme);
    closeSettings();

    // Show toast if available
    if (typeof showToast === 'function') {
      showToast('✅ Impostazioni salvate', 'green');
    }
  });

  // Cancel button
  el('settings-cancel')?.addEventListener('click', () => {
    closeSettings();
  });

  // Delete Profile button
  el('btn-delete-profile')?.addEventListener('click', () => {
    if (confirm("Sei sicuro di voler eliminare definitivamente il tuo profilo? Questa azione non può essere annullata.")) {
      alert("Il profilo è stato eliminato con successo. (Mockup)");
      localStorage.removeItem('isLoggedIn');
      window.location.replace('/index.html');
    }
  });
}

initSettings();
