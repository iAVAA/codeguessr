/*
    FILE: missions.js
    DESCRIPTION: Gestore delle missioni e del progresso dinamico dei giocatori
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

const { supabase } = require('../server');

module.exports = (app) => {
    /**
     * GET /api/missioni/:id
     * Recupera le missioni e calcola il progresso dinamico del giocatore.
     */
    app.get('/api/missioni/:id', async (req, res) => {
        const idGiocatore = req.params.id;

        try {
            // 1. Legge gli achievement
            const { data: achievements, error: achErr } = await supabase
                .from('achievements')
                .select('*');

            if (achErr) throw achErr;

            // 2. Legge il profilo
            const { data: profilo, error: profErr } = await supabase
                .from('giocatore')
                .select('livello, avatar_url, banner_url')
                .eq('id_giocatore', idGiocatore)
                .single();

            if (profErr) throw profErr;

            // 3. Legge le partecipazioni/partite (storico e stat)
            const { data: partecipazioni, error: partErr } = await supabase
                .from('partecipazione')
                .select('risultato, exp_guadagnata, partita(modalita, data_inizio)')
                .eq('id_giocatore', idGiocatore)
                .order('id_partita', { ascending: false });

            if (partErr) throw partErr;

            // 4. Legge le amicizie confermate
            const { data: amicizie, error: amiErr } = await supabase
                .from('amicizia')
                .select('id_utente_a')
                .eq('stato', 'accettata')
                .or(`id_utente_a.eq.${idGiocatore},id_utente_b.eq.${idGiocatore}`);

            if (amiErr) throw amiErr;

            // 5. Legge i traguardi già sbloccati
            const { data: sbloccati, error: sblocErr } = await supabase
                .from('user_achievements')
                .select('achievement_id')
                .eq('user_id', idGiocatore);

            if (sblocErr) throw sblocErr;
            const sbloccatiSet = new Set(sbloccati.map(a => a.achievement_id));

            // Calcoli per i traguardi
            const played = partecipazioni.length;
            const won = partecipazioni.filter(p => p.risultato === 'vittoria').length;
            const amiciCount = amicizie ? amicizie.length : 0;
            const mpPlayed = partecipazioni.filter(p => p.partita?.modalita === 'multiplayer' || p.partita?.modalita === 'amichevole').length;
            const mpWon = partecipazioni.filter(p => (p.partita?.modalita === 'multiplayer' || p.partita?.modalita === 'amichevole') && p.risultato === 'vittoria').length;

            // Calcolo Notte Bianca (giocato tra le 00 e le 05)
            let notteBianca = 0;
            for (const p of partecipazioni) {
                if (p.partita && p.partita.data_inizio) {
                    const hour = new Date(p.partita.data_inizio).getHours();
                    if (hour >= 0 && hour <= 5) {
                        notteBianca = 1;
                        break;
                    }
                }
            }

            // Calcolo Perfezionista (media exp > 90 nelle ultime 10)
            let perfezionista = 0;
            if (played >= 10) {
                const last10 = partecipazioni.slice(0, 10);
                const sumExp = last10.reduce((sum, p) => sum + (p.exp_guadagnata || 0), 0);
                if (sumExp / 10 >= 90) perfezionista = 1;
            }

            let consecutiveWins = 0;
            let maxConsecutiveWins = 0;
            for (let i = partecipazioni.length - 1; i >= 0; i--) { // ordina cronologicamente
                if (partecipazioni[i].risultato === 'vittoria') {
                    consecutiveWins++;
                    maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
                } else {
                    consecutiveWins = 0;
                }
            }

            const genioIncompreso = partecipazioni.some(p => p.exp_guadagnata >= 100) ? 1 : 0;

            // 5. Mappatura progressi dinamica
            const progressMap = {
                'Vanità': Math.min((profilo.avatar_url || profilo.banner_url) ? 1 : 0, 1),
                'Leggenda del Debug': Math.min(profilo.livello, 50),
                'Script Kiddie': 0,
                'Notte Bianca': notteBianca,
                'Low Level Hero': 0,
                'Maestro del Codice': Math.min(profilo.livello, 20),
                'Gladiatore': Math.min(mpWon, 25),
                'Perfezionista': perfezionista,
                'Maratoneta': Math.min(played, 100),
                'Dio dei Linguaggi': Math.min(maxConsecutiveWins, 10),
                'Apprendista Codificatore': Math.min(profilo.livello, 5),
                'Web Wizard': 0,
                'Collezionista': 0, // Verrà calcolato alla fine
                'Duellante': Math.min(mpPlayed, 10),
                'Genio Incompreso': genioIncompreso,
                'Infallibile': Math.min(maxConsecutiveWins, 5),
                'Primo Sangue': Math.min(won, 1),
                'Scalatore Sociale': Math.min(amiciCount, 10)
            };

            const targetMap = {
                'Vanità': 1, 'Leggenda del Debug': 50, 'Script Kiddie': 1, 'Notte Bianca': 1, 'Low Level Hero': 1,
                'Maestro del Codice': 20, 'Gladiatore': 25, 'Perfezionista': 1, 'Maratoneta': 100, 'Dio dei Linguaggi': 10,
                'Apprendista Codificatore': 5, 'Web Wizard': 1, 'Collezionista': 10, 'Duellante': 10, 'Genio Incompreso': 1,
                'Infallibile': 5, 'Primo Sangue': 1, 'Scalatore Sociale': 10
            };

            let completedMissionsCount = 0;

            // Primo passaggio per contare le completate (serve a Collezionista)
            achievements.forEach(ach => {
                if (ach.name !== 'Collezionista') {
                    const current = progressMap[ach.name] || 0;
                    const target = targetMap[ach.name] || 1;
                    if (current >= target) completedMissionsCount++;
                }
            });

            progressMap['Collezionista'] = Math.min(completedMissionsCount, 10);

            const daRiscatto = [];

            // Assembla l'array finale
            const missioniResult = achievements.map(ach => {
                const current = progressMap[ach.name] || 0;
                const target = targetMap[ach.name] || 1;
                const isCompleted = current >= target;

                // Se la missione è appena stata completata e non è ancora salvata nel DB
                if (isCompleted && !sbloccatiSet.has(ach.id)) {
                    daRiscatto.push(ach);
                }

                return {
                    id: ach.id,
                    title: ach.name,
                    description: ach.description,
                    current: current,
                    target: target,
                    reward: `+${ach.exp_reward} XP, +${ach.trophy_reward} 🏆`,
                    completed: isCompleted
                };
            });

            // Riscatta automaticamente i premi in background
            if (daRiscatto.length > 0) {
                (async () => {
                    try {
                        // Inserisci in user_achievements
                        const insertData = daRiscatto.map(ach => ({ user_id: idGiocatore, achievement_id: ach.id }));
                        const { error: insErr } = await supabase.from('user_achievements').insert(insertData);

                        if (!insErr) {
                            // Somma i premi
                            const expTot = daRiscatto.reduce((sum, ach) => sum + ach.exp_reward, 0);
                            const trophyTot = daRiscatto.reduce((sum, ach) => sum + ach.trophy_reward, 0);

                            // Aggiorna giocatore (il Trigger PostgreSQL gestirà il Level Up se exp supera 500!)
                            const { data: prof } = await supabase.from('giocatore').select('exp, trophies').eq('id_giocatore', idGiocatore).single();
                            if (prof) {
                                await supabase.from('giocatore').update({
                                    exp: (prof.exp || 0) + expTot,
                                    trophies: (prof.trophies || 0) + trophyTot
                                }).eq('id_giocatore', idGiocatore);
                            }
                        }
                    } catch (e) {
                        console.error("Errore nell'auto-riscatto missioni:", e);
                    }
                })();
            }

            res.status(200).json(missioniResult);

        } catch (err) {
            console.error("Errore recupero missioni:", err.message);
            res.status(500).json({ errore: 'Impossibile recuperare le missioni' });
        }
    });
};
