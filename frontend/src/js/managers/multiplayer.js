/*
    FILE: multiplayer.js
    DESCRIPTION: Gestore della comunicazione via Socket.io per il multiplayer.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession } from './auth.js';

let socket = null;

/**
 * Restituisce l'istanza corrente del socket.
 * @returns {Socket|null}
 */
export function getSocket() {
    return socket;
}

/**
 * Inizializza la connessione Socket.io e registra i listener.
 * @param {Object} callbacks - Oggetto contenente le funzioni di callback per la UI.
 */
export function initMultiplayer(callbacks = {}) {
    if (socket) return socket;

    const session = getSession();
    if (!session || !session.token) {
        console.error("[Multiplayer] Sessione non valida");
        return null;
    }

    // @ts-ignore - io è caricato globalmente via script tag
    socket = io({
        auth: { token: session.token }
    });

    // --- Registrazione Eventi ---

    socket.on('connect', () => {
        console.log("Connesso al server multiplayer");
        callbacks.onConnect?.();
    });

    socket.on('connect_error', (err) => {
        console.error("Errore socket:", err.message);
        callbacks.onError?.(err.message);
    });

    socket.on('statsUpdate', (data) => {
        callbacks.onStatsUpdate?.(data);
    });

    socket.on('roomCreated', (data) => {
        callbacks.onRoomCreated?.(data);
    });

    socket.on('challengeInvite', (data) => {
        callbacks.onChallengeInvite?.(data);
    });

    socket.on('challengeSent', (data) => {
        callbacks.onChallengeSent?.(data);
    });

    socket.on('challengeDeclined', (data) => {
        callbacks.onChallengeDeclined?.(data);
    });

    socket.on('challengeRejected', () => {
        callbacks.onChallengeRejected?.();
    });

    socket.on('challengeExpired', () => {
        callbacks.onChallengeExpired?.();
    });

    socket.on('challengeError', (data) => {
        callbacks.onChallengeError?.(data);
    });

    socket.on('matchFound', (data) => {
        callbacks.onMatchFound?.(data);
    });

    socket.on('error', (data) => {
        callbacks.onError?.(data.message);
    });

    return socket;
}

/* === AZIONI MULTIPLAYER === */

export function startMatchmaking() {
    socket?.emit('startMatchmaking');
}

export function createPrivateRoom() {
    socket?.emit('createPrivateRoom');
}

export function joinPrivateRoom(code) {
    socket?.emit('joinPrivateRoom', code);
}

export function challengeFriend(friendId) {
    socket?.emit('challengeFriend', { friendId });
}

/**
 * Risponde a una sfida ricevuta.
 * @param {string} inviteId 
 * @param {boolean} accepted 
 */
export function respondToChallenge(inviteId, accepted) {
    socket?.emit('respondChallenge', { inviteId, accepted });
}