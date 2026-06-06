This is just a translation task, no need for file creation. Here's the translated README:

---

# Technical Architecture and System Specifications - CodeGuessr

Welcome to the architectural specification document for **CodeGuessr**. This document has been written to provide a comprehensive and rigorous technical overview of the overall system architecture, describing the database structure, frontend logic, real-time backend management, and artificial intelligence operational flows.

---

### Quick Links to Documentation
* **[Graphical Interface and Screenshot Gallery (SCREENSHOTS.md)](SCREENSHOTS.md)**
* **[Main Project README (../README.md)](../README.md)**

---

## 1. General Architectural Model

**CodeGuessr** adopts a **distributed, bidirectional real-time Client-Server architectural model**, combining the stability of classic REST services with the reactivity of persistent WebSocket connections.

The system is divided into three fundamental macro-levels:
1. **Frontend (Presentation Layer):** A multi-page web application based on vanilla technologies (HTML5, CSS3, JavaScript ES6) to maximize loading speed, accessibility, and compatibility. It integrates the client-side **Supabase** SDK for direct authentication and **Monaco Editor** for interactive display of code snippets.
2. **Backend (Application Layer):** A **Node.js** runtime server with the **Express.js** framework for exposing REST APIs and **Socket.io** for managing in-memory state and bidirectional real-time communication. It also acts as a secure proxy toward external services such as the **OpenRouter SDK** (for artificial intelligence) and the **GitHub Code Search APIs**.
3. **Database (Data Layer):** A relational **PostgreSQL** instance hosted on **Supabase**, enriched with ENUM types, dynamic aggregate views, complex referential integrity constraints, and system triggers written in PL/pgSQL (to automate sensitive business rules such as Level Ups).

```
                      +-------------------+
                      |   Browser Client  |
                      | (HTML/CSS/JS/SDK) |
                      +---------+---------+
                                |
             +------------------+------------------+
    HTTPS    |                                     | WebSockets
  (REST APIs)|                                     | (Socket.io)
             v                                     v
   +---------+---------+                 +---------+---------+
   |   Express Router  |                 |  Socket.io Server |
   | (HTTP Controllers)|                 |  (Match State Mc) |
   +---------+---------+                 +---------+---------+
             |                                     |
             +------------------+------------------+
                                |
                                v
                      +---------+---------+
                      |   Node.js Server  |
                      |  (Admin Supabase) |
                      +----+---------+----+
                           |         |
      Supabase PostgreSQL  |         | HTTPS (OpenRouter API / GitHub API)
  +------------------------v---+     |
  |  - Relational Tables       |     +-----> [ OpenAI gpt-4o-mini ]
  |  - Dynamic Profile View    |     |
  |  - Level-Up Trigger system |     +-----> [ GitHub Search Engine ]
  +----------------------------+
```

---

## 2. Database Architecture (Data Layer)

Data persistence is managed through PostgreSQL. The database implements strong referential coupling and automatic database-level logic to prevent inconsistencies and client-side manipulation.

<p align="center">
  <a href="db_scheme.svg">
    <img src="db_scheme.svg" alt="ER Relational Database Schema" />
  </a>
</p>

### Custom ENUM Types
To ensure maximum rigor in data constraints, the following ENUM domains have been defined:
* `stato_amicizia`: `('in_attesa', 'accettata', 'rifiutata', 'bloccato')`
* `modalita_partita`: `('1v1', 'ranked', 'amichevole', 'single_player')`
* `stato_partita`: `('in_corso', 'completata', 'annullata', 'waiting', 'in_progress', 'cancelled')`
* `risultato_partecipazione`: `('vittoria', 'sconfitta', 'pareggio')`

### Table Details

#### 1. `giocatore`
Extends Supabase's native authentication table (`auth.users`) via a `1:1` foreign key. Stores the player's public profile and statistics.
* `id_giocatore` (UUID, Primary Key, Foreign Key -> `auth.users(id)` ON DELETE CASCADE)
* `nickname` (TEXT, UNIQUE, NOT NULL)
* `exp` (INTEGER, Default: 0) - Experience Points accumulated within the current level.
* `livello` (INTEGER, Default: 1) - Player's game level.
* `trophies` (INTEGER, Default: 0) - Cumulative ranked score (trophies).
* `bio` (TEXT, Default: '')
* `avatar_url`, `banner_url` (TEXT) - Links to profile images hosted on Storage.
* `data_registrazione` (TIMESTAMPTZ, Default: `now()`)
* `attivo` (BOOLEAN, Default: false)

