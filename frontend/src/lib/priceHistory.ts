/** Ürün bazlı fiyat geçmişi: sunucu tipleri ve grafik/özet yardımcıları. */
export type SeriesPoint = {
  changeId: number;
  at: string;
  /** bulk | restore | manual */
  kind: string;
  summary: string;
  userName: string;
  oldPrice: number;
  newPrice: number;
};

export type ProductHistoryItem = {
  productId: number;
  name: string;
  imageUrl: string | null;
  symbol: string;
  currentPrice: number | null;
  changes: number;
  firstPrice: number;
  lastPrice: number;
  lastChangeAt: string;
  deltaPct: number;
  /** Mini grafik değerleri (ilk fiyat + her değişiklik sonrası) */
  spark: number[];
  exists: boolean;
};

export type ProductHistory = {
  product: {
    id: number;
    name: string;
    imageUrl: string | null;
    symbol: string;
    currentPrice: number | null;
    createdAt: string | null;
    exists: boolean;
  };
  points: SeriesPoint[];
};

export type HistorySort = 'recent' | 'changes' | 'rise' | 'fall' | 'name';
export const SORT_LABELS: Record<HistorySort, string> = {
  recent: 'Son değişen',
  changes: 'En çok değişen',
  rise: 'En çok artan',
  fall: 'En çok düşen',
  name: 'A–Z',
};

export type RangeId = '30' | '90' | '365' | 'all';
export const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: '30', label: '30 gün', days: 30 },
  { id: '90', label: '3 ay', days: 90 },
  { id: '365', label: '1 yıl', days: 365 },
  { id: 'all', label: 'Tümü', days: null },
];

export const KIND_LABEL: Record<string, string> = {
  bulk: 'Toplu işlem',
  restore: 'Geri alma',
  manual: 'Elle düzenleme',
};

/** Grafikteki bir nokta: zaman, o andan itibaren geçerli fiyat ve (varsa) değişikliğin kendisi. */
export type ChartDatum = {
  t: number;
  price: number;
  point?: SeriesPoint;
  /** Bu noktada fiyat arttı mı (true), düştü mü (false) */
  up?: boolean;
};

const DAY = 86_400_000;

/** O ana kadar geçerli fiyat (hiç değişiklik yoksa ilk kaydın eski fiyatı). */
export function priceAt(points: SeriesPoint[], t: number): number {
  let price = points[0]?.oldPrice ?? 0;
  for (const p of points) {
    if (new Date(p.at).getTime() <= t) price = p.newPrice;
    else break;
  }
  return price;
}

/**
 * Basamaklı grafik verisi: seçilen aralığın başındaki fiyatla başlar, aralıktaki her değişiklikten sonra yeni
 * fiyata geçer ve bugüne kadar uzanır.
 */
export function buildChartData(points: SeriesPoint[], range: RangeId, createdAt: string | null, now = Date.now()): ChartDatum[] {
  if (!points.length) return [];
  const rangeDays = RANGES.find((r) => r.id === range)?.days ?? null;
  const firstAt = new Date(points[0].at).getTime();
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  const naturalStart = Number.isFinite(created) && created < firstAt ? created : firstAt - 2 * DAY;
  const from = rangeDays ? Math.max(now - rangeDays * DAY, naturalStart) : naturalStart;
  const data: ChartDatum[] = [{ t: from, price: priceAt(points, from) }];
  for (const p of points) {
    const t = new Date(p.at).getTime();
    if (t < from) continue;
    data.push({ t, price: p.newPrice, point: p, up: p.newPrice >= p.oldPrice });
  }
  const last = data[data.length - 1];
  if (last.t < now) data.push({ t: now, price: last.price });
  return data;
}

export type PriceStats = {
  current: number;
  min: { price: number; at: number };
  max: { price: number; at: number };
  first: number;
  deltaPct: number;
  changes: number;
  lastAt: number | null;
};

export function priceStats(points: SeriesPoint[], currentPrice: number | null): PriceStats | null {
  if (!points.length) return null;
  const ts = (p: SeriesPoint) => new Date(p.at).getTime();
  let min = { price: points[0].oldPrice, at: ts(points[0]) };
  let max = { ...min };
  for (const p of points) {
    for (const price of [p.oldPrice, p.newPrice]) {
      if (price < min.price) min = { price, at: ts(p) };
      if (price > max.price) max = { price, at: ts(p) };
    }
  }
  const first = points[0].oldPrice;
  const current = currentPrice ?? points[points.length - 1].newPrice;
  return {
    current,
    min,
    max,
    first,
    deltaPct: first > 0 ? Math.round(((current - first) / first) * 1000) / 10 : 0,
    changes: points.length,
    lastAt: ts(points[points.length - 1]),
  };
}

export function formatDelta(pct: number): string {
  if (!pct) return '%0';
  return `${pct > 0 ? '+' : '−'}%${Math.abs(pct).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

export function formatShortDate(t: number, withYear = false): string {
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

/** "Bugün 14:32", "Dün 09:10" ya da "18 Kas 2026, 14:32". */
export function formatWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);
  if (diff === 0) return `Bugün ${time}`;
  if (diff === 1) return `Dün ${time}`;
  return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

/** Grafiğin x ekseni: gerçek zaman ya da değişiklikler eşit aralıkla "sırayla". */
export type ChartMode = 'time' | 'steps';

/** Değişiklikler birkaç güne sıkışmışsa zaman ekseni tek bir dikey çizgiye döner; o zaman "sırayla" daha okunur. */
export function defaultChartMode(points: SeriesPoint[]): ChartMode {
  if (points.length < 2) return 'steps';
  const times = points.map((p) => new Date(p.at).getTime());
  const span = Math.max(...times) - Math.min(...times);
  return span < 5 * 86_400_000 ? 'steps' : 'time';
}

export type StepDatum = ChartDatum & { label: string };

/** "Sırayla" modu: başlangıç + her değişiklik eşit aralıkta; x = sıra numarası. */
export function buildStepData(points: SeriesPoint[]): StepDatum[] {
  if (!points.length) return [];
  const out: StepDatum[] = [{ t: 0, price: points[0].oldPrice, label: 'Başlangıç' }];
  points.forEach((p, i) => out.push({ t: i + 1, price: p.newPrice, point: p, up: p.newPrice >= p.oldPrice, label: formatShortDate(new Date(p.at).getTime()) }));
  return out;
}

export type Overview = {
  totals: { products: number; changes: number; avgDeltaPct: number };
  index: { t: string; value: number }[];
  activity: { day: string; changes: number }[];
  movers: {
    up: { productId: number; name: string; deltaPct: number; lastPrice: number; symbol: string }[];
    down: { productId: number; name: string; deltaPct: number; lastPrice: number; symbol: string }[];
  };
  recent: { changeId: number; productId: number; name: string; at: string; kind: string; userName: string; oldPrice: number; newPrice: number }[];
};
