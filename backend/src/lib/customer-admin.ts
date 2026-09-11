import { prisma } from './prisma.js';
import { parsePointsJson } from './customer-auth.js';

export type CustomerDiscount = {
  percent: number;
  note: string;
  expiresAt: string | null;
};

export type CustomerDiscountsMap = Record<string, CustomerDiscount>;

export function parseDiscountsJson(raw: unknown): CustomerDiscountsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CustomerDiscountsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const percent = Number(row.percent);
    if (!Number.isFinite(percent) || percent <= 0) continue;
    out[String(k)] = {
      percent: Math.min(100, Math.round(percent * 100) / 100),
      note: typeof row.note === 'string' ? row.note.trim().slice(0, 200) : '',
      expiresAt:
        typeof row.expiresAt === 'string' && row.expiresAt.trim()
          ? row.expiresAt.trim()
          : null,
    };
  }
  return out;
}

export function serializeDiscountsJson(map: CustomerDiscountsMap): object {
  const out: Record<string, CustomerDiscount> = {};
  for (const [k, v] of Object.entries(map)) {
    if (!v || v.percent <= 0) continue;
    out[k] = {
      percent: Math.min(100, Math.max(0, v.percent)),
      note: String(v.note || '').slice(0, 200),
      expiresAt: v.expiresAt || null,
    };
  }
  return out;
}

export function getRestaurantDiscount(
  raw: unknown,
  restaurantId: number
): CustomerDiscount | null {
  const map = parseDiscountsJson(raw);
  const d = map[String(restaurantId)];
  if (!d || d.percent <= 0) return null;
  if (d.expiresAt) {
    const t = Date.parse(d.expiresAt);
    if (Number.isFinite(t) && t < Date.now()) return null;
  }
  return d;
}

export function getRestaurantPoints(raw: unknown, restaurantId: number) {
  const map = parsePointsJson(raw);
  return map[String(restaurantId)] ?? 0;
}

export async function getDebtBalances(
  restaurantId: number,
  customerIds?: number[]
): Promise<Map<number, number>> {
  const where: { restaurantId: number; kind: { in: string[] }; customerId?: { in: number[] } } = {
    restaurantId,
    kind: { in: ['debt', 'payment'] },
  };
  if (customerIds?.length) where.customerId = { in: customerIds };

  const rows = await prisma.menuCustomerLedger.groupBy({
    by: ['customerId', 'kind'],
    where,
    _sum: { amount: true },
  });

  const map = new Map<number, number>();
  for (const row of rows) {
    const prev = map.get(row.customerId) || 0;
    const sum = Number(row._sum.amount || 0);
    if (row.kind === 'debt') map.set(row.customerId, prev + sum);
    else if (row.kind === 'payment') map.set(row.customerId, prev - sum);
  }
  for (const [id, bal] of map) {
    map.set(id, Math.round(bal * 100) / 100);
  }
  return map;
}

export async function getCustomerDebtBalance(restaurantId: number, customerId: number) {
  const map = await getDebtBalances(restaurantId, [customerId]);
  return map.get(customerId) || 0;
}
