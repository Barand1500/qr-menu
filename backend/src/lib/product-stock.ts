import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { normalizeOptionGroups } from './product-options.js';

/** null = sınırsız (UI: S) */
export type StockQty = number | null;

export function isSoldOut(stockQty: StockQty | undefined): boolean {
  return stockQty === 0;
}

export function parseStockQtyInput(raw: unknown): { ok: true; value: StockQty } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || /^s$/i.test(t)) return { ok: true, value: null };
    if (!/^\d+$/.test(t)) {
      return { ok: false, message: 'Stok sadece S (sınırsız) veya sayı olabilir' };
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 999_999) {
      return { ok: false, message: 'Geçersiz stok adedi' };
    }
    return { ok: true, value: Math.floor(n) };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 999_999) {
    return { ok: false, message: 'Geçersiz stok adedi' };
  }
  return { ok: true, value: Math.floor(n) };
}

export function parseStockResetPatch(body: Record<string, unknown>): {
  ok: true;
  data: {
    stockResetHour?: number | null;
    stockResetMinute?: number | null;
    stockResetTo?: number | null;
  };
} | { ok: false; message: string } {
  const data: {
    stockResetHour?: number | null;
    stockResetMinute?: number | null;
    stockResetTo?: number | null;
  } = {};

  if ('stockResetHour' in body) {
    if (body.stockResetHour === null || body.stockResetHour === '') {
      data.stockResetHour = null;
      data.stockResetMinute = null;
    } else {
      const h = Number(body.stockResetHour);
      if (!Number.isInteger(h) || h < 0 || h > 23) {
        return { ok: false, message: 'Reset saati 0–23 olmalı' };
      }
      data.stockResetHour = h;
      if (!('stockResetMinute' in body)) data.stockResetMinute = 0;
    }
  }

  if ('stockResetMinute' in body) {
    if (body.stockResetMinute === null || body.stockResetMinute === '') {
      data.stockResetMinute = 0;
    } else {
      const m = Number(body.stockResetMinute);
      if (!Number.isInteger(m) || m < 0 || m > 59) {
        return { ok: false, message: 'Reset dakikası 0–59 olmalı' };
      }
      data.stockResetMinute = m;
    }
  }

  if ('stockResetTo' in body) {
    const parsed = parseStockQtyInput(body.stockResetTo);
    if (!parsed.ok) return parsed;
    data.stockResetTo = parsed.value;
  }

  return { ok: true, data };
}

export type StockLineItem = {
  productId?: number | null;
  qty?: number;
  selections?: { optionId?: string; qty?: number }[];
};

/** Satırları ürün ve varyant bazında toplam adede indirger */
function groupNeeds(items: StockLineItem[]) {
  const products = new Map<number, number>();
  const options = new Map<number, Map<string, number>>();

  for (const item of items) {
    const pid = item.productId != null ? Number(item.productId) : NaN;
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const lineQty = Math.min(99, Math.max(1, Number(item.qty) || 1));
    products.set(pid, (products.get(pid) || 0) + lineQty);

    for (const sel of item.selections || []) {
      const oid = String(sel.optionId || '').trim();
      if (!oid) continue;
      const optQty = Math.min(99, Math.max(1, Number(sel.qty) || 1)) * lineQty;
      const perProduct = options.get(pid) || new Map<string, number>();
      perProduct.set(oid, (perProduct.get(oid) || 0) + optQty);
      options.set(pid, perProduct);
    }
  }

  return { products, options };
}

/** optionGroups JSON'undaki varyant stoklarını delta kadar değiştirir */
async function shiftOptionStocks(
  restaurantId: number,
  productId: number,
  deltas: Map<string, number>,
  sign: 1 | -1
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!deltas.size) return { ok: true };
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
    select: { optionGroups: true },
  });
  if (!product) return { ok: true };

  const groups = normalizeOptionGroups(product.optionGroups);
  let touched = false;

  for (const group of groups) {
    for (const option of group.options) {
      const need = deltas.get(option.id);
      if (!need) continue;
      if (option.stockQty == null) continue;
      const next = option.stockQty + sign * need;
      if (next < 0) {
        return {
          ok: false,
          message: `"${option.name}" için yeterli stok yok (kalan ${option.stockQty})`,
        };
      }
      option.stockQty = next;
      touched = true;
    }
  }

  if (touched) {
    await prisma.product.update({
      where: { id: productId },
      data: { optionGroups: groups as unknown as Prisma.InputJsonValue },
    });
  }
  return { ok: true };
}

