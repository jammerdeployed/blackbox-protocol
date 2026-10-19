import { useState, useEffect } from 'react';
import { cs } from './cs';
import { en } from './en';
import type { TranslationKeys } from './types';

export type Locale = 'en' | 'cs';

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem('locale') as Locale) || 'en';
}

export function setStoredLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
    window.dispatchEvent(new Event('localechange'));
  }
}

export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  useEffect(() => {
    const handleLocaleChange = () => setLocaleState(getStoredLocale());
    window.addEventListener('localechange', handleLocaleChange);
    return () => window.removeEventListener('localechange', handleLocaleChange);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocaleState(newLocale);
  };

  const t: TranslationKeys = locale === 'cs' ? cs : en;

  return { t, locale, changeLocale };
}

export { cs, en };
export type { TranslationKeys };
