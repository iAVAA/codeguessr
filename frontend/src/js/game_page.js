/**
 * CodeGuessr - Game Page (Lobby)
 * Handles: theme toggle, XP ring animation, profile data, button interactions
 */
// TODO: Pulire e provare ad accorciare codice inutile e suddividere il js in piu script, sta diventando troppo grande e ingestibile
// TODO: Sistemare responsiveness dei bottoni accedi e registrati in alto a destra
document.addEventListener('DOMContentLoaded', () => {

  // ─── Theme Toggle ───────────────────────────────────────────────────────────

  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const STORAGE_KEY = 'codeguessr-theme';

  /** Apply theme ('dark' | 'light') */
  function applyTheme(theme) {
    if (theme === 'light') {
      html.classList.add('light-mode');
    } else {
      html.classList.remove('light-mode');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /** Toggle between dark and light */
  function toggleTheme() {
    const current = html.classList.contains('light-mode') ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Restore saved preference or system preference
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    applyTheme('light');
  } else {
    applyTheme('dark');
  }

  themeToggle?.addEventListener('click', toggleTheme);



  // ─── Dynamic Player Data (Cookies) ──────────────────────────────────────────
  // For testing use simulateLogin() on console
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
  }

  function deleteCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/;';
  }

  // Exposed globally to easily test login
  window.simulateLogin = function () {
    const mockUser = {
      name: 'Signor S',
      level: 42,
      cups: 1240,
      xpPercent: 75,
      avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=codeguessr&backgroundColor=1e1f21`,
      missions: [
        { title: 'Gioca 5 partite', current: 2, target: 5, reward: '+50 XP', completed: false },
        { title: 'Vinci 1 partita multiplayer', current: 0, target: 1, reward: '+100 XP', completed: false },
        { title: 'Aggiungi un amico', current: 1, target: 1, reward: 'Fatto', completed: true }
      ],
      friends: [
        { name: 'Marco99', avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=Marco99&backgroundColor=1e1f21', online: true },
        { name: 'DevGirl', avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=DevGirl&backgroundColor=1e1f21', online: true },
        { name: 'AlexWeb', avatar: 'https://api.dicebear.com/8.x/bottts-neutral/svg?seed=AlexWeb&backgroundColor=2d2d2d', online: false }
      ]
    };
    setCookie('codeguessr_user', JSON.stringify(mockUser), 7);
    window.location.reload();
  };

  function setXpProgress(pct) {
    const ring = document.getElementById('xp-ring-progress');
    if (!ring) return;
    const r = 17;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;

    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
    }, 400);
  }

  function renderMissions(missions) {
    const container = document.querySelector('.mission-list');
    if (!container) return;
    container.innerHTML = '';

    if (!missions || missions.length === 0) {
      container.innerHTML = `<div class="text-center text-darcula-comment py-3"><small>Nessuna missione disponibile.</small></div>`;
      return;
    }

    missions.forEach(m => {
      const pct = Math.min(100, Math.max(0, (m.current / m.target) * 100));
      const customClass = m.completed ? 'mission-completed' : '';
      const titleClass = m.completed ? 'text-decoration-line-through text-darcula-comment' : '';
      const statusText = m.completed ? `<span class="text-success">${m.current}/${m.target}</span>` : `<span>${m.current}/${m.target}</span>`;
      const rewardText = m.completed ? `<i class="bi bi-check-circle-fill"></i> ${m.reward}` : m.reward;

      container.innerHTML += `
      <div class="side-item mission-item ${customClass}">
          <div class="side-item-content">
              <div class="mission-title ${titleClass}">${m.title}</div>
              <div class="mission-progress-bar">
                  <div class="progress-fill ${m.completed ? 'bg-success' : ''}" style="width: ${pct}%;"></div>
              </div>
              <div class="mission-info">
                  <span class="mission-status">${statusText}</span>
                  <span class="mission-reward">${rewardText}</span>
              </div>
          </div>
      </div>`;
    });
  }

  function renderFriends(friends) {
    const container = document.querySelector('.friends-list');
    const badgeContainer = document.getElementById('friends-online-badge');
    
    if (!container) return;
    container.innerHTML = '';
    
    if (!friends || friends.length === 0) {
        if (badgeContainer) badgeContainer.textContent = '0 Online';
        container.innerHTML = `<div class="text-center text-darcula-comment py-3"><small>Aggiungi amici per sfidarli.</small></div>`;
        return;
    }

    let onlineCount = 0;

    friends.forEach(f => {
        if (f.online) onlineCount++;
        const customClass = f.online ? '' : 'offline-item';
        const statusIconClass = f.online ? 'online' : 'offline';
        const nameClass = f.online ? '' : '';
        const statusClass = f.online ? 'text-darcula-green' : 'text-darcula-comment';
        const statusText = f.online ? 'Online' : 'Offline';
        const filterStyle = f.online ? '' : 'style="filter: grayscale(100%); opacity: 0.7;"';
        
        const buttonHTML = f.online 
            ? `<button class="btn-sfida" aria-label="Sfida ${f.name}"><i class="bi bi-swords"></i> Sfida</button>` 
            : ``;

        container.innerHTML += `
        <div class="side-item friend-item ${customClass}">
            <div class="friend-info">
                <div class="friend-avatar-wrapper">
                    <img src="${f.avatar}" alt="${f.name}" class="friend-avatar" ${filterStyle}>
                    <div class="status-dot ${statusIconClass}"></div>
                </div>
                <div class="friend-details">
                    <span class="friend-name ${nameClass}">${f.name}</span>
                    <span class="friend-status-text ${statusClass}">${statusText}</span>
                </div>
            </div>
            ${buttonHTML}
        </div>`;
    });

    if (badgeContainer) badgeContainer.textContent = `${onlineCount} Online`;
  }

  async function loadPlayerData() {
    const nameEl = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const cupsEl = document.getElementById('player-cups');
    const avatarEl = document.getElementById('player-avatar');
    
    const authWrapper = document.getElementById('auth-buttons-wrapper');
    const profileWrapper = document.getElementById('profile-dropdown-wrapper');

    // 1. Leggiamo i dati VERI dal localStorage
    const isLogged = localStorage.getItem('isLoggedIn');
    const idGiocatore = localStorage.getItem('id_giocatore');

    if (isLogged === 'true' && idGiocatore) {
        // L'UTENTE È VERAMENTE LOGGATO!
        if (authWrapper) {
            authWrapper.classList.remove('d-flex');
            authWrapper.classList.add('d-none');
        }
        if (profileWrapper) {
            profileWrapper.classList.remove('d-none');
        }

        console.log("Bentornato! Il tuo ID segreto è:", idGiocatore);

        try {
            // 1. Facciamo una chiamata al nostro server passando l'ID
            const risposta = await fetch(`/api/profilo/${idGiocatore}`);
            
            if (!risposta.ok) {
                throw new Error("Profilo non trovato sul server");
            }

            // 2. Trasformiamo la risposta in un oggetto JavaScript
            const datiVeri = await risposta.json();

            // 3. Calcoliamo la barra dell'XP (es. ogni livello richiede 1000 XP)
            const percentualeXp = Math.min(100, (datiVeri.exp % 1000) / 10);

            // 4. Inseriamo i dati VERI nell'oggetto PLAYER!
            const PLAYER = {
                name: datiVeri.nickname,
                level: datiVeri.livello,
                cups: datiVeri.exp, // Usiamo l'exp totale come se fossero "coppe" per ora
                xpPercent: percentualeXp,
                avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${idGiocatore}&backgroundColor=1e1f21`,
                missions: [
                  { title: 'Gioca 5 partite', current: 2, target: 5, reward: '+50 XP', completed: false }
                ],
                friends: []
            };

            // 5. Aggiorniamo l'HTML
            if (nameEl) nameEl.textContent = PLAYER.name;
            if (levelEl) levelEl.textContent = PLAYER.level;
            if (cupsEl) cupsEl.textContent = PLAYER.cups.toLocaleString('it-IT');
            if (avatarEl) avatarEl.src = PLAYER.avatar;

            setXpProgress(PLAYER.xpPercent);
            renderMissions(PLAYER.missions);
            renderFriends(PLAYER.friends);

        } catch (errore) {
            console.error("Ops, problema col caricamento profilo:", errore);
            alert("Errore nel caricamento del profilo. Riprova più tardi.");
        }

    } else {
        // L'UTENTE NON È LOGGATO! (È un intruso)
        // Lo buttiamo fuori e lo rimandiamo alla pagina di login
        window.location.href = '/index.html'; 
    }
  }

  // --- Dropdown Mobile Setup --- //
  const profileDropdownWrapper = document.getElementById('profile-dropdown-wrapper');
  if (profileDropdownWrapper) {
    profileDropdownWrapper.addEventListener('click', (e) => {
      // Evita innesco multiplo se clicchi proprio le voci
      if (e.target.closest('.dropdown-item')) return;
      profileDropdownWrapper.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdownWrapper.contains(e.target)) {
        profileDropdownWrapper.classList.remove('active');
      }
    });
  }

  // --- Log In / Log Out Buttons --- //
  const menuBtnLogout = document.getElementById('menu-btn-logout');
  if (menuBtnLogout) {
    menuBtnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      // Svuotiamo la memoria del browser
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('id_giocatore');
      // Torniamo alla pagina iniziale
      window.location.href = '/index.html';
    });
  }

  // (Se per qualche motivo i bottoni di login fossero visibili)
  const btnHeaderLogin = document.getElementById('btn-header-login');
  if (btnHeaderLogin) {
    btnHeaderLogin.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/index.html';
    });
  }

  const btnHeaderSignup = document.getElementById('btn-header-signup');
  if (btnHeaderSignup) {
    btnHeaderSignup.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/index.html';
    });
  }
  loadPlayerData();

  // ─── Typing Animation for Code Decoration ────────────────────────────────────

  const codeDeco = document.querySelector('.code-decoration');
  if (codeDeco) {
    // Svuota inizialmente l'HTML per preparare l'animazione
    codeDeco.innerHTML = '';
    codeDeco.classList.add('typing-active');

    const allSnippets = [
      { title: 'App.js', tokens: [{ text: 'function ', class: 'kw' }, { text: 'fizzBuzz', class: 'fn' }, { text: '(' }, { text: 'n', class: 'vbl' }, { text: ') {\n  ' }, { text: 'return ', class: 'cf' }, { text: 'Array', class: 'ty' }, { text: '.' }, { text: 'from', class: 'fn' }, { text: '({ ' }, { text: 'length', class: 'vbl' }, { text: ': ' }, { text: 'n', class: 'vbl' }, { text: ' }, (' }, { text: '_', class: 'vbl' }, { text: ', ' }, { text: 'i', class: 'vbl' }, { text: ') ' }, { text: '=>', class: 'cf' }, { text: ' ' }, { text: 'i', class: 'vbl' }, { text: ' + ' }, { text: '1', class: 'num' }, { text: ')\n    .' }, { text: 'map', class: 'fn' }, { text: '(' }, { text: 'x', class: 'vbl' }, { text: ' ' }, { text: '=>', class: 'cf' }, { text: ' {\n      ' }, { text: 'if ', class: 'cf' }, { text: '(' }, { text: 'x', class: 'vbl' }, { text: ' % ' }, { text: '15', class: 'num' }, { text: ' === ' }, { text: '0', class: 'num' }, { text: ') ' }, { text: 'return ', class: 'cf' }, { text: '"FizzBuzz"', class: 'str' }, { text: ';\n      ' }, { text: 'if ', class: 'cf' }, { text: '(' }, { text: 'x', class: 'vbl' }, { text: ' % ' }, { text: '3', class: 'num' }, { text: ' === ' }, { text: '0', class: 'num' }, { text: ') ' }, { text: 'return ', class: 'cf' }, { text: '"Fizz"', class: 'str' }, { text: ';\n      ' }, { text: 'if ', class: 'cf' }, { text: '(' }, { text: 'x', class: 'vbl' }, { text: ' % ' }, { text: '5', class: 'num' }, { text: ' === ' }, { text: '0', class: 'num' }, { text: ') ' }, { text: 'return ', class: 'cf' }, { text: '"Buzz"', class: 'str' }, { text: ';\n      ' }, { text: 'return ', class: 'cf' }, { text: 'x', class: 'vbl' }, { text: ';\n    });\n}' }] },
      { title: 'api.py', tokens: [{ text: 'def ', class: 'kw' }, { text: 'fetch_data', class: 'fn' }, { text: '(' }, { text: 'url', class: 'vbl' }, { text: '):\n  ' }, { text: 'response', class: 'vbl' }, { text: ' = ' }, { text: 'requests', class: 'vbl' }, { text: '.' }, { text: 'get', class: 'fn' }, { text: '(' }, { text: 'url', class: 'vbl' }, { text: ')\n  ' }, { text: 'if ', class: 'cf' }, { text: 'response', class: 'vbl' }, { text: '.' }, { text: 'status_code', class: 'vbl' }, { text: ' == ' }, { text: '200', class: 'num' }, { text: ':\n    ' }, { text: 'return ', class: 'cf' }, { text: 'response', class: 'vbl' }, { text: '.' }, { text: 'json', class: 'fn' }, { text: '()' }] },
      { title: 'utils.js', tokens: [{ text: 'const ', class: 'kw' }, { text: 'debounce', class: 'fn' }, { text: ' = (' }, { text: 'fn', class: 'vbl' }, { text: ', ' }, { text: 'delay', class: 'vbl' }, { text: ') ' }, { text: '=>', class: 'cf' }, { text: ' {\n  ' }, { text: 'let ', class: 'kw' }, { text: 'timer', class: 'vbl' }, { text: ';\n  ' }, { text: 'return ', class: 'cf' }, { text: '(...' }, { text: 'args', class: 'vbl' }, { text: ') ' }, { text: '=>', class: 'cf' }, { text: ' {\n    ' }, { text: 'clearTimeout', class: 'fn' }, { text: '(' }, { text: 'timer', class: 'vbl' }, { text: ');\n    ' }, { text: 'timer', class: 'vbl' }, { text: ' = ' }, { text: 'setTimeout', class: 'fn' }, { text: '(() ' }, { text: '=>', class: 'cf' }, { text: ' ' }, { text: 'fn', class: 'fn' }, { text: '(...' }, { text: 'args', class: 'vbl' }, { text: '), ' }, { text: 'delay', class: 'vbl' }, { text: ');\n  };\n}' }] },
      { title: 'math.go', tokens: [{ text: 'func ', class: 'kw' }, { text: 'Max', class: 'fn' }, { text: '(' }, { text: 'a', class: 'vbl' }, { text: ', ' }, { text: 'b', class: 'vbl' }, { text: ' ' }, { text: 'int', class: 'ty' }, { text: ') ' }, { text: 'int', class: 'ty' }, { text: ' {\n  ' }, { text: 'if ', class: 'cf' }, { text: 'a', class: 'vbl' }, { text: ' > ' }, { text: 'b', class: 'vbl' }, { text: ' {\n    ' }, { text: 'return ', class: 'cf' }, { text: 'a', class: 'vbl' }, { text: '\n  }\n  ' }, { text: 'return ', class: 'cf' }, { text: 'b', class: 'vbl' }, { text: '\n}' }] },
      { title: 'main.rs', tokens: [{ text: 'fn ', class: 'kw' }, { text: 'fib', class: 'fn' }, { text: '(' }, { text: 'n', class: 'vbl' }, { text: ': ' }, { text: 'u32', class: 'ty' }, { text: ') -> ' }, { text: 'u32', class: 'ty' }, { text: ' {\n  ' }, { text: 'match ', class: 'cf' }, { text: 'n', class: 'vbl' }, { text: ' {\n    ' }, { text: '0', class: 'num' }, { text: ' => ' }, { text: '0', class: 'num' }, { text: ',\n    ' }, { text: '1', class: 'num' }, { text: ' => ' }, { text: '1', class: 'num' }, { text: ',\n    ' }, { text: '_', class: 'kw' }, { text: ' => ' }, { text: 'fib', class: 'fn' }, { text: '(' }, { text: 'n', class: 'vbl' }, { text: ' - ' }, { text: '1', class: 'num' }, { text: ') + ' }, { text: 'fib', class: 'fn' }, { text: '(' }, { text: 'n', class: 'vbl' }, { text: ' - ' }, { text: '2', class: 'num' }, { text: ')\n  }\n}' }] }
    ];

    const playSnippet = (index) => {
      codeDeco.innerHTML = '';
      codeDeco.classList.add('typing-active');
      const snippet = allSnippets[index];
      const tokens = snippet.tokens;

      const titleEl = document.createElement('div');
      titleEl.className = 'mac-window-title';
      titleEl.textContent = snippet.title;
      codeDeco.appendChild(titleEl);

      let currentTokenIndex = 0;
      let currentCharIndex = 0;
      let currentSpan = null;

      const typeNextChar = () => {
        if (currentTokenIndex >= tokens.length) {
          // Animazione terminata per questo snippet
          codeDeco.classList.remove('typing-active');

          // Pausa di 5 secondi prima del prossimo snippet
          setTimeout(() => {
            const nextIndex = (index + 1) % allSnippets.length;
            playSnippet(nextIndex);
          }, 5000);
          return;
        }

        const token = tokens[currentTokenIndex];

        if (currentCharIndex === 0) {
          currentSpan = document.createElement('span');
          if (token.class) currentSpan.className = token.class;
          codeDeco.appendChild(currentSpan);
        }

        // Appendi carattere
        currentSpan.textContent += token.text[currentCharIndex];
        currentCharIndex++;

        // Passaggio al prossimo token
        if (currentCharIndex >= token.text.length) {
          currentTokenIndex++;
          currentCharIndex = 0;
        }

        // Variabilità temporale della digitazione per effetto realistico
        let typingSpeed = Math.random() * 40 + 20;
        if (token.text[currentCharIndex - 1] === ' ') typingSpeed += 30;

        setTimeout(typeNextChar, typingSpeed);
      };

      // Inizia dopo 800ms
      setTimeout(typeNextChar, 800);
    };

    // Avvio del loop ricorsivo partendo dal primo snippet
    playSnippet(0);
  }

  // ─── Button Interactions ─────────────────────────────────────────────────────

  const btnSingle = document.getElementById('btn-singleplayer');
  const btnMulti = document.getElementById('btn-multiplayer');

  btnSingle?.addEventListener('click', () => {
    // Future: navigate to single player game
    console.log('[CodeGuessr] Starting Single Player…');
    showToast('🎮 Single Player – Caricamento partita…', 'blue');
  });

  btnMulti?.addEventListener('click', () => {
    // Future: navigate to multiplayer lobby / room creation
    console.log('[CodeGuessr] Starting Multiplayer…');
    showToast('👥 Multiplayer – Creazione stanza…', 'green');
  });

  // ─── Toast Notification ──────────────────────────────────────────────────────

  /**
   * Show a lightweight toast notification
   * @param {string} message
   * @param {'blue'|'green'|'orange'|'red'} color
   */
  function showToast(message, color = 'blue') {
    const existing = document.getElementById('cg-toast');
    if (existing) existing.remove();

    const colorMap = {
      blue: 'var(--darcula-blue)',
      green: 'var(--darcula-green)',
      orange: 'var(--darcula-orange)',
      red: 'var(--darcula-red)',
    };
    const c = colorMap[color] || colorMap.blue;

    const toast = document.createElement('div');
    toast.id = 'cg-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: rgba(var(--darcula-current), 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(${c.replace('var(', '').replace(')', '')}, 0.4);
      border-left: 4px solid rgb(${c.replace('var(--', '').replace(')', '')});
      border-radius: 12px;
      padding: 1rem 1.5rem;
      color: rgb(var(--darcula-fg));
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      transform: translateY(20px);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }



});
