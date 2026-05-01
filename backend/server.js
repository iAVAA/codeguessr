require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");
const cors = require('cors');

// non so se serve ma è meglio metterlo subito per evitare problemi di CORS con il frontend in sviluppo 
const app = express();
app.use(cors({
    origin: 'http://localhost:3000', // ← l'URL del tuo frontend
    allowedHeaders: ['Authorization', 'Content-Type'] // ← fondamentale
}));

// ==========================================
// CONFIGURAZIONE AMBIENTE
// ==========================================
// Mappa in-memory per tracciare lo stato online degli utenti
const activeUsers = new Map();
const HEARTBEAT_TIMEOUT = 20000; // 20 secondi prima di considerare offline

// ==========================================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, '..', 'frontend');
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ==========================================
// INIZIALIZZAZIONE SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = { supabase }; // ← aggiungi questa riga


// ==========================================
// INIZIALIZZAZIONE OPENROUTER (lazy ESM import)
// ==========================================
// @openrouter/sdk è un modulo ESM-only: viene importato dinamicamente
// al primo utilizzo e poi riutilizzato tramite questa variabile.
const verificaToken = require('./auth');

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
 */

/**
 * @typedef {Object} Partita
    * @description Tabella che registra le sessioni di gioco.
    * @property {number} id_partita - (Int8) Primary Key. Identificativo univoco della partita.
    * @property {string} modalita - (Enum: modalita_partita) La modalità di gioco scelta per la sessione.
    * @property {string} stato - (Enum: stato_partita) Lo stato corrente della partita (es. in corso, terminata).
    * @property {string} data_inizio - (Timestamptz) Orario di avvio della partita.
    * @property {string} data_fine - (Timestamptz) Orario di conclusione della partita.
 */

