/*
    FILE: match_timer.js
    DESCRIPTION: Gestione del timer di round e del countdown pre-round.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { ROUND_SECONDS } from './match_config.js';


let timerInterval = null;
let countdownInterval = null;
let countdownPromise = null;

let timeRemaining = ROUND_SECONDS;

/**
 * Avvia il timer del round.
 * Resetta il tempo, aggiorna l'elemento #match-timer ogni secondo
 * e chiama onTimeOut() quando il tempo scade.
 *
 * @param {Function} onTimeOut - Callback da invocare allo scadere del tempo.
 */
export function startTimer(onTimeOut) {
    const timerEl = document.getElementById('match-timer');
    clearInterval(timerInterval);
    timerInterval = null;
    if (!timerEl) return;

    timeRemaining = ROUND_SECONDS;

    // Imposta il testo iniziale (formato MM:SS)
    timerEl.textContent = formatTime(timeRemaining);
    timerEl.classList.remove('hurry');

    timerInterval = setInterval(() => {
        timeRemaining--;

        timerEl.textContent = formatTime(timeRemaining);

        // Stato di "hurry" visivo (ultimi 10 secondi)
        if (timeRemaining <= 10 && timeRemaining > 0) {
            timerEl.classList.add('hurry');
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerEl.textContent = '00:00';
            timerEl.classList.remove('hurry');
            if (typeof onTimeOut === 'function') onTimeOut();
        }
    }, 1000);
}

/* Ferma il timer di round e rimuove lo stato di "hurry" */
export function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    const timerEl = document.getElementById('match-timer');
    if (timerEl) timerEl.classList.remove('hurry');
}


/**
 * Esegue il countdown 3 → 2 → 1 → VIA! sull'overlay #match-countdown-overlay.
 * Restituisce una Promise che si risolve al termine dell'animazione.
 * Se un countdown è già in corso, restituisce la Promise esistente (no duplicati).
 *
 * @returns {Promise<void>}
 */
export function runCountdown() {
    // Evita countdown sovrapposti
    if (countdownPromise) return countdownPromise;

    countdownPromise = new Promise((resolve) => {
        const overlay = document.getElementById('match-countdown-overlay');
        const cdText  = document.getElementById('match-countdown-text');

        // Se gli elementi non esistono, risolvi subito
        if (!overlay || !cdText) {
            countdownPromise = null;
            resolve();
            return;
        }

        // Pulisce un eventuale countdown già in esecuzione
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        // Rende visibile l'overlay e imposta il valore iniziale
        overlay.style.opacity    = '1';
        overlay.style.visibility = 'visible';
        overlay.style.display    = '';
        cdText.style.color       = '';
        cdText.textContent       = '3';

        let val = 3;

        countdownInterval = setInterval(() => {
            val--;
            if (val > 0) {
                cdText.textContent = String(val);
            } else if (val === 0) {
                // Ultima cifra: mostra "VIA!" con colore primario
                cdText.textContent = 'VIA!';
                cdText.style.color = 'rgb(var(--darcula-blue))';
            } else {
                // Countdown terminato: nascondi l'overlay con dissolvenza
                clearInterval(countdownInterval);
                countdownInterval = null;

                overlay.style.opacity    = '0';
                overlay.style.visibility = 'hidden';

                // 500ms corrisponde alla durata della transition CSS
                setTimeout(() => {
                    countdownPromise = null;
                    resolve();
                }, 500);
            }
        }, 1000);
    });

    return countdownPromise;
}

/* Interrompe immediatamente il countdown e nasconde l'overlay */
export function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    const overlay = document.getElementById('match-countdown-overlay');
    if (overlay) {
        overlay.style.opacity    = '0';
        overlay.style.visibility = 'hidden';
    }

    countdownPromise = null;
}


/**
 * Converte i secondi in formato MM:SS.
 *
 * @param {number} secs - Secondi da formattare.
 * @returns {string} Stringa in formato "MM:SS".
 */
function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Aspetta che il loader principale del sito venga chiuso prima di procedere.
 * Usa un MutationObserver sulla classe 'loader-open' di <body>.
 *
 * @returns {Promise<void>}
 */
export function waitForLoader() {
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