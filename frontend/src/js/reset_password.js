// CORREZIONE 1: Usa addEventListener per ascoltare il caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetPasswordForm');
    const formVisibile = document.getElementById('form_visibile');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        alert('Invio richiesta di reset password...');

        // CORREZIONE 2: L'ID esatto nel tuo HTML è 'resetEmail', non 'email'
        const email = document.getElementById('resetEmail').value; 
        const divCompleto = document.getElementById('div_nascosto');
        
        try {
            const response = await fetch('/api/reset_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
        
            const result = await response.json();
            
            
        alert(result.messaggio); 
        
        form.reset();
        formVisibile.classList.add('d-none'); // Nascondi il form dopo l'invio
        divCompleto.classList.remove('d-none');

            
           
        } catch (error) {
            console.error("Errore di rete:", error);
            alert("Impossibile connettersi al server.");
        }
    });
});