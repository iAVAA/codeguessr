// Lista delle parole da inserire nella griglia
const words = [
    'MAIN', 'THIS', 'PUBLIC', 'PRIVATE', 'INT', 'FLOAT',
    'CLASS', 'VOID', 'RETURN', 'STATIC', 'STRING', 'BOOLEAN',
    'TRUE', 'FALSE', 'NULL', 'FUNCTION', 'CONST', 'LET', 'IF', 'ELSE',
    'ARRAY', 'OBJECT', 'PROMISE', 'AWAIT', 'ASYNC'
];


const INTERVALLO_INSERIMENTO = 1400;
// Elemento HTML che contiene tutte le celle
const container = document.getElementById('codeTrack');

// Dimensione in pixel di ogni cella quadrata
const cellSize = 100;

// Numero di colonne e righe della griglia (calcolati in base allo schermo)
let cols = 0;
let rows = 0;

// Matrice 2D che tiene traccia delle lettere già inserite
// grid[riga][colonna] = '' se vuota, oppure la lettera presente
let grid = [];

// ─────────────────────────────────────────────
// Crea la griglia di celle vuote
// Viene chiamata all'avvio e ad ogni resize della finestra
// ─────────────────────────────────────────────
function initGrid() {

    // Svuota il contenuto HTML precedente
    container.innerHTML = '';

    // Calcola quante celle ci stanno in larghezza e in altezza
    cols = Math.floor(window.innerWidth  / cellSize);
    rows = Math.floor(window.innerHeight / cellSize);

    // Imposta la griglia CSS con il numero di colonne e righe calcolato
    container.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    container.style.gridTemplateRows    = `repeat(${rows}, ${cellSize}px)`;

    // Costruisce la matrice e crea le celle HTML riga per riga
    grid = [];
    for (let r = 0; r < rows; r++) {

        grid[r] = []; // inizializza la riga r della matrice

        for (let c = 0; c < cols; c++) {

            grid[r][c] = ''; // cella inizialmente vuota

            // Crea un elemento <div> per questa cella
            const cell = document.createElement('div');
            cell.className = 'cell card';
            cell.id = `cell-${r}-${c}`; // id univoco per trovare la cella dopo

            container.appendChild(cell); // aggiunge la cella al contenitore
        }
    }
}

// ─────────────────────────────────────────────
// Controlla se una parola può essere inserita
// a partire da una certa posizione (startRow, startCol)
// in orizzontale o verticale
// ─────────────────────────────────────────────
function canPlaceWord(word, startRow, startCol, isHorizontal) {

    for (let i = 0; i < word.length; i++) {

        // Calcola la cella corrispondente alla lettera i-esima della parola
        const r = isHorizontal ? startRow      : startRow + i;
        const c = isHorizontal ? startCol + i  : startCol;

        // La lettera va fuori dalla griglia → non si può inserire
        if (r >= rows || c >= cols) return false;

        // La cella è occupata da una lettera diversa → conflitto
        if (grid[r][c] !== '' && grid[r][c] !== word[i]) return false;
    }

    // Nessun problema trovato → la parola può essere inserita
    return true;
}

// ─────────────────────────────────────────────
// Sceglie una parola casuale e prova a inserirla
// nella griglia in una posizione libera
// ─────────────────────────────────────────────
function placeWord() {

    // Sceglie una parola a caso dalla lista
    const randomIndex = Math.floor(Math.random() * words.length);
    const word = words[randomIndex];

    // Decide casualmente se inserirla in orizzontale o verticale
    const isHorizontal = Math.random() > 0.5;

    // Prova fino a 100 posizioni casuali finché non ne trova una valida
    for (let attempt = 0; attempt < 100; attempt++) {

        // Scegle una cella di partenza casuale
        const startRow = Math.floor(Math.random() * rows);
        const startCol = Math.floor(Math.random() * cols);

        // Se la parola non ci sta in questa posizione, riprova
        if (!canPlaceWord(word, startRow, startCol, isHorizontal)) continue;

        // Posizione valida trovata: inserisce le lettere una alla volta
        for (let i = 0; i < word.length; i++) {

            // Calcola riga e colonna della lettera i-esima
            const r = isHorizontal ? startRow      : startRow + i;
            const c = isHorizontal ? startCol + i  : startCol;

            // Salva la lettera nella matrice
            grid[r][c] = word[i];

            // Mostra la lettera nel DOM con un ritardo progressivo
            // (ogni lettera appare 150ms dopo la precedente)
            setTimeout(() => {

                const cell = document.getElementById(`cell-${r}-${c}`);
                if (!cell) return; // sicurezza: la cella potrebbe non esistere più

                cell.textContent = word[i];          // scrive la lettera
                cell.classList.add('active', 'pop'); // attiva l'animazione CSS

                 //Rimuove la classe 'pop' dopo 300ms (fine dell'animazione)
                setTimeout(() => cell.classList.remove('pop'), 300);

            }, i * 150); // ritardo: 0ms, 150ms, 300ms, 450ms...
        }

        return; // parola inserita con successo, esci dalla funzione
    }

    // Se arriviamo qui, non è stata trovata nessuna posizione valida
    // (la parola viene semplicemente saltata)
}

// ─────────────────────────────────────────────
// Avvio: quando la pagina è pronta
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

    initGrid(); // costruisce la griglia iniziale

    // Inserisce le prime 3 parole all'avvio con un piccolo ritardo tra loro


    // Da qui in poi, aggiunge una nuova parola ogni 1.2 secondi
    setInterval(placeWord, INTERVALLO_INSERIMENTO);
});

// ─────────────────────────────────────────────
// Gestione del resize della finestra
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {

    // Aspetta 200ms prima di ricostruire la griglia
    // (evita di chiamare initGrid() decine di volte mentre si ridimensiona)
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(initGrid, 200);
});