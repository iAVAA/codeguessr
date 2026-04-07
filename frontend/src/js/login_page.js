document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
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

            const alertBox = document.getElementById('ErrorAlert');
            alertBox.classList.remove('d-none');
            alertBox.textContent = risultato.errore;
            setTimeout(() => alertBox.classList.add('d-none'), 5000);
        }else{
            alert('Login riuscito !: ' + risultato.messaggio);
            localStorage.setItem('userId', risultato.user); // Salvo l'ID utente per sessioni future
            localStorage.setItem('isLoggedIn', 'true'); // Flag per indicare che l'utente è loggato
            window.location.href = '/home';
            form.reset()
        }
    } catch (errore){
        console.error("Errore di rete:", errore);
        alert("Impossibile connettersi al server.");
    }

    });
});