/** Sabit alerjen + diyet katalogu (admin pill / menü filtre ortak) */

export type PrefLang = 'tr' | 'en' | 'ru' | 'ar';

export interface CatalogTag {
  id: string;
  kind: 'allergen' | 'diet';
  /** Metinden çıkarım için anahtarlar (normalize edilecek) */
  keys: string[];
  label: Record<PrefLang, string>;
}

export const ALLERGEN_CATALOG: CatalogTag[] = [
  {
    id: 'gluten',
    kind: 'allergen',
    keys: ['gluten', 'bugday', 'wheat', 'arpa', 'cavdar', 'brioche', 'ekmek', 'kruton', 'crouton', 'hamur', 'tost'],
    label: { tr: 'Gluten', en: 'Gluten', ru: 'Глютен', ar: 'غلوتين' },
  },
  {
    id: 'dairy',
    kind: 'allergen',
    keys: [
      'sut',
      'laktoz',
      'lactose',
      'peynir',
      'tereyag',
      'yogurt',
      'kaymak',
      'krema',
      'cream',
      'milk',
      'dairy',
      'cheese',
      'butter',
      'cheddar',
      'mozzarella',
      'mozarella',
      'parmesan',
      'mascarpone',
      'feta',
      'latte',
    ],
    label: { tr: 'Süt / Laktoz', en: 'Dairy / Lactose', ru: 'Молоко / Лактоза', ar: 'حليب / لاكتوز' },
  },
  {
    id: 'egg',
    kind: 'allergen',
    keys: ['yumurta', 'egg', 'eggs', 'menemen', 'mayonez', 'mayonnaise'],
    label: { tr: 'Yumurta', en: 'Egg', ru: 'Яйцо', ar: 'بيض' },
  },
  {
    id: 'peanut',
    kind: 'allergen',
    keys: ['yer fistigi', 'yerfistik', 'peanut', 'peanuts'],
    label: { tr: 'Yer fıstığı', en: 'Peanut', ru: 'Арахис', ar: 'فول سوداني' },
  },
  {
    id: 'tree-nut',
    kind: 'allergen',
    keys: ['findik', 'ceviz', 'badem', 'antep', 'kaju', 'cashew', 'hazelnut', 'walnut', 'almond', 'kuruyemis'],
    label: { tr: 'Kuruyemiş', en: 'Tree nuts', ru: 'Орехи', ar: 'مكسرات' },
  },
  {
    id: 'soy',
    kind: 'allergen',
    keys: ['soya', 'soy', 'soja'],
    label: { tr: 'Soya', en: 'Soy', ru: 'Соя', ar: 'صويا' },
  },
  {
    id: 'fish',
    kind: 'allergen',
    keys: ['balik', 'fish', 'ton', 'somon', 'salmon', 'hamsi', 'levrek'],
    label: { tr: 'Balık', en: 'Fish', ru: 'Рыба', ar: 'سمك' },
  },
  {
    id: 'shellfish',
    kind: 'allergen',
    keys: ['kabuklu', 'karides', 'midye', 'istakoz', 'shellfish', 'shrimp', 'prawn', 'denizurun', 'seafood'],
    label: { tr: 'Kabuklu deniz', en: 'Shellfish', ru: 'Морепродукты', ar: 'محار' },
  },
  {
    id: 'sesame',
    kind: 'allergen',
    keys: ['susam', 'sesame', 'tahin'],
    label: { tr: 'Susam', en: 'Sesame', ru: 'Кунжут', ar: 'سمسم' },
  },
  {
    id: 'mustard',
    kind: 'allergen',
    keys: ['hardal', 'mustard'],
    label: { tr: 'Hardal', en: 'Mustard', ru: 'Горчица', ar: 'خردل' },
  },
];

export const DIET_CATALOG: CatalogTag[] = [
  {
    id: 'vegan',
    kind: 'diet',
    keys: ['vegan'],
    label: { tr: 'Vegan', en: 'Vegan', ru: 'Веган', ar: 'نباتي صرف' },
  },
  {
    id: 'vegetarian',
    kind: 'diet',
    keys: ['vejetaryen', 'vejeteryan', 'vegetarian', 'vegetarien'],
    label: { tr: 'Vejetaryen', en: 'Vegetarian', ru: 'Вегетарианское', ar: 'نباتي' },
  },
  {
    id: 'gluten-free',
    kind: 'diet',
    keys: ['glutensiz', 'gluten free', 'gluten-free', 'glutenfree'],
    label: { tr: 'Glutensiz', en: 'Gluten-free', ru: 'Без глютена', ar: 'خالي من الغلوتين' },
  },
  {
    id: 'diabetic',
    kind: 'diet',
    keys: ['diyabetik', 'diabetic', 'seker hast'],
    label: { tr: 'Diyabetik', en: 'Diabetic-friendly', ru: 'Для диабетиков', ar: 'مناسب لمرضى السكري' },
  },
];

export const ALLERGEN_IDS = ALLERGEN_CATALOG.map((t) => t.id);
export const DIET_IDS = DIET_CATALOG.map((t) => t.id);

