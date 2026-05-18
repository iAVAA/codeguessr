# Architettura Tecnica e Specifiche di Sistema - CodeGuessr

Benvenuto nel documento di specifica architetturale di **CodeGuessr**. Questo documento è stato redatto per fornire una panoramica tecnica esaustiva e rigorosa sull'architettura complessiva del sistema, descrivendo la struttura del database, le logiche del frontend, la gestione real-time del backend ed i flussi operativi dell'intelligenza artificiale.

---

## 1. Modello Architetturale Generale

**CodeGuessr** adotta un modello architetturale **Client-Server distribuito e bi-direzionale in tempo reale**, che combina la stabilità dei servizi REST classici alla reattività delle connessioni WebSocket persistenti. 

Il sistema è suddiviso in tre macro-livelli fondamentali:
1. **Frontend (Presentation Layer):** Un'applicazione web multi-pagina basata su tecnologie vanilla (HTML5, CSS3, JavaScript ES6) per massimizzare la velocità di caricamento, l'accessibilità e la compatibilità. Integra l'SDK client-side di **Supabase** per l'autenticazione diretta e **Monaco Editor** per la visualizzazione interattiva dei frammenti di codice.
2. **Backend (Application Layer):** Un server runtime in **Node.js** con il framework **Express.js** per l'esposizione delle API REST e **Socket.io** per la gestione dello stato in memoria e la comunicazione bidirezionale in tempo reale. Agisce anche da proxy sicuro verso servizi esterni come **OpenRouter SDK** (per l'intelligenza artificiale) e le **GitHub Code Search API**.
3. **Database (Data Layer):** Un'istanza **PostgreSQL** relazionale ospitata su **Supabase**, arricchita con tipi ENUM, viste aggregate dinamiche, vincoli di integrità referenziale complessi e trigger di sistema scritti in PL/pgSQL (per automatizzare le regole di business sensibili come i Level Up).

```
                      +-------------------+
                      |   Browser Client  |
                      | (HTML/CSS/JS/SDK) |
                      +---------+---------+
                                |
             +------------------+------------------+
    HTTPS    |                                     | WebSockets
  (REST APIs)|                                     | (Socket.io)
             v                                     v
   +---------+---------+                 +---------+---------+
   |   Express Router  |                 |  Socket.io Server |
   | (HTTP Controllers)|                 |  (Match State Mc) |
   +---------+---------+                 +---------+---------+
             |                                     |
             +------------------+------------------+
                                |
                                v
                      +---------+---------+
                      |   Node.js Server  |
                      |  (Admin Supabase) |
                      +----+---------+----+
                           |         |
      Supabase PostgreSQL  |         | HTTPS (OpenRouter API / GitHub API)
  +------------------------v---+     |
  |  - Tabelle Relazionali     |     +-----> [ OpenAI gpt-4o-mini ]
  |  - Vista Profilo Dinamica  |     |
  |  - Level-Up Trigger system |     +-----> [ GitHub Search Engine ]
  +----------------------------+
```

---

## 2. Architettura del Database (Data Layer)

La persistenza dei dati è gestita tramite PostgreSQL. Il database implementa un forte accoppiamento referenziale e logiche automatiche sul database per prevenire incongruenze e manipolazioni dei client.

Il diagramma delle entità-relazioni (ER) completo è disponibile al seguente link:
👉 **[Schema Grafico ER (SVG)](db_scheme.svg)**

### Tipi ENUM Personalizzati
Per garantire il massimo rigore nei vincoli sui dati, sono stati definiti i seguenti domini ENUM:
* `stato_amicizia`: `('in_attesa', 'accettata', 'rifiutata', 'bloccato')`
* `modalita_partita`: `('1v1', 'ranked', 'amichevole', 'single_player')`
* `stato_partita`: `('in_corso', 'completata', 'annullata', 'waiting', 'in_progress', 'cancelled')`
* `risultato_partecipazione`: `('vittoria', 'sconfitta', 'pareggio')`

### Dettaglio Tabelle

