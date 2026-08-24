export interface DashboardSummary {
  groups: { active: number; passive: number };
  products: { valid: number; invalid: number; total: number };
  viewsToday: { total: number; unique: number };
}

export interface TopItem {
  id: number;
  name: string;
  count: number;
}

export const DEMO_SUMMARY: DashboardSummary = {
  groups: { active: 23, passive: 21 },
  products: { valid: 259, invalid: 301, total: 560 },
  viewsToday: { total: 847, unique: 312 },
};

export const DEMO_TOP_GROUPS: TopItem[] = [
  { id: 1, name: 'HAMBURGERLER', count: 509 },
  { id: 2, name: 'APERATİFLER', count: 483 },
  { id: 3, name: 'DÜNYA MUTFAĞI ET', count: 339 },
  { id: 4, name: 'KAHVALTILAR', count: 287 },
  { id: 5, name: 'TATLILAR', count: 182 },
  { id: 6, name: 'MEZELER', count: 156 },
  { id: 7, name: 'SALATALAR', count: 134 },
  { id: 8, name: 'PİZZALAR', count: 98 },
  { id: 9, name: 'İÇECEKLER', count: 87 },
  { id: 10, name: 'MAKARNALAR', count: 72 },
];

export const DEMO_TOP_PRODUCTS: TopItem[] = [
  { id: 1, name: 'CHICKEN BURGER CHEESE', count: 38 },
  { id: 2, name: 'BEANS BURGER', count: 29 },
  { id: 3, name: 'ZEEN BURGER', count: 26 },
  { id: 4, name: 'ÇITIR TAVUK', count: 19 },
  { id: 5, name: 'SERPME KAHVALTI', count: 15 },
  { id: 6, name: 'SMASH BURGER', count: 14 },
  { id: 7, name: 'MARGHERITA PİZZA', count: 12 },
  { id: 8, name: 'CAESAR SALATA', count: 11 },
  { id: 9, name: 'HUMMUS', count: 9 },
  { id: 10, name: 'TİRAMİSU', count: 8 },
];

export const DEMO_LANGUAGES: TopItem[] = [
  { id: 1, name: 'English', count: 1200 },
  { id: 2, name: 'Türkçe', count: 800 },
];

export const DEMO_OS: TopItem[] = [
  { id: 1, name: 'iOS', count: 800 },
  { id: 2, name: 'Android', count: 600 },
  { id: 3, name: 'Mac OS X', count: 400 },
  { id: 4, name: 'Windows', count: 200 },
];

export const DEMO_DEVICES: TopItem[] = [
  { id: 1, name: 'Apple', count: 800 },
  { id: 2, name: 'Generic Android', count: 400 },
  { id: 3, name: 'Samsung', count: 200 },
  { id: 4, name: 'Oppo', count: 100 },
  { id: 5, name: 'Mi', count: 100 },
  { id: 6, name: 'Huawei', count: 100 },
  { id: 7, name: 'Unknown', count: 100 },
];

export const DEMO_CHART_MONTHS = [
  { month: 'Oca', gruplar: 120, urunler: 85 },
  { month: 'Şub', gruplar: 145, urunler: 92 },
  { month: 'Mar', gruplar: 180, urunler: 110 },
  { month: 'Nis', gruplar: 210, urunler: 130 },
  { month: 'May', gruplar: 195, urunler: 125 },
  { month: 'Haz', gruplar: 240, urunler: 155 },
  { month: 'Tem', gruplar: 280, urunler: 170 },
  { month: 'Ağu', gruplar: 310, urunler: 190 },
  { month: 'Eyl', gruplar: 265, urunler: 160 },
  { month: 'Eki', gruplar: 230, urunler: 140 },
  { month: 'Kas', gruplar: 200, urunler: 120 },
  { month: 'Ara', gruplar: 175, urunler: 105 },
];

export const DEMO_STATS = {
  topGroups: DEMO_TOP_GROUPS,
  topProducts: DEMO_TOP_PRODUCTS,
  languages: DEMO_LANGUAGES,
  operatingSystems: DEMO_OS,
  devices: DEMO_DEVICES,
};

export interface DemoShowcaseItem {
  id: number;
  name: string;
  productId: number | null;
  productName: string | null;
  imageUrl: string;
  displayType: 'banner' | 'story';
  sortOrder: number;
  isActive: boolean;
  durationSeconds?: number;
  translations: {
    languageId: number;
    languageCode: string;
    title1: string | null;
    title2: string | null;
  }[];
}

