-- ==========================================
-- 1. TIPI ENUM (Necessari per i vincoli)
-- ==========================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stato_amicizia') THEN
        CREATE TYPE stato_amicizia AS ENUM ('in_attesa', 'accettata', 'bloccato');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalita_partita') THEN
        CREATE TYPE modalita_partita AS ENUM ('1v1', 'ranked', 'amichevole');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stato_partita') THEN
        CREATE TYPE stato_partita AS ENUM ('waiting', 'in_progress', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risultato_partecipazione') THEN
        CREATE TYPE risultato_partecipazione AS ENUM ('vittoria', 'sconfitta', 'pareggio');
    END IF;
END $$;

-- ==========================================
-- 2. TABELLA GIOCATORE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.giocatore (
    id_giocatore UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL UNIQUE,
    biografia TEXT DEFAULT 'Nessuna biografia impostata.',
    avatar_url TEXT,
    banner_url TEXT,

    exp INTEGER DEFAULT 0,
    livello INTEGER DEFAULT 1,
    partite_giocate INTEGER DEFAULT 0,
    partite_vinte INTEGER DEFAULT 0,
    partite_perse INTEGER DEFAULT 0,
    
    -- Usiamo GENERATED ALWAYS per garantire la coerenza automatica dei dati
    percentuale_vittorie NUMERIC GENERATED ALWAYS AS (
        CASE WHEN partite_giocate > 0 THEN (partite_vinte::NUMERIC / partite_giocate::NUMERIC) * 100 ELSE 0 END
    ) STORED,

    attivo BOOLEAN DEFAULT false,
    data_registrazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultimo_accesso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Funzione Trigger: Controlla se exp >= 500 e gestisce il level up
CREATE OR REPLACE FUNCTION handle_giocatore_level_up()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exp >= 500 THEN
        NEW.livello := NEW.livello + FLOOR(NEW.exp / 500);
        NEW.exp := NEW.exp % 500;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Prima di aggiornare o inserire un giocatore
CREATE TRIGGER trigger_level_up
BEFORE INSERT OR UPDATE OF exp ON public.giocatore
FOR EACH ROW
EXECUTE FUNCTION handle_giocatore_level_up();

-- ==========================================
-- 3. TABELLA AMICIZIA
-- ==========================================
CREATE TABLE IF NOT EXISTS public.amicizia (
    id_utente_a UUID REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    id_utente_b UUID REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    stato stato_amicizia DEFAULT 'in_attesa',
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_utente_a, id_utente_b)
);

-- ==========================================
-- 4. TABELLA PARTITA (Storico Generale)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.partita (
    id_partita BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modalita modalita_partita NOT NULL,
    stato stato_partita DEFAULT 'waiting',
    data_inizio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_fine TIMESTAMP WITH TIME ZONE,
    snippet_usato TEXT -- Riferimento opzionale allo snippet di codice giocato
);

-- ==========================================
-- 5. TABELLA PARTECIPAZIONE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.partecipazione (
    id_partita BIGINT REFERENCES public.partita(id_partita) ON DELETE CASCADE,
    id_giocatore UUID REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    risultato risultato_partecipazione,
    punteggio_ottenuto INTEGER DEFAULT 0,
    exp_guadagnata INTEGER DEFAULT 0,
    PRIMARY KEY (id_partita, id_giocatore)
);

-- ==========================================
-- 6. MISSIONI
-- ==========================================
CREATE TABLE IF NOT EXISTS public.missioni (
    id_missione UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titolo TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    xp_reward INTEGER DEFAULT 0,
    target_count INTEGER NOT NULL, -- Quante volte deve fare l'azione (es: 10 per "Vinci 10 partite")
    tipo_azione TEXT NOT NULL,      -- Tipo di azione da tracciare (es: 'win', 'play', 'perfect_score')
    icon_url TEXT
);

-- Tabella per tracciare il progresso individuale - (Relazione utenti, missioni)
CREATE TABLE IF NOT EXISTS public.giocatore_missioni (
    id_giocatore UUID REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    id_missione UUID REFERENCES public.missioni(id_missione) ON DELETE CASCADE,
    progresso_attuale INTEGER DEFAULT 0,
    completata BOOLEAN DEFAULT false,
    data_completamento TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id_giocatore, id_missione)
);