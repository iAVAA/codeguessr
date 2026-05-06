// ==========================================
// FILE: gestione-amicizie.js (Il Cervello)
// ==========================================

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';

// 1. Scarica gli amici dal database
async function fetchPlayerAmici() {
    const token = localStorage.getItem('supabaseToken');
    if (!token) throw new Error("Utente non autenticato.");

    const res = await fetch('/api/mie-amicizie', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error(`Amici non trovati (${res.status})`);
    const amiciData = await res.json();

    return {
        amici: amiciData.amici.map(a => ({ userid: a.userid, name: a.user, avatar: a.avatar_url || '/src/assets/img/user_profile.webp', online: a.online, type: 'amico' })),
        inviate: amiciData.inviate.map(a => ({ userid: a.userid, name: a.user, avatar: a.avatar_url || '/src/assets/img/user_profile.webp', online: false, type: 'inviata' })),
        ricevute: amiciData.ricevute.map(a => ({ userid: a.userid, name: a.user, avatar: a.avatar_url || '/src/assets/img/user_profile.webp', online: false, type: 'ricevuta' }))
    };
}

// 2. Disegna il singolo blocco HTML (Amico o Richiesta)
function buildFriendHTML(friend) {
    const { userid, name, avatar, online, type } = friend;
    let filterStyle = '', statusDotClass = 'offline', statusColor = 'text-darcula-comment', statusText = '', rightContent = '';

    if (type === 'amico') {
        filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
        statusDotClass = online ? 'online' : 'offline';
        statusColor = online ? 'text-darcula-green' : 'text-darcula-comment';
        statusText = online ? 'Online' : 'Offline';
        rightContent = online ? `<button class="btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>` : '';
    } else if (type === 'ricevuta') {
        statusColor = 'text-warning';
        statusText = 'Nuova richiesta';
        rightContent = `
            <div class="d-flex gap-1" bis_skin_checked="1">
                <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" style="background-color: #198754; color: white; border: none; border-radius: 4px; padding: 2px 8px;"><i class="bi bi-check-lg"></i></button>
                <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px;"><i class="bi bi-x-lg"></i></button>
            </div>`;
    } else if (type === 'inviata') {
        statusText = 'In attesa...';
        rightContent = `<button disabled style="opacity: 0.6; cursor: not-allowed; padding: 2px 8px; border: 1px solid #555; background: transparent; color: #888; border-radius: 4px;"><i class="bi bi-clock"></i></button>`;
    }

    return `
        <div class="side-item friend-item ${type === 'amico' && !online ? 'offline-item' : ''}" id="sidebar-rel-${userid}" bis_skin_checked="1">
            <div class="friend-info" bis_skin_checked="1">
                <div class="friend-avatar-wrapper" bis_skin_checked="1">
                    <img src="${avatar}" alt="${name}" class="friend-avatar" ${filterStyle}>
                    <div class="status-dot ${statusDotClass}" bis_skin_checked="1"></div>
                </div>
                <div class="friend-details" bis_skin_checked="1">
                    <span class="friend-name">${name}</span>
                    <span class="friend-status-text ${statusColor}">${statusText}</span>
                </div>
            </div>
            ${rightContent}
        </div>`;
}

// 3. Renderizza l'intera lista nel div scelto
function renderFriendsList(selector, friends) {
    const container = document.querySelector(selector);
    if (!container) return;

    if (!friends?.length) {
        container.innerHTML = `<div class="text-center text-darcula-comment py-3"><small>Nessun amico o richiesta.</small></div>`;
    } else {
        container.innerHTML = friends.map(buildFriendHTML).join('');
    }

    // Aggiorna il badge online se esiste sulla pagina
    const onlineCount = friends?.filter(f => f.type === 'amico' && f.online).length ?? 0;
    const badge = document.getElementById('friends-online-badge');
    if (badge) badge.textContent = `${onlineCount} Online`;
}

// 4. Attiva i bottoni (Accetta/Rifiuta) su qualsiasi lista
function initFriendActions(listSelector, onSuccessCallback) {
    const container = document.querySelector(listSelector);
    if (!container) return;

    container.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('.cg-search-add-btn');
        if (!actionButton || actionButton.disabled) return;

        const action = actionButton.dataset.action;
        const userid = actionButton.dataset.userid;
        if (!action || !userid) return;

        const originalHTML = actionButton.innerHTML;
        actionButton.disabled = true;
        actionButton.innerHTML = '...';

        try {
            const token = localStorage.getItem('supabaseToken');
            const apiUrl = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
            const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE'; 

            const res = await fetch(apiUrl, {
                method: apiMethod,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Errore operazione");

            if (typeof showToast === 'function') showToast(action === 'accetta' ? "Fatto!" : "Rifiutata", "green");
            
            // Richiama la funzione di aggiornamento della pagina specifica!
            if (onSuccessCallback) onSuccessCallback();

        } catch (err) {
            console.error(err);
            actionButton.disabled = false;
            actionButton.innerHTML = originalHTML;
        }
    });
}