import { api } from '@/lib/api';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  type CatalogTag,
} from '@/lib/dietAllergens';

export type PrefCatalogItem = {
  id: string;
  /** Dil kodu → etiket (tr zorunlu) */
  label: Record<string, string>;
};

export type PrefCatalog = {
  allergens: PrefCatalogItem[];
  diets: PrefCatalogItem[];
};

export const BUILTIN_DIET_IDS = new Set(['vegan', 'vegetarian', 'gluten-free', 'diabetic']);

export function defaultPrefCatalog(): PrefCatalog {
  return {
    allergens: ALLERGEN_CATALOG.map((t) => ({ id: t.id, label: { ...t.label } })),
    diets: DIET_CATALOG.map((t) => ({ id: t.id, label: { ...t.label } })),
  };
}

export function newCatalogItemId(labelTr: string): string {
  const base = labelTr
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
  return `c-${base || 'item'}-${Date.now().toString(36).slice(-4)}`;
}

export function catalogLabel(
  catalog: PrefCatalog,
  kind: 'allergen' | 'diet',
  id: string,
  lang = 'tr'
): string {
  const list = kind === 'allergen' ? catalog.allergens : catalog.diets;
  const tag = list.find((t) => t.id === id);
  if (!tag) return id;
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  return tag.label[code] || tag.label.tr || id;
}

export function catalogToOptions(catalog: PrefCatalog, kind: 'allergen' | 'diet') {
  const list = kind === 'allergen' ? catalog.allergens : catalog.diets;
  return list.map((t) => ({ id: t.id, label: t.label.tr }));
}

export async function fetchPrefCatalog(): Promise<PrefCatalog> {
  try {
    const data = await api<PrefCatalog>('/api/admin/settings/pref-catalog');
    if (data?.allergens?.length && data?.diets?.length) return data;
  } catch {
    /* varsayılan */
  }
  return defaultPrefCatalog();
}

export async function savePrefCatalog(catalog: PrefCatalog): Promise<PrefCatalog> {
  return api<PrefCatalog>('/api/admin/settings/pref-catalog', {
    method: 'PUT',
    body: JSON.stringify(catalog),
  });
}

const SESSION_CATALOG_KEY = 'menu_pref_catalog';

export function storePrefCatalogSession(catalog: PrefCatalog) {
  try {
    sessionStorage.setItem(SESSION_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    /* ignore */
  }
}

export function loadPrefCatalogSession(): PrefCatalog | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrefCatalog;
    if (parsed?.allergens?.length && parsed?.diets?.length) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolvePrefCatalog(remote?: PrefCatalog | null): PrefCatalog {
  return remote?.allergens?.length && remote?.diets?.length
    ? remote
    : loadPrefCatalogSession() || defaultPrefCatalog();
}

export function dietIdsFromProduct(
  flags: {
    isVegan?: boolean;
    isVegetarian?: boolean;
    isGlutenFree?: boolean;
    isDiabetic?: boolean;
  },
  dietTags: string[] = []
): string[] {
  const ids: string[] = [];
  if (flags.isVegan) ids.push('vegan');
  if (flags.isVegetarian || flags.isVegan) ids.push('vegetarian');
  if (flags.isGlutenFree) ids.push('gluten-free');
  if (flags.isDiabetic) ids.push('diabetic');
  for (const id of dietTags) {
    if (!BUILTIN_DIET_IDS.has(id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function flagsFromDietSelection(ids: string[]) {
  const set = new Set(ids);
  const isVegan = set.has('vegan');
  const builtinCustom = ids.filter((id) => !BUILTIN_DIET_IDS.has(id));
  return {
    isVegan,
    isVegetarian: isVegan || set.has('vegetarian'),
    isGlutenFree: set.has('gluten-free'),
    isDiabetic: set.has('diabetic'),
    dietTags: builtinCustom,
  };
}

/** @deprecated use CatalogTag from dietAllergens */
export type { CatalogTag };
