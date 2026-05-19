/*
    FILE: match_ui.js
    DESCRIPTION: Gestione dell'interfaccia utente della pagina di match e schermate modali
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession, fetchAuth } from '../managers/auth.js';
import { SETTINGS_KEY } from './match_config.js';


/**
 * Aggiorna l'etichetta "Round X/Y" nell'header della partita.
 *
 * @param {number} currentRound - Round corrente.
 * @param {number} totalRounds  - Numero totale di round.
 */
export function updateRoundLabel(currentRound, totalRounds) {
    const el = document.getElementById('match-round');
    if (el) el.textContent = `Round ${currentRound}/${totalRounds}`;
}


/**
 * Riduce la vita di un giocatore di una certa quantità e aggiorna la barra HP.
 * I valori HP vengono clampati tra 0 e 100.
 *
 * @param {'p1' | 'p2'} player - Identificatore del giocatore.
 * @param {number} amount - Danno da applicare.
 * @param {object} state  - Oggetto di stato condiviso con match.js ({ myHealth, oppHealth }).
 */
export function reduceHealth(player, amount, state) {
    let hp = player === 'p1' ? state.myHealth : state.oppHealth;
    hp = Math.max(0, hp - amount);

    if (player === 'p1') state.myHealth = hp;
    else state.oppHealth = hp;

    renderHealthBar(player, hp);
}

/**
 * Aggiorna entrambe le barre HP con i valori correnti di stato.
 * Usato principalmente in multiplayer dopo un evento roundResult.
 *
 * @param {object} state - Oggetto di stato ({ myHealth, oppHealth }).
 */
export function updateHealthBars(state) {
    renderHealthBar('p1', state.myHealth);
    renderHealthBar('p2', state.oppHealth);
}

/**
 * Aggiorna la barra HP e il testo numerico di un giocatore.
 *
 * @param {'p1' | 'p2'} player - Identificatore del giocatore.
 * @param {number} hp - Valore HP da visualizzare.
 */
function renderHealthBar(player, hp) {
    const bar  = document.getElementById(`match-${player}-health`);
    const text = document.getElementById(`match-${player}-hp`);

    if (bar && text) {
        bar.style.width = `${hp}%`;
        bar.setAttribute('aria-valuenow', hp);
        text.textContent = hp;

        // Aggiorna la classe di colore in base alla soglia HP
        bar.classList.remove('warning', 'danger');
        if (hp <= 30) bar.classList.add('danger');
        else if (hp <= 60) bar.classList.add('warning');
    }
}


/**
 * Abilita o disabilita il form di risposta e il bottone di invio.
 * Se abilitato, svuota il campo di testo e vi sposta il focus.
 *
 * @param {boolean} enabled - true per abilitare, false per disabilitare.
 */
export function setFormEnabled(enabled) {
    const input = document.getElementById('guess-input');
    const submitBtn = document.querySelector('.guess-btn');

    if (input) input.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
    if (enabled && input) {
        input.value = '';
        input.focus();
    }
}


/**
 * Imposta il messaggio di feedback visibile sotto al form di risposta.
 *
 * @param {string} html - Contenuto HTML da visualizzare.
 * @param {string} [colorClass] - Classe CSS di colore (es. 'text-success', 'text-danger').
 */
export function setFeedback(html, colorClass = '') {
    const el = document.getElementById('guess-feedback');
    if (!el) return;
    el.innerHTML  = html;
    el.className  = `mt-3 text-center fw-bold ${colorClass}`.trim();
}

/**
 * Imposta e mostra la spiegazione della valutazione dell'AI.
 * Se text è vuoto o null, nasconde il box di valutazione.
 *
 * @param {string} text - Testo della valutazione fornito dall'AI.
 */
export function setAIEvaluation(text) {
    const box = document.getElementById('ai-evaluation-box');
    const content = document.getElementById('ai-evaluation-content');
    const input = document.getElementById('guess-input');
    if (!box || !content) return;

    if (text) {
        content.textContent = text;
        box.classList.remove('d-none');
        if (input) input.classList.add('d-none');
    } else {
        box.classList.add('d-none');
        content.textContent = '';
        if (input) input.classList.remove('d-none');
    }
}


/**
 * Carica i dati dei profili dei due giocatori e li mostra nell'header.
 * - P1: recupera il profilo reale dal DB se autenticato.
 * - P2: mostra i dati del bot in base alla difficoltà impostata,
 *       oppure i dati dell'avversario reale in multiplayer.
 *
 * @param {boolean} isMultiplayer  - Se la partita è in modalità multiplayer.
 * @param {object|null} opponentData - Dati dell'avversario (solo multiplayer).
 */
