/** Menüye eklenebilecek diller — bayrak, arama, çeviri desteği */

export type TranslateSupport = 'free' | 'openai' | 'none';

export interface CatalogLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  /** free = MyMemory/Libre; openai = anahtar varsa; none = manuel */
  translate: TranslateSupport;
}

export const LANGUAGE_CATALOG: CatalogLanguage[] = [
  { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷', translate: 'free' },
  { code: 'en', name: 'İngilizce', nativeName: 'English', flag: '🇬🇧', translate: 'free' },
  { code: 'ru', name: 'Rusça', nativeName: 'Русский', flag: '🇷🇺', translate: 'free' },
  { code: 'de', name: 'Almanca', nativeName: 'Deutsch', flag: '🇩🇪', translate: 'free' },
  { code: 'fr', name: 'Fransızca', nativeName: 'Français', flag: '🇫🇷', translate: 'free' },
  { code: 'ar', name: 'Arapça', nativeName: 'العربية', flag: '🇸🇦', translate: 'free' },
  { code: 'es', name: 'İspanyolca', nativeName: 'Español', flag: '🇪🇸', translate: 'free' },
  { code: 'it', name: 'İtalyanca', nativeName: 'Italiano', flag: '🇮🇹', translate: 'free' },
  { code: 'nl', name: 'Felemenkçe', nativeName: 'Nederlands', flag: '🇳🇱', translate: 'free' },
  { code: 'pt', name: 'Portekizce', nativeName: 'Português', flag: '🇵🇹', translate: 'free' },
  { code: 'zh', name: 'Çince', nativeName: '中文', flag: '🇨🇳', translate: 'free' },
  { code: 'ja', name: 'Japonca', nativeName: '日本語', flag: '🇯🇵', translate: 'free' },
  { code: 'ko', name: 'Korece', nativeName: '한국어', flag: '🇰🇷', translate: 'free' },
  { code: 'fa', name: 'Farsça', nativeName: 'فارسی', flag: '🇮🇷', translate: 'free' },
  { code: 'az', name: 'Azerice', nativeName: 'Azərbaycan', flag: '🇦🇿', translate: 'openai' },
  { code: 'ka', name: 'Gürcüce', nativeName: 'ქართული', flag: '🇬🇪', translate: 'openai' },
  { code: 'uk', name: 'Ukraynaca', nativeName: 'Українська', flag: '🇺🇦', translate: 'free' },
  { code: 'pl', name: 'Lehçe', nativeName: 'Polski', flag: '🇵🇱', translate: 'free' },
  { code: 'ro', name: 'Rumence', nativeName: 'Română', flag: '🇷🇴', translate: 'free' },
  { code: 'bg', name: 'Bulgarca', nativeName: 'Български', flag: '🇧🇬', translate: 'free' },
  { code: 'el', name: 'Yunanca', nativeName: 'Ελληνικά', flag: '🇬🇷', translate: 'free' },
  { code: 'he', name: 'İbranice', nativeName: 'עברית', flag: '🇮🇱', translate: 'free' },
  { code: 'hi', name: 'Hintçe', nativeName: 'हिन्दी', flag: '🇮🇳', translate: 'free' },
  { code: 'th', name: 'Tayca', nativeName: 'ไทย', flag: '🇹🇭', translate: 'free' },
  { code: 'vi', name: 'Vietnamca', nativeName: 'Tiếng Việt', flag: '🇻🇳', translate: 'free' },
  { code: 'sv', name: 'İsveççe', nativeName: 'Svenska', flag: '🇸🇪', translate: 'free' },
  { code: 'no', name: 'Norveççe', nativeName: 'Norsk', flag: '🇳🇴', translate: 'free' },
  { code: 'da', name: 'Danca', nativeName: 'Dansk', flag: '🇩🇰', translate: 'free' },
  { code: 'fi', name: 'Fince', nativeName: 'Suomi', flag: '🇫🇮', translate: 'free' },
  { code: 'cs', name: 'Çekçe', nativeName: 'Čeština', flag: '🇨🇿', translate: 'free' },
  { code: 'hu', name: 'Macarca', nativeName: 'Magyar', flag: '🇭🇺', translate: 'free' },
  { code: 'sr', name: 'Sırpça', nativeName: 'Српски', flag: '🇷🇸', translate: 'openai' },
  { code: 'hr', name: 'Hırvatça', nativeName: 'Hrvatski', flag: '🇭🇷', translate: 'openai' },
  { code: 'sq', name: 'Arnavutça', nativeName: 'Shqip', flag: '🇦🇱', translate: 'openai' },
];

export function catalogByCode(code: string) {
  return LANGUAGE_CATALOG.find((l) => l.code === code.toLowerCase());
}

export function translateBadgeLabel(support: TranslateSupport, hasOpenAI: boolean) {
  if (support === 'free') return { text: 'Çeviri hazır', tone: 'ok' as const };
  if (support === 'openai') {
    return hasOpenAI
      ? { text: 'OpenAI ile çeviri', tone: 'ok' as const }
      : { text: 'OpenAI anahtarı gerekir', tone: 'warn' as const };
  }
  return { text: 'Manuel çeviri', tone: 'muted' as const };
}
