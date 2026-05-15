// ==========================================
// DIPENDENZE
// ==========================================
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

// Socket.io con CORS aperto (in produzione: restringere origin all'URL del deploy)
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// CORS per le chiamate REST dal frontend (solo localhost:3000 in sviluppo)
app.use(cors({
    origin: 'http://localhost:3000',
    allowedHeaders: ['Authorization', 'Content-Type']
}));

// ==========================================
// CONFIGURAZIONE AMBIENTE
// ==========================================

// Mappa in-memory userId -> timestamp dell'ultimo heartbeat ricevuto
const activeUsers = new Map();
const HEARTBEAT_TIMEOUT = 20000; // ms senza heartbeat prima di segnare l'utente come offline

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';                                      // Ascolta su tutte le interfacce di rete
const ROOT = path.join(__dirname, '..', 'frontend');          // Cartella root dei file statici
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ==========================================
// INIZIALIZZAZIONE SUPABASE
// ==========================================
// Usa la Service Role Key (accesso admin, bypass RLS) — NON esporre mai al client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = { supabase }; // Esportato per essere usato da altri moduli (es. auth.js)


// ==========================================
// AUTENTICAZIONE & OPENROUTER
// ==========================================

// Middleware Express che verifica il JWT Supabase nell'header Authorization
const verificaToken = require('./auth');

// @openrouter/sdk è ESM-only: non può essere importato con require().
// Viene importato dinamicamente al primo utilizzo e poi riutilizzato (pattern singleton).
let openrouter = null;
async function getOpenRouter() {
    if (!openrouter) {
        const { OpenRouter } = await import('@openrouter/sdk');
        openrouter = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/iAVAA/codeguessr',
                'X-Title': 'CodeGuessr'
            }
        });
    }
    return openrouter;
}

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
app.use(express.json());        // Parsa automaticamente il body JSON delle richieste POST/PUT
app.use(express.static(ROOT));  // Serve i file statici dalla cartella frontend/

// ==========================================
// ROTTE DI NAVIGAZIONE (GET)
// ==========================================
// Pagina principale (index)
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html'));
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
            .eq('id_utente_a', mittenteId)  // Dove il mittente è lui...
            .eq('id_utente_b', mioId)       // ...il destinatario sei tu...
            .eq('stato', 'in_attesa')       // ...e lo stato attuale è "in_attesa"
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

    const mioId = req.utenteId;           // Arriva dal tuo fantastico middleware!
    const targetId = req.params.id;       // Lo peschiamo dall'URL

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