export async function loadProfiles(isMultiplayer, opponentData) {
    const { isLoggedIn, idGiocatore } = getSession();

    // Valori di default per P1 (mostrati mentre il fetch è in corso)
    document.getElementById('match-p1-name').textContent = 'Giocatore';
    document.getElementById('match-p1-lvl').textContent  = 1;
    document.getElementById('match-p1-cups').textContent = 0;
    document.getElementById('match-p1-avatar').src       = '/src/assets/img/user_profile.webp';

    // Popola P2: avversario reale (multiplayer) oppure bot (singleplayer)
    if (isMultiplayer && opponentData) {
        document.getElementById('match-p2-name').textContent = opponentData.nickname;
        document.getElementById('match-p2-lvl').textContent  = opponentData.livello  || '';
        document.getElementById('match-p2-cups').textContent = opponentData.trophies || '';
        document.getElementById('match-p2-avatar').src = opponentData.avatar_url || '/src/assets/img/user_profile.webp';
    } else {
        _loadBotProfile();
    }

    // Recupera il profilo reale di P1 dal DB (se loggato)
    if (isLoggedIn && idGiocatore) {
        try {
            const res = await fetch(`/api/profilo/${idGiocatore}`);

            if (res.ok) {
                const myProfile = await res.json();
                document.getElementById('match-p1-name').textContent = myProfile.user;
                document.getElementById('match-p1-lvl').textContent  = myProfile.livello || 1;
                document.getElementById('match-p1-cups').textContent = myProfile.trophies || 0;
                document.getElementById('match-p1-avatar').src = myProfile.avatar_url || '/src/assets/img/user_profile.webp';
            }
        } catch (e) {
            console.error('[match_ui.js] Errore caricamento profilo P1:', e);
        }
    }
}

/**
 * Popola i dati del bot avversario (P2) in base alla difficoltà salvata
 * nelle impostazioni utente.
 */
function _loadBotProfile() {
    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
        console.error('[match_ui.js] Errore caricamento dati impostazioni:', e);
    }

    const diff = settings.difficulty ?? 'normal';

    const botNames = { easy: 'EasyBot', normal: 'CodeBot', hard: 'HardCore' };
    const botLvls = { easy: 5, normal: 25, hard: 99 };
    const botCups = { easy: 400, normal: 2800, hard: 9999 };

    document.getElementById('match-p2-name').textContent = botNames[diff] || '';
    document.getElementById('match-p2-lvl').textContent  = botLvls[diff]  || 1;
    document.getElementById('match-p2-cups').textContent = botCups[diff]  || 0;
    document.getElementById('match-p2-avatar').src = '/src/assets/img/bot_image.webp';
}


/**
 * Invia il risultato della partita singleplayer al backend per la persistenza su DB.
 * La flag matchSaved è gestita esternamente in match.js per evitare doppi salvataggi.
 *
 * @param {string} risultato - 'vittoria' | 'sconfitta'.
 * @param {number} expGuadagnata - Punti EXP da assegnare (positivi o negativi).
 */
export async function saveMatchResult(risultato, expGuadagnata) {
    const token = localStorage.getItem('supabaseToken');
    if (!token) {
        console.warn('[match_ui.js] Utente non autenticato, partita non salvata.');
        return false;
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
            console.log(`[match_ui.js] Partita salvata! EXP: ${saved.nuova_exp}, LV: ${saved.nuovo_livello}`);
            return true;
        } else {
            console.warn('[match_ui.js] Errore salvataggio partita:', res.status);
            return false;
        }
    } catch (err) {
        console.error('[match_ui.js] Impossibile salvare la partita:', err);
        return false;
    }
}


/**
 * Mostra la schermata di fine partita per la modalità singleplayer.
 * Calcola EXP guadagnate/perse e salva il risultato nel DB.
 *
 * @param {object} state - Stato corrente della partita ({ myHealth, oppHealth }).
 */
export function showEndGame(state) {
    const { myHealth, oppHealth } = state;

    let result, title, subtitle, icon, expEarned, badgeClass;

    if (myHealth >= oppHealth) {
        result = 'vittoria';
        title = 'VITTORIA!';
        subtitle = myHealth === oppHealth
            ? `Entrambi con ${myHealth} HP - Vittoria per tutti!`
            : `Hai vinto con ${myHealth} HP rimasti!`;
        icon = 'bi-trophy-fill';
        badgeClass = 'end-result--win';
        expEarned = 100 + Math.round(myHealth / 2);
        if (typeof CG_Sound !== 'undefined') CG_Sound.playWin();
    }
    else {
        result = 'sconfitta';
        title = 'SCONFITTA';
        subtitle = `Il bot ha vinto con ${oppHealth} HP rimasti.`;
        icon = 'bi-x-octagon-fill';
        badgeClass = 'end-result--lose';
        expEarned = -10 - Math.round(oppHealth / 2);
        if (typeof CG_Sound !== 'undefined') CG_Sound.playGameOver();
    }

    saveMatchResult(result, expEarned);
    _renderEndGameOverlay({ title, subtitle, icon, badgeClass, expEarned, myHealth, oppHealth, opponentLabel: 'Bot' });
}

/**
 * Mostra la schermata di fine partita per la modalità multiplayer.
 * Legge EXP e trofei guadagnati/persi dal payload del server.
 *
 * @param {object} data - Dati dell'evento 'matchFinished' dal server.
 * @param {string|null} data.winner   - ID del vincitore (null = pareggio).
 * @param {boolean} data.unranked - true se la partita non assegna trofei.
 * @param {object} data.rewards  - Mappa id→{exp, trophies} per ogni giocatore.
 */
