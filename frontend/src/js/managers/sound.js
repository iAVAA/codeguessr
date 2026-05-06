/**
 * CodeGuessr - sound.js
 * Sistema audio globale basato su file audio locali.
 *
 * API pubblica:
 *   CG_Sound.playClick()           → suono click casuale (7 varianti)
 *   CG_Sound.playWin()             → suono vittoria
 *   CG_Sound.playGameOver()        → suono sconfitta
 *   CG_Sound.playMissionComplete() → suono missione completata
 *   CG_Sound.startMusic()          → avvia musica di background (loop)
 *   CG_Sound.stopMusic()           → ferma la musica
 *   CG_Sound.setMusicVolume(0-1)   → volume musica
 *   CG_Sound.setSfxVolume(0-1)     → volume SFX
 *   CG_Sound.isMusicPlaying()      → boolean
 */

(function (global) {
  'use strict';

  // ─── CONFIGURAZIONE ───────────────────────────────────────────────────────

  const BASE = '/src/assets/music';
  const CLICK_COUNT = 7;
  const PREF_KEY = 'codeguessr-audio-allowed';
  const SETTINGS_KEY = 'codeguessr-settings';

  // ─── STATO ────────────────────────────────────────────────────────────────

  let _musicVolume = 0.6;
  let _sfxVolume = 0.8;
  let _musicEls = {};
  let _currentMusic = null;
  const _clickPool = [];

  // ─── VOLUMI DAL LOCALSTORAGE ──────────────────────────────────────────────

  function loadVolumeFromSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.volumeMusic === 'number') _musicVolume = s.volumeMusic / 100;
      if (typeof s.volumeSfx   === 'number') _sfxVolume   = s.volumeSfx   / 100;
    } catch (e) { /* ignora */ }
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────

  function makeAudio(src, loop = false) {
    const el = new Audio(src);
    el.loop = loop;
    el.volume = 0;
    el.preload = 'auto';
    return el;
  }

  function init() {
    loadVolumeFromSettings();
    _musicEls['game'] = makeAudio(`${BASE}/game_music_loop.mp3`, true);
    _musicEls['match'] = makeAudio(`${BASE}/match_music_loop.mp3`, true);
    _musicEls['game'].volume = _musicVolume;
    _musicEls['match'].volume = _musicVolume;
    for (let i = 1; i <= CLICK_COUNT; i++) {
      const el = makeAudio(`${BASE}/button_clicks/button_click_${i}.mp3`);
      el.volume = _sfxVolume;
      _clickPool.push(el);
    }
  }

  // ─── SFX ──────────────────────────────────────────────────────────────────

  function playSfxFile(src) {
    if (_sfxVolume <= 0) return;
    const el = new Audio(src);
    el.volume = _sfxVolume;
    el.play().catch(() => { });
  }

  // ─── API PUBBLICA ─────────────────────────────────────────────────────────

  const CG_Sound = {

    playClick() {
      if (_sfxVolume <= 0 || _clickPool.length === 0) return;
      const el = _clickPool[Math.floor(Math.random() * _clickPool.length)];
      el.volume = _sfxVolume;
      el.currentTime = 0;
      el.play().catch(() => { });
    },

    playWin()             { playSfxFile(`${BASE}/win_sound.mp3`);       },
    playGameOver()        { playSfxFile(`${BASE}/game_over.mp3`);       },
    playMissionComplete() { playSfxFile(`${BASE}/mission_complete.mp3`); },

    startMusic(type = 'game') {
      if (_currentMusic === type && !_musicEls[type].paused) return;
      this.stopMusic();
      const el = _musicEls[type];
      if (!el) return;
      el.volume = _musicVolume;
      el.play().catch(() => { });
      _currentMusic = type;
    },

    stopMusic() {
      if (_currentMusic && _musicEls[_currentMusic]) {
        _musicEls[_currentMusic].pause();
        _musicEls[_currentMusic].currentTime = 0;
      }
      _currentMusic = null;
    },

    setMusicVolume(vol) {
      _musicVolume = Math.max(0, Math.min(1, vol));
      if (_musicEls['game']) _musicEls['game'].volume = _musicVolume;
      if (_musicEls['match']) _musicEls['match'].volume = _musicVolume;
    },

    setSfxVolume(vol) {
      _sfxVolume = Math.max(0, Math.min(1, vol));
      _clickPool.forEach(el => { el.volume = _sfxVolume; });
    },

    isMusicPlaying() { return _currentMusic !== null && !_musicEls[_currentMusic].paused; },
  };

  // ─── BANNER AUDIO (HTML già in game_page.html) ────────────────────────────
  // Il banner con id="cg-audio-banner" è definito nell'HTML della pagina.
  // Qui gestiamo solo visibilità e logica.

  function initAudioBanner() {
    const pref = localStorage.getItem(PREF_KEY);
    const getMusicType = () => window.location.pathname.includes('/match') ? 'match' : 'game';

    // Già accettato → avvia subito la musica
    if (pref === 'yes') {
      CG_Sound.startMusic(getMusicType());
    }

    const banner = document.getElementById('cg-audio-banner');
    if (!banner) return; // pagina senza banner → nessun popup

    // Se aveva già scelto (yes o no), non mostrare il banner
    if (pref === 'yes' || pref === 'no') return;

    // Prima visita → mostra il banner
    banner.removeAttribute('hidden');

    function dismiss(choice) {
      localStorage.setItem(PREF_KEY, choice);
      banner.setAttribute('hidden', '');
    }

    const btnYes = document.getElementById('cg-audio-yes');
    const btnNo  = document.getElementById('cg-audio-no');

    if (btnYes) {
      btnYes.addEventListener('click', () => {
        dismiss('yes');
        CG_Sound.startMusic(getMusicType());
      });
    }

    if (btnNo) {
      btnNo.addEventListener('click', () => dismiss('no'));
    }
  }

  // ─── CLICK SFX AUTOMATICO ────────────────────────────────────────────────

  function attachClickSfx() {
    document.addEventListener('click', (e) => {
      if (_sfxVolume <= 0) return;
      if (e.target.closest('#cg-audio-banner')) return; // ignora i bottoni del banner
      const target = e.target.closest('button, a, [role="button"], input[type="submit"]');
      if (!target) return;
      CG_Sound.playClick();
    }, true);
  }

  // ─── SYNC VOLUMI CON IMPOSTAZIONI ────────────────────────────────────────

  function watchSettingsSave() {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'settings-save') {
        setTimeout(() => {
          loadVolumeFromSettings();
          CG_Sound.setMusicVolume(_musicVolume);
          CG_Sound.setSfxVolume(_sfxVolume);
        }, 50);
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'volume-music') {
        CG_Sound.setMusicVolume(parseInt(e.target.value, 10) / 100);
      } else if (e.target.id === 'volume-sfx') {
        CG_Sound.setSfxVolume(parseInt(e.target.value, 10) / 100);
      }
    });
  }

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────

  init();

  document.addEventListener('DOMContentLoaded', () => {
    attachClickSfx();
    watchSettingsSave();
    initAudioBanner();
  });

  global.CG_Sound = CG_Sound;

})(window);
