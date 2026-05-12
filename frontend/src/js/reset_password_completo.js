document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // 1. Estraiamo l'access_token dall'URL
        const hash = window.location.hash.substring(1); // Rimuove il '#' iniziale
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        // Se non c'è il token, fermiamo subito l'utente
        if (!accessToken) {
            alert("Link di ripristino non valido o scaduto.");
            return;
        }

        alert('Invio richiesta di reset password...');

        const password = document.getElementById('resetPassword').value;
        const passwordConfirm = document.getElementById('resetPasswordConfirm').value;
        const errorAlert = document.getElementById('ErrorAlert');
        const goodAlert = document.getElementById('GoodAlert');
        
        if (password !== passwordConfirm) {
            errorAlert.textContent = "Le password non corrispondono. Per favore, riprova.";
            errorAlert.classList.remove('d-none');
            setTimeout(() => errorAlert.classList.add('d-none'), 5000);
            return;
        }

        // 2. Inseriamo il token nell'header della richiesta Fetch
        const response = await fetch('/api/reset_password_completo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Passiamo il token al backend per dimostrare l'identità dell'utente
                'Authorization': `Bearer ${accessToken}` 
            },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const result = await response.json();
            errorAlert.textContent = result.errore || "Si è verificato un errore";
            errorAlert.classList.remove('d-none');
            setTimeout(() => errorAlert.classList.add('d-none'), 5000);
        } else {
            const result = await response.json();
            goodAlert.textContent = 'Password aggiornata con successo!' + result.messaggio;
            goodAlert.classList.remove('d-none');
            setTimeout(() => goodAlert.classList.add('d-none'), 5000);
            window.location.href = '/login';
        }
    });
});