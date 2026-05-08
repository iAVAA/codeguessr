import { getSession, fetchAuth } from '../managers/auth.js';

// ─── Costanti ───────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 1;
const ROUND_SECONDS = 60;
const SETTINGS_KEY = 'codeguessr-settings';

// ─── Stato Partita ──────────────────────────────────────────────────────────
let timerInterval = null;
let timeRemaining = ROUND_SECONDS;
let currentRound = 1;
let totalRounds = TOTAL_ROUNDS;
let myHealth = 100;
let oppHealth = 100;
let matchSaved = false;
let currentSnippet = null;
let monacoEditorInstance = null;
let roundActive = false;   // Previene submit multipli nello stesso round
let isMultiplayer = false;
let roomCode = null;
let socket = null;
let opponentData = null;
let countdownInterval = null;
let countdownPromise = null;
let lastServerRoundProcessed = 0;

// ─── Bot Difficulty ─────────────────────────────────────────────────────────
/**
 * Legge la difficoltà del bot dalle impostazioni salvate.
 * Restituisce un range [min, max] per il punteggio del bot.
 */
function getBotScoreRange() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    const diff = s.difficulty ?? 'normal';
    if (diff === 'easy') return { min: 10, max: 40 };
    if (diff === 'hard') return { min: 55, max: 95 };
    return { min: 30, max: 70 };  // normal
  } catch {
    return { min: 30, max: 70 };
  }
}

