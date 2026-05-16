/*
    FILE: sound.js
    DESCRIPTION: Sistema audio globale di CodeGuessr.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

class SoundManager {
    constructor() {
        // Configurazioni base
        this.basePath = '/src/assets/music';
        this.clickCount = 7;
        this.settingsKey = 'codeguessr-settings';
        this.prefKey = 'codeguessr-audio-allowed';

        // Stato dei volumi
        this.musicVolume = 0.6;
        this.sfxVolume = 0.8;

        // Tracce e cache
        this.currentMusic = null;
        this.musicTracks = {};
        this.clickPool = [];
        this.sfxCache = {};

        // Inizializza tutto
        this.loadVolumes();
        this.initAudioElements();
        this.setupEventListeners();
    }

    /* Legge i volumi dal localStorage */
    loadVolumes() {
        try {
            const raw = localStorage.getItem(this.settingsKey);
            if (!raw) return;

            const settings = JSON.parse(raw);
            if (typeof settings.volumeMusic === 'number') this.musicVolume = settings.volumeMusic / 100;
            if (typeof settings.volumeSfx === 'number') this.sfxVolume = settings.volumeSfx / 100;
        }
        catch {
            console.warn('[sound.js] Errore nel caricamento dei volumi');
        }
    }

    /* Carica gli elementi audio per evitare ritardi */
    initAudioElements() {
        // Tracce musicali di sottofondo in loop
        this.musicTracks['game'] = this.createAudio(`${this.basePath}/game_music_loop.mp3`, true);
        this.musicTracks['match'] = this.createAudio(`${this.basePath}/match_music_loop.mp3`, true);

        // Applica il volume alla musica
        Object.values(this.musicTracks).forEach(track => track.volume = this.musicVolume);

        // Suoni per i click (7 varianti)
        for (let i = 1; i <= this.clickCount; i++) {
            const audio = this.createAudio(`${this.basePath}/button_clicks/button_click_${i}.mp3`);
            audio.volume = this.sfxVolume;
            this.clickPool.push(audio);
        }
    }

    /* Crea un singolo elemento HTMLAudioElement */
    createAudio(src, loop = false) {
        const audio = new Audio(src);
        audio.loop = loop;
        audio.volume = 0;
        audio.preload = 'auto';
        return audio;
    }

    /* === COMANDI PUBBLICI PER USARE I SUONI === */

    /* Avvia la musica di sottofondo ('game' o 'match') */
    startMusic(type = 'game') {
        const track = this.musicTracks[type];
        if (!track) return;

        // Se è già in riproduzione, non fare nulla
        if (this.currentMusic === type && !track.paused) return;

        this.stopMusic();

        track.volume = this.musicVolume;
        track.play().catch(() => console.warn('[SoundManager] Autoplay musica bloccato'));
        this.currentMusic = type;
    }

    /* Ferma la musica attualmente in riproduzione */
    stopMusic() {
        if (this.currentMusic && this.musicTracks[this.currentMusic]) {
            const track = this.musicTracks[this.currentMusic];
            track.pause();
            track.currentTime = 0;
        }
        this.currentMusic = null;
    }

    /* Cambia il volume della musica in tempo reale */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        Object.values(this.musicTracks).forEach(track => track.volume = this.musicVolume);
    }

    /* Cambia il volume degli effetti sonori in tempo reale */
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume)); // Limita tra 0 e 1
        this.clickPool.forEach(audio => audio.volume = this.sfxVolume);
        Object.values(this.sfxCache).forEach(audio => audio.volume = this.sfxVolume);
    }

    /* Riproduce uno dei 7 suoni di click a caso */
    playClick() {
        if (this.sfxVolume <= 0 || this.clickPool.length === 0) return;

        const randomIndex = Math.floor(Math.random() * this.clickPool.length);
        const audio = this.clickPool[randomIndex];
        
        audio.volume = this.sfxVolume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }

    /* Effetto sonoro generico (usa la cache per non ricreare Audio object) */
    playSfx(src) {
        if (this.sfxVolume <= 0) return;

        if (!this.sfxCache[src]) {
            this.sfxCache[src] = this.createAudio(src);
        }

        const audio = this.sfxCache[src];
        audio.volume = this.sfxVolume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }

    /* Metodi per suoni specifici */
    playWin() {
        this.playSfx(`${this.basePath}/win_sound.mp3`);
    }

    playGameOver() {
        this.playSfx(`${this.basePath}/game_over.mp3`);
    }

    isMusicPlaying() {
        return this.currentMusic !== null && !this.musicTracks[this.currentMusic]?.paused;
    }

    /* === EVENT LISTENER E BANNER === */
    setupEventListeners() {
        // Aspettiamo che il DOM sia caricato per agganciare gli eventi UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDomReady());
        }
        else {
            this.onDomReady();
        }
    }

    onDomReady() {
        this.setupAutomaticClicks();
        this.setupSettingsSync();
        this.setupAudioBanner();
    }

    /* Riproduce automaticamente il suono click su bottoni e link */
    setupAutomaticClicks() {
        document.addEventListener('click', (e) => {
            if (this.sfxVolume <= 0) return;
            
            // Ignoriamo i click sul banner del consenso audio
            if (e.target.closest('#cg-audio-banner')) return;

            // Se clicchiamo su un elemento interattivo, suona
            const isInteractive = e.target.closest('button, a, [role="button"], input[type="submit"]');
            if (isInteractive) {
                this.playClick();
            }
        }, true); // true = capture phase, per intercettare prima che altri script blocchino l'evento
    }

    /** Sincronizza i volumi con gli slider delle impostazioni */
    setupSettingsSync() {
        // Movimento degli slider in tempo reale
        document.addEventListener('input', (e) => {
            if (e.target.id === 'volume-music') {
                this.setMusicVolume(parseInt(e.target.value, 10) / 100);
            } else if (e.target.id === 'volume-sfx') {
                this.setSfxVolume(parseInt(e.target.value, 10) / 100);
            }
        });

        // Quando preme "Salva" aggiorna tutto leggendo dal localStorage
        document.addEventListener('click', (e) => {
            if (e.target?.id === 'settings-save') {
                this.loadVolumes();
                this.setMusicVolume(this.musicVolume);
                this.setSfxVolume(this.sfxVolume);
            }
        });
    }

    /** Gestisce il banner popup che chiede il permesso per l'audio */
    setupAudioBanner() {
        const savedChoice = localStorage.getItem(this.prefKey);
        const isMatchPage = window.location.pathname.includes('/match');
        const musicType = isMatchPage ? 'match' : 'game';

        // Se aveva già acconsentito in passato, avvia la musica
        if (savedChoice === 'yes') {
            this.startMusic(musicType);
        }

        const banner = document.getElementById('cg-audio-banner');
        if (!banner) return; // Se la pagina non ha il banner, ci fermiamo qui

        // Se ha già risposto (Si o No), non mostriamo più il banner
        if (savedChoice === 'yes' || savedChoice === 'no') return;

        // Altrimenti è la prima volta: mostra il banner
        banner.removeAttribute('hidden');

        const dismissBanner = (choice) => {
            localStorage.setItem(this.prefKey, choice);
            banner.setAttribute('hidden', '');
        };

        // Click su "Si"
        document.getElementById('cg-audio-yes')?.addEventListener('click', () => {
            dismissBanner('yes');
            this.startMusic(musicType);
        });

        // Click su "No"
        document.getElementById('cg-audio-no')?.addEventListener('click', () => {
            dismissBanner('no');
        });
    }
}

// Inizializza il manager e lo rende globale
window.CG_Sound = new SoundManager();