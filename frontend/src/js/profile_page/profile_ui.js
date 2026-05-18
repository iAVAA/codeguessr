/*
    FILE: profile_ui.js
    DESCRIPTION: Gestisce l'aggiornamento grafico della pagina profilo (avatar, bio, statistiche, XP ring).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession } from '../managers/auth.js';
import { setXpProgress, XP_PER_LEVEL } from '../utils/ui_utils.js';
import { renderHistory } from './profile_history.js';
import { renderFriends } from './profile_friends.js';

/* ===== Formattazione date ===== */

/* Formatta una data ISO in una stringa relativa (es: "3 giorni fa", "Adesso") */
export function formatRelativeTime(isoString) {
    if (!isoString) return 'Data sconosciuta';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Adesso';
    if (diffMinutes < 60) return `${diffMinutes} min fa`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return `${diffDays} giorni fa`;

    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Formatta una data ISO in una stringa leggibile (es: "15 maggio 2026") */
export function formatJoinDate(isoString) {
    if (!isoString) return 'Data sconosciuta';
    return new Date(isoString).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
}

/* Formatta la modalità di una partita in una label leggibile */
export function formatModalita(modalita) {
    const map = {
        'singleplayer': 'Single Player',
        'multiplayer':  'Multiplayer'
    };
    return map[modalita] || modalita || 'Partita';
}

/* ===== Aggiornamento UI ===== */

/* Popola tutti gli elementi grafici della pagina profilo con i dati del giocatore */
export function updateProfileUI(playerData) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; };

    // === Profilo Principale ===
    setText('page-name', playerData.name);

    // XP Ring (visibile solo se è il proprio profilo)
    const session = getSession();
    const isOwnProfile = playerData.id === session.idGiocatore;
    const wrapper = document.querySelector('.profile-main-avatar-wrapper');
    const ringSvg = document.querySelector('.profile-main-avatar-wrapper .xp-ring');

    if (isOwnProfile) {
        if (wrapper) wrapper.classList.remove('no-xp');
        if (ringSvg) ringSvg.style.display = 'block';
        const xpPercent = Math.min(100, (playerData.xp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
        setXpProgress(xpPercent, 'xp-ring-progress-profile');
    }
    else {
        if (wrapper) wrapper.classList.add('no-xp');
        if (ringSvg) ringSvg.style.display = 'none';
    }

    // ID utente (rimmosso nel frontend ma salvato come data-attribute per controlli di sicurezza)
    const userIdEl = document.getElementById('page-userid');
    if (userIdEl) {
        userIdEl.textContent = playerData.id.slice(0, 8) + '…';
        userIdEl.dataset.fullId = playerData.id;
    }

    // Data di iscrizione
    const joinDateEl = document.getElementById('page-joindate');
    if (joinDateEl) joinDateEl.textContent = playerData.joinDate;

    // Bio
    const bioEl = document.getElementById('page-bio');
    if (bioEl) {
        bioEl.textContent = playerData.bio && playerData.bio.trim() ? `${playerData.bio}`
            : 'Nessuna bio impostata.';
    }

    // Avatar
    const mainAvatar = document.getElementById('page-avatar');
    if (mainAvatar) mainAvatar.src = playerData.avatar;

    // Banner
    const bannerEl = document.querySelector('.profile-banner');
    if (bannerEl && playerData.banner_url) {
        bannerEl.style.backgroundImage = `url('${playerData.banner_url}')`;
    }

    // Statistiche
    const stats = playerData.stats;
    const statBoxes = document.querySelectorAll('.stat-box-val');
    if (statBoxes.length >= 4) {
        statBoxes[0].textContent = stats.played;
        statBoxes[1].textContent = stats.won;
        statBoxes[2].textContent = stats.lost;
        statBoxes[3].textContent = `${stats.win_rate}%`;
    }

    // --- Storico & Amici ---
    renderHistory(playerData.history, playerData.name);
    renderFriends(playerData.friends);
}