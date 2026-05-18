/*
    FILE: code.js
    DESCRIPTION: Gestore del caricamento del codice da GitHub e del valutatore dell'LLM di OpenRouter
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

const process = require('process');
const fs = require('fs');
const path = require('path');

// Mappa estensione file -> nome linguaggio supportato da Monaco Editor
const EXT_TO_MONACO = {
    js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    c: 'c', h: 'c', cs: 'csharp', go: 'go', rs: 'rust', kt: 'kotlin',
    swift: 'swift', php: 'php', lua: 'lua', r: 'r', scala: 'scala',
    sh: 'shell', bash: 'shell', sql: 'sql', html: 'html', css: 'css',
    json: 'json', yml: 'yaml', yaml: 'yaml', xml: 'xml', md: 'markdown'
};

// Query ottimizzate per la ricerca di codice su GitHub
const GITHUB_QUERIES = [
    // --- Algoritmi classici e Strutture Dati (Ottimi per riconoscere la logica) ---
    { q: 'def dijkstra in:file language:python size:>200', ext: 'py' },
    { q: 'class BinarySearchTree in:file language:java size:>200', ext: 'java' },
    { q: 'void quickSort in:file language:cpp size:>150', ext: 'cpp' },
    { q: 'A* pathfinding node in:file language:csharp size:>250', ext: 'cs' },
    
    // --- Sviluppo Web e Framework (Molto riconoscibili dai pattern) ---
    { q: 'express app.listen req res in:file language:javascript size:>150', ext: 'js' },
    { q: 'import React useState useEffect in:file language:javascript size:>200', ext: 'js' },
    { q: 'class extends models.Model in:file language:python size:>150', ext: 'py' },
    { q: '@RestController @RequestMapping in:file language:java size:>200', ext: 'java' },

    // --- LeetCode mirato (Cerca direttamente la firma del metodo per assicurarsi ci sia codice) ---
    { q: 'class Solution def twoSum in:file language:python size:>100', ext: 'py' },
    { q: 'public ListNode reverseList in:file language:java size:>150', ext: 'java' },
    { q: 'vector<int> dp in:file language:cpp size:>150', ext: 'cpp' },

    // --- Script, Automazione e Utility reali ---
    { q: 'import tkinter as tk in:file language:python size:>250', ext: 'py' },
    { q: 'async function fetch async await in:file language:javascript size:>150', ext: 'js' },
    { q: 'CREATE TABLE PRIMARY KEY FOREIGN KEY language:sql size:>100', ext: 'sql' },
    { q: 'import pandas as pd dataframe in:file language:python size:>200', ext: 'py' }
];

// Snippet locali di fallback usati in caso di offline, rate limit o errori di rete con le API di GitHub.
// Vengono caricati esternamente dalla cartella db/snippets per maggiore manutenibilità.
const FALLBACK_SNIPPETS = [
    require('../../db/snippets/java_snippets.json'),
    require('../../db/snippets/javascript_snippets.json'),
    require('../../db/snippets/python_snippets.json'),
];

// Stato in memoria per evitare la ripetizione immediata dell'ultimo snippet servito
let lastPublicSnippetCode = null;

// Riferimento singleton per il client OpenRouter
let openrouter = null;

/**
 * Inizializza o restituisce l'istanza singleton del client OpenRouter SDK.
 * @returns {Promise<Object>} Client OpenRouter configurato
 */
async function getOpenRouter() {
    if (!openrouter) {
        const { OpenRouter } = await import('@openrouter/sdk');
        openrouter = new OpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/iAVAA/codeguessr',
                'X-Title': 'CodeGuessr'
            }
        });
    }
    return openrouter;
}

/**
 * Seleziona uno snippet casuale dal pool locale di fallback.
 * @param {string|null} previousCode - Codice dello snippet precedente da escludere (opzionale)
 * @returns {Object} Snippet di codice di fallback
 */
