/** Müşteri tercihleri + admin pill ortak katalogu (TR/EN/RU/AR) */

export type PrefLang = 'tr' | 'en' | 'ru' | 'ar';

export interface CatalogTag {
  id: string;
  kind: 'allergen' | 'diet';
  label: Record<PrefLang, string>;
}

export const ALLERGEN_CATALOG: CatalogTag[] = [
  { id: 'gluten', kind: 'allergen', label: { tr: 'Gluten', en: 'Gluten', ru: 'Глютен', ar: 'غلوتين' } },
  { id: 'dairy', kind: 'allergen', label: { tr: 'Süt / Laktoz', en: 'Dairy / Lactose', ru: 'Молоко / Лактоза', ar: 'حليب / لاكتوز' } },
  { id: 'egg', kind: 'allergen', label: { tr: 'Yumurta', en: 'Egg', ru: 'Яйцо', ar: 'بيض' } },
  { id: 'peanut', kind: 'allergen', label: { tr: 'Yer fıstığı', en: 'Peanut', ru: 'Арахис', ar: 'فول سوداني' } },
  { id: 'tree-nut', kind: 'allergen', label: { tr: 'Kuruyemiş', en: 'Tree nuts', ru: 'Орехи', ar: 'مكسرات' } },
  { id: 'soy', kind: 'allergen', label: { tr: 'Soya', en: 'Soy', ru: 'Соя', ar: 'صويا' } },
  { id: 'fish', kind: 'allergen', label: { tr: 'Balık', en: 'Fish', ru: 'Рыба', ar: 'سمك' } },
  { id: 'shellfish', kind: 'allergen', label: { tr: 'Kabuklu deniz', en: 'Shellfish', ru: 'Морепродукты', ar: 'محار' } },
  { id: 'sesame', kind: 'allergen', label: { tr: 'Susam', en: 'Sesame', ru: 'Кунжут', ar: 'سمسم' } },
  { id: 'mustard', kind: 'allergen', label: { tr: 'Hardal', en: 'Mustard', ru: 'Горчица', ar: 'خردل' } },
];

export const DIET_CATALOG: CatalogTag[] = [
  { id: 'vegan', kind: 'diet', label: { tr: 'Vegan', en: 'Vegan', ru: 'Веган', ar: 'نباتي صرف' } },
  { id: 'vegetarian', kind: 'diet', label: { tr: 'Vejetaryen', en: 'Vegetarian', ru: 'Вегетарианское', ar: 'نباتي' } },
  { id: 'gluten-free', kind: 'diet', label: { tr: 'Glutensiz', en: 'Gluten-free', ru: 'Без глютена', ar: 'خالي من الغلوتين' } },
  { id: 'diabetic', kind: 'diet', label: { tr: 'Diyabetik', en: 'Diabetic-friendly', ru: 'Для диабетиков', ar: 'مناسب لمرضى السكري' } },
];

const STORAGE_KEY = 'menu_dietary_prefs';

export interface DietaryPrefs {
  allergens: string[];
  diets: string[];
}

const VALID_ALLERGEN = new Set(ALLERGEN_CATALOG.map((t) => t.id));
const VALID_DIET = new Set(DIET_CATALOG.map((t) => t.id));

function asLang(lang: string): PrefLang {
  const code = (lang || 'tr').split('-')[0] as PrefLang;
  return ['tr', 'en', 'ru', 'ar'].includes(code) ? code : 'tr';
}

export function allergenLabel(id: string, lang: string): string {
  const tag = ALLERGEN_CATALOG.find((t) => t.id === id);
  return tag ? tag.label[asLang(lang)] : id;
}

export function dietLabel(id: string, lang: string): string {
  const tag = DIET_CATALOG.find((t) => t.id === id);
  return tag ? tag.label[asLang(lang)] : id;
}

export function loadDietaryPrefs(): DietaryPrefs {
  const isAllergenId = (id: string) => VALID_ALLERGEN.has(id) || /^c-[a-z0-9][a-z0-9-]*$/.test(id);
  const isDietId = (id: string) => VALID_DIET.has(id) || /^c-[a-z0-9][a-z0-9-]*$/.test(id);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Eski anahtar
      const legacy = localStorage.getItem('menu_allergy_filters');
      if (legacy) {
        const parsed = JSON.parse(legacy) as unknown;
        const allergens = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === 'string' && isAllergenId(id))
          : [];
        return { allergens, diets: [] };
      }
      return { allergens: [], diets: [] };
    }
    const parsed = JSON.parse(raw) as DietaryPrefs;
    return {
      allergens: Array.isArray(parsed.allergens)
        ? parsed.allergens.filter((id) => isAllergenId(id))
        : [],
      diets: Array.isArray(parsed.diets)
        ? parsed.diets.filter((id) => isDietId(id))
        : [],
    };
  } catch {
    return { allergens: [], diets: [] };
  }
}

