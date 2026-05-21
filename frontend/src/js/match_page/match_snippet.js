/*
    FILE: match_snippet.js
    DESCRIPTION: Gestione del fetch degli snippet da GitHub (via API backend) e aggiornamento di Monaco Editor (VS Code).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

/* Istanza di Monaco Editor */
let monacoEditorInstance = null;
let monacoViewportObserver = null;

/**
 * Recupera uno snippet casuale dal backend (che a sua volta lo prende da GitHub).
 *
 * @returns {Promise<{code: string, monacoLang: string, source: string}>}
 * @throws {Error} Se il server risponde con un codice di errore.
 */
export async function fetchRandomGitHubSnippet() {
    const res = await fetch('/api/random-snippet');
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
}


/**
 * Aggiorna la titlebar del Monaco Editor con il nome del file e il linguaggio.
 *
 * @param {{ source?: string, monacoLang: string }} snippet
 */
export function updateTitleBar(snippet) {
    const titleEl = document.querySelector('.vscode-title');
    if (!titleEl) return;

    // Estrae il nome del file dal percorso sorgente (github.com/{repo}/{file})
    const fileName = snippet.source
        ? snippet.source.split('-').pop().trim().split('/').pop()
        : `snippet.${snippet.monacoLang}`;

    titleEl.innerHTML =
        `<i class="bi bi-file-earmark-code"></i> ${fileName}` +
        ` &nbsp;<span class="vscode-lang-badge">${snippet.monacoLang.toUpperCase()}</span>` +
        ` &nbsp;- Visual Studio Code`;
}

/**
 * Sostituisce il modello dell'editor con il nuovo snippet.
 * Richiede che Monaco sia già inizializzato (monacoEditorInstance !== null).
 *
 * @param {{ code: string, monacoLang: string, source?: string }} snippet
 */
export function setEditorContent(snippet) {
    if (!monacoEditorInstance) return;

    // Distrugge il modello precedente
    const oldModel = monacoEditorInstance.getModel();
    const model = window.monaco.editor.createModel(snippet.code, snippet.monacoLang);
    monacoEditorInstance.setModel(model);

    if (oldModel) oldModel.dispose();
    updateTitleBar(snippet);
}

function layoutMonacoToContainer() {
    const container = document.getElementById('monaco-container');
    if (!container) return;

    const width = container.clientWidth || container.getBoundingClientRect().width;
    const height = container.clientHeight || container.getBoundingClientRect().height;

    if (monacoEditorInstance && width > 0 && height > 0) {
        monacoEditorInstance.layout({ width, height });
    }
}

function bindMonacoViewportListener() {
    if (monacoViewportObserver) return;

    const container = document.getElementById('monaco-container');
    if (!container) return;

    const handleViewportChange = () => {
        layoutMonacoToContainer();
    };

    if (window.ResizeObserver) {
        monacoViewportObserver = new ResizeObserver(handleViewportChange);
        monacoViewportObserver.observe(container);
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
}

/**
 * Inizializza Monaco Editor per la prima volta nel contenitore #monaco-container.
 * Riutilizza window.__monacoReady (precaricato da loader.js) se disponibile,
 * evitando un doppio round-trip di rete.
 *
 * @param {{ code: string, monacoLang: string, source?: string }} snippet
 * @returns {Promise<void>}
 */
export async function initMonacoEditor(snippet) {
    if (!window.require) {
        console.error('[match_snippet.js] Monaco require() non trovato.');
        throw new Error('Monaco non caricato');
    }

    // Riusa la Promise precaricata dal loader durante lo splash, altrimenti la crea
    const monacoReady = window.__monacoReady ?? (() => {
        window.require.config({
            paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
        });
        return new Promise((res) => window.require(['vs/editor/editor.main'], res));
    })();

    await monacoReady;

    monacoEditorInstance = window.monaco.editor.create(
        document.getElementById('monaco-container'),
        {
            value: snippet.code,
            language: snippet.monacoLang,
            theme: 'vs-dark',
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 15,
            fontFamily: "'JetBrains Mono', monospace",
            padding: { top: 16 },
            scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
            }
        }
    );
    layoutMonacoToContainer();
    bindMonacoViewportListener();
    updateTitleBar(snippet);
}


/**
 * Carica lo snippet per il round corrente:
 * - Round 1: usa window.__firstSnippet precaricato durante lo splash.
 * - Round 2+: esegue un nuovo fetch da GitHub.
 * Poi aggiorna Monaco.
 *
 * @param {number} currentRound - Numero del round corrente (1-indexed).
 * @returns {Promise<{code: string, monacoLang: string, source: string}>} Lo snippet caricato.
 */
export async function loadRoundSnippet(currentRound) {
    let snippet;

    if (currentRound === 1 && window.__firstSnippet) {
        // Consuma lo snippet precaricato e liberalo dalla memoria globale
        snippet = window.__firstSnippet;
        window.__firstSnippet = null;
        console.log(`[match_snippet.js] Round 1: uso snippet precaricato (${snippet.source})`);
    } else {
        // Mostra un indicatore di caricamento nella titlebar
        const titleEl = document.querySelector('.vscode-title');
        if (titleEl) {
            titleEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Caricamento snippet...`;
        }
        try {
            snippet = await fetchRandomGitHubSnippet();
            console.log(`[match_snippet.js] Round ${currentRound}: ${snippet.source} (${snippet.monacoLang})`);
        } catch (err) {
            console.warn('[match_snippet.js] Fetch fallito:', err.message);
            snippet = { code: '// Errore caricamento snippet', monacoLang: 'plaintext', source: '' };
        }
    }

    // Aggiorna Monaco: inizializzalo se non ancora creato, altrimenti cambia solo il modello
    if (monacoEditorInstance) {
        setEditorContent(snippet);
    } else {
        await initMonacoEditor(snippet);
    }

    return snippet;
}

/**
 * Restituisce l'istanza corrente di Monaco Editor (null se non ancora inizializzato).
 *
 * @returns {import('monaco-editor').editor.IStandaloneCodeEditor | null}
 */
export function getMonacoInstance() {
    return monacoEditorInstance;
}