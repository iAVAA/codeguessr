-- 1. TABELLA UTENTI
CREATE TABLE users (
    -- Questo ID deve essere una Foreign Key collegata a auth.users(id)
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    
    -- Statistiche di Gioco
    exp INTEGER DEFAULT 0,  -- Punti Esperienza
    trophies INTEGER DEFAULT 0,  -- Coppe / MMR (Matchmaking Rating)
    games_played INTEGER DEFAULT 0,  -- Contatore partite giocate
    games_won INTEGER DEFAULT 0,  -- Contatore vittorie (Extra utile)
    
    -- Personalizzazione
    avatar_url TEXT,  -- Foto profilo
    
    -- Metadati
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELLA AMICI (Relazioni tra utenti)
CREATE TABLE friendships (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lo status ci permette di gestire richieste in sospeso, accettate o blocchi
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evita duplicati
    PRIMARY KEY (user_id, friend_id)
);

-- 3. CATALOGO ACHIEVEMENTS (Tutti gli obiettivi possibili nel gioco)
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,              -- es. "Primo Sangue", "Indovino"
    description TEXT NOT NULL,              -- es. "Vinci la tua prima partita"
    exp_reward INTEGER DEFAULT 0,           -- Quanta EXP dà sbloccarlo
    trophy_reward INTEGER DEFAULT 0,        -- Quante coppe bonus dà
    icon_url TEXT,                          -- Immagine del trofeo/achievement
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ACHIEVEMENTS SBLOCCATI DAGLI UTENTI
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (user_id, achievement_id)
);

-- 5. PARTITE
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL, -- es. '1v1', 'ranked', 'amichevole'
    status TEXT CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')) DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 6. PARTECIPANTI ALLA PARTITA E STORICO
CREATE TABLE match_participants (
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Statistiche della singola partita
    score INTEGER DEFAULT 0,             -- Punteggio ottenuto indovinendo il codice
    is_winner BOOLEAN DEFAULT FALSE,     -- Chi ha vinto
    
    -- Ricompense ottenute a fine partita
    exp_gained INTEGER DEFAULT 0,        
    trophies_changed INTEGER DEFAULT 0,  -- Può essere negativo
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (match_id, user_id)
);