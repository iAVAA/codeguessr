/**
 * CodeGuessr - Game Page (Lobby)
 * Handles: theme toggle, XP ring animation, profile data, button interactions
 */

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



  // ─── Mock Player Data ────────────────────────────────────────────────────────

  const PLAYER = {
    name: 'Signor S',
    level: 1,
    cups: 32,
    xpPercent: 20,
    avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=codeguessr&backgroundColor=1e1f21`,
  };

  function setXpProgress(pct) {
    const ring = document.getElementById('xp-ring-progress');
    if (!ring) return;
    const r = 17;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;

    // In CSS l'offset parte già a 100% (vuoto).
    // Concediamo 200ms prima di animarlo in su.
    setTimeout(() => {
      ring.style.strokeDashoffset = offset;
    }, 400);
  }

  function loadPlayerData() {
    const nameEl = document.getElementById('player-name');
    const levelEl = document.getElementById('player-level');
    const cupsEl = document.getElementById('player-cups');
    const avatarEl = document.getElementById('player-avatar');

    if (nameEl) nameEl.textContent = PLAYER.name;
    if (levelEl) levelEl.textContent = PLAYER.level;
    if (cupsEl) cupsEl.textContent = PLAYER.cups.toLocaleString('it-IT');
    if (avatarEl) avatarEl.src = PLAYER.avatar;

    setXpProgress(PLAYER.xpPercent);
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
