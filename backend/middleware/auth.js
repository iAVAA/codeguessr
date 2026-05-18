const { supabase } = require('../server');

async function verificaToken(req, res, next) {
    const authHeader = req.get('Authorization');
    
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({ errore: 'Token mancante o non valido.' });
    }

    const token = authHeader.substring(7).trim().replace(/['"]/g, '');

    const { data: authData, error } = await supabase.auth.getUser(token);
    
    if (error || !authData.user) {
        return res.status(401).json({ errore: 'Token non valido o scaduto.' });
    }

    req.utenteId = authData.user.id; // salva l'id per usarlo nella route
    next(); // vai avanti
}

module.exports = verificaToken;
