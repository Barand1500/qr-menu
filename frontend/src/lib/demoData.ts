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
  { id: 2, name: 'APARATİFLER', count: 483 },
  { id: 3, name: 'DÜNYA MUTFAĞI ET', count: 339 },
  { id: 4, name: 'KAHVALTILAR', count: 287 },
  { id: 5, name: 'TATLILAR', count: 182 },
];

export const DEMO_TOP_PRODUCTS: TopItem[] = [
  { id: 1, name: 'CHICKEN BURGER CHEESE', count: 38 },
  { id: 2, name: 'SMASH BURGER', count: 29 },
  { id: 3, name: 'ZEEN BURGER', count: 26 },
  { id: 4, name: 'ÇITIR TAVUK', count: 19 },
  { id: 5, name: 'SERPME KAHVALTI', count: 15 },
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