function buildFallbackSnippet(previousCode = null) {
    const pool = previousCode
        ? FALLBACK_SNIPPETS.filter(s => s.code !== previousCode)
        : FALLBACK_SNIPPETS;

    const sourcePool = pool.length > 0 ? pool : FALLBACK_SNIPPETS;
    const choice = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    return { ...choice };
}

/**
 * Recupera uno snippet di codice casuale da GitHub Code Search API.
 * Filtra i file per l'estensione desiderata, salta le intestazioni di licenza/commenti e tronca a 45 righe.
 * @returns {Promise<Object>} Snippet di codice GitHub formattato per il frontend
 */
async function getRandomSnippet() {
    if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN non configurato');
    }

    // Scegliamo una query e una pagina (1-3) casuali per massimizzare la varietà
    const queryObj = GITHUB_QUERIES[Math.floor(Math.random() * GITHUB_QUERIES.length)];
    const page = Math.floor(Math.random() * 3) + 1;

    const headers = {
        'User-Agent': 'CodeGuessr-Server',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`
    };

    // Usiamo la query ottimizzata esattamente come definita
    const codeSearchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(queryObj.q)}&per_page=30&page=${page}`;

    const codeRes = await fetch(codeSearchUrl, { headers });
    if (!codeRes.ok) throw new Error(`Code search failed: ${codeRes.status}`);

    const codeData = await codeRes.json();
    if (!codeData.items || codeData.items.length === 0) {
        throw new Error(`Nessun file trovato per la query: ${queryObj.q}`);
    }

    // Filtriamo i risultati
    let filteredItems = codeData.items.filter(item => {
        const itemExt = item.name.split('.').pop().toLowerCase();
        return itemExt === queryObj.ext;
    });

    // In assenza di file con estensione esatta, utilizziamo i risultati disponibili
    if (filteredItems.length === 0) {
        filteredItems = codeData.items;
    }

    const file = filteredItems[Math.floor(Math.random() * filteredItems.length)];
    const repoFullName = file.repository.full_name;

    const contentRes = await fetch(file.url, { headers });
    if (!contentRes.ok) throw new Error(`Content fetch failed: ${contentRes.status}`);
    const contentData = await contentRes.json();

    // Decodifica il contenuto base64 del file
    let rawCode = Buffer.from(contentData.content, 'base64').toString('utf-8');
    const lines = rawCode.split('\n');

    // salta licenze, copyright e commenti lunghi di intestazione (max 30 righe)
    let start = 0;
    while (start < lines.length && start < 30) {
        const trimmed = lines[start].trim();
        if (trimmed.length === 0 || 
            trimmed.startsWith('//') || 
            trimmed.startsWith('#') || 
            trimmed.startsWith('/*') || 
            trimmed.startsWith('*') || 
            trimmed.startsWith('"""') || 
            trimmed.toLowerCase().includes('copyright') || 
            trimmed.toLowerCase().includes('license')) {
            start++;
        } else {
            break;
        }
    }

    // Se abbiamo saltato quasi l'intero file, ripartiamo dall'inizio effettivo non vuoto
    if (start >= lines.length - 5) {
        start = lines.findIndex(l => l.trim().length > 0);
        if (start === -1) start = 0;
    }

    // Estrae l'intero codice rimanente partendo dall'inizio pulito individuato
    rawCode = lines.slice(start).join('\n');

    const ext = file.name.split('.').pop().toLowerCase();
    const monacoLang = EXT_TO_MONACO[ext] || EXT_TO_MONACO[queryObj.ext] || 'plaintext';

    return {
        code: rawCode,
        monacoLang,
        source: `${repoFullName} - ${file.path}`,
        fileUrl: file.html_url
    };
}

/**
 * Ottiene uno snippet per le round corrente. Prova fino a 5 volte su GitHub prima
 * di ripiegare sullo snippet di fallback locale. Assicura che sia diverso dal precedente.
 * @param {string|null} previousCode - Il codice del round precedente per evitare duplicati
 * @returns {Promise<Object>} Lo snippet finale per il round
 */
