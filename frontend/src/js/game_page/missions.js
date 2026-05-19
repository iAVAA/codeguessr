/*
    FILE: missions.js
    DESCRIPTION: Gestore delle missioni nella lobby
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import {
    renderList
} from '../utils/ui_utils.js';

export let cachedMissions = [];
let showingCompletedMissions = false;

/* Preleva le missioni del giocatore dal DB */
export async function fetchPlayerMissions(idGiocatore) {
    try {
        const res = await fetch(`/api/missioni/${idGiocatore}`);
        if (!res.ok) return [];

        const missions = await res.json();
        cachedMissions = missions;

        return missions;
    } catch (err) {
        console.error("Errore caricamento missioni:", err);
        return [];
    }
}

/* Costruisce l'HTML per una singola missione */
export function buildMissionHTML(mission) {
    const {
        id,
        title,
        current,
        target,
        reward,
        completed
    } = mission;
    const pct = Math.min(100, (current / target) * 100);

    return `
        <div class="side-item mission-item ${completed ? 'mission-completed' : ''}" data-id="${id}" style="cursor: pointer;">
        <div class="side-item-content">
            <div class="mission-title ${completed ? 'text-decoration-line-through text-darcula-comment' : ''}">${title}</div>
            <div class="mission-progress-bar">
            <div class="progress-fill ${completed ? 'bg-success' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="mission-info">
            <span class="mission-status">
                ${completed
                ? `<span class="text-success">${current}/${target}</span>`
                : `<span>${current}/${target}</span>`}
            </span>
            <span class="mission-reward">
                ${completed ? `<i class="bi bi-check-circle-fill"></i> ${reward}` : reward}
            </span>
            </div>
        </div>
        </div>
    `;
}

/* Renderizza la lista delle missioni (attive o completate) */
export function renderMissions(missions) {
    const active = missions.filter(m => !m.completed);
    const completed = missions.filter(m => m.completed);

    if (showingCompletedMissions) {
        renderList('.mission-list', completed, buildMissionHTML, 'Nessuna missione completata.');
    } else {
        renderList('.mission-list', active, buildMissionHTML, 'Nessuna missione attiva.');
    }
}

/* Inizializza i dati della finestra modale dei dettagli della missione */
export function initMissionDetailOverlay() {
    const missionListContainer = document.querySelector('.mission-list');
    const overlay = document.getElementById('mission-detail-overlay');
    const closeBtn = document.getElementById('mission-detail-close');

    if (!missionListContainer || !overlay) return;

    /* Handler del bottone per ogni missione */
    missionListContainer.addEventListener('click', (event) => {
        const missionItem = event.target.closest('.mission-item');
        if (!missionItem) return;

        const missionId = missionItem.dataset.id;
        if (!missionId) return;

        const mission = cachedMissions.find(m => m.id === missionId);
        if (!mission) return;

        document.getElementById('mission-detail-name').textContent = mission.title;
        document.getElementById('mission-detail-desc').textContent = mission.description || "Completa questo obiettivo per ottenere ricompense.";
        document.getElementById('mission-detail-progress-text').textContent = `${mission.current}/${mission.target}`;

        const pct = Math.min(100, (mission.current / mission.target) * 100);
        const fillEl = document.getElementById('mission-detail-progress-fill');
        fillEl.style.width = `${pct}%`;

        if (mission.completed) {
            fillEl.classList.add('bg-success');
        } else {
            fillEl.classList.remove('bg-success');
        }

        const rewardEl = document.getElementById('mission-detail-reward');
        rewardEl.innerHTML = mission.completed ? `<i class="bi bi-check-circle-fill" style="color: rgb(var(--darcula-green));"></i> Completata` : mission.reward;

        overlay.classList.add('open');
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.remove('open');
        });
    }

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            overlay.classList.remove('open');
        }
    });
}

/* Inizializza il bottone tra missioni attive e completate */
export function initMissionToggle() {
    const btn = document.getElementById('btn-toggle-missions');
    if (!btn) return;
    const icon = btn.querySelector('i');

    btn.addEventListener('click', () => {
        showingCompletedMissions = !showingCompletedMissions;

        if (showingCompletedMissions) {
            icon.classList.remove('bi-archive');
            icon.classList.add('bi-archive-fill');
            btn.classList.add('active');
        } else {
            icon.classList.remove('bi-archive-fill');
            icon.classList.add('bi-archive');
            btn.classList.remove('active');
        }

        renderMissions(cachedMissions);
    });
}