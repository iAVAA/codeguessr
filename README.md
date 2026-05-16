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
├── backend/                  # Server Node.js e API (WebSockets)
│   ├── server.js             # Entry point del server Express
│   ├── auth.js               # Middleware di autenticazione Supabase
│   ├── .env.example          # Variabili d'ambiente (Esemio .example)
│   └── package.json          # Dipendenze backend
├── frontend/                 # Applicazione Client
│   ├── index.html            # Landing page / Pagina di Login
│   └── src/
│       ├── assets/           # Immagini, audio, video e loghi
│       ├── css/              # Fogli di stile modulari e globali
│       ├── js/               # Logica di business e UI
│       │   ├── managers/     # Gestori globali (Auth, Sound, Theme, Settings)
│       │   ├── game_page/    # Script specifici della Lobby
│       │   ├── match_page/   # Script specifici della Partita
│       │   └── utils/        # Utility generiche e funzioni di supporto
│       └── pages/            # Pagine HTML
├── db/
│   └── schema.sql            # Schema completo del DB Supabase
├── package.json              # Script globali per installazione ed esecuzione (npm run install-all)
└── README.md                 # Questo file
```

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

Questo progetto è distribuito sotto licenza **MIT**. Guarda il file `LICENSE` per ulteriori dettagli.