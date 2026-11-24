import { summarizePresence } from '../lib/table-presence.js';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ACTIVE_STATUSES,
  findActiveSession,
  ordersTotal,
  parseOrdersJson,
  parsePaymentsJson,
  parseSeatingFee,
  remainingBalance,
  seatingFeeAmount,
  parseSessionMeta,
  tableCode,
} from '../lib/table-floor.js';
import { codeExpiryDate, generateUniqueAccessCode, loadTableSessionCodeConfig, resolveCodeGateStatus } from '../lib/table-session-code.js';
import {
  GARSON_KEY,
  assignCodeHandoff,
  activeClaim,
  buildBoard,
  logEvent,
  parseStore,
  releaseClaim,
  serializeStore,
  tableKeyValid,
  tryClaim,
  type GarsonStore,
  type GroupIn,
  type RequestIn,
  type SessionIn,
} from '../lib/garson-board.js';

const router = Router();
router.use(authRequired);

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function whoAmI(req: Parameters<typeof getRestaurantId>[0]) {
  const userId = req.user?.userId;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
  return user ? { id: user.id, name: (user.fullName || '').trim() || 'Garson' } : null;
}

/**
 * Kayıt, aynı anda iki garson dokunsa da kaybolmasın: değer değişmediyse yaz, değiştiyse yeniden oku.
 * (Satır kilidi yok; çakışmada birkaç kez denenir.)
 */
async function mutateStore<T>(restaurantId: number, fn: (store: GarsonStore) => { store: GarsonStore; result: T }): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.setting.findUnique({ where: { restaurantId_key: { restaurantId, key: GARSON_KEY } } });
    const { store, result } = fn(parseStore(row?.value));
    const value = serializeStore(store, Date.now());
    if (row) {
      const done = await prisma.setting.updateMany({ where: { id: row.id, value: row.value }, data: { value } });
      if (done.count) return result;
    } else {
      try {
        await prisma.setting.create({ data: { restaurantId, key: GARSON_KEY, value } });
        return result;
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
  }
  throw new Error('Kayıt şu an yoğun, lütfen tekrar deneyin.');
}