async function getRoundSnippet(previousCode = null) {
    let firstSnippet = null;

    for (let i = 0; i < 5; i++) {
        try {
            const snippet = await getRandomSnippet();
            if (!snippet || !snippet.code) continue;

            if (!firstSnippet) {
                firstSnippet = snippet;
            }

            if (!previousCode || snippet.code !== previousCode) {
                return snippet;
            }
        } catch (error) { }
    }

    if (firstSnippet && (!previousCode || firstSnippet.code !== previousCode)) {
        return firstSnippet;
    }

    return buildFallbackSnippet(previousCode);
}

/**
 * Valuta l'accuratezza della spiegazione fornita dal giocatore in base al frammento di codice
 * utilizzando il modello LLM gpt-4o-mini tramite OpenRouter.
 * Restituisce un punteggio da 0 a 100.
 * @param {string} snippet - Frammento di codice sorgente
 * @param {string} risposta - Spiegazione fornita dal giocatore
 * @returns {Promise<number>} Punteggio assegnato dall'AI (0 - 100)
 */
async function evaluateAnswer(snippet, risposta) {
    let prompt = '';
    try {
        const promptTemplatePath = path.join(__dirname, '../../db/llm/prompt.md');
        const template = fs.readFileSync(promptTemplatePath, 'utf8');
        prompt = template
            .replace('{{snippet}}', snippet)
            .replace('{{risposta}}', risposta);
    } catch (err) {
        console.error("[code.js]: Errore nel caricamento del prompt LLM:", err);
        prompt = `Valuta la risposta "${risposta}" per lo snippet: ${snippet}`;
    }

    try {
        const client = await getOpenRouter();
        const completion = await client.chat.send({
            chatRequest: {
                model: 'openai/gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            }
        });

        const chatResult = completion.chatCompletion ?? completion;
        let rawOutput = chatResult.choices[0].message.content.trim();
        rawOutput = rawOutput.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

        const parsed = JSON.parse(rawOutput);

        /* Parsa il risultato a int e evita errori di output dell'LLM */
        return Math.min(100, Math.max(0, parseInt(parsed.punteggio, 10)));
    } catch (err) {
        console.error('[code.js] Errore durante la valutazione AI:', err.message);
        throw err;
    }
}

/**
 * Registra le rotte HTTP Express nel server principale
 * @param {Object} app - Istanza dell'applicazione Express
 */
function init(app) {
    /**
     * GET /api/random-snippet
     * Ottiene un frammento di codice casuale GitHub
     */
    app.get('/api/random-snippet', async (req, res) => {
        try {
            const snippet = await getRoundSnippet(lastPublicSnippetCode);
            lastPublicSnippetCode = snippet.code;
            res.status(200).json(snippet);
        } catch (error) {
            console.error("[code.js] Errore recupero snippet casuale:", error.message);
            const snippet = buildFallbackSnippet(lastPublicSnippetCode);
            lastPublicSnippetCode = snippet.code;
            res.status(200).json(snippet);
        }
    });

    /**
     * POST /api/valuta-risposta
     * Valuta la risposta del giocatore rispetto allo snippet e restituisce il punteggio
     */
    app.post('/api/valuta-risposta', async (req, res) => {
        const { snippet, risposta } = req.body;
        if (!snippet || !risposta) {
            return res.status(400).json({ errore: 'Frammento o risposta mancante nel body.' });
        }

        try {
            const punteggio = await evaluateAnswer(snippet, risposta);
            res.status(200).json({ punteggio });
        } catch (err) {
            console.error('[code.js] Errore valutazione risposta:', err.message);
            res.status(500).json({ errore: 'Impossibile completare la valutazione della risposta.' });
        }
    });
}

// Esporta la funzione di inizializzazione per Express.js e gli altri metodi
module.exports = {
    init,
    getRoundSnippet,
    buildFallbackSnippet,
    evaluateAnswer
};