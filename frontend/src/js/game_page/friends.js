/*
    FILE: friends.js
    DESCRIPTION: Gestore della logica degli amici (rendering, data fetching, azioni).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { fetchAuth } from '../managers/auth.js';
import { renderList } from '../utils/ui_utils.js';

/**
 * Genera l'HTML per un singolo elemento della lista amici/richieste.
 * @param {Object} friend - Oggetto contenente i dati dell'amico o della richiesta.
 * @returns {string} - Stringa HTML dell'elemento.
 */
export function buildFriendHTML(friend) {
	const { userid, name, avatar, online, type } = friend;

	let filterStyle = '';
	let statusDotClass = 'offline';
	let statusColor = 'text-darcula-comment';
	let statusText = '';
	let rightContent = '';

	// Configurazione in base al tipo di relazione (amico, richiesta ricevuta o inviata)
	if (type === 'amico') {
		filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
		statusDotClass = online ? 'online' : 'offline';
		statusColor = online ? 'text-darcula-green' : 'text-darcula-comment';
		statusText = online ? 'Online' : 'Offline';
		rightContent = online ?
			`<button class="btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>` :
			'';
	} else if (type === 'ricevuta') {
		statusDotClass = 'online';
		statusColor = 'text-warning';
		statusText = 'Nuova richiesta';
		rightContent = `
			<div class="d-flex gap-1">
				<button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" title="Accetta">
				<i class="bi bi-check-lg"></i>
				</button>
				<button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" title="Rifiuta">
				<i class="bi bi-x-lg"></i>
				</button>
			</div>
    	`;
	} else if (type === 'inviata') {
		statusText = 'In attesa...';
		rightContent = `
			<button disabled class="cg-waiting-btn">
				<i class="bi bi-clock"></i>
			</button>
		`;
	}

	return `
		<div class="side-item friend-item ${type === 'amico' && !online ? 'offline-item' : ''}" id="sidebar-rel-${userid}">
			<div class="friend-info">
				<div class="friend-avatar-wrapper">
					<img src="${avatar}" alt="${name}" class="friend-avatar" ${filterStyle}>
					<div class="status-dot ${statusDotClass}"></div>
				</div>
				<div class="friend-details">
					<span class="friend-name">${name}</span>
					<span class="friend-status-text ${statusColor}">${statusText}</span>
				</div>
			</div>
		${rightContent}
		</div>
	`;
}

/**
 * Renderizza la lista degli amici e aggiorna il badge online.
 * @param {Array} friends - Lista di amici e richieste.
 */
export function renderFriends(friends) {
	const onlineCount = friends?.filter(f => f.type === 'amico' && f.online).length ?? 0;
	const badge = document.getElementById('friends-online-badge');
	if (badge) badge.textContent = `${onlineCount} Online`;

	renderList('.friends-list', friends, buildFriendHTML, 'Nessun amico o richiesta al momento.');
}

/**
 * Recupera la lista di amici (inviate, ricevute, accettate) dell'utente loggato.
 * @returns {Promise<Object>} - Oggetto contenente le 3 liste formattate.
 */
export async function fetchPlayerAmici() {
	const res = await fetchAuth('/api/mie-amicizie');
	if (!res.ok) return { amici: [], inviate: [], ricevute: [] };

	const amiciData = await res.json();

	const makeEntry = (amico, type) => ({
		userid: amico.userid,
		name: amico.user,
		avatar: amico.avatar_url || `/src/assets/img/user_profile.webp`,
		online: amico.online || false,
		type
	});

	return {
		amici: (amiciData.amici || []).map(a => makeEntry(a, 'amico')),
		inviate: (amiciData.inviate || []).map(a => makeEntry(a, 'inviata')),
		ricevute: (amiciData.ricevute || []).map(a => makeEntry(a, 'ricevuta'))
	};
}

/* Gestisce le azioni di amicizia (accetta/rifiuta) */
export async function handleFriendAction(btn, action, userid, onComplete) {
	const originalHTML = btn.innerHTML;
	btn.disabled = true;
	btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

	try {
		const apiUrl = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
		const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE';

		const res = await fetchAuth(apiUrl, { method: apiMethod });
		if (!res.ok) throw new Error("Errore operazione");

		if (onComplete) await onComplete();

		if (typeof showToast === 'function') {
			showToast(action === 'accetta' ? "Richiesta accettata!" : "Richiesta rifiutata", action === 'accetta' ? "green" : "red");
		}
	} catch (err) {
		console.error("Errore amicizia:", err);
		if (typeof showToast === 'function') showToast("Impossibile completare l'operazione.", "red");
		btn.disabled = false;
		btn.innerHTML = originalHTML;
	}
}

/* Inizializza i listener per i click sulla sidebar degli amici */
export function initSidebarActions(onActionComplete) {
	const friendsListContainer = document.querySelector('.friends-list');
	if (!friendsListContainer) return;

	friendsListContainer.addEventListener('click', async (event) => {
		// 1. Gestione Sfida
		const challengeBtn = event.target.closest('.btn-challenge');
		if (challengeBtn) {
			const friendItem = challengeBtn.closest('.friend-item');
			if (friendItem) {
				const friendId = friendItem.id.replace('sidebar-rel-', '');
				const name = friendItem.querySelector('.friend-name')?.textContent;
				if (typeof showToast === 'function') showToast(`Invio sfida a ${name || 'giocatore'}...`, 'blue');
				window.dispatchEvent(new CustomEvent('cg:challenge-friend', { detail: { friendId } }));
			}
			return;
		}

		// 2. Gestione Accetta/Rifiuta Richiesta
		const actionButton = event.target.closest('.cg-search-add-btn');
		if (actionButton && !actionButton.disabled) {
			const { action, userid } = actionButton.dataset;
			if (action && userid) {
				await handleFriendAction(actionButton, action, userid, onActionComplete);
			}
		}
	});
}