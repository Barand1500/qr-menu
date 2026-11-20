/** Ürün bazlı fiyat geçmişi: fiyat değişikliği kayıtlarından zaman serisi ve özet üretir. */
export type HistoryRow = {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number | null;
  changeId: number;
  at: Date;
  /** bulk | restore | manual */
  kind: string;
  summary: string;
  userName: string;
};

export type SeriesPoint = {
  changeId: number;
  at: string;
  kind: string;
  summary: string;
  userName: string;
  oldPrice: number;
  newPrice: number;
};

const chronological = (a: HistoryRow, b: HistoryRow) => a.at.getTime() - b.at.getTime() || a.changeId - b.changeId;

/**
 * Bir ürünün kayıtlarını eskiden yeniye dizer. Yeni fiyatı bilinmeyen (eski sürümden gelen) kayıtta,
 * bir sonraki değişikliğin eski fiyatı (yoksa şu anki fiyat) o değişikliğin sonucu sayılır.
 */
export function buildSeries(rows: HistoryRow[], currentPrice: number | null): SeriesPoint[] {
  const sorted = [...rows].sort(chronological);
  return sorted.map((row, i) => {
    const next = sorted[i + 1];
    const resolved = row.newPrice ?? next?.oldPrice ?? currentPrice ?? row.oldPrice;
    return {
      changeId: row.changeId,
      at: row.at.toISOString(),
      kind: row.kind,
      summary: row.summary,
      userName: row.userName,
      oldPrice: row.oldPrice,
      newPrice: resolved,
    };
  });
}

export type ProductHistorySummary = {
  productId: number;
  name: string;
  changes: number;
  firstPrice: number;
  lastPrice: number;
  lastChangeAt: string;
  /** İlk fiyata göre toplam değişim, % */
  deltaPct: number;
  /** Mini grafik için: ilk fiyat ve her değişiklik sonrası fiyat (en fazla 16) */
  spark: number[];
};

export function summarizeProducts(rows: HistoryRow[], currentById: Map<number, number>): ProductHistorySummary[] {
  const byProduct = new Map<number, HistoryRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId);
    if (list) list.push(row);
    else byProduct.set(row.productId, [row]);
  }
  const out: ProductHistorySummary[] = [];
  for (const [productId, list] of byProduct) {
    const series = buildSeries(list, currentById.get(productId) ?? null);
    const first = series[0].oldPrice;
    const last = series[series.length - 1].newPrice;
    const latest = [...list].sort(chronological).pop()!;
    out.push({
      productId,
      name: latest.productName,
      changes: series.length,
      firstPrice: first,
      lastPrice: last,
      lastChangeAt: series[series.length - 1].at,
      deltaPct: first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0,
      spark: [first, ...series.map((p) => p.newPrice)].slice(-16),
    });
  }
  return out;
}

export const HISTORY_SORTS = ['recent', 'changes', 'rise', 'fall', 'name'] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number];

export function sortSummaries(list: ProductHistorySummary[], sort: HistorySort): ProductHistorySummary[] {
  const copy = [...list];
  const by: Record<HistorySort, (a: ProductHistorySummary, b: ProductHistorySummary) => number> = {
    recent: (a, b) => b.lastChangeAt.localeCompare(a.lastChangeAt),
    changes: (a, b) => b.changes - a.changes || b.lastChangeAt.localeCompare(a.lastChangeAt),
    rise: (a, b) => b.deltaPct - a.deltaPct,
    fall: (a, b) => a.deltaPct - b.deltaPct,
    name: (a, b) => a.name.localeCompare(b.name, 'tr'),
  };
  return copy.sort(by[sort]);
}

export type MenuIndexPoint = { t: string; value: number };

/**
 * Menü fiyat endeksi: fiyatı değişen ürünlerin ilk fiyatına göre ortalama seviyesi (başlangıç 100).
 * Her gün için gün sonu değeri verilir; böylece uzun geçmişte de grafik hafif kalır.
 */
export function buildMenuIndex(rows: HistoryRow[], currentById: Map<number, number>): MenuIndexPoint[] {
  const byProduct = new Map<number, HistoryRow[]>();
  for (const r of rows) {
    const list = byProduct.get(r.productId);
    if (list) list.push(r);
    else byProduct.set(r.productId, [r]);
  }
  type Ev = { at: number; productId: number; price: number };
  const first = new Map<number, number>();
  const events: Ev[] = [];
  for (const [productId, list] of byProduct) {
    const series = buildSeries(list, currentById.get(productId) ?? null);
    if (series[0].oldPrice <= 0) continue;
    first.set(productId, series[0].oldPrice);
    for (const p of series) events.push({ at: new Date(p.at).getTime(), productId, price: p.newPrice });
  }
  events.sort((a, b) => a.at - b.at);
  if (!events.length) return [];
  const now = new Map<number, number>(first);
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const out: MenuIndexPoint[] = [{ t: new Date(events[0].at - 86_400_000).toISOString(), value: 100 }];
  const value = () => {
    let sum = 0;
    for (const [id, base] of first) sum += (now.get(id) ?? base) / base;
    return Math.round((sum / first.size) * 1000) / 10;
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    now.set(e.productId, e.price);
    const last = i === events.length - 1 || day(events[i + 1].at) !== day(e.at);
    if (last) out.push({ t: new Date(e.at).toISOString(), value: value() });
  }
  return out;
}

export type ActivityDay = { day: string; changes: number };

/** Son N günde (bugün dahil) kaç ayrı fiyat işlemi yapıldı. */
export function buildActivity(rows: HistoryRow[], days = 14, now = new Date()): ActivityDay[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.changeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const d = r.at.toISOString().slice(0, 10);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const out: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day: d, changes: counts.get(d) ?? 0 });
  }
  return out;
}
