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

function buildFriendHTML(friend) {
  const { name, avatar, online } = friend;
  const filterStyle = online ? '' : 'style="filter:grayscale(100%);opacity:0.7;"';
  const challengeBtn = online
    ? `<button class="btn-challenge" aria-label="Sfida ${name}"><i class="bi bi-swords"></i> Sfida</button>`
    : '';

  return `
    <div class="side-item friend-item ${online ? '' : 'offline-item'}">
      <div class="friend-info">
        <div class="friend-avatar-wrapper">
          <img src="${avatar}" alt="${name}" class="friend-avatar" ${filterStyle}>
          <div class="status-dot ${online ? 'online' : 'offline'}"></div>
        </div>
        <div class="friend-details">
          <span class="friend-name">${name}</span>
          <span class="friend-status-text ${online ? 'text-darcula-green' : 'text-darcula-comment'}">${online ? 'Online' : 'Offline'}</span>
        </div>
      </div>
      ${challengeBtn}
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
  const onlineCount = friends?.filter((f) => f.online).length ?? 0;
  const badge = document.getElementById('friends-online-badge');
  if (badge) badge.textContent = `${onlineCount} Online`;

  renderList('.friends-list', friends, buildFriendHTML, 'Aggiungi amici per sfidarli.');
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
async function fetchPlayerAmici(idGiocatore) {

  const res1 = await fetch(`/api/amici/${idGiocatore}`);
  if (!res1.ok) throw new Error(`Amici non trovati (${res1.status})`);
  const amiciData = await res1.json();

  const amiciFormattati = amiciData.amici.map(amico => ({
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: "online"
  }));

  const amiciInviatiFormattati = amiciData.inviate.map(amico => ({
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: amico.online
  }));

  const amiciRicevutiFormattati = amiciData.ricevute.map(amico => ({
    name: amico.user,
    avatar: `${AVATAR_BASE}?seed=${amico.userid}&backgroundColor=1e1f21`,
    online: amico.online
  }));

  return {
    amici: amiciFormattati,
    inviate: amiciInviatiFormattati,
    ricevute: amiciRicevutiFormattati
  };

}

function buildPlayerFromAPI(data, idGiocatore, amiciData) {
  return {
    name: data.user,
    level: data.livello,
    cups: data.exp,
    xpPercent: Math.min(100, (data.exp % XP_PER_LEVEL) / (XP_PER_LEVEL / 100)),
    avatar: `${AVATAR_BASE}?seed=${idGiocatore}&backgroundColor=1e1f21`,
    missions: [
      { title: 'Gioca 5 partite', current: 2, target: 5, reward: '+50 XP', completed: false },
    ],
    friends: amiciData.amici
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadPlayerData() {
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
    alert('Errore nel caricamento del profilo. Riprova più tardi.');
  }
}

loadPlayerData();
