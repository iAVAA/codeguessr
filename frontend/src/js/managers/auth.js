/*
    FILE: auth.js
    DESCRIPTION: Manager dell'autenticazione. Espone utility per gestire la sessione utente (lettura e pulizia localStorage).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

/* ===== GESTORI DI SESSIONE ===== */

/**
 * Recupera le informazioni della sessione corrente salvate nel localStorage.
 * @returns {{isLoggedIn: boolean, idGiocatore: string|null, token: string|null}}
*/
export function getSession() {
    return {
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
        idGiocatore: localStorage.getItem('id_giocatore'),
        token: localStorage.getItem('supabaseToken'),
    };
}

/**
 * Distrugge la sessione corrente rimuovendo tutte le chiavi relative
 * all'autenticazione dal localStorage.
 */
export function clearSession() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('id_giocatore');
    localStorage.removeItem('supabaseToken');
    localStorage.removeItem('supabaseRefreshToken');
}

/* ===== GESTIONE TOKEN (JWT) ===== */

/**
 * Tenta di rinnovare l'access_token usando il refresh_token salvato.
 * Viene chiamata automaticamente da fetchAuth() quando riceve un 401.
 * 
 * @returns {Promise<string|null>} Il nuovo access_token, oppure null se fallisce.
*/
export async function refreshToken() {
    const refresh_token = localStorage.getItem('supabaseRefreshToken');
    
    // Se non abbiamo un refresh token, l'utente è permanentemente non autenticato
    if (!refresh_token) return null;

    try {
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token })
        });

        if (!response.ok) {
            console.warn('[auth.js] Refresh fallito: sessione definitivamente scaduta. Forza logout.');
            clearSession();
            window.location.href = '/index';
            return null;
        }

        const data = await response.json();
        
        // Salva i nuovi token per le chiamate future
        localStorage.setItem('supabaseToken', data.token);
        localStorage.setItem('supabaseRefreshToken', data.refresh_token);
        
        return data.token;
    } catch (err) {
        console.error('[auth.js] Errore di rete durante il refresh token:', err);
        return null;
    }
}

/**
 * Wrapper di 'fetch' che inietta automaticamente il token Bearer nell'header Authorization.
 * Se la chiamata fallisce per token scaduto (HTTP 401), esegue trasparentemente
 * il processo di refresh del token e ripete la richiesta originale.
 *
 * @param {string} url - Endpoint da chiamare
 * @param {RequestInit} options - Opzioni della fetch standard
 * @returns {Promise<Response>} Risposta della fetch
*/
export async function fetchAuth(url, options = {}) {
    let token = localStorage.getItem('supabaseToken');

    // Helper per costruire la richiesta con il token attuale
    const makeRequest = (jwtToken) => fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            'Authorization': `Bearer ${jwtToken}`
        }
    });

    // Prima esecuzione
    let response = await makeRequest(token);

    // Se il token risulta scaduto (Unauthorized), tenta il ripristino
    if (response.status === 401) {
        console.warn(`[auth.js] Token scaduto chiamando ${url}, tentativo di refresh in corso...`);

        const newToken = await refreshToken();

        // Se il refresh fallisce o non abbiamo un refresh token, ritorniamo il 401 per farlo gestire al chiamante
        if (!newToken) return response; 

        // Se abbiamo un nuovo token, ripetiamo la chiamata originale
        console.log(`[auth.js] Refresh completato con successo. Ripeto la chiamata a ${url}`);
        response = await makeRequest(newToken);
    }

    return response;
}

/**
 * Inizializza il timer per l'invio dell'heartbeat di presenza online.
 * @param {number} [intervalMs=5000] - Intervallo in millisecondi.
 */
export function startHeartbeat(intervalMs = 5000) {
    if (window._heartbeatInit) return;
    window._heartbeatInit = true;

    const sendHeartbeat = () => fetchAuth('/api/heartbeat', { method: 'POST' }).catch(() => {});
    setInterval(sendHeartbeat, intervalMs);
    sendHeartbeat();
}

/* === EVENT LISTENER E BINDING UI === */

/**
 * Aggancia gli eventi di navigazione e logout agli elementi dell'interfaccia globale (NAVBAR, etc...)
*/
function initAuthUI() {
    // Bottone Logout nel menu a tendina
    const logoutBtn = document.getElementById('menu-btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearSession();
            window.location.href = '/index';
        });
    }

    // Bottoni di login/signup fallback nell'header (solitamente nascosti da CSS se loggati)
    const headerBtns = ['btn-header-login', 'btn-header-signup'];
    headerBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/index';
            });
        }
    });

    // Gestione apertura/chiusura del dropdown profilo (mobile & desktop)
    const profileDropdownWrapper = document.getElementById('profile-dropdown-wrapper');
    if (profileDropdownWrapper) {
        
        // Toggle sul wrapper
        profileDropdownWrapper.addEventListener('click', (e) => {
            // Se clicco su un elemento interno del menu, lascia propagare e non togglare
            if (e.target.closest('.dropdown-item')) return;
            profileDropdownWrapper.classList.toggle('active');
        });

        // Chiudi se si clicca fuori dal dropdown
        document.addEventListener('click', (e) => {
            if (!profileDropdownWrapper.contains(e.target)) {
                profileDropdownWrapper.classList.remove('active');
            }
        });
    }
}

// Inizializza automaticamente i listener UI quando il modulo viene importato
initAuthUI();