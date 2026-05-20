# CodeGuessr

Benvenuto su **CodeGuessr**, il gioco in cui metti alla prova la tua reale competenza da sviluppatore: leggere, comprendere e spiegare il codice!

## Cos'è CodeGuessr?
A differenza dei normali giochi di programmazione, qui non devi limitarti a indovinare il linguaggio. Il tuo obiettivo è **analizzare** un frammento di codice e **spiegare** esattamente cosa fa, che algoritmo sta implementando e qual è la sua *complessità computazionale*.

## Come Giocare

1. **Osserva il Codice:** Ad ogni round ti verrà mostrato uno "snippet" all'interno dell'editor.
2. **Analizza a Fondo:** Leggi il codice riga per riga. Capisci le strutture dati utilizzate, i cicli, e prova a dedurre la *Big O Notation* (complessità in tempo e spazio).
3. **Spiega la tua Soluzione:** Sulla destra troverai un'ampia casella di testo. Scrivi la tua analisi dettagliata delineando lo scopo di quell'algoritmo (es. *"Si tratta della sequenza di Fibonacci calcolata tramite programmazione dinamica con complessità spaziale O(n)"*).
4. **Punti e Vita:** Le tue risposte verranno valutate dal nostro sistema. Le risposte superficiali infliggeranno danni ai tuoi HP, mentre le analisi tecniche, dettagliate e corrette ti faranno guadagnare tantissimi XP per salire di Livello!

## Modalità di Gioco

- **Single Player:** Gioca da solo e allenati contro il Bot. Scegli la difficoltà (Facile, Medio, Difficile) e metti alla prova le tue capacità di *code-reading* analizzando algoritmi noti o trappole logiche, per guadagnare punti Esperienza (XP) e Coppe.
- **Multiplayer:** Aggiungi altri programmatori alla tua "Lista Amici" e sfidali testa a testa in tempo reale! Il giocatore con la spiegazione migliore e più accurata vincerà il Round.

---

## Struttura del progetto

