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
        if (data.amici) data.amici.forEach(u => relazioniUtente[u.user] = {stato: 'amici', userid: u.userid});
        if (data.inviate) data.inviate.forEach(u => relazioniUtente[u.user] = {stato: 'inviata', userid: u.userid});
        if (data.ricevute) data.ricevute.forEach(u => relazioniUtente[u.user] = {stato: 'ricevuta', userid: u.userid});

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
    const safeName = player.user;
    const safeUserId = player.userid;
    
    
    const avatar = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(player.avatarSeed)}`;

    // Controlliamo lo stato dalla nostra memoria
    const stato = relazioniUtente[safeName]?.stato || 'nessuno';
    const userid = relazioniUtente[safeName]?.userid || null;

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
    // Se abbiamo ricevuto la richiesta, mostriamo DUE bottoni con azioni diverse!
        buttonHTML = `
        <div style="display: flex; gap: 8px;">
            <button class="cg-search-add-btn" data-action="accetta" data-username="${safeName}" data-userid="${safeUserId}" style="background-color: #198754; color: white; border-color: #198754;">
                <i class="bi bi-check-circle"></i> Accetta
            </button>
            <button class="cg-search-add-btn" data-action="rifiuta" data-username="${safeName}" data-userid="${safeUserId}" style="background-color: #dc3545; color: white; border-color: #dc3545;">
                <i class="bi bi-x-circle"></i> Rifiuta
            </button>
        </div>
        `;
  } else {
        // Bottone "Aggiungi" standard
        buttonHTML = `
        <button class="cg-search-add-btn" data-action="aggiungi" data-username="${safeName}" data-userid="${safeUserId}">
            <i class="bi bi-person-plus"></i> Aggiungi
        </button>
        `;
  }

    return `
        <div class="cg-search-result-item">
            <div class="cg-search-result-user">
                <img class="cg-search-result-avatar" src="${avatar}" alt="Avatar di ${safeName}">
                <div class="cg-search-result-text">
                    <span class="cg-search-result-name">${safeName}</span>
                    <span class="cg-search-result-username">@${safeUserId}</span>
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
    // Gestione dei click sui tasti Aggiungi, Accetta o Rifiuta
    results.addEventListener('click', async (event) => {
      // Ora cerchiamo qualsiasi bottone che abbia la classe o un data-action
      const actionButton = event.target.closest('button[data-action]');
      
      if (!actionButton || actionButton.disabled) return;

      const action = actionButton.dataset.action; // 'aggiungi', 'accetta' o 'rifiuta'
      const username = actionButton.dataset.username;
      const userid = actionButton.dataset.userid; 
      
      if (!username || !userid) return;

      const originalHTML = actionButton.innerHTML;
      actionButton.disabled = true;

      try {
            const token = localStorage.getItem('supabaseToken');
            if (!token) throw new Error("Devi essere loggato per gestire le amicizie.");

            // Scegliamo l'URL giusto per il server in base all'azione
            // Scegliamo l'URL e il METODO giusti in base all'azione
            let apiUrl = '';
            let apiMethod = 'POST'; // Metodo di default

            if (action === 'aggiungi') {
                apiUrl = `/api/invia-richiesta/${userid}`;
                apiMethod = 'POST';
            } else if (action === 'accetta') {
                apiUrl = `/api/accetta-richiesta/${userid}`;
                // Controlla nel tuo server: se hai usato app.put usa 'PUT', se hai usato app.post lascia 'POST'
                apiMethod = 'PUT'; 
            } else if (action === 'rifiuta') {
                apiUrl = `/api/rifiuta-richiesta/${userid}`;
                apiMethod = 'DELETE'; // <-- Ecco la magia che fa combaciare frontend e backend!
            }

            // Cambiamo il testo visivo mentre carichiamo
            actionButton.innerHTML = action === 'aggiungi' ? '<i class="bi bi-hourglass"></i> Invio...' : '<i class="bi bi-hourglass"></i>...';

            // CHIAMATA AL SERVER
            const response = await fetch(apiUrl, {
                method: apiMethod, // <-- Usiamo la variabile dinamica invece di scriverlo fisso!
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.errore || "Errore durante l'operazione");

            // SUCCESS! Cambiamo il bottone e la memoria in base a cosa abbiamo fatto
            if (action === 'aggiungi') {
                if (typeof showToast === 'function') showToast(`Richiesta inviata a @${username}`, 'green');
                actionButton.innerHTML = '<i class="bi bi-check-lg"></i> Inviata';
                relazioniUtente[userid] = 'inviata';
            } 
            else if (action === 'accetta') {
              if (typeof showToast === 'function') showToast(`Ora sei amico con @${username}!`, 'green');
              
              // 1. Aggiorniamo il bottone nel popup di ricerca
              const container = actionButton.closest('div'); 
              if (container) {
                  container.innerHTML = '<button class="cg-search-add-btn" disabled style="opacity: 0.6; cursor: not-allowed;"><i class="bi bi-person-check"></i> Amici</button>';
              }
              relazioniUtente[userid] = 'amici';

              // 2. AGGIUNGIAMO L'AMICO ALLA LISTA LATERALE (FRONTEND)
              // Cerchiamo il contenitore esatto usando la classe che mi hai fornito
              const listaAmiciContainer = document.querySelector('.friends-list'); 
              
              if (listaAmiciContainer) {
                  // Generiamo l'avatar usando l'ID dell'utente, esattamente come nel tuo HTML originale
                  const avatarAmico = `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(userid)}&backgroundColor=1e1f21`;

                  // Costruiamo il blocco HTML del nuovo amico copiando la tua struttura perfetta
                  const nuovoAmicoHTML = `
                    <div class="side-item friend-item" bis_skin_checked="1">
                      <div class="friend-info" bis_skin_checked="1">
                        <div class="friend-avatar-wrapper" bis_skin_checked="1">
                          <img src="${avatarAmico}" alt="${username}" class="friend-avatar">
                          <div class="status-dot online" bis_skin_checked="1"></div>
                        </div>
                        <div class="friend-details" bis_skin_checked="1">
                          <span class="friend-name">${username}</span>
                          <span class="friend-status-text text-darcula-green">Online</span>
                        </div>
                      </div>
                      <button class="btn-challenge" aria-label="Sfida ${username}"><i class="bi bi-swords"></i> Sfida</button>
                    </div>
                  `;

                  // Incolliamo l'amico in fondo alla lista!
                  listaAmiciContainer.insertAdjacentHTML('beforeend', nuovoAmicoHTML);

                  // BONUS OPZIONALE: Aggiorniamo anche il contatore numerico in alto (se vuoi)!
                  const badgeOnline = document.getElementById('friends-online-badge');
                  if (badgeOnline) {
                      // Estraiamo il numero attuale, aggiungiamo 1 e aggiorniamo il testo
                      const numeroAttuale = parseInt(badgeOnline.innerText) || 0;
                      badgeOnline.innerText = `${numeroAttuale + 1} Online`;
                  }
              }
            }
            else if (action === 'rifiuta') {
                if (typeof showToast === 'function') showToast(`Richiesta rifiutata.`, 'gray');
                // Se rifiutiamo, riportiamo il bottone allo stato "Aggiungi" normale
                const container = actionButton.closest('div');
                container.innerHTML = `<button class="cg-search-add-btn" data-action="aggiungi" data-username="${username}" data-userid="${userid}"><i class="bi bi-person-plus"></i> Aggiungi</button>`;
                relazioniUtente[userid] = 'nessuno';
            }

      } catch (err) {
          console.error(`Errore nell'azione ${action}:`, err);
          if (typeof showToast === 'function') showToast(err.message, 'red');
          actionButton.disabled = false;
          actionButton.innerHTML = originalHTML; // Ripristina il bottone originale
      }
    });
}

// L'inizio di tutto!
document.addEventListener('DOMContentLoaded', initAddFriendSearch);