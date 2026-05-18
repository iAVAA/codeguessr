/*
    FILE: profile_history.js
    DESCRIPTION: Gestisce il rendering della cronologia delle partite nella pagina profilo.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { formatRelativeTime } from './profile_ui.js';


/* Costruisce l'elemento DOM di una singola riga della cronologia partite */
function buildHistoryElement(match, playerName) {
    const templateContainer = document.getElementById('history-item');
    if (!templateContainer || !templateContainer.firstElementChild) return null;

    const clone = templateContainer.firstElementChild.cloneNode(true);

    const isAmichevole = match.modalita === 'amichevole';
    const isWin = match.risultato === 'vittoria';
    
    let iconClass = 'bi-arrow-down-right';
    let resultClass = 'loss';
    let xpColor = 'text-darcula-red';
    let xpPrefix = '';
    let textResult = 'Sconfitta';

    if (isAmichevole) {
        iconClass = 'bi-dash-lg';
        resultClass = 'tie';
        xpColor = 'text-darcula-yellow';
        xpPrefix = '';
        textResult = 'Pareggio';
    } else if (isWin) {
        iconClass = 'bi-arrow-up-right';
        resultClass = 'win';
        xpColor = 'text-darcula-green';
        xpPrefix = '+';
        textResult = 'Vittoria';
    }

    const timeAgo = formatRelativeTime(match.data_fine || match.data_inizio);

    const resultDiv = clone.querySelector('.history-result');
    resultDiv.classList.add(resultClass);
    resultDiv.querySelector('i').classList.add(iconClass);

    clone.querySelector('.history-lang').textContent = textResult;

    const trophiesSpan = clone.querySelector('.history-trophies');
    if (match.trofei_cambiati !== 0) {
        trophiesSpan.classList.remove('d-none');
        const tColor = match.trofei_cambiati > 0 ? 'text-darcula-yellow' : 'text-darcula-red';
        const tPrefix = match.trofei_cambiati > 0 ? '+' : '';
        trophiesSpan.classList.add(tColor);
        trophiesSpan.querySelector('.trophies-val').textContent = `${tPrefix}${match.trofei_cambiati}`;
    }

    let modeLabel = 'Single Player';
    if (match.modalita === 'multiplayer') modeLabel = 'Multiplayer';
    else if (match.modalita === 'amichevole') modeLabel = 'Amichevole';
    clone.querySelector('.history-mode').textContent = modeLabel;

    const opponentSpan = clone.querySelector('.history-opponent');
    if (match.modalita === 'multiplayer' || match.modalita === 'amichevole') {
        opponentSpan.classList.remove('d-none');
        
        const myNameStr = playerName || 'Tu';
        const oppNameStr = match.opponent || 'Sconosciuto';
        
        opponentSpan.querySelector('.my-name').textContent = myNameStr;
        opponentSpan.querySelector('.history-my-link').href = `/profilo/${myNameStr}`;
        
        opponentSpan.querySelector('.opponent-name').textContent = oppNameStr;
        opponentSpan.querySelector('.history-opp-link').href = `/profilo/${oppNameStr}`;
    }

    const xpDiv = clone.querySelector('.history-xp');
    xpDiv.classList.add(xpColor);
    xpDiv.textContent = `${xpPrefix}${match.exp_guadagnata} XP`;

    clone.querySelector('.history-time').textContent = timeAgo;

    return clone;
}


/* Inietta le ultime 10 partite nella lista dello storico */
export function renderHistory(history, playerName) {
    const container = document.querySelector('.profile-history-list');
    if (!container) return;

    container.innerHTML = '';

    if (!history || history.length === 0) {
        const emptyContainer = document.getElementById('history-empty');

        if (emptyContainer && emptyContainer.firstElementChild) {
            container.appendChild(emptyContainer.firstElementChild.cloneNode(true));
        }
        return;
    }

    history.slice(0, 10).forEach(match => {
        const el = buildHistoryElement(match, playerName);
        if (el) container.appendChild(el);
    });
}