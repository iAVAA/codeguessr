/*
    FILE: typing.js
    DESCRIPTION: Gestore di snippet di codice centrale con simulazione di scrittura codice
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/


/**
 * Array di snippet di codice da mostrare a rotazione.
 * Ogni snippet ha un titolo (mostrato sulla finestra) e un array di "tokens".
 * Ogni token ha:
 *  - t: il testo da scrivere
 *  - c: la classe CSS per il colore (es: 'kw' per keyword, 'fn' per function, ecc.)
 */
const SNIPPETS = [
	{
		title: 'hello.js',
		tokens: [
			{ t: 'function ', c: 'kw' }, { t: 'sayHello', c: 'fn' }, { t: '() {\n  ' },
			{ t: 'console', c: 'vbl' }, { t: '.' }, { t: 'log', c: 'fn' }, { t: '(' },
			{ t: '"Hello, CodeGuessr!"', c: 'str' }, { t: ');\n}' },
		],
	},
	{
		title: 'math.py',
		tokens: [
			{ t: 'def ', c: 'kw' }, { t: 'add', c: 'fn' }, { t: '(' },
			{ t: 'a', c: 'vbl' }, { t: ', ' }, { t: 'b', c: 'vbl' }, { t: '):\n  ' },
			{ t: 'return ', c: 'cf' }, { t: 'a', c: 'vbl' }, { t: ' + ' }, { t: 'b', c: 'vbl' },
		],
	},
	{
		title: 'check.js',
		tokens: [
			{ t: 'const ', c: 'kw' }, { t: 'isEven', c: 'fn' }, { t: ' = ' },
			{ t: 'n', c: 'vbl' }, { t: ' => ' }, { t: 'n', c: 'vbl' }, { t: ' % ' },
			{ t: '2', c: 'num' }, { t: ' === ' }, { t: '0', c: 'num' }, { t: ';' },
		],
	},
	{
	title: 'greet.ts',
		tokens: [
			{ t: 'export const ', c: 'kw' }, { t: 'greet', c: 'fn' }, { t: ' = (' },
			{ t: 'name', c: 'vbl' }, { t: ': ' }, { t: 'string', c: 'ty' },
			{ t: ') => ' }, { t: '`Ciao ${', c: 'str' }, { t: 'name', c: 'vbl' },
			{ t: '}`', c: 'str' }, { t: ';' },
	],
	},
	{
		title: 'main.c',
		tokens: [
			{ t: 'int ', c: 'ty' }, { t: 'main', c: 'fn' }, { t: '() {\n  ' },
			{ t: 'printf', c: 'fn' }, { t: '(' }, { t: '"Hello World\\n"', c: 'str' },
			{ t: ');\n  ' }, { t: 'return ', c: 'cf' }, { t: '0', c: 'num' }, { t: ';\n}' },
	],
	},
];

// ===== LOGICA DI SCRITTURA CODICE =====

/**
 * Crea un elemento <span> per un token di codice.
 * @param {Object} token - L'oggetto token {t, c}.
 * @returns {HTMLElement} Lo span creato con la classe opportuna.
 */
function createSpan(token) {
    const span = document.createElement('span');
    if (token.c) span.className = token.c;
    return span;
}

/**
 * Avvia l'animazione di uno snippet specifico.
 * @param {HTMLElement} container - Il contenitore HTML dove scrivere il codice.
 * @param {Array} snippets - L'intero array di snippet disponibili.
 * @param {number} index - L'indice dello snippet da riprodurre ora.
 */
function playSnippet(container, snippets, index) {
    // Pulisce il contenitore prima di iniziare
    container.innerHTML = '';

    // Aggiunge la classe per il cursore lampeggiante (gestito in CSS)
    container.classList.add('typing-active');

    const {
        title,
        tokens
    } = snippets[index];

    // Crea e aggiunge il titolo della finestra (stile Mac)
    const titleEl = document.createElement('div');
    titleEl.className = 'mac-window-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);

    let tokenIdx = 0; // Indice del token corrente
    let charIdx = 0; // Indice del carattere corrente all'interno del token
    let currentSpan = null; // Riferimento allo span in cui stiamo scrivendo ora

    /* Funzione ricorsiva che scrive un carattere alla volta */
    function typeNext() {
        // Se abbiamo finito tutti i token dello snippet
        if (tokenIdx >= tokens.length) {
            container.classList.remove('typing-active');

            // Aspetta 5 secondi e poi passa allo snippet successivo (in loop)
            setTimeout(() => {
                playSnippet(container, snippets, (index + 1) % snippets.length);
            }, 5000);
            return;
        }

        const token = tokens[tokenIdx];

        // Se stiamo iniziando un nuovo token, creiamo un nuovo span
        if (charIdx === 0) {
            currentSpan = createSpan(token);
            container.appendChild(currentSpan);
        }

        // Aggiunge il carattere corrente allo span
        currentSpan.textContent += token.t[charIdx];
        charIdx++;

        // Se abbiamo finito i caratteri di questo token, passiamo al prossimo
        if (charIdx >= token.t.length) {
            tokenIdx++;
            charIdx = 0;
        }

        /* Calcola un ritardo per simulare una digitazione realistica */
        const delay = 100;

        // Pianifica la scrittura del prossimo carattere
        setTimeout(typeNext, delay);
    }

    // Inizia la digitazione dopo un breve ritardo per caricare il loader.js
    setTimeout(typeNext, 2000);
}

// ===== INIZIALIZZAZIONE =====

/* Inizializza l'animazione cercando il contenitore nel DOM */
function initTypingAnimation() {
    // Cerca l'elemento con classe .code-decoration (presente in game_page.html)
    const container = document.querySelector('.code-decoration');

    if (!container) return; // Se non lo trova si ferma

    // Avvia il primo snippet (indice 0)
    playSnippet(container, SNIPPETS, 0);
}

initTypingAnimation();