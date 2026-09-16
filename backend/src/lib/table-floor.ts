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
  /** Bu kalem için ödeme alındı */
  settledAt?: string | null;
};

export type FloorPaymentMethod = 'cash' | 'card' | 'mixed';

export type FloorPayment = {
  id: string;
  amount: number;
  method: FloorPaymentMethod;
  itemIds: string[];
  /** Bu ödemeye dahil edilen oturma ücreti tutarı */
  seatingFee: number;
  createdAt: string;
  note?: string;
  tendered?: number;
  change?: number;
  tip?: number;
};

export type FloorCheckDiscount = {
  mode: 'fixed' | 'percent';
  value: number;
};

export type FloorSessionMeta = {
  pax?: number;
  serviceNote?: string;
  waiterUserId?: number | null;
  waiterName?: string | null;
  checkDiscount?: FloorCheckDiscount | null;
};

export const WAITER_ALERT_MS = 8_000;
export const ACTIVE_STATUSES = ['open', 'reserved'] as const;

export function parseSessionMeta(raw?: string | null): FloorSessionMeta {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const r = parsed as Record<string, unknown>;
    const pax = Math.round(Number(r.pax));
    const discountRaw =
      r.checkDiscount && typeof r.checkDiscount === 'object' && !Array.isArray(r.checkDiscount)
        ? (r.checkDiscount as Record<string, unknown>)
        : null;
    const discountValue = discountRaw ? Math.abs(Number(discountRaw.value) || 0) : 0;
    return {
      pax: Number.isFinite(pax) && pax > 0 ? Math.min(99, pax) : undefined,
      serviceNote: String(r.serviceNote || '').trim().slice(0, 1000) || undefined,
      waiterUserId:
        r.waiterUserId == null || r.waiterUserId === ''
          ? null
          : Number.isFinite(Number(r.waiterUserId))
            ? Number(r.waiterUserId)
            : null,
      waiterName: String(r.waiterName || '').trim().slice(0, 120) || null,
      checkDiscount:
        discountRaw && discountValue > 0
          ? {
              mode: discountRaw.mode === 'percent' ? 'percent' : 'fixed',
              value: discountValue,
            }
          : null,
    };
  } catch {
    return {};
  }
}

export function serializeSessionMeta(meta: FloorSessionMeta): string {
  return JSON.stringify({
    pax: meta.pax && meta.pax > 0 ? meta.pax : undefined,
    serviceNote: meta.serviceNote || undefined,
    waiterUserId: meta.waiterUserId ?? null,
    waiterName: meta.waiterName || null,
    checkDiscount: meta.checkDiscount?.value ? meta.checkDiscount : null,
  });
}

export function checkDiscountAmount(
  gross: number,
  discount?: FloorCheckDiscount | null
) {
  if (!discount || !discount.value || gross <= 0) return 0;
  const raw =
    discount.mode === 'percent' ? (gross * discount.value) / 100 : discount.value;
  return Math.min(gross, Math.max(0, Math.round(raw * 100) / 100));
}

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
          settledAt: row.settledAt ? String(row.settledAt) : null,
        };
      })
      .filter((r) => r.name);
  } catch {
    return [];
  }
}

export function parsePaymentsJson(raw?: string | null): FloorPayment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const methodRaw = String(row.method || 'cash');
        const method: FloorPaymentMethod =
          methodRaw === 'card' || methodRaw === 'mixed' ? methodRaw : 'cash';
        const itemIds = Array.isArray(row.itemIds)
          ? row.itemIds.map((x: unknown) => String(x)).filter(Boolean)
          : [];
        return {
          id: String(row.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
          amount: Math.round((Number(row.amount) || 0) * 100) / 100,
          method,
          itemIds,
          seatingFee: Math.max(0, Math.round((Number(row.seatingFee) || 0) * 100) / 100),
          createdAt: String(row.createdAt || new Date().toISOString()),
          note: String(row.note || '').trim().slice(0, 240) || undefined,
          tendered:
            row.tendered != null && Number.isFinite(Number(row.tendered))
              ? Math.round(Number(row.tendered) * 100) / 100
              : undefined,
          change:
            row.change != null && Number.isFinite(Number(row.change))
              ? Math.round(Number(row.change) * 100) / 100
              : undefined,
          tip:
            row.tip != null && Number.isFinite(Number(row.tip))
              ? Math.max(0, Math.round(Number(row.tip) * 100) / 100)
              : undefined,
        };
      })
      .filter((p) => p.amount > 0 || p.itemIds.length > 0 || p.seatingFee > 0);
  } catch {
    return [];
  }
}

export function unpaidOrders(items: FloorOrderItem[]) {
  return items.filter((i) => !i.settledAt);
}

export function paymentsTotal(payments: FloorPayment[]) {
  return Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
}

export function seatingFeePaidTotal(payments: FloorPayment[]) {
  return Math.round(payments.reduce((s, p) => s + (Number(p.seatingFee) || 0), 0) * 100) / 100;
}

export function remainingBalance(
  items: FloorOrderItem[],
  payments: FloorPayment[],
  liveSeatingFee: number,
  discount?: FloorCheckDiscount | null
) {
  const unpaid = ordersTotal(unpaidOrders(items));
  const seatLeft = Math.max(0, liveSeatingFee - seatingFeePaidTotal(payments));
  const gross = unpaid + seatLeft;
  const disc = checkDiscountAmount(gross, discount);
  return Math.round((gross - disc) * 100) / 100;
}

export function methodLabel(method: FloorPaymentMethod) {
  if (method === 'card') return 'Kart';
  if (method === 'mixed') return 'Karışık';
  return 'Nakit';
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
