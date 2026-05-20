/*
    FILE: server.js
    DESCRIPTION: Server principale, gestisce tutte le chiamate API del sito
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/


require('dotenv').config(); // Carica le variabili d'ambiente dal file .env
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");
const cors = require('cors');
const multer = require('multer'); // Upload file immagini

// ==========================================
// SERVER & SOCKET.IO
// ==========================================
const app = express();
const server = http.createServer(app); // Server HTTP che wrappa Express

// Socket.io aperto
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// ==========================================
// CONFIGURAZIONE AMBIENTE
// ==========================================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Ascolta su tutte le interfacce di rete
const ROOT = path.join(__dirname, '..', 'frontend'); // Cartella root dei file statici
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Mappa in-memory userId -> timestamp dell'ultimo heartbeat ricevuto
const activeUsers = new Map();
const HEARTBEAT_TIMEOUT = 10000; // ms senza heartbeat prima di segnare l'utente come offline

// CORS per le chiamate REST dal frontend (localhost e l'eventuale URL di deployment BASE_URL)
const allowedOrigins = ['http://localhost:3000', `http://localhost:${PORT}`];
if (process.env.BASE_URL) {
    const trimmedBaseUrl = process.env.BASE_URL.replace(/\/$/, '');
    if (!allowedOrigins.includes(trimmedBaseUrl)) {
        allowedOrigins.push(trimmedBaseUrl);
    }
}

app.use(cors({
    origin: allowedOrigins,
    allowedHeaders: ['Authorization', 'Content-Type']
}));

// ==========================================
// INIZIALIZZAZIONE SUPABASE
// ==========================================

// Usa la Service Role Key (accesso admin, bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    }
});
module.exports = { supabase }; // Esportato per essere usato da altri moduli (es. auth.js)


// ==========================================
// AUTENTICAZIONE
// ==========================================

// Middleware Express che verifica il JWT Supabase nell'header Authorization
const verificaToken = require('./middleware/auth');

/**
 * ==========================================
 * DOCUMENTAZIONE SCHEMA DATABASE (SUPABASE)
 * ==========================================
 * * @namespace DatabaseSchema
 */

/**
 * @typedef {Object} Giocatore
    * @description Tabella principale che memorizza i dati pubblici e di progressione degli utenti.
    * @property {string} id_giocatore - (UUID) Primary Key. Collegata direttamente a `auth.users.id` di Supabase.
    * @property {string} nickname - (Text) Nome utente univoco scelto in fase di registrazione.
    * @property {number} exp - (Int4) Punti esperienza totali accumulati dal giocatore.
    * @property {number} livello - (Int4) Livello attuale raggiunto dal giocatore.
    * @property {string} data_registrazione - (Timestamptz) Data e ora in cui l'account è stato creato.
    * @property {boolean} attivo - (Bool) Flag che indica se l'account/giocatore è attivo.
    * @property {string} bio - (Text) Descrizione personale del giocatore.
    * @property {string} avatar_url - (Text) Immagine profilo in formato Base64 o URL esterno.
    * @property {string} banner_url - (Text) Immagine banner profilo in formato Base64 o URL esterno.
    * @property {number} trophies - (Int4) Numero di trofei vinti dal giocatore (usato per la classifica).
 */

/**
 * @typedef {Object} Partita
    * @description Tabella che registra le sessioni di gioco.
    * @property {number} id_partita - (Int8) Primary Key. Identificativo univoco della partita.
    * @property {string} modalita - (Enum: modalita_partita) La modalità di gioco scelta per la sessione.
    * @property {string} stato - (Enum: stato_partita) Lo stato corrente della partita (es. in corso, terminata).
    * @property {string} data_inizio - (Timestamptz) Orario di avvio della partita.
    * @property {string} data_fine - (Timestamptz) Orario di conclusione della partita.
    * @property {string} id_utente_casa
    * @property {string} id_utente_trasferta
 */

/**
 * @typedef {Object} Amicizia
    * @description Tabella per la gestione delle relazioni sociali e richieste di amicizia tra giocatori.
    * @property {string} id_utente_a - (UUID) Composite Primary Key / Foreign Key -> `giocatore.id_giocatore`.
    * @property {string} id_utente_b - (UUID) Composite Primary Key / Foreign Key -> `giocatore.id_giocatore`.
    * @property {string} stato - (Enum: stato_amicizia) Lo stato della relazione (es. in_attesa, accettata, rifiutata).
    * @property {string} data_creazione - (Timestamptz) Data di invio della richiesta di amicizia.
    * 
 */

/**
 * @typedef {Object} Partecipazione
    * @description Tabella di associazione (Junction Table) che collega i giocatori alle partite giocate.
    * @property {number} id_partita - (Int8) Composite Primary Key / Foreign Key -> `partita.id_partita`.
    * @property {string} id_giocatore - (UUID) Composite Primary Key / Foreign Key -> `giocatore.id_giocatore`.
    * @property {string} risultato - (Enum: risultato_partecipazione) L'esito ottenuto dal giocatore in quella partita (es. vittoria, sconfitta).
    * @property {number} exp_guadagnata - (Int4) Punti esperienza specifici ottenuti al termine di questa partita.
 */


// ==========================================
// MIDDLEWARE
// ==========================================
// ORDINE IMPORTANTE: il parsing del body deve avvenire PRIMA del serving statico
app.use(express.json()); // Parsa automaticamente il body JSON delle richieste POST/PUT
app.use(express.static(ROOT)); // Serve i file statici dalla cartella frontend/


// ==========================================
// ROTTE DI NAVIGAZIONE (GET)
// ==========================================
// Pagina principale (index)
app.get('/index', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/index');
});

app.get('/reset_password_completo', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'reset_password_completo.html'));
});

// Pagina di gioco principale
app.get('/home', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'game_page.html'));
});

// Pagina di login
app.get('/login', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'login_page.html'));
});

// Pagina di reset password (raggiunta tramite link email di Supabase)
app.get('/reset_password.html', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'reset_password.html'));
});

