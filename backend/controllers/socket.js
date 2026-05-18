/*
    FILE: socket.js
    DESCRIPTION: Gestore real-time delle sessioni multiplayer competitive e private
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

const { supabase, updatePlayerStats } = require('../server');
const { evaluateAnswer, getRoundSnippet, buildFallbackSnippet } = require('./code');

// Stato in memoria delle sessioni di gioco
const matchmakingQueue = [];
const privateRooms = new Map(); // codice -> { host, giocatori: [], unranked: false }
const activeMatches = new Map(); // roomCode -> { players, partita_id, answers, ... }
const pendingFriendInvites = new Map(); // inviteId -> { challengerId, friendId, timeoutId }
const disconnectedMatches = new Map(); // roomCode -> { partita_id, disconnectTime, suspensionTimeout, disconnectedUserIds }

let io = null;

/**
 * Trova il socket attivo di un utente connesso tramite il suo UUID.
 */
function getSocketByUserId(userId) {
    if (!io) return null;
    for (const s of io.sockets.sockets.values()) {
        if (s.userId === userId) return s;
    }
    return null;
}

/**
 * Inserisce una nuova partita e le relative partecipazioni nel database.
 */
async function createDbMatch(idCasa, idTrasferta, modalita = 'multiplayer') {
    const { data: partita, error: errorPartita } = await supabase
        .from('partita')
        .insert([{
            modalita,
            stato: 'in_corso',
            data_inizio: new Date().toISOString(),
            id_utente_casa: idCasa,
            id_utente_trasferta: idTrasferta
        }])
        .select()
        .single();

    if (errorPartita) throw errorPartita;

    const { error: errorPartecipazione } = await supabase
        .from('partecipazione')
        .insert([
            { id_partita: partita.id_partita, id_giocatore: idCasa, risultato: null, exp_guadagnata: 0 },
            { id_partita: partita.id_partita, id_giocatore: idTrasferta, risultato: null, exp_guadagnata: 0 }
        ]);

    if (errorPartecipazione) throw errorPartecipazione;
    return partita.id_partita;
}

/**
 * Carica un frammento di codice (GitHub o fallback) e avvia un nuovo round per la stanza.
 */
async function startMultiplayerRound(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match) return;

    console.log(`[Match] Inizio Round ${match.currentRound} per ${roomCode}, partita_id=${match.partita_id}`);

    if (!match.started) {
        match.started = true;
    }

    try {
        const snippet = await getRoundSnippet(match.lastSnippetCode || null);
        match.currentSnippet = snippet;
        match.lastSnippetCode = snippet.code;
        match.answers = {};

        io.to(roomCode).emit('startRound', {
            round: match.currentRound,
            totalRounds: match.maxRounds,
            snippet
        });

        if (match.timer) clearTimeout(match.timer);
        match.timer = setTimeout(() => {
            if (activeMatches.has(roomCode)) evaluateMultiplayerRound(roomCode);
        }, 90000);

    } catch (err) {
        console.error(`[Match] Errore recupero snippet GitHub per ${roomCode}, applico fallback:`, err.message);
        const snippet = buildFallbackSnippet(match.lastSnippetCode || null);
        match.currentSnippet = snippet;
        match.lastSnippetCode = snippet.code;
        match.answers = {};

        io.to(roomCode).emit('startRound', {
            round: match.currentRound,
            totalRounds: match.maxRounds,
            snippet
        });

        if (match.timer) clearTimeout(match.timer);
        match.timer = setTimeout(() => {
            if (activeMatches.has(roomCode)) evaluateMultiplayerRound(roomCode);
        }, 90000);
    }
}

/**
 * Valuta le risposte dei giocatori in parallelo tramite AI e aggiorna i punti vita.
 */
