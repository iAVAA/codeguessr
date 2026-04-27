/**
 * CodeGuessr - profile_page.js
 * Gestisce la logica della pagina Profilo: caricamento statistiche, storico e amici.
 */

import { getSession } from '../managers/auth.js'; // Assicurati che il percorso sia corretto

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';
const XP_PER_LEVEL = 1000;

// ─── Utility XP Ring ─────────────────────────────────────────────────────────

function setXpProgress(pct, ringId = 'xp-ring-progress') {
    const ring = document.getElementById(ringId);
    if (!ring) return;
    const r = 17;
    const circumference = 2 * Math.PI * r;
    setTimeout(() => {
        ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    }, 400);
}

// ─── Template Builders ───────────────────────────────────────────────────────

function buildHistoryHTML(match) {
    const isWin = match.result === 'win';
    const icon = isWin ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
    const xpColor = isWin ? 'text-darcula-green' : 'text-darcula-red';
    const xpPrefix = isWin ? '+' : '';

    return `
    <div class="profile-side-item history-item d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
            <div class="history-result ${match.result}"><i class="bi ${icon}"></i></div>
            <div>
                <div class="history-lang text-darcula-fg fw-bold">${match.language}</div>
                <div class="history-meta text-darcula-comment" style="font-size: 0.75rem;">${match.details}</div>
            </div>
        </div>
        <div class="text-end">
            <div class="history-xp ${xpColor} fw-bold">${xpPrefix}${match.xpChange} XP</div>
            <div class="history-time text-darcula-comment" style="font-size: 0.7rem;">${match.time}</div>
        </div>
    </div>`;
}

function buildFriendHTML(friend) {
    const { userid, name, avatar, online, type } = friend;
    
    let filterStyle = '';
    let statusClass = 'offline';
    let textClass = 'text-darcula-comment';
    let statusText = '';
    let rightContent = '';

    if (type === 'amico') {
        filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
        statusClass = online ? 'online' : 'offline';
        textClass = online ? 'text-darcula-green' : 'text-darcula-comment';
        statusText = online ? 'Online' : 'Offline';
        rightContent = online ? `<button class="profile-btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>` : '';
    } 
    else if (type === 'ricevuta') {
        textClass = 'text-warning';
        statusText = 'Nuova richiesta';
        rightContent = `
            <div class="d-flex gap-1">
                <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" style="background-color: #198754; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Accetta"><i class="bi bi-check-lg"></i></button>
                <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Rifiuta"><i class="bi bi-x-lg"></i></button>
            </div>
        `;
    } 
    else if (type === 'inviata') {
        statusText = 'In attesa...';
        rightContent = `<button disabled style="opacity: 0.6; cursor: not-allowed; padding: 2px 8px; border: 1px solid #555; background: transparent; color: #888; border-radius: 4px;"><i class="bi bi-clock"></i></button>`;
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

// ─── Render Functions ────────────────────────────────────────────────────────

function renderHistory(history) {
    const container = document.querySelector('.profile-history-list');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `<div class="text-center text-darcula-comment py-4">Nessuna partita giocata di recente.</div>`;
        return;
    }

    container.innerHTML = history.map(buildHistoryHTML).join('');
}

function renderFriends(friends) {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = `<div class="text-center text-darcula-comment py-4">Non ho amici per pensare a te.</div>`;
        return;
    }

    container.innerHTML = friends.map(buildFriendHTML).join('');
}

// ─── UI State Updaters ───────────────────────────────────────────────────────

