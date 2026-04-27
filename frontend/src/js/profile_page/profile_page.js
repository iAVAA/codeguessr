/**
 * CodeGuessr - profile_page.js
 * Gestisce la logica della pagina Profilo: caricamento statistiche reali,
 * storico partite dal DB, amici e aggiornamento UI completo.
 */

import { getSession, fetchAuth } from '../managers/auth.js';

window.handleProfileFriendAction = async function(action, targetUserId) {
    let url = '';
    let method = 'POST'; // o PUT/DELETE a seconda di come hai fatto il backend

    // Mappa le azioni sulle tue rotte backend
    switch(action) {
        case 'aggiungi': url = `/api/invia-richiesta/${targetUserId}`; break;
        case 'accetta':  url = `/api/accetta-richiesta/${targetUserId}`; method = 'PUT'; break;
        case 'rifiuta':  url = `/api/rifiuta-richiesta/${targetUserId}`; method = 'DELETE'; break;
        case 'annulla':  url = `/api/rifiuta-richiesta/${targetUserId}`; method = 'DELETE'; break;
        case 'rimuovi':  url = `/api/rifiuta-richiesta/${targetUserId}`;  method = 'DELETE'; break;
    }

    try {
        const res = await fetchAuth(url, { method: method });
        if (!res.ok) throw new Error('Errore durante l\'azione');
        
        // Se va tutto a buon fine, ricarichiamo la pagina per aggiornare l'interfaccia!
        window.location.reload();
    } catch (err) {
        console.error('Errore azione amicizia:', err);
        alert('C\'è stato un problema. Riprova più tardi.');
    }
}
const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';
const XP_PER_LEVEL = 1000;

// ─── Utility XP Ring ─────────────────────────────────────────────────────────

function setXpProgress(pct, ringId = 'xp-ring-progress') {
    const ring = document.getElementById(ringId);
    if (!ring) return;
    const r = 17;
    const circumference = 2 * Math.PI * r;
    setTimeout(() => {
        ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
    }, 400);
}

// ─── Utility: formatta data relativa ────────────────────────────────────────

