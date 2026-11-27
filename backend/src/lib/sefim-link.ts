/**
 * Vega Şefim bağlantısı: eşleştirme kodu, köprü anahtarı, Şefim görüntüsünü saklama ve planı menüye uygulama.
 * Saf eşitleme kuralları sefim-sync.ts içindedir.
 */
import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { getByLang } from './i18n-json.js';
import { ensureDefaultCurrency } from './currencies.js';
import { normalizeOptionGroups } from './product-options.js';
import {
  isSystemGroup,
  normalizeSettings,
  tidyName,
  parseSnapshot,
  planSync,
  snapshotKey,
  type LocalGroup,
  type LocalProduct,
  type MapRow,
  type Plan,
  type PlanSummary,
  type SefimSettings,
  type Snapshot,
} from './sefim-sync.js';

export const PUSH_INTERVAL_SEC = 60;
const PAIR_TTL_MS = 15 * 60_000;
const ONLINE_MS = 3 * PUSH_INTERVAL_SEC * 1000;
const HISTORY_MAX = 20;
/** Çırak kapanırken "bye" gönderir; bu not varken panel onu çevrimdışı gösterir (şema değişikliği gerektirmez). */
export const CLOSED_NOTE = 'Çırak bu bilgisayarda kapatıldı.';
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const cleanCode = (s: unknown) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);

export type HistoryEntry = { at: string; ok: boolean; auto: boolean; summary?: PlanSummary; error?: string; warnings?: string[] };

type LinkRow = NonNullable<Awaited<ReturnType<typeof prisma.sefimLink.findUnique>>>;

export async function getLink(restaurantId: number): Promise<LinkRow> {
  const row = await prisma.sefimLink.findUnique({ where: { restaurantId } });
  if (row) return row;
  return prisma.sefimLink.create({ data: { restaurantId, settings: normalizeSettings({}) as unknown as Prisma.InputJsonValue, history: [] } });
}

export function readSnapshot(link: Pick<LinkRow, 'snapshot'>): Snapshot | null {
  if (!link.snapshot) return null;
  try {
    return parseSnapshot(JSON.parse(link.snapshot));
  } catch {
    return null;
  }
}

/** Panelde gösterilen, 15 dk geçerli, tek kullanımlık kod (ör. "K7PQ-4XMB"). */
export async function createPairCode(restaurantId: number): Promise<{ code: string; expiresAt: string }> {
  await getLink(restaurantId);
  const bytes = crypto.randomBytes(8);
  const raw = Array.from(bytes, (b) => CODE_ABC[b % CODE_ABC.length]).join('');
  const expiresAt = new Date(Date.now() + PAIR_TTL_MS);
  await prisma.sefimLink.update({ where: { restaurantId }, data: { pairHash: sha(raw), pairExpiresAt: expiresAt } });
  return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt: expiresAt.toISOString() };
}

/** Çırak kodu girince kalıcı anahtar verilir; kod bir daha kullanılamaz. */
export async function pairWithCode(code: unknown, device: unknown) {
  const raw = cleanCode(code);
  if (raw.length !== 8) return null;
  const link = await prisma.sefimLink.findUnique({ where: { pairHash: sha(raw) }, include: { restaurant: { select: { name: true } } } });
  if (!link || !link.pairExpiresAt || link.pairExpiresAt.getTime() < Date.now()) return null;
  const token = `crk_${crypto.randomBytes(32).toString('base64url')}`;
  const done = await prisma.sefimLink.updateMany({
    where: { restaurantId: link.restaurantId, pairHash: sha(raw) },
    data: { tokenHash: sha(token), pairHash: null, pairExpiresAt: null, device: String(device ?? '').slice(0, 160) || null, lastSeenAt: new Date() },
  });
  if (!done.count) return null;
  await addHistory(link.restaurantId, { at: new Date().toISOString(), ok: true, auto: true, error: undefined, warnings: [`Çırak bağlandı${device ? ` (${String(device).slice(0, 60)})` : ''}`] });
  return { token, restaurantId: link.restaurantId, restaurantName: link.restaurant.name };
}