function rollBotScore() {
  const { min, max } = getBotScoreRange();
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Snippet di fallback ─────────────────────────────────────────────────────
const fallbackSnippet = {
  code: `function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\nconsole.log("Fib(10):", fibonacci(10));`,
  monacoLang: 'javascript',
  source: 'fallback',
  fileUrl: null
};

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchRandomGitHubSnippet() {
  const res = await fetch('/api/random-snippet');
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return await res.json();
}

// ─── Monaco Editor ───────────────────────────────────────────────────────────

function updateTitleBar(snippet) {
  const titleEl = document.querySelector('.vscode-title');
  if (!titleEl) return;

  const fileName = snippet.source
    ? snippet.source.split('—').pop().trim().split('/').pop()
    : `snippet.${snippet.monacoLang}`;

  titleEl.innerHTML =
    `<i class="bi bi-file-earmark-code"></i> ${fileName}` +
    ` &nbsp;<span style="color:rgb(var(--darcula-green));font-size:0.7em;font-family:'JetBrains Mono',monospace;` +
    `background:rgba(var(--darcula-green),0.12);border:1px solid rgba(var(--darcula-green),0.3);` +
    `border-radius:6px;padding:1px 7px;vertical-align:middle;">${snippet.monacoLang.toUpperCase()}</span>` +
    ` &nbsp;— Visual Studio Code`;
}

function setEditorContent(snippet) {
  if (monacoEditorInstance) {
    // Aggiorna il modello esistente invece di ricreare l'editor
    const model = window.monaco.editor.createModel(
      snippet.code,
      snippet.monacoLang
    );
    monacoEditorInstance.setModel(model);
    updateTitleBar(snippet);
  }
}

function initMonacoEditor(snippet) {
  if (!window.require) {
    console.error('[Match] Monaco require() not found.');
    return Promise.reject(new Error('Monaco not loaded'));
  }

  // Se loader.js ha già precarlicato Monaco durante lo splash, riusiamo quella Promise
  // così evitiamo un secondo round-trip di rete che causa il "contatore che parte a 3"
  const monacoReady = window.__monacoReady ?? (() => {
    window.require.config({
      paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
    });
    return new Promise((res) => window.require(['vs/editor/editor.main'], res));
  })();

  return monacoReady.then(() => {
    monacoEditorInstance = window.monaco.editor.create(
      document.getElementById('monaco-container'),
      {
        value: snippet.code,
        language: snippet.monacoLang,
        theme: 'vs-dark',
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 15,
        fontFamily: "'JetBrains Mono', monospace",
        padding: { top: 16 },
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
          verticalScrollbarSize: 12,
          horizontalScrollbarSize: 12,
        }
      }
    );
    updateTitleBar(snippet);
  });
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function startTimer() {
  const timerEl = document.getElementById('match-timer');
  clearInterval(timerInterval);
  timerInterval = null;
  if (!timerEl) return;

  timeRemaining = ROUND_SECONDS;
  timerEl.textContent = `00:${ROUND_SECONDS.toString().padStart(2, '0')}`;
  timerEl.classList.remove('hurry');

  timerInterval = setInterval(() => {
    timeRemaining--;
    timerEl.textContent = `00:${timeRemaining.toString().padStart(2, '0')}`;

    if (timeRemaining <= 10 && timeRemaining > 0) timerEl.classList.add('hurry');

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = '00:00';
      timerEl.classList.remove('hurry');
      if (roundActive) handleTimeOut();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  const timerEl = document.getElementById('match-timer');
  if (timerEl) timerEl.classList.remove('hurry');
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  const overlay = document.getElementById('match-countdown-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
  }

  countdownPromise = null;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function updateRoundLabel() {
  const el = document.getElementById('match-round');
  if (el) el.textContent = `Round ${currentRound}/${totalRounds}`;
}

function reduceHealth(player, amount) {
  let hp = player === 'p1' ? myHealth : oppHealth;
  hp = Math.max(0, hp - amount);
  if (player === 'p1') myHealth = hp; else oppHealth = hp;

  const bar = document.getElementById(`match-${player}-health`);
  const text = document.getElementById(`match-${player}-hp`);

  if (bar && text) {
    bar.style.width = `${hp}%`;
    bar.setAttribute('aria-valuenow', hp);
    text.textContent = hp;

    bar.classList.remove('warning', 'danger');
    if (hp <= 30) bar.classList.add('danger');
    else if (hp <= 60) bar.classList.add('warning');
  }
}

function setFormEnabled(enabled) {
  const input = document.getElementById('guess-input');
  const submitBtn = document.querySelector('.guess-btn');
  if (input) input.disabled = !enabled;
  if (submitBtn) submitBtn.disabled = !enabled;
  if (enabled && input) {
    input.value = '';
    input.focus();
  }
}

function setFeedback(html, colorClass = '') {
  const el = document.getElementById('guess-feedback');
  if (!el) return;
  el.innerHTML = html;
  el.className = `mt-3 text-center fw-bold ${colorClass}`.trim();
}

// ─── Salvataggio Partita ──────────────────────────────────────────────────────

async function saveMatchResult(risultato, expGuadagnata) {
  if (matchSaved) return;
  matchSaved = true;

  const token = localStorage.getItem('supabaseToken');
  if (!token) {
    console.warn('[Match] Utente non autenticato, partita non salvata.');
    return;
  }

  try {
    const res = await fetchAuth('/api/salva-partita', {
      method: 'POST',
      body: JSON.stringify({
        modalita: 'singleplayer',
        risultato,
        exp_guadagnata: expGuadagnata
      })
    });

    if (res.ok) {
      const saved = await res.json();
      console.log(`[Match] Partita salvata! EXP: ${saved.nuova_exp}, LV: ${saved.nuovo_livello}`);
    } else {
      console.warn('[Match] Errore salvataggio:', res.status);
      matchSaved = false;
    }
  } catch (err) {
    console.error('[Match] Impossibile salvare la partita:', err);
    matchSaved = false;
  }
}

// ─── End Game ────────────────────────────────────────────────────────────────

function showEndGame() {
  stopCountdown();
  stopTimer();
  setFormEnabled(false);

  let result, title, subtitle, icon, expEarned, badgeClass;

  if (myHealth >= oppHealth) {
    result = 'vittoria';
    title = 'VITTORIA!';
    subtitle = myHealth === oppHealth ? `Entrambi con ${myHealth} HP — Vittoria per tutti!` : `Hai vinto con ${myHealth} HP rimasti!`;
    icon = 'bi-trophy-fill';
    badgeClass = 'end-result--win';
    expEarned = 100 + Math.round(myHealth / 2);
    if (typeof CG_Sound !== 'undefined') CG_Sound.playWin();
  } else {
    result = 'sconfitta';
    title = 'SCONFITTA';
    subtitle = `Il bot ha vinto con ${oppHealth} HP rimasti.`;
    icon = 'bi-x-octagon-fill';
    badgeClass = 'end-result--lose';
    expEarned = -10 - Math.round(oppHealth / 2);
    if (typeof CG_Sound !== 'undefined') CG_Sound.playGameOver();
  }

  // Salva nel DB (vittoria → EXP piena, sconfitta → consolazione)
  const dbRisultato = result;
  saveMatchResult(dbRisultato, expEarned);

  // Crea overlay end-game (stesso schema modale delle impostazioni)
  const overlay = document.createElement('div');
  overlay.id = 'end-game-overlay';
  overlay.className = 'end-game-overlay';
  overlay.innerHTML = `
    <div class="end-game-card ${badgeClass} p-4 p-lg-5 text-center d-flex flex-column align-items-center gap-3">
      <i class="bi ${icon} end-game-icon"></i>
      <h1 class="end-game-title">${title}</h1>
      <p class="end-game-subtitle">${subtitle}</p>
      <div class="end-game-hp-row d-flex justify-content-center">
        <div class="end-hp-badge">
          <span class="end-hp-label">Tu</span>
          <span class="end-hp-val ${myHealth > oppHealth ? 'text-success' : (myHealth < oppHealth ? 'text-danger' : 'text-warning')}">${myHealth} HP</span>
        </div>
        <div class="end-hp-sep">vs</div>
        <div class="end-hp-badge">
          <span class="end-hp-label">Bot</span>
          <span class="end-hp-val ${oppHealth > myHealth ? 'text-danger' : (oppHealth < myHealth ? 'text-success' : 'text-warning')}">${oppHealth} HP</span>
        </div>
      </div>
      <div class="end-exp-badge">${expEarned > 0 ? '+' : ''}${expEarned} EXP</div>
      <div class="d-flex gap-3 mt-2 flex-wrap justify-content-center">
        <a href="/home" class="btn btn-outline-light rounded-pill px-4 py-2">
          <i class="bi bi-house-fill me-2"></i>Home
        </a>
        <a href="/match" class="btn btn-primary rounded-pill px-4 py-2">
          <i class="bi bi-arrow-counterclockwise me-2"></i>Rigioca
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  // rAF doppio per garantire che il browser esegua un paint prima di aggiungere .visible
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
}

// ─── Logica Round ────────────────────────────────────────────────────────────

/**
 * Carica un nuovo snippet e prepara il round.
 * Se Monaco è già inizializzato, aggiorna solo il modello.
 */
async function loadRoundSnippet() {
  // Round 1: usa lo snippet precaricato dal loader durante lo splash screen
  if (currentRound === 1 && window.__firstSnippet) {
    currentSnippet = window.__firstSnippet;
    window.__firstSnippet = null; // consuma e svuota per i round successivi
    console.log(`[Match] Round 1: uso snippet precaricato (${currentSnippet.source})`);
  } else {
    const titleEl = document.querySelector('.vscode-title');
    if (titleEl) {
      titleEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Caricamento snippet da GitHub...`;
    }
    try {
      currentSnippet = await fetchRandomGitHubSnippet();
      console.log(`[Match] Snippet round ${currentRound}: ${currentSnippet.source} (${currentSnippet.monacoLang})`);
    } catch (err) {
      console.warn('[Match] Snippet fetch fallito, uso fallback:', err.message);
      currentSnippet = fallbackSnippet;
    }
  }

  if (monacoEditorInstance) {
    setEditorContent(currentSnippet);
  } else {
    await initMonacoEditor(currentSnippet);
  }
}


/**
 * Esegue il countdown (3-2-1-VIA!) e poi avvia il timer del round.
 * Restituisce una Promise che si risolve quando il countdown è finito.
 */
function runCountdown() {
  if (countdownPromise) return countdownPromise;

  countdownPromise = new Promise((resolve) => {
    const overlay = document.getElementById('match-countdown-overlay');
    const cdText = document.getElementById('match-countdown-text');

    if (!overlay || !cdText) {
      countdownPromise = null;
      resolve();
      return;
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    // Reimposta l'overlay (potrebbe essere stato nascosto)
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.display = '';
    cdText.style.color = '';
    cdText.textContent = '3';

    let val = 3;

    countdownInterval = setInterval(() => {
      val--;
      if (val > 0) {
        cdText.textContent = String(val);
      } else if (val === 0) {
        cdText.textContent = 'VIA!';
        cdText.style.color = 'rgb(var(--darcula-blue))';
      } else {
        clearInterval(countdownInterval);
        countdownInterval = null;
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        setTimeout(() => {
          countdownPromise = null;
          resolve();
        }, 400);
      }
    }, 1000);
  });

  return countdownPromise;
}

/**
 * Avvia il round corrente: mostra il countdown, poi attiva il form e il timer.
 */
async function startRound() {
  totalRounds = TOTAL_ROUNDS;
  updateRoundLabel();
  setFeedback('Attesa risposta...');
  setFormEnabled(false);
  roundActive = false;

  // Carica snippet (prima del countdown, così non si perde tempo)
  await loadRoundSnippet();

  // Aspetta che il loader principale sia chiuso
  await waitForLoader();

  // Esegui il countdown
  await runCountdown();

  // Ora il round è attivo
  roundActive = true;
  setFormEnabled(true);
  startTimer();
}

/**
 * Aspetta che il loader principale del sito venga chiuso (se presente).
 */
function waitForLoader() {
  return new Promise((resolve) => {
    if (!document.body.classList.contains('loader-open')) {
      resolve();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.body.classList.contains('loader-open')) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
}

// ─── Gestione risposta ───────────────────────────────────────────────────────

async function handleSubmit(val) {
  if (!roundActive) return;
  roundActive = false;

  stopTimer();
  setFormEnabled(false);
  setFeedback('<span class="spinner-border spinner-border-sm me-2" role="status"></span>Valutazione in corso...');

  if (isMultiplayer) {
    // In multiplayer, inviamo la risposta al server e aspettiamo l'evento roundResult
    socket.emit('submitMultiplayerAnswer', { roomCode, answer: val });
    setFeedback('<i class="bi bi-hourglass-split me-1"></i>In attesa dell\'altro giocatore...');
    return;
  }

  // LOGICA SINGLE PLAYER (esistente)
  try {
    const res = await fetch('/api/valuta-risposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: currentSnippet.code, risposta: val })
    });

    if (!res.ok) throw new Error(`Errore server: ${res.status}`);

    const { punteggio } = await res.json();
    const myScore = punteggio;
    const botScore = rollBotScore();
    const diff = myScore - botScore;
    const damage = Math.abs(diff);

    if (diff > 0) {
      setFeedback(
        `<i class="bi bi-check-circle-fill me-1"></i>Spiegazione superiore! (Tu: <b>${myScore}</b>, Bot: ${botScore})<br>Il bot perde <b>${damage} HP</b>.`,
        'text-success'
      );
      reduceHealth('p2', damage);
    } else if (diff < 0) {
      setFeedback(
        `<i class="bi bi-exclamation-circle-fill me-1"></i>Il bot ha spiegato meglio! (Tu: <b>${myScore}</b>, Bot: ${botScore})<br>Perdi <b>${damage} HP</b>.`,
        'text-danger'
      );
      reduceHealth('p1', damage);
    } else {
      setFeedback(
        `<i class="bi bi-dash-circle-fill me-1"></i>Entrambi <b>${myScore}</b>. Nessun danno.`,
        'text-warning'
      );
    }
  } catch (err) {
    console.error('[Match] Errore valutazione:', err);
    const botScore = rollBotScore();
    setFeedback(
      `<i class="bi bi-wifi-off me-1"></i>Errore di connessione. Il bot segna ${botScore}. Perdi <b>${botScore} HP</b>.`,
      'text-danger'
    );
    reduceHealth('p1', botScore);
  }

  if (myHealth <= 0 || oppHealth <= 0) {
    setTimeout(showEndGame, 1800);
    return;
  }

  if (currentRound >= TOTAL_ROUNDS) {
    setTimeout(showEndGame, 1800);
    return;
  }

  currentRound++;
  setTimeout(startRound, 2200);
}

function handleTimeOut() {
  if (!roundActive) return;
  roundActive = false;

  stopTimer();
  setFormEnabled(false);

  if (isMultiplayer) {
    // In multiplayer, inviamo risposta vuota per timeout
    socket.emit('submitMultiplayerAnswer', { roomCode, answer: "" });
    setFeedback('<i class="bi bi-alarm-fill me-1"></i>Tempo Scaduto! Valutazione in corso...');
    return;
  }

  // LOGICA SINGLE PLAYER (esistente)
  const botScore = rollBotScore();
  setFeedback(
    `<i class="bi bi-alarm-fill me-1"></i>Tempo Scaduto! (Tu: 0, Bot: ${botScore})<br>Perdi <b>${botScore} HP</b>.`,
    'text-danger'
  );
  reduceHealth('p1', botScore);

  if (myHealth <= 0 || oppHealth <= 0) {
    setTimeout(showEndGame, 1800);
    return;
  }

  if (currentRound >= TOTAL_ROUNDS) {
    setTimeout(showEndGame, 1800);
    return;
  }

  currentRound++;
  setTimeout(startRound, 2200);
}

// ─── Form Submit ─────────────────────────────────────────────────────────────

const guessForm = document.getElementById('guess-form');
if (guessForm) {
  guessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('guess-input').value.trim();
    if (!val || !roundActive) return;
    handleSubmit(val);
  });
}

// ─── Caricamento Profili ─────────────────────────────────────────────────────

async function loadProfiles() {
  const { isLoggedIn, idGiocatore } = getSession();
  const oppSeed = 'opponent_boss_42';

  // Dati placeholder
  document.getElementById('match-p1-name').textContent = 'Giocatore';
  document.getElementById('match-p1-lvl').textContent = 1;
  document.getElementById('match-p1-cups').textContent = 0;
  document.getElementById('match-p1-avatar').src = '/src/assets/img/user_profile.webp';

  // Bot avversario o giocatore reale in multiplayer
  if (isMultiplayer && opponentData) {
    document.getElementById('match-p2-name').textContent = opponentData.nickname;
    document.getElementById('match-p2-lvl').textContent = opponentData.livello || '--';
    document.getElementById('match-p2-cups').textContent = opponentData.trophies || '--';
    document.getElementById('match-p2-avatar').src = opponentData.avatar_url || '/src/assets/img/user_profile.webp';
  } else {
    const { difficulty } = (() => {
      try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
    })();
    const botNames = { easy: 'EasyBot', normal: 'CodeBot', hard: 'HardCore' };
    const botLvls = { easy: 5, normal: 25, hard: 99 };
    const botCups = { easy: 400, normal: 2800, hard: 9999 };
    const diff = difficulty ?? 'normal';

    document.getElementById('match-p2-name').textContent = botNames[diff] || 'CodeBot';
    document.getElementById('match-p2-lvl').textContent = botLvls[diff] || 25;
    document.getElementById('match-p2-cups').textContent = botCups[diff] || 2800;
    document.getElementById('match-p2-avatar').src = `/src/assets/img/bot_image.webp`;
  }

  // Carica profilo reale dal DB
  if (isLoggedIn && idGiocatore) {
    try {
      const res = await fetch(`/api/profilo/${idGiocatore}`);
      if (res.ok) {
        const myProfile = await res.json();
        document.getElementById('match-p1-name').textContent = myProfile.user;
        document.getElementById('match-p1-lvl').textContent = myProfile.livello || 1;
        document.getElementById('match-p1-cups').textContent = myProfile.exp || 0;
        const avatarSrc = myProfile.avatar_url || '/src/assets/img/user_profile.webp';
        document.getElementById('match-p1-avatar').src = avatarSrc;
      }
    } catch (e) {
      console.error('[Match] Profile fetch error:', e);
    }
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function init() {
  console.log('[Match] Inizializzazione partita...');

  // L'overlay countdown e presente nell'HTML con testo "3": nascondilo subito.
  // Verra mostrato solo quando un round parte davvero con runCountdown().
  stopCountdown();

  const urlParams = new URLSearchParams(window.location.search);
  roomCode = urlParams.get('room');
  isMultiplayer = !!roomCode;

  if (isMultiplayer) {
    const session = getSession();
    socket = io({
      auth: { token: session.token }
    });

    socket.on('connect', () => {
      console.log("✅ Connesso al server multiplayer per la stanza:", roomCode);
      socket.emit('joinRoom', roomCode);
    });

    socket.on('matchInfo', (data) => {
      opponentData = data.players.find(p => p.id !== session.idGiocatore);
      loadProfiles();
      setFeedback("In attesa dell'altro giocatore...");
    });

    socket.on('startRound', async (data) => {
      if (!data || typeof data.round !== 'number') return;

      // Difesa contro eventi startRound duplicati che possono rilanciare il countdown.
      if (data.round <= lastServerRoundProcessed) {
        return;
      }
      lastServerRoundProcessed = data.round;

      stopCountdown();
      stopTimer();

      console.log("🚀 Inizio Round Multiplayer:", data.round);
      currentRound = data.round;
      if (typeof data.totalRounds === 'number' && data.totalRounds > 0) {
        totalRounds = data.totalRounds;
      }
      currentSnippet = data?.snippet?.code ? data.snippet : fallbackSnippet;
      updateRoundLabel();

      // Reset UI per il nuovo round
      setFeedback(''); // Rimuoviamo il testo di stato precedente
      setFormEnabled(false);
      const input = document.getElementById('guess-input');
      if (input) input.value = '';

      // Aspettiamo che il loader del sito sia chiuso prima di inizializzare Monaco
      await waitForLoader();

      if (!monacoEditorInstance) {
        await initMonacoEditor(currentSnippet);
      } else {
        setEditorContent(currentSnippet);
      }

      await runCountdown();

      roundActive = true;
      setFormEnabled(true);
      startTimer();
    });

    socket.on('roundResult', (data) => {
      const session = getSession();
      const myScore = data.scores[session.idGiocatore];
      const oppId = opponentData?.id;
      const oppScore = data.scores[oppId];
      const damage = data.damage;

      stopTimer();
      setFormEnabled(false);

      // Aggiorna vite
      myHealth = data.healths[session.idGiocatore];
      oppHealth = data.healths[oppId];
      updateHealthBars();

      if (data.winnerId === session.idGiocatore) {
        setFeedback(
          `<i class="bi bi-check-circle-fill me-1"></i>Spiegazione superiore! (Tu: <b>${myScore}</b>, Avversario: ${oppScore})<br>L'avversario perde <b>${damage} HP</b>.`,
          'text-success'
        );
      } else if (data.winnerId === oppId) {
        setFeedback(
          `<i class="bi bi-exclamation-circle-fill me-1"></i>L'avversario ha spiegato meglio! (Tu: <b>${myScore}</b>, Avversario: ${oppScore})<br>Perdi <b>${damage} HP</b>.`,
          'text-danger'
        );
      } else {
        setFeedback(
          `<i class="bi bi-dash-circle-fill me-1"></i>Entrambi <b>${myScore}</b>. Nessun danno.`,
          'text-warning'
        );
      }
    });

    socket.on('matchFinished', (data) => {
      stopCountdown();
      showEndGameMultiplayer(data);
    });

    socket.on('error', (data) => {
      if (typeof showToast === 'function') showToast(data.message, "red");
    });
  }

  try {
    await loadProfiles();
    if (!isMultiplayer) {
      await startRound();
    }
  } catch (e) {
    console.error('[Match] Errore durante init:', e);
  }
}

function updateHealthBars() {
  const p1Bar = document.getElementById(`match-p1-health`);
  const p1Text = document.getElementById(`match-p1-hp`);
  const p2Bar = document.getElementById(`match-p2-health`);
  const p2Text = document.getElementById(`match-p2-hp`);

  if (p1Bar && p1Text) {
    p1Bar.style.width = `${myHealth}%`;
    p1Text.textContent = myHealth;
  }
  if (p2Bar && p2Text) {
    p2Bar.style.width = `${oppHealth}%`;
    p2Text.textContent = oppHealth;
  }
}

function showEndGameMultiplayer(data) {
  const session = getSession();
  const isWinner = data.winner === session.idGiocatore || data.winner === null;

  stopCountdown();
  stopTimer();
  setFormEnabled(false);

  let title = isWinner ? 'VITTORIA!' : 'SCONFITTA';
  let icon = isWinner ? 'bi-trophy-fill' : 'bi-x-octagon-fill';
  let badgeClass = isWinner ? 'end-result--win' : 'end-result--lose';

  if (isWinner) {
    if (typeof CG_Sound !== 'undefined') CG_Sound.playWin();
  } else {
    if (typeof CG_Sound !== 'undefined') CG_Sound.playGameOver();
  }

  const overlay = document.createElement('div');
  overlay.id = 'end-game-overlay';
  overlay.className = 'end-game-overlay';
  overlay.innerHTML = `
    <div class="end-game-card ${badgeClass} p-4 p-lg-5 text-center d-flex flex-column align-items-center gap-3">
      <i class="bi ${icon} end-game-icon"></i>
      <h1 class="end-game-title">${title}</h1>
      <p class="end-game-subtitle">${isWinner ? 'Hai dominato la sfida!' : 'Sarà per la prossima volta!'}</p>
      <div class="d-flex gap-3 mt-2 flex-wrap justify-content-center">
        <a href="/home" class="btn btn-outline-light rounded-pill px-4 py-2">
          <i class="bi bi-house-fill me-2"></i>Home
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
}

init();