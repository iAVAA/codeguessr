/*
    FILE: multiplayer_ui.js
    DESCRIPTION: Gestore dell'interfaccia utente per il multiplayer (modal e notifiche sfide).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession } from '../managers/auth.js';
import * as MultiplayerManager from '../managers/multiplayer.js';

let btnMultiplayer, overlay, btnClose, optMatchmaking, optPrivate;
let codeSection, inputCode, btnJoin, btnCreate, statusText;

let activeInvitePromptId = null;
let inviteOverlay = null;
let inviteTitle = null;

/**
 * Helper per mostrare notifiche toast se la funzione globale è disponibile.
 * @param {string} message - Il messaggio da mostrare.
 * @param {string} [color='blue'] - Il colore del toast.
 */
function notify(message, color = 'blue') {
    if (typeof showToast === 'function') {
        showToast(message, color);
    }
}

/* Crea e inizializza l'interfaccia UI per ricevere gli inviti di sfida */
function ensureInviteUI() {
    if (inviteOverlay) return;

    inviteOverlay = document.getElementById('cg-challenge-invite-overlay');
    if (!inviteOverlay) return;

    inviteTitle = document.getElementById('cg-challenge-invite-text');

    // Evento se l'utente accetta la sfida
    inviteOverlay.querySelector('#cg-challenge-accept')?.addEventListener('click', () => {
        if (!activeInvitePromptId) return;
        MultiplayerManager.respondToChallenge(activeInvitePromptId, true);
        closeInviteUI();
    });

    // Evento se l'utente rifiuta la sfida
    inviteOverlay.querySelector('#cg-challenge-reject')?.addEventListener('click', () => {
        if (!activeInvitePromptId) return;
        MultiplayerManager.respondToChallenge(activeInvitePromptId, false);
        closeInviteUI();
    });

    // Chiusura con tasto Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && inviteOverlay.classList.contains('open') && activeInvitePromptId) {
            MultiplayerManager.respondToChallenge(activeInvitePromptId, false);
            closeInviteUI();
        }
    });
}

/**
 * Mostra l'overlay di invito per una sfida ricevuta.
 * @param {string} challengerName - Nome dello sfidante.
 * @param {string} inviteId - ID univoco dell'invito.
 */
function openInviteUI(challengerName, inviteId) {
    ensureInviteUI();
    activeInvitePromptId = inviteId;
    if (inviteTitle) {
        inviteTitle.textContent = `${challengerName} ti ha invitato a una partita.`;
    }
    inviteOverlay.classList.add('open');
}

/* Chiude l'overlay di invito */
function closeInviteUI() {
    if (inviteOverlay) {
        inviteOverlay.classList.remove('open');
    }
    activeInvitePromptId = null;
}

/**
 * Inizializza la connessione multiplayer configurando le callback per la UI.
 */
function initMultiplayerConnection() {
    const session = getSession();
    
    MultiplayerManager.initMultiplayer({
        onConnect: () => {
            if (statusText) statusText.textContent = "Connesso al server";
        },
        onError: (msg) => {
            if (statusText) statusText.textContent = "Errore di connessione";
            notify(msg, "red");
        },
        onStatsUpdate: (data) => {
            if (statusText) statusText.textContent = `${data.onlinePlayers} giocatori online`;
        },
        onRoomCreated: (data) => {
            notify(`Stanza creata! Codice: ${data.code}`, "green");
            if (inputCode) inputCode.value = data.code;
            if (statusText) statusText.textContent = `In attesa di un avversario nella stanza ${data.code}...`;
        },
        onChallengeInvite: (data) => {
            if (activeInvitePromptId) {
                MultiplayerManager.respondToChallenge(data.inviteId, false);
                return;
            }
            const challengerName = data.challenger.nickname || 'Un giocatore';
            notify(`Sfida ricevuta da ${challengerName}`, 'blue');
            openInviteUI(challengerName, data.inviteId);
        },
        onChallengeSent: (data) => {
            const friendName = data?.friendNickname || 'il tuo amico';
            notify(`Invito inviato a ${friendName}. In attesa...`, 'blue');
        },
        onChallengeDeclined: (data) => {
            const name = data?.by?.nickname || 'L\'avversario';
            notify(`${name} ha rifiutato la sfida.`, 'orange');
        },
        onChallengeRejected: () => {
            notify('Hai rifiutato la sfida.', 'orange');
            closeInviteUI();
        },
        onChallengeExpired: () => {
            notify('Invito scaduto.', 'orange');
            closeInviteUI();
        },
        onChallengeError: (data) => {
            notify(data?.message || 'Errore nella sfida.', 'red');
        },
        onMatchFound: (data) => {
            closeInviteUI();
            const opponent = data.players.find(p => p.id !== session.idGiocatore)?.nickname || 'Avversario';
            notify(`Partita trovata contro ${opponent}!`, "blue");
            setTimeout(() => {
                window.location.href = `/match?room=${data.roomCode}`;
            }, 1500);
        }
    });
}

/* Inizializza gli elementi del DOM e i relativi event listener */
function initUI() {
    btnMultiplayer = document.getElementById('btn-multiplayer');
    overlay = document.getElementById('multiplayer-modal-overlay');
    btnClose = document.getElementById('multiplayer-modal-close');
    optMatchmaking = document.getElementById('multi-opt-matchmaking');
    optPrivate = document.getElementById('multi-opt-private');
    codeSection = document.getElementById('multi-code-section');
    inputCode = document.getElementById('multi-room-code');
    btnJoin = document.getElementById('multi-btn-join');
    btnCreate = document.getElementById('multi-btn-create');
    statusText = document.getElementById('multi-active-players');

    if (btnMultiplayer) btnMultiplayer.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    optMatchmaking?.addEventListener('click', () => {
        MultiplayerManager.startMatchmaking();
        if (statusText) statusText.textContent = "Ricerca avversario...";
        notify("Ricerca avversario in corso...", "blue");
    });

    optPrivate?.addEventListener('click', () => {
        const isHidden = window.getComputedStyle(codeSection).display === 'none';
        codeSection.style.display = isHidden ? 'flex' : 'none';

        const isMobile = window.matchMedia("(max-width: 768px)").matches;

        
        if (isHidden) 
            if(isMobile) {
                inputCode.blur();
            }else {                
                inputCode.focus();
            }
    });

    btnCreate?.addEventListener('click', () => {
        MultiplayerManager.createPrivateRoom();
        btnJoin.classList.add('d-none');
        btnCreate.classList.add('d-none');


    });

    btnJoin?.addEventListener('click', () => {
        const code = inputCode.value.trim();
        if (code.length !== 5) {
            notify("Inserisci un codice a 5 cifre", "red");
            return;
        }

        MultiplayerManager.joinPrivateRoom(code);
    });

    inputCode?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    });

    // Listener per sfide esterne (es. sidebar amici)
    window.addEventListener('cg:challenge-friend', (event) => {
        const friendId = event?.detail?.friendId;
        if (friendId) {
            MultiplayerManager.challengeFriend(friendId);
        }
    });
}

function openModal() {
    overlay?.classList.add('open');
    console.log("Modal multiplayer aperto, inizializzando connessione...");
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    btnJoin.classList.remove('d-none');
    btnCreate.classList.remove('d-none');

    if (codeSection) codeSection.style.display = 'none';
    if (inputCode) inputCode.value = '';
    initMultiplayerConnection();
}

function closeModal() {
    overlay?.classList.remove('open');
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
}


// Avvio al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    // Connessione immediata per ricevere sfide in background
    initMultiplayerConnection();
});