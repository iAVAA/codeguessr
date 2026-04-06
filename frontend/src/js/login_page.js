const supabaseURL = 'https://npkgtinzieqlfdblunxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa2d0aW56aWVxbGZkYmx1bnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgzMDIsImV4cCI6MjA4ODkyNDMwMn0.-RpPiuRK0ZQex6NjdgXW0w8kmsUlVArqiofqGPshvps';

supabase = window.supabase.createClient(supabaseURL, supabaseKey);
// Mostra un messaggio di errore a schermo per 5 secondi

function schermataErrore(messaggio) {
    const container = document.getElementById('ErrorAlert');
    container.textContent = messaggio + " coglione!";
    container.classList.remove('d-none');
    setTimeout(() => container.classList.add('d-none'), 5000);
}

// Chiude il modal Bootstrap della registrazione
function chiudiModalRegistrazione() {
    const modalElement  = document.getElementById('RegistrationModal');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.hide();
}

 async function loginUtente(email, password) {
    const risultato = await supabase.auth.signInWithPassword({
        email: email,  
        password: password
    });
    if (risultato.error) {
        return { successo: false, errore: risultato.error.message };
    }else {
        return { successo: true };
    }
}


async function handleSubmitLogin(event) {

    event.preventDefault();

    email = document.getElementById('loginEmail').value;
    password = document.getElementById('loginPassword').value;
   

    const esito = await loginUtente(email, password);

    if (!esito.successo) {
        console.error('Errore Supabase:', esito.errore);
        schermataErrore(esito.errore);
        return;                             
    }

    document.getElementById('loginForm').reset();
    chiudiModalRegistrazione();
}


document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', handleSubmitLogin);
});