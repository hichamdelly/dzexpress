import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase, usersDB, notifDB } from '../db/database';

const AppContext = createContext(null);
const STORAGE_KEY = 'dzexpress_user_id';

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
export function localNotif(userId, message) {
  if (!userId || !message) return;
  try { notifDB.create(userId, message); } catch (_) {}
}
