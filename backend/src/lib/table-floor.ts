import { prisma } from './prisma.js';
import {
  codeExpiryDate,
  generateUniqueAccessCode,
  loadTableSessionCodeConfig,
} from './table-session-code.js';

export type FloorOrderSelection = {
  groupId: string;
  optionId: string;
  qty: number;
  label?: string;
};

export type FloorOrderItem = {
  id: string;
  productId?: number | null;
  name: string;
  qty: number;
  price: number;
  createdAt: string;
  source: 'admin' | 'customer';
  /** Görünen satır notu (seçenekler + serbest not) */
  note?: string;
  /** Garsonun yazdığı serbest not */
  freeNote?: string;
  selections?: FloorOrderSelection[];
  /** ekstra / indirim */
  adjustmentType?: 'extra' | 'discount' | null;
  adjustmentMode?: 'fixed' | 'percent';
  adjustmentValue?: number;
};

export const WAITER_ALERT_MS = 8_000;
export const ACTIVE_STATUSES = ['open', 'reserved'] as const;

export function lineTotal(item: {
  price: number;
  qty: number;
  adjustmentType?: 'extra' | 'discount' | null;
  adjustmentMode?: 'fixed' | 'percent';
  adjustmentValue?: number;
}) {
  const base = (Number(item.price) || 0) * Math.max(1, Number(item.qty) || 1);
  const val = Math.abs(Number(item.adjustmentValue) || 0);
  if (!val || !item.adjustmentType) return base;
  const delta = item.adjustmentMode === 'percent' ? (base * val) / 100 : val;
  if (item.adjustmentType === 'extra') return base + delta;
  if (item.adjustmentType === 'discount') return Math.max(0, base - delta);
  return base;
}

export function parseOrdersJson(raw?: string | null): FloorOrderItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const adjustmentType =
          row.adjustmentType === 'extra' || row.adjustmentType === 'discount'
            ? (row.adjustmentType as 'extra' | 'discount')
            : null;
        const adjustmentMode: 'fixed' | 'percent' =
          row.adjustmentMode === 'percent' ? 'percent' : 'fixed';
        const adjustmentValue = Math.abs(Number(row.adjustmentValue) || 0);
        const selections = Array.isArray(row.selections)
          ? row.selections
              .map((s: Record<string, unknown>) => ({
                groupId: String(s.groupId || ''),
                optionId: String(s.optionId || ''),
                qty: Math.min(99, Math.max(1, Number(s.qty) || 1)),
                label: String(s.label || '').trim().slice(0, 80) || undefined,
              }))
              .filter((s: FloorOrderSelection) => s.groupId && s.optionId)
          : undefined;
        const freeNote = String(row.freeNote || '').trim().slice(0, 240) || undefined;
        return {
          id: String(row.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
          productId: row.productId != null ? Number(row.productId) : null,
          name: String(row.name || '').trim().slice(0, 120),
          qty: Math.min(99, Math.max(1, Number(row.qty) || 1)),
          price: Number(row.price) || 0,
          createdAt: String(row.createdAt || new Date().toISOString()),
          source: row.source === 'admin' ? ('admin' as const) : ('customer' as const),
          note: String(row.note || '').trim().slice(0, 240) || undefined,
          freeNote,
          selections: selections?.length ? selections : undefined,
          adjustmentType,
          adjustmentMode: adjustmentType ? adjustmentMode : undefined,
          adjustmentValue: adjustmentType && adjustmentValue > 0 ? adjustmentValue : undefined,
        };
      })
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
  return items.reduce((sum, i) => sum + lineTotal(i), 0);
}

export type SeatingFeeConfig = {
  enabled: boolean;
  rate: number;
  unit: 'minute' | 'hour';
};

export function parseSeatingFee(raw: unknown): SeatingFeeConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: Boolean(r.enabled),
    rate: Math.abs(Number(r.rate) || 0),
    unit: r.unit === 'hour' ? 'hour' : 'minute',
  };
}

/** Açık oturumda birikmiş oturma ücreti (anlık) */
export function seatingFeeAmount(
  fee: SeatingFeeConfig | null | undefined,
  openedAt: Date | string | null | undefined,
  status?: string | null,
  nowMs = Date.now()
) {
  if (!fee?.enabled || !fee.rate || status !== 'open' || !openedAt) return 0;
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const elapsedMin = Math.max(0, (nowMs - start) / 60_000);
  const amount = fee.unit === 'hour' ? (elapsedMin / 60) * fee.rate : elapsedMin * fee.rate;
  return Math.round(amount * 100) / 100;
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
  const codeCfg = await loadTableSessionCodeConfig(restaurantId);

  const ensureCode = async (sessionId: number, current: {
    accessCode: string | null;
    codeExpiresAt: Date | null;
    codeVerifiedAt: Date | null;
  }) => {
    if (!codeCfg.enabled) return null;
    // Kod doğrulanmışsa süresiz menü erişimi — yenileme/doğrulama sıfırlama yok
    if (current.codeVerifiedAt) return null;
    const needsNew =
      !current.accessCode ||
      !current.codeExpiresAt ||
      current.codeExpiresAt.getTime() <= Date.now();
    if (!needsNew) return null;
    const accessCode = await generateUniqueAccessCode(restaurantId);
    return prisma.tableFloorSession.update({
      where: { id: sessionId },
      data: {
        accessCode,
        codeExpiresAt: codeExpiryDate(codeCfg.ttlMinutes),
        codeVerifiedAt: null,
      },
    });
  };

  if (existing) {
    if (existing.status === 'reserved') {
      const opened = await prisma.tableFloorSession.update({
        where: { id: existing.id },
        data: { status: 'open', openedBy, openedAt: new Date() },
      });
      const withCode = await ensureCode(opened.id, opened);
      return withCode || opened;
    }
    const withCode = await ensureCode(existing.id, existing);
    return withCode || existing;
  }

  const accessCode = codeCfg.enabled ? await generateUniqueAccessCode(restaurantId) : null;
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
      accessCode,
      codeExpiresAt: accessCode ? codeExpiryDate(codeCfg.ttlMinutes) : null,
      codeVerifiedAt: null,
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
      accessCode: null,
      codeExpiresAt: null,
      codeVerifiedAt: null,
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
