import { getSession } from '../managers/auth.js';

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';

let timerInterval;
let timeRemaining = 30;

let myHealth = 100;
let oppHealth = 100;

// Snippet di fallback usato solo se il fetch dal nostro backend fallisce
const fallbackSnippet = {
  code: `function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\nconsole.log("Fib(10):", fibonacci(10));`,
  monacoLang: 'javascript',
  source: 'fallback',
  fileUrl: null
};

let currentSnippet = fallbackSnippet;
let monacoEditorInstance = null;

/**
 * Chiama l'API del nostro server per ottenere un codice generato da GitHub
 */
async function fetchRandomGitHubSnippet() {
  const res = await fetch('/api/random-snippet');
  if (!res.ok) {
    throw new Error(`Server returned status: ${res.status}`);
  }
  return await res.json();
}

/**
 * Aggiorna la titlebar VS Code con nome file + badge linguaggio.
 */
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

/**
 * Inizializza Monaco con lo snippet fornito (codice + linguaggio corretto).
 */
function initMonacoEditor(snippet) {
  if (!window.require) {
    console.error("[Match] Monaco require() not found.");
    return;
  }

  window.require.config({
    paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
  });

  window.require(['vs/editor/editor.main'], function () {
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

async function loadMatchData() {
  const { isLoggedIn, idGiocatore } = getSession();

  let myProfile = { user: "Giocatore", livello: 1, exp: 0, userid: "guest" };
  const oppSeed = "opponent_boss_42";

  document.getElementById('match-p1-name').textContent = myProfile.user;
  document.getElementById('match-p1-lvl').textContent  = myProfile.livello;
  document.getElementById('match-p1-cups').textContent = myProfile.exp;
  document.getElementById('match-p1-avatar').src = `${AVATAR_BASE}?seed=${myProfile.userid}&backgroundColor=1e1f21`;

  document.getElementById('match-p2-name').textContent = "HackerMan99";
  document.getElementById('match-p2-lvl').textContent  = "42";
  document.getElementById('match-p2-cups').textContent = "8400";
  document.getElementById('match-p2-avatar').src = `${AVATAR_BASE}?seed=${oppSeed}&backgroundColor=1e1f21`;

  // Placeholder nel titolo mentre carica
  const titleEl = document.querySelector('.vscode-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Caricamento snippet da GitHub...`;
  }

  // --- Fetch snippet dal nostro Backend ---
  try {
    currentSnippet = await fetchRandomGitHubSnippet();
    console.log(`[Match] Snippet caricato: ${currentSnippet.source} (${currentSnippet.monacoLang})`);
  } catch (err) {
    console.warn('[Match] Fetch dal server fallito, uso fallback:', err.message);
    currentSnippet = fallbackSnippet;
  }

  initMonacoEditor(currentSnippet);
  // --------------------------------

  const startCountdown = () => {
    const overlay = document.getElementById('match-countdown-overlay');
    const cdText  = document.getElementById('match-countdown-text');
    let countdownVal = 3;

    if (overlay && cdText) {
      const cdInterval = setInterval(() => {
        countdownVal--;
        if (countdownVal > 0) {
          cdText.textContent = countdownVal;
        } else if (countdownVal === 0) {
          cdText.textContent = "VIA!";
          cdText.style.color = "rgb(var(--darcula-blue))";
        } else {
          clearInterval(cdInterval);
          overlay.style.opacity    = '0';
          overlay.style.visibility = 'hidden';
          setTimeout(() => overlay.remove(), 500);
          startTimer();
        }
      }, 1000);
    } else {
      startTimer();
    }
  };

  if (document.body.classList.contains('loader-open')) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && !document.body.classList.contains('loader-open')) {
          observer.disconnect();
          startCountdown();
        }
      });
    });
    observer.observe(document.body, { attributes: true });
  } else {
    startCountdown();
  }

  if (isLoggedIn && idGiocatore) {
    try {
      const res = await fetch(`/api/profilo/${idGiocatore}`);
      if (res.ok) {
        myProfile = await res.json();
        document.getElementById('match-p1-name').textContent = myProfile.user;
        document.getElementById('match-p1-lvl').textContent  = myProfile.livello || 1;
        document.getElementById('match-p1-cups').textContent = myProfile.exp || 0;
        document.getElementById('match-p1-avatar').src = `${AVATAR_BASE}?seed=${myProfile.userid}&backgroundColor=1e1f21`;
      }
    } catch (e) {
      console.error("[Match] Profile fetch error:", e);
    }
  }
}

