/*
    FILE: ui.js
    DESCRIPTION: Gestore globale dell'interfaccia utente, notifiche toast e ricerca amici.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { showToast, debounce } from '../utils/ui_utils.js';
import { fetchPlayerAmici, handleFriendAction } from './friends.js';

// Espone showToast globalmente per compatibilità con script non-modulo
window.showToast = showToast;

/**
 * Stato locale per le relazioni dell'utente (usato per la ricerca amici).
 * Mappa: username -> { stato: 'amici'|'inviata'|'ricevuta', userid: string }
 */
let relazioniUtente = {};

/* Carica le relazioni attuali dell'utente per popolare il lookup della ricerca */
async function caricaRelazioni() {
    try {
        const data = await fetchPlayerAmici();
        relazioniUtente = {};

        // Trasforma le liste del manager in un oggetto di lookup per nome utente
        data.amici.forEach(u => relazioniUtente[u.name] = { stato: 'amici', userid: u.userid });
        data.inviate.forEach(u => relazioniUtente[u.name] = { stato: 'inviata', userid: u.userid });
        data.ricevute.forEach(u => relazioniUtente[u.name] = { stato: 'ricevuta', userid: u.userid });

    } catch (err) {
        console.warn("[ui.js] Impossibile caricare relazioni per la ricerca:", err);
    }
}

/* Costruisce l'elemento HTML per un giocatore trovato nella ricerca */
function buildResultItem(player) {
    const { user: name, userid: id, avatar_url } = player;
    const avatar = avatar_url || `/src/assets/img/user_profile.webp`;

    const relazione = relazioniUtente[name];
    const stato = relazione?.stato || 'nessuno';

    let buttonHTML = '';

    // Logica dei bottoni basata sullo stato della relazione
    if (stato === 'amici') {
        buttonHTML = `<button class="cg-search-add-btn is-disabled" disabled><i class="bi bi-person-check"></i> Amici</button>`;
    } else if (stato === 'inviata') {
        buttonHTML = `<button class="cg-search-add-btn is-disabled" disabled><i class="bi bi-clock"></i> Inviata</button>`;
    } else if (stato === 'ricevuta') {
        buttonHTML = `
            <div class="d-flex gap-2">
                <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${id}">
                    <i class="bi bi-check-lg"></i> Accetta
                </button>
                <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${id}">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `;
    } else {
        buttonHTML = `
            <button class="cg-search-add-btn" data-action="aggiungi" data-username="${name}" data-userid="${id}">
                <i class="bi bi-person-plus"></i> Aggiungi
            </button>
        `;
    }

    return `
        <div class="cg-search-result-item">
            <div class="cg-search-result-user">
                <img class="cg-search-result-avatar" src="${avatar}" alt="${name}">
                <div class="cg-search-result-text">
                    <span class="cg-search-result-name">${name}</span>
                    <span class="cg-search-result-username">@${id}</span>
                </div>
            </div>
            ${buttonHTML}
        </div>
    `;
}

/* Esegue la ricerca dei giocatori e renderizza i risultati */
async function renderFriendSearchResults(resultsNode, query) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
        resultsNode.innerHTML = '<div class="cg-search-empty">Inizia a digitare per cercare giocatori...</div>';
        return;
    }

    resultsNode.innerHTML = '<div class="cg-search-loading"><span class="spinner-border spinner-border-sm"></span> Ricerca in corso...</div>';

    try {
        const response = await fetch(`/api/search/${encodeURIComponent(trimmed)}`);
        if (!response.ok) throw new Error('Ricerca fallita');

        const filtered = await response.json();
        if (!filtered || !filtered.length) {
            resultsNode.innerHTML = '<div class="cg-search-empty">Nessun giocatore trovato.</div>';
            return;
        }

        resultsNode.innerHTML = filtered.map(buildResultItem).join('');
    } catch (error) {
        resultsNode.innerHTML = '<div class="cg-search-empty">Errore durante la ricerca.</div>';
    }
}

/* Inizializza il modal di ricerca amici */
function initAddFriendSearch() {
    // SCARICA LE AMICIZIE SUBITO ALL'AVVIO DELLA PAGINA!
    caricaRelazioni();

    const openBtn = document.getElementById('btn-add-friend');
    const modalEl = document.getElementById('friendSearchModal');  // ← nuovo ID
    const input   = document.getElementById('friend-search-input');
    const results = document.getElementById('friend-search-results');

    if (!openBtn || !modalEl || !input || !results) {
        console.error("ATTENZIONE: Un elemento HTML per la ricerca amici non è stato trovato!");
        return;
    }

    // Bootstrap si occupa di backdrop, ESC e chiusura — noi usiamo la sua API
    const bsModal = new bootstrap.Modal(modalEl);

    openBtn.addEventListener('click', () => {
        results.innerHTML = '<div class="cg-search-empty">Inizia a digitare per cercare giocatori.</div>';
        bsModal.show();
    });

    // Quando Bootstrap finisce di aprire il modal → mettiamo il focus sull'input
    modalEl.addEventListener('shown.bs.modal', () => {
        input.focus();
    });

    // Quando Bootstrap chiude il modal → resettiamo input e risultati
    modalEl.addEventListener('hidden.bs.modal', () => {
        input.value = '';
        results.innerHTML = '';
    });

    const debouncedSearch = debounce((query) => {
        renderFriendSearchResults(results, query);
    }, 300);

    input.addEventListener('input', () => {
        debouncedSearch(input.value);
    });

    // Gestione click sulle azioni della ricerca (Aggiungi/Accetta/Rifiuta)
    results?.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action]');
        if (!btn || btn.disabled) return;

        const { action, userid, username } = btn.dataset;
        if (!action || !userid) return;

        // Se l'azione è "aggiungi", usiamo una fetch locale
        // Altrimenti usiamo il manager centralizzato per accetta/rifiuta
        if (action === 'aggiungi') {
            await handleAddFriend(btn, userid, username);
        } else {
            await handleFriendAction(btn, action, userid, async () => {
                await caricaRelazioni(); // Aggiorna lookup locale
                renderFriendSearchResults(results, input.value); // Rinfresca i risultati
                // Nota: loadPlayerData viene chiamato internamente se passato come callback in profile.js
                // Qui però siamo nel popup di ricerca, quindi forziamo un refresh dei risultati.
            });
        }
    });
}

/* Gestisce l'invio di una nuova richiesta di amicizia */
async function handleAddFriend(btn, userid, username) {
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const token = localStorage.getItem('supabaseToken');
        const res = await fetch(`/api/invia-richiesta/${userid}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error("Errore nell'invio della richiesta");

        showToast(`Richiesta inviata a @${username}`, 'green');
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Inviata';
        relazioniUtente[username] = { stato: 'inviata', userid };
    } catch (err) {
        showToast(err.message, 'red');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ===== INIZIALIZZAZIONE GENERALE =====

document.addEventListener('DOMContentLoaded', () => {
    // Bottone Single Player
    document.getElementById('btn-singleplayer')?.addEventListener('click', () => {
        setTimeout(() => window.location.href = '/match', 500);
    });

    // Inizializza ricerca amici
    initAddFriendSearch();

    // Click sul nome di un amico per andare al profilo
    document.addEventListener('click', (event) => {
        const nameEl = event.target.closest('.friend-name') || event.target.closest('.cg-search-result-name');
        if (nameEl) {
            const name = nameEl.textContent.trim();
            if (name) window.location.href = `/profilo/${encodeURIComponent(name)}`;
        }
    });
});