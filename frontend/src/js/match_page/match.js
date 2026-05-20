/*
    FILE: match.js
    DESCRIPTION: Coordinatore principale della pagina di partita. Gestisce lo stato della partita, la valutazione delle risposte e la connessione Socket.IO
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession } from '../managers/auth.js';
import { TOTAL_ROUNDS, SETTINGS_KEY } from './match_config.js';
import {
    startTimer, stopTimer,
    runCountdown, stopCountdown, waitForLoader
} from './match_timer.js';
import { loadRoundSnippet, setEditorContent, initMonacoEditor, getMonacoInstance } from './match_snippet.js';
import {
    updateRoundLabel, reduceHealth, updateHealthBars,
    setFormEnabled, setFeedback, setAIEvaluation,
    loadProfiles, showEndGame, showEndGameMultiplayer
} from './match_ui.js';


const state = {
    myHealth:  100,
    oppHealth: 100,
};

/* === STATO PARTITA ==== */
let currentRound = 1;
let totalRounds = TOTAL_ROUNDS;
let roundActive = false;
let currentSnippet = null;

/* === STATO MULTIPLAYER ==== */

let isMultiplayer = false;
let roomCode = null;
let socket = null;
let opponentData = null;
let lastServerRoundProcessed = 0;

/* ===== LOGICA BOT ===== */

/**
 * Legge la difficoltà salvata nelle impostazioni e restituisce l'intervallo
 * di punteggio del bot (min/max su 100).
 *
 * @returns {{ min: number, max: number }}
 */
function getBotScoreRange() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const s = raw ? JSON.parse(raw) : {};
        const diff = s.difficulty ?? 'normal';
        if (diff === 'easy') return { min: 10, max: 40 };
        if (diff === 'hard') return { min: 55, max: 95 };
        return { min: 30, max: 70 };
    } catch {
        return { min: 30, max: 70 };
    }
}

/**
 * Genera casualmente il punteggio del bot nell'intervallo di difficoltà corrente.
 *
 * @returns {number}
 */
function rollBotScore() {
    const { min, max } = getBotScoreRange();
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ===== LOGICA ROUND ===== */

/**
 * Avvia il round corrente:
 * 1. Aggiorna l'etichetta "Round X/Y" e resetta il form.
 * 2. Carica lo snippet (dal precaricato o da GitHub).
 * 3. Aspetta che il loader del sito venga chiuso.
 * 4. Esegue il countdown 3-2-1-VIA!.
 * 5. Attiva il form e avvia il timer.
 */
async function startRound() {
    stopCountdown();

    totalRounds = TOTAL_ROUNDS;
    updateRoundLabel(currentRound, totalRounds);
    setFeedback('Attesa risposta...');
    setAIEvaluation(null);
    setFormEnabled(false);
    roundActive = false;

    // Carica lo snippet prima del countdown così non si perde tempo di round
    currentSnippet = await loadRoundSnippet(currentRound);

    // Attende che il loader iniziale del sito venga chiuso
    await waitForLoader();

    // Solo ora mostra il countdown: Monaco è pronto e il loader è chiuso
    await runCountdown();

    roundActive = true;
    setFormEnabled(true);
    startTimer(handleTimeOut);
}


/**
 * Avanza al round successivo oppure mostra la schermata di fine partita,
 * a seconda delle condizioni (HP a zero o round terminati).
 *
 * @param {number} delay - Millisecondi da attendere prima di procedere.
 */
function _advanceOrEnd(delay) {
    if (state.myHealth <= 0 || state.oppHealth <= 0 || currentRound >= totalRounds) {
        setTimeout(() => showEndGame(state), delay);
    } else {
        currentRound++;
        setTimeout(startRound, delay);
    }
}

/* ===== LOGICA GESTORE RISPOSTA ===== */

/**
 * Gestisce l'invio di una risposta da parte del giocatore.
 * - In multiplayer: invia la risposta al server via socket.
 * - In singleplayer: valuta la risposta tramite API e applica i danni.
 *
 * @param {string} val - Testo della risposta inserita dall'utente.
 */
async function handleSubmit(val) {
    if (!roundActive) return;
    roundActive = false;

    stopTimer();
    setFormEnabled(false);
    setFeedback('<span class="spinner-border spinner-border-sm me-2" role="status"></span>Valutazione in corso...');

    /* === MULTIPLAYER === */
    if (isMultiplayer) {
        // In multiplayer la valutazione è server-side; attendiamo l'evento 'roundResult'
        socket.emit('submitMultiplayerAnswer', { roomCode, answer: val });
        setFeedback('<i class="bi bi-hourglass-split me-1"></i>In attesa dell\'altro giocatore...');
        return;
    }

    /* === SINGLEPLAYER === */
    try {
        const res = await fetch('/api/valuta-risposta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snippet: currentSnippet.code, risposta: val })
        });

        if (!res.ok) throw new Error(`Errore server: ${res.status}`);

        const { punteggio, valutazione } = await res.json();
        setAIEvaluation(valutazione);
        const myScore = punteggio;
        const botScore = rollBotScore();
        const diff = myScore - botScore;
        const damage = Math.abs(diff);

        if (diff > 0) {
            setFeedback(
                `<i class="bi bi-check-circle-fill me-1"></i>Spiegazione superiore! 
                (Tu: <b>${myScore}</b>, Bot: ${botScore})<br>Il bot perde <b>${damage} HP</b>.`,
                'text-success'
            );

            reduceHealth('p2', damage, state);
        }
        else if (diff < 0) {
            setFeedback(
                `<i class="bi bi-exclamation-circle-fill me-1"></i>Il bot ha spiegato meglio! 
                (Tu: <b>${myScore}</b>, Bot: ${botScore})<br>Perdi <b>${damage} HP</b>.`,
                'text-danger'
            );

            reduceHealth('p1', damage, state);
        }
        else {
            setFeedback(
                `<i class="bi bi-dash-circle-fill me-1"></i>Entrambi <b>${myScore}</b>. Nessun danno.`,
                'text-warning'
            );
        }
    } catch (err) {
        console.error('[match.js] Errore valutazione:', err);
        const botScore = rollBotScore();
        setFeedback(
            `<i class="bi bi-wifi-off me-1"></i>Errore di connessione. Il bot segna ${botScore}. Perdi <b>${botScore} HP</b>.`,
            'text-danger'
        );
        reduceHealth('p1', botScore, state);
    }

    _advanceOrEnd(5000);
}

