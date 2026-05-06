/**
 * CodeGuessr – Global Loader
 * Inietta un overlay di caricamento animato che rispetta il tema (dark/light)
 * e previene il Flash Of Unstyled Content (FOUC).
 */

/**
 * Prova a precaricare Monaco Editor (vs/editor/editor.main) durante lo splash.
 * DEVE essere chiamata il prima possibile (prima che match.js esegua init()).
 * Salva la Promise in window.__monacoReady così initMonacoEditor() la riutilizza.
 */
function preloadMonacoIfNeeded() {
  if (
    !window.require ||
    typeof window.require.config !== 'function' ||
    !document.getElementById('monaco-container')
  ) {
    return Promise.resolve();
  }

  if (window.__monacoReady) return window.__monacoReady;

  window.require.config({
    paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }
  });

  window.__monacoReady = new Promise((resolve) => {
    window.require(['vs/editor/editor.main'], () => {
      console.log('[Loader] Monaco Editor precaricato con successo.');
      resolve();
    });
  });

  return window.__monacoReady;
}

/**
 * Fetcha il primo snippet da GitHub durante lo splash, così al round 1
 * lo snippet è già pronto e il countdown parte immediatamente.
 * Salva il risultato in window.__firstSnippet.
 */
async function preloadFirstSnippet(statusEl) {
  // Solo sulla match_page (controlla il contenitore Monaco)
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

export function initLoader() {
  const _inject = () => {
    // ── Blocca lo scroll durante il caricamento ──────────────────────────────
    document.body.classList.add('loader-open');

    if (document.getElementById('globalLoader')) return; // già presente

    // ── AVVIA IL PRELOAD DI MONACO SUBITO (prima di qualsiasi await) ─────────
    // Questo imposta window.__monacoReady in modo sincrono prima che
    // match.js chiami initMonacoEditor(), evitando il race condition.
    const monacoLoad = preloadMonacoIfNeeded();

    // ── Costruisci l'HTML del loader ─────────────────────────────────────────
    const loaderEl = document.createElement('div');
    loaderEl.id = 'globalLoader';
    loaderEl.setAttribute('aria-hidden', 'true');
    loaderEl.innerHTML = `
      <!-- Logo immagine con pulsazione -->
      <div class="gl-logo-wrapper" aria-hidden="true">
        <img class="gl-logo-img" src="/src/assets/img/logo.webp" alt="CodeGuessr" />
        <!-- Anelli SVG decorativi attorno al logo -->
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

      <!-- Pallini rimbalzanti -->
      <div class="gl-dots" aria-hidden="true">
        <span class="gl-dot gl-dot--green"  style="animation-delay: 0ms"></span>
        <span class="gl-dot gl-dot--yellow" style="animation-delay: 150ms"></span>
        <span class="gl-dot gl-dot--red"    style="animation-delay: 300ms"></span>
      </div>

      <!-- Testo di stato -->
      <div class="gl-status" id="gl-status-text">Resolving Environment<span class="gl-ellipsis"></span></div>
    `;

    document.body.insertAdjacentElement('afterbegin', loaderEl);

    // ── Funzione di chiusura ─────────────────────────────────────────────────
    const _hide = () => {
      const loader = document.getElementById('globalLoader');

      const foucStyle = document.getElementById('fouc-prevention');
      if (foucStyle) foucStyle.remove();

      if (loader) {
        loader.classList.add('gl--exiting');
        setTimeout(() => {
          loader.remove();
          document.body.classList.remove('loader-open');
        }, 500);
      } else {
        document.body.classList.remove('loader-open');
      }
    };

    // Tempo minimo visibilità (ms)
    const minTime = new Promise(res => setTimeout(res, 1400));

    // Pagina pronta
    const pageLoad = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise(res => window.addEventListener('load', res, { once: true }));

    // Appena la pagina è pronta, avvia il preload del primo snippet
    const snippetLoad = pageLoad.then(() => {
      const statusEl = document.getElementById('gl-status-text');
      return Promise.all([
        monacoLoad,
        preloadFirstSnippet(statusEl)
      ]);
    });

    // Il loader rimane aperto finché: tempo minimo + pagina caricata + Monaco pronto + snippet pronto
    Promise.all([minTime, pageLoad, snippetLoad]).then(_hide);
  };

  // Inietta subito se il DOM è pronto, altrimenti aspetta
  if (document.body) {
    _inject();
  } else {
    document.addEventListener('DOMContentLoaded', _inject, { once: true });
  }
}
