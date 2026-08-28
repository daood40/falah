/**
 * Lightweight, extensible i18n.
 * Adding a locale = registering one dictionary + direction. No architectural change
 * is needed to scale to 50+ languages (dictionaries can be lazy-loaded later).
 */
import { create } from 'zustand';
import { ar } from './ar';
import { en } from './en';

export type Direction = 'rtl' | 'ltr';

export interface LocaleInfo {
  code: string;
  nativeName: string;
  dir: Direction;
}

const dictionaries: Record<string, Record<string, string>> = { ar, en };

export const LOCALES: LocaleInfo[] = [
  { code: 'ar', nativeName: 'العربية', dir: 'rtl' },
  { code: 'en', nativeName: 'English', dir: 'ltr' },
];

/** Register an additional locale at runtime (future languages plug in here). */
export function registerLocale(info: LocaleInfo, dictionary: Record<string, string>): void {
  dictionaries[info.code] = dictionary;
  if (!LOCALES.some((l) => l.code === info.code)) LOCALES.push(info);
}

export function translate(locale: string, key: string, params?: Record<string, string>): string {
  const dict = dictionaries[locale] ?? dictionaries['ar']!;
  let text = dict[key] ?? dictionaries['ar']![key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, value);
    }
  }
  return text;
}

export function dirOf(locale: string): Direction {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'rtl';
}

interface I18nState {
  locale: string;
  dir: Direction;
  setLocale: (code: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const STORAGE_KEY = 'falah.locale';

function initialLocale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dictionaries[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  return 'ar';
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: initialLocale(),
  dir: dirOf(initialLocale()),
  setLocale: (code) => {
    if (!dictionaries[code]) return;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage unavailable */
    }
    const dir = dirOf(code);
    document.documentElement.lang = code;
    document.documentElement.dir = dir;
    set({ locale: code, dir });
  },
  t: (key, params) => translate(get().locale, key, params),
}));

/** Apply locale attributes on boot. */
export function applyDocumentLocale(): void {
  const { locale, dir } = useI18n.getState();
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
}