// Pagina del profilo utente
app.get('/profilo', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'profile_page.html'));
});

// Pagina della classifica globale
app.get('/classifica', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'leaderboard_page.html'));
});

// Pagina di partita
app.get('/match', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'match_page.html'));
});



app.post('/api/reset_password_completo', verificaToken, async (req, res) => {
    const password = req.body.password;

    try {
        // METODO UFFICIALE SUPABASE:
        // Usa la funzione "admin" per aggiornare la password dell'utente
        // nel sistema di autenticazione di Supabase
        const { data, error } = await supabase.auth.admin.updateUserById(
            req.utenteId, // L'ID dell'utente che hai estratto col tuo middleware
            { password: password }
        );

        if (error) throw error;

        // NOTA: Non serve aggiornare la password nella tabella 'giocatore'.
        // È molto più sicuro lasciare che sia solo Supabase a gestirla!

        res.status(200).json({ messaggio: 'Password aggiornata con successo!' });

    } catch (err) {
        console.error("Errore aggiornamento password:", err);
        // È utile restituire l'errore di Supabase al frontend per capire se la password
        // è troppo corta o non rispetta i requisiti di sicurezza
        res.status(400).json({ messaggio: err.message || 'Errore interno del server.' });
    }
});


// Profilo pubblico di un utente specifico (es. /profilo/mario123)
// Il parametro :username viene ignorato qui — il frontend lo legge dall'URL e chiama /api/profilo/:id
app.get('/profilo/:username', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'profile_page.html'));
});

app.get('/api/profilo/nickname/:username', verificaToken, async (req, res) => {
    const nicknameCercato = req.params.username;

    try {
        const { data: profilo, error } = await supabase
            .from('giocatore')
            .select('id_giocatore') 
            .eq('nickname', nicknameCercato)
            .single(); // Ne aspettiamo solo uno

        if (error || !profilo) {
            return res.status(404).json({ errore: 'Profilo non trovato' });
        }

        // Lo formattiamo per il frontend
        res.status(200).json({
            userid: profilo.id_giocatore,
            user: profilo.nicknameCercato,
        });

    } catch (err) {
        console.error("Errore ricerca profilo:", err);
        res.status(500).json({ errore: 'Errore interno' });
    }
});

// Usiamo DELETE perché stiamo eliminando una riga esistente
app.delete('/api/rifiuta-richiesta/:id', verificaToken, async (req, res) => {
    const mioId = req.utenteId;
    const targetId = req.params.id;

    if (!targetId) {
        return res.status(400).json({ errore: 'ID mancante.' });
    }

    try {
        // Usiamo "or" per dire: "Cancella la riga dove ci siamo noi due, non mi importa chi è A e chi è B"
        const { data, error } = await supabase
            .from('amicizia')
            .delete()
            .or(`and(id_utente_a.eq.${targetId},id_utente_b.eq.${mioId}),and(id_utente_a.eq.${mioId},id_utente_b.eq.${targetId})`)
            .select();

        if (error) throw error;

        if (data.length === 0) {
            return res.status(404).json({ errore: 'Nessuna relazione trovata da eliminare.' });
        }

        res.status(200).json({ messaggio: 'Azione completata con successo.' });

    } catch (err) {
        console.error("Errore eliminazione amicizia:", err);
        res.status(500).json({ errore: 'Errore interno del server.' });
    }
});

// Usiamo PUT perché stiamo aggiornando un dato esistente
app.put('/api/accetta-richiesta/:id', verificaToken, async (req, res) => {

    // Attenzione a chi è chi!
    // 1. Tu (mioId) sei la persona che ACCETTA, quindi nel DB sei "id_utente_b" (il destinatario).
    const mioId = req.utenteId;

    // 2. L'ID nell'URL è la persona che te l'aveva INVIATA, quindi nel DB è "id_utente_a" (il mittente).
    const mittenteId = req.params.id;

    if (!mittenteId) {
        return res.status(400).json({ errore: 'Devi specificare la richiesta di chi vuoi accettare.' });
    }

    try {
        // Chiediamo a Supabase di aggiornare la riga specifica
        const { data, error } = await supabase
            .from('amicizia')
            .update({ stato: 'accettata' }) // Cambiamo lo stato
            .eq('id_utente_a', mittenteId) // Dove il mittente è lui...
            .eq('id_utente_b', mioId) // ...il destinatario sei tu...
            .eq('stato', 'in_attesa') // ...e lo stato attuale è "in_attesa"
            .select(); // Questo comando serve per farci restituire la riga modificata

        if (error) {
            throw error;
        }

        // Se data è vuoto (lunghezza 0), significa che Supabase non ha trovato nessuna 
        // richiesta "in_attesa" tra voi due (forse era già stata accettata o rifiutata)
        if (data.length === 0) {
            return res.status(404).json({ errore: 'Nessuna richiesta in attesa trovata da questo utente.' });
        }

        // Tutto perfetto!
        res.status(200).json({ messaggio: 'Amicizia accettata con successo! Ora siete amici.' });

    } catch (err) {
        console.error("Errore nell'accettare la richiesta:", err);
        res.status(500).json({ errore: 'Errore interno del server.' });
    }
});

// Usiamo POST (perché stiamo scrivendo nel DB) e aggiungiamo la barra prima di :id
// POST /api/invia-richiesta/:id
// invia un richiesta di amicizia all'utente con id specificato nell'URL (targetId)
app.post('/api/invia-richiesta/:id', verificaToken, async (req, res) => {

    const mioId = req.utenteId; // Arriva dal tuo fantastico middleware!
    const targetId = req.params.id; // Lo peschiamo dall'URL

    if (!targetId) {
        return res.status(400).json({ errore: 'Devi specificare a chi inviare la richiesta.' });
    }

    if (mioId === targetId) {
        return res.status(400).json({ errore: 'Non puoi inviare una richiesta a te stesso!' });
    }

    try {
        // Inserimento nel database Supabase
        const { error } = await supabase
            .from('amicizia') // (Assicurati che la tabella si chiami esattamente così)
            .insert([
                {
                    id_utente_a: mioId,
                    id_utente_b: targetId,
                    stato: 'in_attesa'
                }
            ]);

        // codice unicità di supabase è 23505, se viene violata la constraint di unicità (cioè stiamo cercando di inserire una richiesta già esistente)
        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ errore: 'Hai già inviato una richiesta a questo utente.' });
            }
            throw error;
        }

        // Se arriviamo qui, tutto è andato bene!
        res.status(200).json({ messaggio: 'Richiesta di amicizia inviata con successo!' });

    } catch (err) {
        console.error("Errore nell'invio della richiesta:", err);
        res.status(500).json({ errore: 'Errore interno del server.' });
    }
});


