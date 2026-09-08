import { prisma } from './prisma.js';

export type GroupI18nEntry = { name?: string };
export type ProductI18nEntry = {
  name?: string;
  description?: string;
  ingredients?: string;
  allergens?: string;
};
export type ShowcaseI18nEntry = { title1?: string; title2?: string };
export type I18nMap<T> = Record<string, T>;

let languageCache: { id: number; code: string; name: string; isActive: boolean }[] | null = null;

export async function getLanguages() {
  if (!languageCache) {
    languageCache = await prisma.language.findMany({ orderBy: { id: 'asc' } });
  }
  return languageCache;
}

export function clearLanguageCache() {
  languageCache = null;
}

function asMap<T>(json: unknown): I18nMap<T> {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return json as I18nMap<T>;
  }
  return {};
}

export function getByLang<T extends Record<string, unknown>>(
  json: unknown,
  lang: string,
  field: keyof T,
  fallbackLang = 'tr'
): string {
  const map = asMap<T>(json);
  const primary = map[lang]?.[field];
  if (typeof primary === 'string' && primary.trim()) return primary;
  const fallback = map[fallbackLang]?.[field];
  if (typeof fallback === 'string') return fallback;
  const first = Object.values(map).find((entry) => {
    const v = entry?.[field];
    return typeof v === 'string' && v.trim();
  });
  return typeof first?.[field] === 'string' ? (first[field] as string) : '';
}

/** Dil kodundaki alan — başka dile düşmeden */
export function getRawField<T extends Record<string, unknown>>(
  json: unknown,
  lang: string,
  field: keyof T
): string {
  const map = asMap<T>(json);
  const value = map[lang]?.[field];
  return typeof value === 'string' ? value.trim() : '';
}

/** Hedef dil boşken çeviri kaynağı bul (önce tercih sırası, sonra herhangi bir dolu dil) */
export function findSourceField<T extends Record<string, unknown>>(
  json: unknown,
  targetLang: string,
  field: keyof T,
  preferredLangs: string[] = ['tr']
): { lang: string; text: string } | null {
  const map = asMap<T>(json);
  const tried = new Set<string>();

  for (const lang of preferredLangs) {
    if (!lang || lang === targetLang || tried.has(lang)) continue;
    tried.add(lang);
    const text = getRawField<T>(json, lang, field);
    if (text) return { lang, text };
  }

  for (const lang of Object.keys(map)) {
    if (lang === targetLang || tried.has(lang)) continue;
    const text = getRawField<T>(json, lang, field);
    if (text) return { lang, text };
  }

  return null;
}

export function patchI18nField<T extends Record<string, unknown>>(
  existing: unknown,
  lang: string,
  field: keyof T,
  value: string
): I18nMap<T> {
  const map = { ...asMap<T>(existing) };
  map[lang] = { ...(map[lang] || ({} as T)), [field]: value } as T;
  return map;
}

/** Toplu çeviride kaydedilen alan — kaynakla aynı kalsa bile tekrar “eksik” sayılmaz */
const REVIEWED_KEY = '_reviewed';

export function isI18nFieldReviewed(
  json: unknown,
  lang: string,
  field: string
): boolean {
  const map = asMap<Record<string, unknown>>(json);
  const entry = map[lang];
  const reviewed = entry?.[REVIEWED_KEY];
  return Array.isArray(reviewed) && reviewed.includes(field);
}

export function patchI18nFieldReviewed<T extends Record<string, unknown>>(
  existing: unknown,
  lang: string,
  field: keyof T,
  value: string
): I18nMap<T> {
  const map = { ...asMap<T>(existing) };
  const prev = { ...(map[lang] || ({} as T)) } as Record<string, unknown>;
  const reviewed = new Set(
    Array.isArray(prev[REVIEWED_KEY]) ? (prev[REVIEWED_KEY] as string[]) : []
  );
  reviewed.add(String(field));
  prev[String(field)] = value;
  prev[REVIEWED_KEY] = [...reviewed];
  map[lang] = prev as T;
  return map;
}

export function getGroupName(json: unknown, lang = 'tr') {
  return getByLang<GroupI18nEntry>(json, lang, 'name');
}

export function getProductField(
  json: unknown,
  lang: string,
  field: keyof ProductI18nEntry
) {
  return getByLang<ProductI18nEntry>(json, lang, field);
}

export function getShowcaseTitles(json: unknown, lang: string) {
  return {
    title1: getByLang<ShowcaseI18nEntry>(json, lang, 'title1'),
    title2: getByLang<ShowcaseI18nEntry>(json, lang, 'title2'),
  };
}

export function getWelcomeMessage(json: unknown, lang: string) {
  const map = asMap<{ message?: string }>(json);
  return map[lang]?.message || map.tr?.message || Object.values(map)[0]?.message || '';
}

type LangRow = { id: number; code: string };

