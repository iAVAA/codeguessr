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
    token: localStorage.getItem('supabaseToken'),
  };
}

export function clearSession() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('id_giocatore');
  localStorage.removeItem('supabaseToken');
  localStorage.removeItem('supabaseRefreshToken');
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Rinnova l'access_token usando il refresh_token salvato.
 * @returns {string|null} Il nuovo access_token, o null se il refresh fallisce.
 */
export async function refreshToken() {
  const refreshToken = localStorage.getItem('supabaseRefreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) {
      // Refresh fallito: sessione definitivamente scaduta, forza logout
      clearSession();
      window.location.href = '/index.html';
      return null;
    }

    const data = await res.json();
    localStorage.setItem('supabaseToken', data.token);
    localStorage.setItem('supabaseRefreshToken', data.refresh_token);
    return data.token;

  } catch (err) {
    console.error('[Auth] Errore refresh token:', err);
    return null;
  }
}

/**
 * Wrapper di fetch che aggiunge automaticamente il Bearer token
 * e lo rinnova trasparentemente se è scaduto (risposta 401).
 *
 * Uso: await fetchAuth('/api/profilo', { method: 'PUT', body: ... })
 */
export async function fetchAuth(url, options = {}) {
  let token = localStorage.getItem('supabaseToken');

  const makeRequest = (t) => fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      'Authorization': `Bearer ${t}`
    }
  });

  let res = await makeRequest(token);

  // Se il token è scaduto, prova a rinnovarlo e riprova la richiesta
  if (res.status === 401) {
    console.warn('[Auth] Token scaduto, tentativo di refresh...');
    const newToken = await refreshToken();
    if (!newToken) return res; // Refresh fallito, ritorna la risposta 401
    res = await makeRequest(newToken);
  }

  return res;
}


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
