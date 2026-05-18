/*
    FILE: profile_api.js
    DESCRIPTION: Gestisce tutte le chiamate API per la pagina del profilo.
    AUTHORS: Salvatore Iavarone & Michele Pio Forlani
*/

import { getSession, fetchAuth } from '../managers/auth.js';
import { formatJoinDate } from './profile_ui.js';

const DEFAULT_AVATAR = '/src/assets/img/user_profile.webp';

/* ===== Recupera l'ID utente a partire dal nickname nell'URL ===== */
export async function resolveTargetUserId(session) {
    const pathParts = window.location.pathname.split('/');

    // Se l'URL è /profilo/{nickname}, risolviamo il nickname in ID
    if (pathParts.length >= 3 && pathParts[1] === 'profilo' && pathParts[2] !== '') {
        const targetNickname = decodeURIComponent(pathParts[2]);

        try {
            const res = await fetchAuth(`/api/profilo/nickname/${targetNickname}`);
            if (!res.ok) throw new Error('Utente non trovato nel DB');

            const data = await res.json();
            return data.userid;

        } catch (err) {
            console.error(`[profile_api.js] Errore risoluzione per "${targetNickname}":`, err);
            window.location.href = '/profilo';
            return null;
        }
    }

    // Nessun nickname nell'URL: carichiamo il nostro profilo
    return session.idGiocatore;
}

/* ===== Recupera tutti i dati necessari per la pagina del profilo ===== */
export async function fetchFullProfileData(userId) {
    const session = getSession();

    // Scegliamo la rotta giusta: se sei tu vedi tutto, altrimenti solo le amicizie confermate
    const amiciUrl = (userId === session.idGiocatore)
        ? '/api/mie-amicizie'
        : `/api/amicizie-confermate/${userId}`;

    // Fetch paralleli per ottimizzare i tempi di caricamento
    const [resProf, resStats, resStorico, resAmici] = await Promise.all([
        fetch(`/api/profilo/${userId}`),
        fetch(`/api/statistiche/${userId}`),
        fetch(`/api/storico/${userId}`),
        fetchAuth(amiciUrl)
    ]);

    if (!resProf.ok) throw new Error(`Profilo non trovato (${resProf.status})`);
    const dataProfilo = await resProf.json();

    const dataStats  = resStats.ok  ? await resStats.json() : { played: 0, won: 0, lost: 0, win_rate: 0 };
    const dataStorico = resStorico.ok ? await resStorico.json() : [];
    const amiciData  = resAmici.ok  ? await resAmici.json()  : { amici: [], inviate: [], ricevute: [] };

    // Normalizzazione lista amici
    const amiciFormattati = amiciData.amici.map(a => ({
        userid: a.userid, name: a.user,
        avatar: a.avatar_url || DEFAULT_AVATAR,
        online: a.online || false, type: 'amico'
    }));

    const inviate = amiciData.inviate.map(a => ({
        userid: a.userid, name: a.user,
        avatar: a.avatar_url || DEFAULT_AVATAR,
        online: false, type: 'inviata'
    }));

    const ricevute = amiciData.ricevute.map(a => ({
        userid: a.userid, name: a.user,
        avatar: a.avatar_url || DEFAULT_AVATAR,
        online: false, type: 'ricevuta'
    }));

    return {
        id: dataProfilo.userid,
        name: dataProfilo.user,
        level: dataProfilo.livello,
        xp: dataProfilo.exp,
        bio: dataProfilo.bio || '',
        avatar: dataProfilo.avatar_url || DEFAULT_AVATAR,
        banner_url: dataProfilo.banner_url || null,
        joinDate: dataProfilo.data_registrazione ? formatJoinDate(dataProfilo.data_registrazione) : '',

        stats: {
            played: dataStats.played ?? 0,
            won: dataStats.won ?? 0,
            lost: dataStats.lost ?? 0,
            win_rate: dataStats.win_rate ?? 0
        },

        history: dataStorico,
        friends: [...ricevute, ...amiciFormattati, ...inviate]
    };
}