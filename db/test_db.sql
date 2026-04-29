-- Tabelle di base
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  exp_reward integer DEFAULT 0,
  trophy_reward integer DEFAULT 0,
  icon_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.giocatore (
  id_giocatore uuid NOT NULL,
  nickname text NOT NULL UNIQUE,
  exp integer DEFAULT 0,
  livello integer DEFAULT 1,
  trophies integer DEFAULT 0,  -- Aggiunti i trofei!
  data_registrazione timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  attivo boolean DEFAULT false,
  bio text DEFAULT ''::text,
  avatar_url text,
  banner_url text,
  CONSTRAINT giocatore_pkey PRIMARY KEY (id_giocatore),
  CONSTRAINT giocatore_id_giocatore_fkey FOREIGN KEY (id_giocatore) REFERENCES auth.users(id)
);

CREATE TABLE public.amicizia (
  id_utente_a uuid NOT NULL,
  id_utente_b uuid NOT NULL,
  stato USER-DEFINED DEFAULT 'in_attesa'::stato_amicizia,
  data_creazione timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT amicizia_pkey PRIMARY KEY (id_utente_a, id_utente_b),
  CONSTRAINT amicizia_id_utente_a_fkey FOREIGN KEY (id_utente_a) REFERENCES public.giocatore(id_giocatore),
  CONSTRAINT amicizia_id_utente_b_fkey FOREIGN KEY (id_utente_b) REFERENCES public.giocatore(id_giocatore)
);

CREATE TABLE public.partita (
  id_partita bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  modalita USER-DEFINED NOT NULL,
  stato USER-DEFINED DEFAULT 'in_corso'::stato_partita,
  data_inizio timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  data_fine timestamp with time zone,
  CONSTRAINT partita_pkey PRIMARY KEY (id_partita)
);

CREATE TABLE public.partecipazione (
  id_partita bigint NOT NULL,
  id_giocatore uuid NOT NULL,
  risultato USER-DEFINED,
  exp_guadagnata integer DEFAULT 0,
  CONSTRAINT partecipazione_pkey PRIMARY KEY (id_partita, id_giocatore),
  CONSTRAINT partecipazione_id_partita_fkey FOREIGN KEY (id_partita) REFERENCES public.partita(id_partita),
  CONSTRAINT partecipazione_id_giocatore_fkey FOREIGN KEY (id_giocatore) REFERENCES public.giocatore(id_giocatore)
);

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_id),
  CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.giocatore(id_giocatore),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id)
);

-- ============================================================================
-- VISTA DINAMICA PROFILO
-- Questa Vista unisce la tabella 'giocatore' con i calcoli aggregati in tempo reale
-- prelevati dalla tabella 'partecipazione'.
-- In questo modo non devi aggiornare manualmente le statistiche!
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