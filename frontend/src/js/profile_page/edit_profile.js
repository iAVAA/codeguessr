/**
 * edit_profile.js
 * Gestisce il modale per la modifica del profilo utente.
 */

import { getSession, fetchAuth } from '../managers/auth.js';

// ─── Upload immagine via backend ──────────────────────────────────────────────

async function uploadImmagine(file, tipo) {
    const formData = new FormData();
    formData.append('immagine', file);

    const token = localStorage.getItem('supabaseToken');

    const res = await fetch(`/api/upload/${tipo}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
            // NON aggiungere Content-Type: il browser lo imposta con il boundary corretto
        },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errore || `Upload ${tipo} fallito`);
    }

    const data = await res.json();
    return data.url;
}

// ─── Feedback visivo ──────────────────────────────────────────────────────────

function showSaveStatus(message, isError = false) {
    let statusEl = document.getElementById('edit-profile-status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'edit-profile-status';
        statusEl.style.cssText = `
            margin: 0.75rem 1.5rem 0;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
        `;
        const footer = document.querySelector('#edit-profile-modal .cg-settings-footer');
        if (footer) footer.parentNode.insertBefore(statusEl, footer);
    }

    statusEl.textContent = message;
    statusEl.style.background = isError ? 'rgba(220, 53, 69, 0.15)' : 'rgba(98, 151, 85, 0.15)';
    statusEl.style.border = isError ? '1px solid rgba(220, 53, 69, 0.4)' : '1px solid rgba(98, 151, 85, 0.4)';
    statusEl.style.color = isError ? '#f87171' : '#86efac';
    statusEl.style.display = 'block';

    setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 4000);
}

// ─── Apertura/Chiusura modale ─────────────────────────────────────────────────

function openModal() {
    const session = getSession();
    const currentProfileId = document.getElementById('page-userid')?.textContent;

    // 🔒 CONTROLLO DI SICUREZZA: Sei loggato ed è il TUO profilo?
    if (!session.isLoggedIn || session.idGiocatore !== currentProfileId) {
        console.warn("Azione bloccata: non puoi modificare il profilo di un altro utente.");
        return; // Ferma tutto, il modale non si apre!
    }

    const overlay = document.getElementById('edit-profile-overlay');
    if (!overlay) return;
    overlay.classList.add('open');

    const currentName = document.getElementById('page-name')?.textContent || '';
    const bioEl = document.getElementById('page-bio');
    const currentBio = bioEl?.textContent?.replace(/^"|"$/g, '').replace('Nessuna bio impostata.', '') || '';

    const inputName = document.getElementById('edit-username');
    const inputBio = document.getElementById('edit-bio');
    if (inputName) inputName.value = currentName;
    if (inputBio) inputBio.value = currentBio;

    const avatarInput = document.getElementById('edit-avatar');
    const bannerInput = document.getElementById('edit-banner');
    if (avatarInput) avatarInput.value = '';
    if (bannerInput) bannerInput.value = '';

    const statusEl = document.getElementById('edit-profile-status');
    if (statusEl) statusEl.style.display = 'none';
}

function closeModal() {
    const overlay = document.getElementById('edit-profile-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
}

// ─── Salvataggio modifiche ────────────────────────────────────────────────────

async function saveChanges() {
    const session = getSession();
    if (!session.isLoggedIn) {
        showSaveStatus('Non sei autenticato.', true);
        return;
    }

    const btnSave = document.getElementById('edit-profile-save');
    const originalBtnText = btnSave?.innerHTML;
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Salvataggio...';
    }

    try {
        const inputName = document.getElementById('edit-username')?.value?.trim();
        const inputBio = document.getElementById('edit-bio')?.value?.trim();
        const avatarFile = document.getElementById('edit-avatar')?.files?.[0];
        const bannerFile = document.getElementById('edit-banner')?.files?.[0];

        const payload = {};
        if (inputName) payload.nickname = inputName;
        if (inputBio !== undefined) payload.bio = inputBio;

        if (avatarFile) {
            showSaveStatus('Caricamento avatar…');
            payload.avatar_url = await uploadImmagine(avatarFile, 'avatar');
        }
        if (bannerFile) {
            showSaveStatus('Caricamento banner…');
            payload.banner_url = await uploadImmagine(bannerFile, 'banner');
        }

        if (Object.keys(payload).length === 0) {
            showSaveStatus('Nessuna modifica da salvare.', true);
            return;
        }

        // Salva nickname/bio nel DB tramite backend
        const res = await fetchAuth('/api/profilo', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok) {
            showSaveStatus(data.errore || 'Errore durante il salvataggio.', true);
            return;
        }

        // Aggiorna la UI senza ricaricare
        if (payload.nickname) {
            document.getElementById('page-name') && (document.getElementById('page-name').textContent = payload.nickname);
            document.getElementById('player-name') && (document.getElementById('player-name').textContent = payload.nickname);
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
            const navAv = document.getElementById('player-avatar');
            if (pageAv) pageAv.src = payload.avatar_url + bust;
            if (navAv) navAv.src = payload.avatar_url + bust;
        }

        if (payload.banner_url) {
            const bannerEl = document.querySelector('.profile-banner');
            if (bannerEl) bannerEl.style.backgroundImage = `url('${payload.banner_url}?t=${Date.now()}')`;
        }

        showSaveStatus('✓ Profilo aggiornato con successo!');
        setTimeout(closeModal, 1200);

    } catch (error) {
        console.error('Errore durante il salvataggio profilo:', error);
        showSaveStatus(error.message || 'Errore di connessione. Riprova.', true);
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = originalBtnText;
        }
    }
}

// ─── Anteprima immagini ───────────────────────────────────────────────────────

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

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const overlay = document.getElementById('edit-profile-overlay');
    const btnClose = document.getElementById('edit-profile-close');
    const btnCancel = document.getElementById('edit-profile-cancel');
    const btnSave = document.getElementById('edit-profile-save');

    if (btnEditProfile) btnEditProfile.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnSave) btnSave.addEventListener('click', saveChanges);

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    setupImagePreview('edit-avatar');
    setupImagePreview('edit-banner');
});