/** Pano: tüm masalar, açık çağrılar, kim nereye gidiyor, son uğramalar ve akış. */
router.get('/board', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const me = await whoAmI(req);
  if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
  const now = Date.now();

  const [groupRows, sessionRows, requestRows, storeRow, restaurant, codeConfig] = await Promise.all([
    prisma.qrTableGroup.findMany({ where: { restaurantId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.tableFloorSession.findMany({ where: { restaurantId, status: { in: [...ACTIVE_STATUSES] } } }),
    prisma.tableServiceRequest.findMany({
      where: { restaurantId, OR: [{ isRead: false }, { createdAt: { gte: new Date(now - SIX_HOURS) } }] },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.setting.findUnique({ where: { restaurantId_key: { restaurantId, key: GARSON_KEY } } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }),
    loadTableSessionCodeConfig(restaurantId),
  ]);

  const groups: GroupIn[] = groupRows.map((g) => {
    const styles = (g.tableStyles && typeof g.tableStyles === 'object' ? g.tableStyles : {}) as Record<string, { name?: string }>;
    return {
      slug: g.slug,
      name: g.name,
      tables: Array.from({ length: Math.max(1, g.tableCount) }, (_, i) => ({
        code: tableCode(i + 1, g.prefix || ''),
        name: styles[String(i + 1)]?.name?.trim() || `${g.name} ${i + 1}`,
      })),
    };
  });

  const sessions: SessionIn[] = sessionRows.map((s) => {
    const orders = parseOrdersJson(s.ordersJson);
    return {
      id: s.id,
      group: s.groupSlug || '',
      table: s.tableNumber,
      status: s.status,
      openedAt: s.openedAt.getTime(),
      openedBy: s.openedBy,
      guestName: s.guestName,
      codeStatus: codeConfig.enabled ? resolveCodeGateStatus(s) : 'empty',
      activity: summarizePresence(parseSessionMeta(s.metaJson).presence, now),
      accessCode: s.accessCode,
      codeExpiresAt: s.codeExpiresAt?.getTime() ?? null,
      codeVerifiedAt: codeConfig.enabled ? s.codeVerifiedAt?.getTime() ?? null : null,
      total: ordersTotal(orders),
      itemCount: orders.reduce((n, o) => n + (Number(o.qty) || 0), 0),
      waiterName: parseSessionMeta(s.metaJson).waiterName || null,
    };
  });

  const requests: RequestIn[] = requestRows.map((r) => ({
    id: r.id,
    type: r.type,
    group: r.groupSlug || '',
    table: r.tableNumber,
    note: r.note,
    orderJson: r.orderJson,
    isRead: r.isRead,
    at: r.createdAt.getTime(),
  }));

  const board = buildBoard({ groups, sessions, requests, store: parseStore(storeRow?.value), me, now, codeGateEnabled: codeConfig.enabled });
  res.json({ now, codeGateEnabled: codeConfig.enabled, restaurant: restaurant?.name || '', me, hasTables: groups.length > 0, ...board });
});

/** "Masaya uğradım" */
router.post('/visit', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    const me = await whoAmI(req);
    if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
    const at = tableKeyValid(req.body?.group, req.body?.table);
    if (!at) return res.status(400).json({ message: 'Geçersiz masa' });
    const now = Date.now();
    const [config, session] = await Promise.all([
      loadTableSessionCodeConfig(restaurantId),
      findActiveSession(restaurantId, at.n, at.g || null),
    ]);
    if (config.enabled && session && !session.codeVerifiedAt) {
      const assigned = await mutateStore(restaurantId, (store) => {
        const result = assignCodeHandoff(store, session.id, { u: me.id, w: me.name }, at, now);
        return { store: result.store, result };
      });
      if (!assigned.ok) {
        return res.status(409).json({ message: assigned.by.w + ' bu masaya kodu iletiyor.', code: 'CODE_ASSIGNED' });
      }
      // Keep a valid code stable. Compare-and-set avoids resetting a concurrent customer verification.
      if (resolveCodeGateStatus(session) !== 'pending') {
        const accessCode = await generateUniqueAccessCode(restaurantId);
        await prisma.tableFloorSession.updateMany({
          where: { id: session.id, restaurantId, status: { in: [...ACTIVE_STATUSES] }, accessCode: session.accessCode, codeVerifiedAt: null },
          data: { accessCode, codeExpiresAt: codeExpiryDate(config.ttlMinutes) },
        });
      }
    } else {
      await mutateStore(restaurantId, (store) => ({
        store: logEvent(store, { k: 'visit', g: at.g, n: at.n, u: me.id, w: me.name }, now),
        result: true,
      }));
    }
    res.json({ ok: true, at: now, name: me.name });
  } catch {
    res.status(500).json({ message: 'Ziyaret kaydedilemedi. Lütfen tekrar deneyin.' });
  }
});


/** Close exactly the displayed seating; never silently settle an outstanding bill. */
router.post('/close', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    const me = await whoAmI(req);
    const sessionId = Number(req.body?.sessionId);
    if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return res.status(400).json({ message: 'Geçersiz oturum' });
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.tableFloorSession.findFirst({ where: { id: sessionId, restaurantId, status: { in: [...ACTIVE_STATUSES] } } });
      if (!session) return { status: 409, message: 'Bu masa oturumu zaten kapanmış. Pano güncellendi.' };
      const meta = parseSessionMeta(session.metaJson);
      const group = session.groupSlug ? await tx.qrTableGroup.findFirst({ where: { restaurantId, slug: session.groupSlug } }) : null;
      let seatFee = 0;
      if (group) {
        const styles = (group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}) as Record<string, { seatingFee?: unknown }>;
        for (let n = 1; n <= group.tableCount; n++) {
          if (tableCode(n, group.prefix || '') === session.tableNumber) {
            seatFee = seatingFeeAmount(parseSeatingFee(styles[String(n)]?.seatingFee), session.openedAt, session.status);
            break;
          }
        }
      }
      const remaining = remainingBalance(parseOrdersJson(session.ordersJson), parsePaymentsJson(session.paymentsJson), seatFee, meta.checkDiscount);
      if (remaining > 0.009) return { status: 409, message: 'Masada açık hesap var. Önce masa yönetiminden ödemeyi tamamlayın.' };
      const closedAt = new Date();
      const changed = await tx.tableFloorSession.updateMany({
        where: { id: session.id, restaurantId, status: { in: [...ACTIVE_STATUSES] }, ordersJson: session.ordersJson, paymentsJson: session.paymentsJson, metaJson: session.metaJson },
        data: { status: 'closed', closedAt, accessCode: null, codeExpiresAt: null, codeVerifiedAt: null },
      });
      if (!changed.count) return { status: 409, message: 'Masa bilgileri değişti. Kontrol edip tekrar deneyin.' };
      await tx.tableServiceRequest.updateMany({ where: { restaurantId, groupSlug: session.groupSlug, tableNumber: session.tableNumber, isRead: false, createdAt: { lte: closedAt } }, data: { isRead: true } });
      return { status: 200, message: 'Masa kapatıldı' };
    });
    return res.status(result.status).json({ ok: result.status === 200, message: result.message });
  } catch {
    return res.status(500).json({ message: 'Masa kapatılamadı. Lütfen tekrar deneyin.' });
  }
});

