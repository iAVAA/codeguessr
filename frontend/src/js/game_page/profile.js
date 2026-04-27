/**
 * CodeGuessr - profile.js (game_page)
 * Caricamento profilo giocatore, XP ring, missioni dinamiche da DB, amici.
 */

import { getSession, fetchAuth } from '../managers/auth.js';

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';
const XP_PER_LEVEL = 1000;

// ─── XP Ring ─────────────────────────────────────────────────────────────────

function setXpProgress(pct) {
  const ring = document.getElementById('xp-ring-progress');
  if (!ring) return;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  setTimeout(() => {
    ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }, 400);
}

// ─── Missioni Dinamiche ───────────────────────────────────────────────────────

/**
 * Genera le missioni attive basandosi sulle statistiche reali del giocatore.
 * Non richiede tabella DB separata: i target sono fissi, i progressi sono reali.
 */
function buildDynamicMissions(stats) {
  return [
    {
      title: 'Gioca 5 partite',
      current: Math.min(stats.played, 5),
      target: 5,
      reward: '+50 XP',
      completed: stats.played >= 5
    },
    {
      title: 'Vinci la tua prima partita',
      current: Math.min(stats.won, 1),
      target: 1,
      reward: '+30 XP',
      completed: stats.won >= 1
    },
    {
      title: 'Vinci 3 partite',
      current: Math.min(stats.won, 3),
      target: 3,
      reward: '+100 XP',
      completed: stats.won >= 3
    },
    {
      title: 'Gioca 10 partite',
      current: Math.min(stats.played, 10),
      target: 10,
      reward: '+150 XP',
      completed: stats.played >= 10
    },
    {
      title: 'Raggiungi il 50% di win rate',
      current: stats.win_rate >= 50 ? 1 : 0,
      target: 1,
      reward: 'Badge Pro',
      completed: stats.win_rate >= 50
    }
  ];
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
            ${completed
              ? `<span class="text-success">${current}/${target}</span>`
              : `<span>${current}/${target}</span>`}
          </span>
          <span class="mission-reward">
            ${completed ? `<i class="bi bi-check-circle-fill"></i> ${reward}` : reward}
          </span>
        </div>
      </div>
    </div>`;
}

function buildFriendHTML(friend) {
  const { userid, name, avatar, online, type } = friend;
  
  let filterStyle = '';
  let statusDotClass = 'offline';
  let statusColor = 'text-darcula-comment';
  let statusText = '';
  let rightContent = '';

  if (type === 'amico') {
    filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
    statusDotClass = online ? 'online' : 'offline';
    statusColor = online ? 'text-darcula-green' : 'text-darcula-comment';
    statusText = online ? 'Online' : 'Offline';
    rightContent = online
      ? `<button class="btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>`
      : '';
  } else if (type === 'ricevuta') {
    statusDotClass = 'online';
    statusColor = 'text-warning';
    statusText = 'Nuova richiesta';
    rightContent = `
      <div class="d-flex gap-1">
        <button class="cg-search-add-btn" data-action="accetta" data-username="${name}" data-userid="${userid}" style="background-color: #198754; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Accetta">
          <i class="bi bi-check-lg"></i>
        </button>
        <button class="cg-search-add-btn" data-action="rifiuta" data-username="${name}" data-userid="${userid}" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 2px 8px;" title="Rifiuta">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    `;
  } else if (type === 'inviata') {
    statusText = 'In attesa...';
    rightContent = `
      <button disabled style="opacity: 0.6; cursor: not-allowed; padding: 2px 8px; border: 1px solid #555; background: transparent; color: #888; border-radius: 4px;">
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
  const onlineCount = friends?.filter(f => f.type === 'amico' && f.online).length ?? 0;
  const badge = document.getElementById('friends-online-badge');
  if (badge) badge.textContent = `${onlineCount} Online`;

  renderList('.friends-list', friends, buildFriendHTML, 'Nessun amico o richiesta al momento.');
}

// ─── UI State ────────────────────────────────────────────────────────────────

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

  setXpProgress(xpPercent);
  renderMissions(missions);
  renderFriends(friends);
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchPlayerData(idGiocatore) {
  const res = await fetch(`/api/profilo/${idGiocatore}`);
  if (!res.ok) throw new Error(`Profilo non trovato (${res.status})`);
  return res.json();
}

async function fetchPlayerStats(idGiocatore) {
  const res = await fetch(`/api/statistiche/${idGiocatore}`);
  if (!res.ok) return { played: 0, won: 0, lost: 0, win_rate: 0 };
  return res.json();
}

async function fetchPlayerAmici(idGiocatore) {
  const token = localStorage.getItem('supabaseToken');
  if (!token) return { amici: [], inviate: [], ricevute: [] };

  const res = await fetchAuth('/api/mie-amicizie');

  if (!res.ok) return { amici: [], inviate: [], ricevute: [] };
  const amiciData = await res.json();

  const makeEntry = (amico, type) => ({
    userid: amico.userid,
    name:   amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: false,
    type
  });

  return {
    amici:    amiciData.amici.map(a => makeEntry(a, 'amico')),
    inviate:  amiciData.inviate.map(a => makeEntry(a, 'inviata')),
    ricevute: amiciData.ricevute.map(a => makeEntry(a, 'ricevuta'))
  };
}

function buildPlayerFromAPI(data, idGiocatore, amiciData, stats) {
  const xpBase = XP_PER_LEVEL;

  // Avatar: usa avatar_url dal DB se disponibile, altrimenti DiceBear
  const avatar = data.avatar_url
    ? data.avatar_url
    : `${AVATAR_BASE}?seed=${idGiocatore}&backgroundColor=1e1f21`;

  return {
    name:       data.user,
    level:      data.livello,
    cups:       data.exp,
    xpPercent:  Math.min(100, (data.exp % xpBase) / (xpBase / 100)),
    avatar,
    missions:   buildDynamicMissions(stats),
    friends:    [...amiciData.ricevute, ...amiciData.amici, ...amiciData.inviate]
  };
}

// ─── GESTIONE CLICK SIDEBAR (Accetta/Rifiuta) ─────────────────────────────────

function initSidebarActions() {
  const friendsListContainer = document.querySelector('.friends-list');
  if (!friendsListContainer) return;

  friendsListContainer.addEventListener('click', async (event) => {
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

      if (!res.ok) throw new Error("Errore durante l'operazione al database.");

      // Ricaricamento dati
      await loadPlayerData();

      if (typeof showToast === 'function') {
        showToast(action === 'accetta' ? "Richiesta accettata!" : "Richiesta rifiutata", action === 'accetta' ? "green" : "red");
      }

    } catch (err) {
      console.error("Errore:", err);
      if (typeof showToast === 'function') showToast("Impossibile completare l'operazione.", "red");
      actionButton.disabled = false;
      actionButton.innerHTML = originalHTML;
    }
  });
}

// ─── Inizializzazione ─────────────────────────────────────────────────────────

async function loadPlayerData() {
  const { isLoggedIn, idGiocatore } = getSession();

  if (!isLoggedIn || !idGiocatore) {
    window.location.href = '/index.html';
    return;
  }

  showProfile();

  try {
    // Fetch parallelo: profilo + statistiche + amici
    const [apiData, stats, amiciData] = await Promise.all([
      fetchPlayerData(idGiocatore),
      fetchPlayerStats(idGiocatore),
      fetchPlayerAmici(idGiocatore)
    ]);

    const player = buildPlayerFromAPI(apiData, idGiocatore, amiciData, stats);
    updateProfileUI(player);
  } catch (err) {
    console.error('[Profile] Errore caricamento profilo:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPlayerData();
  initSidebarActions();
});