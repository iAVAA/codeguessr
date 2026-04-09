/**
 * CodeGuessr – Global Loader
 * Inietta un overlay di caricamento animato che rispetta il tema (dark/light)
 * e previene il Flash Of Unstyled Content (FOUC).
 *
 * Utilizzo in ogni pagina:
 *   <script>
 *     // Anti-FOUC inline (prima del </head>)
 *     (function() {
 *       var t = localStorage.getItem('codeguessr-theme');
 *       var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
 *       if (t === 'light' || (!t && !prefersDark)) {
 *         document.documentElement.classList.add('light-mode');
 *       }
 *     })();
 *   </script>
 *   <script src="../js/loader.js" defer></script>
 *   <script>initLoader();</script>  ← oppure chiama initLoader() dal tuo JS
 */

export function initLoader() {
  const _inject = () => {
    // ── Blocca lo scroll durante il caricamento ──────────────────────────────
    document.body.classList.add('loader-open');

    if (document.getElementById('globalLoader')) return; // già presente

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
      <div class="gl-status">Resolving Environment<span class="gl-ellipsis"></span></div>
    `;

    document.body.insertAdjacentElement('afterbegin', loaderEl);

    // ── Funzione di chiusura ─────────────────────────────────────────────────
    const _hide = () => {
      const loader = document.getElementById('globalLoader');

      // Rimuovi stile anti-FOUC se presente
      const foucStyle = document.getElementById('fouc-prevention');
      if (foucStyle) foucStyle.remove();

      if (loader) {
        loader.classList.add('gl--exiting');
        setTimeout(() => {
          loader.remove();
          document.body.classList.remove('loader-open');
        }, 500); // uguale alla durata CSS transition
      } else {
        document.body.classList.remove('loader-open');
      }
    };

    // Tempo minimo visibilità (ms)
    const minTime = new Promise(res => setTimeout(res, 1400));

    if (document.readyState === 'complete') {
      minTime.then(_hide);
    } else {
      const pageLoad = new Promise(res => window.addEventListener('load', res, { once: true }));
      Promise.all([minTime, pageLoad]).then(_hide);
    }
  };

  // Inietta subito se il DOM è pronto, altrimenti aspetta
  if (document.body) {
    _inject();
  } else {
    document.addEventListener('DOMContentLoaded', _inject, { once: true });
  }
}
