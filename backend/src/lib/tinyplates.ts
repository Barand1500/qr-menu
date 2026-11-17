import { mealSearchTerm, mealTextTr } from './mealdb.js';
export const tinyPlatesKey = () => process.env.TINYPLATES_API_KEY?.trim() || '';
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown, max = 240) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const cache = new Map<string, { expires: number; value: unknown }>(),
  pending = new Map<string, Promise<unknown>>();
let quotaUntil = 0;
async function read(path: string, params: Record<string, string> = {}) {
  const key = tinyPlatesKey();
  if (!key) throw new Error('RECIPE_KEY_REQUIRED');
  const url = new URL(path, 'https://api.tinyplates.dev');
  for (const [name, value] of Object.entries(params))
    url.searchParams.set(name, value);
  const id = `${key}:${url}`;
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.value;
  const inflight = pending.get(id);
  if (inflight) return inflight;
  if (quotaUntil > Date.now()) throw new Error('RECIPE_QUOTA');
  if (pending.size >= 4) throw new Error('RECIPE_BUSY');
  const promise = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      quotaUntil =
        Date.now() +
        (Number.isFinite(seconds) && seconds > 0
          ? Math.min(seconds, 86400)
          : 60) *
          1000;
      throw new Error('RECIPE_QUOTA');
    }
    if (!response.ok) throw new Error('RECIPE_UNAVAILABLE');
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error('RECIPE_RESPONSE_TOO_LARGE');
    const value: unknown = JSON.parse(raw);
    if (cache.size >= 150) cache.delete(cache.keys().next().value!);
    cache.set(id, {
      value,
      expires: Date.now() + (path === '/search' ? 3_600_000 : 86_400_000),
    });
    return value;
  })();
  pending.set(id, promise);
  try {
    return await promise;
  } finally {
    pending.delete(id);
  }
}
export async function searchTinyRecipes(query: string) {
  const body = object(
    await read('/search', {
      query: mealSearchTerm(query),
      limit: '4',
      fields: 'title,url',
    }),
  );
  return (Array.isArray(body.results) ? body.results : [])
    .map(object)
    .filter((item) => /^[a-zA-Z0-9_-]{1,80}$/.test(text(item.id)))
    .slice(0, 4)
    .map((item) => ({
      id: `tiny:${text(item.id)}`,
      name: mealTextTr(text(item.title)),
      source: 'Tiny Plates',
    }));
}
const allergenIds: Record<string, string> = {
  'gluten-cereals': 'gluten',
  wheat: 'gluten',
  milk: 'dairy',
  eggs: 'egg',
  peanuts: 'peanut',
  'nuts-eu': 'tree-nut',
  'tree-nuts-us': 'tree-nut',
  soy: 'soy',
  fish: 'fish',
  crustaceans: 'shellfish',
  molluscs: 'shellfish',
  sesame: 'sesame',
  mustard: 'mustard',
  celery: 'Kereviz',
  lupin: 'Acı bakla',
  sulphites: 'Sülfit',
};
export function normalizeTinyRecipe(value: unknown) {
  const item = object(value);
  if (!text(item.id) || !text(item.title)) return null;
  const name = mealTextTr(text(item.title));
  const ingredients = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map(object)
    .map((line) =>
      mealTextTr(text(line.name || line.localName || line.display, 180)),
    )
    .filter(Boolean)
    .slice(0, 40);
  const allergens = object(item.allergens),
    dietary = object(item.dietary),
    nutrition = object(item.nutrition),
    basis = object(nutrition.basis),
    energy = object(nutrition.calories);
  const calories =
    basis.type === 'serving' &&
    energy.unit === 'kcal' &&
    typeof energy.value === 'number' &&
    Number.isFinite(energy.value) &&
    energy.value >= 0
      ? Math.round(energy.value)
      : undefined;
  const prep = object(object(item.times).prep).seconds;
  const prepTimeMinutes =
    typeof prep === 'number' && Number.isFinite(prep) && prep >= 0
      ? Math.ceil(prep / 60)
      : undefined;
  const url = text(item.url, 500);
  let sourceUrl = 'https://www.tinyplates.dev';
  try {
    const parsed = new URL(url);
    if (
      ['https:', 'http:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
    )
      sourceUrl = parsed.href;
  } catch {}
  return {
    id: `tiny-${text(item.id)}`,
    name,
    aliases: [],
    ingredients,
    description: ingredients.length
      ? `${name}; ${ingredients.slice(0, 4).join(', ')} ile hazırlanan bir tarif.`
      : `${name} — Tiny Plates tarif önerisi.`,
    allergenTags: [
      ...new Set(
        Object.entries(allergenIds)
          .filter(([key]) => allergens[key] === true)
          .map(([, id]) => id),
      ),
    ],
    dietTags:
      dietary.vegan === true
        ? ['vegan', 'vegetarian']
        : dietary.vegetarian === true
          ? ['vegetarian']
          : [],
    features: (Array.isArray(item.categories) ? item.categories : [])
      .map((value) => mealTextTr(text(value, 40)))
      .filter(Boolean)
      .slice(0, 4),
    ...(calories === undefined ? {} : { calories }),
    ...(prepTimeMinutes === undefined ? {} : { prepTimeMinutes }),
    source: {
      name: 'Tiny Plates',
      url: sourceUrl,
      kind: 'api' as const,
      notice: text(allergens.disclaimer, 500),
    },
  };
}
export async function getTinyRecipe(id: string) {
  const body = object(await read(`/recipes/${encodeURIComponent(id)}`));
  return normalizeTinyRecipe(body.recipe);
}
