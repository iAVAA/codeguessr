/*
    FILE: ui_utils.js
    DESCRIPTION: Gestore del caricamento dei dati utente nell UI
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { fetchAuth } from '../managers/auth.js';

export const XP_PER_LEVEL = 500;
export const XP_ANIMATION_DELAY = 2000;
const lastPctMap = new Map();

/**
 * Aggiorna visivamente l'anello dell'esperienza.
 * @param {number} pct - Percentuale di XP nel livello corrente (0-100).
 * @param {string} ringId - ID dell'elemento SVG path.
 */
export function setXpProgress(pct, ringId = 'xp-ring-progress') {
    const ring = document.getElementById(ringId);
    if (!ring) return;

    const r = 17;
    const circumference = 2 * Math.PI * r;
    const lastPct = lastPctMap.get(ringId) || 0;

    // Se la percentuale cala (es. nuovo livello), resetta l'animazione
    if (pct < lastPct) {
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = circumference;
        ring.getBoundingClientRect(); // Forza il reflow
        ring.style.transition = '';
    }
    lastPctMap.set(ringId, pct);

    setTimeout(() => {
        ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    }, XP_ANIMATION_DELAY);
}

/**
 * Popola gli elementi della navbar con i dati del giocatore forniti.
 * @param {Object} playerData - Dati del giocatore (user, livello, trophies, exp, avatar_url).
 */
export function updateNavbarUI(playerData) {
    if (!playerData) return;

    // Popolamento elementi testuali navbar
    const nameEl = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const cupsEl = document.getElementById('player-cups');
    const avatarEl = document.getElementById('player-avatar');

    if (nameEl) nameEl.textContent = playerData.user;
    if (levelEl) levelEl.textContent = playerData.livello;
    if (cupsEl) cupsEl.textContent = (playerData.trophies || 0).toLocaleString('it-IT');
    if (avatarEl) {
        avatarEl.src = playerData.avatar_url || `/src/assets/img/user_profile.webp`;
    }

    // Calcolo e aggiornamento anello XP (Navbar usa sempre 'xp-ring-progress')
    const xpPercentage = Math.min(100, (playerData.exp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
    setXpProgress(xpPercentage, 'xp-ring-progress');
}

/**
 * Carica i dati del giocatore loggato per popolare la navbar.
 * @param {string} playerId - ID del giocatore.
 * @returns {Promise<Object|null>} - Dati del giocatore caricati.
 */
export async function loadNavbarData(playerId) {
    if (!playerId) return null;
    
    try {
        const response = await fetch(`/api/profilo/${playerId}`);
        if (!response.ok) return null;

        const playerData = await response.json();
        updateNavbarUI(playerData);
        return playerData;
    } catch (error) {
        console.error("Errore durante il caricamento dei dati navbar:", error);
        return null;
    }
}

/**
 * Renderizza una lista di elementi in un contenitore.
 * @param {string} selector - Selettore CSS del contenitore.
 * @param {Array} items - Array di dati da renderizzare.
 * @param {Function} buildFn - Funzione che trasforma un singolo dato in HTML string.
 * @param {string} emptyMessage - Messaggio da mostrare se la lista è vuota.
 */
export function renderList(selector, items, buildFn, emptyMessage) {
    const container = document.querySelector(selector);
    if (!container) return;

    if (!items?.length) {
        container.innerHTML = `<div class="text-center text-darcula-comment py-3"><small>${emptyMessage}</small></div>`;
        return;
    }

    container.innerHTML = items.map(buildFn).join('');
}

// ─── Toast Notification ───────────────────────────────────────────────────────

const TOAST_COLORS = {
    blue: '--darcula-blue',
    green: '--darcula-green',
    orange: '--darcula-orange',
    red: '--darcula-red',
};

/**
 * Mostra una notifica toast temporanea.
 * @param {string} message - Il messaggio da visualizzare.
 * @param {'blue'|'green'|'orange'|'red'} [color='blue'] - Il tema colore.
 */
export function showToast(message, color = 'blue') {
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

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Funzione di utilità per ritardare l'esecuzione di una funzione.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}