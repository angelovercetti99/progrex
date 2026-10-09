import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getLanguagePreference, type LanguagePreference } from '@/lib/preferences';

import en from './en.json';
import pt from './pt.json';

export const resources = {
  pt: { translation: pt },
  en: { translation: en },
} as const;

export type Language = keyof typeof resources;

/** Device in English → English. Anything else → Portuguese (the default). */
function systemLanguage(): Language {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'pt';
}

export function resolveLanguage(preference: LanguagePreference): Language {
  return preference === 'system' ? systemLanguage() : preference;
}

i18n.use(initReactI18next).init({
  resources,
  lng: systemLanguage(),
  fallbackLng: 'pt',
  interpolation: {
    // React already escapes text, so i18next doesn't need to.
    escapeValue: false,
  },
});

/**
 * The saved preference lives in the database, so it can only be read once the
 * database is ready (see DatabaseGate). Until then we use the system language.
 */
export async function loadSavedLanguage(): Promise<void> {
  const preference = await getLanguagePreference();
  await i18n.changeLanguage(resolveLanguage(preference));
}

export default i18n;
