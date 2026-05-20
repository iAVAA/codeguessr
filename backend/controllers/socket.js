/*
    FILE: socket.js
    DESCRIPTION: Gestore real-time delle sessioni multiplayer competitive e private
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

const { supabase, updatePlayerStats } = require('../server');
const { evaluateAnswer, getRoundSnippet, buildFallbackSnippet } = require('./code');

const matchmakingQueue     = [];
const privateRooms         = new Map();
const activeMatches        = new Map();
const pendingFriendInvites = new Map();

// Tutto il file lavora su queste strutture in memoria.
// Non c'è un database dei match in tempo reale: la partita vive qui finché esiste la connessione.

let io = null;

// `io` viene creato in server.js e passato qui con `initSockets(io)`.
// Questo file non crea Socket.IO: si limita a registrare i suoi eventi.

// Cerca il socket live di un utente dato il suo UUID.
// Serve per sapere se il giocatore è ancora online e per spedire eventi mirati.
function getSocketByUserId(userId) {
    for (const s of io.sockets.sockets.values()) {
        if (s.userId === userId) return s;
    }
    return null;
}

// Come sopra, ma restituisce tutti i socket attivi dello stesso utente.
// Utile quando un player ha più connessioni aperte o sta cambiando pagina.
function getSocketsByUserId(userId) {
    if (!io) return [];
    const result = [];
    for (const s of io.sockets.sockets.values()) {
        if (s.userId === userId) result.push(s);
    }
    return result;
}

// Riduce il socket ai soli dati pubblici da mostrare al frontend.
// Evita di spargere oggetti Socket.IO interi dentro lo stato match.
function playerInfo(s) {
    return { id: s.userId, nickname: s.nickname, avatar_url: s.avatar_url, livello: s.livello, trophies: s.trophies };
}

// Crea la partita nel DB e inserisce le due righe di partecipazione.
// Questa funzione viene usata sia per matchmaking sia per sfide dirette.
async function createDbMatch(idCasa, idTrasferta, modalita = 'multiplayer') {
    const { data: partita, error } = await supabase
        .from('partita')
        .insert([{ modalita, stato: 'in_corso', data_inizio: new Date().toISOString(), id_utente_casa: idCasa, id_utente_trasferta: idTrasferta }])
        .select().single();
    if (error) throw error;

    const { error: errParc } = await supabase.from('partecipazione').insert([
        { id_partita: partita.id_partita, id_giocatore: idCasa,      risultato: null, exp_guadagnata: 0 },
        { id_partita: partita.id_partita, id_giocatore: idTrasferta, risultato: null, exp_guadagnata: 0 },
    ]);
    if (errParc) throw errParc;
    return partita.id_partita;
}

// Aggiorna una partecipazione finale con risultato, EXP e trofei.
// C'è un fallback perché lo schema del DB potrebbe non avere trofei_cambiati.
async function updatePartecipazione(partitaId, playerId, risultato, exp, trophy) {
    const { error } = await supabase.from('partecipazione')
        .update({ risultato, exp_guadagnata: exp, trofei_cambiati: trophy })
        .eq('id_partita', partitaId).eq('id_giocatore', playerId);
    if (error) {
        console.warn(`[Match] Fallback senza trofei_cambiati per ${playerId}:`, error.message);
        await supabase.from('partecipazione')
            .update({ risultato, exp_guadagnata: exp })
            .eq('id_partita', partitaId).eq('id_giocatore', playerId);
    }
}

// Prepara e avvia un round:
// 1) carica lo snippet
// 2) lo salva nel match
// 3) lo emette a entrambi i client
// 4) avvia il timer del round
async function startMultiplayerRound(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match) return;

    console.log(`[Match] Round ${match.currentRound}/${match.maxRounds} — ${roomCode}`);
    let snippet;
    try {
        snippet = await getRoundSnippet(match.lastSnippetCode || null);
    } catch (err) {
        console.error(`[Match] Fallback snippet per ${roomCode}:`, err.message);
        snippet = buildFallbackSnippet(match.lastSnippetCode || null);
    }

    match.currentSnippet  = snippet;
    match.lastSnippetCode = snippet.code;
    match.answers         = {};
    io.to(roomCode).emit('startRound', { round: match.currentRound, totalRounds: match.maxRounds, snippet });

    if (match.timer) clearTimeout(match.timer);
    match.timer = setTimeout(() => {
        if (activeMatches.has(roomCode)) evaluateMultiplayerRound(roomCode);
    }, 90000);
}

// Valuta le risposte dei due giocatori e applica i danni.
// Se la partita finisce o arriviamo al numero massimo di round, chiude il match.
async function evaluateMultiplayerRound(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match || match.evaluating) return;
    match.evaluating = true;
    if (match.timer) { clearTimeout(match.timer); match.timer = null; }

    const [p1, p2] = match.players;
    try {
        const [ev1, ev2] = await Promise.all([
            evaluateAnswer(match.currentSnippet.code, match.answers[p1.id] || ''),
            evaluateAnswer(match.currentSnippet.code, match.answers[p2.id] || ''),
        ]);

        const diff = ev1.score - ev2.score;
        if      (diff > 0) p2.health = Math.max(0, p2.health - Math.abs(diff));
        else if (diff < 0) p1.health = Math.max(0, p1.health - Math.abs(diff));

        io.to(roomCode).emit('roundResult', {
            scores:      { [p1.id]: ev1.score,      [p2.id]: ev2.score      },
            evaluations: { [p1.id]: ev1.evaluation, [p2.id]: ev2.evaluation },
            healths:     { [p1.id]: p1.health,      [p2.id]: p2.health      },
            damage:      Math.abs(diff),
            winnerId:    diff > 0 ? p1.id : (diff < 0 ? p2.id : null),
        });

        if (p1.health <= 0 || p2.health <= 0 || match.currentRound >= match.maxRounds) {
            setTimeout(() => finishMultiplayerMatch(roomCode), 2500);
        } else {
            match.currentRound++;
            setTimeout(() => startMultiplayerRound(roomCode), 2500);
        }
    } catch (err) {
        console.error(`[Match] Errore valutazione round ${roomCode}:`, err);
    } finally {
        match.evaluating = false;
    }
}

// Conclude la partita e scrive i risultati finali nel DB.
// Qui si decide chi ha vinto davvero in base agli HP residui.
async function finishMultiplayerMatch(roomCode) {
    const match = activeMatches.get(roomCode);
    if (!match || match.closing) return;
    match.closing = true;

    const [p1, p2] = match.players;
    let winnerId = null, esitoP1 = 'pareggio', esitoP2 = 'pareggio';
    if      (p1.health > p2.health) { winnerId = p1.id; esitoP1 = 'vittoria';  esitoP2 = 'sconfitta'; }
    else if (p2.health > p1.health) { winnerId = p2.id; esitoP1 = 'sconfitta'; esitoP2 = 'vittoria';  }

    const rand = () => Math.floor(Math.random() * 11);
    const expFor    = (esito, hp, oppHp) => esito === 'vittoria' ? 100 + Math.round(hp / 2) : esito === 'sconfitta' ? -10 - Math.round(oppHp / 2) : 20;
    const trophyFor = (esito, hp, oppHp) => esito === 'vittoria' ? rand() + 30 + Math.round(hp / 2)  : esito === 'sconfitta' ? -(rand() + 20) - Math.round(oppHp / 2) : 0;

    const expP1    = match.unranked ? 0 : expFor(esitoP1, p1.health, p2.health);
    const expP2    = match.unranked ? 0 : expFor(esitoP2, p2.health, p1.health);
    const trophyP1 = match.unranked ? 0 : trophyFor(esitoP1, p1.health, p2.health);
    const trophyP2 = match.unranked ? 0 : trophyFor(esitoP2, p2.health, p1.health);

    try {
        if (match.partita_id) {
            await Promise.all([
                updatePartecipazione(match.partita_id, p1.id, esitoP1, expP1, trophyP1),
                updatePartecipazione(match.partita_id, p2.id, esitoP2, expP2, trophyP2),
            ]);
            await supabase.from('partita').update({ stato: 'terminata', data_fine: new Date().toISOString() }).eq('id_partita', match.partita_id);
            await Promise.all([
                updatePlayerStats(p1.id, esitoP1, expP1, trophyP1),
                updatePlayerStats(p2.id, esitoP2, expP2, trophyP2),
            ]);
        }
    } catch (e) {
        console.error(`[Match] Errore salvataggio DB ${roomCode}:`, e.message || e);
    }

    io.to(roomCode).emit('matchFinished', {
        winner: winnerId, players: match.players, unranked: match.unranked,
        rewards: {
            [p1.id]: { exp: expP1, trophies: trophyP1 },
            [p2.id]: { exp: expP2, trophies: trophyP2 },
        },
    });
    activeMatches.delete(roomCode);
    console.log(`[Match] Partita ${roomCode} conclusa.`);
}

module.exports = function(socketIoInstance) {
    // Salviamo l'istanza del server Socket.IO per usarla in tutti gli handler.
    io = socketIoInstance;

    // Middleware Socket.IO: gira una sola volta, prima di accettare la connessione.
    // Qui controlliamo il token e costruiamo i dati pubblici del player.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Token mancante'));

            const { data: authData, error } = await supabase.auth.getUser(token.replace(/['\"]/g, ''));
            if (error || !authData.user) return next(new Error('Token non valido'));

            socket.userId = authData.user.id;
            const { data: p } = await supabase.from('giocatore').select('nickname, avatar_url, livello, trophies').eq('id_giocatore', socket.userId).single();
            socket.nickname   = p?.nickname   || 'Sconosciuto';
            socket.avatar_url = p?.avatar_url || null;
            socket.livello    = p?.livello    || 1;
            socket.trophies   = p?.trophies   || 0;
            next();
        } catch {
            next(new Error('Errore di autenticazione socket'));
        }
    });

    // Da qui in poi entriamo per ogni socket client che si connette davvero.
    io.on('connection', (socket) => {
        console.log(`[socket.js] Connesso: ${socket.nickname}`);
        io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });

        // Avvia il matchmaking casuale: se c'è già qualcuno in coda, crea subito il match.
        socket.on('startMatchmaking', async () => {
            if (matchmakingQueue.find(s => s.userId === socket.userId)) return;
            if (matchmakingQueue.length > 0) {
                const opponent = matchmakingQueue.shift();
                const roomCode = `MATCH_${Math.random().toString(36).substring(2, 9)}`;
                try {
                    const partitaId = await createDbMatch(socket.userId, opponent.userId);
                    const matchData = { roomCode, partita_id: partitaId, players: [playerInfo(socket), playerInfo(opponent)], unranked: false, answers: {}, started: false };
                    socket.join(roomCode); opponent.join(roomCode);
                    activeMatches.set(roomCode, matchData);
                    io.to(roomCode).emit('matchFound', matchData);
                    console.log(`[Match] ${socket.nickname} vs ${opponent.nickname} → ${roomCode}`);
                } catch (err) {
                    console.error('[Match] Errore matchmaking:', err.message);
                    socket.emit('error', { message: 'Errore nella creazione della partita.' });
                    opponent.emit('error', { message: 'Errore nella creazione della partita.' });
                }
            } else {
                matchmakingQueue.push(socket);
                console.log(`[Match] ${socket.nickname} in coda.`);
            }
        });

        // Permette di uscire dalla coda prima che venga trovato un avversario.
        socket.on('cancelMatchmaking', () => {
            const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (idx !== -1) { matchmakingQueue.splice(idx, 1); console.log(`[Match] ${socket.nickname} uscito dalla coda.`); }
        });

        socket.on('createPrivateRoom', () => {
            const code = Math.floor(10000 + Math.random() * 90000).toString();
        // Crea una stanza privata condivisibile tramite codice.
            privateRooms.set(code, { host: { id: socket.userId, nickname: socket.nickname }, giocatori: [{ ...playerInfo(socket), socketId: socket.id }], unranked: true });
            socket.join(`ROOM_${code}`);
            socket.emit('roomCreated', { code });
            console.log(`[Match] Stanza privata ${code} creata da ${socket.nickname}`);
        });

        // Entra in una stanza privata già esistente e, se siamo in due, crea il match.
        socket.on('joinPrivateRoom', async (code) => {
            const room = privateRooms.get(code);
            if (!room)                    return socket.emit('error', { message: 'Stanza non valida' });
            if (room.giocatori.length >= 2) return socket.emit('error', { message: 'Stanza piena'    });

            room.giocatori.push({ ...playerInfo(socket), socketId: socket.id });
            socket.join(`ROOM_${code}`);

            let partitaId = null;
            try { partitaId = await createDbMatch(room.host.id, socket.userId, 'amichevole'); }
            catch (err) { console.error('[Match] Errore DB stanza privata:', err.message); }

            const roomCode  = `ROOM_${code}`;
            const matchData = { roomCode, partita_id: partitaId, players: room.giocatori.map(({ socketId: _, ...p }) => p), unranked: room.unranked, answers: {}, started: false };
            activeMatches.set(roomCode, matchData);
            io.to(roomCode).emit('matchFound', matchData);
            privateRooms.delete(code);
            console.log(`[Match] ${socket.nickname} in stanza ${code} — ID partita ${partitaId}`);
        });

        // Evento usato quando il frontend è pronto a mostrare la match page.
        // Aggiorna il riferimento del socket dentro il match e, se serve, avvia la partita.
        socket.on('joinRoom', (code) => {
            const match = activeMatches.get(code);
            if (!match) return socket.emit('error', { message: 'Partita non trovata o conclusa.' });

            socket.join(code);
            const player = match.players.find(p => p.id === socket.userId);
            if (player) { player.socketId = socket.id; player.ready = true; if (!match.started) player.health = 100; }

            socket.emit('matchInfo', { roomCode: match.roomCode, partita_id: match.partita_id, players: match.players, unranked: match.unranked, started: match.started, currentRound: match.currentRound, maxRounds: match.maxRounds });

            if (match.started && match.currentSnippet) {
                socket.emit('startRound', { round: match.currentRound, totalRounds: match.maxRounds, snippet: match.currentSnippet });
            }

            if (match.players.every(p => p.ready) && !match.started) {
                match.started = true; match.currentRound = 1; match.maxRounds = 5;
                console.log(`[Match] Avvio ${code}`);
                startMultiplayerRound(code);
            }
        });

        // Salva la risposta corrente del giocatore.
        // Quando entrambi hanno risposto, parte la valutazione del round.
        socket.on('submitMultiplayerAnswer', ({ roomCode, answer }) => {
            const match = activeMatches.get(roomCode);
            if (!match || !match.started || match.evaluating) return;
            match.answers[socket.userId] = answer;
            if (Object.keys(match.answers).length === match.players.length) evaluateMultiplayerRound(roomCode);
        });

        // Invio di una sfida diretta a un amico online.
        socket.on('challengeFriend', (payload) => {
            const friendId = typeof payload === 'string' ? payload : payload?.friendId;
            if (!friendId || friendId === socket.userId) return socket.emit('challengeError', { message: 'ID amico non valido.' });

            const friendSocket = getSocketByUserId(friendId);
            if (!friendSocket) return socket.emit('challengeError', { message: 'Amico non online.' });

            const inviteId  = `INV_${Math.random().toString(36).substring(2, 10)}`;
            const timeoutId = setTimeout(() => {
                if (!pendingFriendInvites.has(inviteId)) return;
                pendingFriendInvites.delete(inviteId);
                getSocketByUserId(friendId)?.emit('challengeExpired', { inviteId });
                socket.emit('challengeExpired', { inviteId });
            }, 30000);

            pendingFriendInvites.set(inviteId, { challengerId: socket.userId, friendId, timeoutId });
            friendSocket.emit('challengeInvite', { inviteId, challenger: playerInfo(socket) });
            socket.emit('challengeSent', { inviteId, friendId, friendNickname: friendSocket.nickname });
        });

        // Risposta alla sfida: se accetta, crea una stanza e avvia il match.
        socket.on('respondChallenge', async ({ inviteId, accepted }) => {
            const invite = pendingFriendInvites.get(inviteId);
            if (!invite) return socket.emit('challengeError', { message: 'Invito scaduto.' });
            if (socket.userId !== invite.friendId) return socket.emit('challengeError', { message: 'Autorizzazione negata.' });

            clearTimeout(invite.timeoutId);
            pendingFriendInvites.delete(inviteId);

            const challenger = getSocketByUserId(invite.challengerId);
            if (!challenger) return socket.emit('challengeError', { message: 'Sfidante disconnesso.' });

            if (!accepted) {
                challenger.emit('challengeDeclined', { inviteId, by: playerInfo(socket) });
                socket.emit('challengeRejected', { inviteId });
                return;
            }

            const roomCode = `FRIEND_${Math.random().toString(36).substring(2, 9)}`;
            try {
                const partitaId = await createDbMatch(challenger.userId, socket.userId, 'amichevole');
                const matchData = { roomCode, partita_id: partitaId, players: [playerInfo(challenger), playerInfo(socket)], unranked: true, answers: {}, started: false };
                challenger.join(roomCode); socket.join(roomCode);
                activeMatches.set(roomCode, matchData);
                io.to(roomCode).emit('matchFound', matchData);
                console.log(`[Match] Sfida ${roomCode} avviata.`);
            } catch (err) {
                console.error('[Match] Errore creazione sfida:', err.message);
                socket.emit('challengeError',   { message: 'Errore nella creazione della partita.' });
                challenger.emit('challengeError', { message: 'Errore nella creazione della partita.' });
            }
        });

        // Pulizia finale quando il socket si chiude.
        // Qui distinguiamo tra disconnect reale, refresh, cambio pagina e forfeit.
        socket.on('disconnect', () => {
            console.log(`[socket.js] Disconnesso: ${socket.nickname}`);

            // Coda matchmaking
            const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
            if (idx !== -1) matchmakingQueue.splice(idx, 1);

            // Inviti in sospeso
            for (const [inviteId, invite] of pendingFriendInvites.entries()) {
                if (invite.challengerId !== socket.userId && invite.friendId !== socket.userId) continue;
                clearTimeout(invite.timeoutId);
                pendingFriendInvites.delete(inviteId);
                const otherId = invite.challengerId === socket.userId ? invite.friendId : invite.challengerId;
                getSocketByUserId(otherId)?.emit('challengeExpired', { inviteId });
            }

            // Stanze private
            for (const [code, room] of privateRooms.entries()) {
                if (room.host.id === socket.userId) privateRooms.delete(code);
            }

            io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });

            // Se esiste un altro socket attivo dello stesso utente, questo disconnect
            // è quasi certamente un refresh o un cambio pagina: lo ignoriamo.
            const stillActive = getSocketsByUserId(socket.userId).filter(s => s.id !== socket.id);
            if (stillActive.length > 0) return;

            // Se il player era in una partita già iniziata, il disconnect vale come forfeit.
            // Se la partita non è ancora partita, invece, stiamo solo passando da una pagina all'altra.
            for (const [roomCode, match] of activeMatches.entries()) {
                const player = match.players.find(p => p.id === socket.userId);
                if (!player) continue;
                if (player.socketId && player.socketId !== socket.id) continue; // socket stale
                if (!match.started) continue; // navigazione game_page → match_page
                console.log(`[Match] Forfeit di ${socket.nickname} in ${roomCode}.`);
                player.health = 0;
                finishMultiplayerMatch(roomCode);
                break;
            }
        });
    });
};