//// ! TODO : avatar_url è ancora usato?
app.get('/api/mie-amicizie', verificaToken, async (req, res) => {

    const mioId = req.utenteId; // ← arriva già verificato dal middleware

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
 *   playerData.userid  -> UUID del giocatore
 *   playerData.user    -> nickname
 *   playerData.livello -> livello attuale
 *   playerData.exp     -> esperienza accumulata
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

        /* Non funziona
        // Aggiungiamo lo stato online in tempo reale basato sulla mappa activeUsers
        const dataConStato = data.map(p => ({
            ...p,
            online: activeUsers.has(p.id_giocatore)
        }));
        */

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

            if (partita && partita.modalita === 'multiplayer') {
                if (partita.id_utente_casa === idGiocatore) {
                    opponentName = partita.trasferta?.nickname;
                } else {
                    opponentName = partita.casa?.nickname;
                }
            }

            let trophyChange = 0;
            if (partita && partita.modalita === 'multiplayer') {
                if (p.risultato === 'vittoria') trophyChange = 25;
                else if (p.risultato === 'sconfitta') trophyChange = -15;
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
            total_exp: 0 // deprecated
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
// API MISSIONI (GET)
// ==========================================

/**
 * GET /api/missioni/:id
 * Recupera le missioni e calcola il progresso dinamico del giocatore.
 */
app.get('/api/missioni/:id', async (req, res) => {
    const idGiocatore = req.params.id;

    try {
        // 1. Legge gli achievement
        const { data: achievements, error: achErr } = await supabase
            .from('achievements')
            .select('*');

        if (achErr) throw achErr;

        // 2. Legge il profilo
        const { data: profilo, error: profErr } = await supabase
            .from('giocatore')
            .select('livello, avatar_url, banner_url')
            .eq('id_giocatore', idGiocatore)
            .single();

        if (profErr) throw profErr;

        // 3. Legge le partecipazioni/partite (storico e stat)
        const { data: partecipazioni, error: partErr } = await supabase
            .from('partecipazione')
            .select('risultato, exp_guadagnata, partita(modalita, data_inizio)')
            .eq('id_giocatore', idGiocatore)
            .order('id_partita', { ascending: false });

        if (partErr) throw partErr;

        // 4. Legge le amicizie confermate
        const { data: amicizie, error: amiErr } = await supabase
            .from('amicizia')
            .select('id_utente_a')
            .eq('stato', 'accettata')
            .or(`id_utente_a.eq.${idGiocatore},id_utente_b.eq.${idGiocatore}`);

        if (amiErr) throw amiErr;

        // 5. Legge i traguardi già sbloccati
        const { data: sbloccati, error: sblocErr } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', idGiocatore);

        if (sblocErr) throw sblocErr;
        const sbloccatiSet = new Set(sbloccati.map(a => a.achievement_id));

        // Calcoli per i traguardi
        const played = partecipazioni.length;
        const won = partecipazioni.filter(p => p.risultato === 'vittoria').length;
        const amiciCount = amicizie ? amicizie.length : 0;
        const mpPlayed = partecipazioni.filter(p => p.partita?.modalita === 'multiplayer').length;
        const mpWon = partecipazioni.filter(p => p.partita?.modalita === 'multiplayer' && p.risultato === 'vittoria').length;

        // Calcolo Notte Bianca (giocato tra le 00 e le 05)
        let notteBianca = 0;
        for (const p of partecipazioni) {
            if (p.partita && p.partita.data_inizio) {
                const hour = new Date(p.partita.data_inizio).getHours();
                if (hour >= 0 && hour <= 5) {
                    notteBianca = 1;
                    break;
                }
            }
        }

        // Calcolo Perfezionista (media exp > 90 nelle ultime 10)
        let perfezionista = 0;
        if (played >= 10) {
            const last10 = partecipazioni.slice(0, 10);
            const sumExp = last10.reduce((sum, p) => sum + (p.exp_guadagnata || 0), 0);
            if (sumExp / 10 >= 90) perfezionista = 1;
        }

        let consecutiveWins = 0;
        let maxConsecutiveWins = 0;
        for (let i = partecipazioni.length - 1; i >= 0; i--) { // ordina cronologicamente
            if (partecipazioni[i].risultato === 'vittoria') {
                consecutiveWins++;
                maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
            } else {
                consecutiveWins = 0;
            }
        }

        const genioIncompreso = partecipazioni.some(p => p.exp_guadagnata >= 100) ? 1 : 0;

        // 5. Mappatura progressi dinamica
        const progressMap = {
            'Vanità': Math.min((profilo.avatar_url || profilo.banner_url) ? 1 : 0, 1),
            'Leggenda del Debug': Math.min(profilo.livello, 50),
            'Script Kiddie': 0,
            'Notte Bianca': notteBianca,
            'Low Level Hero': 0,
            'Maestro del Codice': Math.min(profilo.livello, 20),
            'Gladiatore': Math.min(mpWon, 25),
            'Perfezionista': perfezionista,
            'Maratoneta': Math.min(played, 100),
            'Dio dei Linguaggi': Math.min(maxConsecutiveWins, 10),
            'Apprendista Codificatore': Math.min(profilo.livello, 5),
            'Web Wizard': 0,
            'Collezionista': 0, // Verrà calcolato alla fine
            'Duellante': Math.min(mpPlayed, 10),
            'Genio Incompreso': genioIncompreso,
            'Infallibile': Math.min(maxConsecutiveWins, 5),
            'Primo Sangue': Math.min(won, 1),
            'Scalatore Sociale': Math.min(amiciCount, 10)
        };

        const targetMap = {
            'Vanità': 1, 'Leggenda del Debug': 50, 'Script Kiddie': 1, 'Notte Bianca': 1, 'Low Level Hero': 1,
            'Maestro del Codice': 20, 'Gladiatore': 25, 'Perfezionista': 1, 'Maratoneta': 100, 'Dio dei Linguaggi': 10,
            'Apprendista Codificatore': 5, 'Web Wizard': 1, 'Collezionista': 10, 'Duellante': 10, 'Genio Incompreso': 1,
            'Infallibile': 5, 'Primo Sangue': 1, 'Scalatore Sociale': 10
        };

        let completedMissionsCount = 0;

        // Primo passaggio per contare le completate (serve a Collezionista)
        achievements.forEach(ach => {
            if (ach.name !== 'Collezionista') {
                const current = progressMap[ach.name] || 0;
                const target = targetMap[ach.name] || 1;
                if (current >= target) completedMissionsCount++;
            }
        });

        progressMap['Collezionista'] = Math.min(completedMissionsCount, 10);

        const daRiscatto = [];

        // Assembla l'array finale
        const missioniResult = achievements.map(ach => {
            const current = progressMap[ach.name] || 0;
            const target = targetMap[ach.name] || 1;
            const isCompleted = current >= target;

            // Se la missione è appena stata completata e non è ancora salvata nel DB
            if (isCompleted && !sbloccatiSet.has(ach.id)) {
                daRiscatto.push(ach);
            }

            return {
                id: ach.id,
                title: ach.name,
                description: ach.description,
                current: current,
                target: target,
                reward: `+${ach.exp_reward} XP, +${ach.trophy_reward} 🏆`,
                completed: isCompleted
            };
        });

        // Riscatta automaticamente i premi in background
        if (daRiscatto.length > 0) {
            (async () => {
                try {
                    // Inserisci in user_achievements
                    const insertData = daRiscatto.map(ach => ({ user_id: idGiocatore, achievement_id: ach.id }));
                    const { error: insErr } = await supabase.from('user_achievements').insert(insertData);

                    if (!insErr) {
                        // Somma i premi
                        const expTot = daRiscatto.reduce((sum, ach) => sum + ach.exp_reward, 0);
                        const trophyTot = daRiscatto.reduce((sum, ach) => sum + ach.trophy_reward, 0);

                        // Aggiorna giocatore (il Trigger PostgreSQL gestirà il Level Up se exp supera 500!)
                        const { data: prof } = await supabase.from('giocatore').select('exp, trophies').eq('id_giocatore', idGiocatore).single();
                        if (prof) {
                            await supabase.from('giocatore').update({
                                exp: (prof.exp || 0) + expTot,
                                trophies: (prof.trophies || 0) + trophyTot
                            }).eq('id_giocatore', idGiocatore);
                        }
                    }
                } catch (e) {
                    console.error("Errore nell'auto-riscatto missioni:", e);
                }
            })();
        }

        res.status(200).json(missioniResult);

    } catch (err) {
        console.error("Errore recupero missioni:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare le missioni' });
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

        await supabase.from('partecipazione').insert(partecipazioni);

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
 * @param {string} playerId    - UUID del giocatore
 * @param {string} result      - 'vittoria' | 'sconfitta' | 'pareggio' (non usato direttamente qui)
 * @param {number} addedExp    - EXP da aggiungere (può essere negativa)
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
            avatarSeed: gioc.nickname,
            livello: gioc.livello
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
            // ✅ Rollback: elimina l'utente appena creato nell'auth
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
        // ✅ Rollback anche in caso di errori inattesi
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
            redirectTo: `${BASE_URL}/reset_password_completo`  // Usa la variabile d'ambiente, sicuro anche in produzione
        });

        if (error) throw error;

        res.status(200).json({ messaggio: 'Email di reset inviata con successo!' });

    } catch (err) {
        console.error("Errore durante il reset della password:", err.message);
        res.status(400).json({ errore: "Impossibile inviare l'email di reset." });
    }
});

// ==========================================
// COSTANTI GITHUB
// ==========================================

// Mappa estensione file -> nome linguaggio per Monaco Editor
const EXT_TO_MONACO = {
    js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    c: 'c', h: 'c', cs: 'csharp', go: 'go', rs: 'rust', kt: 'kotlin',
    swift: 'swift', php: 'php', lua: 'lua', r: 'r', scala: 'scala',
    sh: 'shell', bash: 'shell', sql: 'sql', html: 'html', css: 'css',
    json: 'json', yml: 'yaml', yaml: 'yaml', xml: 'xml', md: 'markdown'
};

// Query predefinite per la ricerca su GitHub Code Search.
// Ogni entry specifica la query testuale e l'estensione del file da cercare.
const GITHUB_QUERIES = [
    { q: 'leetcode solutions language:python', ext: 'py' },
    { q: 'leetcode problems language:java', ext: 'java' },
    { q: 'leetcode algorithm language:cpp', ext: 'cpp' },
    { q: 'leetcode daily challenge language:js', ext: 'js' },
    { q: 'leetcode two sum language:python', ext: 'py' },
    { q: 'leetcode linked list language:java', ext: 'java' },
    { q: 'leetcode binary tree language:cpp', ext: 'cpp' },
    { q: 'leetcode dynamic programming language:py', ext: 'py' },
    { q: 'leetcode reverse string language:js', ext: 'js' },
    { q: 'leetcode merge sorted language:cpp', ext: 'cpp' },
    { q: 'leetcode valid parentheses language:java', ext: 'java' },
    { q: 'leetcode top interview questions language:py', ext: 'py' },
    { q: 'leetcode blind 75 language:js', ext: 'js' },
    { q: 'leetcode hash map language:cpp', ext: 'cpp' },
    { q: 'leetcode depth first search language:py', ext: 'py' }
];

// Snippet di fallback locali, usati quando GitHub API non è disponibile o ha esaurito il rate limit
const FALLBACK_SNIPPETS = [
    {
        code: `function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}`,
        monacoLang: 'javascript',
        source: 'fallback/local - two_sum.js',
        fileUrl: null
    },
    {
        code: `def is_palindrome(s: str) -> bool:\n    clean = ''.join(ch.lower() for ch in s if ch.isalnum())\n    left, right = 0, len(clean) - 1\n\n    while left < right:\n        if clean[left] != clean[right]:\n            return False\n        left += 1\n        right -= 1\n\n    return True`,
        monacoLang: 'python',
        source: 'fallback/local - palindrome.py',
        fileUrl: null
    },
    {
        code: `public static int[] mergeSorted(int[] a, int[] b) {\n    int[] out = new int[a.length + b.length];\n    int i = 0, j = 0, k = 0;\n\n    while (i < a.length && j < b.length) {\n        out[k++] = (a[i] <= b[j]) ? a[i++] : b[j++];\n    }\n    while (i < a.length) out[k++] = a[i++];\n    while (j < b.length) out[k++] = b[j++];\n\n    return out;\n}`,
        monacoLang: 'java',
        source: 'fallback/local - merge_sorted.java',
        fileUrl: null
    },
    {
        code: `fn factorial(n: u64) -> u64 {\n    if n <= 1 {\n        return 1;\n    }\n\n    let mut result = 1;\n    for i in 2..=n {\n        result *= i;\n    }\n    result\n}`,
        monacoLang: 'rust',
        source: 'fallback/local - factorial.rs',
        fileUrl: null
    }
];

let lastPublicSnippetCode = null; // Tiene traccia dell'ultimo snippet servito (evita ripetizioni)

/**
 * Restituisce uno snippet di fallback casuale dal pool locale.
 * Se viene passato un previousCode, esclude quello snippet per evitare ripetizioni.
 */
function buildFallbackSnippet(previousCode = null) {
    const pool = previousCode
        ? FALLBACK_SNIPPETS.filter(s => s.code !== previousCode)
        : FALLBACK_SNIPPETS;

    const sourcePool = pool.length > 0 ? pool : FALLBACK_SNIPPETS;
    const choice = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    return { ...choice };
}

/**
 * Tenta di ottenere uno snippet da GitHub (fino a 5 tentativi).
 * Se tutti i tentativi falliscono, ricade sul pool di fallback locale.
 * Garantisce sempre che lo snippet restituito sia diverso dal precedente.
 */
async function getRoundSnippet(previousCode = null) {
    let firstSnippet = null;

    for (let i = 0; i < 5; i++) {
        try {
            const snippet = await getRandomSnippet();
            if (!snippet || !snippet.code) continue;

            if (!firstSnippet) {
                firstSnippet = snippet;
            }

            if (!previousCode || snippet.code !== previousCode) {
                return snippet;
            }
        } catch (error) {
            // Proviamo di nuovo: il fallback viene gestito fuori dal loop.
        }
    }

    if (firstSnippet && (!previousCode || firstSnippet.code !== previousCode)) {
        return firstSnippet;
    }

    return buildFallbackSnippet(previousCode);
}
// ==========================================
// API GITHUB SNIPPET (GET)
// ==========================================
/**
 * GET /api/random-snippet
 * Cerca un file di codice casuale su GitHub e lo formatta per il frontend.
 */
/**
 * Esegue una ricerca su GitHub Code Search, scarica un file casuale dai risultati
 * e lo ritorna come oggetto snippet.
 *
 * Il file viene troncato a 40 righe partendo dalla prima riga non vuota.
 * Lancia un'eccezione se GITHUB_TOKEN non è configurato o se la ricerca fallisce.
 */
async function getRandomSnippet() {
    if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN non configurato');
    }

    // Sceglie una query casuale dall'array e una pagina casuale (1-3) per variare i risultati
    const queryObj = GITHUB_QUERIES[Math.floor(Math.random() * GITHUB_QUERIES.length)];
    const page = Math.floor(Math.random() * 3) + 1;

    const headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'CodeGuessr-Server',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`
    };

    const keywords = queryObj.q.split('language:')[0].trim();
    const codeSearchQuery = `${keywords} extension:${queryObj.ext}`;
    // Esegue la ricerca per codice (GitHub Code Search API)
    const codeSearchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(codeSearchQuery)}&per_page=30&page=${page}`;

    const codeRes = await fetch(codeSearchUrl, { headers });
    if (!codeRes.ok) throw new Error(`Code search failed: ${codeRes.status}`);

    const codeData = await codeRes.json();
    if (!codeData.items || codeData.items.length === 0) {
        throw new Error(`Nessun file trovato per la query: ${codeSearchQuery}`);
    }

    // Sceglie un file casuale tra i risultati e ne scarica il contenuto
    const file = codeData.items[Math.floor(Math.random() * codeData.items.length)];
    const repoFullName = file.repository.full_name;

    const contentRes = await fetch(file.url, { headers });
    if (!contentRes.ok) throw new Error(`Content fetch failed: ${contentRes.status}`);
    const contentData = await contentRes.json();

    // Decodifica il contenuto base64 e tronca a max 40 righe (dalla prima non vuota)
    let rawCode = Buffer.from(contentData.content, 'base64').toString('utf-8');
    const lines = rawCode.split('\n');
    if (lines.length > 40) {
        const start = lines.findIndex(l => l.trim().length > 0);
        rawCode = lines.slice(start > -1 ? start : 0, (start > -1 ? start : 0) + 40).join('\n');
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const monacoLang = EXT_TO_MONACO[ext] || 'plaintext';

    return {
        code: rawCode,
        monacoLang,
        source: `${repoFullName} — ${file.path}`,
        fileUrl: file.html_url
    };
}

app.get('/api/random-snippet', async (req, res) => {
    try {
        const snippet = await getRoundSnippet(lastPublicSnippetCode);
        lastPublicSnippetCode = snippet.code;
        res.status(200).json(snippet);
    } catch (error) {
        console.error("[Backend] Errore fetch snippet:", error.message);
        const snippet = buildFallbackSnippet(lastPublicSnippetCode);
        lastPublicSnippetCode = snippet.code;
        res.status(200).json(snippet);
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
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Formato immagine non supportato. Usa JPEG, PNG, WEBP o GIF.'));
    }
});

/**
 * Factory che restituisce un array di middleware per gestire l'upload di un'immagine
 * su un bucket Supabase Storage specifico.
 *
 * Il file viene sempre salvato come `{userId}.{ext}` (sovrascrive il precedente, upsert=true).
 * Il bucket deve essere configurato come pubblico su Supabase.
 *
 * @param {string} bucket - Nome del bucket Supabase ('user_avatars' | 'user_banners')
 */
function handleImageUpload(bucket) {
    return [
        verificaToken,
        upload.single('immagine'),
        async (req, res) => {
            if (!req.file) {
                return res.status(400).json({ errore: 'Nessun file ricevuto.' });
            }

            const mioId = req.utenteId;
            const ext = req.file.mimetype.split('/')[1].replace('jpeg', 'jpg');
            const filePath = `${mioId}.${ext}`; // es. "abc-123.jpg" — sovrascrive sempre lo stesso file

            try {
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: true, // sovrascrive se esiste già
                    });

                if (error) throw error;

                // Recupera la URL pubblica (il bucket deve essere pubblico)
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
// API VALUTAZIONE RISPOSTA - OPENAI (POST)
// ==========================================

/**
 * POST /api/valuta-risposta
 * Valuta la risposta del giocatore tramite OpenRouter (LLM) e restituisce un punteggio da 0 a 100.
 * L'LLM deduce autonomamente il linguaggio corretto analizzando il frammento di codice.
 *
 * Body richiesto:
 *   { snippet: string, risposta: string }
 *
 * Risposta:
 *   { punteggio: number, linguaggio: string }
 *   - punteggio: intero 0–100
 *   - linguaggio: nome del linguaggio rilevato dall'AI (es. "JavaScript")
 */
// Funzione helper per valutare la risposta tramite AI
async function evaluateAnswer(snippet, risposta) {
    const prompt = `Analizza il seguente codice sorgente:

\`\`\`
${snippet}
\`\`\`

La spiegazione fornita dal giocatore è: "${risposta}"

Valuta la correttezza della risposta del giocatore rispetto all'effettivo scopo e funzionamento del codice. Assegna un punteggio da 0 a 100 in base ai seguenti criteri:
- 100: Spiegazione perfetta, che coglie esattamente la logica e lo scopo principale del codice.
- 70-99: Spiegazione per lo più corretta, ma imprecisa o mancante di alcuni dettagli tecnici secondari.
- 30-69: Spiegazione parziale; il giocatore ha capito il contesto generale ma ha frainteso la logica chiave.
- 1-29: Spiegazione ampiamente errata, ma che menziona concetti o elementi effettivamente presenti nel codice.
- 0: Risposta completamente sbagliata, non pertinente o insensata.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido nel seguente formato, senza blocchi di codice markdown o testo aggiuntivo:
{"punteggio": <numero>}`;

    try {
        const client = await getOpenRouter();
        const completion = await client.chat.send({
            chatRequest: {
                model: 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            }
        });

        const chatResult = completion.chatCompletion ?? completion;
        let rawOutput = chatResult.choices[0].message.content.trim();
        rawOutput = rawOutput.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

        const parsed = JSON.parse(rawOutput);
        return Math.min(100, Math.max(0, parseInt(parsed.punteggio, 10)));
    } catch (err) {
        console.error('[Evaluation] Errore:', err.message);
        throw err;
    }
}

app.post('/api/valuta-risposta', async (req, res) => {
    const { snippet, risposta } = req.body;
    if (!snippet || !risposta) {
        return res.status(400).json({ errore: 'Dati mancanti.' });
    }

    try {
        const punteggio = await evaluateAnswer(snippet, risposta);
        res.status(200).json({ punteggio });
    } catch (err) {
        console.error('[OpenRouter] Errore valutazione risposta:', err.message);
        res.status(500).json({ errore: 'Errore durante la valutazione della risposta.' });
    }
});

// ==========================================
// LOGICA MULTIPLAYER (Socket.io)
// ==========================================

// Code di giocatori in attesa di avversario per il matchmaking automatico
const matchmakingQueue = [];
// Stanze create con codice numerico (2 giocatori, ranked)
const privateRooms = new Map(); // codice -> { host, giocatori: [], unranked: false }
// Partite attive in memoria, indicizzate per roomCode
const activeMatches = new Map(); // roomCode -> { players, partita_id, answers, ... }
// Inviti sfida tra amici in attesa di risposta
const pendingFriendInvites = new Map(); // inviteId -> { challengerId, friendId, timeoutId }
// Partite con almeno un giocatore disconnesso (in attesa di riconnessione)
const disconnectedMatches = new Map(); // roomCode -> { partita_id, disconnectTime, suspensionTimeout, disconnectedUserIds }

/**
 * Cerca il socket attivo di un utente dato il suo UUID.
 * Scorre tutti i socket connessi e restituisce quello che appartiene all'utente.
 * Restituisce null se l'utente non è online.
 */
function getSocketByUserId(userId) {
    for (const s of io.sockets.sockets.values()) {
        if (s.userId === userId) return s;
    }
    return null;
}

// ==========================================
// MIDDLEWARE SOCKET.IO
// ==========================================
// Ogni connessione socket viene autenticata tramite il JWT Supabase.
// L'ID utente e il profilo vengono attaccati direttamente all'oggetto socket
// per essere disponibili in tutti gli handler successivi.
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Autenticazione fallita: Token mancante'));

        const cleanToken = token.replace(/['"]/g, '');
        const { data: authData, error } = await supabase.auth.getUser(cleanToken);

        if (error || !authData.user) {
            return next(new Error('Autenticazione fallita: Token non valido'));
        }

        socket.userId = authData.user.id;

        // Recuperiamo il nickname dal DB
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
        next(new Error('Errore durante l\'autenticazione'));
    }
});

io.on('connection', (socket) => {
    console.log(`[Socket] Utente connesso: ${socket.nickname} (${socket.userId})`);

    // Aggiorna il contatore giocatori online per tutti i client
    io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });

    // ========================================
    // AUTO-REJOIN
    // ========================================
    // Se l'utente si riconnette (es. refresh pagina) mentre era in una partita sospesa,
    // lo si reinserisce automaticamente nella room socket senza aspettare 'joinRoom'.
    for (const [roomCode, match] of activeMatches.entries()) {
        if (match.players.some(p => p.id === socket.userId)) {
            const suspended = disconnectedMatches.get(roomCode);
            if (suspended?.disconnectedUserIds?.includes(socket.userId)) {
                console.log(`[Match] Auto-rejoin rilevato: ${socket.nickname} sta ritornando a ${roomCode}`);

                // Rimuovi questo utente dalla lista dei disconnessi
                suspended.disconnectedUserIds = suspended.disconnectedUserIds.filter(id => id !== socket.userId);

                // Se tutti i giocatori sono rientrati, cancella il timeout di abbandono
                if (suspended.disconnectedUserIds.length === 0) {
                    clearTimeout(suspended.suspensionTimeout);
                    disconnectedMatches.delete(roomCode);
                    console.log(`[Match] ✓ Sospensione cancellata per ${roomCode} - Tutti i giocatori sono ritornati`);
                }

                socket.join(roomCode);
                io.to(roomCode).emit('opponentRejoined', { playerName: socket.nickname, roomCode });
                console.log(`[Match] ✓ ${socket.nickname} è stato automaticamente riaggiunto a ${roomCode}`);
            }
        }
    }

    // ========================================
    // 1. MATCHMAKING AUTOMATICO
    // ========================================
    // Il primo giocatore che arriva viene messo in coda.
    // Il secondo giocatore trova la coda non vuota: vengono abbinati,
    // viene creata la partita nel DB e la room socket, e si emette 'matchFound' a entrambi.
    socket.on('startMatchmaking', async () => {
        console.log(`[Matchmaking] ${socket.nickname} è entrato in coda.`);

        // Evita duplicati in coda
        if (matchmakingQueue.find(s => s.userId === socket.userId)) return;

        if (matchmakingQueue.length > 0) {
            // Match trovato!
            const opponent = matchmakingQueue.shift();
            const roomCode = `MATCH_${Math.random().toString(36).substring(2, 9)}`;

            // ========================================
            // CREAZIONE PARTITA NEL DATABASE
            // ========================================
            try {
                const { data: partitaData, error: partitaError } = await supabase
                    .from('partita')
                    .insert([{
                        modalita: 'multiplayer',
                        stato: 'in_corso',
                        data_inizio: new Date().toISOString(),
                        id_utente_casa: socket.userId,
                        id_utente_trasferta: opponent.userId
                    }])
                    .select()
                    .single();

                if (partitaError) throw partitaError;

                const idPartita = partitaData.id_partita;

                // Inserisci i due giocatori nella partecipazione
                const { error: partecError } = await supabase
                    .from('partecipazione')
                    .insert([
                        {
                            id_partita: idPartita,
                            id_giocatore: socket.userId,
                            risultato: null,
                            exp_guadagnata: 0
                        },
                        {
                            id_partita: idPartita,
                            id_giocatore: opponent.userId,
                            risultato: null,
                            exp_guadagnata: 0
                        }
                    ]);

                if (partecError) throw partecError;

                socket.join(roomCode);
                opponent.join(roomCode);

                const matchData = {
                    roomCode,
                    partita_id: idPartita,  // ← Salva l'ID della partita nel match
                    players: [
                        { id: socket.userId, nickname: socket.nickname, avatar_url: socket.avatar_url, livello: socket.livello, trophies: socket.trophies },
                        { id: opponent.userId, nickname: opponent.nickname, avatar_url: opponent.avatar_url, livello: opponent.livello, trophies: opponent.trophies }
                    ],
                    unranked: false,
                    answers: {},
                    started: false  // ← Ancora non iniziato
                };

                activeMatches.set(roomCode, matchData);
                io.to(roomCode).emit('matchFound', {
                    ...matchData,
                    partita_id: idPartita  // ← Emetti l'ID della partita ai client
                });
                console.log(`[Matchmaking] Partita ${idPartita} creata tra ${socket.nickname} e ${opponent.nickname}, roomCode=${roomCode}`);
            } catch (err) {
                console.error("[Matchmaking] Errore creazione partita:", err.message);
                socket.emit('error', { message: 'Errore nella creazione della partita.' });
                opponent.emit('error', { message: 'Errore nella creazione della partita.' });
            }
        } else {
            matchmakingQueue.push(socket);
        }
    });

    // Rimuove il giocatore dalla coda se si cancella prima di trovare un avversario
    socket.on('cancelMatchmaking', () => {
        const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);
    });

    // ========================================
    // 2. STANZA PRIVATA (Codice 5 cifre, ranked)
    // ========================================
    // L'host crea la stanza e riceve un codice numerico da condividere.
    // Il secondo giocatore entra con quel codice e la partita inizia automaticamente.
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
            unranked: false
        });

        socket.join(`ROOM_${code}`);
        socket.emit('roomCreated', { code });
        console.log(`[Room] Stanza privata creata: ${code} da ${socket.nickname}`);
    });

    socket.on('joinPrivateRoom', (code) => {
        const room = privateRooms.get(code);
        if (!room) {
            return socket.emit('error', { message: 'Stanza non trovata' });
        }
        if (room.giocatori.length >= 2) {
            return socket.emit('error', { message: 'Stanza piena' });
        }

        room.giocatori.push({
            id: socket.userId,
            nickname: socket.nickname,
            socketId: socket.id,
            avatar_url: socket.avatar_url,
            livello: socket.livello,
            trophies: socket.trophies
        });
        socket.join(`ROOM_${code}`);

        const matchData = {
            roomCode: `ROOM_${code}`,
            players: room.giocatori.map(g => ({
                id: g.id,
                nickname: g.nickname,
                avatar_url: g.avatar_url,
                livello: g.livello,
                trophies: g.trophies
            })),
            unranked: room.unranked,
            answers: {},
            started: false  // ← Ancora non iniziato
        };

        activeMatches.set(matchData.roomCode, matchData);
        io.to(`ROOM_${code}`).emit('matchFound', matchData);

        privateRooms.delete(code); // Rimuovi dalla lista stanze una volta avviata
        console.log(`[Room] ${socket.nickname} è entrato nella stanza ${code}`);
    });

    // ========================================
    // 3. JOIN ROOM (sincronizzazione match)
    // ========================================
    // Evento emesso dal client quando entra nella pagina di match.
    // Aggiorna lo stato del giocatore e avvia la partita quando entrambi sono pronti.
    socket.on('joinRoom', (code) => {
        const match = activeMatches.get(code);
        if (match) {
            socket.join(code);

            // Aggiorna lo stato del giocatore (connesso alla partita)
            const player = match.players.find(p => p.id === socket.userId);
            if (player) {
                player.socketId = socket.id;
                player.ready = true;
                player.health = 100;
            }

            socket.emit('matchInfo', match);
            console.log(`[Room] ${socket.nickname} è rientrato nella stanza ${code}`);

            // Se entrambi sono pronti, iniziamo la partita
            const allReady = match.players.every(p => p.ready);
            if (allReady && !match.started) {
                match.started = true;
                match.currentRound = 1;
                match.maxRounds = 5;
                startMultiplayerRound(code);
            }
        } else {
            socket.emit('error', { message: 'Partita non trovata o terminata' });
        }
    });

    /**
     * Avvia un round: scarica uno snippet da GitHub (o fallback),
     * lo invia ai client e imposta un timer di sicurezza da 90s.
     */
    async function startMultiplayerRound(roomCode) {
        const match = activeMatches.get(roomCode);
        if (!match) return;

        console.log(`[Match] Inizio Round ${match.currentRound} per ${roomCode}, partita_id=${match.partita_id}`);

        // Segna il match come ufficialmente iniziato (blocca la sospensione per disconnect prematuro)
        if (!match.started) {
            match.started = true;
            console.log(`[Match] ✓ Match ${roomCode} ufficialmente iniziato (started=true)`);
        }

        try {
            const snippet = await getRoundSnippet(match.lastSnippetCode || null);
            match.currentSnippet = snippet;
            match.lastSnippetCode = snippet.code;
            match.answers = {};

            io.to(roomCode).emit('startRound', {
                round: match.currentRound,
                totalRounds: match.maxRounds,
                snippet: snippet
            });

            // Timer di sicurezza (90 secondi: 60 di round + 30 di tolleranza per lag/digitazione lenta)
            if (match.timer) clearTimeout(match.timer);
            match.timer = setTimeout(() => {
                if (activeMatches.has(roomCode)) {
                    evaluateMultiplayerRound(roomCode);
                }
            }, 90000);

        } catch (err) {
            console.error(`[Match] Snippet GitHub fallito per ${roomCode}:`, err.message);
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
                if (activeMatches.has(roomCode)) {
                    evaluateMultiplayerRound(roomCode);
                }
            }, 90000);
        }
    }

    /**
     * Riceve la risposta di un giocatore per il round corrente.
     * Se il giocatore avversario è disconnesso, gli assegna automaticamente risposta vuota (score 0).
     * Quando entrambi hanno risposto, lancia immediatamente la valutazione.
     */
    socket.on('submitMultiplayerAnswer', async (data) => {
        const { roomCode, answer } = data;
        const match = activeMatches.get(roomCode);
        if (!match || !match.started || match.evaluating) return;

        // Registra la risposta del giocatore corrente
        match.answers[socket.userId] = answer;

        const suspended = disconnectedMatches.get(roomCode);

        // Se un avversario è disconnesso, assegna risposta vuota per non bloccare il round
        if (suspended?.disconnectedUserIds && suspended.disconnectedUserIds.length > 0) {
            for (const disconnectedId of suspended.disconnectedUserIds) {
                if (!match.answers[disconnectedId]) {
                    match.answers[disconnectedId] = ""; // Score 0 per il disconnesso
                }
            }
        }

        // Avvia la valutazione appena entrambi i giocatori hanno risposto
        if (Object.keys(match.answers).length === 2) {
            evaluateMultiplayerRound(roomCode);
        }
    });

    /**
     * Valuta le risposte di entrambi i giocatori tramite AI.
     * Calcola i danni in base alla differenza di punteggio e aggiorna gli HP.
     * Se qualcuno ha 0 HP o si è raggiunto il numero massimo di round, termina la partita.
     * Il flag `evaluating` previene chiamate concorrenti (es. timer + risposta simultanea).
     */
    async function evaluateMultiplayerRound(roomCode) {
        const match = activeMatches.get(roomCode);
        if (!match || match.evaluating) return;

        match.evaluating = true; // Blocca altre chiamate concorrenti
        if (match.timer) clearTimeout(match.timer);
        match.timer = null;

        const results = {};
        const pIds = match.players.map(p => p.id);

        try {
            // Valuta entrambe le risposte in parallelo con Promise.all per ridurre la latenza
            const evaluations = await Promise.all(pIds.map(async (id) => {
                const score = await evaluateAnswer(match.currentSnippet.code, match.answers[id] || "");
                return { id, score };
            }));

            evaluations.forEach(ev => results[ev.id] = ev.score);

            // Calcolo danni
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
                damage: damage,
                winnerId: diff > 0 ? p1.id : (diff < 0 ? p2.id : null) // null = pareggio di round
            };

            io.to(roomCode).emit('roundResult', roundResult);

            // Fine partita se: qualcuno ha 0 HP oppure si è raggiunto il numero massimo di round
            if (p1.health <= 0 || p2.health <= 0 || match.currentRound >= match.maxRounds) {
                setTimeout(() => finishMultiplayerMatch(roomCode), 3000);
            } else {
                match.currentRound++;
                setTimeout(() => startMultiplayerRound(roomCode), 4000);
            }
            match.evaluating = false;
        } catch (err) {
            console.error("Errore valutazione multiplayer:", err);
            match.evaluating = false;
        }
    }

    /**
     * Chiude la partita multiplayer: determina il vincitore, aggiorna il DB in 3 step atomici
     * (partecipazione P1, partecipazione P2, stato partita) e aggiorna le statistiche se ranked.
     *
     * Calcolo EXP:
     *   - Vittoria: 100 + floor(hp/2)
     *   - Sconfitta: -10 - floor(hp_avversario/2)
     *   - Pareggio: 20
     *
     * Calcolo trofei (solo ranked):
     *   - Vittoria: random(30-40) + floor(hp/2)
     *   - Sconfitta: -(random(20-30) + floor(hp_avversario/2))
     */
    async function finishMultiplayerMatch(roomCode) {
        const match = activeMatches.get(roomCode);
        if (!match) {
            console.warn(`[Match] finishMultiplayerMatch: Match ${roomCode} non trovato`);
            return;
        }

        const p1 = match.players[0];
        const p2 = match.players[1];

        console.log(`[Match] Inizio finishMultiplayerMatch per ${roomCode}, partita_id: ${match.partita_id}`);

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

        // Calcolo EXP e trofei (dichiarati fuori dal try per essere accessibili all'emit)
        let expP1 = risultatoP1 === 'vittoria' ? 100 + Math.round(p1.health / 2) : (risultatoP1 === 'sconfitta' ? -10 - Math.round(p2.health / 2) : 20);
        let expP2 = risultatoP2 === 'vittoria' ? 100 + Math.round(p2.health / 2) : (risultatoP2 === 'sconfitta' ? -10 - Math.round(p1.health / 2) : 20);

        let trophyP1 = risultatoP1 === 'vittoria'
            ? Math.floor(Math.random() * 11) + 30 + Math.round(p1.health / 2)
            : (risultatoP1 === 'sconfitta' ? -(Math.floor(Math.random() * 11) + 20) - Math.round(p2.health / 2) : 0);

        let trophyP2 = risultatoP2 === 'vittoria'
            ? Math.floor(Math.random() * 11) + 30 + Math.round(p2.health / 2)
            : (risultatoP2 === 'sconfitta' ? -(Math.floor(Math.random() * 11) + 20) - Math.round(p1.health / 2) : 0);

        // Salvataggio nel DB
        try {

            // Se la partita è stata creata nel DB (partita_id è presente)
            if (match.partita_id) {
                console.log(`[Match] Completamento partita ${match.partita_id}: P1=${p1.id} (${risultatoP1}, hp=${p1.health}) vs P2=${p2.id} (${risultatoP2}, hp=${p2.health})`);
                
                // STEP 1: Aggiorna la partecipazione di P1
                console.log(`[Match] Step 1: Aggiornamento partecipazione P1...`);
                const { error: updatePartecP1 } = await supabase
                    .from('partecipazione')
                    .update({
                        risultato: risultatoP1,
                        exp_guadagnata: expP1
                    })
                    .eq('id_partita', match.partita_id)
                    .eq('id_giocatore', p1.id);

                if (updatePartecP1) {
                    console.error(`[Match] ERRORE Step 1 - Aggiornamento partecipazione P1:`, updatePartecP1.message);
                    throw updatePartecP1;
                }
                console.log(`[Match] ✓ Step 1 completato`);

                // STEP 2: Aggiorna la partecipazione di P2
                console.log(`[Match] Step 2: Aggiornamento partecipazione P2...`);
                const { error: updatePartecP2 } = await supabase
                    .from('partecipazione')
                    .update({
                        risultato: risultatoP2,
                        exp_guadagnata: expP2
                    })
                    .eq('id_partita', match.partita_id)
                    .eq('id_giocatore', p2.id);

                if (updatePartecP2) {
                    console.error(`[Match] ERRORE Step 2 - Aggiornamento partecipazione P2:`, updatePartecP2.message);
                    throw updatePartecP2;
                }
                console.log(`[Match] ✓ Step 2 completato`);

                // STEP 3: Aggiorna lo stato della partita a 'terminata'
                console.log(`[Match] Step 3: Aggiornamento stato partita a 'terminata'...`);
                const dataFine = new Date().toISOString();
                const { data: updateResult, error: updateError } = await supabase
                    .from('partita')
                    .update({
                        stato: 'terminata',
                        data_fine: dataFine
                    })
                    .eq('id_partita', match.partita_id)
                    .select();

                if (updateError) {
                    console.error(`[Match] ERRORE Step 3 - Aggiornamento stato partita:`, updateError.message);
                    throw updateError;
                }
                console.log(`[Match] ✓ Step 3 completato`, updateResult);

                console.log(`[Match] ✓✓✓ Partita ${match.partita_id} completata nel DB con successo`);
                
                // STEP 4: Aggiorna le statistiche dei giocatori SOLO per partite ranked
                if (!match.unranked) {
                    console.log(`[Match] Step 4: Aggiornamento statistiche giocatori (partita ranked)...`);
                    await updatePlayerStats(p1.id, risultatoP1, expP1, trophyP1);
                    await updatePlayerStats(p2.id, risultatoP2, expP2, trophyP2);
                    console.log(`[Match] ✓ Step 4 completato - Statistiche aggiornate per partita ranked ${match.partita_id}`);
                } else {
                    console.log(`[Match] Partita ${match.partita_id} è unranked, statistiche NON aggiornate`);
                }
            } else {
                console.error(`[Match] ERRORE: Partita ${roomCode} NON ha partita_id!`);
                console.error(`[Match] Match data:`, { roomCode, partita_id: match.partita_id, players: match.players.map(p => p.id) });
            }

            console.log(`[Match] ✓ Completamento salvataggio risultati per partita ${roomCode}`);
        } catch (e) {
            console.error("[Match] ERRORE critico salvataggio DB multiplayer:", e.message || e);
            console.error("[Match] Stack:", e.stack);
        }

        io.to(roomCode).emit('matchFinished', {
            winner: winnerId,
            players: match.players,
            unranked: match.unranked,
            // Ricompense per ciascun giocatore (usate dal frontend per l'overlay di fine partita)
            rewards: {
                [p1.id]: { exp: expP1, trophies: match.unranked ? 0 : trophyP1 },
                [p2.id]: { exp: expP2, trophies: match.unranked ? 0 : trophyP2 }
            }
        });

        activeMatches.delete(roomCode);
        
        // Cancella anche il timeout di sospensione se esiste
        const suspended = disconnectedMatches.get(roomCode);
        if (suspended?.suspensionTimeout) {
            clearTimeout(suspended.suspensionTimeout);
            console.log(`[Match] Timeout di sospensione cancellato per ${roomCode}`);
        }
        disconnectedMatches.delete(roomCode);
        
        console.log(`[Match] Match ${roomCode} rimosso da activeMatches e disconnectedMatches`);
    }

    // ========================================
    // 4. SFIDA TRA AMICI (unranked)
    // ========================================
    // Il challenger invia l'invito tramite 'challengeFriend'.
    // Il destinatario risponde con 'respondToChallenge' (accepted: true/false).
    // Se accetta, viene creata la partita nel DB (unranked=true) e inizia il match.
    socket.on('challengeFriend', (payload) => {
        const friendId = typeof payload === 'string' ? payload : payload?.friendId;

        if (!friendId) {
            socket.emit('challengeError', { message: 'ID amico non valido.' });
            return;
        }
        if (friendId === socket.userId) {
            socket.emit('challengeError', { message: 'Non puoi sfidare te stesso.' });
            return;
        }

        const friendSocket = getSocketByUserId(friendId);
        if (!friendSocket) {
            socket.emit('challengeError', { message: 'Questo amico non e online.' });
            return;
        }

        const inviteId = `INV_${Math.random().toString(36).substring(2, 10)}`;
        const timeoutId = setTimeout(() => {
            const invite = pendingFriendInvites.get(inviteId);
            if (!invite) return;

            pendingFriendInvites.delete(inviteId);
            const challengerSocket = getSocketByUserId(invite.challengerId);
            const receiverSocket = getSocketByUserId(invite.friendId);

            if (challengerSocket) {
                challengerSocket.emit('challengeExpired', { inviteId });
            }
            if (receiverSocket) {
                receiverSocket.emit('challengeExpired', { inviteId });
            }
        }, 30000);

        pendingFriendInvites.set(inviteId, {
            challengerId: socket.userId,
            friendId,
            timeoutId
        });

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

        socket.emit('challengeSent', {
            inviteId,
            friendId,
            friendNickname: friendSocket.nickname
        });
    });

    socket.on('respondChallenge', async ({ inviteId, accepted }) => {
        const invite = pendingFriendInvites.get(inviteId);
        if (!invite) {
            socket.emit('challengeError', { message: 'Invito non valido o scaduto.' });
            return;
        }

        // Solo il destinatario originale puo rispondere all'invito.
        if (socket.userId !== invite.friendId) {
            socket.emit('challengeError', { message: 'Non puoi rispondere a questo invito.' });
            return;
        }

        clearTimeout(invite.timeoutId);
        pendingFriendInvites.delete(inviteId);

        const challengerSocket = getSocketByUserId(invite.challengerId);
        if (!challengerSocket) {
            socket.emit('challengeError', { message: 'Lo sfidante non e piu online.' });
            return;
        }

        if (!accepted) {
            challengerSocket.emit('challengeDeclined', {
                inviteId,
                by: { id: socket.userId, nickname: socket.nickname }
            });
            socket.emit('challengeRejected', { inviteId });
            return;
        }

        const roomCode = `FRIEND_${Math.random().toString(36).substring(2, 9)}`;

        // ========================================
        // CREAZIONE PARTITA NEL DATABASE
        // ========================================
        try {
            const { data: partitaData, error: partitaError } = await supabase
                .from('partita')
                .insert([{
                    modalita: 'multiplayer',
                    stato: 'in_corso',
                    data_inizio: new Date().toISOString(),
                    id_utente_casa: challengerSocket.userId,
                    id_utente_trasferta: socket.userId
                }])
                .select()
                .single();

            if (partitaError) throw partitaError;

            const idPartita = partitaData.id_partita;

            // Inserisci i due giocatori nella partecipazione
            const { error: partecError } = await supabase
                .from('partecipazione')
                .insert([
                    {
                        id_partita: idPartita,
                        id_giocatore: challengerSocket.userId,
                        risultato: null,
                        exp_guadagnata: 0
                    },
                    {
                        id_partita: idPartita,
                        id_giocatore: socket.userId,
                        risultato: null,
                        exp_guadagnata: 0
                    }
                ]);

            if (partecError) throw partecError;

            challengerSocket.join(roomCode);
            socket.join(roomCode);

            const matchData = {
                roomCode,
                partita_id: idPartita,  // ← Salva l'ID della partita nel match
                players: [
                    {
                        id: challengerSocket.userId,
                        nickname: challengerSocket.nickname,
                        avatar_url: challengerSocket.avatar_url,
                        livello: challengerSocket.livello,
                        trophies: challengerSocket.trophies
                    },
                    {
                        id: socket.userId,
                        nickname: socket.nickname,
                        avatar_url: socket.avatar_url,
                        livello: socket.livello,
                        trophies: socket.trophies
                    }
                ],
                unranked: true,
                answers: {},
                started: false  // ← Ancora non iniziato
            };

            activeMatches.set(roomCode, matchData);
            io.to(roomCode).emit('matchFound', {
                ...matchData,
                partita_id: idPartita  // ← Emetti l'ID della partita ai client
            });

            console.log(`[Match] Partita ${idPartita} creata per amici: ${challengerSocket.nickname} vs ${socket.nickname}, roomCode=${roomCode}`);
        } catch (err) {
            console.error("[Match] Errore creazione partita:", err.message);
            socket.emit('challengeError', { message: 'Errore nella creazione della partita.' });
            challengerSocket.emit('challengeError', { message: 'Errore nella creazione della partita.' });
        }
    });

    // ========================================
    // DISCONNECT
    // ========================================
    // Se un giocatore si disconnette DURANTE una partita (dopo l'inizio),
    // la partita viene sospesa per 120 secondi. Se ritorna entro quel tempo,
    // la partita riprende. Altrimenti il timeout scade e la partita continua senza di lui
    // (l'altro giocatore vincerà automaticamente al prossimo round).
    socket.on('disconnect', () => {
        const idx = matchmakingQueue.findIndex(s => s.id === socket.id);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);

        // Ripulisci eventuali inviti pendenti che coinvolgono l'utente disconnesso.
        for (const [inviteId, invite] of pendingFriendInvites.entries()) {
            if (invite.challengerId === socket.userId || invite.friendId === socket.userId) {
                clearTimeout(invite.timeoutId);
                pendingFriendInvites.delete(inviteId);

                const otherUserId = invite.challengerId === socket.userId ? invite.friendId : invite.challengerId;
                const otherSocket = getSocketByUserId(otherUserId);
                if (otherSocket) {
                    otherSocket.emit('challengeExpired', { inviteId });
                }
            }
        }

        // Pulizia stanze private se l'host si disconnette
        for (const [code, room] of privateRooms.entries()) {
            if (room.host.id === socket.userId) {
                privateRooms.delete(code);
            }
        }

        io.emit('statsUpdate', { onlinePlayers: io.engine.clientsCount });
        console.log(`[Socket] Utente disconnesso: ${socket.nickname} (Motivo: ${socket.handshake.headers['user-agent'] || 'N/A'})`);

        // Se l'utente era in una partita attiva E il match è già iniziato, sospendi la partita (graceful disconnect)
        for (const [roomCode, match] of activeMatches.entries()) {
            if (match.players.some(p => p.id === socket.userId)) {
                // IMPORTANTE: Solo sospendere se il match è già iniziato (è stato emesso startRound)
                if (!match.started) {
                    console.log(`[Match] Giocatore ${socket.nickname} disconnesso da ${roomCode} PRIMA dell'inizio - NESSUNA sospensione`);
                    continue;  // Salta questo match, non fare sospensione
                }

                console.log(`[Match] Giocatore ${socket.nickname} disconnesso dalla partita ${roomCode} - Sospensione per 120s`);

                // Verifica se c'è già un timeout di sospensione attivo per questa room
                const existingSuspension = disconnectedMatches.get(roomCode);
                if (existingSuspension?.suspensionTimeout) {
                    // C'è già un timeout, non crearne uno nuovo
                    console.log(`[Match] Timeout già esistente per ${roomCode}, non creo uno nuovo`);
                    // Aggiorna solo il giocatore disconnesso
                    if (existingSuspension.disconnectedUserIds) {
                        existingSuspension.disconnectedUserIds.push(socket.userId);
                    } else {
                        existingSuspension.disconnectedUserIds = [socket.userId];
                    }
                } else {
                    // Primo disconnect in questa room, crea il timeout
                    const suspensionTimeout = setTimeout(() => {
                        console.log(`[Match] Timeout di sospensione raggiunto per ${roomCode} - Partita continua naturalmente`);
                        disconnectedMatches.delete(roomCode);
                    }, 120000); // 120 secondi (2 minuti)

                    disconnectedMatches.set(roomCode, {
                        partita_id: match.partita_id,
                        disconnectTime: Date.now(),
                        suspensionTimeout,
                        disconnectedUserIds: [socket.userId],
                        wasDisconnected: true
                    });
                }

                // Informa l'altro giocatore della disconnessione
                const otherPlayerId = match.players.find(p => p.id !== socket.userId)?.id;
                const otherSocket = getSocketByUserId(otherPlayerId);
                if (otherSocket) {
                    otherSocket.emit('opponentDisconnected', {
                        roomCode,
                        playerName: socket.nickname,
                        resumeTime: 120000  // 120 secondi
                    });
                }
            }
        }
    });

    // ========================================
    // REJOIN MANUALE
    // ========================================
    // Evento emesso dal client quando torna intenzionalmente in una partita sospesa.
    // Differisce dall'auto-rejoin perché viene triggerato esplicitamente dal frontend.
    socket.on('rejoinMatch', async ({ roomCode }) => {
        const match = activeMatches.get(roomCode);
        const suspended = disconnectedMatches.get(roomCode);

        if (!match || !suspended) {
            socket.emit('rejoinFailed', { message: 'Partita non trovata o timeout scaduto.' });
            return;
        }

        // Verifica che il giocatore sia uno di quelli disconnessi
        if (!suspended.disconnectedUserIds || !suspended.disconnectedUserIds.includes(socket.userId)) {
            socket.emit('rejoinFailed', { message: 'Non sei il giocatore disconnesso di questa partita.' });
            return;
        }

        // Cancella il timeout di sospensione (solo se questo è l'ultimo giocatore che ritorna)
        const stillDisconnected = suspended.disconnectedUserIds.filter(id => id !== socket.userId);
        if (stillDisconnected.length === 0) {
            clearTimeout(suspended.suspensionTimeout);
            disconnectedMatches.delete(roomCode);
            console.log(`[Match] Tutti i giocatori sono ritornati per ${roomCode}, sospensione cancellata`);
        } else {
            // Aggiorna l'array dei disconnessi
            suspended.disconnectedUserIds = stillDisconnected;
            console.log(`[Match] Giocatore ritornato, ancora disconnessi: ${stillDisconnected.length}`);
        }

        // Aggiungi il socket alla room
        socket.join(roomCode);

        // Comunica il rejoin agli altri giocatori
        io.to(roomCode).emit('opponentRejoined', {
            playerName: socket.nickname,
            roomCode
        });

        // Informa il client che è rientrato
        socket.emit('rejoinSuccess', {
            match: {
                players: match.players,
                currentRound: match.currentRound,
                currentSnippet: match.currentSnippet
            }
        });

        console.log(`[Match] Giocatore ${socket.nickname} è ritornato nella partita ${roomCode}`);
    });
});

// ==========================================
// ROTTA 404 (deve stare sempre per ultima)
// ==========================================

// Intercetta qualsiasi rotta non definita sopra e risponde con un errore 404
app.use((req, res) => {
    res.status(404).json({ errore: `Rotta '${req.path}' non trovata.` });
});

// ==========================================
// AVVIO SERVER
// ==========================================
server.listen(PORT, HOST, () => {
    console.log(`Server in esecuzione su ${BASE_URL}`);
});