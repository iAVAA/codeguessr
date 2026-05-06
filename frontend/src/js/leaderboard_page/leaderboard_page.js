/**
 * CodeGuessr - leaderboard_page.js
 * Gestione della classifica globale, fetch dei dati e rendering della tabella.
 */

import { getSession, fetchAuth } from '../managers/auth.js';


const XP_PER_LEVEL = 500;

// ─── Header Stats handling ───────────────────────────────────────────────────

let lastPct = 0;
function setXpProgress(pct) {
    const ring = document.getElementById('xp-ring-progress');
    if (!ring) return;
    const r = 17;
    const circumference = 2 * Math.PI * r;

    if (pct < lastPct) {
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = circumference;
        ring.getBoundingClientRect(); // Reflow
        ring.style.transition = '';
    }
    lastPct = pct;

    setTimeout(() => {
        ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    }, 500);
}

async function loadHeaderData(idGiocatore) {
    try {
        const res = await fetch(`/api/profilo/${idGiocatore}`);
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('player-name').textContent = data.user;
        document.getElementById('player-level').textContent = data.livello;
        document.getElementById('player-cups').textContent = (data.trophies || 0).toLocaleString('it-IT');

        const avatarEl = document.getElementById('player-avatar');
        if (avatarEl) {
            avatarEl.src = data.avatar_url || `/src/assets/img/user_profile.webp`;
        }

        const xpPct = Math.min(100, (data.exp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
        setXpProgress(xpPct);
    } catch (err) {
        console.error("Errore caricamento header:", err);
    }
}

// ─── Leaderboard Logic ────────────────────────────────────────────────────────

let currentPage = 1;
const itemsPerPage = 10;

async function fetchLeaderboard(page = 1) {
    try {
        const res = await fetch(`/api/leaderboard?page=${page}&limit=${itemsPerPage}`);
        if (!res.ok) throw new Error("Errore nel recupero della classifica");
        return await res.json();
    } catch (err) {
        console.error(err);
        return { players: [], totalPages: 0 };
    }
}

function buildLeaderboardRow(player, index, myId, page) {
    const rank = (page - 1) * itemsPerPage + index + 1;
    const isMe = player.id_giocatore === myId;
    const avatar = player.avatar_url || `/src/assets/img/user_profile.webp`;
    
    return `
        <div class="leaderboard-row rank-${rank} ${isMe ? 'is-me' : ''}" data-username="${player.nickname}">
            <div class="col-1 rank-col text-center">
                ${rank <= 3 ? `<i class="bi bi-award-fill"></i>` : rank}
            </div>
            <div class="col-6 player-col">
                <div class="lb-avatar-wrapper">
                    <img src="${avatar}" alt="${player.nickname}" class="lb-avatar">
                </div>
                <div class="player-info">
                    <span class="player-name">${player.nickname} ${isMe ? '<span class="me-badge">TU</span>' : ''}</span>
                </div>
            </div>
            <div class="col-2 level-col text-center">
                <span class="level-badge">LV ${player.livello}</span>
            </div>
            <div class="col-3 trophy-col text-end">
                <span>${player.trophies.toLocaleString('it-IT')}</span>
                <i class="bi bi-trophy-fill"></i>
            </div>
        </div>
    `;
}

function renderPagination(totalPages, activePage) {
    const paginationContainer = document.getElementById('leaderboard-pagination');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';
    
    // Bottone Indietro
    html += `<button class="pagination-btn" ${activePage === 1 ? 'disabled' : ''} data-page="${activePage - 1}">
                <i class="bi bi-chevron-left"></i>
             </button>`;

    // Pagine
    const startPage = Math.max(1, activePage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="pagination-btn dots">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === activePage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-btn dots">...</span>`;
        html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Bottone Avanti
    html += `<button class="pagination-btn" ${activePage === totalPages ? 'disabled' : ''} data-page="${activePage + 1}">
                <i class="bi bi-chevron-right"></i>
             </button>`;

    paginationContainer.innerHTML = html;

    // Listener
    paginationContainer.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== activePage) {
                currentPage = page;
                renderLeaderboard(currentPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

async function renderLeaderboard(page = 1) {
    const listContainer = document.getElementById('leaderboard-list');
    const { idGiocatore } = getSession();

    // Show loading spinner
    listContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;

    const data = await fetchLeaderboard(page);
    const players = data.players || [];

    if (players.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-5 text-darcula-comment">Nessun giocatore in classifica in questa pagina.</div>`;
        renderPagination(0, 1);
        return;
    }

    listContainer.innerHTML = players.map((p, i) => buildLeaderboardRow(p, i, idGiocatore, page)).join('');
    renderPagination(data.totalPages, page);

    // Add click events for redirection using nicknames
    const rows = listContainer.querySelectorAll('.leaderboard-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            const username = row.dataset.username;
            window.location.href = `/profilo/${encodeURIComponent(username)}`;
        });
    });
}

// ─── Initialization ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const { isLoggedIn, idGiocatore } = getSession();

    if (!isLoggedIn) {
        window.location.href = '/index.html';
        return;
    }

    // Carica dati header
    loadHeaderData(idGiocatore);
    
    // Heartbeat
    setInterval(() => {
        fetchAuth('/api/heartbeat', { method: 'POST' }).catch(() => {});
    }, 10000);
    fetchAuth('/api/heartbeat', { method: 'POST' }).catch(() => {});

    // Renderizza classifica
    renderLeaderboard();
});
