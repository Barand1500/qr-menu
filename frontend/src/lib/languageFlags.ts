const FLAGS: Record<string, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  ru: '🇷🇺',
  de: '🇩🇪',
  fr: '🇫🇷',
  ar: '🇸🇦',
  es: '🇪🇸',
  it: '🇮🇹',
  nl: '🇳🇱',
  pt: '🇵🇹',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
};

export function languageFlag(code: string) {
  return FLAGS[code.toLowerCase()] || '🌐';
}