/** Sipariş satırlarından stok düş (sadece sınırlı stok). Yetersizse false. */
export async function consumeStockForItems(
  restaurantId: number,
  items: StockLineItem[]
): Promise<{ ok: true } | { ok: false; message: string; productId?: number }> {
  const { products: need, options } = groupNeeds(items);
  if (!need.size) return { ok: true };

  const ids = [...need.keys()];
  const rows = await prisma.product.findMany({
    where: { restaurantId, id: { in: ids } },
    select: { id: true, stockQty: true },
  });
  const byId = new Map(rows.map((p) => [p.id, p]));

  for (const [pid, qty] of need) {
    const p = byId.get(pid);
    if (!p || p.stockQty == null) continue;
    if (p.stockQty < qty) {
      return {
        ok: false,
        productId: pid,
        message: `Yetersiz stok (ürün #${pid}, kalan ${p.stockQty})`,
      };
    }
  }

  const consumed: number[] = [];
  for (const [pid, qty] of need) {
    const p = byId.get(pid);
    if (!p || p.stockQty == null) continue;
    const updated = await prisma.product.updateMany({
      where: { id: pid, restaurantId, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (updated.count === 0) {
      // Yarım kalan düşümleri geri al
      for (const donePid of consumed) {
        await prisma.product.updateMany({
          where: { id: donePid, restaurantId, stockQty: { not: null } },
          data: { stockQty: { increment: need.get(donePid) || 0 } },
        });
      }
      return { ok: false, productId: pid, message: `Yetersiz stok (ürün #${pid})` };
    }
    consumed.push(pid);
  }

  for (const [pid, deltas] of options) {
    const result = await shiftOptionStocks(restaurantId, pid, deltas, -1);
    if (!result.ok) {
      for (const donePid of consumed) {
        await prisma.product.updateMany({
          where: { id: donePid, restaurantId, stockQty: { not: null } },
          data: { stockQty: { increment: need.get(donePid) || 0 } },
        });
      }
      return { ok: false, productId: pid, message: result.message };
    }
  }

  return { ok: true };
}

/** Sipariş iptal / adet azaltmada stok geri ver (sadece sınırlı stok). */
export async function restoreStockForItems(restaurantId: number, items: StockLineItem[]) {
  const { products: add, options } = groupNeeds(items);
  for (const [pid, qty] of add) {
    await prisma.product.updateMany({
      where: { id: pid, restaurantId, stockQty: { not: null } },
      data: { stockQty: { increment: qty } },
    });
  }
  for (const [pid, deltas] of options) {
    await shiftOptionStocks(restaurantId, pid, deltas, 1);
  }
}

/** Varyant stoklarını admin panelinden topluca ayarla */
export async function setOptionStocks(
  restaurantId: number,
  productId: number,
  entries: { optionId: string; stockQty: number | null }[]
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
    select: { optionGroups: true },
  });
  if (!product) return false;

  const wanted = new Map(entries.map((e) => [String(e.optionId), e.stockQty]));
  const groups = normalizeOptionGroups(product.optionGroups);
  for (const group of groups) {
    for (const option of group.options) {
      if (!wanted.has(option.id)) continue;
      option.stockQty = wanted.get(option.id) ?? null;
    }
  }

  await prisma.product.update({
    where: { id: productId },
    data: { optionGroups: groups as unknown as Prisma.InputJsonValue },
  });
  return true;
}

/**
 * Günlük reset: stockResetHour set olan ürünleri o dakikada stockResetTo'ya çeker.
 * Aynı gün tekrar etmez (stockResetLastAt).
 */
export async function runDailyStockResets(now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const due = await prisma.product.findMany({
    where: {
      stockResetHour: hour,
      OR: [{ stockResetMinute: minute }, { stockResetMinute: null }],
      AND: [
        {
          OR: [{ stockResetLastAt: null }, { stockResetLastAt: { lt: dayStart } }],
        },
      ],
    },
    select: { id: true, stockResetTo: true },
  });

  if (!due.length) return 0;

  let n = 0;
  for (const p of due) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        stockQty: p.stockResetTo,
        stockResetLastAt: now,
      },
    });
    n += 1;
  }
  return n;
}

export function startStockResetScheduler() {
  const tick = () => {
    runDailyStockResets().catch((err) => {
      console.warn('[stock] günlük reset hatası:', err);
    });
  };
  tick();
  return setInterval(tick, 60_000);
}
