/*
    FILE: edit_profile_api.js
    DESCRIPTION: Gestisce le chiamate API per la modifica del profilo (upload immagini e aggiornamento dati).
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { fetchAuth } from '../managers/auth.js';

// ===== Upload immagine via backend =====

/**
 * Carica un file immagine (avatar o banner) tramite il backend.
 * @param {File} file - Il file da caricare.
 * @param {'avatar'|'banner'} tipo - Il tipo di immagine.
 * @returns {Promise<string>} - URL pubblico dell'immagine caricata.
 */
export async function uploadImmagine(file, tipo) {
    const formData = new FormData();
    formData.append('immagine', file);

    const token = localStorage.getItem('supabaseToken');

    const res = await fetch(`/api/upload/${tipo}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
            // NON aggiungere Content-Type: il browser lo imposta con il boundary corretto per il multipart
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

// ===== Salvataggio modifiche profilo =====

/**
 * Raccoglie i dati dal form, carica le eventuali immagini e salva le modifiche nel DB.
 * @param {Function} showStatus - Funzione per mostrare messaggi di stato nella UI.
 * @param {Function} closeModal - Funzione per chiudere il modale al termine.
 * @returns {Promise<Object|null>} - Il payload salvato, oppure null in caso di errore.
 */
export async function saveProfileChanges(showStatus, closeModal) {
    const inputName  = document.getElementById('edit-username')?.value?.trim();
    const inputBio   = document.getElementById('edit-bio')?.value?.trim();
    const avatarFile = document.getElementById('edit-avatar')?.files?.[0];
    const bannerFile = document.getElementById('edit-banner')?.files?.[0];

    const payload = {};
    if (inputName) payload.nickname = inputName;
    if (inputBio !== undefined) payload.bio = inputBio;

    // Upload delle immagini se selezionate
    if (avatarFile) {
        showStatus('Caricamento avatar…');
        payload.avatar_url = await uploadImmagine(avatarFile, 'avatar');
    }
    if (bannerFile) {
        showStatus('Caricamento banner…');
        payload.banner_url = await uploadImmagine(bannerFile, 'banner');
    }

    if (Object.keys(payload).length === 0) {
        showStatus('Nessuna modifica da salvare.', true);
        return null;
    }

    // Salva i dati nel DB tramite il backend
    const res = await fetchAuth('/api/profilo', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
        showStatus(data.errore || 'Errore durante il salvataggio.', true);
        return null;
    }

    return payload;
}