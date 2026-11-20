import type { BulkPriceParams } from './bulk-price.js';

export type PriceChangeKind = 'bulk' | 'restore' | 'manual';

/** Listede gösterilen kısa örnek: ilk birkaç ürünün eski → yeni fiyatı. */
export type PriceChangeSample = {
  name: string;
  oldPrice: number;
  newPrice: number | null;
  symbol: string;
};

export type BulkScopeInfo = {
  kind: 'all' | 'category' | 'selected' | 'unknown';
  groupName?: string;
  count?: number;
};

const SAMPLE_SIZE = 3;
export const PRICE_HISTORY_LIMIT = 100;

function formatAmount(value: number) {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

/**
 * "%10 zam · Burgerler grubu" gibi kısa açıklama. Para birimi simgesi yalnızca tüm ürünlerde aynıysa verilir.
 */
export function describeBulkChange(
  params: BulkPriceParams,
  scope: BulkScopeInfo,
  symbol: string | null,
): string {
  const word = params.direction === 'up' ? 'zam' : 'indirim';
  const amount =
    params.mode === 'percent'
      ? `%${formatAmount(params.value)}`
      : `${formatAmount(params.value)}${symbol ? ` ${symbol}` : ''}`;
  const parts = [`${amount} ${word}`];
  if (params.optionsAction === 'base_and_options') parts[0] += ' (seçenekler dahil)';
  if (scope.kind === 'all') parts.push('Tüm ürünler');
  else if (scope.kind === 'category') parts.push(scope.groupName ? `${scope.groupName} grubu` : 'Bir grup');
  else if (scope.kind === 'selected') parts.push(`${scope.count ?? 0} seçili ürün`);
  return parts.join(' · ').slice(0, 250);
}

export function describeRestore(originalSummary: string): string {
  return `Geri alındı: ${originalSummary}`.slice(0, 250);
}

export function buildSample(
  items: { name: string; oldPrice: number; newPrice: number | null; symbol: string }[],
): PriceChangeSample[] {
  return items.slice(0, SAMPLE_SIZE).map((i) => ({
    name: i.name,
    oldPrice: i.oldPrice,
    newPrice: i.newPrice,
    symbol: i.symbol,
  }));
}