function startTimer() {
  const timerEl = document.getElementById('match-timer');

  timerInterval = setInterval(() => {
    timeRemaining--;
    timerEl.textContent = `00:${timeRemaining.toString().padStart(2, '0')}`;

    if (timeRemaining <= 10 && timeRemaining > 0) timerEl.classList.add('hurry');

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = "00:00";
      timerEl.classList.remove('hurry');
      handleTimeOut();
    }
  }, 1000);
}

function reduceHealth(player, amount) {
  let hp = player === 'p1' ? myHealth : oppHealth;
  hp = Math.max(0, hp - amount);
  if (player === 'p1') myHealth = hp; else oppHealth = hp;

  const bar  = document.getElementById(`match-${player}-health`);
  const text = document.getElementById(`match-${player}-hp`);

  if (bar && text) {
    bar.style.width  = `${hp}%`;
    text.textContent = hp;

    bar.classList.remove('warning', 'danger');
    if (hp <= 30)      bar.classList.add('danger');
    else if (hp <= 60) bar.classList.add('warning');
  }
}

function handleTimeOut() {
  const feedback = document.getElementById('guess-feedback');
  const danno_giocatore_2 = Math.floor(Math.random() * 41) + 40;

  feedback.innerHTML = `<i class="bi bi-alarm-fill"></i> Tempo Scaduto! (Tu: 0, Avversario: ${danno_giocatore_2})<br>Perdi <b>${danno_giocatore_2} HP</b>.`;
  feedback.className = "mt-2 text-center text-danger";
  feedback.style.fontWeight = "bold";

  reduceHealth('p1', danno_giocatore_2);
  document.getElementById('guess-input').disabled = true;
  document.querySelector('.guess-btn').disabled = true;
}

const guessForm = document.getElementById('guess-form');
if (guessForm) {
  guessForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const input     = document.getElementById('guess-input');
    const feedback  = document.getElementById('guess-feedback');
    const submitBtn = guessForm.querySelector('.guess-btn');
    const val       = input.value.trim();

    if (!val) return;

    clearInterval(timerInterval);
    document.getElementById('match-timer').classList.remove('hurry');
    input.disabled     = true;
    submitBtn.disabled = true;
    feedback.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Valutazione in corso...';
    feedback.className = 'mt-2 text-center';
    feedback.style.fontWeight = 'bold';

    try {
      const res = await fetch('/api/valuta-risposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: currentSnippet.code,
          risposta: val
        })
      });

      if (!res.ok) throw new Error(`Errore server: ${res.status}`);

      const { punteggio } = await res.json();
      const danno_giocatore_1 = punteggio;
      const danno_giocatore_2 = Math.floor(Math.random() * 61) + 30;
      const differenza        = danno_giocatore_1 - danno_giocatore_2;
      const danno_finale      = Math.abs(differenza);

      if (differenza > 0) {
        feedback.innerHTML = `<i class="bi bi-check-circle-fill"></i> Spiegazione superiore! (Tu: ${danno_giocatore_1}, Avversario: ${danno_giocatore_2})<br>L'avversario perde <b>${danno_finale} HP</b>.`;
        feedback.className = 'mt-2 text-center text-success';
        reduceHealth('p2', danno_finale);
      } else if (differenza < 0) {
        feedback.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i> L'avversario ha spiegato meglio! (Tu: ${danno_giocatore_1}, Avversario: ${danno_giocatore_2})<br>Perdi <b>${danno_finale} HP</b>.`;
        feedback.className = 'mt-2 text-center text-danger';
        reduceHealth('p1', danno_finale);
      } else {
        feedback.innerHTML = `<i class="bi bi-dash-circle-fill"></i> Pareggio! Entrambi <b>${danno_giocatore_1}</b>. Nessun danno.`;
        feedback.className = 'mt-2 text-center text-warning';
      }

    } catch (err) {
      console.error('[Match] Errore API valutazione:', err);
      feedback.innerHTML = `<i class="bi bi-wifi-off"></i> Errore di connessione. Riprova.`;
      feedback.className = 'mt-2 text-center text-danger';
      input.disabled     = false;
      submitBtn.disabled = false;
    }
  });
}

try {
  console.log("[Match] Initializing match module...");
  loadMatchData();
} catch (e) {
  console.error("[Match] Error during initialization:", e);
}