async function loadRequest(restaurantId: number, id: unknown) {
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) return null;
  return prisma.tableServiceRequest.findFirst({ where: { id: requestId, restaurantId } });
}

/** "Ben gidiyorum": başka garson gidiyorsa 409 ile kimin gittiğini söyler. */
router.post('/claim', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const me = await whoAmI(req);
  if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
  const request = await loadRequest(restaurantId, req.body?.requestId);
  if (!request) return res.status(404).json({ message: 'Çağrı bulunamadı' });
  if (request.isRead) return res.status(409).json({ message: 'Bu çağrı zaten halledilmiş.', code: 'DONE' });
  const now = Date.now();
  const force = req.body?.force === true;
  const out = await mutateStore(restaurantId, (store) => {
    const r = tryClaim(store, request.id, { u: me.id, w: me.name }, { g: request.groupSlug || '', n: request.tableNumber }, now, force);
    return { store: r.store, result: r };
  });
  if (!out.ok) {
    return res.status(409).json({ message: `${out.by?.w || 'Başka bir garson'} zaten gidiyor.`, code: 'CLAIMED', by: out.by?.w || '' });
  }
  res.json({ ok: true });
});

router.post('/unclaim', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const me = await whoAmI(req);
  if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
  const request = await loadRequest(restaurantId, req.body?.requestId);
  if (!request) return res.status(404).json({ message: 'Çağrı bulunamadı' });
  const now = Date.now();
  await mutateStore(restaurantId, (store) => {
    const c = activeClaim(store, request.id, now);
    // Yalnızca kendi işaretini kaldırabilir
    if (!c || c.u !== me.id) return { store, result: false };
    return { store: releaseClaim(store, request.id, { u: me.id, w: me.name }, { g: request.groupSlug || '', n: request.tableNumber }, now, false), result: true };
  });
  res.json({ ok: true });
});

/** "Hallettim": çağrı kapanır (okundu), işaret kalkar, masaya uğranmış sayılır. */
router.post('/resolve', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const me = await whoAmI(req);
  if (restaurantId == null || !me) return res.status(401).json({ message: 'Yetkisiz' });
  const request = await loadRequest(restaurantId, req.body?.requestId);
  if (!request) return res.status(404).json({ message: 'Çağrı bulunamadı' });
  const now = Date.now();
  if (!request.isRead) {
    await prisma.tableServiceRequest.update({ where: { id: request.id }, data: { isRead: true } });
    await mutateStore(restaurantId, (store) => ({
      store: releaseClaim(store, request.id, { u: me.id, w: me.name }, { g: request.groupSlug || '', n: request.tableNumber }, now, true),
      result: true,
    }));
  }
  res.json({ ok: true });
});

export default router;