#### 2. `amicizia`
Represents a self-referencing recursive many-to-many relationship for managing the players' social network.
* `id_utente_a` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `id_utente_b` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `stato` (stato_amicizia, Default: `'in_attesa'`)
* `data_creazione` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)

#### 3. `partita`
Stores started game sessions.
* `id_partita` (BIGINT, Primary Key, Generated Always As Identity)
* `modalita` (modalita_partita, NOT NULL)
* `stato` (stato_partita, Default: `'in_corso'`)
* `data_inizio` (TIMESTAMPTZ, Default: `CURRENT_TIMESTAMP`)
* `data_fine` (TIMESTAMPTZ, Nullable)
* `id_utente_casa` (UUID, FK -> `giocatore(id_giocatore)` ON DELETE SET NULL)
* `id_utente_trasferta` (UUID, FK -> `giocatore(id_giocatore)` ON DELETE SET NULL)

#### 4. `partecipazione`
Many-to-many junction table that tracks the individual performance and rewards of each player within a match.
* `id_partita` (BIGINT, PK, FK -> `partita(id_partita)` ON DELETE CASCADE)
* `id_giocatore` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `risultato` (risultato_partecipazione, Nullable)
* `exp_guadagnata` (INTEGER, Default: 0)
* `trofei_cambiati` (INTEGER, Default: 0)

#### 5. `achievements`
Contains the predefined list of unlockable milestones/missions in the game.
* `id` (UUID, PK, Default: `gen_random_uuid()`)
* `name` (TEXT, UNIQUE, NOT NULL) - e.g. *'Dio dei Linguaggi'*, *'Notte Bianca'*.
* `description` (TEXT, NOT NULL)
* `exp_reward` (INTEGER, Default: 0)
* `trophy_reward` (INTEGER, Default: 0)
* `icon_url` (TEXT)
* `created_at` (TIMESTAMPTZ)

#### 6. `user_achievements`
Tracks which objectives have been unlocked by individual users and on what date.
* `user_id` (UUID, PK, FK -> `giocatore(id_giocatore)` ON DELETE CASCADE)
* `achievement_id` (UUID, PK, FK -> `achievements(id)` ON DELETE CASCADE)
* `unlocked_at` (TIMESTAMPTZ, Default: `now()`)

### Background PostgreSQL Logic (Database Level)

#### Dynamic Profile View (`v_giocatore_profilo`)
To maximize efficiency and eliminate redundancy anomalies (misaligned statistical data), the aggregate win, loss, and win-rate statistics of the profile are not physically stored on disk. They are instead calculated on-the-fly via an SQL view that LEFT JOINs the `giocatore` and `partecipazione` tables:
```sql
CREATE OR REPLACE VIEW public.v_giocatore_profilo AS
SELECT 
    g.id_giocatore, g.nickname, g.exp, g.livello, g.trophies, g.bio, g.avatar_url, g.banner_url, g.data_registrazione,
    COUNT(p.id_partita) AS partite_giocate,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria') AS partite_vinte,
    COUNT(p.id_partita) FILTER (WHERE p.risultato = 'sconfitta') AS partite_perse,
    CASE 
        WHEN COUNT(p.id_partita) > 0 THEN 
            ROUND((COUNT(p.id_partita) FILTER (WHERE p.risultato = 'vittoria')::NUMERIC / COUNT(p.id_partita)::NUMERIC) * 100, 2)
        ELSE 0 
    END AS percentuale_vittorie
FROM public.giocatore g
LEFT JOIN public.partecipazione p ON g.id_giocatore = p.id_giocatore
GROUP BY g.id_giocatore;
```

#### Auto-Level UP Trigger (`trigger_level_up`)
Player progression rules are protected at the database level. Every time a user's experience (`exp`) is inserted or updated, the trigger function `handle_giocatore_level_up()` is executed. If the experience exceeds the 500 XP threshold, the player automatically levels up and the remaining experience is carried over to the next level:
```sql
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

CREATE TRIGGER trigger_level_up
BEFORE INSERT OR UPDATE OF exp ON public.giocatore
FOR EACH ROW EXECUTE FUNCTION handle_giocatore_level_up();
```

---

## 3. Frontend Architecture (Client Layer)

The CodeGuessr client is structured to be modular and scalable, while maintaining an ultra-fast native setup without the overhead of heavy runtime frameworks.

