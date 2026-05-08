## Sezioni Aggiuntive (Deployment, Sicurezza, CI, Monitoraggio)
### Deployment & Produzione
- Ambiente di produzione: esporre il server dietro un reverse-proxy (nginx) con TLS/HTTPS gestito tramite Let's Encrypt o certificati aziendali.
- Consigli container: preparare `Dockerfile` minimale e `docker-compose.yml` per sviluppo; usare immagini distinte per `backend` e per eventuali job worker (es. valutazione AI in background).
- Variabili d'ambiente sensibili (es. `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`) devono essere gestite dal sistema di secret del provider (Vault, AWS Secrets Manager, Azure Key Vault) e mai committate.
- Healthcheck HTTP (`/healthz`) e readiness probe per orchestratori.
### Sicurezza
- Validazione input su tutte le rotte API; evitare SQL injection e sanitizzare i campi testuali inviati all'LLM.
- Rate limiting sulle API pubbliche (es. `random-snippet`, `valuta-risposta`) per prevenire abusi.
- Proteggere gli endpoint di upload con controllo MIME, dimensione massima e scansione antivirus opzionale.
- Impostare CORS in maniera restrittiva (origini ufficiali) e usare `helmet` per header di sicurezza su Express.
- Limitare privilegi delle chiavi: usare `SERVICE_ROLE_KEY` solo lato backend e creare token con privilegi ridotti per task specifici.
### CI & Testing
- Aggiungere una pipeline CI (GitHub Actions / GitLab CI) che esegua linting JS, test unitari e controlli statici sulle modifiche.
- Scrivere test per le API critiche: autenticazione, creazione partita, salvataggio partita e valutazione risposta (mocking di OpenRouter).
- Eseguire test end-to-end (opzionale) per flussi multiplayer con due client simulati.
### Logging, Monitoraggio e Alerting
- Logging strutturato (JSON) con livelli (`info`, `warn`, `error`) e tracce correlate (`requestId`).
- Integrazione con Sentry (error reporting) e con un sistema di metriche (Prometheus + Grafana) per contatori: partite create, valutazioni AI, errori 5xx.
- Impostare alert per errori critici e per latenza elevata delle chiamate esterne (GitHub / OpenRouter / Supabase).
### Caching e Performance
- Caching dei `random-snippet` recenti in memoria o Redis per ridurre chiamate ripetute a GitHub.
- Timeout e retry con backoff esponenziale per chiamate esterne (OpenRouter, GitHub).
- Limitare la latenza dell'API `valuta-risposta` con job asincroni opzionali: accodare la valutazione e notificare il client quando pronta.
### Rate limiting & Abuse prevention
- Implementare rate limiting per IP e per utente (es. 60 richieste/min), con bucket/token bucket.
- Proteggere i websocket da flood di eventi e validare la dimensione dei payload.
### Configurazione .env (dettagliata)
- `SUPABASE_URL` — URL del progetto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — chiave admin (solo backend).
- `SUPABASE_ANON_KEY` — (se usata) chiave pubblica lato client.
- `OPENROUTER_API_KEY` — chiave per OpenRouter / LLM.
- `GITHUB_TOKEN` — token per GitHub Code Search API (scopes: repo/public_repo o search).
- `BASE_URL` — URL base dell'app (es. https://codeguessr.example.com).
- `PORT` — porta di ascolto del server.
- `SENTRY_DSN` — (opzionale) DSN per l'error tracking.
- `REDIS_URL` — (opzionale) URL Redis per cache e sincronizzazione.
### Dipendenze principali e script utili
- Backend `package.json` dovrebbe esporre almeno:
  - `start`: `node server.js`
  - `dev`: `nodemon server.js`
  - `lint`: `eslint .` (se configurato)
- Documentare le dipendenze critiche: `express`, `socket.io`, `@supabase/supabase-js`, `multer`, `node-fetch`/`undici`, `helmet`, `rate-limiter-flexible` (o simili).
### Contributi e sviluppo locale
- Aggiungere una sezione `CONTRIBUTING.md` con istruzioni per avviare ambiente locale:
  - come creare `.env` d'esempio
  - come avviare Supabase in locale o usare un progetto di sviluppo
  - come eseguire test e lint
### Note finali / TODO conosciuti
- Considerare l'estrazione della logica di valutazione AI in un worker separato per scalabilità.
- Valutare l'adozione di una coda (RabbitMQ / Redis Streams) per operazioni che possono essere eseguite asincronamente.
# CodeGuessr — Architettura e Flow del Progetto