/**
 * @typedef {Object} Amicizia
    * @description Tabella per la gestione delle relazioni sociali e richieste di amicizia tra giocatori.
    * @property {string} id_utente_a - (UUID) Composite Primary Key / Foreign Key -> `giocatore.id_giocatore`.
    * @property {string} id_utente_b - (UUID) Composite Primary Key / Foreign Key -> `giocatore.id_giocatore`.
    * @property {string} stato - (Enum: stato_amicizia) Lo stato della relazione (es. in_attesa, accettata, rifiutata).
    * @property {string} data_creazione - (Timestamptz) Data di invio della richiesta di amicizia.
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
// MIDDLEWARE (ordine corretto: parsing prima di static)
// ==========================================
app.use(express.json());
app.use(express.static(ROOT));

// ==========================================
// ROTTE DI NAVIGAZIONE (GET)
// ==========================================
// Pagina principale (index)
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html'));
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

// Pagina di partita
app.get('/match', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'match_page.html'));
});

// Rotta per servire la pagina del profilo di qualsiasi utente
app.get('/profilo/:username', (req, res) => {
    // Invia il file HTML del profilo. 
    // ATTENZIONE: adatta il percorso 'public/profile.html' alla tua vera cartella!
    res.sendFile(path.join(ROOT, 'src', 'pages', 'profile_page.html'));
});

app.get('/api/profilo/nickname/:username', verificaToken, async (req, res) => {
    const nicknameCercato = req.params.username;

    try {
        const { data: profilo, error } = await supabase
            .from('giocatore')
            .select('id_giocatore') // Aggiungi qui gli altri campi che ti servono
            .eq('nickname', nicknameCercato)
            .single(); // Ne aspettiamo solo uno

        if (error || !profilo) {
            return res.status(404).json({ errore: 'Profilo non trovato' });
        }

        // Lo formattiamo per il frontend
        res.status(200).json({
            userid: profilo.id_giocatore,
            user: profilo.nickname,
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
app.post('/api/salva-partita', verificaToken, async (req, res) => {
    const mioId = req.utenteId;
    const { modalita, risultato, exp_guadagnata, id_utente_trasferta } = req.body;

    // Validazione campi obbligatori
    if (!modalita || !risultato) {
        return res.status(400).json({ errore: 'modalita e risultato sono obbligatori.' });
    }

    const expGain = Math.max(0, parseInt(exp_guadagnata, 10) || 0);
    const isMultiplayer = modalita === 'multiplayer' && id_utente_trasferta;

    try {
        // 1. Creiamo la riga nella tabella partita
        const partitaInsert = {
            modalita,
            stato: 'terminata',
            data_fine: new Date().toISOString(),
            id_utente_casa: mioId
        };
        if (isMultiplayer) {
            partitaInsert.id_utente_trasferta = id_utente_trasferta;
        }

        const { data: partitaData, error: partitaError } = await supabase
            .from('partita')
            .insert([partitaInsert])
            .select()
            .single();

        if (partitaError) throw partitaError;

        const idPartita = partitaData.id_partita;

        // 2. Creiamo le righe in partecipazione
        const partecipazioni = [{
            id_partita: idPartita,
            id_giocatore: mioId,
            risultato,
            exp_guadagnata: expGain
        }];

        if (isMultiplayer) {
            // Logica inversa per l'avversario
            let risultatoAvversario = 'pareggio';
            if (risultato === 'vittoria') risultatoAvversario = 'sconfitta';
            else if (risultato === 'sconfitta') risultatoAvversario = 'vittoria';

            partecipazioni.push({
                id_partita: idPartita,
                id_giocatore: id_utente_trasferta,
                risultato: risultatoAvversario,
                exp_guadagnata: risultatoAvversario === 'vittoria' ? 25 : 5 // Esempio fisso per avversario
            });
        }

        const { error: partecError } = await supabase
            .from('partecipazione')
            .insert(partecipazioni);

        if (partecError) throw partecError;

        // Funzione helper per aggiornare un giocatore
        async function updatePlayerStats(playerId, result, addedExp, awardTrophies = false) {
            const { data: prof, error: readErr } = await supabase
                .from('giocatore')
                .select('exp, livello, trophies')
                .eq('id_giocatore', playerId)
                .single();

            if (readErr) return null;

            const EXP_PER_LEVEL = 1000;
            const nuovaExp = (prof.exp || 0) + addedExp;
            const nuovoLivello = Math.floor(nuovaExp / EXP_PER_LEVEL) + 1;
            
            let trophyChange = 0;
            if (awardTrophies) {
                if (result === 'vittoria') trophyChange = 25;
                else if (result === 'sconfitta') trophyChange = -15;
            }
            
            const nuoviTrofei = Math.max(0, (prof.trophies || 0) + trophyChange);

            await supabase
                .from('giocatore')
                .update({ exp: nuovaExp, livello: nuovoLivello, trophies: nuoviTrofei })
                .eq('id_giocatore', playerId);

            return { nuovaExp, nuovoLivello, nuoviTrofei };
        }

        // 3. Aggiorniamo le statistiche del/dei giocatore/i
        const statsCasa = await updatePlayerStats(mioId, risultato, expGain, isMultiplayer);
        if (isMultiplayer) {
            const risultatoAvversario = risultato === 'vittoria' ? 'sconfitta' : (risultato === 'sconfitta' ? 'vittoria' : 'pareggio');
            await updatePlayerStats(id_utente_trasferta, risultatoAvversario, risultatoAvversario === 'vittoria' ? 25 : 5, true);
        }

        res.status(201).json({
            messaggio: 'Partita salvata con successo!',
            id_partita: idPartita,
            nuova_exp: statsCasa?.nuovaExp || 0,
            nuovo_livello: statsCasa?.nuovoLivello || 1,
            nuovi_trofei: statsCasa?.nuoviTrofei || 0
        });

    } catch (err) {
        console.error("Errore salvataggio partita:", err.message);
        res.status(500).json({ errore: 'Impossibile salvare la partita.' });
    }
});


app.get('/api/search/:nome', async (req, res) => {
    // Nota: ho chiamato il parametro "nome" invece di "id" per maggiore chiarezza
    const testoRicerca = req.params.nome;

    try {
        const { data, error } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname, livello, exp, avatar_url') // Prendi i campi che ti servono
            .ilike('nickname', `${testoRicerca}%`) // Cerca i nickname che INIZIANO con il testo cercato
            .limit(10); // Consiglio: metti un limite per non scaricare troppi dati se l'utente digita solo "A"

        if (error) throw error;

        // Formattiamo i dati in modo che il frontend (la funzione buildResultItem) li legga correttamente

        const risultati = []; // Inizializziamo un array vuoto prima del ciclo

        // Scorriamo tutto l'array 'data' restituito dal database
        for (let i = 0; i < data.length; i++) {
            const gioc = data[i]; // Prendiamo il singolo giocatore dell'iterazione corrente

            // Creiamo un nuovo oggetto formattato per il frontend
            const giocatoreFormattato = {
                userid: gioc.id_giocatore,          // Utilizziamo l'ID del giocatore
                user: gioc.nickname,
                avatar_url: gioc.avatar_url,
                avatarSeed: gioc.nickname,    // Genera l'avatar in base al nickname
                livello: gioc.livello         // Dati extra se ti servono in futuro
            };

            // Aggiungiamo l'oggetto appena creato all'array dei risultati
            risultati.push(giocatoreFormattato);
        }

        // Restituiamo un array (JSON)
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

    // Validazione campi obbligatori
    if (!email || !password || !nickname) {
        return res.status(400).json({ errore: 'Email, password e nickname sono obbligatori.' });
    }

    try {
        // Passo 1: Registrazione autenticazione su Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        const nuovoIdGiocatore = authData.user.id;

        // Passo 2: Creazione profilo nella tabella giocatore
        const { error: dbError } = await supabase
            .from('giocatore')
            .insert([{
                id_giocatore: nuovoIdGiocatore,
                nickname: nickname
            }]);

        if (dbError) throw dbError;

        res.status(201).json({
            messaggio: 'Registrazione completata con successo!',
            user: nuovoIdGiocatore
        });

    } catch (errore) {
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
            redirectTo: `${BASE_URL}/login`  // Usa la variabile d'ambiente, sicuro anche in produzione
        });

        if (error) throw error;

        res.status(200).json({ messaggio: 'Email di reset inviata con successo!' });

    } catch (err) {
        console.error("Errore durante il reset della password:", err.message);
        res.status(400).json({ errore: "Impossibile inviare l'email di reset." });
    }
});

// ==========================================
// COSTANTI GITHUB (Spostate dal Frontend)
// ==========================================
const EXT_TO_MONACO = {
    js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    c: 'c', h: 'c', cs: 'csharp', go: 'go', rs: 'rust', kt: 'kotlin',
    swift: 'swift', php: 'php', lua: 'lua', r: 'r', scala: 'scala',
    sh: 'shell', bash: 'shell', sql: 'sql', html: 'html', css: 'css',
    json: 'json', yml: 'yaml', yaml: 'yaml', xml: 'xml', md: 'markdown'
};

// ==========================================
// COSTANTI GITHUB
// ==========================================
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
// ==========================================
// API GITHUB SNIPPET (GET)
// ==========================================
/**
 * GET /api/random-snippet
 * Cerca un file di codice casuale su GitHub e lo formatta per il frontend.
 */
