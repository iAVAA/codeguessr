/**
 * CodeGuessr - ui.js
 * Toast notification e bottoni di gioco (singleplayer / multiplayer)
 */

// ─── Toast ───────────────────────────────────────────────────────────────────

const TOAST_COLORS = {
  blue:   '--darcula-blue',
  green:  '--darcula-green',
  orange: '--darcula-orange',
  red:    '--darcula-red',
};

/**
 * Mostra una notifica toast temporanea
 * @param {string} message
 * @param {'blue'|'green'|'orange'|'red'} [color='blue']
 */
export function showToast(message, color = 'blue') {
  document.getElementById('cg-toast')?.remove();

  const varName = TOAST_COLORS[color] ?? TOAST_COLORS.blue;

  const toast = Object.assign(document.createElement('div'), { id: 'cg-toast', textContent: message });
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: rgba(var(--darcula-current), 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(var(${varName}), 0.4);
    border-left: 4px solid var(${varName});
    border-radius: 12px;
    padding: 1rem 1.5rem;
    color: rgb(var(--darcula-fg));
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    transform: translateY(20px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── Game Buttons ─────────────────────────────────────────────────────────────

function initGameButtons() {
  document.getElementById('btn-singleplayer')?.addEventListener('click', () => {
    console.log('[CodeGuessr] Starting Single Player…');
    showToast('🎮 Single Player – Caricamento partita…', 'blue');
    // TODO: navigare alla partita singleplayer
  });

  document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
    console.log('[CodeGuessr] Starting Multiplayer…');
    showToast('👥 Multiplayer – Creazione stanza…', 'green');
    // TODO: navigare alla lobby multiplayer
  });
}

initGameButtons();
