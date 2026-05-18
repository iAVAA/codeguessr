/*
    FILE: typing_404.js
    DESCRIPTION: Animazione di digitazione codice 404 personalizzata per CodeGuessr
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

const SNIPPETS_404 = [
    {
        title: '404_not_found.js',
        tokens: [
            { t: '// Error: Page Not Found\n', c: 'cm' },
            { t: 'const ', c: 'kw' }, { t: 'httpStatus', c: 'vbl' }, { t: ' = ' }, { t: '404', c: 'num' }, { t: ';\n' },
            { t: 'const ', c: 'kw' }, { t: 'path', c: 'vbl' }, { t: ' = ' }, { t: '"', c: 'str' }, { t: 'PATH_TOKEN', c: 'str' }, { t: '"', c: 'str' }, { t: ';\n\n' },
            { t: 'if', c: 'cf' }, { t: ' (' }, { t: 'route', c: 'vbl' }, { t: ' === ' }, { t: 'undefined', c: 'kw' }, { t: ') {\n  ' },
            { t: 'throw ', c: 'cf' }, { t: 'new ', c: 'kw' }, { t: 'Error', c: 'fn' }, { t: '(' }, { t: '"Oops! Questa pagina non esiste."', c: 'str' }, { t: ');\n}' }
        ]
    }
];

function createSpan(token) {
    const span = document.createElement('span');
    if (token.c) span.className = token.c;
    return span;
}

function playSnippet404(container, snippet) {
    container.innerHTML = '';
    container.classList.add('typing-active');

    // Recupera la path originale passata in query o dall'URL del browser
    const urlParams = new URLSearchParams(window.location.search);
    const originalPath = urlParams.get('path') || window.location.pathname;
    const finalPath = (originalPath === '/404' || !originalPath) ? '/route_sconosciuta' : originalPath;

    // Crea e aggiunge il titolo della finestra (stile Mac)
    const titleEl = document.createElement('div');
    titleEl.className = 'mac-window-title';
    titleEl.textContent = snippet.title;
    container.appendChild(titleEl);

    let tokenIdx = 0;
    let charIdx = 0;
    let currentSpan = null;

    function typeNext() {
        if (tokenIdx >= snippet.tokens.length) {
            container.classList.remove('typing-active');
            return;
        }

        const rawToken = snippet.tokens[tokenIdx];
        
        // Sostituiamo PATH_TOKEN con il path effettivo calcolato
        let tokenText = rawToken.t;
        if (tokenText === 'PATH_TOKEN') {
            tokenText = finalPath;
        }

        if (charIdx === 0) {
            currentSpan = createSpan(rawToken);
            container.appendChild(currentSpan);
        }

        currentSpan.textContent += tokenText[charIdx];
        charIdx++;

        if (charIdx >= tokenText.length) {
            tokenIdx++;
            charIdx = 0;
        }

        // Ritardo di battitura fluido (circa 50ms)
        const delay = 50;
        setTimeout(typeNext, delay);
    }

    // Inizia dopo un piccolo ritardo iniziale per l'ingresso visivo
    setTimeout(typeNext, 600);
}

function init404Animation() {
    const container = document.querySelector('.code-decoration');
    if (!container) return;
    playSnippet404(container, SNIPPETS_404[0]);
}

document.addEventListener('DOMContentLoaded', init404Animation);