async function evaluateMultiplayerRound(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match || match.evaluating) return;

    match.evaluating = true;
    if (match.timer) clearTimeout(match.timer);
    match.timer = null;

    const results = {};
    const pIds = match.players.map(p => p.id);

    try {
        const evaluations = await Promise.all(pIds.map(async (id) => {
            const score = await evaluateAnswer(match.currentSnippet.code, match.answers[id] || "");
            return { id, score };
        }));

        evaluations.forEach(ev => results[ev.id] = ev.score);

        const p1 = match.players[0];
        const p2 = match.players[1];
        const diff = results[p1.id] - results[p2.id];
        const damage = Math.abs(diff);

        if (diff > 0) {
            p2.health = Math.max(0, p2.health - damage);
        } else if (diff < 0) {
            p1.health = Math.max(0, p1.health - damage);
        }

        const roundResult = {
            scores: results,
            healths: {
                [p1.id]: p1.health,
                [p2.id]: p2.health
            },
            damage,
            winnerId: diff > 0 ? p1.id : (diff < 0 ? p2.id : null)
        };

        io.to(roomCode).emit('roundResult', roundResult);

        if (p1.health <= 0 || p2.health <= 0 || match.currentRound >= match.maxRounds) {
            setTimeout(() => finishMultiplayerMatch(roomCode), 3000);
        } else {
            match.currentRound++;
            setTimeout(() => startMultiplayerRound(roomCode), 4000);
        }
        match.evaluating = false;
    } catch (err) {
        console.error(`[Match] Errore valutazione round per ${roomCode}:`, err);
        match.evaluating = false;
    }
}

/**
 * Conclude la partita, calcola EXP/trofei e aggiorna i record sul database.
 */
async function finishMultiplayerMatch(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match) return;

    const p1 = match.players[0];
    const p2 = match.players[1];

    console.log(`[Match] Conclusione partita ${roomCode}, partita_id: ${match.partita_id}`);

    let winnerId = null;
    let risultatoP1 = 'pareggio';
    let risultatoP2 = 'pareggio';

    if (p1.health > p2.health) {
        winnerId = p1.id;
        risultatoP1 = 'vittoria';
        risultatoP2 = 'sconfitta';
    } else if (p2.health > p1.health) {
        winnerId = p2.id;
        risultatoP1 = 'sconfitta';
        risultatoP2 = 'vittoria';
    }

    let expP1 = match.unranked ? 0 : (risultatoP1 === 'vittoria' ? 100 + Math.round(p1.health / 2) : (risultatoP1 === 'sconfitta' ? -10 - Math.round(p2.health / 2) : 20));
    let expP2 = match.unranked ? 0 : (risultatoP2 === 'vittoria' ? 100 + Math.round(p2.health / 2) : (risultatoP2 === 'sconfitta' ? -10 - Math.round(p1.health / 2) : 20));

    let trophyP1 = risultatoP1 === 'vittoria'
        ? Math.floor(Math.random() * 11) + 30 + Math.round(p1.health / 2)
        : (risultatoP1 === 'sconfitta' ? -(Math.floor(Math.random() * 11) + 20) - Math.round(p2.health / 2) : 0);

    let trophyP2 = risultatoP2 === 'vittoria'
        ? Math.floor(Math.random() * 11) + 30 + Math.round(p2.health / 2)
        : (risultatoP2 === 'sconfitta' ? -(Math.floor(Math.random() * 11) + 20) - Math.round(p1.health / 2) : 0);

    try {
        if (match.partita_id) {
            // P1
            const { error: errP1 } = await supabase
                .from('partecipazione')
                .update({ risultato: risultatoP1, exp_guadagnata: expP1, trofei_cambiati: trophyP1 })
                .eq('id_partita', match.partita_id)
                .eq('id_giocatore', p1.id);

            if (errP1) {
                console.warn("[Socket Match] Fallback update partecipazione P1 senza trofei_cambiati:", errP1.message);
                await supabase
                    .from('partecipazione')
                    .update({ risultato: risultatoP1, exp_guadagnata: expP1 })
                    .eq('id_partita', match.partita_id)
                    .eq('id_giocatore', p1.id);
            }

            // P2
            const { error: errP2 } = await supabase
                .from('partecipazione')
                .update({ risultato: risultatoP2, exp_guadagnata: expP2, trofei_cambiati: trophyP2 })
                .eq('id_partita', match.partita_id)
                .eq('id_giocatore', p2.id);

            if (errP2) {
                console.warn("[Socket Match] Fallback update partecipazione P2 senza trofei_cambiati:", errP2.message);
                await supabase
                    .from('partecipazione')
                    .update({ risultato: risultatoP2, exp_guadagnata: expP2 })
                    .eq('id_partita', match.partita_id)
                    .eq('id_giocatore', p2.id);
            }

            await supabase
                .from('partita')
                .update({ stato: 'terminata', data_fine: new Date().toISOString() })
                .eq('id_partita', match.partita_id);

            if (!match.unranked) {
                // Ranked Match: Aggiorna EXP, Livello e Trofei
                await updatePlayerStats(p1.id, risultatoP1, expP1, trophyP1);
                await updatePlayerStats(p2.id, risultatoP2, expP2, trophyP2);
            } else {
                // Friendly Match: Aggiorna EXP e Livello, ma lascia invariati i Trofei (0 variazione)
                await updatePlayerStats(p1.id, risultatoP1, expP1, 0);
                await updatePlayerStats(p2.id, risultatoP2, expP2, 0);
            }
        }
    } catch (e) {
        console.error(`[socket.js]: Errore salvataggio risultati su DB:`, e.message || e);
    }

    io.to(roomCode).emit('matchFinished', {
        winner: winnerId,
        players: match.players,
        unranked: match.unranked,
        rewards: {
            [p1.id]: { exp: expP1, trophies: match.unranked ? 0 : trophyP1 },
            [p2.id]: { exp: expP2, trophies: match.unranked ? 0 : trophyP2 }
        }
    });

    activeMatches.delete(roomCode);
    
    const suspended = disconnectedMatches.get(roomCode);
    if (suspended?.suspensionTimeout) clearTimeout(suspended.suspensionTimeout);
    disconnectedMatches.delete(roomCode);
    
    console.log(`[socket.js] Partita ${roomCode} rimossa dalla memoria.`);
}