app.get('/api/amicizie-confermate/:id', verificaToken, async (req, res) => {

    const targetId = req.params.id; // L'ID del giocatore che stiamo guardando

    try {
        // 1. Chiediamo a Supabase SOLO le relazioni dove lo stato è 'accettata'
        const { data: relazioni, error: relError } = await supabase
            .from('amicizia')
            .select('id_utente_a, id_utente_b')
            .eq('stato', 'accettata') // <-- Filtro direttamente nel database!
            .or(`id_utente_a.eq.${targetId},id_utente_b.eq.${targetId}`);

        if (relError) throw relError;

        // Se non ha amici, restituiamo subito gli array vuoti
        if (!relazioni || relazioni.length === 0) {
            return res.status(200).json({ amici: [], inviate: [], ricevute: [] });
        }

        // 2. Estraiamo la lista degli ID dei suoi amici
        const idAmici = relazioni.map(riga =>
            riga.id_utente_a === targetId ? riga.id_utente_b : riga.id_utente_a
        );

        // 3. Recuperiamo i loro nickname e avatar
        const { data: profili, error: profiliError } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname, avatar_url')
            .in('id_giocatore', idAmici);

        if (profiliError) throw profiliError;

        // 4. Formattiamo i risultati
        const amiciConfermati = profili.map(p => ({
            userid: p.id_giocatore,
            user: p.nickname,
            avatar_url: p.avatar_url
        }));

        // Restituiamo l'oggetto con le richieste in attesa vuote per non far arrabbiare il frontend
        res.status(200).json({
            amici: amiciConfermati,
            inviate: [],
            ricevute: []
        });

    } catch (err) {
        console.error("Errore recupero amicizie confermate:", err.message);
        res.status(500).json({ errore: 'Errore server interno' });
    }
});

// ==========================================
// API HEARTBEAT E AMICI
// ==========================================

/**
 * POST /api/heartbeat
 * Aggiorna lo stato online dell'utente corrente.
 */
app.post('/api/heartbeat', verificaToken, async (req, res) => {
    const mioId = req.utenteId;

    // Se non era già nella mappa (o è scaduto), lo impostiamo come attivo nel database
    if (!activeUsers.has(mioId)) {
        try {
            await supabase.from('giocatore').update({ attivo: true }).eq('id_giocatore', mioId);
        } catch (e) {
            console.error("Impossibile aggiornare stato online nel DB", e);
        }
    }

    activeUsers.set(mioId, Date.now());
    res.status(200).json({ success: true });
});

// Pulizia periodica utenti offline e aggiornamento DB
setInterval(async () => {
    const now = Date.now();
    for (const [userId, lastSeen] of activeUsers.entries()) {
        if (now - lastSeen > HEARTBEAT_TIMEOUT) {
            activeUsers.delete(userId);
            try {
                // Imposta come offline nel DB
                await supabase.from('giocatore').update({ attivo: false }).eq('id_giocatore', userId);
            } catch (e) {
                console.error("Impossibile aggiornare stato offline nel DB", e);
            }
        }
    }
}, 15000);

// ==========================================
// API AMICI (GET)
// ==========================================

/**
 * GET /api/amici/:id
 * Restituisce le relazioni di amicizia dell'utente divise in tre liste:
 * - amici:    relazioni con stato 'accettata'
 * - inviate:  richieste inviate da questo utente (stato 'in_attesa', lui è id_utente_a)
 * - ricevute: richieste ricevute da altri (stato 'in_attesa', lui è id_utente_b)
 *
 * Esempio risposta:
 * {
 *   "amici":    [{ "userid": "...", "user": "nickname" }],
 *   "inviate":  [{ "userid": "...", "user": "nickname" }],
 *   "ricevute": [{ "userid": "...", "user": "nickname" }]
 * }
 */
// La rotta non ha più ":id". Diventa fissa!


app.get('/api/mie-amicizie', verificaToken, async (req, res) => {

    const mioId = req.utenteId; // <- arriva già verificato dal middleware

    try {
        const { data: relazioni, error: relError } = await supabase
            .from('amicizia')
            .select('id_utente_a, id_utente_b, stato')
            .or(`id_utente_a.eq.${mioId},id_utente_b.eq.${mioId}`);

        if (relError) throw relError;

        if (!relazioni || relazioni.length === 0) {
            return res.status(200).json({ amici: [], inviate: [], ricevute: [] });
        }

        const idAltriUtenti = [];
        for (const riga of relazioni) {
            if (riga.id_utente_a === mioId) {
                idAltriUtenti.push(riga.id_utente_b);
            } else {
                idAltriUtenti.push(riga.id_utente_a);
            }
        }

        const { data: profili, error: profiliError } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname, avatar_url')
            .in('id_giocatore', idAltriUtenti);

        if (profiliError) throw profiliError;

        const mappaProfili = {};
        for (const p of profili) {
            mappaProfili[p.id_giocatore] = { nickname: p.nickname, avatar_url: p.avatar_url };
        }

        const risultato = { amici: [], inviate: [], ricevute: [] };

        for (const riga of relazioni) {
            const sonoIoIlMittente = riga.id_utente_a === mioId;
            const idAltro = sonoIoIlMittente ? riga.id_utente_b : riga.id_utente_a;
            const datiAltro = mappaProfili[idAltro] || { nickname: "Utente Sconosciuto", avatar_url: null };

            // Calcola lo stato online
            const lastSeen = activeUsers.get(idAltro);
            const isOnline = lastSeen ? (Date.now() - lastSeen < HEARTBEAT_TIMEOUT) : false;

            const utente = {
                userid: idAltro,
                user: datiAltro.nickname,
                avatar_url: datiAltro.avatar_url,
                online: isOnline
            };

            if (riga.stato === 'accettata') {
                risultato.amici.push(utente);
            } else if (riga.stato === 'in_attesa' && sonoIoIlMittente) {
                risultato.inviate.push(utente);
            } else if (riga.stato === 'in_attesa' && !sonoIoIlMittente) {
                risultato.ricevute.push(utente);
            }
        }

        res.status(200).json(risultato);

    } catch (err) {
        console.error("Errore recupero/smistamento amici:", err.message);
        res.status(500).json({ errore: 'Errore server interno' });
    }
});


