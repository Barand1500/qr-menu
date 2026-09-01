import { prisma } from './prisma.js';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  type CatalogTag,
  type PrefLang,
} from './diet-allergens.js';

export const PREF_CATALOG_KEY = 'pref_catalog';

export const BUILTIN_DIET_IDS = new Set(['vegan', 'vegetarian', 'gluten-free', 'diabetic']);

export interface PrefCatalogItem {
  id: string;
  label: Record<PrefLang, string>;
}

export interface PrefCatalog {
  allergens: PrefCatalogItem[];
  diets: PrefCatalogItem[];
}

function defaultCatalog(): PrefCatalog {
  return {
    allergens: ALLERGEN_CATALOG.map((t) => ({ id: t.id, label: { ...t.label } })),
    diets: DIET_CATALOG.map((t) => ({ id: t.id, label: { ...t.label } })),
  };
}

function slugifyId(text: string): string {
  const base = text
    .toLocaleLowerCase('tr-TR')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || `item-${Date.now().toString(36)}`;
}

export function newCatalogItemId(labelTr: string): string {
  return `c-${slugifyId(labelTr)}-${Date.now().toString(36).slice(-4)}`;
}

function cleanLabel(raw: unknown): Record<PrefLang, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tr = typeof o.tr === 'string' ? o.tr.trim() : '';
  if (!tr) return null;
  const pick = (code: PrefLang) =>
    typeof o[code] === 'string' && (o[code] as string).trim()
      ? (o[code] as string).trim()
      : tr;
  return { tr, en: pick('en'), ru: pick('ru'), ar: pick('ar') };
}

function cleanItems(raw: unknown, kind: 'allergen' | 'diet'): PrefCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PrefCatalogItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id.trim() : '';
    const label = cleanLabel((item as { label?: unknown }).label);
    if (!id || !label || seen.has(id)) continue;
    if (kind === 'diet' && id === 'vegetarian' && !BUILTIN_DIET_IDS.has(id)) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

export function parsePrefCatalog(raw: string | null | undefined): PrefCatalog {
  const fallback = defaultCatalog();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { allergens?: unknown; diets?: unknown };
    const allergens = cleanItems(parsed.allergens, 'allergen');
    const diets = cleanItems(parsed.diets, 'diet');
    return {
      allergens: allergens.length > 0 ? allergens : fallback.allergens,
      diets: diets.length > 0 ? diets : fallback.diets,
    };
  } catch {
    return fallback;
  }
}

export async function loadPrefCatalog(restaurantId: number): Promise<PrefCatalog> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: PREF_CATALOG_KEY } },
  });
  return parsePrefCatalog(row?.value);
}

export function catalogAllergenIds(catalog: PrefCatalog): Set<string> {
  return new Set(catalog.allergens.map((t) => t.id));
}

export function catalogDietIds(catalog: PrefCatalog): Set<string> {
  return new Set(catalog.diets.map((t) => t.id));
}

export function sanitizeAllergenTagsForCatalog(ids: unknown, catalog: PrefCatalog): string[] {
  if (!Array.isArray(ids)) return [];
  const valid = catalogAllergenIds(catalog);
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function sanitizeDietTagsForCatalog(ids: unknown, catalog: PrefCatalog): string[] {
  if (!Array.isArray(ids)) return [];
  const valid = catalogDietIds(catalog);
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || BUILTIN_DIET_IDS.has(id) || !valid.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function allergenLabelFromCatalog(id: string, lang: string, catalog: PrefCatalog): string {
  const tag = catalog.allergens.find((t) => t.id === id);
  if (!tag) return id;
  const code = (lang || 'tr').split('-')[0] as PrefLang;
  return tag.label[code] || tag.label.tr;
}

export function dietLabelFromCatalog(id: string, lang: string, catalog: PrefCatalog): string {
  const tag = catalog.diets.find((t) => t.id === id);
  if (!tag) return id;
  const code = (lang || 'tr').split('-')[0] as PrefLang;
  return tag.label[code] || tag.label.tr;
}

export function allergensTextFromCatalog(tags: string[], lang: string, catalog: PrefCatalog): string {
  return tags.map((id) => allergenLabelFromCatalog(id, lang, catalog)).join(', ');
}

export function parseDietTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string' && !BUILTIN_DIET_IDS.has(id));
}

export function serializePrefCatalog(catalog: PrefCatalog): string {
  return JSON.stringify({
    allergens: catalog.allergens,
    diets: catalog.diets,
  });
}

export function normalizePrefCatalogInput(body: unknown): PrefCatalog | null {
  if (!body || typeof body !== 'object') return null;
  const allergens = cleanItems((body as { allergens?: unknown }).allergens, 'allergen');
  const diets = cleanItems((body as { diets?: unknown }).diets, 'diet');
  if (allergens.length === 0 && diets.length === 0) return null;
  const fallback = defaultCatalog();
  return {
    allergens: allergens.length > 0 ? allergens : fallback.allergens,
    diets: diets.length > 0 ? diets : fallback.diets,
  };
}