/**
 * Gestisce lo scadere del tempo nel round.
 * - In multiplayer: invia risposta vuota al server.
 * - In singleplayer: applica il danno del bot al giocatore.
 */
function handleTimeOut() {
    if (!roundActive) return;
    roundActive = false;

    stopTimer();
    setFormEnabled(false);

    /* === MULTIPLAYER === */
    if (isMultiplayer) {
        socket.emit('submitMultiplayerAnswer', { roomCode, answer: '' });
        setFeedback('<i class="bi bi-alarm-fill me-1"></i>Tempo Scaduto! Valutazione in corso...');
        return;
    }

    /* === SINGLEPLAYER === */
    const botScore = rollBotScore();
    setFeedback(
        `<i class="bi bi-alarm-fill me-1"></i>Tempo Scaduto! (Tu: 0, Bot: ${botScore})<br>Perdi <b>${botScore} HP</b>.`,
        'text-danger'
    );
    reduceHealth('p1', botScore, state);
    _advanceOrEnd(5000);
}


/* ===== INVIO DEL FORM ===== */

/** Collega il form di risposta all'handler handleSubmit. */
const guessForm = document.getElementById('guess-form');
if (guessForm) {
    guessForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const val = document.getElementById('guess-input').value.trim();
        if (!val || !roundActive) return;
        handleSubmit(val);
    });
}

/* ===== EVENTI Socket.IO DEL MULTIPLAYER ===== */

/**
 * Inizializza la connessione Socket.IO e registra tutti gli handler degli eventi
 * necessari per la modalità multiplayer 1v1.
 *
 * @param {string} token - Token JWT per l'autenticazione sul server.
 */