export interface DemoMenuStory {
  id: number;
  name: string;
  imageUrl: string;
  productId: number;
  groupId: number;
  sortOrder: number;
  durationSeconds?: number;
  productName?: string | null;
}

export interface DemoMenuBanner {
  id: number;
  imageUrl: string;
  title1: string;
  title2: string;
  sortOrder: number;
}

export const DEMO_SHOWCASE_BANNERS: DemoShowcaseItem[] = [
  {
    id: 9001,
    name: 'Yaz Lezzetleri',
    productId: 1,
    productName: 'CHICKEN BURGER CHEESE',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80',
    displayType: 'banner',
    sortOrder: 1,
    isActive: true,
    translations: [
      { languageId: 1, languageCode: 'tr', title1: 'Yaz Lezzetleri Başladı', title2: 'En sevilen menüler burada' },
      { languageId: 2, languageCode: 'en', title1: 'Summer Flavors', title2: 'Most loved menus here' },
    ],
  },
  {
    id: 9002,
    name: 'Özel Menü',
    productId: 3,
    productName: 'ZEEN BURGER',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80',
    displayType: 'banner',
    sortOrder: 2,
    isActive: true,
    translations: [
      { languageId: 1, languageCode: 'tr', title1: 'Şefin Önerisi', title2: 'Bu haftanın yıldızları' },
      { languageId: 2, languageCode: 'en', title1: "Chef's Pick", title2: 'Stars of the week' },
    ],
  },
];

export const DEMO_SHOWCASE_STORIES: DemoShowcaseItem[] = [
  {
    id: 9101,
    name: 'Burger',
    productId: 1,
    productName: 'CHICKEN BURGER CHEESE',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    displayType: 'story',
    sortOrder: 1,
    isActive: true,
    durationSeconds: 5,
    translations: [],
  },
  {
    id: 9102,
    name: 'Kahvaltı',
    productId: 5,
    productName: 'SERPME KAHVALTI',
    imageUrl: 'https://images.unsplash.com/photo-1533089860890-a1c960265a9c?w=400&q=80',
    displayType: 'story',
    sortOrder: 2,
    isActive: true,
    durationSeconds: 6,
    translations: [],
  },
  {
    id: 9103,
    name: 'Pizza',
    productId: 7,
    productName: 'MARGHERITA PİZZA',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80',
    displayType: 'story',
    sortOrder: 3,
    isActive: true,
    durationSeconds: 5,
    translations: [],
  },
  {
    id: 9104,
    name: 'Salata',
    productId: 8,
    productName: 'CAESAR SALATA',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
    displayType: 'story',
    sortOrder: 4,
    isActive: true,
    durationSeconds: 4,
    translations: [],
  },
  {
    id: 9105,
    name: 'Tatlı',
    productId: 10,
    productName: 'TİRAMİSU',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80',
    displayType: 'story',
    sortOrder: 5,
    isActive: true,
    durationSeconds: 5,
    translations: [],
  },
  {
    id: 9106,
    name: 'Kahve',
    productId: 9,
    productName: 'LATTE',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
    displayType: 'story',
    sortOrder: 6,
    isActive: true,
    durationSeconds: 4,
    translations: [],
  },
];

export const DEMO_MENU_BANNERS: DemoMenuBanner[] = DEMO_SHOWCASE_BANNERS.map((b) => ({
  id: b.id,
  imageUrl: b.imageUrl,
  title1: b.translations.find((t) => t.languageCode === 'tr')?.title1 || b.name,
  title2: b.translations.find((t) => t.languageCode === 'tr')?.title2 || '',
  sortOrder: b.sortOrder,
}));

/** groupId'ler menü yüklendikten sonra gerçek gruplara map edilir */
export const DEMO_MENU_STORIES: Omit<DemoMenuStory, 'groupId'>[] = DEMO_SHOWCASE_STORIES.map(
  (s) => ({
    id: s.id,
    name: s.name,
    imageUrl: s.imageUrl,
    productId: s.productId || 1,
    sortOrder: s.sortOrder,
    durationSeconds: s.durationSeconds ?? 5,
    productName: s.productName,
  })
);

