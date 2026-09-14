import { prisma } from './prisma.js';

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

/** Sipariş satırlarından stok düş (sadece sınırlı stok). Yetersizse false. */
export async function consumeStockForItems(
  restaurantId: number,
  items: { productId?: number | null; qty?: number }[]
): Promise<{ ok: true } | { ok: false; message: string; productId?: number }> {
  const need = new Map<number, number>();
  for (const item of items) {
    const pid = item.productId != null ? Number(item.productId) : NaN;
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const qty = Math.min(99, Math.max(1, Number(item.qty) || 1));
    need.set(pid, (need.get(pid) || 0) + qty);
  }
  if (!need.size) return { ok: true };

  const ids = [...need.keys()];
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: ids } },
    select: { id: true, stockQty: true, i18n: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const [pid, qty] of need) {
    const p = byId.get(pid);
    if (!p) continue;
    if (p.stockQty == null) continue;
    if (p.stockQty < qty) {
      return {
        ok: false,
        productId: pid,
        message: `Yetersiz stok (ürün #${pid}, kalan ${p.stockQty})`,
      };
    }
  }

  for (const [pid, qty] of need) {
    const p = byId.get(pid);
    if (!p || p.stockQty == null) continue;
    const updated = await prisma.product.updateMany({
      where: { id: pid, restaurantId, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (updated.count === 0) {
      return {
        ok: false,
        productId: pid,
        message: `Yetersiz stok (ürün #${pid})`,
      };
    }
  }
  return { ok: true };
}

/** Sipariş iptal / adet azaltmada stok geri ver (sadece sınırlı stok). */
export async function restoreStockForItems(
  restaurantId: number,
  items: { productId?: number | null; qty?: number }[]
) {
  const add = new Map<number, number>();
  for (const item of items) {
    const pid = item.productId != null ? Number(item.productId) : NaN;
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const qty = Math.min(99, Math.max(1, Number(item.qty) || 1));
    add.set(pid, (add.get(pid) || 0) + qty);
  }
  for (const [pid, qty] of add) {
    await prisma.product.updateMany({
      where: { id: pid, restaurantId, stockQty: { not: null } },
      data: { stockQty: { increment: qty } },
    });
  }
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