function initMultiplayerSocket(token) {
    socket = io({ auth: { token } });

    socket.on('connect', () => {
        console.log('[match.js] Connesso al server multiplayer per la stanza:', roomCode);
        socket.emit('joinRoom', roomCode);
    });

    /* Il server ci invia i dati dei due giocatori nella stanza */
    socket.on('matchInfo', (data) => {
        const session = getSession();
        opponentData  = data.players.find(p => p.id !== session.idGiocatore);
        loadProfiles(isMultiplayer, opponentData);
        setFeedback("In attesa dell'altro giocatore...");
    });

    /* Il server segnala l'inizio di un round con lo snippet da visualizzare */
    socket.on('startRound', async (data) => {
        if (!data || typeof data.round !== 'number') return;

        // Ignora eventi duplicati per lo stesso round
        if (data.round <= lastServerRoundProcessed) return;
        lastServerRoundProcessed = data.round;

        stopCountdown();
        stopTimer();

        console.log('[match.js] Inizio round multiplayer:', data.round);
        currentRound   = data.round;
        if (typeof data.totalRounds === 'number' && data.totalRounds > 0) {
            totalRounds = data.totalRounds;
        }

        // Lo snippet arriva direttamente dal server, non va fetchato nuovamente
        currentSnippet = data?.snippet?.code ? data.snippet : null;
        updateRoundLabel(currentRound, totalRounds);

        setFeedback('');
        setAIEvaluation(null);
        setFormEnabled(false);
        const input = document.getElementById('guess-input');
        if (input) input.value = '';

        await waitForLoader();

        // Aggiorna Monaco con lo snippet fornito dal server
        if (currentSnippet) {
            if (getMonacoInstance()) {
                setEditorContent(currentSnippet);
            } else {
                await initMonacoEditor(currentSnippet);
            }
        }

        await runCountdown();

        roundActive = true;
        setFormEnabled(true);
        startTimer(handleTimeOut);
    });

    /* Il server comunica i risultati del round (punteggi, danni, HP aggiornati) */
    socket.on('roundResult', (data) => {
        const session = getSession();
        const myScore = data.scores[session.idGiocatore];
        const oppId = opponentData?.id;
        const oppScore = data.scores[oppId];
        const damage = data.damage;

        stopTimer();
        setFormEnabled(false);

        // Aggiorna le HP con i valori autoritativi del server
        state.myHealth = data.healths[session.idGiocatore];
        state.oppHealth = data.healths[oppId];
        updateHealthBars(state);

        // Mostra la spiegazione della valutazione AI personale
        if (data.evaluations && data.evaluations[session.idGiocatore]) {
            setAIEvaluation(data.evaluations[session.idGiocatore]);
        }

        if (data.winnerId === session.idGiocatore) {
            setFeedback(
                `<i class="bi bi-check-circle-fill me-1"></i>Spiegazione superiore! 
                (Tu: <b>${myScore}</b>, Avversario: ${oppScore})<br>L'avversario perde <b>${damage} HP</b>.`,
                'text-success'
            );
        }
        else if (data.winnerId === oppId) {
            setFeedback(
                `<i class="bi bi-exclamation-circle-fill me-1"></i>L'avversario ha spiegato meglio! 
                (Tu: <b>${myScore}</b>, Avversario: ${oppScore})<br>Perdi <b>${damage} HP</b>.`,
                'text-danger'
            );
        } else {
            setFeedback(
                `<i class="bi bi-dash-circle-fill me-1"></i>Entrambi <b>${myScore}</b>. Nessun danno.`,
                'text-warning'
            );
        }
    });

    /* Il server segnala la fine della partita multiplayer */
    socket.on('matchFinished', (data) => {
        stopCountdown();
        showEndGameMultiplayer(data);
    });

    /* Errori generici inviati dal server */
    socket.on('error', (data) => {
        if (typeof showToast === 'function') showToast(data.message, 'red');
    });
}

/* ===== INIZIALIZZAZIONE ===== */

/**
 * Punto di ingresso principale: determina la modalità (single/multi),
 * configura il socket se necessario e avvia la prima fase di gioco.
 */
async function init() {
    console.log('[match.js] Inizializzazione partita...');

    // Legge il codice stanza dall'URL (presente solo in multiplayer)
    const urlParams = new URLSearchParams(window.location.search);
    roomCode = urlParams.get('room');
    isMultiplayer = !!roomCode; // Se roomCode != NULL allora assegna a isMultiplayer il valore Booleano TRUE

    if (isMultiplayer) {
        const session = getSession();
        initMultiplayerSocket(session.token);
        // In multiplayer i round vengono avviati dal server tramite 'startRound'
    }

    try {
        await loadProfiles(isMultiplayer, opponentData);
        if (!isMultiplayer) {
            await startRound();
        }
    } catch (e) {
        console.error('[match.js] Errore durante init:', e);
    }
}

init();