#### 1. `giocatore`
Estende la tabella nativa dell'autenticazione di Supabase (`auth.users`) tramite una chiave esterna `1:1`. Memorizza il profilo pubblico e le statistiche del giocatore.
* `id_giocatore` (UUID, Primary Key, Foreign Key -> `auth.users(id)` ON DELETE CASCADE)
* `nickname` (TEXT, UNIQUE, NOT NULL)
* `exp` (INTEGER, Default: 0) - Punti Esperienza accumulati all'interno del livello attuale.
* `livello` (INTEGER, Default: 1) - Livello di gioco del programmatore.
* `trophies` (INTEGER, Default: 0) - Punteggio ranked cumulativo (coppe).
* `bio` (TEXT, Default: '')
* `avatar_url`, `banner_url` (TEXT) - Link alle immagini del profilo ospitate su Storage.
* `data_registrazione` (TIMESTAMPTZ, Default: `now()`)
* `attivo` (BOOLEAN, Default: false)

#### 2. `amicizia`
Rappresenta una relazione molti-a-molti ricorsiva auto-referenziata per la gestione del network sociale dei giocatori.
* `id_utente_a` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `id_utente_b` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `stato` (stato_amicizia, Default: `'in_attesa'`)
* `data_creazione` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### 3. `partita`
Memorizza le sessioni di gioco avviate.
* `id_partita` (BIGINT, Primary Key, Generated Always As Identity)
* `modalita` (modalita_partita, NOT NULL)
* `stato` (stato_partita, Default: `'in_corso'`)
* `data_inizio` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
* `data_fine` (TIMESTAMPTZ, Nullable)
* `id_utente_casa` (UUID, FK -> `giocatore(id_giocatore)` ON DELETE SET NULL)
* `id_utente_trasferta` (UUID, FK -> `giocatore(id_giocatore)` ON DELETE SET NULL)

#### 4. `partecipazione`
Tabella di giunzione molti-a-molti che traccia le performance e le ricompense individuali di ogni giocatore all'interno di una partita.
* `id_partita` (BIGINT, PK, FK -> `partita(id_partita)` ON DELETE CASCADE)
* `id_giocatore` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `risultato` (risultato_partecipazione, Nullable)
* `exp_guadagnata` (INTEGER, Default: 0)
* `trofei_cambiati` (INTEGER, Default: 0)

#### 5. `achievements`
Contiene la lista predefinita dei traguardi/missioni sbloccabili nel gioco.
* `id` (UUID, PK, Default: `gen_random_uuid()`)
* `name` (TEXT, UNIQUE, NOT NULL) - es. *'Dio dei Linguaggi'*, *'Notte Bianca'*.
* `description` (TEXT, NOT NULL)
* `exp_reward` (INTEGER, Default: 0)
* `trophy_reward` (INTEGER, Default: 0)
* `icon_url` (TEXT)
* `created_at` (TIMESTAMPTZ)

#### 6. `user_achievements`
Traccia quali obiettivi sono stati sbloccati dai singoli utenti ed in quale data.
* `user_id` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `achievement_id` (UUID, PK, FK -> `achievements(id)` ON DELETE CASCADE)
* `unlocked_at` (TIMESTAMPTZ, Default: `now()`)

### Logiche PostgreSQL in Background (Database Level)

#### Vista Dinamica del Profilo (`v_giocatore_profilo`)
Per massimizzare l'efficienza ed eliminare anomalie di ridondanza (dati statistici disallineati), le statistiche aggregate di vittorie, sconfitte e win-rate del profilo non vengono salvate fisicamente su disco. Vengono invece calcolate on-the-fly tramite una vista SQL che unisce in LEFT JOIN la tabella `giocatore` e `partecipazione`:
```sql
CREATE OR REPLACE VIEW public.v_giocatore_profilo AS
SELECT 
    g.id_giocatore, g.nickname, g.exp, g.livello, g.trophies, g.bio, g.avatar_url, g.banner_url, g.data_registrazione,
    COUNT(p.id_partita) AS partite_giocate,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria') AS partite_vinte,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'sconfitta') AS partite_perse,
    CASE 
        WHEN COUNT(p.id_partita) > 0 THEN 
            ROUND((COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria')::NUMERIC / COUNT(p.id_partita)::NUMERIC) * 100, 2)
        ELSE 0 
    END AS percentuale_vittorie
FROM public.giocatore g
LEFT JOIN public.partecipazione p ON g.id_giocatore = p.id_giocatore
GROUP BY g.id_giocatore;
```

