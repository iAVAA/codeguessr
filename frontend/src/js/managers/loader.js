/*
    FILE: loader.js
    DESCRIPTION: Loader globale dell'applicazione. Inietta un overlay di caricamento animato che previene il FOUC (Flash Of Unstyled Content)
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

/* === Preload Monaco Editor === */

/*
 * Avvia il caricamento di Monaco Editor durante lo splash screen.
 * La Promise viene salvata in window.__monacoReady così initMonacoEditor()
 * in match_snippet.js la può riutilizzare senza riscaricare nulla.
*/
function preloadMonacoIfNeeded() {
    // Solo sulla match_page (che ha il contenitore Monaco)
    if (!window.require || typeof window.require.config !== 'function' || !document.getElementById('monaco-container')) {
        return Promise.resolve();
    }

    // Evita di avviare un secondo caricamento se è già in corso
    if (window.__monacoReady) return window.__monacoReady;

    window.require.config({
        paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
    });

    window.__monacoReady = new Promise((resolve) => {
        window.require(['vs/editor/editor.main'], () => {
            console.log('[loader.js] Monaco Editor precaricato con successo.');
            resolve();
        });
    });

    return window.__monacoReady;
}

/* === CARICAMENTO PRIMO SNIPPET */

/* Carica il primo snippet da GitHub mentre lo splash è ancora visibile */
async function preloadFirstSnippet(statusEl) {
    // Solo sulla match_page
    if (!document.getElementById('monaco-container')) return;

    try {
        if (statusEl) statusEl.innerHTML = 'Caricamento snippet<span class="gl-ellipsis"></span>';
        const res = await fetch('/api/random-snippet');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.__firstSnippet = await res.json();
        console.log('[Loader] Primo snippet precaricato:', window.__firstSnippet?.source);
    } catch (err) {
        console.warn('[Loader] Preload snippet fallito, match.js userà il fallback:', err.message);
        window.__firstSnippet = null;
    }
}

/* === INIZIALIZZAZIONE LOADER === */

/* Inietta il DOM del loader, avvia i preload e nasconde l'overlay quando tutti i task sono completati. */
export function initLoader() {
    // Blocca lo scroll mentre il loader è visibile
    document.body.classList.add('loader-open');

    // Evita iniezioni duplicate (es. hot-reload in sviluppo)
    if (document.getElementById('globalLoader')) return;

    // Avvia il preload di Monaco subito (sincrono), prima di qualsiasi await,
    // per impostare window.__monacoReady prima che match.js lo legga.
    const monacoLoad = preloadMonacoIfNeeded();

    /* === Costruzione DOM del loader === */
    const loaderEl = document.createElement('div');
    loaderEl.id = 'globalLoader';
    loaderEl.setAttribute('aria-hidden', 'true');
    loaderEl.innerHTML = `
      <!-- Logo con anelli SVG decorativi -->
      <div class="gl-logo-wrapper" aria-hidden="true">
        <img class="gl-logo-img" src="/src/assets/img/logo.webp" alt="CodeGuessr" />
        <svg class="gl-ring gl-ring--outer" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45"
            fill="none" stroke="currentColor"
            stroke-width="1.2"
            stroke-dasharray="283"
            stroke-dashoffset="200" />
        </svg>
        <svg class="gl-ring gl-ring--inner" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38"
            fill="none" stroke="currentColor"
            stroke-width="1.2"
            stroke-dasharray="239"
            stroke-dashoffset="170" />
        </svg>
      </div>

      <!-- Testo di stato (aggiornato dinamicamente durante il preload dello snippet) -->
      <div class="gl-status" id="gl-status-text">Caricamento<span class="gl-ellipsis"></span></div>
    `;

    document.body.insertAdjacentElement('afterbegin', loaderEl);

    /* ===== Chiusura loader ===== */

    /* Rimuove il loader dal DOM con animazione di uscita (classe gl--exiting). */
    const hideLoader = () => {
        const loader = document.getElementById('globalLoader');

        // Rimuove lo stile anti-FOUC iniettato inline nell'HTML
        const foucStyle = document.getElementById('fouc-prevention');
        if (foucStyle) foucStyle.remove();

        if (loader) {
            loader.classList.add('gl--exiting');
            // Aspetta la fine della transition CSS (500ms) prima di rimuovere dal DOM
            setTimeout(() => {
                loader.remove();
                document.body.classList.remove('loader-open');
            }, 500);
        } else {
            document.body.classList.remove('loader-open');
        }
    };

    /* Tempo minimo di visibilità: evita che il loader sparisca in un flash */
    const minDelay  = new Promise(res => setTimeout(res, 1400));

    /* Attende che la pagina sia completamente caricata (incluse immagini e CSS) */
    const pageReady = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise(res => window.addEventListener('load', res, { once: true }));

    /* Solo dopo che la pagina è pronta avvia il preload dello snippet */
    const snippetLoad = pageReady.then(() => {
        const statusEl = document.getElementById('gl-status-text');
        return Promise.all([
            monacoLoad,
            preloadFirstSnippet(statusEl)
        ]);
    });

    // Il loader viene chiuso solo quando TUTTI i task sono completati
    Promise.all([minDelay, pageReady, snippetLoad]).then(hideLoader);
}