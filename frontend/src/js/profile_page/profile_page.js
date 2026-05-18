/*
    FILE: profile_page.js
    DESCRIPTION: Entry point della pagina Profilo. Coordina il caricamento dei dati, la risoluzione dell'URL e l'inizializzazione dei moduli.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession, startHeartbeat } from '../managers/auth.js';
import { updateNavbarUI } from '../utils/ui_utils.js';
import { resolveTargetUserId, fetchFullProfileData } from './profile_api.js';
import { updateProfileUI } from './profile_ui.js';
import { initFriendActions, initFriendNameNavigation, setupDynamicProfileButton } from './profile_friends.js';

/* ===== Inizializzazione Pagina ===== */

async function initProfilePage() {
    const session = getSession();

    // reindirizza alla landing page (index.html) se non autenticato
    if (!session.isLoggedIn || !session.idGiocatore) {
        window.location.href = '/index';
        return;
    }

    try {
        // 1. Carica i dati della navbar per il giocatore loggato
        const resNavbar = await fetch(`/api/profilo/${session.idGiocatore}`);
        if (resNavbar.ok) {
            const navbarData = await resNavbar.json();
            updateNavbarUI(navbarData);
        }

        // 2. Determina l'ID del profilo target dall'URL (/profilo o /profilo/{nickname})
        const targetUserId = await resolveTargetUserId(session);
        if (!targetUserId) return; // resolveTargetUserId ha già gestito il reindirizzamento

        // 3. Carica tutti i dati del profilo target (statistiche, storico, amici)
        const playerData = await fetchFullProfileData(targetUserId);

        // 4. Aggiorna l'interfaccia grafica
        updateProfileUI(playerData);

        // 5. Inizializza le azioni della lista amici e la navigazione al profilo
        initFriendActions(initProfilePage);
        initFriendNameNavigation();

        // 6. Gestione bottone "Modifica Profilo" / azioni amicizia dinamiche
        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) {
            if (targetUserId !== session.idGiocatore) {
                // Profilo altrui: trasforma il bottone in azione di amicizia
                await setupDynamicProfileButton(targetUserId, btnEditProfile);
            }
            // Profilo proprio: il listener è già gestito da edit_profile.js
        }

        // 7. Avvia heartbeat di presenza online centralizzato
        startHeartbeat(10000);

    } catch (error) {
        console.error('[profile_page.js] Errore caricamento dati:', error);
    }
}

// Avvio al caricamento del modulo
initProfilePage();