function updateProfileUI(playerData) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Navbar Profile (se presenti in questa pagina)
    setText('player-name', playerData.name);
    setText('player-level', playerData.level);
    setText('player-cups', playerData.xp.toLocaleString('it-IT'));

    const navAvatar = document.getElementById('player-avatar');
    if (navAvatar) navAvatar.src = playerData.avatar;

    // Profilo Principale
    setText('page-name', playerData.name);
    setText('page-userid', playerData.id);

    const mainAvatar = document.getElementById('page-avatar');
    if (mainAvatar) mainAvatar.src = playerData.avatar;

    const stats = playerData.stats;
    const statBoxes = document.querySelectorAll('.stat-box-val');
    if (statBoxes.length >= 4) {
        statBoxes[0].textContent = stats.played;
        statBoxes[1].textContent = stats.won;
        statBoxes[2].textContent = stats.lost;
        statBoxes[3].textContent = `${stats.winRate}%`;
    }

    const xpPercent = Math.min(100, (playerData.xp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
    setXpProgress(xpPercent);

    renderHistory(playerData.history);
    renderFriends(playerData.friends);
}

// ─── API / Data Fetching ─────────────────────────────────────────────────────

async function fetchFullProfileData(userId) {
    const token = localStorage.getItem('supabaseToken');
    
    const res = await fetch(`/api/profilo/${userId}`);
    if (!res.ok) throw new Error(`Profilo non trovato (${res.status})`);
    const dataProfilo = await res.json();

    const res1 = await fetch('/api/mie-amicizie', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    if (!res1.ok) throw new Error(`Amici non trovati (${res1.status})`);
    const amiciData = await res1.json();

    const amiciFormattati = amiciData.amici.map(amico => ({
        userid: amico.userid,
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: "online", 
        type: 'amico'
    }));

    const amiciInviatiFormattati = amiciData.inviate.map(amico => ({
        userid: amico.userid,
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: false,
        type: 'inviata'
    }));

    const amiciRicevutiFormattati = amiciData.ricevute.map(amico => ({
        userid: amico.userid,
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: false,
        type: 'ricevuta'
    }));
    // Per ora non abbiamo dati reali sulle partite, quindi mettiamo valori fittizi
    // In futuro, potresti voler fare un'altra chiamata API per ottenere queste statistiche reali
    // Ad esempio, potresti avere un endpoint come /api/statistiche che restituisce queste info basate sui dati reali del giocatore
    // Per ora, mettiamo valori fittizi per dimostrare la funzionalità
    

    const totalePartite = 0;
   

    return {
        id: dataProfilo.userid,
        name: dataProfilo.user,
        level: dataProfilo.livello,
        xp: dataProfilo.exp,
        avatar: `${AVATAR_BASE}?seed=${dataProfilo.userid}&backgroundColor=1e1f21`,

        // Le richieste ricevute appaiono per prime!
        friends: [...amiciRicevutiFormattati, ...amiciFormattati, ...amiciInviatiFormattati],

        stats: { played: totalePartite, won: 0, lost: 0, winRate: 0 },
        history: []
    };
}

// ─── GESTIONE CLICK AMICIZIE ─────────────────────────────────────────────────

function initFriendActions() {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    // Rimuoviamo vecchi listener clonando il nodo
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('.cg-search-add-btn');
        if (!actionButton || actionButton.disabled) return;

        const action = actionButton.dataset.action; 
        const userid = actionButton.dataset.userid;
        if (!action || !userid) return;

        const originalHTML = actionButton.innerHTML;
        actionButton.disabled = true;
        actionButton.innerHTML = '...'; 

        try {
            const token = localStorage.getItem('supabaseToken');
            const apiUrl = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
            
            // Attenzione al metodo: PUT per accetta, DELETE per rifiuta
            const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE'; 

            const res = await fetch(apiUrl, {
                method: apiMethod,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Errore operazione");

            // Ricaricamento per aggiornare le UI
            initProfilePage(); 

        } catch (err) {
            console.error("Errore nell'azione amico:", err);
            actionButton.disabled = false;
            actionButton.innerHTML = originalHTML;
        }
    });
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function initProfilePage() {
    const session = getSession();

    if (!session.isLoggedIn || !session.idGiocatore) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const playerData = await fetchFullProfileData(session.idGiocatore);
        updateProfileUI(playerData);
        
        // Attiviamo i listener sui bottoni!
        initFriendActions();
    } catch (error) {
        console.error('[Profile Page] Errore caricamento dati:', error);
    }
}

// L'avvio base, in caso serva triggerarlo direttamente
initProfilePage();