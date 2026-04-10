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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usiamo il nome standard della dashboard
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

app.get('/reset_password.html', (req, res) => {
    res.sendFile(path.join(ROOT, 'src','pages', 'reset_password.html')); 
});

app.get('/profilo', (req, res) => {
    res.sendFile(path.join(ROOT, 'src', 'pages', 'profile_page.html')); 
});

/**
 * 
 *  da in dati nel seguente formato:
 * { 
 *  "userid": "123e4567-e89b-12d3-a456-426614174000",
 *  "user": "nickname_del_giocatore",
 *  "livello": 5,
 *  "exp": 1500
 * }    
 * 
 * una volta presa il return si possono usare facendo 
 *  
 *  const res = await fetch(`/api/profilo/${idGiocatore}`);
 *  if (!res.ok) throw new Error(`Profilo non trovato (${res.status})`);
 * 
 *  const playerData = await res.json();
 * 
 * 
 *  playerData.user -> nickname_del_giocatore
 *  playerData.livello -> 5
 *  playerData.exp -> 1500
 *  playerData.userid -> "123e4567-e89b-12d3-a456-426614174000"
 *  
 *  
 * 
 */

// Dati completi del profilo giocatore
app.get('/api/amici/:id', async (req, res) => {
    const mioId = req.params.id;

    try {
        // 1. Troviamo TUTTE le relazioni dove compaio io (sia come A che come B)
        // Non filtriamo più per 'accettata', prendiamo tutto (amici, in attesa, ecc.)
        const { data: relazioni, error: relError } = await supabase
            .from('amicizia')
            .select('id_utente_a, id_utente_b, stato')
            .or(`id_utente_a.eq.${mioId},id_utente_b.eq.${mioId}`);

        if (relError) throw relError;

        // Se l'utente non ha nessun amico e nessuna richiesta, mandiamo le liste vuote
        if (!relazioni || relazioni.length === 0) {
            return res.status(200).json({ amici: [], inviate: [], ricevute: [] });
        }

        // 2. Estraiamo gli ID delle altre persone (gli amici o aspiranti tali)
        const idAltriUtenti = relazioni.map(riga => 
            riga.id_utente_a === mioId ? riga.id_utente_b : riga.id_utente_a
        );

        // 3. LA MAGIA: Chiediamo a Supabase i veri NOMI di quegli ID in un colpo solo!
        const { data: profili, error: profiliError } = await supabase
            .from('giocatore')
            .select('id_giocatore, nickname')
            .in('id_giocatore', idAltriUtenti); 

        if (profiliError) throw profiliError;

        // Creiamo un "dizionario" per trovare i nomi velocemente
        const mappaProfili = {};
        profili.forEach(p => { mappaProfili[p.id_giocatore] = p.nickname; });

        // 4. LO SMISTAMENTO (La logica pura A->B)
        const risultato = { 
            amici: [], 
            inviate: [], 
            ricevute: [] 
        };

        relazioni.forEach(riga => {
            // Capiamo chi siamo noi in questa specifica riga
            const sonoIoIlMittente = (riga.id_utente_a === mioId);
            
            // Troviamo l'ID dell'altra persona
            const idAltro = sonoIoIlMittente ? riga.id_utente_b : riga.id_utente_a;
            
            // Assembliamo l'oggetto utente da mandare al frontend
            const utente = { 
                userid: idAltro, 
                user: mappaProfili[idAltro] || "Utente Sconosciuto" 
            };

            // Mettiamolo nel cesto giusto!
            if (riga.stato === 'accettata') {
                risultato.amici.push(utente);
            } 
            else if (riga.stato === 'in_attesa') {
                if (sonoIoIlMittente) {
                    // Ero in id_utente_a, quindi l'ho INVIATA IO
                    risultato.inviate.push(utente); 
                } else {
                    // Ero in id_utente_b, quindi l'ho RICEVUTA (devo accettarla o rifiutarla)
                    risultato.ricevute.push(utente); 
                }
            }
        });

        // 5. Consegnamo il pacchetto perfetto e diviso al Frontend
        res.status(200).json(risultato);

    } catch (err) {
        console.error("Errore recupero/smistamento amici:", err.message);
        res.status(500).json({ errore: 'Errore server interno' });
    }
});

// Recupero dati profilo giocatore
app.get('/api/profilo/:id', async (req, res) => {
    const idDaCercare = req.params.id; // L'ID che ci manderà il frontend

    try {
        // Chiediamo a Supabase di cercare questo giocatore
        const { data, error } = await supabase
            .from('giocatore')
            .select('nickname, livello, exp')
            .eq('id_giocatore', idDaCercare)
            .single(); // Vogliamo un solo risultato

        if (error) throw error;

        

        // Se lo trova, mandiamo i dati al frontend
        res.status(200).json({
            userid: idDaCercare,
            user: data.nickname,
            livello: data.livello,
            exp: data.exp
        });

    } catch (err) {
        console.error("Errore recupero profilo:", err.message);
        res.status(500).json({ errore: 'Impossibile recuperare il profilo' });
    }
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
        res.status(201).json({ 
            messaggio: 'Registrazione completata con successo!',
            user: nuovoIdGiocatore // Inviamo l'ID al frontend per usi futuri       
         });

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

app.post('/api/reset_password', async (req, res) => {
    const { email } = req.body;

    try {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            options: {
                redirectTo: 'http://localhost:3000/login' // Reindirizza al login dopo il reset
            }
        });
        if (error) throw error;

        res.status(200).json({ messaggio: 'Email di reset inviata con successo!' });

    } catch (err) {
        console.error("Errore durante il reset della password:", err.message);
        res.status(400).json({ errore: 'Impossibile inviare l\'email di reset.' });
    }
});

// ==========================================
// AVVIO SERVER
// ==========================================
app.listen(PORT, HOST, () => {
    console.log(`Server in esecuzione su http://localhost:${PORT}`);
});