import { useState, useEffect, useCallback, useRef } from 'react';
import { notifDB } from '../db/database';
import { envoyerNotificationLocale, notifMeta } from '../lib/notifications';

/**
 * Polle SQLite toutes les 5 s pour trouver les nouvelles notifications.
 * Retourne :
 *   unread  — nombre de non-lues (pour le badge sur les tabs)
 *   banner  — objet notification le plus récent non encore affiché
 *   dismissBanner — marque tout comme lu + cache la bannière
 *   markAllRead   — idem, sans animation (utile pour l'onglet Profil)
 *   poll    — force un refresh immédiat
 */
export function useNotifications(userId) {
  const [unread, setUnread]   = useState(0);
  const [banner, setBanner]   = useState(null);
  const shownIds              = useRef(new Set()); // IDs déjà affichés

  const poll = useCallback(() => {
    if (!userId) return;
    try {
      const count = notifDB.countUnread(userId);
      setUnread(count);

      if (count > 0) {
        const list    = notifDB.getByUser(userId);
        // La plus récente non encore montrée comme bannière
        const newest  = list.find(n => n.lu === 0 && !shownIds.current.has(n.id));
        if (newest) {
          shownIds.current.add(newest.id);
          setBanner(newest);
          // Double la bannière in-app d'une vraie notification OS (tiroir
          // système, écran verrouillé) — fonctionne dès aujourd'hui, sans
          // serveur, puisqu'émise par l'appareil pour son propre
          // utilisateur (voir src/lib/notifications.js).
          let data = {};
          try { data = newest.data_json ? JSON.parse(newest.data_json) : {}; } catch (_) {}
          envoyerNotificationLocale(notifMeta(newest.type).label, newest.message, data);
        }
      }
    } catch (_) { /* silencieux */ }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [userId, poll]);

  const dismissBanner = useCallback(() => {
    if (!userId) return;
    try { notifDB.markAllRead(userId); } catch (_) {}
    setBanner(null);
    setUnread(0);
  }, [userId]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    try { notifDB.markAllRead(userId); } catch (_) {}
    setUnread(0);
    setBanner(null);
  }, [userId]);

  const markRead = useCallback((notifId) => {
    try { notifDB.markRead(notifId); poll(); } catch (_) {}
  }, [poll]);

  return { unread, banner, dismissBanner, markAllRead, markRead, poll };
}
