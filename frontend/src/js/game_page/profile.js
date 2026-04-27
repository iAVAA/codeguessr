/**
 * CodeGuessr - profile.js
 * Caricamento profilo giocatore, XP ring, missioni, amici
 */

import { getSession } from '../managers/auth.js';

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';
const XP_PER_LEVEL = 1000;

// ─── XP Ring ─────────────────────────────────────────────────────────────────
// TODO: fix setXpProgress to be dynamic with XP from DB
function setXpProgress(pct) {
  const ring = document.getElementById('xp-ring-progress');
  if (!ring) return;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  setTimeout(() => {
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }, 400);
}

// ─── Template Builders ───────────────────────────────────────────────────────

function buildMissionHTML(mission) {
  const { title, current, target, reward, completed } = mission;
  const pct = Math.min(100, (current / target) * 100);

  return `
    <div class="side-item mission-item ${completed ? 'mission-completed' : ''}">
      <div class="side-item-content">
        <div class="mission-title ${completed ? 'text-decoration-line-through text-darcula-comment' : ''}">${title}</div>
        <div class="mission-progress-bar">
          <div class="progress-fill ${completed ? 'bg-success' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="mission-info">
          <span class="mission-status">
            ${completed ? `<span class="text-success">${current}/${target}</span>` : `<span>${current}/${target}</span>`}
          </span>
          <span class="mission-reward">
            ${completed ? `<i class="bi bi-check-circle-fill"></i> ${reward}` : reward}
          </span>
        </div>
      </div>
    </div>`;
}


// ─── Costruzione HTML ────────────────────────────────────────────────────────
function buildFriendHTML(friend) {
  const { userid, name, avatar, online, type } = friend;
  
  let filterStyle = '';
  let statusDotClass = 'offline';
  let statusColor = 'text-darcula-comment';
  let statusText = '';
  let rightContent = '';

  // 1. SE È GIÀ AMICO
  if (type === 'amico') {
    filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
    statusDotClass = online ? 'online' : 'offline';
    statusColor = online ? 'text-darcula-green' : 'text-darcula-comment';
    statusText = online ? 'Online' : 'Offline';
    rightContent = online
      ? `<button class="btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>`
      : '';
  } 
  // 2. SE È UNA RICHIESTA RICEVUTA
  else if (type === 'ricevuta') {
    statusColor = 'text-warning'; // Colore per farla risaltare
    statusText = 'Nuova richiesta';
    rightContent = `
      <div class="d-flex gap-1" bis_skin_checked="1">
        <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" style="background-color: #198754; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Accetta">
          <i class="bi bi-check-lg"></i>
        </button>
        <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Rifiuta">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    `;
  } 
  // 3. SE È UNA RICHIESTA INVIATA
  else if (type === 'inviata') {
    statusText = 'In attesa...';
    rightContent = `
      <button disabled style="opacity: 0.6; cursor: not-allowed; padding: 2px 8px; border: 1px solid #555; background: transparent; color: #888; border-radius: 4px;">
        <i class="bi bi-clock"></i>
      </button>
    `;
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

// ─── Render Functions ────────────────────────────────────────────────────────
function renderList(selector, items, buildFn, emptyMessage) {
  const container = document.querySelector(selector);
  if (!container) return;

  if (!items?.length) {
    container.innerHTML = `<div class="text-center text-darcula-comment py-3"><small>${emptyMessage}</small></div>`;
    return;
  }

  container.innerHTML = items.map(buildFn).join('');
}

function renderMissions(missions) {
  renderList('.mission-list', missions, buildMissionHTML, 'Nessuna missione disponibile.');
}

function renderFriends(friends) {
  // Calcoliamo quanti "veri amici" sono online (ignorando le richieste)
  const onlineCount = friends?.filter((f) => f.type === 'amico' && f.online).length ?? 0;
  const badge = document.getElementById('friends-online-badge');
  if (badge) badge.textContent = `${onlineCount} Online`;

  // Renderizziamo tutto nel div .friends-list
  renderList('.friends-list', friends, buildFriendHTML, 'Nessun amico o richiesta al momento.');
}

// ─── UI State Helpers ────────────────────────────────────────────────────────
function showProfile() {
  document.getElementById('profile-dropdown-wrapper')?.classList.remove('d-none');
}

function updateProfileUI({ name, level, cups, xpPercent, avatar, missions, friends }) {
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText('player-name', name);
  setText('hero-welcome-name', name);
  setText('player-level', level);
  setText('player-cups', cups.toLocaleString('it-IT'));

  const avatarEl = document.getElementById('player-avatar');
  if (avatarEl) avatarEl.src = avatar;

  // Presumo tu abbia una funzione setXpProgress altrove nel tuo codice
  if (typeof setXpProgress === 'function') setXpProgress(xpPercent);
  
  // Se hai una logica per le missioni, la chiamo qui
  if (typeof buildMissionHTML === 'function') renderMissions(missions);

  renderFriends(friends);
}

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function fetchPlayerData(idGiocatore) {
  const res = await fetch(`/api/profilo/${idGiocatore}`);
  if (!res.ok) throw new Error(`Profilo non trovato (${res.status})`);
  return res.json();
}

async function fetchPlayerAmici(idGiocatore) {
  const token = localStorage.getItem('supabaseToken');
  if (!token) throw new Error("Utente non autenticato.");

  const res1 = await fetch('/api/mie-amicizie', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    }
  });
  
  if (!res1.ok) throw new Error(`Amici non trovati (${res1.status})`);
  const amiciData = await res1.json();

  // Aggiungiamo i tipi per permettere all'HTML di differenziarli
  const amiciFormattati = amiciData.amici.map(amico => ({
    userid: amico.userid,
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: amico.online,
    type: 'amico'
  }));

  const amiciInviatiFormattati = amiciData.inviate.map(amico => ({
    userid: amico.userid,
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: false, // Meglio nascondere lo stato di chi non ha ancora accettato
    type: 'inviata'
  }));

  const amiciRicevutiFormattati = amiciData.ricevute.map(amico => ({
    userid: amico.userid,
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: false,
    type: 'ricevuta'
  }));

  return {
    amici: amiciFormattati,
    inviate: amiciInviatiFormattati,
    ricevute: amiciRicevutiFormattati
  };
}

