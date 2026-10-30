import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, usersDB, notifDB, demandesDB, offresDB } from '../db/database';
import { demarrerTrackingGPS, arreterTrackingGPS, demandeEnCoursDeSuivi } from '../lib/tracking';

const AppContext = createContext(null);
const STORAGE_KEY = 'dzexpress_user_id';

const CRENEAU_HOURS = { matin: 9, 'apres-midi': 15, soir: 20, flexible: 12 };

export function parseDemandeTime(dateSouhaitee, creneau) {
  if (!dateSouhaitee || dateSouhaitee === 'Maintenant') return null;
  const parts = dateSouhaitee.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  date.setHours(CRENEAU_HOURS[creneau] || 12, 0, 0, 0);
  return date.getTime();
}

export function msToCountdown(ms) {
  if (ms == null || ms <= 0) return null;
  const totalMins = Math.floor(ms / 60000);
  if (totalMins > 48 * 60) return null;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `Dans ${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  if (totalMins > 0) return `Dans ${totalMins}min`;
  return 'À venir';
}

export function AppProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try { initDatabase(); } catch (e) { console.warn('DB init:', e.message); }
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const found = usersDB.getById(parseInt(stored));
        if (found) setUser(found);
      }
    } catch (e) {
      console.warn('loadUser error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userId) => {
    await AsyncStorage.setItem(STORAGE_KEY, String(userId));
    setUser(usersDB.getById(userId));
  };

  const refreshUser = () => {
    if (user) {
      const updated = usersDB.getById(user.id);
      if (updated) setUser(updated);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  // ── Simulation dispatch courses planifiées ────────────────
  useEffect(() => {
    const runSimulation = () => {
      try {
        const now = Date.now();

        // 1. Demandes planifiées prêtes à dispatcher
        const ready = demandesDB.getDispatchReady();
        for (const d of ready) {
          const scheduledMs = parseDemandeTime(d.date_souhaitee, d.creneau);
          if (scheduledMs && now >= scheduledMs) {
            demandesDB.markDispatched(d.id);
            // Notifie tous les transporteurs disponibles
            const transporteurs = usersDB.getAllTransporteurs();
            for (const t of transporteurs) {
              notifDB.create(
                t.id,
                `Nouvelle course : ${d.ville_depart} → ${d.ville_arrivee}`,
                'course_dispo',
                { route: `/demande/${d.id}` }
              );
            }
          }
        }

        // 2. Demandes dispatché depuis > 2 min → auto-acceptation
        const toAccept = demandesDB.getReadyForAutoAccept();
        for (const d of toAccept) {
          try {
            const transporteurs = usersDB.getAllTransporteurs();
            if (transporteurs.length === 0) { demandesDB.markAutoAccepted(d.id); continue; }
            const t = transporteurs[Math.floor(Math.random() * transporteurs.length)];
            const offreId = offresDB.create({
              demande_id: d.id,
              transporteur_id: t.id,
              prix_propose: d.prix_estime || null,
              message: 'Acceptation automatique simulée',
            });
            offresDB.accepter(offreId, d.id, t.id);
            demandesDB.markAutoAccepted(d.id);
            notifDB.create(
              d.expediteur_id,
              `Un chauffeur a accepté votre course ${d.ville_depart} → ${d.ville_arrivee}`,
              'course_acceptee',
              { route: `/demande/${d.id}` }
            );
          } catch (_) {}
        }
      } catch (_) {}
    };

    const id = setInterval(runSimulation, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Reprise/arrêt du suivi GPS (voir src/lib/tracking.js) ─────
  // AppProvider reste monté pour toute la session, donc c'est l'endroit
  // le plus fiable pour garder le suivi actif même si le transporteur
  // quitte l'écran course/[id] — et pour l'arrêter automatiquement dès
  // que la course n'est plus "en_route" (livrée, annulée…), peu importe
  // depuis quel écran ce changement a eu lieu.
  useEffect(() => {
    if (!user || user.type !== 'transporteur') return;

    const syncTracking = () => {
      try {
        const enRoute = demandesDB.getByTransporteur(user.id).find(d => d.statut === 'en_route');
        const suivie  = demandeEnCoursDeSuivi();
        if (enRoute && suivie !== enRoute.id) {
          demarrerTrackingGPS(enRoute.id);
        } else if (!enRoute && suivie) {
          arreterTrackingGPS();
        }
      } catch (_) {}
    };

    syncTracking();
    const trackingId = setInterval(syncTracking, 15000);
    return () => clearInterval(trackingId);
  }, [user]);

  return (
    <AppContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

/**
 * Crée une notification SQLite locale pour l'utilisateur userId.
 * Elle sera affichée comme bannière par NotifBanner via useNotifications.
 */
export function localNotif(userId, message, type = 'info', data = null) {
  if (!userId || !message) return;
  try { notifDB.create(userId, message, type, data); } catch (_) {}
}
