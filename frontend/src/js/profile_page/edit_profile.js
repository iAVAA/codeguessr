/**
 * edit_profile.js
 * Gestisce il modale per la modifica del profilo utente
 */

document.addEventListener('DOMContentLoaded', () => {
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const overlay = document.getElementById('edit-profile-overlay');
    const btnClose = document.getElementById('edit-profile-close');
    const btnCancel = document.getElementById('edit-profile-cancel');
    const btnSave = document.getElementById('edit-profile-save');

    // Funzione per aprire il modale
    const openModal = () => {
        if (!overlay) return;
        overlay.classList.add('open');
        
        // Popola i campi con i valori attuali della pagina
        const currentName = document.getElementById('page-name')?.textContent || '';
        const currentBio = document.querySelector('.profile-main-bio')?.textContent.replace(/"/g, '').trim() || '';
        
        const inputName = document.getElementById('edit-username');
        const inputBio = document.getElementById('edit-bio');
        const inputAvatar = document.getElementById('edit-avatar');
        const inputBanner = document.getElementById('edit-banner');
        
        if (inputName) inputName.value = currentName;
        if (inputBio) inputBio.value = currentBio;
        if (inputAvatar) inputAvatar.value = ''; // svuotiamo l'URL di default
        if (inputBanner) inputBanner.value = ''; // svuotiamo l'URL di default
    };

    // Funzione per chiudere il modale
    const closeModal = () => {
        if (!overlay) return;
        overlay.classList.remove('open');
    };

    // Helper per leggere file in Base64
    const getBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    // Funzione per salvare le modifiche (Mock - aggiorna solo l'UI frontend)
    const saveChanges = async () => {
        const inputName = document.getElementById('edit-username')?.value;
        const inputBio = document.getElementById('edit-bio')?.value;
        const avatarFile = document.getElementById('edit-avatar')?.files?.[0];
        const bannerFile = document.getElementById('edit-banner')?.files?.[0];

        // Aggiorna l'interfaccia 
        if (inputName && inputName.trim() !== '' && document.getElementById('page-name')) {
            document.getElementById('page-name').textContent = inputName;
            const navName = document.getElementById('player-name');
            if (navName) navName.textContent = inputName;
        }

        if (inputBio && inputBio.trim() !== '' && document.querySelector('.profile-main-bio')) {
            document.querySelector('.profile-main-bio').textContent = `"${inputBio}"`;
        }

        try {
            if (avatarFile) {
                const avatarBase64 = await getBase64(avatarFile);
                const pageAvatar = document.getElementById('page-avatar');
                const navAvatar = document.getElementById('player-avatar');
                if (pageAvatar) pageAvatar.src = avatarBase64;
                if (navAvatar) navAvatar.src = avatarBase64;
            }

            if (bannerFile) {
                const bannerBase64 = await getBase64(bannerFile);
                if (document.querySelector('.profile-banner')) {
                    document.querySelector('.profile-banner').style.backgroundImage = `url('${bannerBase64}')`;
                }
            }
        } catch (error) {
            console.error("Errore durante la lettura dell'immagine:", error);
        }

        closeModal();
    };

    if (btnEditProfile) btnEditProfile.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnSave) btnSave.addEventListener('click', saveChanges);

    // Chiusura al click fuori dal modale (sull'overlay scuro)
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }
});