function buildPlayerFromAPI(data, idGiocatore, amiciData) {
  // Nota: XP_PER_LEVEL deve essere definita altrove (es. costanti globali)
  const xpBase = typeof XP_PER_LEVEL !== 'undefined' ? XP_PER_LEVEL : 1000;

  return {
    name: data.user,
    level: data.livello,
    cups: data.exp,
    xpPercent: Math.min(100, (data.exp % xpBase) / (xpBase / 100)),
    avatar: `${AVATAR_BASE}?seed=${idGiocatore}&backgroundColor=1e1f21`,
    missions: [
      { title: 'Gioca 5 partite', current: 2, target: 5, reward: '+50 XP', completed: false },
    ],
    // Mettiamo le ricevute per prime così l'utente le nota subito!
    friends: [...amiciData.ricevute, ...amiciData.amici, ...amiciData.inviate]
  };
}

// ─── GESTIONE CLICK NELLA SIDEBAR (Accetta/Rifiuta) ───────────────────────────
function initSidebarActions() {
  const friendsListContainer = document.querySelector('.friends-list');
  if (!friendsListContainer) return;

  friendsListContainer.addEventListener('click', async (event) => {
      // Cerca il bottone cliccato
      const actionButton = event.target.closest('.cg-search-add-btn');
      if (!actionButton || actionButton.disabled) return;

      const action = actionButton.dataset.action; // 'accetta' o 'rifiuta'
      const userid = actionButton.dataset.userid;
      if (!action || !userid) return;

      const originalHTML = actionButton.innerHTML;
      actionButton.disabled = true;
      actionButton.innerHTML = '...';

      try {
          const token = localStorage.getItem('supabaseToken');
          
          // Costruiamo la chiamata dinamica
          const apiUrl = action === 'accetta' ? `/api/accetta-richiesta/${userid}` : `/api/rifiuta-richiesta/${userid}`;
          
          // Se la tua rotta di accettazione è POST o PUT, modificalo qui:
          const apiMethod = action === 'accetta' ? 'PUT' : 'DELETE'; 

          const res = await fetch(apiUrl, {
              method: apiMethod,
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
              }
          });

          if (!res.ok) throw new Error("Errore durante l'operazione al database.");

          // SUCCESSO! Ricarichiamo semplicemente i dati, aggiornerà tutto visivamente
          await loadPlayerData();

          // Notifica opzionale
          if (typeof showToast === 'function') {
            showToast(action === 'accetta' ? "Richiesta accettata!" : "Richiesta rifiutata", "green");
          }

      } catch (err) {
          console.error("Errore:", err);
          if (typeof showToast === 'function') showToast("Impossibile completare l'operazione.", "red");
          actionButton.disabled = false;
          actionButton.innerHTML = originalHTML;
      }
  });
}

// ─── Inizializzazione Globale ──────────────────────────────────────────────────
async function loadPlayerData() {
  // Presumo tu abbia una funzione getSession altrove (auth.js)
  if (typeof getSession !== 'function') return; 
  
  const { isLoggedIn, idGiocatore } = getSession();

  if (!isLoggedIn || !idGiocatore) {
    window.location.href = '/index.html';
    return;
  }

  showProfile();

  try {
    const apiData = await fetchPlayerData(idGiocatore);
    const amiciData = await fetchPlayerAmici(idGiocatore);
    
    const player = buildPlayerFromAPI(apiData, idGiocatore, amiciData);
    updateProfileUI(player);
  } catch (err) {
    console.error('[Profile] Errore caricamento profilo:', err);
  }
}

// Quando la pagina ha finito di caricare tutto l'HTML, facciamo partire i motori
document.addEventListener('DOMContentLoaded', () => {
  loadPlayerData();
  initSidebarActions(); // Ascoltiamo i click sui bottoni della sidebar
});