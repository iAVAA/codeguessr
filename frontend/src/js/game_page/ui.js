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

// ===== START CUSTOM: ADD FRIEND SEARCH (btn-add-friend) =====

let relazioniUtente = {};

// 1. Funzione per caricare le relazioni dell'utente e popolare l'oggetto di lookup
async function caricaRelazioni() {
    try {
        const token = localStorage.getItem('supabaseToken');

        if (!token) {
            console.warn("Utente non loggato, nessun token trovato.");
            return;
        }

        const response = await fetch('/api/mie-amicizie', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Standard di sicurezza web (Bearer Token)
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) throw new Error("Errore di autorizzazione dal server");

        const data = await response.json();

        // Puliamo l'oggetto per sicurezza
        relazioniUtente = {};

        // Riempiamo l'oggetto di lookup (controlliamo prima che gli array esistano)
        if (data.amici) data.amici.forEach(u => relazioniUtente[u.user] = 'amici');
        if (data.inviate) data.inviate.forEach(u => relazioniUtente[u.user] = 'inviata');
        if (data.ricevute) data.ricevute.forEach(u => relazioniUtente[u.user] = 'ricevuta');

        console.log("I MIEI DATI REALI SONO:", relazioniUtente);
    } catch (err) {
        console.error("Errore nel caricamento relazioni:", err);
    }
}

// 2. Funzione di utilità: Debounce (ritarda la chiamata al server mentre l'utente digita)
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// 3. Costruzione della UI del singolo giocatore trovato
function buildResultItem(player) {
    const safeName = player.name;
    const safeUsername = player.username;
    
    // Recuperiamo l'ID del giocatore (assicurati che il backend lo mandi come 'userid' o 'id_giocatore')
    const idCercato = player.userid; 
    
    const avatar = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(player.avatarSeed)}`;

    // Controlliamo lo stato dalla nostra memoria
    const stato = relazioniUtente[idCercato] || 'nessuno';

    let buttonHTML = '';

    if (stato === 'amici') {
        buttonHTML = `
            <button class="cg-search-add-btn" disabled style="opacity: 0.6; cursor: not-allowed;">
                <i class="bi bi-person-check"></i>
                Amici
            </button>
        `;
    } else if (stato === 'inviata') {
        buttonHTML = `
            <button class="cg-search-add-btn" disabled style="opacity: 0.6; cursor: not-allowed;">
                <i class="bi bi-clock"></i>
                Inviata
            </button>
        `;
    } else if (stato === 'ricevuta') {
        buttonHTML = `
            <button class="cg-search-add-btn" data-username="${safeUsername}" data-userid="${idCercato}">
                <i class="bi bi-check-circle"></i>
                Accetta
            </button>
        `;
    } else {
        buttonHTML = `
            <button class="cg-search-add-btn" data-username="${safeUsername}" data-userid="${idCercato}">
                <i class="bi bi-person-plus"></i>
                Aggiungi
            </button>
        `;
    }

    return `
        <div class="cg-search-result-item">
            <div class="cg-search-result-user">
                <img class="cg-search-result-avatar" src="${avatar}" alt="Avatar di ${safeName}">
                <div class="cg-search-result-text">
                    <span class="cg-search-result-name">${safeName}</span>
                    <span class="cg-search-result-username">@${safeUsername}</span>
                </div>
            </div>
            ${buttonHTML}
        </div>
    `;
}

// 4. Funzione asincrona per cercare i giocatori
async function renderFriendSearchResults(resultsNode, query) {
    const trimmed = query.trim().toLowerCase();

    if (trimmed.length < 2) {
        resultsNode.innerHTML = '<div class="cg-search-empty">Inizia a digitare per cercare giocatori.</div>';
        return;
    }

    resultsNode.innerHTML = '<div class="cg-search-loading">Caricamento...</div>';

    try {
        const response = await fetch(`/api/search/${encodeURIComponent(trimmed)}`);
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const filtered = await response.json();

        if (!filtered || !filtered.length) {
            resultsNode.innerHTML = '<div class="cg-search-empty">Nessun giocatore trovato con questa ricerca.</div>';
            return;
        }

        resultsNode.innerHTML = filtered.map(buildResultItem).join('');

    } catch (error) {
        console.error('Errore durante la ricerca dei giocatori:', error);
        resultsNode.innerHTML = '<div class="cg-search-empty">Si è verificato un errore durante la ricerca. Riprova più tardi.</div>';
    }
}

// 5. Inizializzazione degli eventi
function initAddFriendSearch() {
    // 🚀 SCARICA LE AMICIZIE SUBITO ALL'AVVIO DELLA PAGINA!
    caricaRelazioni();

    const openBtn = document.getElementById('btn-add-friend');
    const overlay = document.getElementById('friend-search-overlay');
    const closeBtn = document.getElementById('friend-search-close');
    const input = document.getElementById('friend-search-input');
    const results = document.getElementById('friend-search-results');

    if (!openBtn || !overlay || !closeBtn || !input || !results) {
        console.error("ATTENZIONE: Un elemento HTML per la ricerca amici non è stato trovato!");
        return;
    }

    const openModal = () => {
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => input.focus());
        results.innerHTML = '<div class="cg-search-empty">Inizia a digitare per cercare giocatori.</div>';
    };

    const closeModal = () => {
        // Togliamo il focus prima di chiudere (risolve il warning di Chrome)
        if (document.activeElement) document.activeElement.blur(); 
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        input.value = '';
        results.innerHTML = '';
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('open')) {
            closeModal();
        }
    });

    const debouncedSearch = debounce((query) => {
        renderFriendSearchResults(results, query);
    }, 300);

    input.addEventListener('input', () => {
        debouncedSearch(input.value);
    });

    // Gestione dei click sui tasti "Aggiungi" o "Accetta"
    results.addEventListener('click', (event) => {
        const addButton = event.target.closest('.cg-search-add-btn');
        // Se si clicca fuori dal tasto o se il tasto è già disabilitato, non fare niente
        if (!addButton || addButton.disabled) return;

        const username = addButton.dataset.username;
        const userid = addButton.dataset.userid; 
        
        if (!username) return;

        // Feedback per l'utente
        if (typeof showToast === 'function') {
            showToast(`Richiesta inviata a @${username}`, 'green');
        } else {
            alert(`Richiesta inviata a @${username}`);
        }
        
        // Cambiamo il bottone
        addButton.disabled = true;
        addButton.innerHTML = '<i class="bi bi-check-lg"></i> Inviata';

        // Qui, in futuro, andrà la vera chiamata fetch (POST) verso il tuo server
        // per salvare l'amicizia nel database! Es: inviaRichiestaDb(userid);
    });
}

// L'inizio di tutto!
document.addEventListener('DOMContentLoaded', initAddFriendSearch);