export async function linkFromToken(header: unknown) {
  const m = /^Bearer\s+(crk_[A-Za-z0-9_-]{20,80})$/.exec(String(header ?? ''));
  if (!m) return null;
  return prisma.sefimLink.findUnique({ where: { tokenHash: sha(m[1]) } });
}

export async function unlink(restaurantId: number) {
  await prisma.sefimLink.updateMany({ where: { restaurantId }, data: { tokenHash: null, pairHash: null, pairExpiresAt: null, device: null } });
}

async function addHistory(restaurantId: number, entry: HistoryEntry) {
  const row = await prisma.sefimLink.findUnique({ where: { restaurantId }, select: { history: true } });
  const list = Array.isArray(row?.history) ? (row!.history as unknown as HistoryEntry[]) : [];
  await prisma.sefimLink.update({ where: { restaurantId }, data: { history: [entry, ...list].slice(0, HISTORY_MAX) as unknown as Prisma.InputJsonValue } });
}

// ───────────── Menünün mevcut hali ─────────────
async function loadLocal(restaurantId: number): Promise<{ groups: LocalGroup[]; products: LocalProduct[]; maps: MapRow[] }> {
  const [groups, products, maps] = await Promise.all([
    prisma.group.findMany({ where: { restaurantId }, select: { id: true, i18n: true } }),
    prisma.product.findMany({ where: { restaurantId }, select: { id: true, groupId: true, i18n: true, price: true, isActive: true, optionGroups: true } }),
    prisma.sefimMap.findMany({ where: { restaurantId } }),
  ]);
  return {
    groups: groups.map((g) => ({ id: g.id, name: getByLang(g.i18n, 'tr', 'name') })),
    products: products.map((p) => ({
      id: p.id,
      groupId: p.groupId,
      name: getByLang(p.i18n, 'tr', 'name'),
      price: Number(p.price),
      isActive: p.isActive,
      optionGroups: normalizeOptionGroups(p.optionGroups),
    })),
    maps: maps.map((m) => ({ kind: m.kind === 'group' ? 'group' : 'product', sefimKey: m.sefimKey, localId: m.localId, sefimGroup: m.sefimGroup, hiddenBySync: m.hiddenBySync })),
  };
}

export async function planFor(restaurantId: number, link: LinkRow): Promise<{ plan: Plan; snapshot: Snapshot } | null> {
  const snapshot = readSnapshot(link);
  if (!snapshot) return null;
  const local = await loadLocal(restaurantId);
  return { plan: planSync({ snapshot, settings: normalizeSettings(link.settings), ...local }), snapshot };
}

const appliedKeyOf = (link: Pick<LinkRow, 'snapshotHash' | 'settingsVer'>) => `${link.snapshotHash ?? ''}:${link.settingsVer}`;

// Aynı restoran için aynı anda iki uygulama olmasın
const locks = new Map<number, Promise<unknown>>();
function serial<T>(restaurantId: number, job: () => Promise<T>): Promise<T> {
  const prev = locks.get(restaurantId) || Promise.resolve();
  const next = prev.catch(() => undefined).then(job);
  locks.set(restaurantId, next);
  void next.finally(() => locks.get(restaurantId) === next && locks.delete(restaurantId)).catch(() => undefined);
  return next;
}

