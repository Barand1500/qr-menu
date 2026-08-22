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
