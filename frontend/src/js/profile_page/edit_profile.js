/*
    FILE: edit_profile.js
    DESCRIPTION: Gestisce l'apertura/chiusura del modale di modifica profilo e i listener UI.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession } from '../managers/auth.js';
import { saveProfileChanges } from './edit_profile_api.js';

// ─── Feedback visivo ──────────────────────────────────────────────────────────

/* Mostra un messaggio di stato nel modale (successo o errore) */
function showSaveStatus(message, isError = false) {
    const statusEl = document.getElementById('edit-profile-status');
    if (!statusEl) return;

    statusEl.textContent        = message;
    statusEl.style.background   = isError ? 'rgba(220, 53, 69, 0.15)' : 'rgba(98, 151, 85, 0.15)';
    statusEl.style.border       = isError ? '1px solid rgba(220, 53, 69, 0.4)' : '1px solid rgba(98, 151, 85, 0.4)';
    statusEl.style.color        = isError ? '#f87171' : '#86efac';
    statusEl.style.display      = 'block';

    setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 4000);
}

// ─── Apertura / Chiusura modale ───────────────────────────────────────────────

/* Apre il modale di modifica e pre-popola i campi con i dati attuali del profilo */
function openModal() {
    const session = getSession();
    const userIdEl = document.getElementById('page-userid');
    const currentProfileId = userIdEl?.dataset.fullId || userIdEl?.textContent;

    // Controllo di sicurezza: solo il proprietario del profilo può aprire il modale
    if (!session.isLoggedIn || session.idGiocatore !== currentProfileId) {
        console.warn('[edit_profile] Azione bloccata: non puoi modificare il profilo di un altro utente.');
        return;
    }

    const overlay = document.getElementById('edit-profile-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Pre-popolamento campi con i valori correnti dalla pagina
    const inputName = document.getElementById('edit-username');
    const inputBio  = document.getElementById('edit-bio');
    const currentBio = document.getElementById('page-bio')
        ?.textContent?.replace(/^"|"$/g, '').replace('Nessuna bio impostata.', '') || '';

    if (inputName) inputName.value = document.getElementById('page-name')?.textContent || '';
    if (inputBio)  inputBio.value  = currentBio;

    // Reset file inputs e status bar
    ['edit-avatar', 'edit-banner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const statusEl = document.getElementById('edit-profile-status');
    if (statusEl) statusEl.style.display = 'none';
}

/* Chiude il modale di modifica profilo */
function closeModal() {
    const overlay = document.getElementById('edit-profile-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// ─── Salvataggio ─────────────────────────────────────────────────────────────

/* Raccoglie i dati, chiama l'API di salvataggio e aggiorna la UI in-place */
async function saveChanges() {
    const session = getSession();
    if (!session.isLoggedIn) {
        showSaveStatus('Non sei autenticato.', true);
        return;
    }

    const btnSave = document.getElementById('edit-profile-save');
    const originalBtnText = btnSave?.innerHTML;

    if (btnSave) {
        btnSave.disabled  = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Salvataggio...';
    }

    try {
        const payload = await saveProfileChanges(showSaveStatus, closeModal);
        if (!payload) return; // saveProfileChanges ha già mostrato l'errore

        // Aggiorna la UI in-place senza ricaricare la pagina
        if (payload.nickname) {
            const pageNameEl   = document.getElementById('page-name');
            const playerNameEl = document.getElementById('player-name');
            if (pageNameEl)   pageNameEl.textContent   = payload.nickname;
            if (playerNameEl) playerNameEl.textContent = payload.nickname;
        }

        if (payload.bio !== undefined) {
            const bioSpan = document.getElementById('page-bio');
            if (bioSpan) {
                bioSpan.textContent = payload.bio.trim()
                    ? `"${payload.bio}"`
                    : 'Nessuna bio impostata.';
            }
        }

        if (payload.avatar_url) {
            const bust = `?t=${Date.now()}`;
            const pageAv = document.getElementById('page-avatar');
            const navAv  = document.getElementById('player-avatar');
            if (pageAv) pageAv.src = payload.avatar_url + bust;
            if (navAv)  navAv.src  = payload.avatar_url + bust;
        }

        if (payload.banner_url) {
            const bannerEl = document.querySelector('.profile-banner');
            if (bannerEl) bannerEl.style.backgroundImage = `url('${payload.banner_url}?t=${Date.now()}')`;
        }

        showSaveStatus('✓ Profilo aggiornato con successo!');
        setTimeout(closeModal, 1200);

    } catch (error) {
        console.error('[edit_profile] Errore durante il salvataggio:', error);
        showSaveStatus(error.message || 'Errore di connessione. Riprova.', true);
    } finally {
        if (btnSave) {
            btnSave.disabled  = false;
            btnSave.innerHTML = originalBtnText;
        }
    }
}

// ─── Anteprima immagini ───────────────────────────────────────────────────────

/* Mostra il nome del file selezionato accanto alla label del campo immagine */
function setupImagePreview(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;

        const label = input.closest('.cg-settings-row-edit')?.querySelector('.cg-settings-row-name');
        if (label) {
            const originalText = label.dataset.originalText || label.textContent;
            label.dataset.originalText = originalText;
            label.textContent = `${originalText} ✓ ${file.name.slice(0, 20)}${file.name.length > 20 ? '…' : ''}`;
        }
    });
}

// ─── Inizializzazione ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const overlay        = document.getElementById('edit-profile-overlay');
    const btnClose       = document.getElementById('edit-profile-close');
    const btnCancel      = document.getElementById('edit-profile-cancel');
    const btnSave        = document.getElementById('edit-profile-save');

    if (btnEditProfile) btnEditProfile.addEventListener('click', openModal);
    if (btnClose)       btnClose.addEventListener('click', closeModal);
    if (btnCancel)      btnCancel.addEventListener('click', closeModal);
    if (btnSave)        btnSave.addEventListener('click', saveChanges);

    // Chiudi il modale cliccando sull'overlay (fuori dalla card)
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    setupImagePreview('edit-avatar');
    setupImagePreview('edit-banner');
});