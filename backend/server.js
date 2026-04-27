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

// Usiamo DELETE perché stiamo eliminando una riga esistente
app.delete('/api/rifiuta-richiesta/:id', verificaToken, async (req, res) => {
  // Stessa logica di ruoli:
  // 1. Tu (mioId) sei la persona che RIFIUTA, quindi nel DB sei "id_utente_b" (il destinatario).
  const mioId = req.utenteId;
  // 2. L'ID nell'URL è la persona che te l'aveva INVIATA, quindi nel DB è "id_utente_a" (il mittente).
  const mittenteId = req.params.id;

  if (!mittenteId) {
    return res.status(400).json({ errore: 'Devi specificare la richiesta di chi vuoi rifiutare.' });
  }

  try {
    // Chiediamo a Supabase di eliminare la riga specifica
    const { data, error } = await supabase
      .from('amicizia')
      .delete()
      .eq('id_utente_a', mittenteId) // Il mittente è lui...
      .eq('id_utente_b', mioId)      // ...il destinatario sei tu...
      .eq('stato', 'in_attesa')      // ...e lo stato attuale deve essere "in_attesa"
      .select(); // Ci fa restituire la riga eliminata, così sappiamo se esisteva

    if (error) {
      throw error;
    }

    // Se data è vuoto, non c'era nessuna richiesta "in_attesa" da eliminare
    if (data.length === 0) {
      return res.status(404).json({ errore: 'Nessuna richiesta in attesa trovata da questo utente.' });
    }

    // Tutto perfetto!
    res.status(200).json({ messaggio: 'Richiesta rifiutata e rimossa con successo.' });

  } catch (err) {
    console.error("Errore nel rifiutare la richiesta:", err);
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
            .select('id_giocatore, nickname')
            .in('id_giocatore', idAltriUtenti);

        if (profiliError) throw profiliError;

        const mappaProfili = {};
        for (const p of profili) {
            mappaProfili[p.id_giocatore] = p.nickname;
        }

        const risultato = { amici: [], inviate: [], ricevute: [] };

        for (const riga of relazioni) {
            const sonoIoIlMittente = riga.id_utente_a === mioId;
            const idAltro = sonoIoIlMittente ? riga.id_utente_b : riga.id_utente_a;
            const nickname = mappaProfili[idAltro] || "Utente Sconosciuto";
            const utente = { userid: idAltro, user: nickname };

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


app.get('/api/search/:nome', async (req, res) => {
    // Nota: ho chiamato il parametro "nome" invece di "id" per maggiore chiarezza
    const testoRicerca = req.params.nome;

    try {
        const { data, error } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname, livello, exp') // Prendi i campi che ti servono
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
  { q: 'leetcode solutions language:python',    ext: 'py'   },
  { q: 'leetcode problems language:java',      ext: 'java' },
  { q: 'leetcode algorithm language:cpp',       ext: 'cpp'  },
  { q: 'leetcode daily challenge language:js',  ext: 'js'   },
  { q: 'leetcode two sum language:python',     ext: 'py'   },
  { q: 'leetcode linked list language:java',   ext: 'java' },
  { q: 'leetcode binary tree language:cpp',    ext: 'cpp'  },
  { q: 'leetcode dynamic programming language:py', ext: 'py' },
  { q: 'leetcode reverse string language:js',  ext: 'js'   },
  { q: 'leetcode merge sorted language:cpp',   ext: 'cpp'  },
  { q: 'leetcode valid parentheses language:java', ext: 'java' },
  { q: 'leetcode top interview questions language:py', ext: 'py' },
  { q: 'leetcode blind 75 language:js',        ext: 'js'   },
  { q: 'leetcode hash map language:cpp',       ext: 'cpp'  },
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