import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { I18n } from 'i18n-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import fr from './fr';
import ar from './ar';

const LANG_KEY = 'dzexpress_lang';

// Instance i18n partagée (synchrone, sans React)
const i18n = new I18n({ fr, ar });
i18n.defaultLocale = 'fr';
i18n.locale = 'fr';
i18n.enableFallback = true;

// Traduction synchrone — utilisable partout en dehors de React
export const t = (key, options) => i18n.t(key, options);

// ── Context React ─────────────────────────────────────────────

const LangContext = createContext({
  locale: 'fr',
  isRTL: false,
  t,
  setLanguage: async () => {},
});

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('fr');

  // Charge la langue sauvegardée au démarrage
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then(saved => {
        if (saved === 'fr' || saved === 'ar') {
          i18n.locale = saved;
          I18nManager.forceRTL(saved === 'ar');
          setLocale(saved);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (lang) => {
    i18n.locale = lang;
    I18nManager.forceRTL(lang === 'ar');
    setLocale(lang);
    try {
      await AsyncStorage.setItem(LANG_KEY, lang);
    } catch {}
  }, []);

  // Crée une nouvelle référence de t() à chaque changement de locale
  // pour déclencher le re-render chez tous les consommateurs
  const translate = useCallback(
    (key, options) => i18n.t(key, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  return (
    <LangContext.Provider value={{ locale, isRTL: locale === 'ar', t: translate, setLanguage }}>
      {children}
    </LangContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LangContext);
}

export default i18n;