#### Trigger Auto-Level UP (`trigger_level_up`)
Le regole di crescita del giocatore sono protette a livello di database. Ogni volta che l'esperienza (`exp`) di un utente viene inserita o aggiornata, viene eseguita la funzione trigger `handle_giocatore_level_up()`. Se l'esperienza supera la soglia di 500 XP, il giocatore sale di livello automaticamente ed il resto dell'esperienza viene riportato al livello successivo:
```sql
CREATE OR REPLACE FUNCTION handle_giocatore_level_up()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exp >= 500 THEN
        NEW.livello := NEW.livello + FLOOR(NEW.exp / 500);
        NEW.exp := NEW.exp % 500;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_level_up
BEFORE INSERT OR UPDATE OF exp ON public.giocatore
FOR EACH ROW EXECUTE FUNCTION handle_giocatore_level_up();
```

---

## 3. Architettura del Frontend (Client Layer)

Il client di CodeGuessr è strutturato per essere modulare e scalabile, mantenendo al contempo un'impostazione nativa ultra-rapida senza la zavorra di pesanti framework a runtime.

```
frontend/
├── index.html                  # Landing Page / Schermata Iniziale
└── src/
    ├── assets/                 # Risorse statiche (Immagini, SFX, BGM)
    ├── css/                    # Fogli di stile strutturati
    │   ├── style.css           # Compositore principale globale
    │   ├── styles/             # Fogli di stile atomici aggregati
    │   │   ├── _base.css, _navbar.css, _footer.css, _loader.css, _utilities.css,
    │   │   └── _variables.css  # Definizione palette HSL, spaziature e temi (Dark/Light)
    │   └── [pages]/            # CSS specifici per pagina (game, match, profile, etc.)
    ├── js/                     # Moduli logici Javascript
    │   ├── index.js            # Entry-point per la landing
    │   ├── utils/
    │   │   └── ui_utils.js     # Componenti UI condivisi (Toasts e debounce)
    │   ├── managers/           # Servizi globali a stato persistente (Singleton)
    │   │   ├── auth.js         # Gestore sessione, JWT, Login e Redirect automatici
    │   │   ├── loader.js       # Gestore delle transizioni visive e schermi di caricamento
    │   │   ├── settings.js     # Gestore impostazioni (Accessibilità, riduttore animazioni)
    │   │   ├── theme.js        # Gestore del tema dinamico (Sincronizzazione variabili HSL)
    │   │   └── sound.js        # Sistema audio (Buffer audio web, BGM in loop, SFX di feedback)
    │   └── [pages]/            # Script di controllo dedicati alle singole visualizzazioni
    └── pages/                  # Viste HTML (reset_password, game_page, profile_page, etc.)
```

### Gestione dei CSS Dinamici
La personalizzazione estetica ricorre alla potenza delle **CSS Variables** configurate all'interno di `_variables.css`. Questo permette di supportare nativamente la modalità Chiara/Scura tramite la classe globale `.light-theme` applicata al tag `body` e l'impostazione di accessibilità `.reduce-transitions` che azzera gli effetti di transizione per gli utenti sensibili.

---

## 4. Architettura del Backend (Server Layer)

Il server Node.js è strutturato secondo il pattern **Modular Controller-Service**. L'entry-point `server.js` inizializza le risorse core ed esegue il bootstrap di tre controller indipendenti.