```
frontend/
├── index.html                  # Landing Page / Initial Screen
└── src/
    ├── assets/                 # Static resources (Images, SFX, BGM)
    ├── css/                    # Structured stylesheets
    │   ├── style.css           # Main global compositor
    │   ├── styles/             # Aggregated atomic stylesheets
    │   │   ├── _base.css, _navbar.css, _footer.css, _loader.css, _utilities.css,
    │   │   └── _variables.css  # HSL palette, spacing, and theme (Dark/Light) definitions
    │   └── [pages]/            # Page-specific CSS (game, match, profile, etc.)
    ├── js/                     # Javascript logic modules
    │   ├── index.js            # Entry-point for the landing page
    │   ├── utils/
    │   │   └── ui_utils.js     # Shared UI components (Toasts and debounce)
    │   ├── managers/           # Persistent-state global services (Singletons)
    │   │   ├── auth.js         # Session manager, JWT, Login and automatic redirects
    │   │   ├── loader.js       # Visual transition and loading screen manager
    │   │   ├── settings.js     # Settings manager (Accessibility, animation reducer)
    │   │   ├── theme.js        # Dynamic theme manager (HSL variable synchronization)
    │   │   └── sound.js        # Audio system (Web audio buffer, looping BGM, feedback SFX)
    │   └── [pages]/            # Control scripts dedicated to individual views
    └── pages/                  # HTML views (reset_password, game_page, profile_page, etc.)
```

### Dynamic CSS Management
Aesthetic customization leverages the power of **CSS Variables** configured within `_variables.css`. This natively supports Light/Dark mode via the global `.light-theme` class applied to the `body` tag, and the `.reduce-transitions` accessibility setting that zeroes out transition effects for motion-sensitive users.

---

## 4. Backend Architecture (Server Layer)

The Node.js server is structured according to the **Modular Controller-Service** pattern. The `server.js` entry-point initializes core resources and bootstraps three independent controllers.

### 1. `server.js` (Bootstrap & Core Services)
* Configures the Express application (CORS, JSON parser, static folders).
* Initializes the Supabase administration client in privileged mode (to bypass Row Level Security and safely execute EXP, level, and statistics updates).
* Starts the native HTTP server by attaching the global `Socket.io` instance.
* Exports reusable utilities such as `updatePlayerStats` to centralize match result storage.

### 2. `controllers/code.js` (GitHub Search & Fallback)
Responsible for consistently providing high-quality code snippets to fuel the game.
* **GitHub Fetching Algorithm:** Executes advanced and randomized queries against the GitHub Search APIs (using target queries such as classic algorithms *Dijkstra, BST, QuickSort* or well-known frameworks *React, Express, Tkinter, Pandas*).
* **Cleanup Filter:** Analyzes the response, decodes the Base64, cleans the code by removing leading license, copyright, or blank block comments (up to a maximum of 30 lines), and trims the snippet to an optimal length for player readability.
* **Local Fallback:** In the event that the GitHub token exhausts its rate-limit or network issues arise, it loads precompiled JSON databases from memory (`db/snippets/`) ensuring the game continues to function offline.
* **REST API:**
  * `GET /api/random-snippet`: Returns a clean snippet excluding the last one served.
  * `POST /api/valuta-risposta`: Executes the LLM call to evaluate the player's explanation.

### 3. `controllers/missions.js` (Dynamic Achievements Engine)
Enables fluid management of game milestones without burdening the database.
* **Dynamic Progress Calculation:** When queried, calculates in real time the completion status of a user's missions by joining friendship data, match history (e.g. *consecutive wins*, matches played at night between 00:00 and 05:00 to unlock *"Notte Bianca"*), level, and profile statistics.
* **Background Auto-Redeem:** If it detects that a mission has exceeded the minimum threshold and has not yet been recorded as unlocked in the DB, it inserts the record into the `user_achievements` table in the background and directly updates the user's EXP and Trophies (which in turn activate the PostgreSQL Level Up trigger).

### 4. `controllers/socket.js` (Real-Time Game State Machine)
The operational core of CodeGuessr. Manages the reactivity of competitive and private multiplayer through a structured WebSocket protocol.

