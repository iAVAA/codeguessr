/**
 * CodeGuessr - ui.js
 * Toast notification e bottoni di gioco (singleplayer / multiplayer)
 */

// ─── Toast ───────────────────────────────────────────────────────────────────

const TOAST_COLORS = {
  blue: '--darcula-blue',
  green: '--darcula-green',
  orange: '--darcula-orange',
  red: '--darcula-red',
};

/**
 * Mostra una notifica toast temporanea
 * @param {string} message
 * @param {'blue'|'green'|'orange'|'red'} [color='blue']
 */
function showToast(message, color = 'blue') {
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
    window.location.href = '/match';
  });

  document.getElementById('btn-multiplayer')?.addEventListener('click', () => {
    console.log('[CodeGuessr] Starting Multiplayer…');
    showToast('👥 Multiplayer – Creazione stanza…', 'green');
    window.location.href = '/match';
  });
}

const DEMO_PLAYERS = [
  { name: 'MarcoDev', username: 'marcodev', avatarSeed: 'marcodev' },
  { name: 'LunaScript', username: 'lunascript', avatarSeed: 'lunascript' },
  { name: 'PietroC', username: 'pietrocoder', avatarSeed: 'pietrocoder' },
  { name: 'GiuliaBits', username: 'giuliabits', avatarSeed: 'giuliabits' },
  { name: 'AlexLoop', username: 'alexloop', avatarSeed: 'alexloop' },
  { name: 'FedericaByte', username: 'federicabyte', avatarSeed: 'federicabyte' },
  { name: 'NicoStack', username: 'nicostack', avatarSeed: 'nicostack' },
  { name: 'ValeNode', username: 'valenode', avatarSeed: 'valenode' },
];

function buildResultItem(player) {
  const safeName = player.name;
  const safeUsername = player.username;
  const avatar = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(player.avatarSeed)}`;

  return `
    <div class="cg-search-result-item">
      <div class="cg-search-result-user">
        <img class="cg-search-result-avatar" src="${avatar}" alt="Avatar di ${safeName}">
        <div class="cg-search-result-text">
          <span class="cg-search-result-name">${safeName}</span>
          <span class="cg-search-result-username">@${safeUsername}</span>
        </div>
      </div>
      <button class="cg-search-add-btn" data-username="${safeUsername}">
        <i class="bi bi-person-plus"></i>
        Aggiungi
      </button>
    </div>
  `;
}

function renderFriendSearchResults(resultsNode, query) {
  const trimmed = query.trim().toLowerCase();

  if (trimmed.length < 2) {
    resultsNode.innerHTML = '<div class="cg-search-empty">Inizia a digitare per cercare giocatori.</div>';
    return;
  }

  const filtered = DEMO_PLAYERS.filter((player) => {
    return player.name.toLowerCase().includes(trimmed) || player.username.toLowerCase().includes(trimmed);
  });

  if (!filtered.length) {
    resultsNode.innerHTML = '<div class="cg-search-empty">Nessun giocatore trovato con questa ricerca.</div>';
    return;
  }

  resultsNode.innerHTML = filtered.map(buildResultItem).join('');
}

function initAddFriendSearch() {
  const openBtn = document.getElementById('btn-add-friend');
  const overlay = document.getElementById('friend-search-overlay');
  const closeBtn = document.getElementById('friend-search-close');
  const input = document.getElementById('friend-search-input');
  const results = document.getElementById('friend-search-results');

  if (!openBtn || !overlay || !closeBtn || !input || !results) {
    return;
  }

  const openModal = () => {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => input.focus());
    renderFriendSearchResults(results, input.value);
  };

  const closeModal = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    input.value = '';
    results.innerHTML = '';
  };

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) {
      closeModal();
    }
  });

  input.addEventListener('input', () => {
    renderFriendSearchResults(results, input.value);
  });

  results.addEventListener('click', (event) => {
    const addButton = event.target.closest('.cg-search-add-btn');
    if (!addButton) {
      return;
    }

    const username = addButton.dataset.username;
    if (!username) {
      return;
    }

    showToast(`Richiesta inviata a @${username}`, 'green');
    addButton.disabled = true;
    addButton.innerHTML = '<i class="bi bi-check-lg"></i> Inviata';
  });
}

initGameButtons();
initAddFriendSearch();