export function saveDietaryPrefs(prefs: DietaryPrefs) {
  const isAllergenId = (id: string) => VALID_ALLERGEN.has(id) || /^c-[a-z0-9][a-z0-9-]*$/.test(id);
  const isDietId = (id: string) => VALID_DIET.has(id) || /^c-[a-z0-9][a-z0-9-]*$/.test(id);
  const clean: DietaryPrefs = {
    allergens: prefs.allergens.filter((id) => isAllergenId(id)),
    diets: prefs.diets.filter((id) => isDietId(id)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function prefsActive(prefs: DietaryPrefs): boolean {
  return prefs.allergens.length > 0 || prefs.diets.length > 0;
}

export interface FilterableProduct {
  allergenTags?: string[] | null;
  dietTags?: string[] | null;
  allergens?: string | null;
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
}

const BUILTIN_DIETS = new Set(['vegan', 'vegetarian', 'gluten-free', 'diabetic']);

export function productMatchesPrefs(product: FilterableProduct, prefs: DietaryPrefs): boolean {
  if (!prefsActive(prefs)) return true;

  const tags = Array.isArray(product.allergenTags) ? product.allergenTags : [];
  if (prefs.allergens.some((id) => tags.includes(id))) return false;

  const productDietTags = Array.isArray(product.dietTags) ? product.dietTags : [];

  for (const diet of prefs.diets) {
    if (BUILTIN_DIETS.has(diet)) {
      if (diet === 'vegan' && !product.isVegan) return false;
      if (diet === 'vegetarian' && !product.isVegetarian && !product.isVegan) return false;
      if (diet === 'gluten-free' && !product.isGlutenFree) return false;
      if (diet === 'diabetic' && !product.isDiabetic) return false;
    } else if (!productDietTags.includes(diet)) {
      return false;
    }
  }
  return true;
}

export function dietIdsFromFlags(flags: {
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
}): string[] {
  const ids: string[] = [];
  if (flags.isVegan) ids.push('vegan');
  if (flags.isVegetarian || flags.isVegan) ids.push('vegetarian');
  if (flags.isGlutenFree) ids.push('gluten-free');
  if (flags.isDiabetic) ids.push('diabetic');
  return [...new Set(ids)];
}

export function flagsFromDietIds(ids: string[]) {
  const set = new Set(ids);
  const isVegan = set.has('vegan');
  return {
    isVegan,
    isVegetarian: isVegan || set.has('vegetarian'),
    isGlutenFree: set.has('gluten-free'),
    isDiabetic: set.has('diabetic'),
  };
}

export function preferenceUi(lang: string) {
  const code = asLang(lang);
  const map = {
    tr: {
      title: 'Alerjiniz veya özel bir tercihiniz var mı?',
      hint: 'İsterseniz seçin — atlayabilirsiniz',
      avoidTitle: 'Kaçınmak istedikleriniz',
      dietTitle: 'Tercihleriniz',
      continue: 'Menüye Gir',
      skip: 'Atla',
      banner: 'Size uygun ürünler filtrelendi',
      clear: 'Filtreyi temizle',
      empty: 'Bu seçime uygun ürün bulunamadı',
      sideTitle: 'Alerji / Tercih',
    },
    en: {
      title: 'Any allergies or preferences?',
      hint: 'Optional — you can skip',
      avoidTitle: 'Avoid',
      dietTitle: 'Preferences',
      continue: 'Enter Menu',
      skip: 'Skip',
      banner: 'Products suited for you are shown',
      clear: 'Clear filter',
      empty: 'No matching products for this filter',
      sideTitle: 'Allergy / Diet',
    },
    ru: {
      title: 'Есть аллергия или предпочтения?',
      hint: 'По желанию — можно пропустить',
      avoidTitle: 'Исключить',
      dietTitle: 'Предпочтения',
      continue: 'Войти в меню',
      skip: 'Пропустить',
      banner: 'Показаны подходящие для вас блюда',
      clear: 'Сбросить фильтр',
      empty: 'Нет подходящих блюд',
      sideTitle: 'Аллергия / Диета',
    },
    ar: {
      title: 'هل لديك حساسية أو تفضيلات؟',
      hint: 'اختياري — يمكنك التخطي',
      avoidTitle: 'تجنب',
      dietTitle: 'التفضيلات',
      continue: 'دخول القائمة',
      skip: 'تخطي',
      banner: 'تم عرض المنتجات المناسبة لك',
      clear: 'مسح التصفية',
      empty: 'لا توجد منتجات مطابقة',
      sideTitle: 'حساسية / نظام غذائي',
    },
  } as const;
  return map[code];
}

/** @deprecated — preferenceUi kullan */
export function allergyUi(lang: string) {
  const u = preferenceUi(lang);
  return {
    title: u.title,
    hint: u.hint,
    banner: u.banner,
    clear: u.clear,
    empty: u.empty,
  };
}

export const ALLERGEN_OPTIONS = ALLERGEN_CATALOG;