function formatRelativeTime(isoString) {
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

function formatJoinDate(isoString) {
    if (!isoString) return 'Data sconosciuta';
    return new Date(isoString).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
}

// ─── Utility: label modalità ─────────────────────────────────────────────────

function formatModalita(modalita) {
    const map = {
        'singleplayer': 'Single Player',
        'multiplayer': 'Multiplayer',
        'ranked': 'Classificata',
        'amichevole': 'Amichevole'
    };
    return map[modalita] || modalita || 'Partita';
}

// ─── Template Builders ───────────────────────────────────────────────────────

function buildHistoryHTML(match) {
    const isWin = match.risultato === 'vittoria';
    const icon = isWin ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
    const resultClass = isWin ? 'win' : 'loss';
    const xpColor = isWin ? 'text-darcula-green' : 'text-darcula-red';
    const xpPrefix = isWin ? '+' : '';
    const timeAgo = formatRelativeTime(match.data_fine || match.data_inizio);
    const modeLabel = formatModalita(match.modalita);

    return `
    <div class="profile-side-item history-item d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
            <div class="history-result ${resultClass}"><i class="bi ${icon}"></i></div>
            <div>
                <div class="history-lang text-darcula-fg fw-bold">${isWin ? 'Vittoria' : 'Sconfitta'}</div>
                <div class="history-meta text-darcula-comment" style="font-size: 0.75rem;">${modeLabel}</div>
            </div>
        </div>
        <div class="text-end">
            <div class="history-xp ${xpColor} fw-bold">${xpPrefix}${match.exp_guadagnata} XP</div>
            <div class="history-time text-darcula-comment" style="font-size: 0.7rem;">${timeAgo}</div>
        </div>
    </div>`;
}

function buildFriendHTML(friend) {
    const { userid, name, avatar, online, type } = friend;
    
    let filterStyle = '';
    let statusClass = 'offline';
    let textClass = 'text-darcula-comment';
    let statusText = '';
    let rightContent = '';

    if (type === 'amico') {
        filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
        statusClass = online ? 'online' : 'offline';
        textClass = online ? 'text-darcula-green' : 'text-darcula-comment';
        statusText = online ? 'Online' : 'Offline';
        rightContent = online
            ? `<button class="profile-btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>`
            : '';
    } else if (type === 'ricevuta') {
        statusClass = 'online';
        textClass = 'text-warning';
        statusText = 'Nuova richiesta';
        rightContent = `
            <div class="d-flex gap-1">
                <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" style="background-color: #198754; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Accetta"><i class="bi bi-check-lg"></i></button>
                <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Rifiuta"><i class="bi bi-x-lg"></i></button>
            </div>
        `;
    } else if (type === 'inviata') {
        statusText = 'In attesa...';
        rightContent = `<button disabled style="opacity:0.6;cursor:not-allowed;padding:2px 8px;border:1px solid #555;background:transparent;color:#888;border-radius:4px;"><i class="bi bi-clock"></i></button>`;
    }

    return `
    <div class="profile-side-item profile-friend-item ${type === 'amico' && !online ? 'profile-offline-item' : ''}" id="sidebar-rel-${userid}">
        <div class="profile-friend-info">
            <div class="profile-friend-avatar-wrapper">
                <img src="${avatar}" alt="${name}" class="profile-friend-avatar" ${filterStyle}>
                <div class="profile-status-dot ${statusClass}"></div>
            </div>
            <div class="profile-friend-details">
                <span class="profile-friend-name">${name}</span>
                <span class="profile-friend-status-text ${textClass}">${statusText}</span>
            </div>
        </div>
        ${rightContent}
    </div>`;
}

// ─── Render Functions ────────────────────────────────────────────────────────

function renderHistory(history) {
    const container = document.querySelector('.profile-history-list');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="text-center text-darcula-comment py-4">
                <i class="bi bi-controller" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.4;"></i>
                Nessuna partita giocata ancora.<br>
                <small>Gioca la tua prima partita!</small>
            </div>`;
        return;
    }

    container.innerHTML = history.map(buildHistoryHTML).join('');
}

function renderFriends(friends) {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = `
            <div class="text-center text-darcula-comment py-4">
                <i class="bi bi-people" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.4;"></i>
                Nessun amico ancora.<br>
                <small>Aggiungi qualcuno con il bottone +</small>
            </div>`;
        return;
    }

    container.innerHTML = friends.map(buildFriendHTML).join('');
}

// ─── UI State Updaters ───────────────────────────────────────────────────────

function updateProfileUI(playerData) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; };

    
    // --- Profilo Principale ---
    setText('page-name', playerData.name);
    setText('page-userid', playerData.id.slice(0, 8) + '…');

    const joinDateEl = document.getElementById('page-joindate');
    if (joinDateEl) joinDateEl.textContent = playerData.joinDate;

    // Bio
    const bioEl = document.getElementById('page-bio');
    if (bioEl) {
        bioEl.textContent = playerData.bio && playerData.bio.trim()
            ? `"${playerData.bio}"`
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

    // --- Statistiche ---
    const stats = playerData.stats;
    const statBoxes = document.querySelectorAll('.stat-box-val');
    if (statBoxes.length >= 4) {
        statBoxes[0].textContent = stats.played;
        statBoxes[1].textContent = stats.won;
        statBoxes[2].textContent = stats.lost;
        statBoxes[3].textContent = `${stats.win_rate}%`;
    }

    // --- Storico & Amici ---
    renderHistory(playerData.history);
    renderFriends(playerData.friends);
}

// ─── API / Data Fetching ─────────────────────────────────────────────────────

async function fetchFullProfileData(userId) {
    const session = getSession();
    
    // Scegliamo la rotta giusta per le amicizie! Se sei tu, vedi tutto. Se è un altro, solo le confermate.
    const amiciUrl = (userId === session.idGiocatore) 
        ? `/api/mie-amicizie` 
        : `/api/amicizie-confermate/${userId}`;

    // Fetch paralleli per ottimizzare i tempi di caricamento
    const [resProf, resStats, resStorico, resAmici] = await Promise.all([
        fetch(`/api/profilo/${userId}`),
        fetch(`/api/statistiche/${userId}`),
        fetch(`/api/storico/${userId}`),
        fetchAuth(amiciUrl) // Usiamo l'URL dinamico calcolato sopra
    ]);

    if (!resProf.ok) throw new Error(`Profilo non trovato (${resProf.status})`);
    const dataProfilo = await resProf.json();

    const dataStats   = resStats.ok  ? await resStats.json()  : { played: 0, won: 0, lost: 0, win_rate: 0 };
    const dataStorico = resStorico.ok ? await resStorico.json() : [];
    const amiciData   = resAmici.ok  ? await resAmici.json()  : { amici: [], inviate: [], ricevute: [] };

    const avatar = dataProfilo.avatar_url
        ? dataProfilo.avatar_url
        : `${AVATAR_BASE}?seed=${userId}&backgroundColor=1e1f21`;

    const amiciFormattati = amiciData.amici.map(a => ({
        userid: a.userid, name: a.user,
        avatar: `${AVATAR_BASE}?seed=${a.userid}&backgroundColor=1e1f21`,
        online: false, type: 'amico'
    }));
    const inviate = amiciData.inviate.map(a => ({
        userid: a.userid, name: a.user,
        avatar: `${AVATAR_BASE}?seed=${a.userid}&backgroundColor=1e1f21`,
        online: false, type: 'inviata'
    }));
    const ricevute = amiciData.ricevute.map(a => ({
        userid: a.userid, name: a.user,
        avatar: `${AVATAR_BASE}?seed=${a.userid}&backgroundColor=1e1f21`,
        online: false, type: 'ricevuta'
    }));

    // Formattazione data_registrazione (se la usi)
    const joinDate = typeof formatJoinDate === 'function' && dataProfilo.data_registrazione 
        ? formatJoinDate(dataProfilo.data_registrazione) 
        : '';

    return {
        id:       dataProfilo.userid,
        name:     dataProfilo.user,
        level:    dataProfilo.livello,
        xp:       dataProfilo.exp,
        bio:      dataProfilo.bio || '',
        avatar,
        banner_url: dataProfilo.banner_url || null,
        joinDate: joinDate,

        stats: {
            played:   dataStats.played   ?? 0,
            won:      dataStats.won      ?? 0,
            lost:     dataStats.lost     ?? 0,
            win_rate: dataStats.win_rate ?? 0
        },

        history: dataStorico,
        friends: [...ricevute, ...amiciFormattati, ...inviate]
    };
}

// ─── GESTIONE CLICK AMICIZIE ─────────────────────────────────────────────────

function initFriendActions() {
    const container = document.querySelector('.profile-friends-list');
    if (!container) return;

    // Rimuoviamo vecchi listener clonando il nodo
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    newContainer.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('.cg-search-add-btn');
        if (!actionButton || actionButton.disabled) return;

        const action = actionButton.dataset.action;
        const userid = actionButton.dataset.userid;
        if (!action || !userid) return;

        const originalHTML = actionButton.innerHTML;
        actionButton.disabled = true;
        actionButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

        try {
            const apiUrl = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
            const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE';

            const res = await fetchAuth(apiUrl, { method: apiMethod });

            if (!res.ok) throw new Error('Errore operazione');

            // Ricaricamento per aggiornare le UI
            initProfilePage();

        } catch (err) {
            console.error("Errore nell'azione amico:", err);
            actionButton.disabled = false;
            actionButton.innerHTML = originalHTML;
        }
    });
}
async function setupDynamicProfileButton(targetUserId, btnEditProfile) {
    try {
        // 1. Scarichiamo le NOSTRE amicizie per capire in che rapporti siamo
        const res = await fetchAuth('/api/mie-amicizie');
        if (!res.ok) throw new Error('Errore nel recupero amicizie');
        
        const mieAmicizie = await res.json();

        // 2. Cerchiamo il target nelle nostre tre liste
        const isAmico = mieAmicizie.amici.find(u => u.userid === targetUserId);
        const haInviatoLui = mieAmicizie.ricevute.find(u => u.userid === targetUserId);
        const hoInviatoIo = mieAmicizie.inviate.find(u => u.userid === targetUserId);

        // 3. Prepariamo il contenitore (cloniamo il bottone per azzerare i vecchi click)
        const container = btnEditProfile.parentNode;
        const newBtn = btnEditProfile.cloneNode(true);
        container.replaceChild(newBtn, btnEditProfile);

        // 4. Trasformiamo il bottone in base allo stato!
        if (isAmico) {
            newBtn.innerHTML = '<i class="bi bi-person-x"></i> Rimuovi Amicizia';
            newBtn.className = 'btn btn-outline-danger'; 
            newBtn.onclick = () => handleProfileFriendAction('rimuovi', targetUserId);
        } 
        else if (haInviatoLui) {
            // Se ce l'ha inviata lui, ci servono DUE bottoni: Accetta e Rifiuta!
            container.innerHTML = `
                <button class="btn btn-success me-2" onclick="handleProfileFriendAction('accetta', '${targetUserId}')">
                    <i class="bi bi-check-lg"></i> Accetta
                </button>
                <button class="btn btn-danger" onclick="handleProfileFriendAction('rifiuta', '${targetUserId}')">
                    <i class="bi bi-x-lg"></i> Rifiuta
                </button>
            `;
        } 
        else if (hoInviatoIo) {
            newBtn.innerHTML = '<i class="bi bi-clock-history"></i> Annulla Richiesta';
            newBtn.className = 'btn btn-outline-warning';
            newBtn.onclick = () => handleProfileFriendAction('annulla', targetUserId);
        } 
        else {
            // Nessun rapporto: bottone per aggiungere
            newBtn.innerHTML = '<i class="bi bi-person-plus"></i> Aggiungi Amico';
            newBtn.className = 'btn btn-primary';
            newBtn.onclick = () => handleProfileFriendAction('aggiungi', targetUserId);
        }

    } catch (err) {
        console.error("Impossibile determinare lo stato dell'amicizia:", err);
        btnEditProfile.remove(); // In caso di errore server, meglio nasconderlo
    }
}
// ─── Init ────────────────────────────────────────────────────────────────────
async function updateNavbar(playerData){
    // --- Navbar Profile ---
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('player-name', playerData.user);
    setText('player-level', playerData.livello);
    setText('player-cups', playerData.exp.toLocaleString('it-IT'));

    const navAvatar = document.getElementById('player-avatar');
    if (navAvatar) navAvatar.src = `${AVATAR_BASE}?seed=${playerData.userid}&backgroundColor=1e1f21`;

    const xpPercent = Math.min(100, (playerData.exp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100));
    setXpProgress(xpPercent);

}
async function initProfilePage() {
    console.log("🟢 1. Avvio initProfilePage...");
    const session = getSession();

    if (!session.isLoggedIn || !session.idGiocatore) {
        console.warn("⚠️ Nessuna sessione valida, reindirizzamento alla home.");
        window.location.href = '/index.html';
        return;
    }

    console.log(`👤 2. Sessione attiva. Mio ID: ${session.idGiocatore}`);

    const risposta = await fetch(`/api/profilo/${session.idGiocatore}`);
    
    // 2. Apri il pacchetto estraendo i dati veri (AWAIT e PARENTESI!)
    const playerData = await risposta.json();
    updateNavbar(playerData); // Aggiorna la navbar con i dati del giocatore

    try {
        const urlPath = window.location.pathname; 
        const pathParts = urlPath.split('/'); 
        console.log(`🔗 3. URL Letto: ${urlPath} | Parti:`, pathParts);
        
        let targetUserId = session.idGiocatore; // Di base, supponiamo di guardare il NOSTRO profilo

        // Se l'URL ha un nome (es: /profile/iavaaaaa), ALLORA e SOLO ALLORA facciamo la risoluzione
        if (pathParts.length >= 3 && pathParts[1] === 'profilo' && pathParts[2] !== '') {
            const targetNickname = decodeURIComponent(pathParts[2]); 
            console.log(`🔎 4. Trovato nickname nell'URL: "${targetNickname}". Inizio risoluzione...`);
            
            try {
                const res = await fetchAuth(`/api/profilo/nickname/${targetNickname}`);
                if (!res.ok) throw new Error('Utente non trovato nel DB');
                
                const data = await res.json();
                targetUserId = data.userid; 
                console.log(`✅ 5. Risoluzione completata! "${targetNickname}" corrisponde all'ID: ${targetUserId}`);

            } catch (err) {
                console.error(`❌ 5b. Errore risoluzione per "${targetNickname}":`, err);
                console.log("🔄 Reindirizzamento al mio profilo base per evitare loop...");
                // 👇 MODIFICATO QUI: ti rimanda a /profilo in caso di errore
                window.location.href = '/profilo'; 
                return; // Ferma tutto per evitare loop!
            }
        } else {
            console.log("🏠 4. Nessun nickname nell'URL. Carico il mio profilo personale.");
        }
        

        console.log(`📥 6. Chiamata a fetchFullProfileData per l'ID: ${targetUserId}`);
        const playerData = await fetchFullProfileData(targetUserId);
        console.log("📊 7. Dati profilo scaricati con successo:", playerData);

        console.log("🎨 8. Aggiornamento interfaccia...");
        updateProfileUI(playerData);
        initFriendActions();

        // Gestione bottone Aggiungi Amico
        if (typeof initProfileAddFriendButton === 'function') {
            initProfileAddFriendButton(playerData.id, playerData.name);
        }

        // 🔒 GESTIONE BOTTONE "MODIFICA PROFILO"
        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) {
            if (targetUserId === session.idGiocatore) {
                // È il MIO profilo: lo lascio com'è (Modifica Profilo), 
                // e si aprirà il modale grazie all'event listener in edit_profile.js
            } else {
                // È il profilo di un ALTRO: trasformo il bottone in azioni amicizia!
                await setupDynamicProfileButton(targetUserId, btnEditProfile);
            }
        }
        
    } catch (error) {
        console.error('[Profile Page] Errore caricamento dati:', error);
    }
}
initProfilePage();

document.addEventListener('click', (event) => {
    // Verifica se l'elemento cliccato (o un suo genitore) ha la classe 'friend-name'
    // NOTA: Se nell'altro file hai usato 'profile-friend-name', aggiungilo qui nel closest!
    const nameElement = event.target.closest('.friend-name') || event.target.closest('.profile-friend-name');
    
    if (nameElement) {
        // Estraiamo il testo pulito ignorando eventuali spazi vuoti
        const friendName = nameElement.textContent.trim();
        
        if (friendName) {
            // Reindirizza l'utente alla pagina del profilo dell'amico!
            window.location.href = `/profilo/${encodeURIComponent(friendName)}`;
        }
    }
});