export function mapDemoStoriesToGroups(
  groups: { id: number }[]
): DemoMenuStory[] {
  if (groups.length === 0) {
    return DEMO_MENU_STORIES.map((s) => ({ ...s, groupId: 1 }));
  }
  return DEMO_MENU_STORIES.map((s, i) => ({
    ...s,
    groupId: groups[i % groups.length].id,
  }));
}

export interface DemoPopularProduct {
  id: number;
  name: string;
  price: number;
  groupId: number;
  groupName: string;
  imageUrl?: string | null;
}

export const DEMO_POPULAR_PRODUCTS: DemoPopularProduct[] = DEMO_TOP_PRODUCTS.slice(0, 5).map(
  (p, i) => ({
    id: p.id,
    name: p.name,
    price: 79.9 + i * 25,
    groupId: DEMO_TOP_GROUPS[i % DEMO_TOP_GROUPS.length].id,
    groupName: DEMO_TOP_GROUPS[i % DEMO_TOP_GROUPS.length].name,
    imageUrl: DEMO_SHOWCASE_STORIES[i]?.imageUrl || null,
  })
);

const DEMO_PRODUCT_DETAILS: Record<
  number,
  Omit<
    {
      id: number;
      name: string;
      description: string;
      ingredients: string;
      allergens: string;
      price: number;
      imageUrl: string;
      prepTimeMinutes: number;
      calories: number;
      isRecommended: boolean;
      features: string[];
      group: { id: number; name: string };
    },
    never
  >
> = {
  1: {
    id: 1,
    name: 'CHICKEN BURGER CHEESE',
    description: 'Çıtır tavuk göğsü, erimiş cheddar peyniri ve özel ev yapımı sos ile hazırlanır.',
    ingredients: 'Tavuk göğsü, cheddar, marul, domates, brioche ekmek, ev yapımı sos',
    allergens: 'Gluten, süt, yumurta',
    price: 249.9,
    imageUrl: DEMO_SHOWCASE_STORIES[0].imageUrl,
    prepTimeMinutes: 15,
    calories: 620,
    isRecommended: true,
    features: ['Popüler', 'Sıcak servis'],
    group: { id: 1, name: 'HAMBURGERLER' },
  },
  3: {
    id: 3,
    name: 'ZEEN BURGER',
    description: '180g dana köfte, karamelize soğan ve özel Zeen sosu ile imza lezzetimiz.',
    ingredients: 'Dana eti, cheddar, karamelize soğan, turşu, brioche',
    allergens: 'Gluten, süt',
    price: 279.9,
    imageUrl: DEMO_SHOWCASE_STORIES[0].imageUrl,
    prepTimeMinutes: 18,
    calories: 720,
    isRecommended: true,
    features: ['Şefin seçimi'],
    group: { id: 1, name: 'HAMBURGERLER' },
  },
  5: {
    id: 5,
    name: 'SERPME KAHVALTI',
    description: 'Zengin peynir tabağı, zeytin çeşitleri, reçeller, bal-kaymak ve sıcak tabak.',
    ingredients: 'Peynir çeşitleri, zeytin, yumurta, domates, salatalık, reçel, bal',
    allergens: 'Süt, gluten',
    price: 289.9,
    imageUrl: DEMO_SHOWCASE_STORIES[1].imageUrl,
    prepTimeMinutes: 20,
    calories: 680,
    isRecommended: true,
    features: ['Paylaşımlık'],
    group: { id: 4, name: 'KAHVALTILAR' },
  },
};

export function getDemoProductDetail(productId: number, _lang: string) {
  const base = DEMO_PRODUCT_DETAILS[productId] || {
    id: productId,
    name: DEMO_TOP_PRODUCTS.find((p) => p.id === productId)?.name || 'Demo Ürün',
    description: 'Taze malzemelerle hazırlanan özel lezzetimizi keşfedin.',
    ingredients: 'Günün taze malzemeleri',
    allergens: 'Lütfen servis ekibimize danışın',
    price: 149.9,
    imageUrl: DEMO_SHOWCASE_STORIES[0]?.imageUrl || '',
    prepTimeMinutes: 12,
    calories: 450,
    isRecommended: false,
    features: [] as string[],
    group: {
      id: DEMO_TOP_GROUPS[0].id,
      name: DEMO_TOP_GROUPS[0].name,
    },
  };

  return {
    ...base,
    images: [base.imageUrl, base.imageUrl].filter(Boolean),
    restaurant: { name: 'Zeen Lounge', slug: 'zeen-lounge', logoUrl: null },
  };
}