export function normalizePrefText(text: string): string {
  return text
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
    .replace(/[^a-z0-9\u0400-\u04ff\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hayHasKey(hay: string, key: string): boolean {
  const k = normalizePrefText(key);
  if (!k) return false;
  if (hay.includes(k)) return true;
  if (k.length <= 3) return new RegExp(`(?:^|\\s)${k}(?:\\s|$)`).test(hay);
  return false;
}

export function parseAllergenTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(ALLERGEN_IDS);
  return raw.filter((id): id is string => typeof id === 'string' && valid.has(id));
}

export function sanitizeAllergenTags(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const valid = new Set(ALLERGEN_IDS);
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function allergenLabel(id: string, lang: string): string {
  const tag = ALLERGEN_CATALOG.find((t) => t.id === id);
  if (!tag) return id;
  const code = (lang || 'tr').split('-')[0] as PrefLang;
  return tag.label[code] || tag.label.tr;
}

export function dietLabel(id: string, lang: string): string {
  const tag = DIET_CATALOG.find((t) => t.id === id);
  if (!tag) return id;
  const code = (lang || 'tr').split('-')[0] as PrefLang;
  return tag.label[code] || tag.label.tr;
}

export function allergensTextFromTags(tags: string[], lang: string): string {
  return tags.map((id) => allergenLabel(id, lang)).join(', ');
}

export function inferAllergenTagsFromText(...parts: (string | null | undefined)[]): string[] {
  const hay = normalizePrefText(parts.filter(Boolean).join(' '));
  if (!hay) return [];
  return ALLERGEN_CATALOG.filter((t) => t.keys.some((k) => hayHasKey(hay, k))).map((t) => t.id);
}

export function inferDietFlagsFromText(
  ...parts: (string | null | undefined)[]
): {
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
} {
  const hay = normalizePrefText(parts.filter(Boolean).join(' '));
  const has = (id: string) => {
    const tag = DIET_CATALOG.find((t) => t.id === id);
    return !!tag && tag.keys.some((k) => hayHasKey(hay, k));
  };
  const isVegan = has('vegan');
  return {
    isVegan,
    isVegetarian: isVegan || has('vegetarian'),
    isGlutenFree: has('gluten-free'),
    isDiabetic: has('diabetic'),
  };
}

/** İsim / malzeme / açıklamaya göre makul diyet bayrakları (seed & migrate) */
export function suggestDietFlags(input: {
  name?: string;
  description?: string;
  ingredients?: string;
  features?: string[];
  allergenTags: string[];
}): {
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
} {
  const fromText = inferDietFlagsFromText(
    input.name,
    input.description,
    input.ingredients,
    ...(input.features || [])
  );
  const tags = input.allergenTags;
  const hasAnimalDairy =
    tags.includes('dairy') || tags.includes('egg') || tags.includes('fish') || tags.includes('shellfish');
  const hasMeatHint = normalizePrefText(
    [input.name, input.description, input.ingredients].filter(Boolean).join(' ')
  );
  const meatWords = [
    'dana',
    'tavuk',
    'et',
    'sucuk',
    'kofte',
    'burger',
    'beef',
    'chicken',
    'sausage',
    'bacon',
    'jambon',
    'prosciutto',
  ];
  const looksMeaty = meatWords.some((w) => hasMeatHint.includes(w)) && !fromText.isVegan;

  let isVegan = fromText.isVegan;
  let isVegetarian = fromText.isVegetarian || isVegan;

  // Vegan burger vb. özellikten geldiyse et kelimesini yoksay
  if (isVegan) {
    isVegetarian = true;
  } else if (!looksMeaty && !tags.includes('fish') && !tags.includes('shellfish')) {
    // Süt/yumurta olan ama et olmayan → vejetaryen adayı
    if (tags.includes('dairy') || tags.includes('egg') || /peynir|mozarella|cheddar|yumurta|menemen|latte|tiramisu|sufle/.test(hasMeatHint)) {
      isVegetarian = true;
    }
    // Salata / portakal suyu / avokado tost (yumurtalı değilse) — ayrı kurallar migrate script'te
  }

  if (hasAnimalDairy && isVegan) {
    isVegan = false;
  }

  return {
    isVegan,
    isVegetarian,
    isGlutenFree: fromText.isGlutenFree || (!tags.includes('gluten') && fromText.isGlutenFree),
    isDiabetic: fromText.isDiabetic,
  };
}

export function dietIdsFromFlags(flags: {
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
}): string[] {
  const ids: string[] = [];
  if (flags.isVegan) ids.push('vegan');
  if (flags.isVegetarian) ids.push('vegetarian');
  if (flags.isGlutenFree) ids.push('gluten-free');
  if (flags.isDiabetic) ids.push('diabetic');
  return ids;
}

export function flagsFromDietIds(ids: string[]): {
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
} {
  const set = new Set(ids);
  const isVegan = set.has('vegan');
  return {
    isVegan,
    isVegetarian: isVegan || set.has('vegetarian'),
    isGlutenFree: set.has('gluten-free'),
    isDiabetic: set.has('diabetic'),
  };
}
