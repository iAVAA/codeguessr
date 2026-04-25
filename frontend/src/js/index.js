document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const loginBtn = document.getElementById('btn_login');

    loginBtn.addEventListener('click', () => {
        
        window.location.href = '/login';
    });

    form.addEventListener('submit', async (event) => {

        event.preventDefault()

        const datiForm = {

            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            nickname: document.getElementById('registerUsername').value

        };

        console.log("invio i dati al server");


        try{//provo a collegarmi

        const risposta = await fetch('/api/registrazione', {

            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(datiForm)

        });

        const risultato = await risposta.json()

        if(!risposta.ok){

            const alertBox = document.getElementById('modalErrorAlert');
            alertBox.classList.remove('d-none');
            alertBox.textContent = risultato.errore;
            setTimeout(() => alertBox.classList.add('d-none'), 5000);

        }else{
            alert('Ha funzionato !: ' + risultato.messaggio);
            //TODO:
            //reinderizzo utente in home page
            localStorage.setItem('id_giocatore', risultato.user); // Salvo l'ID utente per sessioni future
            localStorage.setItem('isLoggedIn', 'true'); // Flag per indicare che l'utente è loggato
            localStorage.setItem('supabaseToken', risultato.token);
            window.location.href = '/home';
            form.reset()
        }

    } catch (errore){
        console.error("Errore di rete:", errore);
        alert("Impossibile connettersi al server.");
    }

    });

});