export function showEndGameMultiplayer(data) {
    const { idGiocatore } = getSession();
    const isWinner = data.winner === idGiocatore || data.winner === null;

    const title = isWinner ? 'VITTORIA!' : 'SCONFITTA';
    const icon = isWinner ? 'bi-trophy-fill' : 'bi-x-octagon-fill';
    const badgeClass = isWinner ? 'end-result--win' : 'end-result--lose';
    const subtitle = isWinner ? 'Hai dominato la sfida!' : 'Sarà per la prossima volta!';

    if (isWinner) {
        if (typeof CG_Sound !== 'undefined') CG_Sound.playWin();
    }
    else {
        if (typeof CG_Sound !== 'undefined') CG_Sound.playGameOver();
    }

    // Legge le ricompense personali dal payload del server
    const myRewards = data.rewards?.[idGiocatore] ?? null;
    const expEarned = myRewards?.exp ?? null;
    // I trofei sono mostrati solo nelle partite ranked
    const trophyDiff = !data.unranked ? (myRewards?.trophies ?? null) : null;

    _renderEndGameOverlay({
        title, subtitle, icon, badgeClass,
        expEarned,
        trophyDiff,
        myHealth: null,
        oppHealth: null,
        opponentLabel: 'Avversario'
    });
}

/**
 * Crea e aggiunge al DOM l'overlay di fine partita con animazione di ingresso.
 *
 * @param {object} opts
 * @param {string} opts.title - Titolo principale (es. "VITTORIA!").
 * @param {string} opts.subtitle - Sottotitolo descrittivo.
 * @param {string} opts.icon - Classe Bootstrap Icon.
 * @param {string} opts.badgeClass - Classe CSS per il colore del card (win/lose).
 * @param {number|null} opts.expEarned - EXP guadagnate/perse (null se non disponibile).
 * @param {number|null} opts.trophyDiff - Trofei guadagnati/persi (null se non disponibile o unranked).
 * @param {number|null} opts.myHealth - HP finali del giocatore (null in multiplayer).
 * @param {number|null} opts.oppHealth - HP finali dell'avversario (null in multiplayer).
 * @param {string} opts.opponentLabel - Etichetta dell'avversario (es. 'Bot', 'Avversario').
 */
function _renderEndGameOverlay({ title, subtitle, icon, badgeClass, expEarned, trophyDiff = null, myHealth, oppHealth, opponentLabel = 'Avversario' }) {
    // Sezione HP: visibile solo in singleplayer
    const hpSection = (myHealth !== null && oppHealth !== null) ? `
        <div class="end-game-hp-row d-flex justify-content-center">
            <div class="end-hp-badge">
                <span class="end-hp-label">Tu</span>
                <span class="end-hp-val ${myHealth > oppHealth ? 'text-success' : (myHealth < oppHealth ? 'text-danger' : 'text-warning')}">${myHealth} HP</span>
            </div>
            <div class="end-hp-sep">vs</div>
            <div class="end-hp-badge">
                <span class="end-hp-label">${opponentLabel}</span>
                <span class="end-hp-val ${oppHealth > myHealth ? 'text-danger' : (oppHealth < myHealth ? 'text-success' : 'text-warning')}">${oppHealth} HP</span>
            </div>
        </div>` : '';

    // Sezione ricompense: mostra EXP e trofei quando disponibili
    const rewardsSection = (expEarned !== null || trophyDiff !== null) ? `
        <div class="end-rewards-row d-flex gap-3 justify-content-center flex-wrap">
            ${expEarned !== null ? `
            <div class="end-exp-badge">
                <i class="bi bi-star-fill me-1"></i>${expEarned > 0 ? '+' : ''}${expEarned} EXP
            </div>` : ''}
            ${trophyDiff !== null ? `
            <div class="end-trophy-badge ${trophyDiff >= 0 ? 'trophy--gain' : 'trophy--loss'}">
                <i class="bi bi-trophy-fill me-1"></i>${trophyDiff > 0 ? '+' : ''}${trophyDiff}
            </div>` : ''}
        </div>` : '';

    const overlay = document.getElementById('end-game-overlay');
    if (!overlay) return;

    const card = document.getElementById('end-game-card');
    const iconEl = document.getElementById('end-game-icon');
    const titleEl = document.getElementById('end-game-title');
    const subtitleEl = document.getElementById('end-game-subtitle');
    const hpContainer = document.getElementById('end-game-hp-section');
    const rewardsContainer = document.getElementById('end-game-rewards-section');

    // Assegna il colore del badge (rimuovi classi precedenti win/lose/tie)
    card.className = `end-game-card p-4 p-lg-5 text-center d-flex flex-column align-items-center gap-3 ${badgeClass}`;

    // Aggiorna icone e testi
    iconEl.className = `bi ${icon} end-game-icon`;
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;

    // Inietta sezioni dinamiche
    hpContainer.innerHTML = hpSection;
    rewardsContainer.innerHTML = rewardsSection;

    // Doppio rAF per garantire un paint prima di aggiungere la classe di animazione
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
}