```text
codeguessr/
├── backend/                                  # Server Node.js & API realtime (WebSockets)
│   ├── controllers/                          # Logica applicativa centrale
│   │   ├── code.js                           # Gestione snippet e integrazione LLM via OpenRouter
│   │   ├── missions.js                       # Missioni giornaliere/settimanali e obiettivi
│   │   └── socket.js                         # Matchmaking, lobby e orchestrazione Socket.io
│   ├── middleware/                           # Middleware sicurezza e validazione
│   │   └── auth.js                           # Validazione JWT emessi da Supabase
│   ├── .env.example                          # Variabili d'ambiente necessarie
│   ├── package.json                          # Dipendenze backend (Express, Socket.io, Supabase)
│   └── server.js                             # Entry point HTTP + WebSocket server
│
├── db/                                       # Database e configurazioni LLM
│   ├── llm/                                  # Prompt e istruzioni AI
│   │   └── prompt.md                         # Regole di valutazione per GPT-4o-mini
│   ├── snippets/                             # Snippet di codice offline (fallback JSON)
│   │   ├── java_snippets.json                # Snippet Java
│   │   ├── javascript_snippets.json          # Snippet JavaScript
│   │   └── python_snippets.json              # Snippet Python
│   └── schema.sql                            # Schema PostgreSQL (DDL, trigger, RPC, viste)
│
├── docs/                                     # Documentazione tecnica e risorse visive
│   ├── db_scheme.svg                         # Diagramma ER del database
│   ├── ARCHITETTURA.md                       # Specifiche architetturali
│   ├── SCREENSHOTS.md                        # Galleria schermate applicazione
│   └── screenshots/                          # Screenshot dell'app
│
├── frontend/                                 # Client application (HTML, CSS, JavaScript)
│   ├── index.html                            # Landing page (login / registrazione)
│   ├── src/
│   │   ├── assets/                           # Risorse statiche multimediali
│   │   │   ├── icons/                        # SVG, favicon e icone UI
│   │   │   ├── img/                          # Logo, badge, avatar e immagini
│   │   │   └── music/                        # Musiche ed effetti sonori
│   │   │
│   │   ├── css/                              # Fogli di stile modulari
│   │   │   ├── styles/                       # Design system globale
│   │   │   │   ├── _variables.css            # Token UI (colori, font, spacing)
│   │   │   │   ├── _base.css                 # Reset e stili base
│   │   │   │   ├── _navbar.css               # Barra di navigazione
│   │   │   │   ├── _responsive.css           # Media queries responsive
│   │   │   │   └── ...                       # Loader, modali, footer, utility
│   │   │   ├── game_page/                    # Stili pagina allenamento
│   │   │   ├── leaderboard_page/             # Stili classifiche globali
│   │   │   ├── match_page/                   # Stili multiplayer e countdown
│   │   │   ├── profile_page/                 # Stili profilo utente e statistiche
│   │   │   └── style.css                     # Entry point CSS globale
│   │   │
│   │   ├── js/                               # Logica JavaScript modulare
│   │   │   ├── managers/                     # Singleton e stato globale
│   │   │   │   ├── auth.js                   # Sessione utente e Supabase client
│   │   │   │   ├── multiplayer.js            # Eventi WebSocket e lobby
│   │   │   │   ├── settings.js               # Preferenze utente
│   │   │   │   ├── sound.js                  # Gestione audio ed effetti
│   │   │   │   └── theme.js                  # Tema Light/Dark dinamico
│   │   │   ├── utils/                        # Utility condivise e helper DOM
│   │   │   ├── game_page/                    # Logica allenamento e missioni
│   │   │   ├── leaderboard_page/             # API ranking e paginazione
│   │   │   ├── match_page/                   # Multiplayer, timer e validazioni
│   │   │   ├── profile_page/                 # Badge, storico e amicizie
│   │   │   ├── 404/                          # Animazione pagina errore
│   │   │   └── index.js                      # Script principale landing page
│   │   │
│   │   └── pages/                            # Schermate HTML applicazione
│   │       ├── game_page.html                # Modalità allenamento
│   │       ├── match_page.html               # Multiplayer realtime
│   │       ├── leaderboard_page.html         # Classifica globale
│   │       ├── profile_page.html             # Profilo e statistiche utente
│   │       ├── reset_password.html           # Richiesta reset password
│   │       ├── reset_password_completo.html  # Cambio password finale
│   │       └── 404.html                      # Pagina errore custom
│
├── package.json                              # Script globali (install-all, run, build)
├── LICENSE                                   # Licenza MIT
└── README.md                                 # Overview e documentazione principale
```

---

## Documentazione Tecnica

Per una comprensione profonda delle specifiche tecniche e delle scelte di design del progetto, consulta:
* **[Architettura di Sistema (docs/ARCHITETTURA.md)](docs/ARCHITETTURA.md)**: Analisi completa sul pattern Client-Server, WebSocket, modularità CSS/JS, logiche dei trigger SQL e prompt LLM.
* **[Interfaccia Grafica e Galleria Schermate (docs/SCREENSHOTS.md)](docs/SCREENSHOTS.md)**: Panoramica visiva approfondita delle schermate di gioco con screenshot descritti.

---

<p align="center">
  <a href="docs/db_scheme.svg">
    <img src="docs/db_scheme.svg" alt="Schema Relazionale ER del Database" />
  </a>
</p>

---

## Installazione (Usage)

Se vuoi eseguire e contribuire al progetto in locale sul tuo ambiente di sviluppo:

1. Clona la repository:
   ```bash
   git clone https://github.com/iAVAA/codeguessr.git
   ```
2. Spostati nella cartella del progetto:
   ```bash
   cd codeguessr
   ```
3. Installa le dipendenze:
   ```bash
   npm run install-all
   ```
4. Esegui il web server in modalità development:
   ```bash
   npm run dev
   ```

## Autori

Sviluppato da:
- **Salvatore Iavarone**
- **Michele Pio Forlani**

## Licenza (MIT)

Questo progetto è distribuito sotto licenza **MIT**. Guarda il file [`LICENSE`](LICENSE) per ulteriori dettagli.