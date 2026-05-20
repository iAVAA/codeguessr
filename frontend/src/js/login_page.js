document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const alertBox = document.getElementById('ErrorAlert');
    const goodAlert = document.getElementById('GoodAlert');

    form.addEventListener('submit', async (event) => {

        event.preventDefault()

        const datiForm = {

            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        };

        try{//provo a collegarmi

        const risposta = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datiForm)
        });

        const risultato = await risposta.json()
        if(!risposta.ok){

            
            alertBox.classList.remove('d-none');
            alertBox.textContent = risultato.errore;
            setTimeout(() => alertBox.classList.add('d-none'), 5000);
        }else{
            goodAlert.classList.remove('d-none');
            goodAlert.textContent = 'Login riuscito !: ' + risultato.messaggio;
            
            localStorage.setItem('id_giocatore', risultato.user); // Salvo l'ID utente per sessioni future
            localStorage.setItem('isLoggedIn', 'true'); // Flag per indicare che l'utente è loggato 
            localStorage.setItem('supabaseToken', risultato.token);
            localStorage.setItem('supabaseRefreshToken', risultato.refresh_token); // Per rinnovare il token scaduto
            window.location.href = '/home';
            form.reset()
        }
    } catch (errore){
        console.error("Errore di rete:", errore);
        alert("Impossibile connettersi al server.");
    }

    });
});