// ==========================================
// API PROFILO (GET)
// ==========================================

/**
 * GET /api/profilo/:id
 * Recupera i dati pubblici di un giocatore dato il suo UUID.
 *
 * Uso:
 *   const res = await fetch(`/api/profilo/${idGiocatore}`);
 *   const playerData = await res.json();
 *
 *   playerData.userid -> UUID del giocatore
 *   playerData.user -> nickname
 *   playerData.livello -> livello attuale
 *   playerData.exp -> esperienza accumulata
 */
app.get('/api/profilo/:id', async (req, res) => {
    const idDaCercare = req.params.id;

    try {
        const { data, error } = await supabase
            .from('v_giocatore_profilo')
            .select('nickname, livello, exp, trophies, partite_giocate, partite_vinte, partite_perse, percentuale_vittorie, bio, avatar_url, banner_url, data_registrazione')
            .eq('id_giocatore', idDaCercare)
            .single();

        if (error) throw error;

        res.status(200).json({
            userid: idDaCercare,
            user: data.nickname,
            livello: data.livello,
            exp: data.exp,
            trophies: data.trophies || 0,
            partite_giocate: data.partite_giocate || 0,
            partite_vinte: data.partite_vinte || 0,
            partite_perse: data.partite_perse || 0,
            percentuale_vittorie: data.percentuale_vittorie || 0,
            bio: data.bio || '',
            avatar_url: data.avatar_url || null,
            banner_url: data.banner_url || null,
            data_registrazione: data.data_registrazione || null
        });

    } catch (err) {
        console.error("Errore recupero profilo:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare il profilo', details: err.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await supabase
            .from('v_giocatore_profilo')
            .select('id_giocatore, nickname, livello, exp, trophies, avatar_url', { count: 'exact' })
            .order('trophies', { ascending: false })
            .range(from, to);

        if (error) throw error;

        res.status(200).json({
            players: data,
            total: count,
            page,
            totalPages: Math.min(100, Math.ceil(count / limit))
        });
    } catch (err) {
        console.error("Errore recupero classifica:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare la classifica' });
    }
});


// ==========================================
// API STORICO PARTITE (GET)
// ==========================================

/**
 * GET /api/storico/:id
 * Recupera lo storico delle partite di un giocatore.
 * Risposta: array di partite con modalita, risultato, exp_guadagnata, data.
 */
app.get('/api/storico/:id', async (req, res) => {
    const idGiocatore = req.params.id;

    try {
        // Recupera le partecipazioni con i dati della partita associata
        const { data, error } = await supabase
            .from('partecipazione')
            .select(`
                risultato,
                exp_guadagnata,
                partita (
                    id_partita,
                    modalita,
                    stato,
                    data_inizio,
                    data_fine,
                    id_utente_casa,
                    id_utente_trasferta,
                    casa:giocatore!partita_id_utente_casa_fkey(nickname),
                    trasferta:giocatore!partita_id_utente_trasferta_fkey(nickname)
                )
            `)
            .eq('id_giocatore', idGiocatore)
            .order('id_partita', { ascending: false })
            .limit(20);

        if (error) throw error;

        // Filtriamo solo le partite completate e le formattiamo
        const storico = (data || []).map(p => {
            const partita = p.partita;
            let opponentName = null;

            if (partita && (partita.modalita === 'multiplayer' || partita.modalita === 'amichevole')) {
                if (partita.id_utente_casa === idGiocatore) {
                    opponentName = partita.trasferta?.nickname;
                } else {
                    opponentName = partita.casa?.nickname;
                }
            }

            let trophyChange = p.trofei_cambiati;
            if (trophyChange === undefined || trophyChange === null) {
                // Fallback nel caso la colonna sia null o non esista nel DB (vecchio schema o vecchie righe)
                trophyChange = 0;
                if (partita && (partita.modalita === 'multiplayer' || partita.modalita === 'ranked' || partita.modalita === '1v1')) {
                    if (p.risultato === 'vittoria') {
                        // L'esperienza del vincitore è: exp = 100 + Math.round(health / 2)
                        // Da cui ricaviamo la parte relativa alla vita residua del vincitore:
                        const healthPart = Math.max(0, Math.min(50, (p.exp_guadagnata || 100) - 100));
                        // La formula dei trofei del vincitore è: 30 + rand(0..10) + healthPart (usiamo la media rand = 5)
                        trophyChange = 35 + healthPart;
                    } else if (p.risultato === 'sconfitta') {
                        // L'esperienza del perdente è: exp = -10 - Math.round(oppHealth / 2)
                        // Da cui ricaviamo la parte relativa alla vita residua dell'avversario:
                        const healthPart = Math.max(0, Math.min(50, -10 - (p.exp_guadagnata || -10)));
                        // La formula dei trofei del perdente è: -20 - rand(0..10) - healthPart (usiamo la media rand = 5)
                        trophyChange = -25 - healthPart;
                    }
                }
            }

            return {
                id_partita: partita?.id_partita,
                modalita: partita?.modalita || 'singleplayer',
                opponent: opponentName,
                risultato: p.risultato || 'sconfitta',
                exp_guadagnata: p.exp_guadagnata || 0,
                trofei_cambiati: trophyChange,
                data_inizio: partita?.data_inizio || null,
                data_fine: partita?.data_fine || null
            };
        });

        res.status(200).json(storico);

    } catch (err) {
        console.error("Errore recupero storico:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare lo storico' });
    }
});

// ==========================================
// API STATISTICHE (GET)
// ==========================================

/**
 * GET /api/statistiche/:id
 * Calcola le statistiche aggregate di un giocatore.
 * Risposta: { played, won, lost, win_rate }
 */
app.get('/api/statistiche/:id', async (req, res) => {
    const idGiocatore = req.params.id;

    try {
        const { data, error } = await supabase
            .from('v_giocatore_profilo')
            .select('partite_giocate, partite_vinte, partite_perse, percentuale_vittorie')
            .eq('id_giocatore', idGiocatore)
            .single();

        if (error) throw error;

        // Formattiamo per mantenere compatibilità con il frontend attuale
        res.status(200).json({
            played: data.partite_giocate || 0,
            won: data.partite_vinte || 0,
            lost: data.partite_perse || 0,
            win_rate: data.percentuale_vittorie || 0,
        });

    } catch (err) {
        console.error("Errore calcolo statistiche:", err.message);
        res.status(500).json({ errore: 'Impossibile calcolare le statistiche' });
    }
});

// ==========================================
// API AGGIORNAMENTO PROFILO (PUT)
// ==========================================

/**
 * PUT /api/profilo
 * Aggiorna i dati del profilo dell'utente autenticato.
 * Body: { nickname?, bio?, avatar_url?, banner_url? }
 * Richiede autenticazione (Bearer token).
 */
app.put('/api/profilo', verificaToken, async (req, res) => {
    const mioId = req.utenteId;
    const { nickname, bio, avatar_url, banner_url } = req.body;

    // Costruiamo l'oggetto di aggiornamento con solo i campi forniti
    const aggiornamenti = {};
    if (nickname !== undefined) aggiornamenti.nickname = nickname.trim();
    if (bio !== undefined) aggiornamenti.bio = bio.trim();
    if (avatar_url !== undefined) aggiornamenti.avatar_url = avatar_url;
    if (banner_url !== undefined) aggiornamenti.banner_url = banner_url;

    if (Object.keys(aggiornamenti).length === 0) {
        return res.status(400).json({ errore: 'Nessun campo da aggiornare fornito.' });
    }

    try {
        const { data, error } = await supabase
            .from('giocatore')
            .update(aggiornamenti)
            .eq('id_giocatore', mioId)
            .select();

        if (error) {
            // Nickname già in uso (violazione unicità)
            if (error.code === '23505') {
                return res.status(400).json({ errore: 'Questo nickname è già in uso.' });
            }
            throw error;
        }

        res.status(200).json({ messaggio: 'Profilo aggiornato con successo!', data: data[0] });

    } catch (err) {
        console.error("Errore aggiornamento profilo:", err.message);
        res.status(500).json({ errore: 'Impossibile aggiornare il profilo.' });
    }
});

// ==========================================
// API ELIMINAZIONE PROFILO (DELETE)
// ==========================================

/**
 * DELETE /api/profilo
 * Elimina definitivamente l'account dell'utente loggato.
 * Richiede autenticazione (Bearer token).
 */
app.delete('/api/profilo', verificaToken, async (req, res) => {
    const mioId = req.utenteId;

    try {
        // Elimina l'utente tramite Supabase Admin API
        // Questo attiverà la cancellazione a cascata sul db grazie a ON DELETE CASCADE
        const { error } = await supabase.auth.admin.deleteUser(mioId);

        if (error) throw error;

        res.status(200).json({ messaggio: 'Profilo eliminato con successo.' });

    } catch (err) {
        console.error("Errore eliminazione profilo:", err.message);
        res.status(500).json({ errore: 'Impossibile eliminare il profilo.' });
    }
});



// ==========================================
// API SALVA PARTITA (POST)
// ==========================================

/**
 * POST /api/salva-partita
 * Salva il risultato di una partita nel DB e aggiorna l'EXP del giocatore.
 * Body: { modalita, risultato, exp_guadagnata }
 * Richiede autenticazione (Bearer token).
 */
// ==========================================
// HELPER: SALVATAGGIO PARTITA
// ==========================================

/**
 * Crea una partita completa nel DB (tabelle `partita` + `partecipazione`) e
 * aggiorna le statistiche dei giocatori coinvolti.
 *
 * Usata principalmente per le partite singleplayer salvate via API REST.
 * Le partite multiplayer usano invece il flusso Socket.io (startMatchmaking / acceptChallenge).
 *
 * @param {string}  mioId               - UUID del giocatore "casa"
 * @param {string}  modalita            - 'singleplayer' | 'multiplayer'
 * @param {string}  risultato           - 'vittoria' | 'sconfitta' | 'pareggio'
 * @param {number}  exp_guadagnata      - EXP da assegnare al giocatore casa
 * @param {string}  [id_utente_trasferta] - UUID avversario (solo multiplayer)
 * @param {string}  [risultato_avv]     - Risultato avversario (default: inverso)
 * @param {number}  [exp_avv]           - EXP avversario (default: calcolato)
 * @param {number}  [trophy_casa]       - Variazione trofei giocatore casa
 * @param {number}  [trophy_trasferta]  - Variazione trofei avversario
 */
async function saveMatchToDB(mioId, modalita, risultato, exp_guadagnata, id_utente_trasferta = null, risultato_avv = null, exp_avv = null, trophy_casa = 0, trophy_trasferta = 0) {
    try {
        const isMultiplayer = modalita === 'multiplayer' && id_utente_trasferta;

        // 1. Inserisce la riga nella tabella `partita`
        const { data: partitaData, error: partitaError } = await supabase
            .from('partita')
            .insert([{
                modalita,
                stato: 'terminata',
                data_fine: new Date().toISOString(),
                id_utente_casa: mioId,
                id_utente_trasferta: id_utente_trasferta
            }])
            .select()
            .single();

        if (partitaError) throw partitaError;
        const idPartita = partitaData.id_partita;

        // 2. Costruisce le partecipazioni (sempre il giocatore casa, + l'avversario se multiplayer)
        const partecipazioni = [{
            id_partita: idPartita,
            id_giocatore: mioId,
            risultato: risultato,
            exp_guadagnata: exp_guadagnata
        }];

        if (isMultiplayer) {
            // Se il risultato avversario non è fornito, lo si deduce per opposizione
            const risultatoAvv = risultato_avv !== null ? risultato_avv : (risultato === 'vittoria' ? 'sconfitta' : 'vittoria');
            const expAvv = exp_avv !== null ? exp_avv : (risultatoAvv === 'vittoria' ? 100 : -10);
            partecipazioni.push({
                id_partita: idPartita,
                id_giocatore: id_utente_trasferta,
                risultato: risultatoAvv,
                exp_guadagnata: expAvv
            });
        }

        try {
            // Tenta l'inserimento includendo trofei_cambiati
            const partecipazioniWithTrophies = partecipazioni.map((p, idx) => ({
                ...p,
                trofei_cambiati: idx === 0 ? trophy_casa : trophy_trasferta
            }));
            const { error: insertErr } = await supabase.from('partecipazione').insert(partecipazioniWithTrophies);
            if (insertErr) {
                // Fallback a inserimento senza trofei_cambiati
                console.warn("[server.js] Fallback a inserimento partecipazione senza trofei_cambiati:", insertErr.message);
                await supabase.from('partecipazione').insert(partecipazioni);
            }
        } catch (e) {
            console.warn("[server.js] Eccezione durante inserimento, fallback a schema base:", e.message);
            await supabase.from('partecipazione').insert(partecipazioni);
        }

        // 3. Aggiorna EXP, livello e trofei dei giocatori coinvolti
        const statsCasa = await updatePlayerStats(mioId, risultato, exp_guadagnata, trophy_casa);
        if (isMultiplayer) {
            const risultatoAvv = risultato_avv !== null ? risultato_avv : (risultato === 'vittoria' ? 'sconfitta' : 'vittoria');
            const expAvv = exp_avv !== null ? exp_avv : (risultatoAvv === 'vittoria' ? 100 : -10);
            await updatePlayerStats(id_utente_trasferta, risultatoAvv, expAvv, trophy_trasferta);
        }

        return { idPartita, statsCasa };
    } catch (err) {
        console.error("Errore salvataggio partita:", err.message);
        throw err;
    }
}

/**
 * Aggiorna EXP, livello e trofei di un giocatore nel DB.
 * Il livello viene calcolato automaticamente come floor(exp / 1000) + 1.
 * I trofei non scendono sotto 0.
 *
 * @param {string} playerId - UUID del giocatore
 * @param {string} result - 'vittoria' | 'sconfitta' | 'pareggio' (non usato direttamente qui)
 * @param {number} addedExp - EXP da aggiungere (può essere negativa)
 * @param {number} trophyChange - Variazione trofei (può essere negativa)
 * @returns {Object|null} - Nuovi valori { nuovaExp, nuovoLivello, nuoviTrofei, trophyChange }
 */
async function updatePlayerStats(playerId, result, addedExp, trophyChange = 0) {
    try {
        // Legge i valori correnti del giocatore
        const { data: prof, error: readErr } = await supabase
            .from('giocatore')
            .select('exp, livello, trophies')
            .eq('id_giocatore', playerId)
            .single();

        if (readErr) return null;

        const EXP_PER_LEVEL = 1000; // Soglia EXP per avanzare di livello
        const nuovaExp = Math.max(0, (prof.exp || 0) + addedExp); // L'EXP non va mai sotto 0
        const nuovoLivello = Math.floor(nuovaExp / EXP_PER_LEVEL) + 1;
        const nuoviTrofei = Math.max(0, (prof.trophies || 0) + trophyChange); // I trofei non vanno sotto 0

        await supabase
            .from('giocatore')
            .update({ exp: nuovaExp, livello: nuovoLivello, trophies: nuoviTrofei })
            .eq('id_giocatore', playerId);

        return { nuovaExp, nuovoLivello, nuoviTrofei, trophyChange };
    } catch (e) {
        console.error("Errore updatePlayerStats:", e);
        return null;
    }
}

app.post('/api/salva-partita', verificaToken, async (req, res) => {
    const mioId = req.utenteId;
    const { modalita, risultato, exp_guadagnata, id_utente_trasferta } = req.body;

    if (!modalita || !risultato) {
        return res.status(400).json({ errore: 'modalita e risultato sono obbligatori.' });
    }

    try {
        const resultData = await saveMatchToDB(mioId, modalita, risultato, exp_guadagnata, id_utente_trasferta);
        res.status(201).json({
            messaggio: 'Partita salvata con successo!',
            id_partita: resultData.idPartita,
            nuova_exp: resultData.statsCasa?.nuovaExp || 0,
            nuovo_livello: resultData.statsCasa?.nuovoLivello || 1,
            nuovi_trofei: resultData.statsCasa?.nuoviTrofei || 0
        });
    } catch (err) {
        res.status(500).json({ errore: 'Impossibile salvare la partita.' });
    }
});

// ==========================================
// API CREA PARTITA (POST)
// ==========================================

/**
 * POST /api/crea-partita
 * Crea una nuova partita con stato "in_corso" (prima che inizi il match).
 * Usata dal socket handler per la sfida tra amici e dal matchmaking.
 */
app.post('/api/crea-partita', verificaToken, async (req, res) => {
    const { id_giocatore_1, id_giocatore_2, modalita = 'multiplayer' } = req.body;

    if (!id_giocatore_1 || !id_giocatore_2) {
        return res.status(400).json({ errore: 'id_giocatore_1 e id_giocatore_2 sono obbligatori.' });
    }

    try {
        // Inserisci una nuova partita con stato 'in_corso'
        const { data: partitaData, error: partitaError } = await supabase
            .from('partita')
            .insert([{
                modalita,
                stato: 'in_corso',
                data_inizio: new Date().toISOString()
            }])
            .select()
            .single();

        if (partitaError) throw partitaError;

        const idPartita = partitaData.id_partita;

        // Inserisci i due giocatori nella tabella partecipazione (ancora senza risultato)
        const { error: partecError } = await supabase
            .from('partecipazione')
            .insert([
                {
                    id_partita: idPartita,
                    id_giocatore: id_giocatore_1,
                    risultato: null,  // Da completare alla fine del match
                    exp_guadagnata: 0
                },
                {
                    id_partita: idPartita,
                    id_giocatore: id_giocatore_2,
                    risultato: null,  // Da completare alla fine del match
                    exp_guadagnata: 0
                }
            ]);

        if (partecError) throw partecError;

        res.status(201).json({
            messaggio: 'Partita creata con successo.',
            id_partita: idPartita,
            stato: 'in_corso'
        });
    } catch (err) {
        console.error("Errore creazione partita:", err.message);
        res.status(500).json({ errore: 'Impossibile creare la partita.' });
    }
});

// ==========================================
// API RECUPERA PARTITA (GET)
// ==========================================

/**
 * GET /api/partita/:id
 * Recupera i dati di una partita dal database (per recovery e debugging).
 */
app.get('/api/partita/:id', verificaToken, async (req, res) => {
    const { id } = req.params;

    try {
        const { data: partitaData, error: partitaError } = await supabase
            .from('partita')
            .select('*')
            .eq('id_partita', id)
            .single();

        if (partitaError || !partitaData) {
            return res.status(404).json({ errore: 'Partita non trovata.' });
        }

        // Recupera i giocatori e i loro risultati
        const { data: partecipazioni, error: partecError } = await supabase
            .from('partecipazione')
            .select('id_giocatore, risultato, exp_guadagnata')
            .eq('id_partita', id);

        if (partecError) throw partecError;

        res.status(200).json({
            partita: partitaData,
            partecipazioni: partecipazioni || []
        });
    } catch (err) {
        console.error("Errore recupero partita:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare la partita.' });
    }
});


/**
 * GET /api/search/:nome
 * Cerca giocatori per nickname (ricerca prefisso, case-insensitive).
 * Restituisce un array con i profili che corrispondono (max 10).
 */
app.get('/api/search/:nome', async (req, res) => {
    const testoRicerca = req.params.nome;

    try {
        const { data, error } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname, livello, exp, avatar_url')
            .ilike('nickname', `${testoRicerca}%`) // Cerca nickname che iniziano con il testo
            .limit(10);

        if (error) throw error;

        // Mappa i dati nel formato atteso dal frontend
        const risultati = data.map(gioc => ({
            userid: gioc.id_giocatore,
            user: gioc.nickname,
            avatar_url: gioc.avatar_url,
        }));

        res.status(200).json(risultati);

    } catch (err) {
        console.error("Errore ricerca giocatori:", err.message);
        res.status(500).json({ errore: 'Impossibile completare la ricerca' });
    }
});

// ==========================================
// API REGISTRAZIONE (POST)
// ==========================================

/**
 * POST /api/registrazione
 * Crea un nuovo utente su Supabase Auth e inserisce il profilo nella tabella giocatore.
 * Body richiesto: { email, password, nickname }
 */
app.post('/api/registrazione', async (req, res) => {
    const { email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
        return res.status(400).json({ errore: 'Email, password e nickname sono obbligatori.' });
    }

    let nuovoIdGiocatore = null;

    try {
        // Check email già esistente
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        nuovoIdGiocatore = authData.user.id;

        const { error: dbError } = await supabase
            .from('giocatore')
            .insert([{ id_giocatore: nuovoIdGiocatore, nickname }]);

        if (dbError) {
            // Elimina l'utente appena creato nell'auth
            await supabase.auth.admin.deleteUser(nuovoIdGiocatore);

            // Messaggio più specifico per nickname duplicato
            if (dbError.code === '23505') {
                return res.status(400).json({ errore: 'Nickname già in uso.' });
            }
            throw dbError;
        }

        const risposta = {
            messaggio: 'Registrazione completata con successo!',
            user: nuovoIdGiocatore,
        };

        if (authData.session) {
            risposta.token = authData.session.access_token;
            risposta.refresh_token = authData.session.refresh_token;
        } else {
            risposta.messaggio = "Registrazione completata! Controlla la tua email per confermare l'account.";
        }

        res.status(201).json(risposta);

    } catch (errore) {
        // Rollback in caso di errori inattesi
        if (nuovoIdGiocatore) {
            await supabase.auth.admin.deleteUser(nuovoIdGiocatore);
        }
        console.error("Errore durante la registrazione:", errore.message);
        res.status(400).json({ errore: errore.message });
    }
});

// ==========================================
// API LOGIN (POST)
// ==========================================

/**
 * POST /api/login
 * Autentica un utente esistente con email e password.
 * Body richiesto: { email, password }
 * Risposta: { messaggio, user (UUID), token (access_token di sessione) }
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Validazione campi obbligatori
    if (!email || !password) {
        return res.status(400).json({ errore: 'Email e password sono obbligatorie.' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Errore durante il login:", error.message);
        return res.status(401).json({ errore: 'Credenziali non valide. Riprova.' });
    }

    return res.status(200).json({
        messaggio: 'Login completato con successo!',
        user: data.user.id,
        token: data.session.access_token,
        refresh_token: data.session.refresh_token  // Necessario per rinnovare il token scaduto
    });
});

// ==========================================
// API REFRESH TOKEN (POST)
// ==========================================

/**
 * POST /api/refresh-token
 * Rinnova un access_token scaduto usando il refresh_token.
 * Body richiesto: { refresh_token }
 * Risposta: { token (nuovo access_token), refresh_token (nuovo refresh_token) }
 */
app.post('/api/refresh-token', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ errore: 'refresh_token obbligatorio.' });
    }

    try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token });

        if (error || !data.session) {
            return res.status(401).json({ errore: 'Sessione scaduta. Effettua di nuovo il login.' });
        }

        return res.status(200).json({
            token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });

    } catch (err) {
        console.error("Errore refresh token:", err.message);
        res.status(500).json({ errore: 'Errore interno durante il refresh.' });
    }
});