## Indice
1. [Cos'è CodeGuessr](#cosè-codeguessr)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Struttura Cartelle](#struttura-cartelle)
4. [Database (Supabase)](#database-supabase)
5. [Backend — server.js](#backend--serverjs)
6. [Autenticazione](#autenticazione)
7. [Flow Singleplayer](#flow-singleplayer)
8. [Flow Multiplayer](#flow-multiplayer)
9. [Sistema Missioni](#sistema-missioni-achievement)
10. [Upload Immagini](#upload-immagini)
11. [Sistema Heartbeat (Online/Offline)](#sistema-heartbeat-onlineoffline)
12. [Frontend — Pagine e Script](#frontend--pagine-e-script)
13. [Sistema Audio (CG_Sound)](#sistema-audio-cg_sound)
14. [Sistema Impostazioni (settings.js)](#sistema-impostazioni-settingsjs)
15. [localStorage — Chiavi usate](#localstorage--chiavi-usate)
16. [Diagramma Riassuntivo](#diagramma-riassuntivo)

---

## Cos'è CodeGuessr

CodeGuessr è un gioco ispirato a GeoGuessr ma per sviluppatori.
Il gioco mostra un frammento di codice preso casualmente da GitHub e il giocatore deve **spiegare cosa fa** nel minor tempo possibile.
La risposta viene valutata da un **LLM (GPT-4o-mini via OpenRouter)** che assegna un punteggio da 0 a 100.

Modalità di gioco:
- **Singleplayer** — gioca da solo, accumula EXP.
- **Multiplayer (matchmaking)** — trova un avversario casuale online, ranked.
- **Stanza privata** — codice numerico a 5 cifre, due amici, ranked.
- **Sfida tra amici** — invita un amico dalla lista amici, unranked.

---

## Stack Tecnologico

| Layer | Tecnologia | Perché |
|---|---|---|
| **Runtime** | Node.js | Ambiente server-side JavaScript |
| **Framework HTTP** | Express 5 | Routing REST e serving file statici |
| **WebSocket** | Socket.io 4 | Comunicazione real-time per il multiplayer |
| **Database** | Supabase (PostgreSQL) | DB relazionale + Auth + Storage immagini |
| **AI Valutazione** | OpenRouter → GPT-4o-mini | Valuta le risposte in linguaggio naturale |
| **Snippet** | GitHub Code Search API | Fonte dei frammenti di codice casuali |
| **Upload** | Multer (memory storage) | Gestione upload immagini profilo/banner |
| **Auth** | JWT Supabase | Token Bearer per le API protette |
| **Dev tool** | Nodemon | Riavvio automatico in sviluppo |
| **Frontend** | HTML + CSS + JS vanilla | Nessun framework, Monaco Editor per il codice |

### Variabili d'ambiente richieste (`.env`)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # Bypass RLS, solo backend
OPENROUTER_API_KEY=...
GITHUB_TOKEN=...
BASE_URL=http://localhost:3000
PORT=3000
```

> La `SERVICE_ROLE_KEY` ha accesso admin al DB. Non va mai esposta al client.

---

## Struttura Cartelle

```
codeguessr/
├── backend/
│   ├── server.js          ← Tutto il backend (Express + Socket.io)
│   ├── auth.js            ← Middleware JWT per le rotte protette
│   ├── .env               ← Variabili d'ambiente (NON committare)
│   └── package.json
│
├── frontend/
│   ├── index.html         ← Landing page
│   └── src/
│       ├── pages/
│       │   ├── game_page.html      ← Hub di gioco
│       │   ├── match_page.html     ← Arena multiplayer
│       │   ├── profile_page.html   ← Profilo utente
│       │   ├── leaderboard_page.html
│       │   ├── login_page.html
│       │   └── reset_password.html
│       ├── js/
│       │   ├── managers/           ← Moduli condivisi tra pagine
│       │   │   ├── auth.js         ← Login/logout/refresh token lato client
│       │   │   ├── settings.js     ← Impostazioni utente
│       │   │   ├── sound.js        ← Gestione audio di gioco
│       │   │   └── theme.js        ← Dark/light mode
│       │   ├── game_page/
│       │   │   ├── ui.js           ← Monaco Editor, timer, punteggio
│       │   │   ├── profile.js      ← Sidebar profilo
│       │   │   ├── multiplayer_modal.js  ← Modal matchmaking
│       │   │   ├── gestione_amicizione.js ← Lista amici e sfide
│       │   │   └── typing.js       ← Effetto macchina da scrivere
│       │   └── match_page/
│       │       └── match.js        ← Logica multiplayer lato client
│       └── css/
│
└── db/
    ├── test_db.sql         ← Schema SQL completo
    └── test_test.sql       ← Query di test
```

---

## Database (Supabase)

### Schema tabelle

```
auth.users  (gestita da Supabase Auth)
    └── id (UUID) ─────────────────────────────────────────┐
                                                           ▼
giocatore                                          partita
  id_giocatore (UUID, FK → auth.users)              id_partita (BIGINT, identity)
  nickname (TEXT, UNIQUE)                            modalita  (ENUM)
  exp (INT)                                          stato     (ENUM)
  livello (INT)                                      data_inizio / data_fine
  trophies (INT)                                     id_utente_casa     (FK → giocatore)
  bio, avatar_url, banner_url                        id_utente_trasferta(FK → giocatore)
  attivo (BOOL)                                              │
       │                   partecipazione ◄─────────────────┘
       └─────────────────► id_partita    (FK → partita)
                           id_giocatore  (FK → giocatore)
                           risultato     (ENUM: vittoria|sconfitta|pareggio)
                           exp_guadagnata (INT)

amicizia
  id_utente_a / id_utente_b (FK → giocatore)
  stato (ENUM: in_attesa|accettata|rifiutata)

achievements + user_achievements
  Tabella achievement disponibili + junction table utente↔achievement sbloccato
```

### Vista: `v_giocatore_profilo`
Join di `giocatore` + `partecipazione` che calcola **in tempo reale**:
`partite_giocate`, `partite_vinte`, `partite_perse`, `percentuale_vittorie`.
Usata da profilo, statistiche e classifica.

### Trigger: `trigger_level_up`
Si attiva **BEFORE INSERT OR UPDATE** su `exp`.
Ricalcola automaticamente `livello = floor(exp / 1000) + 1` nel DB.

### Enum PostgreSQL
- `modalita_partita`: `singleplayer`, `multiplayer`
- `stato_partita`: `in_corso`, `terminata`
- `risultato_partecipazione`: `vittoria`, `sconfitta`, `pareggio`
- `stato_amicizia`: `in_attesa`, `accettata`, `rifiutata`

### Storage Supabase
- Bucket `user_avatars` — avatar profilo (pubblico)
- Bucket `user_banners` — banner profilo (pubblico)

---

## Backend — server.js

Un **singolo file** che gestisce tutto: file statici, API REST e multiplayer Socket.io.

### Avvio

```bash
npm run dev   # nodemon server.js (sviluppo, riavvio automatico)
npm start     # node server.js    (produzione)
```

### Rotte di navigazione (GET — HTML)

| URL | File servito |
|---|---|
| `/` | `index.html` |
| `/home` | `game_page.html` |
| `/login` | `login_page.html` |
| `/match` | `match_page.html` |
| `/profilo` | `profile_page.html` |
| `/profilo/:username` | `profile_page.html` (il frontend legge l'URL) |
| `/classifica` | `leaderboard_page.html` |

### API REST — Riferimento rapido

| Metodo | URL | Auth | Descrizione |
|---|---|---|---|
| POST | `/api/registrazione` | ❌ | Crea account Supabase + profilo giocatore |
| POST | `/api/login` | ❌ | Login, ritorna `token` + `refresh_token` |
| POST | `/api/refresh-token` | ❌ | Rinnova il JWT scaduto |
| POST | `/api/reset_password` | ❌ | Invia email reset via Supabase |
| GET | `/api/profilo/:id` | ❌ | Dati pubblici di un giocatore |
| PUT | `/api/profilo` | ✅ | Aggiorna nickname/bio/avatar/banner |
| DELETE | `/api/profilo` | ✅ | Elimina account (cascade DB) |
| GET | `/api/storico/:id` | ❌ | Ultime 20 partite del giocatore |
| GET | `/api/statistiche/:id` | ❌ | Win rate e statistiche aggregate |
| GET | `/api/leaderboard` | ❌ | Classifica paginata per trofei |
| GET | `/api/search/:nome` | ❌ | Ricerca giocatori per nickname (prefisso) |
| GET | `/api/missioni/:id` | ❌ | Achievement con progressi calcolati |
| POST | `/api/salva-partita` | ✅ | Salva partita singleplayer nel DB |
| POST | `/api/crea-partita` | ✅ | Crea partita `in_corso` (usato internamente) |
| GET | `/api/partita/:id` | ✅ | Recupera dati di una partita specifica |
| GET | `/api/random-snippet` | ❌ | Snippet casuale da GitHub (o fallback) |
| POST | `/api/valuta-risposta` | ❌ | Valuta risposta via AI (0-100) |
| POST | `/api/upload/avatar` | ✅ | Upload avatar su Supabase Storage |
| POST | `/api/upload/banner` | ✅ | Upload banner su Supabase Storage |
| GET | `/api/mie-amicizie` | ✅ | Lista amici / inviate / ricevute |
| GET | `/api/amicizie-confermate/:id` | ❌ | Amici confermati di un utente pubblico |
| GET | `/api/profilo/nickname/:username` | ✅ | Cerca UUID giocatore da nickname |
| POST | `/api/invia-richiesta/:id` | ✅ | Invia richiesta di amicizia |
| PUT | `/api/accetta-richiesta/:id` | ✅ | Accetta richiesta |
| DELETE | `/api/rifiuta-richiesta/:id` | ✅ | Rifiuta/rimuovi amicizia |
| POST | `/api/heartbeat` | ✅ | Aggiorna stato "online" |

---

## Autenticazione

### JWT Supabase (REST)

1. `POST /api/login` → riceve `access_token` (JWT, ~1h) e `refresh_token`
2. Client salva entrambi in `localStorage` (`supabaseToken`, `supabaseRefreshToken`)
3. Ogni chiamata protetta usa: `Authorization: Bearer <access_token>`
4. `auth.js` (backend) chiama `supabase.auth.getUser(token)` per validarlo
5. Se valido → attacca `req.utenteId` e chiama `next()`
6. Se scaduto → client chiama `POST /api/refresh-token` con il refresh token

### JWT Supabase (Socket.io)

```js
// Client
const socket = io({ 
  auth: { token: localStorage.getItem('supabaseToken') },
  extraHeaders: { "x-refresh-token": localStorage.getItem('supabaseRefreshToken') }
});

// Server (middleware io.use)
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  // Valida con supabase.auth.getUser(token)
  // Attacca al socket: userId, nickname, avatar_url, livello, trophies
  next();
});
```

### `fetchAuth` — auto-refresh trasparente

`fetchAuth(url, options)` è un wrapper di `fetch` che:
1. Aggiunge automaticamente `Authorization: Bearer <token>`
2. Se il server risponde `401`, tenta il refresh del token
3. Se il refresh ha successo, riprova la stessa richiesta con il nuovo token
4. Se il refresh fallisce, chiama `clearSession()` e reindirizza al login

Tutte le chiamate API autenticate nel frontend usano `fetchAuth` invece di `fetch` direttamente.

---

## Flow Singleplayer

```
[Frontend: match_page]
        │
        1. Preloading snippet (loader.js durante splash screen)
           └─► window.__firstSnippet precaricato prima del caricamento della pagina
               Round 1 usa questo snippet senza delay visibile.
               Round 2+ → GET /api/random-snippet
        │
        2. GET /api/random-snippet (Round 2+)
           └─► getRandomSnippet()
                 ├─► GitHub Code Search API (query + pagina casuali)
                 ├─► Scarica file, decodifica base64, tronca a 40 righe
                 └─► Se GitHub fallisce → FALLBACK_SNIPPETS (4 snippet locali)
        │
        3. Countdown 3-2-1-VIA! poi Monaco Editor readOnly con il codice
        │
        4. Timer 60 secondi — il giocatore scrive la risposta
        │
        5. Submit → POST /api/valuta-risposta { snippet, risposta }
           └─► OpenRouter → GPT-4o-mini
                 Risposta JSON: { "punteggio": 0-100 }
           Timeout → risposta vuota, score 0
        │
        6. Calcolo danno vs BOT (score casuale da range difficoltà):
             easy: 10-40    normal: 30-70    hard: 55-95
           diff = myScore - botScore
             diff > 0 → il bot perde abs(diff) HP
             diff < 0 → il giocatore perde abs(diff) HP
             diff = 0 → nessun danno
        │
        7. Se HP <= 0 o round finale → showEndGame()
           └─► POST /api/salva-partita { modalita, risultato, exp_guadagnata }
                 └─► saveMatchToDB()
                       ├─► INSERT partita (stato='terminata')
                       ├─► INSERT partecipazione
                       └─► updatePlayerStats() → aggiorna exp, livello, trophies
```

### Bot singleplayer
Il bot non usa AI: il suo punteggio è un numero casuale nel range della difficoltà scelta.
I nomi e i livelli visualizzati variano in base alla difficoltà:

| Difficoltà | Nome bot | Livello | Trofei | Score range |
|---|---|---|---|---|
| Easy | EasyBot | 5 | 400 | 10–40 |
| Normal | CodeBot | 25 | 2800 | 30–70 |
| Hard | HardCore | 99 | 9999 | 55–95 |

---

## Flow Multiplayer

### A) Matchmaking automatico

```
Giocatore A emette: startMatchmaking
  → Se coda vuota: A viene messo in coda

Giocatore B emette: startMatchmaking
  → B trova A in coda: abbinamento!
  → INSERT partita nel DB (id_utente_casa=A, id_utente_trasferta=B)
  → INSERT partecipazione x2
  → socket.join(roomCode) per entrambi
  → emit('matchFound') a entrambi
```

### B) Stanza privata (codice 5 cifre, ranked)

```
Host: createPrivateRoom → riceve { code: "12345" }
Guest: joinPrivateRoom("12345")
  → Server crea il match e INSERT DB
  → emit('matchFound') a entrambi
```

### C) Sfida tra amici (unranked)

```
Challenger: challengeFriend(friendId)
  → Server trova socket dell'amico
  → emit('challengeReceived') all'amico (timeout 30s)

Amico: respondToChallenge({ inviteId, accepted: true })
  → INSERT partita nel DB (unranked=true)
  → emit('matchFound') a entrambi
```

### D) Flow della partita (tutti i casi)

```
Entrambi emettono: joinRoom(roomCode)
  → player.ready = true
  → Quando entrambi ready: startMultiplayerRound()

[ROUND 1..5]
  startMultiplayerRound():
    - getRoundSnippet() → GitHub o fallback
    - emit('startRound', { round, snippet })
    - Timer 90s → evaluateMultiplayerRound() forzata se non risponde nessuno

  submitMultiplayerAnswer({ roomCode, answer }):
    - match.answers[userId] = answer
    - Se avversario disconnesso → answer = "" (score 0 automatico)
    - Quando entrambi rispondono → evaluateMultiplayerRound()

  evaluateMultiplayerRound():
    - Promise.all: valuta entrambe le risposte via AI in parallelo
    - diff = score_P1 - score_P2
    - Il perdente del round perde abs(diff) HP (parte da 100 HP)
    - emit('roundResult', { scores, healths, damage, winnerId })
    - Se HP <= 0 OPPURE ultimo round → finishMultiplayerMatch() dopo 3s
    - Altrimenti → round successivo dopo 4s

finishMultiplayerMatch():
  1. Determina vincitore (più HP)
  2. EXP:    vittoria = 100 + floor(hp/2), sconfitta = -10 - floor(hp_avv/2)
  3. Trofei: vittoria = random(30-40) + floor(hp/2)  [solo ranked]
  4. UPDATE partecipazione P1 e P2
  5. UPDATE partita (stato='terminata', data_fine)
  6. Se ranked → updatePlayerStats() per entrambi
  7. emit('matchFinished')
  8. Rimuove match da activeMatches
```

### Gestione disconnessione (graceful)

```
disconnect (durante partita iniziata):
  → Crea timeout 120s in disconnectedMatches
  → Informa avversario: opponentDisconnected
  → Aggiunge userId a disconnectedUserIds

Ritorna entro 120s:
  → Auto-rejoin al reconnect (cerca partite sospese al momento della connessione)
  → OPPURE emit('rejoinMatch') manuale dal frontend
  → Timeout cancellato, partita riprende normalmente

Scaduti i 120s:
  → disconnectedMatches ripulito
  → Partita continua, il disconnesso prende score 0 nei round successivi
```

### Strutture dati in memoria

```js
matchmakingQueue      []    // socket in coda matchmaking
activeMatches         Map   // roomCode → { players, partita_id, answers, healths, round... }
privateRooms          Map   // codice → { host, giocatori }
pendingFriendInvites  Map   // inviteId → { challengerId, friendId, timeoutId }
disconnectedMatches   Map   // roomCode → { partita_id, suspensionTimeout, disconnectedUserIds }
activeUsers           Map   // userId → timestamp (per heartbeat online/offline)
```

> Queste strutture sono **in-memory**: si azzerano al riavvio del server.

### Tabella completa degli eventi Socket.io

#### Emessi dal **client** verso il server

| Evento | Payload | Descrizione |
|---|---|---|
| `startMatchmaking` | — | Entra in coda per matchmaking automatico |
| `cancelMatchmaking` | — | Esce dalla coda di matchmaking |
| `createPrivateRoom` | — | Crea una stanza privata con codice 5 cifre |
| `joinPrivateRoom` | `code: string` | Entra in una stanza privata esistente |
| `joinRoom` | `roomCode: string` | Sincronizzazione: indica al server che il client è nella pagina match |
| `submitMultiplayerAnswer` | `{ roomCode, answer }` | Invia la risposta del round corrente |
| `challengeFriend` | `{ friendId }` | Invia un invito sfida a un amico |
| `respondChallenge` | `{ inviteId, accepted: bool }` | Risponde a un invito sfida ricevuto |
| `rejoinMatch` | `{ roomCode }` | Richiede di rientrare in una partita sospesa |

#### Emessi dal **server** verso il client

| Evento | Payload | Descrizione |
|---|---|---|
| `statsUpdate` | `{ onlinePlayers }` | Aggiornamento contatore giocatori online |
| `matchFound` | `{ roomCode, players[] }` | Partita trovata, reindirizza alla match page |
| `roomCreated` | `{ code }` | Stanza privata creata con successo |
| `matchInfo` | `{ players[] }` | Dati della partita appena entrato nella room |
| `startRound` | `{ round, totalRounds, snippet }` | Inizia un nuovo round con lo snippet |
| `roundResult` | `{ scores, healths, damage, winnerId }` | Risultato del round valutato dal server |
| `matchFinished` | `{ winner, players, stats }` | Fine partita con risultati definitivi |
| `challengeInvite` | `{ inviteId, challenger }` | Hai ricevuto un invito sfida |
| `challengeSent` | `{ friendNickname }` | Conferma: invito sfida inviato |
| `challengeDeclined` | `{ by }` | L'amico ha rifiutato la tua sfida |
| `challengeRejected` | — | Hai rifiutato la sfida |
| `challengeExpired` | — | L'invito è scaduto senza risposta (30s) |
| `challengeError` | `{ message }` | Errore durante la sfida amici |
| `opponentDisconnected` | `{ playerName }` | L'avversario si è disconnesso (partita sospesa) |
| `opponentRejoined` | `{ playerName }` | L'avversario è rientrato nella partita |
| `error` | `{ message }` | Errore generico lato server |

---

## Sistema Missioni (Achievement)

`GET /api/missioni/:id` — calcola i progressi **al volo**:

```
1. Legge achievements dalla tabella DB
2. Legge storico partecipazioni del giocatore
3. Legge amicizie confermate
4. Legge achievement già sbloccati (user_achievements)
5. Calcola progressi dinamici per ogni achievement
6. Se nuovi achievement completati E non ancora in user_achievements:
     → INSERT user_achievements (in background, non blocca la risposta)
     → UPDATE exp e trophies del giocatore
7. Risposta: array [ { id, title, current, target, completed, reward } ]
```

### Lista completa dei 18 Achievement

| Nome | Condizione | Soglia | EXP | Trofei |
|---|---|---|---|---|
| Apprendista Codificatore | Raggiungere livello 5 | 5 | - | - |
| Primo Sangue | Vincere 1 partita | 1 | - | - |
| Maestro del Codice | Raggiungere livello 20 | 20 | - | - |
| Gladiatore | 25 vittorie multiplayer | 25 | - | - |
| Maratoneta | 100 partite giocate | 100 | - | - |
| Infallibile | 5 vittorie consecutive | 5 | - | - |
| Dio dei Linguaggi | 10 vittorie consecutive | 10 | - | - |
| Leggenda del Debug | Raggiungere livello 50 | 50 | - | - |
| Duellante | 10 partite multiplayer | 10 | - | - |
| Scalatore Sociale | 10 amici confermati | 10 | - | - |
| Vanità | Avatar o banner impostato | 1 | - | - |
| Notte Bianca | Giocato tra le 00:00 e le 05:00 | 1 | - | - |
| Perfezionista | Media exp > 90 nelle ultime 10 partite | 1 | - | - |
| Genio Incompreso | Ottenere 100+ EXP in una singola partita | 1 | - | - |
| Collezionista | Completare 10 altri achievement | 10 | - | - |
| Script Kiddie | *(non ancora implementato)* | 1 | - | - |
| Low Level Hero | *(non ancora implementato)* | 1 | - | - |
| Web Wizard | *(non ancora implementato)* | 1 | - | - |

> I valori di EXP e trofei per ogni achievement sono definiti nella tabella `achievements` del DB.

---

## Upload Immagini

```
Client: POST /api/upload/avatar  (multipart/form-data, field: "immagine")
  │
  ├─► Multer: file in RAM (Buffer), max 5MB, solo JPEG/PNG/WEBP/GIF
  │
  ├─► Supabase Storage: upload bucket "user_avatars"
  │     path: "{userId}.{ext}"  (upsert=true: sovrascrive sempre lo stesso file)
  │
  └─► Risposta: { url: "https://...supabase.co/.../user_avatars/{userId}.ext" }

Client riceve URL → PUT /api/profilo { avatar_url } → aggiorna giocatore nel DB
```

---

## Sistema Heartbeat (Online/Offline)

Il sistema tiene traccia degli utenti online tramite polling periodico lato client.

```
Client: ogni 15 secondi → POST /api/heartbeat (con Bearer token)

Server:
  - Aggiorna activeUsers Map: userId → Date.now()
  - Se l'utente non era già presente → UPDATE giocatore SET attivo=true

SetInterval ogni 15s (server):
  - Per ogni userId in activeUsers:
      - Se Date.now() - lastSeen > 20000ms (HEARTBEAT_TIMEOUT)
          → Rimuove da activeUsers
          → UPDATE giocatore SET attivo=false

L'informazione "online" viene usata:
  - Nella lista amici (/api/mie-amicizie) → campo online: bool
  - Nella classifica (/api/leaderboard) → campo online: bool
  - Per sapere se un amico può ricevere una sfida (getSocketByUserId)
```

---

## Frontend — Pagine e Script

### `index.html` — Landing Page
- Animazione sfondo (`index-background.js`, `index-background2.js`)
- Link a `/login` e `/home`

### `login_page.html`
- Form login / registrazione / reset password
- `login_page.js` → chiama `/api/login` e `/api/registrazione`
- Salva `token`, `refresh_token`, `userId` in `localStorage`

### `game_page.html` — Hub principale

| Script | Responsabilità |
|---|---|
| `ui.js` | Monaco Editor, timer, fetch snippet, submit, mostra punteggio |
| `profile.js` | Carica e mostra dati profilo nella sidebar |
| `multiplayer_modal.js` | Modal "Cerca avversario" (matchmaking + stanza privata) |
| `gestione_amicizione.js` | Lista amici, invio/accettazione sfide |
| `typing.js` | Effetto typing animato |

### `match_page.html` — Arena multiplayer
`match.js` gestisce tutto:
- Connessione Socket.io con JWT
- `joinRoom(roomCode)` al caricamento
- `startRound` → mostra snippet nel Monaco Editor con timer
- `submitMultiplayerAnswer` → invia risposta
- `roundResult` → aggiorna HP bar, mostra danni e punteggi
- `matchFinished` → schermata risultato finale

### `profile_page.html`
- Profilo pubblico (proprio o di un altro utente)
- Legge l'ID dall'URL o da `localStorage`
- API usate: `/api/profilo/:id`, `/api/storico/:id`, `/api/missioni/:id`
- Upload avatar/banner tramite form multipart

### `managers/auth.js` (client)
Modulo ES6 importato dalle pagine che richiedono autenticazione.

| Funzione | Descrizione |
|---|---|
| `getSession()` | Ritorna `{ isLoggedIn, idGiocatore, token }` da localStorage |
| `clearSession()` | Rimuove tutti i dati di sessione da localStorage |
| `refreshToken()` | Chiama `/api/refresh-token`, aggiorna il token o forza logout |
| `fetchAuth(url, opts)` | Wrapper di `fetch` con Bearer token + retry automatico su 401 |
| `getCookie(name)` | Legge un cookie per nome |
| `setCookie(name, value, days)` | Scrive un cookie con scadenza |
| `deleteCookie(name)` | Elimina un cookie |
| `initAuth()` | Binding UI: logout button, dropdown profilo mobile |

**Esempio d'uso:**
```js
import { fetchAuth, getSession } from '/src/js/managers/auth.js';
const { idGiocatore } = getSession();
const res = await fetchAuth('/api/profilo', { method: 'PUT', body: JSON.stringify({...}) });
```

---

## Sistema Audio (CG_Sound)

Globale `window.CG_Sound` esposto da `managers/sound.js` (IIFE, no import richiesto).

| API | Descrizione |
|---|---|
| `CG_Sound.playClick()` | Riproduce un click casuale (pool di 7 varianti) su ogni button/link |
| `CG_Sound.playWin()` | Suono vittoria |
| `CG_Sound.playGameOver()` | Suono sconfitta |
| `CG_Sound.playMissionComplete()` | Suono achievement sbloccato |
| `CG_Sound.startMusic(type)` | Avvia musica loop (`'game'` o `'match'`) |
| `CG_Sound.stopMusic()` | Ferma la musica corrente |
| `CG_Sound.setMusicVolume(0-1)` | Cambia volume musica |
| `CG_Sound.setSfxVolume(0-1)` | Cambia volume SFX |
| `CG_Sound.isMusicPlaying()` | `true` se la musica sta suonando |

**Comportamento al primo caricamento:**
I browser moderni bloccano l'autoplay audio. Al primo avvio viene mostrato un banner `#cg-audio-banner` che chiede il permesso. La scelta viene salvata in `localStorage` con la chiave `codeguessr-audio-allowed`.

**File audio usati** (tutti in `/src/assets/music/`):
- `game_music_loop.mp3` — musica nella game_page
- `match_music_loop.mp3` — musica nella match_page
- `button_clicks/button_click_1-7.mp3` — SFX click (7 varianti)
- `win_sound.mp3`, `game_over.mp3`, `mission_complete.mp3`

---

## Sistema Impostazioni (settings.js)

Modale accessibile dal menu profilo in ogni pagina. Le impostazioni vengono salvate in `localStorage` sotto la chiave `codeguessr-settings`.

| Impostazione | Tipo | Default | Descrizione |
|---|---|---|---|
| `volumeMusic` | number (0-100) | 60 | Volume musica di sottofondo |
| `volumeSfx` | number (0-100) | 80 | Volume effetti sonori |
| `theme` | `'dark'\|'light'\|'system'` | `'dark'` | Tema visivo dell'interfaccia |
| `reducedAnimations` | boolean | false | Riduce animazioni CSS |
| `difficulty` | `'easy'\|'normal'\|'hard'` | `'normal'` | Difficoltà singleplayer |
| `showTimer` | boolean | true | Mostra/nasconde il countdown |
| `syntaxHighlight` | boolean | true | Syntax highlighting nel Monaco Editor |
| `notifChallenge` | boolean | true | Notifiche sfida da amici |
| `notifFriends` | boolean | false | Notifiche richieste amicizia |

**Chiusura senza salvataggio:** le modifiche vengono revertite automaticamente (la funzione `revertUnsavedSettings` ripristina i valori precedenti dal localStorage).

**Eliminazione account:** il pulsante «Elimina Profilo» nel modale chiama `DELETE /api/profilo` tramite `fetchAuth`, poi esegue `clearSession()` e reindirizza alla landing.

---

## localStorage — Chiavi usate

| Chiave | Contenuto | Dove viene scritta |
|---|---|---|
| `supabaseToken` | JWT access token (Supabase) | Login / refresh |
| `supabaseRefreshToken` | Refresh token | Login / refresh |
| `id_giocatore` | UUID dell'utente loggato | Login |
| `isLoggedIn` | `'true'` / `'false'` | Login / logout |
| `codeguessr-settings` | JSON con tutte le impostazioni | settings.js |
| `codeguessr-audio-allowed` | `'yes'` / `'no'` | Banner audio |
| `codeguessr-theme` | `'dark'` / `'light'` | settings.js |

---

## Diagramma Riassuntivo

```
                   ┌──────────────────────────────────────────┐
                   │           BROWSER (Client)               │
                   │                                          │
                   │  HTML + CSS + JS vanilla                 │
                   │  Monaco Editor (visualizzazione codice)  │
                   │  Socket.io client                        │
                   └────────────────┬─────────────────────────┘
                                    │
                       HTTP REST + WebSocket (Socket.io)
                                    │
                   ┌────────────────▼─────────────────────────┐
                   │          NODE.JS SERVER                  │
                   │          (Express + Socket.io)           │
                   │                                          │
                   │  server.js                               │
                   │    ├─ Routing REST (30+ endpoint)        │
                   │    ├─ Matchmaking queue                  │
                   │    ├─ Match logic (rounds, HP, DB)       │
                   │    └─ Disconnect/rejoin handling         │
                   │                                          │
                   │  auth.js                                 │
                   │    └─ Middleware JWT verificaToken       │
                   └────────┬─────────────────────┬───────────┘
                            │                     │
            ┌───────────────▼──────┐  ┌───────────▼───────────────┐
            │     SUPABASE         │  │    SERVIZI ESTERNI         │
            │                      │  │                            │
            │  PostgreSQL DB       │  │  GitHub Code Search API    │
            │  Auth (JWT)          │  │  → snippet di codice       │
            │  Storage             │  │                            │
            │  (avatar, banner)    │  │  OpenRouter (GPT-4o-mini)  │
            └──────────────────────┘  │  → valutazione risposte    │
                                      └────────────────────────────┘
```