### 1. `server.js` (Bootstrap & Core Services)
* Configura l'applicazione Express (CORS, parser JSON, cartelle statiche).
* Inizializza il client di amministrazione Supabase in modalità privilegiata (per bypassare le Row Level Security ed eseguire in sicurezza gli aggiornamenti di EXP, livelli e statistiche).
* Avvia il server HTTP nativo agganciando l'istanza globale di `Socket.io`.
* Esporta utility riutilizzabili come `updatePlayerStats` per centralizzare la memorizzazione dei risultati partita.

### 2. `controllers/code.js` (GitHub Search & Fallback)
Responsabile di fornire costantemente snippet di codice di alta qualità per alimentare il gioco.
* **Algoritmo di Fetching GitHub:** Esegue query avanzate e casuali sulle GitHub Search API (usando query target come algoritmi classici *Dijkstra, BST, QuickSort* o framework noti *React, Express, Tkinter, Pandas*).
* **Filtro di Pulizia:** Analizza la risposta, decodifica il Base64, pulisce il codice rimuovendo commenti iniziali di licenza, copyright o blocco vuoto (fino a un massimo di 30 righe) e taglia lo snippet a una lunghezza ottimale per la lettura del giocatore.
* **Fallback Locale:** Nel caso in cui il token di GitHub esaurisca il rate-limit o si presentino problemi di rete, carica in memoria dei database precompilati in JSON (`db/snippets/`) garantendo che il gioco continui a funzionare offline.
* **REST API:**
  * `GET /api/random-snippet`: Restituisce uno snippet pulito escludendo l'ultimo servito.
  * `POST /api/valuta-risposta`: Esegue la chiamata al LLM per valutare la spiegazione del giocatore.

### 3. `controllers/missions.js` (Dynamic Achievements Engine)
Consente una gestione liquida dei traguardi di gioco senza appesantire il database.
* **Calcolo Progressi Dinamici:** Quando interrogato, calcola in tempo reale lo stato di completamento delle missioni di un utente unendo i dati delle amicizie, lo storico partite (es. *consecutive wins*, partite giocate di notte tra le 00 e le 05 per sbloccare *"Notte Bianca"*), il livello e le statistiche del profilo.
* **Background Auto-Redeem:** Se rileva che una missione ha superato la soglia minima e non è ancora registrata come sbloccata nel DB, inserisce il record nella tabella `user_achievements` in background e aggiorna direttamente EXP e Trofei dell'utente (che a loro volta attivano il trigger PostgreSQL di Level Up).

### 4. `controllers/socket.js` (Real-Time Game State Machine)
Il cuore operativo di CodeGuessr. Gestisce la reattività del multiplayer competitivo e privato attraverso un protocollo WebSocket strutturato.

* **Middleware di Handshake:** Ogni connessione WebSocket viene intercettata, pulisce il token JWT fornito dal client, ne verifica l'autenticità tramite l'autenticazione Supabase e aggancia all'istanza del socket i dati del profilo del giocatore in tempo reale.
* **Gestione Disconnessioni Resilienti (Tolleranza 120s):** Se un utente cade a causa di instabilità di rete, il server **non** interrompe la partita immediatamente. La stanza viene messa in stato di "sospensione" per un tempo massimo di 120 secondi.
  * Se il giocatore si riconnette entro il termine via `rejoinMatch`, la sessione viene ripristinata esattamente dal round in corso sincronizzando lo snippet attuale.
  * Se il timeout spira senza riconnessioni, il giocatore offline viene dichiarato sconfitto per abbandono (HP azzerati) e l'altro utente vince l'incontro ricevendo i premi.
  * Le stanze di matchmaking e le sfide dirette scambiano gli stati mostrati nel diagramma seguente.

