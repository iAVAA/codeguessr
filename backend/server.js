require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require("@supabase/supabase-js"); // Spostato in cima

const app = express();

// ==========================================
// CONFIGURAZIONE AMBIENTE
// ==========================================
const PORT = process.env.PORT || 3000; // Aggiunto fallback di sicurezza
const HOST = '0.0.0.0'; 
const ROOT = path.join(__dirname, '..', 'frontend'); 

// ==========================================
// INIZIALIZZAZIONE SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY; // Usiamo il nome standard della dashboard
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.static(ROOT)); 
app.use(express.json());

// ==========================================
// ROTTE DI NAVIGAZIONE (GET)
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html')); 
});

app.get('/porco', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html')); 
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(ROOT, 'src','pages', 'game_page.html')); 
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(ROOT, 'src','pages', 'login_page.html')); 
});

// ==========================================
// API REGISTRAZIONE GIOCATORE (POST)
// ==========================================
app.post('/api/registrazione', async (req, res) => {
    // 1. Estraggo i dati che il frontend mi ha appena inviato
    const { email, password, nickname } = req.body;

    try {
        // 2. Passo 1: Registrazione sicura su Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (authError) throw authError;

        // Recupero l'ID univoco (UUID) appena generato da Supabase
        const nuovoIdGiocatore = authData.user.id; 

        // 3. Passo 2: Creo il profilo di gioco nella nostra tabella
        const { error: dbError } = await supabase
            .from('giocatore')
            .insert([
                {
                    id_giocatore: nuovoIdGiocatore, // Colleghiamo le due tabelle!
                    nickname: nickname
                }
            ]);

        if (dbError) throw dbError;

        // 4. Se tutto è andato bene, avviso il frontend
        res.status(201).json({ messaggio: 'Registrazione completata con successo!' });

    } catch (errore) {
        console.error("Errore durante la registrazione:", errore);
        res.status(400).json({ errore: errore.message }); 
    }
});

app.post('/api/login', async (req, res) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: req.body.email,
        password: req.body.password
    });

    if (error) {
       console.error("Errore durante il login:", error.message);
       return res.status(401).json({ errore: 'Credenziali non valide. Riprova.' });
       
    }
    
    
    return res.status(200).json({ 
      messaggio: 'Login completato con successo!', 
      user: data.user.id 
    });
    

});


// ==========================================
// AVVIO SERVER
// ==========================================
app.listen(PORT, HOST, () => {
    console.log(`Server in esecuzione su http://localhost:${PORT}`);
});