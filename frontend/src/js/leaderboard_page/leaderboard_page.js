/*
    FILE: leaderboard_page.js
    DESCRIPTION: Gestore del caricamento della lista utenti nella classifica
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession, fetchAuth } from '../managers/auth.js';
import { setXpProgress, loadNavbarData, XP_PER_LEVEL } from '../utils/ui_utils.js';


let currentLeaderboardPage = 1;
const PLAYERS_PER_PAGE = 10;

/**
 * Recupera una pagina specifica della classifica globale dal backend.
 * @param {number} page - Numero della pagina da caricare.
 * @returns {Promise<Object>} - Dati dei giocatori e metadati paginazione.
 */
async function fetchLeaderboardData(page = 1) {
    try {
        const response = await fetch(`/api/leaderboard?page=${page}&limit=${PLAYERS_PER_PAGE}`);
        if (!response.ok) throw new Error("Errore nel recupero della classifica");
        return await response.json();
    } catch (error) {
        console.error("Errore fetchLeaderboard:", error);
        return { players: [], totalPages: 0 };
    }
}

/* ===== Costruisce l'HTML di una singola riga della classifica ===== */
function buildLeaderboardRow(player, index, myPlayerId, page) {
    const globalRank = (page - 1) * PLAYERS_PER_PAGE + index + 1;
    const isCurrentUser = player.id_giocatore === myPlayerId;
    const avatarUrl = player.avatar_url || '/src/assets/img/user_profile.webp';

    // Icona di premio per i primi 3 posti
    let rankDisplay = globalRank;

    if (rankDisplay <= 3) {
        rankDisplay = '<i class="bi bi-award-fill"></i>';
    }
    else {
        rankDisplay = globalRank;
    }

    return `
		<!-- Contenitore di lista utenti dinamica (1°, 2°, 3° posto e utente corrente) -->
        <div class="leaderboard-row rank-${globalRank} ${isCurrentUser ? 'is-me' : ''}" data-username="${player.nickname}">
            <div class="col-1 rank-col text-center">
                ${rankDisplay}
            </div>

            <div class="col-6 player-col">
                <div class="lb-avatar-wrapper">
                    <img src="${avatarUrl}" alt="${player.nickname}" class="lb-avatar">
                </div>

				<!-- Identificatore di utente corrente e badge -->
                <div class="player-info">
                    <span class="player-name">
                        ${player.nickname} 
                        ${isCurrentUser ? '<span class="me-badge">TU</span>' : ''}
                    </span>
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

/* ===== Genera e inietta i bottoni della paginazione ===== */
function renderPagination(totalPages, activePage) {
    const container = document.getElementById('leaderboard-pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHtml = '';

    // Bottone Indietro
    paginationHtml += `
        <button class="pagination-btn" ${activePage === 1 ? 'disabled' : ''} data-page="${activePage - 1}">
            <i class="bi bi-chevron-left"></i>
        </button>
    `;

    // Calcolo range pagine visibili
    const startRange = Math.max(1, activePage - 2);
    const endRange = Math.min(totalPages, startRange + 4);

    // Prima pagina e puntini iniziali
    if (startRange > 1) {
        paginationHtml += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startRange > 2) paginationHtml += `<span class="pagination-btn dots">...</span>`;
    }

    // Pagine numerate
    for (let i = startRange; i <= endRange; i++) {
        paginationHtml += `
            <button class="pagination-btn ${i === activePage ? 'active' : ''}" data-page="${i}">
                ${i}
            </button>
        `;
    }

    // Puntini finali e ultima pagina
    if (endRange < totalPages) {
        if (endRange < totalPages - 1) paginationHtml += `<span class="pagination-btn dots">...</span>`;
        paginationHtml += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Bottone Avanti
    paginationHtml += `
        <button class="pagination-btn" ${activePage === totalPages ? 'disabled' : ''} data-page="${activePage + 1}">
            <i class="bi bi-chevron-right"></i>
        </button>
    `;

    container.innerHTML = paginationHtml;

    // Event Listeners per i bottoni (fa cambiare la lista giocatori)
    container.querySelectorAll('.pagination-btn[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            const selectedPage = parseInt(button.dataset.page);

            if (selectedPage !== activePage) {
                currentLeaderboardPage = selectedPage;
                renderLeaderboard(currentLeaderboardPage);
                // Torna all'inizio della tabella per una UX migliore
                const tableTop = document.querySelector('.leaderboard-container');
                if (tableTop) tableTop.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

/* ===== Carica i dati e renderizza la classifica completa per una data pagina ===== */
async function renderLeaderboard(page = 1) {
    const listContainer = document.getElementById('leaderboard-list');
    const { idGiocatore: myPlayerId } = getSession();

    if (!listContainer) return;

    // Stato di caricamento
    listContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;

    const leaderboardData = await fetchLeaderboardData(page);
    const players = leaderboardData.players || [];

    // Gestione lista vuota
    if (players.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-5 text-darcula-comment">
                Nessun giocatore in classifica in questa pagina.
            </div>
        `;
        renderPagination(0, 1);
        return;
    }

    // Rendering righe
    listContainer.innerHTML = players
        .map((player, index) => buildLeaderboardRow(player, index, myPlayerId, page))
        .join('');

    // Rendering paginazione
    renderPagination(leaderboardData.totalPages, page);

    // Evento di click sulle righe per visitare il profilo
    const rows = listContainer.querySelectorAll('.leaderboard-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            const targetUsername = row.dataset.username;

            if (targetUsername) {
                window.location.href = `/profilo/${encodeURIComponent(targetUsername)}`;
            }
        });
    });
}

// ===== INIZIALIZZAZIONE SCRIPT =====
document.addEventListener('DOMContentLoaded', async () => {
    const session = getSession();

    // Protezione rotta
    if (!session.isLoggedIn) {
        window.location.href = '/index';
        return;
    }

    // Caricamento asincrono componenti UI
    loadNavbarData(session.idGiocatore);
    renderLeaderboard(currentLeaderboardPage);
});