export function toGroupTranslations(
  json: unknown,
  languages: LangRow[]
) {
  return languages.map((lang) => ({
    languageId: lang.id,
    languageCode: lang.code,
    // Admin formunda fallback gösterme — boş dil boş kalsın
    name: getRawField<GroupI18nEntry>(json, lang.code, 'name'),
  }));
}

export function toProductTranslations(
  json: unknown,
  languages: LangRow[]
) {
  return languages.map((lang) => ({
    languageId: lang.id,
    languageCode: lang.code,
    name: getRawField<ProductI18nEntry>(json, lang.code, 'name'),
    description: getRawField<ProductI18nEntry>(json, lang.code, 'description') || null,
    ingredients: getRawField<ProductI18nEntry>(json, lang.code, 'ingredients') || null,
    allergens: getRawField<ProductI18nEntry>(json, lang.code, 'allergens') || null,
  }));
}

export function toShowcaseTranslations(
  json: unknown,
  languages: LangRow[]
) {
  return languages.map((lang) => ({
    languageId: lang.id,
    languageCode: lang.code,
    title1: getRawField<ShowcaseI18nEntry>(json, lang.code, 'title1') || null,
    title2: getRawField<ShowcaseI18nEntry>(json, lang.code, 'title2') || null,
  }));
}

export function mergeGroupI18n(
  existing: unknown,
  items: { languageId: number; name: string }[],
  languages: LangRow[]
) {
  const map = { ...asMap<GroupI18nEntry>(existing) };
  for (const item of items) {
    const code = languages.find((l) => l.id === item.languageId)?.code;
    if (!code) continue;
    map[code] = { ...map[code], name: item.name };
  }
  return map;
}

export function mergeProductI18n(
  existing: unknown,
  items: {
    languageId: number;
    name: string;
    description?: string;
    ingredients?: string;
    allergens?: string;
  }[],
  languages: LangRow[]
) {
  const map = { ...asMap<ProductI18nEntry>(existing) };
  for (const item of items) {
    const code = languages.find((l) => l.id === item.languageId)?.code;
    if (!code) continue;
    map[code] = {
      ...map[code],
      name: item.name,
      description: item.description ?? map[code]?.description,
      ingredients: item.ingredients ?? map[code]?.ingredients,
      allergens: item.allergens ?? map[code]?.allergens,
    };
  }
  return map;
}

export function mergeShowcaseI18n(
  existing: unknown,
  items: { languageId: number; title1?: string; title2?: string }[],
  languages: LangRow[]
) {
  const map = { ...asMap<ShowcaseI18nEntry>(existing) };
  for (const item of items) {
    const code = languages.find((l) => l.id === item.languageId)?.code;
    if (!code) continue;
    map[code] = {
      title1: item.title1 ?? map[code]?.title1,
      title2: item.title2 ?? map[code]?.title2,
    };
  }
  return map;
}

export function mergeWelcomeI18n(
  existing: unknown,
  items: { languageId: number; message: string }[],
  languages: LangRow[]
) {
  const map = { ...asMap<{ message?: string }>(existing) };
  for (const item of items) {
    const code = languages.find((l) => l.id === item.languageId)?.code;
    if (!code) continue;
    map[code] = { message: item.message };
  }
  return map;
}

export function buildGroupI18n(
  items: { languageId: number; name: string }[],
  languages: LangRow[]
) {
  return mergeGroupI18n({}, items, languages);
}

export function buildProductI18n(
  items: {
    languageId: number;
    name: string;
    description?: string;
    ingredients?: string;
    allergens?: string;
  }[],
  languages: LangRow[]
) {
  return mergeProductI18n({}, items, languages);
}

/** Alerjen pill'lerinden tüm dillere okunabilir metin yazar */
export function applyAllergenTagsToI18n(
  existing: unknown,
  tags: string[],
  languages: LangRow[],
  textForLang: (lang: string) => string
) {
  const map = { ...asMap<ProductI18nEntry>(existing) };
  const codes = new Set([
    ...languages.map((l) => l.code),
    ...Object.keys(map),
    'tr',
    'en',
    'ru',
    'ar',
  ]);
  for (const code of codes) {
    map[code] = {
      ...map[code],
      allergens: textForLang(code),
    };
  }
  return map;
}

export function buildShowcaseI18n(
  items: { languageId: number; title1?: string; title2?: string }[],
  languages: LangRow[]
) {
  return mergeShowcaseI18n({}, items, languages);
}

export function textMatchesI18n(
  json: unknown,
  lang: string,
  fields: string[],
  query: string
) {
  const q = query.toLowerCase();
  const map = asMap<Record<string, string>>(json);
  const entry = map[lang] || map.tr || Object.values(map)[0];
  if (!entry) return false;
  return fields.some((f) => String(entry[f] || '').toLowerCase().includes(q));
}
