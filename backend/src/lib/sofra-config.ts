// Pure, dependency-free schema shared with the frontend. No database or secrets here.
export const SOFRA_SETTINGS_KEY = 'sofra_theme_v1';
export const SOFRA_TEXT_FIELDS = [
  'welcomeTitle',
  'welcomeSubtitle',
  'enterLabel',
  'menuTitle',
  'menuEyebrow',
  'footerText',
] as const;
export type SofraTextField = (typeof SOFRA_TEXT_FIELDS)[number];
export type SofraCopy = Record<SofraTextField, string>;
export interface SofraConfig {
  brandName: string;
  openingHours: string;
  welcomeImage: string;
  menuImage: string;
  texts: Record<string, Partial<SofraCopy>>;
}
export const SOFRA_DEFAULTS: SofraConfig = {
  brandName: '',
  openingHours: '',
  welcomeImage: '/sofra/breakfast.webp',
  menuImage: '/sofra/breakfast.webp',
  texts: {
    tr: {
      welcomeTitle: 'İyi yemek.\nGüzel sohbet.',
      welcomeSubtitle: 'Soframıza hoş geldiniz.',
      enterLabel: 'Menüyü keşfet',
      menuTitle: 'Bugün sofrada',
      menuEyebrow: 'MEVSİMİN EN İYİLERİ',
      footerText: 'Her tabakta biraz mutluluk.',
    },
    en: {
      welcomeTitle: 'Good food.\nGreat company.',
      welcomeSubtitle: 'Welcome to our table.',
      enterLabel: 'Explore the menu',
      menuTitle: 'At the table today',
      menuEyebrow: 'THE BEST OF THE SEASON',
      footerText: 'A little happiness on every plate.',
    },
  },
};
export function sofraCopy(config: SofraConfig, lang: string): SofraCopy {
  const locale = lang.toLowerCase();
  const base = locale.split('-')[0];
  return {
    ...SOFRA_DEFAULTS.texts.tr,
    ...config.texts.tr,
    ...SOFRA_DEFAULTS.texts[base],
    ...config.texts[base],
    ...config.texts[locale],
  } as SofraCopy;
}
export function isSofraImage(value: string): boolean {
  return (
    /^\/(?:uploads|sofra)\/[a-zA-Z0-9._/-]+$/.test(value) ||
    /^https?:\/\/[^\s<>"'\\]+$/i.test(value)
  );
}
export function normalizeSofraConfig(raw: unknown): SofraConfig {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (value: unknown, fallback: string, max: number) =>
    typeof value === 'string' ? value.trim().slice(0, max) : fallback;
  const image = (value: unknown, fallback: string) =>
    typeof value === 'string' && isSofraImage(value) ? value.slice(0, 1000) : fallback;
  const texts: SofraConfig['texts'] = {};
  if (source.texts && typeof source.texts === 'object' && !Array.isArray(source.texts)) {
    for (const [rawLang, value] of Object.entries(source.texts)) {
      const lang = rawLang.toLowerCase();
      if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(lang) || !value || typeof value !== 'object')
        continue;
      const copy: Partial<SofraCopy> = {};
      for (const key of SOFRA_TEXT_FIELDS) {
        const val = (value as Record<string, unknown>)[key];
        if (typeof val === 'string') copy[key] = text(val, '', key === 'enterLabel' ? 60 : 400);
      }
      texts[lang] = copy;
    }
  }
  return {
    brandName: text(source.brandName, '', 100),
    openingHours: text(source.openingHours, '', 150),
    welcomeImage: image(source.welcomeImage, SOFRA_DEFAULTS.welcomeImage),
    menuImage: image(source.menuImage, SOFRA_DEFAULTS.menuImage),
    texts,
  };
}
export function parseSofraConfig(value?: string | null): SofraConfig {
  try {
    return normalizeSofraConfig(value ? JSON.parse(value) : {});
  } catch {
    return normalizeSofraConfig({});
  }
}
export function withLegacyWelcome(config: SofraConfig, legacy: unknown): SofraConfig {
  const texts = { ...config.texts };
  if (legacy && typeof legacy === 'object') {
    for (const [rawLang, value] of Object.entries(legacy)) {
      const lang = rawLang.toLowerCase();
      if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(lang) || !value || typeof value !== 'object')
        continue;
      const message = (value as { message?: unknown }).message;
      if (
        typeof message === 'string' &&
        message.trim() &&
        texts[lang]?.welcomeSubtitle === undefined
      ) {
        texts[lang] = { ...texts[lang], welcomeSubtitle: message.trim().slice(0, 400) };
      }
    }
  }
  return { ...config, texts };
}
