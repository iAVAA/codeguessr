-- ============================================================================
-- CODEGUESSR - FINAL DATABASE SCHEMA
-- ============================================================================

-- ==========================================
-- 1. TIPI ENUM
-- ==========================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stato_amicizia') THEN
        CREATE TYPE stato_amicizia AS ENUM ('in_attesa', 'accettata', 'rifiutata', 'bloccato');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalita_partita') THEN
        CREATE TYPE modalita_partita AS ENUM ('1v1', 'ranked', 'amichevole', 'single_player');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stato_partita') THEN
        CREATE TYPE stato_partita AS ENUM ('in_corso', 'completata', 'annullata', 'waiting', 'in_progress', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risultato_partecipazione') THEN
        CREATE TYPE risultato_partecipazione AS ENUM ('vittoria', 'sconfitta', 'pareggio');
    END IF;
END $$;

-- ==========================================
-- 2. TABELLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.achievements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text NOT NULL,
    exp_reward integer DEFAULT 0,
    trophy_reward integer DEFAULT 0,
    icon_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT achievements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.giocatore (
    id_giocatore uuid NOT NULL,
    nickname text NOT NULL UNIQUE,
    exp integer DEFAULT 0,
    livello integer DEFAULT 1,
    data_registrazione timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    attivo boolean DEFAULT false,
    bio text DEFAULT ''::text,
    avatar_url text,
    banner_url text,
    trophies integer DEFAULT 0,
    CONSTRAINT giocatore_pkey PRIMARY KEY (id_giocatore),
    CONSTRAINT giocatore_id_giocatore_fkey FOREIGN KEY (id_giocatore) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.amicizia (
    id_utente_a uuid NOT NULL,
    id_utente_b uuid NOT NULL,
    stato stato_amicizia DEFAULT 'in_attesa'::stato_amicizia,
    data_creazione timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT amicizia_pkey PRIMARY KEY (id_utente_a, id_utente_b),
    CONSTRAINT amicizia_id_utente_a_fkey FOREIGN KEY (id_utente_a) REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    CONSTRAINT amicizia_id_utente_b_fkey FOREIGN KEY (id_utente_b) REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.partita (
    id_partita bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    modalita modalita_partita NOT NULL,
    stato stato_partita DEFAULT 'in_corso'::stato_partita,
    data_inizio timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    data_fine timestamp with time zone,
    id_utente_casa uuid,
    id_utente_trasferta uuid,
    CONSTRAINT partita_pkey PRIMARY KEY (id_partita),
    CONSTRAINT partita_id_utente_casa_fkey FOREIGN KEY (id_utente_casa) REFERENCES public.giocatore(id_giocatore) ON DELETE SET NULL,
    CONSTRAINT partita_id_utente_trasferta_fkey FOREIGN KEY (id_utente_trasferta) REFERENCES public.giocatore(id_giocatore) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.partecipazione (
    id_partita bigint NOT NULL,
    id_giocatore uuid NOT NULL,
    risultato risultato_partecipazione,
    exp_guadagnata integer DEFAULT 0,
    CONSTRAINT partecipazione_pkey PRIMARY KEY (id_partita, id_giocatore),
    CONSTRAINT partecipazione_id_partita_fkey FOREIGN KEY (id_partita) REFERENCES public.partita(id_partita) ON DELETE CASCADE,
    CONSTRAINT partecipazione_id_giocatore_fkey FOREIGN KEY (id_giocatore) REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_id),
    CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.giocatore(id_giocatore) ON DELETE CASCADE,
    CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. VISTA DINAMICA PROFILO
-- Calcola partite vinte, perse, rateo vittorie senza scrivere su DB manuale
-- ============================================================================
CREATE OR REPLACE VIEW public.v_giocatore_profilo AS
SELECT 
    g.id_giocatore,
    g.nickname,
    g.exp,
    g.livello,
    g.trophies,
    g.bio,
    g.avatar_url,
    g.banner_url,
    g.data_registrazione,
    -- Statistiche aggregate
    COUNT(p.id_partita) AS partite_giocate,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria') AS partite_vinte,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'sconfitta') AS partite_perse,
    -- Calcolo percentuale vittorie (Win Rate)
    CASE 
        WHEN COUNT(p.id_partita) > 0 THEN 
            ROUND((COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria')::NUMERIC / COUNT(p.id_partita)::NUMERIC) * 100, 2)
        ELSE 0 
    END AS percentuale_vittorie
FROM 
    public.giocatore g
LEFT JOIN 
    public.partecipazione p ON g.id_giocatore = p.id_giocatore
GROUP BY 
    g.id_giocatore;

-- ============================================================================
-- 4. TRIGGER SYSTEM (Auto-Level UP)
-- ============================================================================
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

DROP TRIGGER IF EXISTS trigger_level_up ON public.giocatore;
CREATE TRIGGER trigger_level_up
BEFORE INSERT OR UPDATE OF exp ON public.giocatore
FOR EACH ROW
EXECUTE FUNCTION handle_giocatore_level_up();