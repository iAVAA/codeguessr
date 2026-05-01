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

        socket.on('matchFound', (data) => {
            console.log("🎮 Partita trovata!", data);
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
});
