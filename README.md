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
│   ├── controllers/          # Logica applicativa (snippet GitHub, missioni, socket real-time)
│   ├── middleware/           # Middleware di autenticazione Supabase JWT
│   ├── server.js             # Entry point del server Express e configurazione socket
│   ├── .env.example          # Variabili d'ambiente di esempio
│   └── package.json          # Dipendenze backend (Express, Socket.io, Supabase)
├── db/
│   ├── llm/                  # Prompt di valutazione per l'LLM (GPT-4o-mini via OpenRouter)
│   ├── snippets/             # Snippet di fallback precompilati in JSON
│   └── schema.sql            # Schema completo DDL del database PostgreSQL
├── docs/                     # Documentazione tecnica approfondita
│   ├── ARCHITETTURA.md       # Specifica architetturale del sistema (in italiano)
│   └── db_scheme.svg         # Schema grafico ER del database (vettoriale ad alta definizione)
├── frontend/                 # Applicazione Client (Vanilla HTML, CSS, JS)
│   ├── index.html            # Landing page / Pagina di ingresso
│   └── src/
│       ├── assets/           # Risorse statiche (audio, video, loghi)
│       ├── css/              # Fogli di stile modulari organizzati per componente
│       ├── js/               # Moduli JS divisi in gestori globali, utility e script di pagina
│       └── pages/            # Pagine HTML di gioco, profilo, matchmaking, leaderboard
├── package.json              # Script globali per installazione ed esecuzione (npm run install-all)
├── LICENSE                   # File di licenza generale (MIT)
└── README.md                 # Questo file
```

---

## Documentazione Tecnica

Per una comprensione profonda delle specifiche tecniche e delle scelte di design del progetto, consulta:
* **[Architettura di Sistema (docs/ARCHITETTURA.md)](docs/ARCHITETTURA.md)**: Analisi completa sul pattern Client-Server, WebSocket, modularità CSS/JS, logiche dei trigger SQL e prompt LLM.

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