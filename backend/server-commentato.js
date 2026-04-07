

const express = require('express');
const app = express();

const PORT = process.env.PORT ;
const HOST = '0.0.0.0'; // per consentire accesso da tutti i dispositivi nella rete locale


const path = require('path'); // gestisce i percorsi dei file univoco per ogni sistema operativo
const ROOT = path.join(__dirname, '..','frontend'); // percorso alla cartella principale del progetto
//root punta ai file del frontend

app.use(express.static(ROOT)); // serve i file statici (html, css, js) dalla cartella frontend sennò CSS non funziona



//NAVIGAZIONE
/*

GET prende due campi:
  -URL: percorso a cui si vuole accedere
  -l'handler. funzione che viene eseguita quando si accede a quell'URL. prende due parametri:
    

Al momento dell'esecuzione di get non succede nulla, ciò che node.js fa è semplicemente salvare l'handler
e associarlo alla chiamata, in questo modo quando una chiamata arriva:
  - node.js controlla se è stato registrato un handler per quella chiamata
  - prende i parametri della chiamata e istanzia due oggetti che vanno passati come input all'handler (req,res):

    - req: serve per accedere ai campi passati in input alla richiesta
    - res: server per aprire un canale di comunicazione in uscita verso il client


*/

//send file invia un file al cliente
app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT, 'index.html')); // serve il file index.html quando si accede alla radice del server
})

//node js ha ora associato una chiamata all'url '/' a un handler che abbiamo specificato


//QUERY SU DATABASE
//righe di setup, qui ci va messo il servizio che si sceglie per il db
const {createClient} = require("@supabase/supabase-js")
const supabaseApi = 'https://ttvnuhkuwllmxlhiqxba.supabase.co'
const supabaseApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0dm51aGt1d2xsbXhsaGlxeGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDE4OTMsImV4cCI6MjA5MTExNzg5M30.xhchaHmKke3Kt8SAtOkJX99F-bGyoFgIWwKPE5JAN0g'
const supabase = createClient(supabaseApi,supabaseApiKey) 


//cenni su connessione ASYNC
/*
una funzione asyncrona ritorna un oggetto speciale detto PROMESSA e può avere tre stati:
  - pending: la funzione sta ancora facendo
  - resolve: la funzione è terminata e il suo valore di ritorno è disponibile
  - rejected: la funzione il valore di ritorno non c'è ma c'è val di errore

una funzione asincrona può essere invocata in due modi:
  -await: sia C che chiama D. se D è asincrona e C invoca D tramite await allora C bloccherà il suo flusso
          di esecuzione al momento della chiamata. C attende che la promessa che ritorna D da pending va o resolved o rejected
  Quando C chiama D tramite await(D è asincrona) anche C diventa asincrona. l'asincronia si propaga
  il compilatore infatti ci obbliga a dichiarare C tramite async
  .In pratica ho un monothread

  -senza await: C non blocca il flusso di esecuzione ma continua operazioni(non aspetta che la promessa esce da stato pending)
                quindi se ho un operazione di C che richiede un dato di D quel dato non è dettto che sia disponibile
  .
  multithreading


*/