/** User-Agent + dil bilgisinden cihaz/OS özeti */
export function parseClientMeta(userAgent: string, lang?: string | null) {
  const ua = String(userAgent || '');
  const rawLang = String(lang || 'tr')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0]
    .slice(0, 10);

  let device = 'Masaüstü';
  if (/ipad|tablet|kindle|playbook/i.test(ua)) device = 'Tablet';
  else if (/mobi|iphone|ipod|android.+mobile|windows phone/i.test(ua)) device = 'Mobil';

  let os = 'Diğer';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod|ios/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'Chrome OS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return {
    lang: rawLang || 'tr',
    device,
    os,
  };
}

const LANG_LABELS: Record<string, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  fa: 'فارسی',
  az: 'Azərbaycan',
  uk: 'Українська',
  pl: 'Polski',
  ro: 'Română',
  bg: 'Български',
  el: 'Ελληνικά',
  he: 'עברית',
  hi: 'हिन्दी',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  cs: 'Čeština',
  hu: 'Magyar',
  sr: 'Srpski',
  hr: 'Hrvatski',
  sq: 'Shqip',
};

export function languageLabel(code: string) {
  return LANG_LABELS[code] || code.toUpperCase();
}