app.get('/api/random-snippet', async (req, res) => {
    try {
        if (!process.env.GITHUB_TOKEN) {
            console.error("[Backend] ERRORE: GITHUB_TOKEN non trovato nel file .env!");
            return res.status(500).json({ errore: 'Configurazione server mancante' });
        }

        const queryObj = GITHUB_QUERIES[Math.floor(Math.random() * GITHUB_QUERIES.length)];
        const page = Math.floor(Math.random() * 3) + 1;

        const headers = {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'CodeGuessr-Server',
            'X-GitHub-Api-Version': '2022-11-28',
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
        };

        // 1. Estrai solo le parole chiave (es. "sort algorithm language:python" diventa "sort algorithm")
        const keywords = queryObj.q.split('language:')[0].trim();

        // 2. Ricerca GLOBALE direttamente nei file di codice (come nel tuo script Python)
        const codeSearchQuery = `${keywords} extension:${queryObj.ext}`;
        const codeSearchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(codeSearchQuery)}&per_page=30&page=${page}`;

        const codeRes = await fetch(codeSearchUrl, { headers });
        if (!codeRes.ok) throw new Error(`Code search failed: ${codeRes.status} - ${await codeRes.text()}`);

        const codeData = await codeRes.json();
        if (!codeData.items || codeData.items.length === 0) {
            throw new Error(`Nessun file trovato per la query: ${codeSearchQuery}`);
        }

        // 3. Prendi un file a caso dai risultati globali
        const file = codeData.items[Math.floor(Math.random() * codeData.items.length)];
        const repoFullName = file.repository.full_name; // L'API ci fornisce già il nome del repo qui

        // 4. Scarica il contenuto usando l'API ufficiale (Base64)
        const contentRes = await fetch(file.url, { headers });
        if (!contentRes.ok) throw new Error(`Content fetch failed: ${contentRes.status} - ${await contentRes.text()}`);
        const contentData = await contentRes.json();

        // 5. Decodifica il Base64 in testo leggibile
        let rawCode = Buffer.from(contentData.content, 'base64').toString('utf-8');

        // 6. Tronca a ~40 righe
        const lines = rawCode.split('\n');
        if (lines.length > 40) {
            const start = lines.findIndex(l => l.trim().length > 0);
            rawCode = lines.slice(start > -1 ? start : 0, (start > -1 ? start : 0) + 40).join('\n');
        }

        // 7. Determina il linguaggio per Monaco Editor
        const ext = file.name.split('.').pop().toLowerCase();
        const monacoLang = EXT_TO_MONACO[ext] || 'plaintext';

        res.status(200).json({
            code: rawCode,
            monacoLang,
            source: `${repoFullName} — ${file.path}`,
            fileUrl: file.html_url
        });

    } catch (error) {
        console.error("[Backend] Errore fetch snippet GitHub:", error.message);
        res.status(500).json({ errore: 'Impossibile recuperare lo snippet da GitHub' });
    }
});

// ==========================================
// DIPENDENZE (aggiungi in cima, dopo require esistenti)
// ==========================================
const multer = require('multer');

// multer in memory: il file arriva come Buffer, non viene salvato su disco
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Formato immagine non supportato. Usa JPEG, PNG, WEBP o GIF.'));
    }
});

// ==========================================
// API UPLOAD IMMAGINI PROFILO (POST)
// ==========================================

/**
 * POST /api/upload/avatar
 * POST /api/upload/banner
 * Riceve un'immagine via multipart/form-data, la carica su Supabase Storage
 * e restituisce la URL pubblica.
 *
 * Form field: "immagine" (file)
 * Richiede autenticazione (Bearer token).
 * Risposta: { url: string }
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
app.post('/api/valuta-risposta', async (req, res) => {
    const { snippet, risposta } = req.body;

    // Validazione campi obbligatori
    if (!snippet || !risposta) {
        return res.status(400).json({ errore: 'snippet e risposta sono obbligatori.' });
    }

    const prompt = `Sei un valutatore esperto per un gioco in cui i giocatori devono spiegare cosa fa un dato frammento di codice.
La domanda a cui il giocatore deve rispondere è: "Cosa fa questo codice?".

Analizza il seguente frammento di codice:

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

        // Il campo della risposta dipende dalla versione dell'SDK
        const chatResult = completion.chatCompletion ?? completion;
        let rawOutput = chatResult.choices[0].message.content.trim();

        // Pulizia preventiva: rimuove eventuali backtick markdown se l'LLM li inserisce per errore
        rawOutput = rawOutput.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

        let punteggio;
        try {
            const parsed = JSON.parse(rawOutput);
            punteggio = Math.min(100, Math.max(0, parseInt(parsed.punteggio, 10)));
        } catch (parseErr) {
            console.error('[OpenRouter] Output non parsabile come JSON:', rawOutput);
            return res.status(500).json({ errore: 'Risposta non valida da OpenRouter.' });
        }

        if (isNaN(punteggio)) {
            console.error('[OpenRouter] Punteggio non numerico nel JSON:', rawOutput);
            return res.status(500).json({ errore: 'Punteggio non valido elaborato dall\'AI.' });
        }

        res.status(200).json({ punteggio });

    } catch (err) {
        console.error('[OpenRouter] Errore valutazione risposta:', err.message);
        res.status(500).json({ errore: 'Errore durante la valutazione della risposta.' });
    }
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
app.listen(PORT, HOST, () => {
    console.log(`Server in esecuzione su ${BASE_URL}`);
});