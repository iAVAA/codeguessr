import { getSession } from '../managers/auth.js';

const AVATAR_BASE = 'https://api.dicebear.com/8.x/bottts-neutral/svg';

let timerInterval;
let timeRemaining = 30;

let myHealth = 100;
let oppHealth = 100;

const sampleSnippet = `/**
 * Returns the nth Fibonacci number.
 * Note: this is a slow, recursive implementation meant for example.
 */
function fibonacci(n) {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fib(10):", fibonacci(10));
`;

// Initialize Monaco Editor
function initMonacoEditor() {
  if (window.require) {
    window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
    window.require(['vs/editor/editor.main'], function () {
        window.monaco.editor.create(document.getElementById('monaco-container'), {
            value: sampleSnippet,
            language: 'javascript',
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
        });
    });
  } else {
    console.error("[Match] Monaco require() not found. Loader missing?");
  }
}

async function loadMatchData() {
  const { isLoggedIn, idGiocatore } = getSession();
  
  let myProfile = { user: "Giocatore", livello: 1, exp: 0, userid: "guest" };
  const oppSeed = "opponent_boss_42";

  // Popola dati di default immediatamente per non bloccare la UI
  document.getElementById('match-p1-name').textContent = myProfile.user;
  document.getElementById('match-p1-lvl').textContent = myProfile.livello;
  document.getElementById('match-p1-cups').textContent = myProfile.exp;
  document.getElementById('match-p1-avatar').src = `${AVATAR_BASE}?seed=${myProfile.userid}&backgroundColor=1e1f21`;

  // Populate Player 2 (Mock Opponent)
  document.getElementById('match-p2-name').textContent = "HackerMan99";
  document.getElementById('match-p2-lvl').textContent = "42";
  document.getElementById('match-p2-cups').textContent = "8400";
  document.getElementById('match-p2-avatar').src = `${AVATAR_BASE}?seed=${oppSeed}&backgroundColor=1e1f21`;

  // Start Editor and Timer Immediately
  initMonacoEditor();
  startTimer();

  // Async fetch in background
  if (isLoggedIn && idGiocatore) {
    try {
      const res = await fetch(`/api/profilo/${idGiocatore}`);
      if (res.ok) {
         myProfile = await res.json();
         // Update with real fetched data
         document.getElementById('match-p1-name').textContent = myProfile.user;
         document.getElementById('match-p1-lvl').textContent = myProfile.livello || 1;
         document.getElementById('match-p1-cups').textContent = myProfile.exp || 0;
         document.getElementById('match-p1-avatar').src = `${AVATAR_BASE}?seed=${myProfile.userid}&backgroundColor=1e1f21`;
      }
    } catch(e) {
      console.error("[Match] Profile fetch error:", e);
    }
  }
}

function startTimer() {
  const timerEl = document.getElementById('match-timer');
  
  timerInterval = setInterval(() => {
    timeRemaining--;
    
    let secs = timeRemaining.toString().padStart(2, '0');
    timerEl.textContent = `00:${secs}`;

    if (timeRemaining <= 10 && timeRemaining > 0) {
      timerEl.classList.add('hurry');
    }

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
  
  const bar = document.getElementById(`match-${player}-health`);
  const text = document.getElementById(`match-${player}-hp`);
  
  if (bar && text) {
    bar.style.width = `${hp}%`;
    text.textContent = hp;
    
    bar.classList.remove('warning', 'danger');
    if (hp <= 30) {
      bar.classList.add('danger');
    } else if (hp <= 60) {
      bar.classList.add('warning');
    }
  }
}

function handleTimeOut() {
  const feedback = document.getElementById('guess-feedback');
  feedback.textContent = "Tempo Scaduto! Hai perso 30 HP.";
  feedback.className = "mt-2 text-center text-danger";
  feedback.style.fontWeight = "bold";
  reduceHealth('p1', 30);
  document.getElementById('guess-input').disabled = true;
  document.querySelector('.guess-btn').disabled = true;
}


// Interazione Form di Risposta
const guessForm = document.getElementById('guess-form');
if (guessForm) {
  guessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('guess-input');
    const feedback = document.getElementById('guess-feedback');
    const val = input.value.trim().toLowerCase();
    
    // Stop the timer
    clearInterval(timerInterval);
    document.getElementById('match-timer').classList.remove('hurry');

    // MOCK VERIFICATION
    if (val === 'javascript' || val === 'js') {
      feedback.innerHTML = '<i class="bi bi-check-circle-fill"></i> Risposta Corretta! L\'avversario perde 50 HP.';
      feedback.className = "mt-2 text-center text-success";
      feedback.style.fontWeight = "bold";
      reduceHealth('p2', 50);
    } else {
      feedback.innerHTML = `<i class="bi bi-x-circle-fill"></i> Sbagliato! Era <b>JavaScript</b>. Tu perdi 30 HP.`;
      feedback.className = "mt-2 text-center text-danger";
      feedback.style.fontWeight = "bold";
      reduceHealth('p1', 30);
    }
    
    input.disabled = true;
    guessForm.querySelector('.guess-btn').disabled = true;
  });
}

// Inizializza tutto
try {
  console.log("[Match] Initializing match module...");
  loadMatchData();
} catch (e) {
  console.error("[Match] Error during initialization:", e);
}
