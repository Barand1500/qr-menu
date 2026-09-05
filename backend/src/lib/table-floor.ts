import { prisma } from './prisma.js';

export type FloorOrderItem = {
  id: string;
  productId?: number | null;
  name: string;
  qty: number;
  price: number;
  createdAt: string;
  source: 'admin' | 'customer';
};

export const WAITER_ALERT_MS = 8_000;
export const ACTIVE_STATUSES = ['open', 'reserved'] as const;

export function parseOrdersJson(raw?: string | null): FloorOrderItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        id: String(row.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        productId: row.productId != null ? Number(row.productId) : null,
        name: String(row.name || '').trim().slice(0, 120),
        qty: Math.min(99, Math.max(1, Number(row.qty) || 1)),
        price: Number(row.price) || 0,
        createdAt: String(row.createdAt || new Date().toISOString()),
        source: row.source === 'admin' ? ('admin' as const) : ('customer' as const),
      }))
      .filter((r) => r.name);
  } catch {
    return [];
  }
}

export function parseMergedJson(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function ordersTotal(items: FloorOrderItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export async function findActiveSession(
  restaurantId: number,
  tableNumber: string,
  groupSlug?: string | null
) {
  return prisma.tableFloorSession.findFirst({
    where: {
      restaurantId,
      tableNumber,
      status: { in: [...ACTIVE_STATUSES] },
      groupSlug: groupSlug || null,
    },
    orderBy: { openedAt: 'desc' },
  });
}

/** @deprecated alias — open/reserved */
export async function findOpenSession(
  restaurantId: number,
  tableNumber: string,
  groupSlug?: string | null
) {
  return findActiveSession(restaurantId, tableNumber, groupSlug);
}

export async function openOrGetSession(
  restaurantId: number,
  tableNumber: string,
  groupSlug: string | null | undefined,
  openedBy: 'qr' | 'admin'
) {
  const existing = await findActiveSession(restaurantId, tableNumber, groupSlug || null);
  if (existing) {
    if (existing.status === 'reserved') {
      return prisma.tableFloorSession.update({
        where: { id: existing.id },
        data: { status: 'open', openedBy, openedAt: new Date() },
      });
    }
    return existing;
  }

  return prisma.tableFloorSession.create({
    data: {
      restaurantId,
      tableNumber,
      groupSlug: groupSlug || null,
      status: 'open',
      openedBy,
      openedAt: new Date(),
      ordersJson: '[]',
      mergedJson: '[]',
    },
  });
}

export async function appendOrdersToSession(sessionId: number, items: FloorOrderItem[]) {
  if (!items.length) return null;
  const session = await prisma.tableFloorSession.findUnique({ where: { id: sessionId } });
  if (!session || !ACTIVE_STATUSES.includes(session.status as 'open' | 'reserved')) return null;
  const current = parseOrdersJson(session.ordersJson);
  const next = [...current, ...items];
  return prisma.tableFloorSession.update({
    where: { id: sessionId },
    data: {
      ordersJson: JSON.stringify(next),
      status: 'open',
    },
  });
}

export async function closeSession(sessionId: number, paid = false) {
  return prisma.tableFloorSession.update({
    where: { id: sessionId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      ...(paid ? { paidAt: new Date() } : {}),
    },
  });
}

export function tableCode(n: number, prefix = '') {
  const p = String(prefix || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20);
  return p ? `${p}-${n}` : String(n);
}
