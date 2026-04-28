import { getSession, fetchAuth } from '../managers/auth.js';

// ─── Costanti ───────────────────────────────────────────────────────────────
const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';
const TOTAL_ROUNDS = 5;
const ROUND_SECONDS = 60;
const SETTINGS_KEY = 'codeguessr-settings';

// ─── Stato Partita ──────────────────────────────────────────────────────────
let timerInterval = null;
let timeRemaining = ROUND_SECONDS;
let currentRound = 1;
let myHealth = 100;
let oppHealth = 100;
let matchSaved = false;
let currentSnippet = null;
let monacoEditorInstance = null;
let roundActive = false;   // Previene submit multipli nello stesso round

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

  window.require.config({
    paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
  });

  return new Promise((resolve) => {
    window.require(['vs/editor/editor.main'], () => {
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
      resolve();
    });
  });
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function startTimer() {
  const timerEl = document.getElementById('match-timer');
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
  document.getElementById('match-timer').classList.remove('hurry');
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function updateRoundLabel() {
  const el = document.getElementById('match-round');
  if (el) el.textContent = `Round ${currentRound}/${TOTAL_ROUNDS}`;
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
  stopTimer();
  setFormEnabled(false);

  let result, title, subtitle, icon, expEarned, badgeClass;

  if (myHealth > oppHealth) {
    result = 'vittoria';
    title = 'VITTORIA!';
    subtitle = `Hai vinto con ${myHealth} HP rimasti!`;
    icon = 'bi-trophy-fill';
    badgeClass = 'end-result--win';
    expEarned = 50 + Math.round(myHealth / 2);
  } else if (oppHealth > myHealth) {
    result = 'sconfitta';
    title = 'SCONFITTA';
    subtitle = `Il bot ha vinto con ${oppHealth} HP rimasti.`;
    icon = 'bi-x-octagon-fill';
    badgeClass = 'end-result--lose';
    expEarned = 10;
  } else {
    result = 'pareggio';
    title = 'PAREGGIO!';
    subtitle = `Entrambi con ${myHealth} HP — battaglia epica!`;
    icon = 'bi-shield-fill-check';
    badgeClass = 'end-result--draw';
    expEarned = 25;
  }

  // Salva nel DB (vittoria e pareggio → EXP piena, sconfitta → consolazione)
  const dbRisultato = result === 'vittoria' ? 'vittoria' : 'sconfitta';
  saveMatchResult(dbRisultato, expEarned);

  // Crea overlay end-game
  const overlay = document.createElement('div');
  overlay.id = 'end-game-overlay';
  overlay.className = 'end-game-overlay d-flex flex-column align-items-center justify-content-center';
  overlay.innerHTML = `
    <div class="end-game-card ${badgeClass} p-4 p-lg-5 text-center d-flex flex-column align-items-center gap-3">
      <i class="bi ${icon} end-game-icon"></i>
      <h1 class="end-game-title">${title}</h1>
      <p class="end-game-subtitle">${subtitle}</p>
      <div class="end-game-hp-row d-flex gap-4 justify-content-center">
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
      <div class="end-exp-badge">+${expEarned} EXP</div>
      <div class="d-flex gap-3 mt-2 flex-wrap justify-content-center">
        <a href="/home" class="btn btn-outline-light rounded-pill px-4 py-2">
          <i class="bi bi-house-fill me-2"></i>Home
        </a>
        <a href="/src/pages/match_page.html" class="btn btn-primary rounded-pill px-4 py-2">
          <i class="bi bi-arrow-counterclockwise me-2"></i>Rivinci
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  // Piccolo delay per trigger transizione CSS
  requestAnimationFrame(() => overlay.classList.add('visible'));
}

// ─── Logica Round ────────────────────────────────────────────────────────────

/**
 * Carica un nuovo snippet e prepara il round.
 * Se Monaco è già inizializzato, aggiorna solo il modello.
 */
async function loadRoundSnippet() {
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
  return new Promise((resolve) => {
    const overlay = document.getElementById('match-countdown-overlay');
    const cdText = document.getElementById('match-countdown-text');

    if (!overlay || !cdText) {
      resolve();
      return;
    }

    // Reimposta l'overlay (potrebbe essere stato nascosto)
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.display = '';
    cdText.style.color = '';
    cdText.textContent = '3';

    let val = 3;

    const iv = setInterval(() => {
      val--;
      if (val > 0) {
        cdText.textContent = String(val);
      } else if (val === 0) {
        cdText.textContent = 'VIA!';
        cdText.style.color = 'rgb(var(--darcula-blue))';
      } else {
        clearInterval(iv);
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        setTimeout(resolve, 400);
      }
    }, 1000);
  });
}

/**
 * Avvia il round corrente: mostra il countdown, poi attiva il form e il timer.
 */
async function startRound() {
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
        `<i class="bi bi-dash-circle-fill me-1"></i>Pareggio! Entrambi <b>${myScore}</b>. Nessun danno.`,
        'text-warning'
      );
    }
  } catch (err) {
    console.error('[Match] Errore valutazione:', err);
    // In caso di errore rete, trattiamo come timeout
    const botScore = rollBotScore();
    setFeedback(
      `<i class="bi bi-wifi-off me-1"></i>Errore di connessione. Il bot segna ${botScore}. Perdi <b>${botScore} HP</b>.`,
      'text-danger'
    );
    reduceHealth('p1', botScore);
  }

  // Controlla se qualcuno è morto (KO anticipato)
  if (myHealth <= 0 || oppHealth <= 0) {
    setTimeout(showEndGame, 1800);
    return;
  }

  // Fine partita dopo l'ultimo round
  if (currentRound >= TOTAL_ROUNDS) {
    setTimeout(showEndGame, 1800);
    return;
  }

  // Prossimo round
  currentRound++;
  setTimeout(startRound, 2200);
}

function handleTimeOut() {
  if (!roundActive) return;
  roundActive = false;

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
  document.getElementById('match-p1-avatar').src = `${AVATAR_BASE}?seed=guest&backgroundColor=1e1f21`;

  // Bot avversario con nome basato sulla difficoltà
  const { difficulty } = (() => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
  })();
  const botNames = { easy: 'EasyBot 🤖', normal: 'CodeBot 🤖', hard: 'HardCore 🤖' };
  const botLvls = { easy: 5, normal: 25, hard: 99 };
  const botCups = { easy: 400, normal: 2800, hard: 9999 };
  const diff = difficulty ?? 'normal';

  document.getElementById('match-p2-name').textContent = botNames[diff] || 'CodeBot 🤖';
  document.getElementById('match-p2-lvl').textContent = botLvls[diff] || 25;
  document.getElementById('match-p2-cups').textContent = botCups[diff] || 2800;
  document.getElementById('match-p2-avatar').src = `${AVATAR_BASE}?seed=${oppSeed}&backgroundColor=1e1f21`;

  // Carica profilo reale dal DB
  if (isLoggedIn && idGiocatore) {
    try {
      const res = await fetch(`/api/profilo/${idGiocatore}`);
      if (res.ok) {
        const myProfile = await res.json();
        document.getElementById('match-p1-name').textContent = myProfile.user;
        document.getElementById('match-p1-lvl').textContent = myProfile.livello || 1;
        document.getElementById('match-p1-cups').textContent = myProfile.exp || 0;
        const avatarSrc = myProfile.avatar_url
          ? myProfile.avatar_url
          : `${AVATAR_BASE}?seed=${myProfile.userid}&backgroundColor=1e1f21`;
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
  try {
    await loadProfiles();
    await startRound();
  } catch (e) {
    console.error('[Match] Errore durante init:', e);
  }
}

init();