module.exports = function(socketIoInstance) {
    io = socketIoInstance;

    // Middleware di autenticazione basato sul token JWT di Supabase
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Token mancante'));

            const cleanToken = token.replace(/['"]/g, '');
            const { data: authData, error } = await supabase.auth.getUser(cleanToken);

            if (error || !authData.user) return next(new Error('Token non valido'));

            socket.userId = authData.user.id;

            const { data: profile } = await supabase
                .from('giocatore')
                .select('nickname, avatar_url, livello, trophies')
                .eq('id_giocatore', socket.userId)
                .single();

            socket.nickname = profile?.nickname || 'Sconosciuto';
            socket.avatar_url = profile?.avatar_url || null;
            socket.livello = profile?.livello || 1;
            socket.trophies = profile?.trophies || 0;
            next();
        } catch (err) {
            next(new Error('[socket.js]: Errore di autenticazione socket'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[socket.js] Connesso: ${socket.nickname} (${socket.userId})`);
        io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });

        // Gestione rientro automatico in partita attiva
        for (const [roomCode, match] of activeMatches.entries()) {
            if (match.players.some(p => p.id === socket.userId)) {
                const suspended = disconnectedMatches.get(roomCode);
                if (suspended) {
                    suspended.disconnectedUserIds = suspended.disconnectedUserIds.filter(id => id !== socket.userId);
                    if (suspended.disconnectedUserIds.length === 0) {
                        clearTimeout(suspended.suspensionTimeout);
                        disconnectedMatches.delete(roomCode);
                    }
                }

                socket.join(roomCode);
                io.to(roomCode).emit('opponentRejoined', { playerName: socket.nickname, roomCode });
                
                // Forza il reindirizzamento nel frontend inviando l'evento della partita attiva
                socket.emit('activeMatchFound', { roomCode });
                console.log(`[socket.js] Rilevata partita attiva per ${socket.nickname} in ${roomCode}. Redirect inviato.`);
                break;
            }
        }

        // Matchmaking casuale ranked
        socket.on('startMatchmaking', async () => {
            console.log(`[socket.js] ${socket.nickname} in coda.`);

            if (matchmakingQueue.find(s => s.userId === socket.userId)) return;

            if (matchmakingQueue.length > 0) {
                const opponent = matchmakingQueue.shift();
                const roomCode = `MATCH_${Math.random().toString(36).substring(2, 9)}`;

                try {
                    const idPartita = await createDbMatch(socket.userId, opponent.userId);

                    socket.join(roomCode);
                    opponent.join(roomCode);

                    const matchData = {
                        roomCode,
                        partita_id: idPartita,
                        players: [
                            { id: socket.userId, nickname: socket.nickname, avatar_url: socket.avatar_url, livello: socket.livello, trophies: socket.trophies },
                            { id: opponent.userId, nickname: opponent.nickname, avatar_url: opponent.avatar_url, livello: opponent.livello, trophies: opponent.trophies }
                        ],
                        unranked: false,
                        answers: {},
                        started: false
                    };

                    activeMatches.set(roomCode, matchData);
                    io.to(roomCode).emit('matchFound', { ...matchData, partita_id: idPartita });
                    console.log(`[socket.js] Partita ${idPartita} avviata: ${socket.nickname} vs ${opponent.nickname}`);
                } catch (err) {
                    console.error("[socket.js] Errore creazione partita:", err.message);
                    socket.emit('error', { message: 'Errore nella creazione della partita.' });
                    opponent.emit('error', { message: 'Errore nella creazione della partita.' });
                }
            } else {
                matchmakingQueue.push(socket);
            }
        });

        socket.on('cancelMatchmaking', () => {
            const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (idx !== -1) {
                matchmakingQueue.splice(idx, 1);
                console.log(`[socket.js] ${socket.nickname} uscito dalla coda.`);
            }
        });

        // Creazione stanza privata tramite codice
        socket.on('createPrivateRoom', () => {
            const code = Math.floor(10000 + Math.random() * 90000).toString();
            privateRooms.set(code, {
                host: { id: socket.userId, nickname: socket.nickname },
                giocatori: [{
                    id: socket.userId,
                    nickname: socket.nickname,
                    socketId: socket.id,
                    avatar_url: socket.avatar_url,
                    livello: socket.livello,
                    trophies: socket.trophies
                }],
                unranked: true // Le stanze private con codice condiviso sono amichevoli
            });

            socket.join(`ROOM_${code}`);
            socket.emit('roomCreated', { code });
            console.log(`[socket.js] Stanza privata ${code} creata da ${socket.nickname}`);
        });

        // Ingresso in stanza privata tramite codice
        socket.on('joinPrivateRoom', async (code) => {
            const room = privateRooms.get(code);
            if (!room) return socket.emit('error', { message: 'Stanza non valida' });
            if (room.giocatori.length >= 2) return socket.emit('error', { message: 'Stanza piena' });

            room.giocatori.push({
                id: socket.userId,
                nickname: socket.nickname,
                socketId: socket.id,
                avatar_url: socket.avatar_url,
                livello: socket.livello,
                trophies: socket.trophies
            });
            socket.join(`ROOM_${code}`);

            // Crea la partita nel DB per consentire persistenza cronologia ed EXP
            let idPartita = null;
            try {
                idPartita = await createDbMatch(room.host.id, socket.userId, 'amichevole');
            } catch (err) {
                console.error("[socket.js] Errore creazione sessione DB per stanza privata:", err.message);
            }

            const matchData = {
                roomCode: `ROOM_${code}`,
                partita_id: idPartita,
                players: room.giocatori.map(g => ({
                    id: g.id,
                    nickname: g.nickname,
                    avatar_url: g.avatar_url,
                    livello: g.livello,
                    trophies: g.trophies
                })),
                unranked: room.unranked,
                answers: {},
                started: false
            };

            activeMatches.set(matchData.roomCode, matchData);
            io.to(`ROOM_${code}`).emit('matchFound', { ...matchData, partita_id: idPartita });

            privateRooms.delete(code);
            console.log(`[socket.js] Giocatore ${socket.nickname} entrato in stanza ${code}. Partita creata con ID ${idPartita}.`);
        });

        // Sincronizzazione ingresso nella schermata match
        socket.on('joinRoom', (code) => {
            const match = activeMatches.get(code);
            if (match) {
                socket.join(code);

                const player = match.players.find(p => p.id === socket.userId);
                if (player) {
                    player.socketId = socket.id;
                    player.ready = true;
                    if (!match.started) {
                        player.health = 100;
                    }
                }

                // Sanitizziamo l'oggetto match per escludere riferimenti non serializzabili (come il timer del round)
                const sanitizedMatch = {
                    roomCode: match.roomCode,
                    partita_id: match.partita_id,
                    players: match.players,
                    unranked: match.unranked,
                    started: match.started,
                    currentRound: match.currentRound,
                    maxRounds: match.maxRounds
                };
                socket.emit('matchInfo', sanitizedMatch);

                // Se la partita è già iniziata, inviamo lo snippet corrente al giocatore per farlo rientrare subito!
                if (match.started && match.currentSnippet) {
                    socket.emit('startRound', {
                        round: match.currentRound,
                        totalRounds: match.maxRounds,
                        snippet: match.currentSnippet
                    });
                }

                const allReady = match.players.every(p => p.ready);
                if (allReady && !match.started) {
                    match.started = true;
                    match.currentRound = 1;
                    match.maxRounds = 5;
                    startMultiplayerRound(code);
                }
            } else {
                socket.emit('error', { message: 'Partita non trovata o conclusa.' });
            }
        });

        // Invio della risposta per il round
        socket.on('submitMultiplayerAnswer', async (data) => {
            const { roomCode, answer } = data;
            const match = activeMatches.get(roomCode);
            if (!match || !match.started || match.evaluating) return;

            match.answers[socket.userId] = answer;

            const suspended = disconnectedMatches.get(roomCode);
            if (suspended?.disconnectedUserIds && suspended.disconnectedUserIds.length > 0) {
                for (const disconnectedId of suspended.disconnectedUserIds) {
                    if (!match.answers[disconnectedId]) match.answers[disconnectedId] = "";
                }
            }

            if (Object.keys(match.answers).length === 2) {
                evaluateMultiplayerRound(roomCode);
            }
        });

        // Invito a una sfida diretta (unranked)
        socket.on('challengeFriend', (payload) => {
            const friendId = typeof payload === 'string' ? payload : payload?.friendId;

            if (!friendId || friendId === socket.userId) {
                return socket.emit('challengeError', { message: 'ID amico non valido.' });
            }

            const friendSocket = getSocketByUserId(friendId);
            if (!friendSocket) {
                return socket.emit('challengeError', { message: 'Amico non online.' });
            }

            const inviteId = `INV_${Math.random().toString(36).substring(2, 10)}`;
            
            const timeoutId = setTimeout(() => {
                const invite = pendingFriendInvites.get(inviteId);
                if (!invite) return;

                pendingFriendInvites.delete(inviteId);
                const challengerSocket = getSocketByUserId(invite.challengerId);
                const receiverSocket = getSocketByUserId(invite.friendId);

                if (challengerSocket) challengerSocket.emit('challengeExpired', { inviteId });
                if (receiverSocket) receiverSocket.emit('challengeExpired', { inviteId });
            }, 30000);

            pendingFriendInvites.set(inviteId, { challengerId: socket.userId, friendId, timeoutId });

            friendSocket.emit('challengeInvite', {
                inviteId,
                challenger: {
                    id: socket.userId,
                    nickname: socket.nickname,
                    avatar_url: socket.avatar_url,
                    livello: socket.livello,
                    trophies: socket.trophies
                }
            });

            socket.emit('challengeSent', { inviteId, friendId, friendNickname: friendSocket.nickname });
        });

        // Risposta all'invito di sfida amichevole
        socket.on('respondChallenge', async ({ inviteId, accepted }) => {
            const invite = pendingFriendInvites.get(inviteId);
            if (!invite) return socket.emit('challengeError', { message: 'Invito scaduto.' });

            if (socket.userId !== invite.friendId) return socket.emit('challengeError', { message: 'Autorizzazione negata.' });

            clearTimeout(invite.timeoutId);
            pendingFriendInvites.delete(inviteId);

            const challengerSocket = getSocketByUserId(invite.challengerId);
            if (!challengerSocket) return socket.emit('challengeError', { message: 'Sfidante disconnesso.' });

            if (!accepted) {
                challengerSocket.emit('challengeDeclined', { inviteId, by: { id: socket.userId, nickname: socket.nickname } });
                socket.emit('challengeRejected', { inviteId });
                return;
            }

            const roomCode = `FRIEND_${Math.random().toString(36).substring(2, 9)}`;

            try {
                const idPartita = await createDbMatch(challengerSocket.userId, socket.userId, 'amichevole');

                challengerSocket.join(roomCode);
                socket.join(roomCode);

                const matchData = {
                    roomCode,
                    partita_id: idPartita,
                    players: [
                        { id: challengerSocket.userId, nickname: challengerSocket.nickname, avatar_url: challengerSocket.avatar_url, livello: challengerSocket.livello, trophies: challengerSocket.trophies },
                        { id: socket.userId, nickname: socket.nickname, avatar_url: socket.avatar_url, livello: socket.livello, trophies: socket.trophies }
                    ],
                    unranked: true,
                    answers: {},
                    started: false
                };

                activeMatches.set(roomCode, matchData);
                io.to(roomCode).emit('matchFound', { ...matchData, partita_id: idPartita });
                console.log(`[Challenge] Sfida ${roomCode} avviata con successo.`);
            } catch (err) {
                console.error("[Challenge] Errore creazione sfida:", err.message);
                socket.emit('challengeError', { message: 'Errore nella creazione della partita.' });
                challengerSocket.emit('challengeError', { message: 'Errore nella creazione della partita.' });
            }
        });

        // Gestione manuale della riconnessione
        socket.on('rejoinMatch', async ({ roomCode }) => {
            const match = activeMatches.get(roomCode);
            const suspended = disconnectedMatches.get(roomCode);

            if (!match || !suspended) {
                return socket.emit('rejoinFailed', { message: 'Partita scaduta o non trovata.' });
            }

            if (!suspended.disconnectedUserIds?.includes(socket.userId)) {
                return socket.emit('rejoinFailed', { message: 'Accesso non consentito.' });
            }

            suspended.disconnectedUserIds = suspended.disconnectedUserIds.filter(id => id !== socket.userId);
            
            if (suspended.disconnectedUserIds.length === 0) {
                clearTimeout(suspended.suspensionTimeout);
                disconnectedMatches.delete(roomCode);
            }

            socket.join(roomCode);

            io.to(roomCode).emit('opponentRejoined', { playerName: socket.nickname, roomCode });

            socket.emit('rejoinSuccess', {
                match: {
                    players: match.players,
                    currentRound: match.currentRound,
                    currentSnippet: match.currentSnippet
                }
            });
        });

        // Disconnessione temporanea o definitiva
        socket.on('disconnect', () => {
            const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (idx !== -1) matchmakingQueue.splice(idx, 1);

            for (const [inviteId, invite] of pendingFriendInvites.entries()) {
                if (invite.challengerId === socket.userId || invite.friendId === socket.userId) {
                    clearTimeout(invite.timeoutId);
                    pendingFriendInvites.delete(inviteId);

                    const otherUserId = invite.challengerId === socket.userId ? invite.friendId : invite.challengerId;
                    const otherSocket = getSocketByUserId(otherUserId);
                    if (otherSocket) otherSocket.emit('challengeExpired', { inviteId });
                }
            }

            for (const [code, room] of privateRooms.entries()) {
                if (room.host.id === socket.userId) {
                    privateRooms.delete(code);
                }
            }

            io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });
            console.log(`[socket.js] Disconnesso: ${socket.nickname}`);

            for (const [roomCode, match] of activeMatches.entries()) {
                if (match.players.some(p => p.id === socket.userId)) {
                    if (!match.started) continue;

                    console.log(`[Match] Giocatore ${socket.nickname} offline. Avvio timer sospensione (120s).`);

                    const existingSuspension = disconnectedMatches.get(roomCode);
                    if (existingSuspension?.suspensionTimeout) {
                        existingSuspension.disconnectedUserIds.push(socket.userId);
                    } else {
                        const suspensionTimeout = setTimeout(() => {
                            console.log(`[Match] Sospensione scaduta per ${roomCode}. Vittoria per abbandono.`);
                            const matchToAbandon = activeMatches.get(roomCode);
                            if (matchToAbandon) {
                                matchToAbandon.players.forEach(p => {
                                    if (p.id === socket.userId) p.health = 0;
                                });
                                finishMultiplayerMatch(roomCode);
                            }
                            disconnectedMatches.delete(roomCode);
                        }, 120000);

                        disconnectedMatches.set(roomCode, {
                            partita_id: match.partita_id,
                            disconnectTime: Date.now(),
                            suspensionTimeout,
                            disconnectedUserIds: [socket.userId]
                        });
                    }

                    const otherPlayerId = match.players.find(p => p.id !== socket.userId)?.id;
                    const otherSocket = getSocketByUserId(otherPlayerId);
                    if (otherSocket) {
                        otherSocket.emit('opponentDisconnected', {
                            roomCode,
                            playerName: socket.nickname,
                            resumeTime: 120000
                        });
                    }
                }
            }
        });
    });
};