// ==========================================
// API RESET PASSWORD (POST)
// ==========================================

/**
 * POST /api/reset_password
 * Invia un'email di reset password all'indirizzo fornito tramite Supabase.
 * Body richiesto: { email }
 * Il link nell'email reindirizzerà a BASE_URL/login dopo il reset.
 */
app.post('/api/reset_password', async (req, res) => {
    const { email } = req.body;

    // Validazione campo obbligatorio
    if (!email) {
        return res.status(400).json({ errore: 'Email obbligatoria.' });
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${BASE_URL}/reset_password_completo`  // Usa la variabile d'ambiente
        });

        if (error) throw error;

        res.status(200).json({ messaggio: 'Email di reset inviata con successo!' });

    } catch (err) {
        console.error("Errore durante il reset della password:", err.message);
        res.status(400).json({ errore: "Impossibile inviare l'email di reset." });
    }
});

// ==========================================
// UPLOAD IMMAGINI PROFILO
// ==========================================

// Configurazione multer: memoria RAM (no disco), max 5MB, solo immagini
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        // Ammettiamo qualsiasi tipo di immagine in allineamento con la policy del bucket Supabase Storage (image/*)
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Il file caricato non è un\'immagine valida.'));
        }
    }
});

/**
 * Factory che restituisce un array di middleware per gestire l'upload di un'immagine
 * su un bucket Supabase Storage specifico.
 *
 * Il file viene salvato come `{userId}_{timestamp}.{ext}` per evitare caching aggressivo.
 * Il bucket deve essere configurato come pubblico su Supabase.
 *
 * @param {string} bucket - Nome del bucket Supabase ('user_avatars' | 'user_banners')
 */
function handleImageUpload(bucket) {
    return [
        verificaToken,
        (req, res, next) => {
            upload.single('immagine')(req, res, (err) => {
                if (err) {
                    console.error(`[Upload ${bucket} Multer] Errore:`, err.message);
                    let errMsg = err.message;
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        errMsg = 'La dimensione del file supera il limite consentito di 5MB.';
                    }
                    return res.status(400).json({ errore: errMsg });
                }
                next();
            });
        },
        async (req, res) => {
            if (!req.file) {
                return res.status(400).json({ errore: 'Nessun file ricevuto.' });
            }

            const mioId = req.utenteId;
            
            // Estrazione robusta dell'estensione dal nome del file originale o dal mimetype
            let ext = '';
            if (req.file.originalname) {
                ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
            }
            if (!ext && req.file.mimetype) {
                ext = req.file.mimetype.split('/')[1] || '';
            }
            // Sanificazione e normalizzazione dell'estensione (es. jpeg -> jpg, svg+xml -> svg)
            ext = ext.replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
            
            const filePath = `${mioId}_${Date.now()}.${ext}`; // Nome file univoco con timestamp per evitare caching

            try {
                // 1. Recuperiamo il profilo corrente per trovare la vecchia immagine da eliminare
                const { data: userProfile } = await supabase
                    .from('giocatore')
                    .select('avatar_url, banner_url')
                    .eq('id_giocatore', mioId)
                    .single();

                const oldUrl = bucket === 'user_avatars' ? userProfile?.avatar_url : userProfile?.banner_url;

                // 2. Carichiamo la nuova immagine su Supabase Storage
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: true,
                    });

                if (error) throw error;

                // 3. Eliminiamo il vecchio file per liberare spazio (se esisteva e non era quello di default)
                if (oldUrl) {
                    try {
                        const oldFileName = oldUrl.substring(oldUrl.lastIndexOf('/') + 1);
                        if (oldFileName && !oldFileName.includes('user_profile.webp')) {
                            await supabase.storage.from(bucket).remove([oldFileName]);
                        }
                    } catch (delErr) {
                        console.warn(`[Upload ${bucket}] Errore durante l'eliminazione del vecchio file:`, delErr.message);
                    }
                }

                // 4. Recuperiamo la URL pubblica del nuovo file caricato
                const { data } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(filePath);

                res.status(200).json({ url: data.publicUrl });

            } catch (err) {
                console.error(`[Upload ${bucket}] Errore:`, err.message);
                res.status(500).json({ errore: 'Impossibile caricare il file.' });
            }
        }
    ];
}

