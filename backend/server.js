require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");

const app = express();

// ==========================================
// CONFIGURAZIONE AMBIENTE
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

// ==========================================
// INIZIALIZZAZIONE OPENROUTER (lazy ESM import)
// ==========================================
// @openrouter/sdk è un modulo ESM-only: viene importato dinamicamente
// al primo utilizzo e poi riutilizzato tramite questa variabile.
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
app.get('/api/amici/:id', async (req, res) => {
    const mioId = req.params.id;

    try {
        // 1. Troviamo TUTTE le relazioni dove compaio io (sia come A che come B)
        const { data: relazioni, error: relError } = await supabase
            .from('amicizia')
            .select('id_utente_a, id_utente_b, stato')
            .or(`id_utente_a.eq.${mioId},id_utente_b.eq.${mioId}`);

        if (relError) throw relError;

        // Se l'utente non ha nessun amico e nessuna richiesta, mandiamo le liste vuote
        if (!relazioni || relazioni.length === 0) {
            return res.status(200).json({ amici: [], inviate: [], ricevute: [] });
        }

        // 2. Estraiamo gli ID delle altre persone
        const idAltriUtenti = relazioni.map(riga =>
            riga.id_utente_a === mioId ? riga.id_utente_b : riga.id_utente_a
        );

        // 3. Recuperiamo i nickname in un'unica query
        const { data: profili, error: profiliError } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname')
            .in('id_giocatore', idAltriUtenti);

        if (profiliError) throw profiliError;

        // Dizionario id -> nickname per lookup veloce
        const mappaProfili = {};
        profili.forEach(p => { mappaProfili[p.id_giocatore] = p.nickname; });

        // 4. Smistamento nelle tre categorie
        const risultato = { amici: [], inviate: [], ricevute: [] };

        relazioni.forEach(riga => {
            const sonoIoIlMittente = (riga.id_utente_a === mioId);
            const idAltro = sonoIoIlMittente ? riga.id_utente_b : riga.id_utente_a;
            const utente = {
                userid: idAltro,
                user: mappaProfili[idAltro] || "Utente Sconosciuto"
            };

            if (riga.stato === 'accettata') {
                risultato.amici.push(utente);
            } else if (riga.stato === 'in_attesa') {
                if (sonoIoIlMittente) {
                    risultato.inviate.push(utente);
                } else {
                    risultato.ricevute.push(utente);
                }
            }
        });

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
            .from('giocatore')
            .select('nickname, livello, exp')
            .eq('id_giocatore', idDaCercare)
            .single();

        if (error) throw error;

        res.status(200).json({
            userid: idDaCercare,
            user: data.nickname,
            livello: data.livello,
            exp: data.exp
        });

    } catch (err) {
        console.error("Errore recupero profilo:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare il profilo' });
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
        token: data.session.access_token  // Utile per future richieste autenticate
    });
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

    const prompt = `Sei un valutatore per un gioco chiamato CodeGuessr, in cui i giocatori devono indovinare il linguaggio di programmazione di un frammento di codice.

Analizza il seguente frammento di codice e determina il linguaggio di programmazione corretto:

\`\`\`
${snippet}
\`\`\`

La risposta del giocatore è: "${risposta}"

Assegna un punteggio da 0 a 100 in base alla correttezza della risposta:
- 100: risposta identica o sinonimo perfetto del linguaggio corretto (es. "JS" per "JavaScript")
- 70-99: risposta molto vicina ma con piccole imprecisioni (es. "TypeScript" per "JavaScript")
- 30-69: risposta parzialmente corretta (es. "C" per "C++")
- 1-29: risposta lontana ma nello stesso ecosistema
- 0: risposta completamente sbagliata o non pertinente

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido nel seguente formato, senza testo aggiuntivo:
{"punteggio": <numero>, "linguaggio": "<nome del linguaggio corretto>"}`;

    try {
        const client = await getOpenRouter();

        const completion = await client.chat.send({
            chatRequest: {
                model: 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            }
        });

        // Il campo della risposta dipende dalla versione dell'SDK:
        // può essere completion.chatCompletion o direttamente completion
        const chatResult = completion.chatCompletion ?? completion;
        const rawOutput = chatResult.choices[0].message.content.trim();

        let punteggio, linguaggio;
        try {
            const parsed = JSON.parse(rawOutput);
            punteggio  = Math.min(100, Math.max(0, parseInt(parsed.punteggio, 10)));
            linguaggio = parsed.linguaggio || null;
        } catch (parseErr) {
            console.error('[OpenRouter] Output non parsabile come JSON:', rawOutput);
            return res.status(500).json({ errore: 'Risposta non valida da OpenRouter.' });
        }

        if (isNaN(punteggio)) {
            console.error('[OpenRouter] Punteggio non numerico nel JSON:', rawOutput);
            return res.status(500).json({ errore: 'Punteggio non valido da OpenRouter.' });
        }

        res.status(200).json({ punteggio, linguaggio });

    } catch (err) {
        console.error('[OpenRouter] Errore valutazione risposta:', err.message);
        res.status(500).json({ errore: 'Errore durante la valutazione con OpenRouter.' });
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