```
            +---------------------------------+
            |  Offline / Schermata Principale |
            +----------------+----------------+
                             |
                             | [startMatchmaking]
                             v
                    +----------------+
                    |  In Coda Match |
                    +--------+-------+
                             |
                             | [matchFound] (2 utenti pronti)
                             v
                    +----------------+
                    | Schermata Lobb | <-----------+ (Rejoin)
                    +--------+-------+             |
                             |                     |
                             | (Entrambi Ready)     |
                             v                     |
                    +----------------+             |
                    |   Inizio Round |             |
                    +--------+-------+             |
                             |                     |
                             | [startRound]        |
                             v                     |
                    +----------------+             |
                    | Timer di Gioco |             |
                    |    (Max 90s)   |             |
+-----------------> +--------+-------+             |
|                            |                     |
|                            | [submitAnswer]      |
|                            v                     |
|                   +----------------+             |
|                   | Valutazione AI |             |
|                   +--------+-------+             |
|                            |                     |
|                            | [roundResult]       |
|                            v                     |
|                   +----------------+             |
|                   |  Calcolo Danni |             |
|                   +---+--------+---+             |
|                       |        |                 |
|      (Qualcuno a 0 HP |        | (HP > 0 &       |
|    o Round 5 concluso)|        | Round < 5)      |
|                       |        |                 |
|                       v        +-----------------+
|             +---------+--------+
|             |  Partita Conclusa|
|             | [matchFinished]  |
|             +------------------+
|
+--- Se Disconnesso (Avvia Timer 120s) -> Se Rejoin success rientra nel flusso
```

---

## 5. Meccanismo di Valutazione delle Risposte tramite AI

Il meccanismo distintivo di CodeGuessr è la capacità di valutare la reale comprensione tecnica del codice scritta in linguaggio naturale dal giocatore.

### Flusso di Valutazione AI

```
[Client] invia risposta scritta
   │
   ▼
[Express Controller (POST /api/valuta-risposta)]
   │
   ▼
[Lettura Prompt Template (db/llm/prompt.md)]
   │
   ▼
[Sostituzione segnaposto {{snippet}} e {{risposta}}]
   │
   ▼
[Chiamata a OpenRouter API (modello: gpt-4o-mini)]
   │
   ▼
[Generazione output strutturato in JSON]
   │
   ▼
[Server esegue il parsing del punteggio] ──(Se errore)──> [Fallback: Valutatore standard]
   │
   ▼
[Restituisce il punteggio float (0-100) al modulo partita]
```

### Il Prompt di Sistema (`db/llm/prompt.md`)
Il prompt impone al modello linguistico un ruolo di **valutatore tecnico super-partes estremamente severo**. Il modello non deve solo verificare se la risposta menziona parole chiave, ma deve analizzare:
1. **Comprensione dello scopo principale:** Se il giocatore ha capito realmente l'algoritmo (es. *Dijkstra* vs un generico *ricerca del cammino minimo*).
2. **Precisione Matematica della Complessità:** Verifica l'accuratezza con cui viene determinata la notazione **Big O** (Tempo e Spazio).
3. **Correttezza delle Strutture Dati:** Spiegazione dell'uso di code di priorità, array, alberi, etc.

L'output viene strettamente forzato in un formato JSON strutturato contenente il punteggio (`punteggio`, numero da 0 a 100) e la motivazione dettagliata (`motivazione`):
```json
{
  "punteggio": 85
}
```

Questo punteggio viene utilizzato in modalità multiplayer come base di calcolo dei danni: la differenza assoluta tra i punteggi dei due avversari viene inflitta direttamente come danno agli HP di chi ha fornito la spiegazione meno accurata.

---

## 6. Sicurezza e Ottimizzazioni

1. **Protezione API Key:** Tutte le chiavi API sensibili (Supabase Service Key, GITHUB_TOKEN, OPENROUTER_API_KEY) sono conservate esclusivamente sul server backend nel file `.env` protetto, impedendone l'esposizione sul client.
2. **Prevenzione del Cheating:** La logica dei punti vita, la selezione degli snippet, la determinazione dei punteggi e l'incremento di esperienza/trofei sono interamente gestiti dal server backend. Il client invia solo l'input testuale dell'utente e riceve aggiornamenti di stato di sola lettura.
3. **Ottimizzazione del Traffico Socket:** Gli eventi di Socket.io scambiano oggetti JSON leggeri ed escludono tutti i riferimenti di memoria complessi (come i timer attivi o i riferimenti ai socket degli utenti) attraverso funzioni di sanitizzazione prima dell'invio.