/** Planı menüye yazar. Şefim'e hiçbir şey yazılmaz. */
export function applyNow(restaurantId: number, auto: boolean): Promise<{ summary: PlanSummary; warnings: string[] } | null> {
  return serial(restaurantId, async () => {
    const link = await getLink(restaurantId);
    const planned = await planFor(restaurantId, link);
    if (!planned) return null;
    const { plan } = planned;
    try {
      await writePlan(restaurantId, plan);
      await prisma.sefimLink.update({ where: { restaurantId }, data: { appliedKey: appliedKeyOf(link), lastApplyAt: new Date() } });
      const changed = plan.ops.length > 0 || plan.warnings.length > 0;
      if (changed || !auto) await addHistory(restaurantId, { at: new Date().toISOString(), ok: true, auto, summary: plan.summary, warnings: plan.warnings.slice(0, 5) });
      return { summary: plan.summary, warnings: plan.warnings };
    } catch (e) {
      console.error('[sefim] uygulama hatası', e);
      await addHistory(restaurantId, { at: new Date().toISOString(), ok: false, auto, error: 'Menü güncellenirken bir hata oldu; hiçbir değişiklik yarım kalmadı.' });
      throw e;
    }
  });
}

async function writePlan(restaurantId: number, plan: Plan) {
  const currency = await ensureDefaultCurrency();
  await prisma.$transaction(
    async (tx) => {
      const groupIds = new Map<string, number>();
      const upsertMap = (kind: 'product' | 'group', sefimKey: string, localId: number, extra: { sefimGroup?: string | null; hiddenBySync?: boolean } = {}) =>
        tx.sefimMap.upsert({
          where: { restaurantId_kind_sefimKey: { restaurantId, kind, sefimKey } },
          create: { restaurantId, kind, sefimKey, localId, sefimGroup: extra.sefimGroup ?? null, hiddenBySync: extra.hiddenBySync ?? false },
          update: { localId, ...extra },
        });
      for (const m of await tx.sefimMap.findMany({ where: { restaurantId, kind: 'group' } })) groupIds.set(m.sefimKey, m.localId);

      let groupOrder = (await tx.group.aggregate({ where: { restaurantId, parentId: null }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
      for (const op of plan.ops) {
        if (op.k === 'group') {
          const g = await tx.group.create({ data: { restaurantId, parentId: null, sortOrder: ++groupOrder, isActive: true, i18n: { tr: { name: op.name } } } });
          groupIds.set(op.key, g.id);
          await upsertMap('group', op.key, g.id);
        } else if (op.k === 'linkGroup') {
          groupIds.set(op.key, op.localId);
          await upsertMap('group', op.key, op.localId);
        }
      }

      const nextOrder = new Map<number, number>();
      const orderIn = async (groupId: number) => {
        if (!nextOrder.has(groupId)) nextOrder.set(groupId, (await tx.product.aggregate({ where: { groupId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0);
        const n = nextOrder.get(groupId)! + 1;
        nextOrder.set(groupId, n);
        return n;
      };
      const i18nWithName = async (id: number, name: string) => {
        const row = await tx.product.findUnique({ where: { id }, select: { i18n: true } });
        const map = row?.i18n && typeof row.i18n === 'object' && !Array.isArray(row.i18n) ? (row.i18n as Record<string, Record<string, unknown>>) : {};
        return { ...map, tr: { ...(map.tr || {}), name } } as Prisma.InputJsonValue;
      };

      for (const op of plan.ops) {
        if (op.k === 'create') {
          const groupId = groupIds.get(op.groupKey);
          if (!groupId) continue;
          const p = await tx.product.create({
            data: {
              restaurantId,
              groupId,
              currencyId: currency.id,
              price: op.price,
              sortOrder: await orderIn(groupId),
              isActive: op.active,
              i18n: { tr: { name: op.name } },
              optionGroups: op.optionGroups as unknown as Prisma.InputJsonValue,
            },
          });
          await upsertMap('product', String(op.sid), p.id, { sefimGroup: op.sefimGroup, hiddenBySync: false });
        } else if (op.k === 'link') {
          await upsertMap('product', String(op.sid), op.localId, { sefimGroup: op.sefimGroup, hiddenBySync: false });
        } else if (op.k === 'update') {
          const data: Prisma.ProductUpdateInput = {};
          if (op.set.price !== undefined) data.price = op.set.price;
          if (op.set.optionGroups) data.optionGroups = op.set.optionGroups as unknown as Prisma.InputJsonValue;
          if (op.set.name !== undefined) data.i18n = await i18nWithName(op.localId, op.set.name);
          if (op.set.groupKey !== undefined) {
            const gid = groupIds.get(op.set.groupKey);
            if (gid) data.group = { connect: { id: gid } };
          }
          await tx.product.update({ where: { id: op.localId }, data });
        } else if (op.k === 'hide' || op.k === 'show') {
          await tx.product.update({ where: { id: op.localId }, data: { isActive: op.k === 'show' } });
          await tx.sefimMap.updateMany({ where: { restaurantId, kind: 'product', sefimKey: String(op.sid) }, data: { hiddenBySync: op.k === 'hide' } });
        }
      }
      for (const r of plan.regroup) await tx.sefimMap.updateMany({ where: { restaurantId, kind: 'product', sefimKey: String(r.sid) }, data: { sefimGroup: r.group } });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
}

/** Çırak'tan gelen görüntü ya da "değişmedi" sinyali. */
export async function receivePush(link: LinkRow, body: unknown) {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const now = new Date();
  const settings = normalizeSettings(link.settings);
  let hash = link.snapshotHash;
  const config = { groups: settings.groups, settingsVer: link.settingsVer, intervalSec: PUSH_INTERVAL_SEC, paused: !settings.enabled };
  const version = typeof b.version === 'string' ? b.version.slice(0, 40) : link.bridgeVersion;
  if (b.bye === true) {
    await prisma.sefimLink.update({ where: { restaurantId: link.restaurantId }, data: { bridgeNote: CLOSED_NOTE, bridgeVersion: version } });
    return { ok: true, hash, applied: null, config };
  }
  if (typeof b.problem === 'string' && b.problem.trim()) {
    // Çırak çalışıyor ama Şefim'i okuyamadı: menüye dokunma, panele söyle
    await prisma.sefimLink.update({ where: { restaurantId: link.restaurantId }, data: { lastSeenAt: now, bridgeNote: b.problem.trim().slice(0, 300), bridgeVersion: version } });
    return { ok: true, hash, applied: null, config };
  }
  if (b.unchanged === true) {
    // Özet tutmuyorsa (sunucu görüntüyü kaybetmiş olabilir) tam görüntü iste; asla boş görüntü kaydetme
    if (typeof b.hash !== 'string' || b.hash !== link.snapshotHash) return { ok: true, resend: true, hash, applied: null, config };
    await prisma.sefimLink.update({ where: { restaurantId: link.restaurantId }, data: { lastSeenAt: now, bridgeNote: null, bridgeVersion: version } });
  } else {
    if (!b.snapshot || typeof b.snapshot !== 'object') return { ok: false, resend: true, hash, applied: null, config };
    const snapshot = parseSnapshot(b.snapshot);
    hash = sha(snapshotKey(snapshot));
    await prisma.sefimLink.update({
      where: { restaurantId: link.restaurantId },
      data: {
        lastSeenAt: now,
        bridgeNote: null,
        bridgeVersion: version,
        ...(hash !== link.snapshotHash ? { snapshot: JSON.stringify(snapshot), snapshotHash: hash, snapshotAt: now } : {}),
      },
    });
  }
  let applied: { summary: PlanSummary; warnings: string[] } | null = null;
  let error = '';
  if (settings.enabled && settings.autoApply && `${hash ?? ''}:${link.settingsVer}` !== link.appliedKey) {
    try {
      applied = await applyNow(link.restaurantId, true);
    } catch {
      error = 'Menü güncellenemedi; bir sonraki denemede tekrar denenecek.';
    }
  }
  return {
    ok: true,
    hash,
    applied: applied?.summary ?? null,
    error: error || undefined,
    config,
  };
}

/** Panelin göreceği durum: bağlantı, ayarlar, Şefim grupları, önizleme özeti, geçmiş. */
export async function adminState(restaurantId: number) {
  const link = await getLink(restaurantId);
  const settings = normalizeSettings(link.settings);
  const snapshot = readSnapshot(link);
  const planned = snapshot ? await planFor(restaurantId, link) : null;
  const wanted = new Set(settings.groups ?? (snapshot?.groups || []).filter((g) => !isSystemGroup(g.name)).map((g) => g.name));
  return {
    linked: Boolean(link.tokenHash),
    device: link.device,
    bridgeNote: link.bridgeNote === CLOSED_NOTE ? null : link.bridgeNote,
    closed: Boolean(link.tokenHash && link.bridgeNote === CLOSED_NOTE),
    bridgeVersion: link.bridgeVersion,
    online: Boolean(link.tokenHash && link.bridgeNote !== CLOSED_NOTE && link.lastSeenAt && Date.now() - link.lastSeenAt.getTime() < ONLINE_MS),
    lastSeenAt: link.lastSeenAt,
    snapshotAt: link.snapshotAt,
    lastApplyAt: link.lastApplyAt,
    settings,
    groups: (snapshot?.groups || []).map((g) => ({ ...g, label: settings.tidyNames && !isSystemGroup(g.name) ? tidyName(g.name) : g.name, system: isSystemGroup(g.name), on: wanted.has(g.name) })),
    templates: snapshot?.templates || [],
    /** Görüntü seçili grupların hepsini içeriyor mu (grup seçimi yeni değiştiyse Çırak'ın bir sonraki gönderimi beklenir) */
    waitingGroups: snapshot ? [...wanted].filter((g) => !(snapshot.scope ?? snapshot.groups.filter((x) => !isSystemGroup(x.name)).map((x) => x.name)).includes(g)) : [],
    preview: planned ? { summary: planned.plan.summary, warnings: planned.plan.warnings, pending: settings.enabled && appliedKeyOf(link) !== link.appliedKey && planned.plan.ops.length > 0 } : null,
    history: Array.isArray(link.history) ? (link.history as unknown as HistoryEntry[]) : [],
  };
}

export async function saveSettings(restaurantId: number, raw: unknown): Promise<SefimSettings> {
  const link = await getLink(restaurantId);
  const next = normalizeSettings(raw);
  const prev = normalizeSettings(link.settings);
  if (JSON.stringify(prev) === JSON.stringify(next)) return next;
  await prisma.sefimLink.update({ where: { restaurantId }, data: { settings: next as unknown as Prisma.InputJsonValue, settingsVer: { increment: 1 } } });
  return next;
}

/** Önizleme listesi (panelde ayrıntı): en çok 400 satır. */
export async function previewOps(restaurantId: number) {
  const link = await getLink(restaurantId);
  const planned = await planFor(restaurantId, link);
  if (!planned) return { ops: [], summary: null, warnings: [] };
  const tidy = normalizeSettings(link.settings).tidyNames;
  const ops = planned.plan.ops
    .filter((o) => o.k !== 'linkGroup')
    .slice(0, 400)
    .map((o) => {
      switch (o.k) {
        case 'group':
          return { k: o.k, name: o.name };
        case 'create':
          return { k: o.k, name: o.name, price: o.price, group: tidy && !isSystemGroup(o.groupKey) ? tidyName(o.groupKey) : o.groupKey, options: o.optionGroups.length, hidden: !o.active };
        case 'link':
          return { k: o.k, name: o.name };
        case 'update':
          return {
            k: o.k,
            name: o.name,
            price: o.set.price,
            oldPrice: o.from.price,
            newName: o.set.name,
            group: o.to.group,
            oldGroup: o.from.group,
            options: o.set.optionGroups ? true : undefined,
          };
        default:
          return { k: o.k, name: o.name };
      }
    });
  return { ops, summary: planned.plan.summary, warnings: planned.plan.warnings };
}
