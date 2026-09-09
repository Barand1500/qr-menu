import type { ProductOptionGroup } from './product-options.js';
import { normalizeOptionGroups } from './product-options.js';

export const BULK_PRICE_SNAPSHOT_KEY = 'bulk_price_snapshot';

export type BulkPriceDirection = 'up' | 'down';
export type BulkPriceMode = 'percent' | 'fixed';
export type BulkPriceRounding = 'off' | '0.1' | '0.5' | '1' | '5';
export type BulkOptionsAction = 'base_only' | 'base_and_options';
export type BulkScope = 'all' | 'category' | 'selected';

export type BulkPriceParams = {
  direction: BulkPriceDirection;
  mode: BulkPriceMode;
  value: number;
  rounding: BulkPriceRounding;
  optionsAction: BulkOptionsAction;
};

export type BulkSnapshotItem = {
  productId: number;
  price: number;
  optionGroups: ProductOptionGroup[];
};

export type BulkPriceSnapshot = {
  appliedAt: string;
  params: BulkPriceParams;
  items: BulkSnapshotItem[];
};

export function applyRounding(price: number, rounding: BulkPriceRounding): number {
  if (!Number.isFinite(price)) return 0;
  if (rounding === 'off') return Math.round(price * 100) / 100;
  const step =
    rounding === '0.1' ? 0.1 : rounding === '0.5' ? 0.5 : rounding === '1' ? 1 : 5;
  return Math.round(price / step) * step;
}

export function transformUnitPrice(
  price: number,
  params: Pick<BulkPriceParams, 'direction' | 'mode' | 'value' | 'rounding'>
): { next: number; skipped: boolean; reason?: 'negative' } {
  const value = Math.max(0, Number(params.value) || 0);
  let next = Number(price) || 0;
  if (params.mode === 'percent') {
    const delta = next * (value / 100);
    next = params.direction === 'up' ? next + delta : next - delta;
  } else {
    next = params.direction === 'up' ? next + value : next - value;
  }
  if (next < 0) return { next: Number(price) || 0, skipped: true, reason: 'negative' };
  next = applyRounding(next, params.rounding);
  if (next < 0) return { next: Number(price) || 0, skipped: true, reason: 'negative' };
  return { next: Math.round(next * 100) / 100, skipped: false };
}

export function transformOptionGroups(
  raw: unknown,
  params: Pick<BulkPriceParams, 'direction' | 'mode' | 'value' | 'rounding'>
): { groups: ProductOptionGroup[]; skippedOptions: number; changed: boolean } {
  const groups = normalizeOptionGroups(raw);
  let skippedOptions = 0;
  let changed = false;
  const next = groups.map((g) => ({
    ...g,
    options: g.options.map((o) => {
      const r = transformUnitPrice(o.price, params);
      if (r.skipped) {
        skippedOptions += 1;
        return o;
      }
      if (Math.abs(r.next - o.price) > 0.001) changed = true;
      return { ...o, price: r.next };
    }),
  }));
  return { groups: next, skippedOptions, changed };
}

export function parseBulkSnapshot(raw?: string | null): BulkPriceSnapshot | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<BulkPriceSnapshot>;
    if (!data.appliedAt || !Array.isArray(data.items) || data.items.length === 0) return null;
    return {
      appliedAt: String(data.appliedAt),
      params: data.params as BulkPriceParams,
      items: data.items.map((it) => ({
        productId: Number(it.productId),
        price: Number(it.price) || 0,
        optionGroups: normalizeOptionGroups(it.optionGroups),
      })),
    };
  } catch {
    return null;
  }
}
