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
