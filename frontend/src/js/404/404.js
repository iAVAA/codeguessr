/*
    FILE: 404.js
    DESCRIPTION: File JS della pagina di errore 404
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

// Funzione per tornare alla home con delay per garantire la riproduzione del suono di click
function handleGoHome() {
    // Il click sul bottone riproduce in automatico il suono in sound.js.
    // Aggiungiamo un delay minimo prima del reindirizzamento effettivo.
    setTimeout(() => {
        window.location.href = '/home';
    }, 130);
}