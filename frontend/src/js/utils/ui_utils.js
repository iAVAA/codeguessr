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