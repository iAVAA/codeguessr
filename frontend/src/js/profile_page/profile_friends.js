/*
    FILE: profile_friends.js
    DESCRIPTION: Gestisce il rendering della lista amici e le azioni di amicizia nella pagina profilo.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { fetchAuth } from '../managers/auth.js';
import { showToast } from '../utils/ui_utils.js';

// ─── Azioni di Amicizia (globale per onclick inline) ─────────────────────────

/**
 * Esegue un'azione di amicizia chiamando il backend e ricaricando la pagina.
 * Esposta su window per compatibilità con gli onclick inline generati dinamicamente.
 * @param {'aggiungi'|'accetta'|'rifiuta'|'annulla'|'rimuovi'} action
 * @param {string} targetUserId
 */
window.handleProfileFriendAction = async function (action, targetUserId) {
    const ROUTES = {
        aggiungi: { url: `/api/invia-richiesta/${targetUserId}`,   method: 'POST'   },
        accetta:  { url: `/api/accetta-richiesta/${targetUserId}`, method: 'PUT'    },
        rifiuta:  { url: `/api/rifiuta-richiesta/${targetUserId}`, method: 'DELETE' },
        annulla:  { url: `/api/rifiuta-richiesta/${targetUserId}`, method: 'DELETE' },
        rimuovi:  { url: `/api/rifiuta-richiesta/${targetUserId}`, method: 'DELETE' },
    };

    const route = ROUTES[action];
    if (!route) return;

    try {
        const res = await fetchAuth(route.url, { method: route.method });
        if (!res.ok) throw new Error("Errore durante l'azione");
        window.location.reload();
    } catch (err) {
        console.error('[profile_friends] Errore azione amicizia:', err);
    }
};

// ─── Template Builder ─────────────────────────────────────────────────────────

