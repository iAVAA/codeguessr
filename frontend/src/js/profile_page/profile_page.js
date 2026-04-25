/**
 * CodeGuessr - profile_page.js
 * Gestisce la logica della pagina Profilo: caricamento statistiche, storico e amici.
 */

import { getSession } from '../managers/auth.js'; // Assicurati che il percorso sia corretto rispetto alla tua struttura

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
    <div class="side-item history-item d-flex align-items-center justify-content-between">
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
    const filterStyle = friend.online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
    const statusClass = friend.online ? 'online' : 'offline';
    const textClass = friend.online ? 'text-darcula-green' : 'text-darcula-comment';
    const statusText = friend.online ? 'Online' : 'Offline';

    const challengeBtn = friend.online
        ? `<button class="btn-challenge"><i class="bi bi-swords"></i> Sfida</button>`
        : '';

    return `
    <div class="side-item friend-item ${friend.online ? '' : 'offline-item'}">
        <div class="friend-info">
            <div class="friend-avatar-wrapper">
                <img src="${friend.avatar}" alt="${friend.name}" class="friend-avatar" ${filterStyle}>
                <div class="status-dot ${statusClass}"></div>
            </div>
            <div class="friend-details">
                <span class="friend-name">${friend.name}</span>
                <span class="friend-status-text ${textClass}">${statusText}</span>
            </div>
        </div>
        ${challengeBtn}
    </div>`;
}

// ─── Render Functions ────────────────────────────────────────────────────────

function renderHistory(history) {
    const container = document.querySelector('.history-list');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `<div class="text-center text-darcula-comment py-4">Nessuna partita giocata di recente.</div>`;
        return;
    }

    container.innerHTML = history.map(buildHistoryHTML).join('');
}

function renderFriends(friends) {
    const container = document.querySelector('.friends-list');
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

    // Aggiorna Top Navbar
    setText('player-name', playerData.name);
    setText('player-level', playerData.level);
    setText('player-cups', playerData.xp.toLocaleString('it-IT'));

    const navAvatar = document.getElementById('player-avatar');
    if (navAvatar) navAvatar.src = playerData.avatar;

    // Aggiorna Profilo Main
    setText('page-name', playerData.name);
    setText('page-userid', playerData.id);

    const mainAvatar = document.getElementById('page-avatar');
    if (mainAvatar) mainAvatar.src = playerData.avatar;

    // Aggiorna Statistiche
    const stats = playerData.stats;
    const statBoxes = document.querySelectorAll('.stat-box-val');
    if (statBoxes.length >= 4) {
        statBoxes[0].textContent = stats.played;
        statBoxes[1].textContent = stats.won;
        statBoxes[2].textContent = stats.lost;
        statBoxes[3].textContent = `${stats.winRate}%`;
    }

    // XP Ring
    const xpPercent = Math.min(100, (playerData.xp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
    setXpProgress(xpPercent);

    // Render Liste
    renderHistory(playerData.history);
    renderFriends(playerData.friends);
}

// ─── API / Data Fetching (Mockup) ─────────────────────────────────────────────

async function fetchFullProfileData(userId) {
    const token = localStorage.getItem('supabaseToken');
    
    const res = await fetch(`/api/profilo/${userId}`);
    if (!res.ok) throw new Error(`Profilo non trovato (${res.status})`);

    const dataProfilo = await res.json();

    // 1. Dobbiamo trasformare la lista di ID in una lista di Oggetti per il frontend
    const res1 = await fetch('/api/mie-amicizie', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // Questo è lo standard di sicurezza web (Bearer Token)
            'Authorization': `Bearer ${token}` 
        }
    });
    if (!res1.ok) throw new Error(`Amici non trovati (${res1.status})`);
    const amiciData = await res1.json();

    const amiciFormattati = amiciData.amici.map(amico => ({
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: "online"
    }));

    const amiciInviatiFormattati = amiciData.inviate.map(amico => ({
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: amico.online
    }));

    const amiciRicevutiFormattati = amiciData.ricevute.map(amico => ({
        name: amico.user,
        avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
        online: amico.online
    }));

    // 2. Calcoliamo quante partite ha fatto in base all'array matches
    const totalePartite = 0

    // 3. Restituiamo la struttura ESATTA che l'interfaccia si aspetta
    return {
        id: dataProfilo.userid,
        name: dataProfilo.user,
        level: dataProfilo.livello,
        xp: dataProfilo.exp,
        avatar: `${AVATAR_BASE}?seed=${dataProfilo.userid}&backgroundColor=1e1f21`,

        // Passiamo l'array trasformato, non i semplici ID
        friends: amiciFormattati,
        sentRequests: amiciInviatiFormattati,
        receivedRequests: amiciRicevutiFormattati,

        // Il frontend VUOLE l'oggetto stats, dobbiamo passarglielo per forza (anche a zero)
        stats: {
            played: totalePartite,
            won: 0,
            lost: 0,
            winRate: 0
        },

        // Mappiamo i match del backend sulla history
        history: []
    };

    /*

    esempio di come dovrebbe essere strutturato il return (dati fittizi per test):

    return new Promise(resolve => {

        setTimeout(() => {

            resolve({

                id: userId,

                name: "Salvatore Iavarone",

                level: 24,

                xp: 24530,

                avatar: `${AVATAR_BASE}?seed=${userId}&backgroundColor=1e1f21`,

                stats: {

                    played: 128,

                    won: 84,

                    lost: 44,

                    winRate: Math.round((84 / 128) * 100)

                },

                history: [

                    { result: 'win', language: 'Python', details: 'Single Player • Difficoltà: Normale', xpChange: 24, time: '2 ore fa' },

                    { result: 'loss', language: 'Rust', details: 'Multiplayer vs @Mike', xpChange: -10, time: 'Ieri' },

                    { result: 'win', language: 'JavaScript', details: 'Single Player • Difficoltà: Difficile', xpChange: 40, time: '3 giorni fa' },

                    { result: 'win', language: 'C++', details: 'Multiplayer vs @Anna', xpChange: 35, time: '1 sett. fa' }

                ],

                friends: [

                    { name: 'MikeCoder', avatar: `${AVATAR_BASE}?seed=mike`, online: true },

                    { name: 'AnnaDev', avatar: `${AVATAR_BASE}?seed=anna`, online: false },

                    { name: 'SyntaxError99', avatar: `${AVATAR_BASE}?seed=syntax`, online: false }

                ]

            });

        }, 500); // Simula ritardo di rete



    });

    */

}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initProfilePage() {
    const session = getSession();

    if (!session.isLoggedIn || !session.idGiocatore) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const playerData = await fetchFullProfileData(session.idGiocatore);
        updateProfileUI(playerData);
    } catch (error) {
        console.error('[Profile Page] Errore caricamento dati:', error);
        alert('Impossibile caricare il profilo. Riprova più tardi.');
    }
}

// Avvia lo script
initProfilePage();