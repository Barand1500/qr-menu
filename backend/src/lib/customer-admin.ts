import { prisma } from './prisma.js';
import { parsePointsJson } from './customer-auth.js';

export type CustomerDiscount = {
  type: 'percent' | 'amount';
  value: number;
  note: string;
  expiresAt: string | null;
};

export type CustomerDiscountsMap = Record<string, CustomerDiscount>;

export type PointsRewardKind = 'custom' | 'product' | 'group' | 'wallet';

export type PointsRewardRule = {
  id: string;
  kind: PointsRewardKind;
  title: string;
  pointsCost: number;
  description: string;
  active: boolean;
  sortOrder: number;
  productId: number | null;
  productName: string;
  groupId: number | null;
  groupName: string;
  discountPercent: number | null;
  amountValue: number | null;
};

export const POINTS_REWARDS_KEY = 'customer_points_rewards';

function asKind(raw: unknown): PointsRewardKind {
  if (raw === 'product' || raw === 'group' || raw === 'wallet' || raw === 'custom') return raw;
  return 'custom';
}

function asOptionalId(raw: unknown): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asOptionalAmount(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function asOptionalPercent(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function normalizePointsRewards(raw: unknown): PointsRewardRule[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { rules?: unknown }).rules)
      ? (raw as { rules: unknown[] }).rules
      : [];
  const out: PointsRewardRule[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const kind = asKind(row.kind);
    const pointsCost = Math.round(Number(row.pointsCost));
    if (!Number.isFinite(pointsCost) || pointsCost <= 0) return;

    const productId = kind === 'product' ? asOptionalId(row.productId) : null;
    const groupId = kind === 'group' ? asOptionalId(row.groupId) : null;
    const discountPercent = kind === 'group' ? asOptionalPercent(row.discountPercent) : null;
    const amountValue = kind === 'wallet' ? asOptionalAmount(row.amountValue) : null;
    const productName =
      kind === 'product' && typeof row.productName === 'string'
        ? row.productName.trim().slice(0, 120)
        : '';
    const groupName =
      kind === 'group' && typeof row.groupName === 'string'
        ? row.groupName.trim().slice(0, 120)
        : '';

    if (kind === 'product' && !productId) return;
    if (kind === 'group' && (!groupId || !discountPercent)) return;
    if (kind === 'wallet' && !amountValue) return;

    let title = typeof row.title === 'string' ? row.title.trim().slice(0, 80) : '';
    if (!title) {
      if (kind === 'product') title = productName ? `${productName} bedava` : 'Ürün bedava';
      else if (kind === 'group')
        title = groupName
          ? `${groupName} %${discountPercent} indirim`
          : `%${discountPercent} grup indirimi`;
      else if (kind === 'wallet') title = `${pointsCost} puan = ${amountValue}₺`;
      else return;
    }

    out.push({
      id:
        typeof row.id === 'string' && row.id.trim()
          ? row.id.trim()
          : `pr-${Date.now().toString(36)}-${i}`,
      kind,
      title,
      pointsCost,
      description:
        typeof row.description === 'string' ? row.description.trim().slice(0, 200) : '',
      active: row.active !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : i,
      productId,
      productName,
      groupId,
      groupName,
      discountPercent,
      amountValue,
    });
  });
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'tr'));
  out.forEach((r, i) => {
    r.sortOrder = i;
  });
  return out;
}

export function parseDiscountsJson(raw: unknown): CustomerDiscountsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CustomerDiscountsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const type: 'percent' | 'amount' =
      row.type === 'amount' ? 'amount' : row.percent != null && row.value == null ? 'percent' : row.type === 'percent' ? 'percent' : row.amount != null ? 'amount' : 'percent';
    const valueRaw =
      row.value != null
        ? Number(row.value)
        : type === 'amount'
          ? Number(row.amount)
          : Number(row.percent);
    if (!Number.isFinite(valueRaw) || valueRaw <= 0) continue;
    const value =
      type === 'percent'
        ? Math.min(100, Math.round(valueRaw * 100) / 100)
        : Math.round(valueRaw * 100) / 100;
    out[String(k)] = {
      type,
      value,
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
    if (!v || v.value <= 0) continue;
    out[k] = {
      type: v.type === 'amount' ? 'amount' : 'percent',
      value:
        v.type === 'amount'
          ? Math.round(Math.max(0, v.value) * 100) / 100
          : Math.min(100, Math.max(0, v.value)),
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
  if (!d || d.value <= 0) return null;
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

export async function loadPointsRewards(restaurantId: number): Promise<PointsRewardRule[]> {
  const row = await prisma.setting.findFirst({
    where: { restaurantId, key: POINTS_REWARDS_KEY },
  });
  if (!row?.value) return [];
  try {
    return normalizePointsRewards(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export async function savePointsRewards(restaurantId: number, rules: PointsRewardRule[]) {
  const normalized = normalizePointsRewards(rules);
  const value = JSON.stringify({ rules: normalized });
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: POINTS_REWARDS_KEY } },
    update: { value },
    create: { restaurantId, key: POINTS_REWARDS_KEY, value },
  });
  return normalized;
}