/* Costruisce l'HTML di un singolo elemento della lista amici */
function buildFriendHTML(friend) {
    const { userid, name, avatar, online, type } = friend;

    let filterStyle = '';
    let statusClass = 'offline';
    let textClass   = 'text-darcula-comment';
    let statusText  = '';
    let rightContent = '';

    if (type === 'amico') {
        filterStyle  = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
        statusClass  = online ? 'online' : 'offline';
        textClass    = online ? 'text-darcula-green' : 'text-darcula-comment';
        statusText   = online ? 'Online' : 'Offline';
        rightContent = online
            ? `<button class="profile-btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> <span>Sfida</span></button>`
            : '';
    } else if (type === 'ricevuta') {
        statusClass  = 'online';
        textClass    = 'text-warning';
        statusText   = 'Nuova richiesta';
        rightContent = `
            <div class="d-flex gap-2">
                <button class="profile-action-btn profile-action-btn--success" data-action="accetta" data-username="${name}" data-userid="${userid}" title="Accetta"><i class="bi bi-check-lg"></i></button>
                <button class="profile-action-btn profile-action-btn--danger"  data-action="rifiuta" data-username="${name}" data-userid="${userid}" title="Rifiuta"><i class="bi bi-x-lg"></i></button>
            </div>`;
    } else if (type === 'inviata') {
        statusText   = 'In attesa...';
        rightContent = `<button class="profile-action-btn profile-action-btn--muted" disabled><i class="bi bi-clock"></i></button>`;
    }

    return `
    <div class="profile-side-item profile-friend-item ${type === 'amico' && !online ? 'profile-offline-item' : ''}" id="sidebar-rel-${userid}">
        <div class="profile-friend-info">
            <div class="profile-friend-avatar-wrapper">
                <img src="${avatar}" alt="${name}" class="profile-friend-avatar" ${filterStyle}>
                <div class="profile-status-dot ${statusClass}"></div>
            </div>
            <div class="profile-friend-details">
                <span class="profile-friend-name">${name}</span>
                <span class="profile-friend-status-text ${textClass}">${statusText}</span>
            </div>
        </div>
        ${rightContent}
    </div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

/* Inietta la lista degli amici nel contenitore della sidebar */
export function renderFriends(friends) {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = `
            <div class="profile-empty-state">
                <i class="bi bi-people"></i>
                Nessun amico ancora.
                <small>Aggiungi qualcuno con il bottone +</small>
            </div>`;
        return;
    }

    container.innerHTML = friends.map(buildFriendHTML).join('');
}

// ─── Listener azioni amici ────────────────────────────────────────────────────

/**
 * Inizializza il listener delegato sulla lista amici per gestire:
 * - click sul bottone "Sfida"
 * - click sui bottoni "Accetta" / "Rifiuta" richiesta
 * @param {Function} onActionSuccess - Callback da invocare dopo un'azione riuscita (es: refresh profilo)
 */
export function initFriendActions(onActionSuccess) {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    // Cloniamo il nodo per azzerare eventuali listener precedenti
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener('click', async (event) => {
        // Bottone "Sfida" per gli amici online
        const challengeBtn = event.target.closest('.profile-btn-challenge');
        if (challengeBtn) {
            const friendItem = challengeBtn.closest('.profile-friend-item');
            if (friendItem) {
                const friendId = friendItem.id.replace('sidebar-rel-', '');
                const name = friendItem.querySelector('.profile-friend-name')?.textContent?.trim();
                
                if (typeof showToast === 'function') showToast(`Invio sfida a ${name || 'giocatore'}...`, 'blue');
                window.dispatchEvent(new CustomEvent('cg:challenge-friend', { detail: { friendId } }));
            }
            return;
        }

        // Bottoni "Accetta" / "Rifiuta" richiesta di amicizia
        const actionButton = event.target.closest('.profile-action-btn');
        if (!actionButton || actionButton.disabled) return;

        const action = actionButton.dataset.action;
        const userid = actionButton.dataset.userid;
        if (!action || !userid) return;

        const originalHTML = actionButton.innerHTML;
        actionButton.disabled = true;
        actionButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

        try {
            const apiUrl    = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
            const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE';

            const res = await fetchAuth(apiUrl, { method: apiMethod });
            if (!res.ok) throw new Error('Errore operazione');

            // Ricarica i dati del profilo senza refresh di pagina
            if (typeof onActionSuccess === 'function') onActionSuccess();

        } catch (err) {
            console.error("[profile_friends] Errore nell'azione amico:", err);
            actionButton.disabled = false;
            actionButton.innerHTML = originalHTML;
        }
    });
}

// ─── Click su nome amico → redirect profilo ───────────────────────────────────

/* Naviga al profilo dell'amico cliccato */
export function initFriendNameNavigation() {
    document.addEventListener('click', (event) => {
        const nameElement = event.target.closest('.profile-friend-name');
        if (!nameElement) return;

        const friendName = nameElement.textContent.trim();
        if (friendName) {
            window.location.href = `/profilo/${encodeURIComponent(friendName)}`;
        }
    });
}

// ─── Bottone dinamico (Aggiungi / Rimuovi / Accetta / Rifiuta) ────────────────

/**
 * Trasforma il bottone "Modifica Profilo" nel bottone di azione amicizia corretto
 * quando si visita il profilo di un altro utente.
 * @param {string} targetUserId
 * @param {HTMLElement} btnEditProfile
 */
export async function setupDynamicProfileButton(targetUserId, btnEditProfile) {
    try {
        const res = await fetchAuth('/api/mie-amicizie');
        if (!res.ok) throw new Error('Errore nel recupero amicizie');
        const mieAmicizie = await res.json();

        const isAmico     = mieAmicizie.amici.find(u => u.userid === targetUserId);
        const haInviatoLui = mieAmicizie.ricevute.find(u => u.userid === targetUserId);
        const hoInviatoIo  = mieAmicizie.inviate.find(u => u.userid === targetUserId);

        // Cloniamo il bottone per azzerare i vecchi listener
        const container = btnEditProfile.parentNode;
        const newBtn = btnEditProfile.cloneNode(true);
        container.replaceChild(newBtn, btnEditProfile);

        if (isAmico) {
            newBtn.innerHTML  = '<i class="bi bi-person-x-fill"></i> Rimuovi Amicizia';
            newBtn.className  = 'profile-action-btn profile-action-btn--danger';
            newBtn.onclick    = () => window.handleProfileFriendAction('rimuovi', targetUserId);

        } else if (haInviatoLui) {
            // Stato: ha inviato lui → mostriamo Accetta e Rifiuta
            container.innerHTML = `
                <div class="d-flex gap-2 flex-wrap">
                    <button class="profile-action-btn profile-action-btn--success" onclick="handleProfileFriendAction('accetta', '${targetUserId}')">
                        <i class="bi bi-check-lg"></i> Accetta
                    </button>
                    <button class="profile-action-btn profile-action-btn--danger" onclick="handleProfileFriendAction('rifiuta', '${targetUserId}')">
                        <i class="bi bi-x-lg"></i> Rifiuta
                    </button>
                </div>`;

        } else if (hoInviatoIo) {
            newBtn.innerHTML  = '<i class="bi bi-clock-history"></i> Richiesta inviata';
            newBtn.className  = 'profile-action-btn profile-action-btn--muted';
            newBtn.onclick    = () => window.handleProfileFriendAction('annulla', targetUserId);

        } else {
            newBtn.innerHTML  = '<i class="bi bi-person-plus-fill"></i> Aggiungi Amico';
            newBtn.className  = 'profile-action-btn profile-action-btn--primary';
            newBtn.onclick    = () => window.handleProfileFriendAction('aggiungi', targetUserId);
        }

    } catch (err) {
        console.error("[profile_friends] Impossibile determinare lo stato dell'amicizia:", err);
        btnEditProfile.remove();
    }
}