* **Handshake Middleware:** Every WebSocket connection is intercepted, the JWT token provided by the client is cleaned, its authenticity is verified via Supabase authentication, and the real-time player profile data is attached to the socket instance.
* **Resilient Disconnection Handling (120s Tolerance):** If a user drops due to network instability, the server does **not** immediately interrupt the match. The room is placed in a "suspended" state for a maximum of 120 seconds.
  * If the player reconnects within the deadline via `rejoinMatch`, the session is restored exactly from the current round by synchronizing the active snippet.
  * If the timeout expires without reconnection, the offline player is declared defeated by abandonment (HP zeroed) and the other user wins the match receiving the rewards.
  * Matchmaking rooms and direct challenges exchange the states shown in the following diagram.

```
            +---------------------------------+
            |  Offline / Main Screen          |
            +----------------+----------------+
                             |
                             | [startMatchmaking]
                             v
                    +----------------+
                    |  In Match Queue|
                    +--------+-------+
                             |
                             | [matchFound] (2 users ready)
                             v
                    +----------------+
                    | Lobby Screen   | <-----------+ (Rejoin)
                    +--------+-------+             |
                             |                     |
                             | (Both Ready)        |
                             v                     |
                    +----------------+             |
                    |  Round Start   |             |
                    +--------+-------+             |
                             |                     |
                             | [startRound]        |
                             v                     |
                    +----------------+             |
                    |  Game Timer    |             |
                    |    (Max 90s)   |             |
+-----------------> +--------+-------+             |
|                            |                     |
|                            | [submitAnswer]      |
|                            v                     |
|                   +----------------+             |
|                   |  AI Evaluation |             |
|                   +--------+-------+             |
|                            |                     |
|                            | [roundResult]       |
|                            v                     |
|                   +----------------+             |
|                   |  Damage Calc.  |             |
|                   +---+--------+---+             |
|                       |        |                 |
|      (Someone at 0 HP |        | (HP > 0 &       |
|   or Round 5 complete)|        | Round < 5)      |
|                       |        |                 |
|                       v        +-----------------+
|             +---------+--------+
|             |  Match Finished  |
|             | [matchFinished]  |
|             +------------------+
|
+--- If Disconnected (Start 120s Timer) -> If Rejoin success re-enters the flow
```

---

## 5. AI-Based Answer Evaluation Mechanism

The distinctive mechanism of CodeGuessr is its ability to evaluate the player's genuine technical understanding of code written in natural language.

### AI Evaluation Flow

```
[Client] sends written answer
   |
   v
[Express Controller (POST /api/valuta-risposta)]
   |
   v
[Read Prompt Template (db/llm/prompt.md)]
   |
   v
[Replace {{snippet}} and {{risposta}} placeholders]
   |
   v
[Call to OpenRouter API (model: gpt-4o-mini)]
   |
   v
[Generate structured JSON output]
   |
   v
[Server parses the score] --(On error)--> [Fallback: Standard Evaluator]
   |
   v
[Returns float score (0-100) to the match module]
```

### The System Prompt (`db/llm/prompt.md`)
The prompt assigns the language model the role of an **extremely strict, impartial technical evaluator**. The model must not simply verify whether the answer mentions keywords, but must analyze:
1. **Understanding of the main purpose:** Whether the player genuinely understood the algorithm (e.g. *Dijkstra* vs a generic *shortest path search*).
2. **Mathematical Precision of Complexity:** Verifies the accuracy with which **Big O** notation is determined (Time and Space).
3. **Correctness of Data Structures:** Explanation of the use of priority queues, arrays, trees, etc.

The output is strictly enforced in a structured JSON format containing the score (`punteggio`, a number from 0 to 100) and the detailed rationale (`valutazione`):
```json
{
  "punteggio": 85
  "valutazione": "AI answer"
}
```

This score is used in multiplayer mode as the basis for damage calculation: the absolute difference between the two opponents' scores is directly inflicted as damage to the HP of the player who provided the less accurate explanation.

---

## 6. Security and Optimizations

1. **API Key Protection:** All sensitive API keys (Supabase Service Key, GITHUB_TOKEN, OPENROUTER_API_KEY) are stored exclusively on the backend server in the protected `.env` file, preventing their exposure on the client.
2. **Cheating Prevention:** HP logic, snippet selection, score determination, and experience/trophy increments are entirely managed by the backend server. The client only sends the user's text input and receives read-only state updates.
3. **Socket Traffic Optimization:** Socket.io events exchange lightweight JSON objects and exclude all complex memory references (such as active timers or user socket references) through sanitization functions prior to sending.

---

### Quick Links to Documentation
* **[Graphical Interface and Screenshot Gallery (SCREENSHOTS.md)](SCREENSHOTS.md)**
* **[Main Project README (../README.md)](../README.md)**