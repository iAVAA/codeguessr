/**
 * CodeGuessr - auth.js
 * Gestisce login, logout e utility per cookie/localStorage
 */

// ─── Cookie Utilities ────────────────────────────────────────────────────────

export function getCookie(name) {
  const parts = `; ${document.cookie}`.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

export function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

export function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
}

// ─── Session Helpers ─────────────────────────────────────────────────────────

export function getSession() {
  return {
    isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
    idGiocatore: localStorage.getItem('id_giocatore'),
  };
}

export function clearSession() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('id_giocatore');
}

// ─── Test Helper (console) ───────────────────────────────────────────────────

window.simulateLogin = function () {
  const mockUser = {
    name: 'Signor S',
    level: 42,
    cups: 1240,
    xpPercent: 75,
    avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=codeguessr&backgroundColor=1e1f21`,
    missions: [
      { title: 'Gioca 5 partite',           current: 2, target: 5, reward: '+50 XP',   completed: false },
      { title: 'Vinci 1 partita multiplayer', current: 0, target: 1, reward: '+100 XP', completed: false },
      { title: 'Aggiungi un amico',           current: 1, target: 1, reward: 'Fatto',   completed: true  },
    ],
    friends: [
      { name: 'Marco99',  avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=Marco99&backgroundColor=1e1f21',  online: true  },
      { name: 'DevGirl',  avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=DevGirl&backgroundColor=1e1f21',  online: true  },
      { name: 'AlexWeb',  avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=AlexWeb&backgroundColor=2d2d2d',  online: false },
    ],
  };
  setCookie('codeguessr_user', JSON.stringify(mockUser), 7);
  window.location.reload();
};

// ─── UI Binding ──────────────────────────────────────────────────────────────

function initAuth() {
  document.getElementById('menu-btn-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = '/index.html';
  });

  // Bottoni header login/registrati (fallback, normalmente nascosti)
  ['btn-header-login', 'btn-header-signup'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/index.html';
    });
  });

  // Dropdown mobile: toggle al click, chiudi cliccando fuori
  const profileDropdownWrapper = document.getElementById('profile-dropdown-wrapper');
  if (profileDropdownWrapper) {
    profileDropdownWrapper.addEventListener('click', (e) => {
      if (e.target.closest('.dropdown-item')) return;
      profileDropdownWrapper.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdownWrapper.contains(e.target)) {
        profileDropdownWrapper.classList.remove('active');
      }
    });
  }
}

initAuth();
