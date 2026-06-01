import { useState, useEffect, useCallback } from 'react';
import { messagesDB } from '../db/database';

/**
 * Retourne le nombre total de messages non lus pour l'utilisateur.
 * Rafraîchi toutes les 4 secondes.
 */
export function useMessagesBadge(userId) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    try {
      setUnread(messagesDB.countUnreadTotal(userId));
    } catch (_) {}
  }, [userId]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
  }, [refresh]);

  return unread;
}
