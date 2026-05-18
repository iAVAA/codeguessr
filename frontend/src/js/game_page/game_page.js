/*
    FILE: game_page.js
    DESCRIPTION: Gestore generale del profilo utente nella lobby.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession, fetchAuth, startHeartbeat } from '../managers/auth.js';
import { loadNavbarData } from '../utils/ui_utils.js';
import { 
  fetchPlayerMissions, 
  renderMissions, 
  initMissionDetailOverlay, 
  initMissionToggle
} from './missions.js';
import {
  fetchPlayerAmici,
  renderFriends,
  initSidebarActions
} from './friends.js';


/* Mostra il menu a tendina del profilo (rimuove d-none) */
function showProfile() {
	document.getElementById('profile-dropdown-wrapper')?.classList.remove('d-none');
}

// ===== Inizializzazione Script nel DOM =====

/* Carica tutti i dati necessari all'avvio della lobby */
async function loadPlayerData() {
	const { isLoggedIn, idGiocatore } = getSession();

	if (!isLoggedIn || !idGiocatore) {
		window.location.href = '/index';
		return;
	}

	showProfile();

	try {
		// Caricamento dati nell'UI (Navbar, Amici, Missioni)
		const [apiData, amiciData, missionsData] = await Promise.all([
			loadNavbarData(idGiocatore),
			fetchPlayerAmici(),
			fetchPlayerMissions(idGiocatore)
		]);

		if (apiData) {
			// Aggiorna il nome di benvenuto nella lobby
			const welcomeEl = document.getElementById('hero-welcome-name');
			if (welcomeEl) welcomeEl.textContent = apiData.user;

			// Renderizza le liste della sidebar
			renderMissions(missionsData);
			const allFriends = [...amiciData.ricevute, ...amiciData.amici, ...amiciData.inviate];
			renderFriends(allFriends);
		}

		// Avvio intervalli heartbeat e refresh
		if (!window._profileIntervalsInit) {
			initIntervals(idGiocatore);
			window._profileIntervalsInit = true;
		}

	} catch (err) {
		console.error('[profile.js] Errore caricamento:', err);
	}
}

/* Inizializza i timer per il refresh degli amici e l'heartbeat online */
function initIntervals(idGiocatore) {
	// Auto-refresh amici ogni 10 secondi
	setInterval(async () => {
		try {
			const newAmiciData = await fetchPlayerAmici();
			const newList = [...newAmiciData.ricevute, ...newAmiciData.amici, ...newAmiciData.inviate];
			renderFriends(newList);
		} catch (e) {
			console.warn('Silent refresh failed', e);
		}
	}, 10000);

	// Heartbeat centralizzato ogni 5 secondi
	startHeartbeat(5000);
}

// Avvio al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
	loadPlayerData();
	
	// Inizializza le azioni della sidebar amici passandogli la funzione di refresh totale come callback
	initSidebarActions(loadPlayerData);
	
	initMissionDetailOverlay();
	initMissionToggle();
});