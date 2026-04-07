// CORREZIONE 1: Usa addEventListener per ascoltare il caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        alert('Invio richiesta di reset password...');

        // CORREZIONE 2: L'ID esatto nel tuo HTML è 'resetEmail', non 'email'
        const email = document.getElementById('resetEmail').value; 
        
        try {
            const response = await fetch('/api/reset_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
        
            const result = await response.json();
            
            if (response.ok) {
                alert(result.messaggio); 
                window.location.href = '/login';
                form.reset();
            } else {
                const alertBox = document.getElementById('ErrorAlert');
                // Assicurati di avere un div con id="ErrorAlert" nel tuo HTML!
                if (alertBox) {
                    alertBox.classList.remove('d-none');
                    alertBox.textContent = result.errore;
                    setTimeout(() => alertBox.classList.add('d-none'), 5000);
                } else {
                    alert(result.errore); // Piano B se l'alertBox non esiste
                }
            }  
        } catch (error) {
            console.error("Errore di rete:", error);
            alert("Impossibile connettersi al server.");
        }
    });
});