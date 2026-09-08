import { catalogByCode } from './languageCatalog';

/** Dil kodu → bayrak için ISO ülke kodu (flagcdn) */
const LANG_TO_COUNTRY: Record<string, string> = {
  tr: 'tr',
  en: 'gb',
  ru: 'ru',
  de: 'de',
  fr: 'fr',
  ar: 'sa',
  es: 'es',
  it: 'it',
  nl: 'nl',
  pt: 'pt',
  zh: 'cn',
  ja: 'jp',
  ko: 'kr',
  fa: 'ir',
  az: 'az',
  ka: 'ge',
  uk: 'ua',
  pl: 'pl',
  ro: 'ro',
  bg: 'bg',
  el: 'gr',
  he: 'il',
  hi: 'in',
  th: 'th',
  vi: 'vn',
  sv: 'se',
  no: 'no',
  da: 'dk',
  fi: 'fi',
  cs: 'cz',
  hu: 'hu',
  sr: 'rs',
  hr: 'hr',
  sq: 'al',
};

export function languageCountryCode(code: string) {
  const key = (code || '').toLowerCase().split('-')[0];
  return LANG_TO_COUNTRY[key] || '';
}

/** Emoji — Windows Chrome’da “TR” görünür; UI’da LanguageFlag kullan */
export function languageFlag(code: string) {
  return catalogByCode(code)?.flag || '🌐';
}

export function languageFlagUrl(code: string, width = 40) {
  const iso = languageCountryCode(code);
  if (!iso) return '';
  const w = width <= 20 ? 20 : width <= 40 ? 40 : 80;
  return `https://flagcdn.com/w${w}/${iso}.png`;
}
