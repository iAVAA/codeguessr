import { getSession } from '../managers/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnMultiplayer = document.getElementById('btn-multiplayer');
    const overlay = document.getElementById('multiplayer-modal-overlay');
    const btnClose = document.getElementById('multiplayer-modal-close');
    
    const optMatchmaking = document.getElementById('multi-opt-matchmaking');
    const optPrivate = document.getElementById('multi-opt-private');
    const optFriends = document.getElementById('multi-opt-friends');
    
    const codeSection = document.getElementById('multi-code-section');
    const inputCode = document.getElementById('multi-room-code');
    const btnJoin = document.getElementById('multi-btn-join');
    const btnCreate = document.getElementById('multi-btn-create');
    const statusText = document.getElementById('multi-active-players');

    let socket = null;
    let activeInvitePromptId = null;
    let inviteOverlay = null;
    let inviteTitle = null;

    function ensureInviteUI() {
        if (inviteOverlay) return;

        inviteOverlay = document.createElement('div');
        inviteOverlay.id = 'cg-challenge-invite-overlay';
        inviteOverlay.className = 'cg-challenge-invite-overlay';
        inviteOverlay.innerHTML = `
            <div class="cg-challenge-invite-card" role="dialog" aria-modal="true" aria-labelledby="cg-challenge-invite-title">
                <div class="cg-challenge-invite-icon"><i class="bi bi-bell-fill"></i></div>
                <h3 id="cg-challenge-invite-title" class="cg-challenge-invite-title">Sfida in arrivo</h3>
                <p class="cg-challenge-invite-text">Un giocatore ti ha invitato a una partita.</p>
                <div class="cg-challenge-invite-actions">
                    <button type="button" class="cg-challenge-btn cg-challenge-btn--ghost" id="cg-challenge-reject">Rifiuta</button>
                    <button type="button" class="cg-challenge-btn cg-challenge-btn--accept" id="cg-challenge-accept">Accetta</button>
                </div>
            </div>
        `;

        document.body.appendChild(inviteOverlay);
        inviteTitle = inviteOverlay.querySelector('.cg-challenge-invite-text');

        inviteOverlay.querySelector('#cg-challenge-accept')?.addEventListener('click', () => {
            if (!socket || !activeInvitePromptId) return;
            socket.emit('respondChallenge', { inviteId: activeInvitePromptId, accepted: true });
            closeInviteUI();
        });

        inviteOverlay.querySelector('#cg-challenge-reject')?.addEventListener('click', () => {
            if (!socket || !activeInvitePromptId) return;
            socket.emit('respondChallenge', { inviteId: activeInvitePromptId, accepted: false });
            closeInviteUI();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!inviteOverlay.classList.contains('open') || !socket || !activeInvitePromptId) return;
            socket.emit('respondChallenge', { inviteId: activeInvitePromptId, accepted: false });
            closeInviteUI();
        });
    }

    function openInviteUI(challengerName, inviteId) {
        ensureInviteUI();
        activeInvitePromptId = inviteId;
        if (inviteTitle) {
            inviteTitle.textContent = `${challengerName} ti ha invitato a una partita.`;
        }
        inviteOverlay.classList.add('open');
    }

    function closeInviteUI() {
        if (inviteOverlay) {
            inviteOverlay.classList.remove('open');
        }
        activeInvitePromptId = null;
    }

    // --- Inizializzazione Socket ---

    function initSocket() {
        if (socket) return;

        const session = getSession();
        if (!session || !session.token) {
            console.error("Sessione non valida per multiplayer");
            return;
        }

        // Connessione al server con il token per l'autenticazione
        socket = io({
            auth: { token: session.token }
        });

        socket.on('connect', () => {
            console.log("✅ Connesso al server multiplayer");
            statusText.textContent = "Connesso al server multiplayer";
        });

        socket.on('connect_error', (err) => {
            console.error("❌ Errore connessione socket:", err.message);
            statusText.textContent = "Errore di connessione";
        });

        socket.on('statsUpdate', (data) => {
            statusText.textContent = `${data.onlinePlayers} giocatori online`;
        });

        socket.on('roomCreated', (data) => {
            if (typeof showToast === 'function') {
                showToast(`Stanza creata! Codice: ${data.code}`, "green");
            }
            inputCode.value = data.code;
            statusText.textContent = `In attesa di un avversario nella stanza ${data.code}...`;
        });

        socket.on('challengeInvite', (data) => {
            if (!data || !data.inviteId || !data.challenger) return;

            // Evita prompt multipli sovrapposti se arrivano inviti ravvicinati.
            if (activeInvitePromptId) {
                socket.emit('respondChallenge', { inviteId: data.inviteId, accepted: false });
                return;
            }

            const challengerName = data.challenger.nickname || 'Un giocatore';
            if (typeof showToast === 'function') {
                showToast(`Sfida ricevuta da ${challengerName}`, 'blue');
            }

            openInviteUI(challengerName, data.inviteId);
        });

        socket.on('challengeSent', (data) => {
            if (typeof showToast === 'function') {
                const friendName = data?.friendNickname || 'il tuo amico';
                showToast(`Invito inviato a ${friendName}. In attesa di risposta...`, 'blue');
            }
        });

        socket.on('challengeDeclined', (data) => {
            if (typeof showToast === 'function') {
                const name = data?.by?.nickname || 'L\'avversario';
                showToast(`${name} ha rifiutato la sfida.`, 'orange');
            }
        });

        socket.on('challengeRejected', () => {
            if (typeof showToast === 'function') {
                showToast('Hai rifiutato la sfida.', 'orange');
            }
            closeInviteUI();
        });

        socket.on('challengeExpired', () => {
            if (typeof showToast === 'function') {
                showToast('Invito scaduto.', 'orange');
            }
            closeInviteUI();
        });

        socket.on('challengeError', (data) => {
            if (typeof showToast === 'function') {
                showToast(data?.message || 'Errore nella sfida amici.', 'red');
            }
        });

        socket.on('matchFound', (data) => {
            console.log("🎮 Partita trovata!", data);
            closeInviteUI();
            if (typeof showToast === 'function') {
                showToast(`Partita trovata contro ${data.players.find(p => p.id !== session.idGiocatore)?.nickname}!`, "blue");
            }
            
            // Reindirizzamento alla pagina della partita dopo un breve delay per far leggere il toast
            setTimeout(() => {
                window.location.href = `/match?room=${data.roomCode}`;
            }, 1500);
        });

        socket.on('error', (data) => {
            if (typeof showToast === 'function') showToast(data.message, "red");
        });
    }

    // --- Apertura/Chiusura ---
    
    function openModal() {
        overlay.classList.add('open');
        codeSection.style.display = 'none';
        inputCode.value = '';
        initSocket();
    }

    function closeModal() {
        overlay.classList.remove('open');
    }

    if (btnMultiplayer) btnMultiplayer.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // --- Selezione Modalità ---

    optMatchmaking.addEventListener('click', () => {
        if (!socket) return;
        socket.emit('startMatchmaking');
        statusText.textContent = "Ricerca avversario in corso...";
        if (typeof showToast === 'function') showToast("Ricerca avversario...", "blue");
    });

    optPrivate.addEventListener('click', () => {
        const isHidden = window.getComputedStyle(codeSection).display === 'none';
        codeSection.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) inputCode.focus();
    });

    optFriends.addEventListener('click', () => {
        if (typeof showToast === 'function') showToast("Seleziona un amico online dalla barra laterale!", "green");
        closeModal();
    });

    window.addEventListener('cg:challenge-friend', (event) => {
        const friendId = event?.detail?.friendId;
        if (!friendId) return;

        initSocket();
        if (!socket) {
            if (typeof showToast === 'function') showToast('Connessione multiplayer non disponibile.', 'red');
            return;
        }

        socket.emit('challengeFriend', { friendId });
    });

    // --- Logica Stanza Privata ---

    btnCreate.addEventListener('click', () => {
        if (!socket) return;
        socket.emit('createPrivateRoom');
    });

    btnJoin.addEventListener('click', () => {
        if (!socket) return;
        const code = inputCode.value.trim();
        if (code.length !== 5) {
            if (typeof showToast === 'function') showToast("Inserisci un codice a 5 cifre", "red");
            return;
        }
        socket.emit('joinPrivateRoom', code);
    });

    inputCode.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    });

    // Connessione immediata: serve per ricevere inviti anche senza aprire il modal.
    initSocket();
});
