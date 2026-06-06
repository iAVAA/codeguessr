# CodeGuessr

Welcome to **CodeGuessr**, the game where you test your real developer skills: reading, understanding, and explaining code!

## What is CodeGuessr?

Unlike traditional programming games, here you do not simply guess the language. Your objective is to **analyze** a code snippet and **explain** exactly what it does, which algorithm it implements, and what its *computational complexity* is.

## How to Play

1. **Observe the Code:** In each round, a code "snippet" will be displayed in the editor.
2. **Analyze Thoroughly:** Read the code line by line. Understand the data structures being used, loops, and try to determine the *Big O Notation* (time and space complexity).
3. **Explain Your Solution:** On the right side, you will find a large text box. Write your detailed analysis describing the purpose of the algorithm (e.g., *"This is the Fibonacci sequence computed using dynamic programming with O(n) space complexity"*).
4. **Points and Health:** Your answers will be evaluated by our system. Superficial responses will damage your HP, while accurate, detailed, and technical analyses will grant you lots of XP to level up!

## Game Modes

* **Single Player:** Play solo and train against the Bot. Choose the difficulty (Easy, Medium, Hard) and test your *code-reading* abilities by analyzing known algorithms or logical traps to earn Experience Points (XP) and Trophies.
* **Multiplayer:** Add other programmers to your "Friends List" and challenge them in real-time head-to-head matches! The player with the most accurate and detailed explanation wins the Round.

---

## Project Structure

```text
codeguessr/
├── backend/                                  # Node.js Server & realtime API (WebSockets)
│   ├── controllers/                          # Core application logic
│   │   ├── code.js                           # Snippet handling and LLM integration via OpenRouter
│   │   ├── missions.js                       # Daily/weekly missions and objectives
│   │   └── socket.js                         # Matchmaking, lobby and Socket.io orchestration
│   ├── middleware/                           # Security and validation middleware
│   │   └── auth.js                           # Validation of JWTs issued by Supabase
│   ├── .env.example                          # Required environment variables
│   ├── package.json                          # Backend dependencies (Express, Socket.io, Supabase)
│   └── server.js                             # HTTP + WebSocket server entry point
│
├── db/                                       # Database and LLM configurations
│   ├── llm/                                  # AI prompts and instructions
│   │   └── prompt.md                         # Evaluation rules for GPT-4o-mini
│   ├── snippets/                             # Offline code snippets (JSON fallback)
│   │   ├── java_snippets.json                # Java snippets
│   │   ├── javascript_snippets.json          # JavaScript snippets
│   │   └── python_snippets.json              # Python snippets
│   └── schema.sql                            # PostgreSQL schema (DDL, triggers, RPC, views)
│
├── docs/                                     # Technical documentation and visual resources
│   ├── db_scheme.svg                         # Database ER diagram
│   ├── ARCHITETTURA.md                       # Architectural specifications
│   ├── SCREENSHOTS.md                        # Application screenshots gallery
│   └── screenshots/                          # App screenshots
│
├── frontend/                                 # Client application (HTML, CSS, JavaScript)
│   ├── index.html                            # Landing page (login / registration)
│   ├── src/
│   │   ├── assets/                           # Static multimedia resources
│   │   │   ├── icons/                        # SVGs, favicon, and UI icons
│   │   │   ├── img/                          # Logo, badges, avatars, and images
│   │   │   └── music/                        # Music and sound effects
│   │   │
│   │   ├── css/                              # Modular stylesheet files
│   │   │   ├── styles/                       # Global design system
│   │   │   │   ├── _variables.css            # UI tokens (colors, fonts, spacing)
│   │   │   │   ├── _base.css                 # Reset and base styles
│   │   │   │   ├── _navbar.css               # Navigation bar
│   │   │   │   ├── _responsive.css           # Responsive media queries
│   │   │   │   └── ...                       # Loader, modals, footer, utilities
│   │   │   ├── game_page/                    # Training page styles
│   │   │   ├── leaderboard_page/             # Global leaderboard styles
│   │   │   ├── match_page/                   # Multiplayer and countdown styles
│   │   │   ├── profile_page/                 # User profile and statistics styles
│   │   │   └── style.css                     # Global CSS entry point
│   │   │
│   │   ├── js/                               # Modular JavaScript logic
│   │   │   ├── managers/                     # Singletons and global state
│   │   │   │   ├── auth.js                   # User session and Supabase client
│   │   │   │   ├── multiplayer.js            # WebSocket events and lobby
│   │   │   │   ├── settings.js               # User preferences
│   │   │   │   ├── sound.js                  # Audio and sound effects management
│   │   │   │   └── theme.js                  # Dynamic Light/Dark theme
│   │   │   ├── utils/                        # Shared utilities and DOM helpers
│   │   │   ├── game_page/                    # Training and missions logic
│   │   │   ├── leaderboard_page/             # Ranking API and pagination
│   │   │   ├── match_page/                   # Multiplayer, timer, and validations
│   │   │   ├── profile_page/                 # Badges, history, and friendships
│   │   │   ├── 404/                          # Error page animation
│   │   │   └── index.js                      # Main landing page script
│   │   │
│   │   └── pages/                            # Application HTML screens
│   │       ├── game_page.html                # Training mode
│   │       ├── match_page.html               # Real-time multiplayer
│   │       ├── leaderboard_page.html         # Global leaderboard
│   │       ├── profile_page.html             # User profile and statistics
│   │       ├── reset_password.html           # Password reset request
│   │       ├── reset_password_completo.html  # Final password change
│   │       └── 404.html                      # Custom error page
│
├── package.json                              # Global scripts (install-all, run, build)
├── LICENSE                                   # MIT License
└── README.md                                 # Main overview and documentation
```

---

## Technical Documentation

For an in-depth understanding of the technical specifications and design choices of the project, refer to:

* **[System Architecture (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**: Complete analysis of the Client-Server pattern, WebSockets, CSS/JS modularity, SQL trigger logic, and LLM prompts.
* **[User Interface & Screenshot Gallery (docs/SCREENSHOTS.md)](docs/SCREENSHOTS.md)**: Detailed visual overview of the game screens with described screenshots.

---

<p align="center">
  <a href="docs/db_scheme.svg">
    <img src="docs/db_scheme.svg" alt="Database ER Relational Schema" />
  </a>
</p>

---

## Installation (Usage)

If you want to run and contribute to the project locally in your development environment:

1. Clone the repository:

   ```bash
   git clone https://github.com/iAVAA/codeguessr.git
   ```

2. Navigate into the project folder:

   ```bash
   cd codeguessr
   ```

3. Install dependencies:

   ```bash
   npm run install-all
   ```

4. Start the web server in development mode:

   ```bash
   npm run dev
   ```

## Authors

Developed by:

* **Salvatore Iavarone**
* **Michele Pio Forlani**

## License (MIT)

This project is distributed under the **MIT** license. See the [`LICENSE`](LICENSE) file for more details.