app.post('/api/upload/avatar', handleImageUpload('user_avatars'));
app.post('/api/upload/banner', handleImageUpload('user_banners'));



// ==========================================
// INIZIALIZZAZIONE MODULI ESTERNI (SOCKET & CODICE)
// ==========================================

// Esporta updatePlayerStats per essere utilizzato dal modulo socket
module.exports.updatePlayerStats = updatePlayerStats;

// Inizializza il modulo per il recupero del codice e la valutazione AI
const codeModule = require('./controllers/code');
codeModule.init(app);

// Inizializza il modulo per la gestione delle missioni
const initMissions = require('./controllers/missions');
initMissions(app);

// Inizializza il modulo socket.io per il multiplayer in tempo reale
const initSockets = require('./controllers/socket');
initSockets(io);


// ==========================================
// ROTTA 404 (deve stare sempre per ultima)
// ==========================================

// Pagina 404 di fallback per la navigazione
app.get('/404', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', '404.html'));
});

// Intercetta qualsiasi rotta non definita sopra e reindirizza alla pagina 404
app.use((req, res) => {
    // Se la richiesta è per una API, continuiamo a restituire un JSON pulito
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ errore: `Rotta API '${req.path}' non trovata.` });
    }
    // Altrimenti, reindirizziamo alla pagina 404 passando il percorso non trovato come parametro
    res.redirect(`/404?path=${encodeURIComponent(req.path)}`);
});

// ==========================================
// AVVIO SERVER
// ==========================================
server.listen(PORT, HOST, () => {
    console.log(`Server in esecuzione su ${BASE_URL}`);
});