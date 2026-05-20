/*
    FILE: settings.js
    DESCRIPTION: Manager delle impostazioni globali di CodeGuessr. Gestisce il modale delle impostazioni e il localStorage.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

class SettingsManager {
    constructor() {
        this.STORAGE_KEY = 'codeguessr-settings';
        this.THEME_KEY = 'codeguessr-theme';

        this.DEFAULT_SETTINGS = {
            volumeMusic: 60,
            volumeSfx: 80,
            theme: 'dark',
            reducedAnimations: false,
            difficulty: 'normal'
        };

        // Inizializza tutto se il DOM è già pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
		else {
            this.init();
        }
    }

    /* === CARICATORE DI STORAGE PER IMPOSTAZIONI === */

    /* Legge e carica le impostazioni dal localStorage */
    loadSettings() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? { ...this.DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...this.DEFAULT_SETTINGS };
        }
		catch {
            console.warn('[settings.js] Errore nel caricamento impostazioni, uso default.');
            return { ...this.DEFAULT_SETTINGS };
        }
    }

    /* Salva le impostazioni nel localStorage */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        }
		catch (e) {
            console.warn('[settings.js] Impossibile salvare le impostazioni:', e);
        }
    }

    /* === ESTRAZIONE DATI DALLA FINESTRA MODALE */

    /* Legge lo stato attuale di tutti gli input nel modale */
    readCurrentState() {
        const getSlider = (id) => parseInt(document.getElementById(id)?.value ?? 0, 10);
        const getToggle = (id) => document.getElementById(id)?.checked ?? false;

        const getPicker = (pickerId, attr) => {
            const activeBtn = document.querySelector(`#${pickerId} [aria-pressed="true"]`);
            return activeBtn?.dataset[attr] ?? null;
        };

        return {
            volumeMusic: getSlider('volume-music'),
            volumeSfx: getSlider('volume-sfx'),
            theme: getPicker('theme-picker', 'theme') ?? 'dark',
            reducedAnimations: getToggle('toggle-animations'),
            difficulty: getPicker('difficulty-picker', 'diff') ?? 'normal'
        };
    }

    /* === INIZIALIZZAZIONE UI === */

    init() {
        const currentSettings = this.loadSettings();

        // Popola gli input con i valori salvati
        this.initSlider('volume-music', 'volume-music-val', currentSettings.volumeMusic);
        this.initSlider('volume-sfx', 'volume-sfx-val', currentSettings.volumeSfx);
        this.initThemePicker(currentSettings.theme);
        this.initDifficultyPicker(currentSettings.difficulty);
        
        this.initToggle('toggle-animations', currentSettings.reducedAnimations);

        // Applica le impostazioni visive globali (Tema, Animazioni)
        this.applyTheme(currentSettings.theme);
        this.applyReducedAnimations(currentSettings.reducedAnimations);

        // Ascolta gli eventi (apertura/chiusura/salvataggio/eliminazione)
        this.setupEventListeners();
    }

    /* Configura uno slider (range input) e gestisce l'aggiornamento visivo */
    initSlider(sliderId, labelId, initialValue) {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(labelId);
        if (!slider || !label) return;

        slider.value = initialValue;
        label.textContent = `${initialValue}%`;

        // Colora la parte sinistra dello slider dinamicamente
        const updateFill = () => {
            const pct = slider.value;
            slider.style.background = `linear-gradient(to right, rgb(var(--darcula-blue, 104,151,187)) 0%, rgb(var(--darcula-blue, 104,151,187)) ${pct}%, rgba(var(--darcula-comment,128,128,128),0.25) ${pct}%, rgba(var(--darcula-comment,128,128,128),0.25) 100%)`;
            label.textContent = `${pct}%`;
        };

        updateFill();
        slider.addEventListener('input', updateFill);
    }

    /* Configura i bottoni di selezione del tema */
    initThemePicker(initialTheme) {
        const picker = document.getElementById('theme-picker');
        if (!picker) return;

        const btns = picker.querySelectorAll('.cg-theme-btn');
        
        // Imposta lo stato iniziale
        btns.forEach(btn => {
            const isActive = btn.dataset.theme === initialTheme;
            btn.setAttribute('aria-pressed', String(isActive));
        });

        // Ascolta i click (gestione UI locale)
        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('.cg-theme-btn');
            if (!btn) return;
            
            btns.forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
            
            // Anteprima del tema in tempo reale
            this.applyTempTheme(btn.dataset.theme);
        });
    }

    /* Configura i bottoni della difficoltà */
    initDifficultyPicker(initialDifficulty) {
        const picker = document.getElementById('difficulty-picker');
        if (!picker) return;

        const btns = picker.querySelectorAll('.cg-diff-btn');
        
        btns.forEach(btn => {
            const isActive = btn.dataset.diff === initialDifficulty;
            btn.setAttribute('aria-pressed', String(isActive));
        });

        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('.cg-diff-btn');
            if (!btn) return;

            btns.forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');
        });
    }

    /* Inizializza un semplice checkbox toggle */
    initToggle(id, isChecked) {
        const input = document.getElementById(id);
        if (input) input.checked = isChecked;
    }

    /* === APPLICAZIONE GLOBALE (TEMA/ANIMAZIONI) === */

    /* Applica il tema in maniera temporanea senza salvare per un'anteprima */
    applyTempTheme(theme) {
        const html = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.classList.toggle('light-mode', !prefersDark);
        }
		else {
            html.classList.toggle('light-mode', theme === 'light');
        }
    }

    /* Applica e salva ufficialmente il tema */
    applyTheme(theme) {
        this.applyTempTheme(theme);
        
        // Salviamo anche codeguessr-theme per le altre pagine
        if (theme === 'system') {
            localStorage.removeItem(this.THEME_KEY);
        }
		else {
            localStorage.setItem(this.THEME_KEY, theme);
        }
    }

    /* Disabilita/abilita le animazioni a livello globale */
    applyReducedAnimations(isReduced) {
        document.documentElement.classList.toggle('reduced-animations', isReduced);
    }

    /* === GESTIONE DEL MODALE (OPEN/CLOSE/REVERT) === */

    openModal() {
        const overlay = document.getElementById('settings-overlay');
        if (!overlay) return;
        
        overlay.removeAttribute('aria-hidden');
        overlay.classList.add('open');

        // Blocca lo scroll della pagina principale
        document.body.style.overflow = 'hidden';
        
        document.getElementById('settings-close')?.focus();
    }

    closeModal() {
        const overlay = document.getElementById('settings-overlay');
        if (!overlay) return;

        // Se chiudo senza salvare, annullo le modifiche temporanee
        this.revertUnsavedChanges();

        overlay.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    /* Ripristina l'UI del modale ai valori attualmente salvati */
    revertUnsavedChanges() {
        // Ricarichiamo da localStorage e ricarichiamo l'UI
        this.init();
    }

    /* === GESTORE EVENTI === */

    setupEventListeners() {
        // Apri modale dal menu a tendina
        document.getElementById('menu-btn-settings')?.addEventListener('click', (e) => {
            e.preventDefault();
    
            // Chiude il dropdown del profilo (se aperto)
            document.getElementById('profile-dropdown-wrapper')?.classList.remove('active');
            this.openModal();
        });

        // Chiudi modale coi bottoni (X in alto o bottone Annulla)
        document.getElementById('settings-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('settings-cancel')?.addEventListener('click', () => this.closeModal());

        // Chiudi cliccando lo sfondo (per telefoni principalmente)
        document.getElementById('settings-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-overlay') this.closeModal();
        });

        // Chiudi premendo ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('settings-overlay')?.classList.contains('open')) {
                this.closeModal();
            }
        });

        // Salva impostazioni
        document.getElementById('settings-save')?.addEventListener('click', () => {
            const newState = this.readCurrentState();
            
            this.saveSettings(newState);
            this.applyTheme(newState.theme);
            this.applyReducedAnimations(newState.reducedAnimations);
            
            this.closeModal();

            if (typeof window.showToast === 'function') {
                window.showToast('Impostazioni salvate', 'green');
            }
        });

        // Eliminazione profilo (danger zone)
        document.getElementById('btn-delete-profile')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showConfirmDeleteModal();
        });
    }

    /* Mostra un modale custom per confermare l'eliminazione del profilo */
    showConfirmDeleteModal() {
        const overlay = document.getElementById('cg-confirm-delete-overlay');
        if (!overlay) return;

        // Chiude il modale delle impostazioni per far risaltare questo
        this.closeModal();

        overlay.removeAttribute('aria-hidden');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Setup listener locali (una tantum per questa apertura)
        const btnCancel = document.getElementById('btn-cancel-delete');
        const btnConfirm = document.getElementById('btn-confirm-delete');

        const closeConfirmModal = () => {
            overlay.setAttribute('aria-hidden', 'true');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            btnCancel?.removeEventListener('click', closeConfirmModal);
        };

        const executeDelete = async () => {
            closeConfirmModal();
            btnConfirm?.removeEventListener('click', executeDelete);
            await this.handleDeleteProfile();
        };

        btnCancel?.addEventListener('click', closeConfirmModal);
        btnConfirm?.addEventListener('click', executeDelete);
    }

    /* Logica di eliminazione profilo delegata a una funzione asincrona a parte */
    async handleDeleteProfile() {
        try {
            // Import dinamico per auth.js (per evitare dipendenze circolari)
            const { fetchAuth, clearSession } = await import('./auth.js');
            
            const res = await fetchAuth('/api/profilo', { method: 'DELETE' });

            if (res.ok) {
                clearSession();

                setTimeout(() => window.location.replace('/index'), 1000);
            }
			else {
                const data = await res.json();
                if (typeof window.showToast === 'function') {
                    window.showToast('Errore: ' + (data.errore || 'Impossibile eliminare il profilo.'), 'red');
                }
            }
        }
		catch (err) {
            console.error('[settings.js] Errore eliminazione profilo:', err);
            if (typeof window.showToast === 'function') {
                window.showToast('Errore durante l\'eliminazione del profilo.', 'red');
            }
        }
    }
}

// Avvia automaticamente il manager
window.CG_Settings = new SettingsManager();