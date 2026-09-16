import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ACTIVE_STATUSES,
  appendOrdersToSession,
  checkDiscountAmount,
  closeSession,
  findActiveSession,
  lineTotal,
  methodLabel,
  openOrGetSession,
  ordersTotal,
  parseMergedJson,
  parseOrdersJson,
  parsePaymentsJson,
  parseSeatingFee,
  parseSessionMeta,
  paymentsTotal,
  remainingBalance,
  seatingFeeAmount,
  seatingFeePaidTotal,
  serializeSessionMeta,
  tableCode,
  unpaidOrders,
  WAITER_ALERT_MS,
  type FloorOrderItem,
  type FloorPayment,
  type FloorPaymentMethod,
  type FloorSessionMeta,
  type SeatingFeeConfig,
} from '../lib/table-floor.js';
import { getProductField, getLanguages, getGroupName } from '../lib/i18n-json.js';
import {
  activeOptionGroups,
  computeUnitPrice,
  formatSelectionsNote,
  validateSelections,
  type OptionSelectionInput,
} from '../lib/product-options.js';
import type { Prisma } from '@prisma/client';
import { consumeStockForItems, restoreStockForItems } from '../lib/product-stock.js';
import {
  codeExpiryDate,
  generateUniqueAccessCode,
  isCodeExpired,
  loadTableSessionCodeConfig,
  resolveCodeGateStatus,
} from '../lib/table-session-code.js';

const router = Router();
router.use(authRequired);

/** Ana ekran zili — kod bekleyen masalar (PIN dönmez) */
router.get('/pending-codes', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const cfg = await loadTableSessionCodeConfig(restaurantId);
  if (!cfg.enabled) {
    return res.json({ enabled: false, items: [] as unknown[] });
  }

  const sessions = await prisma.tableFloorSession.findMany({
    where: {
      restaurantId,
      status: { in: [...ACTIVE_STATUSES] },
      accessCode: { not: null },
      codeVerifiedAt: null,
    },
    select: {
      tableNumber: true,
      groupSlug: true,
      openedAt: true,
      codeExpiresAt: true,
    },
    orderBy: { openedAt: 'desc' },
    take: 40,
  });

  const items = sessions
    .filter((s) => !isCodeExpired(s.codeExpiresAt))
    .map((s) => ({
      tableNumber: s.tableNumber,
      groupSlug: s.groupSlug,
      openedAt: s.openedAt.toISOString(),
      expiresAt: s.codeExpiresAt?.toISOString() || null,
    }));

  res.json({ enabled: true, items });
});

type TableStylePayload = {
  name?: string;
  colorId?: string;
  withLogo?: boolean;
  frameId?: string;
  seatingFee?: SeatingFeeConfig;
};

async function ensureDefaultGroups(restaurantId: number) {
  const count = await prisma.qrTableGroup.count({ where: { restaurantId } });
  if (count > 0) return;
  await prisma.qrTableGroup.createMany({
    data: [
      {
        restaurantId,
        name: 'Salon',
        slug: 'salon',
        tableCount: 12,
        sortOrder: 0,
        tableStyles: {},
      },
      {
        restaurantId,
        name: 'Teras',
        slug: 'teras',
        tableCount: 8,
        sortOrder: 1,
        tableStyles: {},
      },
    ],
  });
}

function serializeSession(session: {
  id: number;
  tableNumber: string;
  groupSlug: string | null;
  status: string;
  openedAt: Date;
  openedBy: string;
  guestName: string | null;
  expectedAt: Date | null;
  reservationNote: string | null;
  paidAt: Date | null;
  ordersJson: string | null;
  paymentsJson?: string | null;
  mergedJson: string | null;
  metaJson?: string | null;
  accessCode?: string | null;
  codeExpiresAt?: Date | null;
  codeVerifiedAt?: Date | null;
}) {
  const orders = parseOrdersJson(session.ordersJson);
  const payments = parsePaymentsJson(session.paymentsJson);
  const merged = parseMergedJson(session.mergedJson);
  const meta = parseSessionMeta(session.metaJson);
  const codeStatus = resolveCodeGateStatus(session);
  const paidTotal = paymentsTotal(payments);
  return {
    sessionId: session.id,
    status: session.status,
    occupied: session.status === 'open' || session.status === 'reserved',
    openedAt: session.openedAt.toISOString(),
    openedBy: session.openedBy,
    guestName: session.guestName,
    expectedAt: session.expectedAt?.toISOString() || null,
    reservationNote: session.reservationNote,
    paidAt: session.paidAt?.toISOString() || null,
    orders,
    payments,
    paidTotal,
    remaining: remainingBalance(orders, payments, 0, meta.checkDiscount),
    total: ordersTotal(orders),
    mergedTables: merged,
    meta,
    accessCode: session.accessCode || null,
    codeExpiresAt: session.codeExpiresAt?.toISOString() || null,
    codeVerifiedAt: session.codeVerifiedAt?.toISOString() || null,
    codeStatus,
  };
}

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  await ensureDefaultGroups(restaurantId!);

  const [groups, sessions, recentWaiters, restaurant] = await Promise.all([
    prisma.qrTableGroup.findMany({
      where: { restaurantId: restaurantId! },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.tableFloorSession.findMany({
      where: { restaurantId: restaurantId!, status: { in: [...ACTIVE_STATUSES] } },
    }),
    prisma.tableServiceRequest.findMany({
      where: {
        restaurantId: restaurantId!,
        type: 'waiter',
        createdAt: { gte: new Date(Date.now() - WAITER_ALERT_MS) },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.restaurant.findUnique({
      where: { id: restaurantId! },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const sessionMap = new Map(sessions.map((s) => [`${s.groupSlug || ''}::${s.tableNumber}`, s]));
  const mergedOwner = new Map<string, (typeof sessions)[0]>();
  for (const s of sessions) {
    for (const code of parseMergedJson(s.mergedJson)) {
      mergedOwner.set(`${s.groupSlug || ''}::${code}`, s);
    }
  }

  const waiterMap = new Map<string, Date>();
  for (const w of recentWaiters) {
    const key = `${w.groupSlug || ''}::${w.tableNumber}`;
    if (!waiterMap.has(key)) waiterMap.set(key, w.createdAt);
  }

  res.json({
    restaurant,
    polledAt: new Date().toISOString(),
    groups: groups.map((g) => {
      const styles = (
        g.tableStyles && typeof g.tableStyles === 'object' ? g.tableStyles : {}
      ) as Record<string, TableStylePayload>;
      const tables = Array.from({ length: Math.max(1, g.tableCount) }, (_, i) => {
        const n = i + 1;
        const code = tableCode(n, g.prefix || '');
        const style = styles[String(n)] || {};
        const key = `${g.slug}::${code}`;
        const own = sessionMap.get(key);
        const linked = !own ? mergedOwner.get(key) : null;
        const session = own || linked || null;
        const isSatellite = Boolean(linked && !own);
        const orders = own ? parseOrdersJson(own.ordersJson) : [];
        const payments = own ? parsePaymentsJson(own.paymentsJson) : [];
        const seatingFee = parseSeatingFee(style.seatingFee);
        const feeAmount =
          own?.status === 'open'
            ? seatingFeeAmount(seatingFee, own.openedAt, own.status)
            : 0;
        const waiterAt = waiterMap.get(key);
        const alertMsLeft = waiterAt
          ? Math.max(0, WAITER_ALERT_MS - (Date.now() - waiterAt.getTime()))
          : 0;
        const codeStatus = resolveCodeGateStatus(own || null);
        const paidTotal = paymentsTotal(payments);
        const meta = parseSessionMeta(own?.metaJson);
        const remaining = remainingBalance(orders, payments, feeAmount, meta.checkDiscount);

        return {
          index: n,
          code,
          name: style.name?.trim() || `${g.name} ${n}`,
          colorId: style.colorId || 'black',
          occupied: Boolean(session),
          status: own?.status || (isSatellite ? 'merged' : 'empty'),
          openedAt: own?.openedAt?.toISOString() || null,
          openedBy: own?.openedBy || null,
          sessionId: own?.id || null,
          guestName: own?.guestName || null,
          expectedAt: own?.expectedAt?.toISOString() || null,
          reservationNote: own?.reservationNote || null,
          paidAt: own?.paidAt?.toISOString() || null,
          orders,
          payments,
          paidTotal,
          remaining,
          seatingFee,
          seatingFeeAmount: feeAmount,
          seatingFeePaid: seatingFeePaidTotal(payments),
          total: ordersTotal(orders) + feeAmount,
          mergedTables: own ? parseMergedJson(own.mergedJson) : [],
          mergePrimary: isSatellite && linked ? linked.tableNumber : null,
          waiterAlertMs: alertMsLeft,
          meta,
          accessCode: own?.accessCode || null,
          codeExpiresAt: own?.codeExpiresAt?.toISOString() || null,
          codeVerifiedAt: own?.codeVerifiedAt?.toISOString() || null,
          codeStatus,
        };
      });
      return {
        id: g.slug,
        name: g.name,
        prefix: g.prefix || '',
        count: g.tableCount,
        tables,
      };
    }),
  });
});

router.post('/open', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
  };
  const masa = String(tableNumber || '').trim();
  if (!masa) return res.status(400).json({ message: 'Masa gerekli' });

  const session = await openOrGetSession(
    restaurantId!,
    masa,
    groupSlug ? String(groupSlug).trim() : null,
    'admin'
  );
  res.json({ ok: true, session: serializeSession(session) });
});

router.post('/regenerate-code', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    const { tableNumber, groupSlug, sessionId } = req.body as {
      tableNumber?: string;
      groupSlug?: string;
      sessionId?: number | string | null;
    };

    const codeCfg = await loadTableSessionCodeConfig(restaurantId!);
    const sid = sessionId != null && sessionId !== '' ? Number(sessionId) : NaN;

    let session =
      Number.isFinite(sid) && sid > 0
        ? await prisma.tableFloorSession.findFirst({
            where: {
              id: sid,
              restaurantId: restaurantId!,
              status: { in: [...ACTIVE_STATUSES] },
            },
          })
        : null;

    if (!session) {
      const masa = String(tableNumber || '').trim();
      if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
      session = await findActiveSession(
        restaurantId!,
        masa,
        groupSlug ? String(groupSlug).trim() : null
      );
    }

    if (!session) {
      const masa = String(tableNumber || '').trim();
      if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
      session = await openOrGetSession(
        restaurantId!,
        masa,
        groupSlug ? String(groupSlug).trim() : null,
        'admin'
      );
    }

    const accessCode = await generateUniqueAccessCode(restaurantId!);
    const updated = await prisma.tableFloorSession.update({
      where: { id: session.id },
      data: {
        accessCode,
        codeExpiresAt: codeExpiryDate(codeCfg.ttlMinutes),
        codeVerifiedAt: null,
      },
    });

    res.json({ ok: true, session: serializeSession(updated) });
  } catch (err) {
    console.error('regenerate-code', err);
    res.status(500).json({ message: 'Kod üretilemedi' });
  }
});

/** Admin, müşteri yerine kodu onaylar (masa yanında tik) */
router.post('/approve-code', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    const { tableNumber, groupSlug, sessionId } = req.body as {
      tableNumber?: string;
      groupSlug?: string;
      sessionId?: number | string | null;
    };

    const sid = sessionId != null && sessionId !== '' ? Number(sessionId) : NaN;
    let session =
      Number.isFinite(sid) && sid > 0
        ? await prisma.tableFloorSession.findFirst({
            where: {
              id: sid,
              restaurantId: restaurantId!,
              status: { in: [...ACTIVE_STATUSES] },
            },
          })
        : null;

    if (!session) {
      const masa = String(tableNumber || '').trim();
      if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
      session = await findActiveSession(
        restaurantId!,
        masa,
        groupSlug ? String(groupSlug).trim() : null
      );
    }

    if (!session) {
      return res.status(404).json({ message: 'Aktif masa oturumu yok' });
    }

    if (!session.accessCode) {
      return res.status(400).json({ message: 'Bu masada erişim kodu yok' });
    }

    if (session.codeExpiresAt && session.codeExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Kod süresi dolmuş; önce yeni kod üretin' });
    }

    const updated = await prisma.tableFloorSession.update({
      where: { id: session.id },
      data: { codeVerifiedAt: new Date() },
    });

    res.json({ ok: true, session: serializeSession(updated) });
  } catch (err) {
    console.error('approve-code', err);
    res.status(500).json({ message: 'Kod onaylanamadı' });
  }
});

/** Kod kalan süresine dakika ekle / çıkar (+10, +30, -10, -30) */
router.post('/adjust-code-ttl', async (req, res) => {
  try {
    const restaurantId = await getRestaurantId(req);
    const { tableNumber, groupSlug, sessionId, deltaMinutes } = req.body as {
      tableNumber?: string;
      groupSlug?: string;
      sessionId?: number | string | null;
      deltaMinutes?: number;
    };

    const delta = Math.trunc(Number(deltaMinutes));
    if (![10, 30, -10, -30].includes(delta)) {
      return res.status(400).json({ message: 'Geçersiz süre (+10 / +30 / -10 / -30)' });
    }

    const sid = sessionId != null && sessionId !== '' ? Number(sessionId) : NaN;
    let session =
      Number.isFinite(sid) && sid > 0
        ? await prisma.tableFloorSession.findFirst({
            where: {
              id: sid,
              restaurantId: restaurantId!,
              status: { in: [...ACTIVE_STATUSES] },
            },
          })
        : null;

    if (!session) {
      const masa = String(tableNumber || '').trim();
      if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
      session = await findActiveSession(
        restaurantId!,
        masa,
        groupSlug ? String(groupSlug).trim() : null
      );
    }

    if (!session) {
      return res.status(404).json({ message: 'Aktif masa oturumu yok' });
    }
    if (!session.accessCode) {
      return res.status(400).json({ message: 'Bu masada erişim kodu yok' });
    }

    const nowMs = Date.now();
    const current = session.codeExpiresAt?.getTime() ?? nowMs;
    const base = current > nowMs ? current : nowMs;
    const nextMs = Math.max(nowMs, base + delta * 60_000);
    const updated = await prisma.tableFloorSession.update({
      where: { id: session.id },
      data: { codeExpiresAt: new Date(nextMs) },
    });

    res.json({ ok: true, session: serializeSession(updated) });
  } catch (err) {
    console.error('adjust-code-ttl', err);
    res.status(500).json({ message: 'Süre güncellenemedi' });
  }
});

router.post('/close', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, sessionId, paid } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    sessionId?: number;
    paid?: boolean;
  };

  let session =
    sessionId != null
      ? await prisma.tableFloorSession.findFirst({
          where: {
            id: Number(sessionId),
            restaurantId: restaurantId!,
            status: { in: [...ACTIVE_STATUSES] },
          },
        })
      : null;

  if (!session && tableNumber) {
    session = await findActiveSession(
      restaurantId!,
      String(tableNumber).trim(),
      groupSlug ? String(groupSlug).trim() : null
    );
  }
  if (!session) return res.status(404).json({ message: 'Açık masa yok' });

  // Kapanışta birikmiş oturma ücretini siparişe sabitle
  if (session.status === 'open' && session.groupSlug) {
    const group = await prisma.qrTableGroup.findFirst({
      where: { restaurantId: restaurantId!, slug: session.groupSlug },
    });
    if (group) {
      const styles = (
        group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}
      ) as Record<string, TableStylePayload>;
      let tableIdx: number | null = null;
      for (let n = 1; n <= group.tableCount; n++) {
        if (tableCode(n, group.prefix || '') === session.tableNumber) {
          tableIdx = n;
          break;
        }
      }
        if (tableIdx != null) {
          const fee = parseSeatingFee(styles[String(tableIdx)]?.seatingFee);
          const amount = seatingFeeAmount(fee, session.openedAt, session.status);
          const payments = parsePaymentsJson(session.paymentsJson);
          const seatPaid = seatingFeePaidTotal(payments);
          const remainingSeat = Math.max(0, Math.round((amount - seatPaid) * 100) / 100);
          if (remainingSeat > 0.009) {
            const orders = parseOrdersJson(session.ordersJson);
            const nowIso = new Date().toISOString();
            orders.push({
              id: `seat-${Date.now()}`,
              name: 'Oturma ücreti',
              qty: 1,
              price: remainingSeat,
              createdAt: nowIso,
              source: 'admin',
              note:
                fee?.unit === 'hour'
                  ? `${fee.rate} ₺/saat`
                  : fee
                    ? `${fee.rate} ₺/dk`
                    : undefined,
              settledAt: Boolean(paid) ? nowIso : null,
            });
            await prisma.tableFloorSession.update({
              where: { id: session.id },
              data: { ordersJson: JSON.stringify(orders) },
            });
          }
        }
    }
  }

  await closeSession(session.id, Boolean(paid));
  res.json({ ok: true });
});

/** Seçilen kalemler (+ opsiyonel oturma ücreti) için ödeme kaydı */
router.post('/payment', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const {
    tableNumber,
    groupSlug,
    sessionId,
    itemIds,
    itemQtys,
    includeSeatingFee,
    method,
    note,
    tendered,
    tip,
  } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    sessionId?: number;
    itemIds?: string[];
    /** Satır id → ödenecek adet (eksikse satır bölünür) */
    itemQtys?: Record<string, number>;
    includeSeatingFee?: boolean;
    method?: string;
    note?: string;
    tendered?: number;
    tip?: number;
  };

  let session =
    sessionId != null
      ? await prisma.tableFloorSession.findFirst({
          where: {
            id: Number(sessionId),
            restaurantId: restaurantId!,
            status: { in: [...ACTIVE_STATUSES] },
          },
        })
      : null;

  if (!session && tableNumber) {
    session = await findActiveSession(
      restaurantId!,
      String(tableNumber).trim(),
      groupSlug ? String(groupSlug).trim() : null
    );
  }
  if (!session) return res.status(404).json({ message: 'Açık masa yok' });
  if (session.status !== 'open') {
    return res.status(400).json({ message: 'Ödeme yalnızca açık masada alınabilir' });
  }

  const ids = Array.isArray(itemIds) ? [...new Set(itemIds.map((x) => String(x)))] : [];
  const wantSeat = Boolean(includeSeatingFee);
  if (!ids.length && !wantSeat) {
    return res.status(400).json({ message: 'Ödenecek kalem seçin' });
  }

  const methodNorm: FloorPaymentMethod =
    method === 'card' || method === 'mixed' ? method : 'cash';

  const orders = parseOrdersJson(session.ordersJson);
  const payments = parsePaymentsJson(session.paymentsJson);
  const nowIso = new Date().toISOString();

  let itemsAmount = 0;
  const settledIds: string[] = [];
  for (const id of ids) {
    const idx = orders.findIndex((o) => o.id === id);
    if (idx < 0) return res.status(400).json({ message: 'Kalem bulunamadı' });
    const item = orders[idx];
    if (item.settledAt) {
      return res.status(400).json({ message: `"${item.name}" zaten ödenmiş` });
    }
    const rawQty =
      itemQtys && itemQtys[id] != null ? Number(itemQtys[id]) : item.qty;
    const payQty = Math.min(item.qty, Math.max(1, Math.round(rawQty) || item.qty));
    if (payQty < item.qty) {
      const remainQty = item.qty - payQty;
      orders[idx] = { ...item, qty: remainQty };
      const sliceId = `pay-slice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const slice: FloorOrderItem = {
        ...item,
        id: sliceId,
        qty: payQty,
        settledAt: null,
      };
      orders.push(slice);
      itemsAmount += lineTotal(slice);
      settledIds.push(sliceId);
    } else {
      itemsAmount += lineTotal(item);
      settledIds.push(id);
    }
  }

  let seatPart = 0;
  if (wantSeat) {
    let feeAmount = 0;
    if (session.groupSlug) {
      const group = await prisma.qrTableGroup.findFirst({
        where: { restaurantId: restaurantId!, slug: session.groupSlug },
      });
      if (group) {
        const styles = (
          group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}
        ) as Record<string, TableStylePayload>;
        let tableIdx: number | null = null;
        for (let n = 1; n <= group.tableCount; n++) {
          if (tableCode(n, group.prefix || '') === session.tableNumber) {
            tableIdx = n;
            break;
          }
        }
        if (tableIdx != null) {
          const fee = parseSeatingFee(styles[String(tableIdx)]?.seatingFee);
          feeAmount = seatingFeeAmount(fee, session.openedAt, session.status);
        }
      }
    }
    const already = seatingFeePaidTotal(payments);
    seatPart = Math.max(0, Math.round((feeAmount - already) * 100) / 100);
    if (seatPart <= 0.009) {
      return res.status(400).json({ message: 'Oturma ücreti zaten ödenmiş' });
    }
  }

  const amountGross = Math.round((itemsAmount + seatPart) * 100) / 100;
  if (amountGross <= 0) {
    return res.status(400).json({ message: 'Ödeme tutarı geçersiz' });
  }

  const meta = parseSessionMeta(session.metaJson);
  const unpaidLeft = unpaidOrders(orders).filter((o) => !settledIds.includes(o.id));
  const payingAllItems = unpaidLeft.length === 0;
  let liveFeeForDisc = 0;
  // discount only when clearing all unpaid items (+ optional remaining seat)
  let amount = amountGross;
  let discountApplied = 0;
  if (payingAllItems) {
    if (session.groupSlug) {
      const group = await prisma.qrTableGroup.findFirst({
        where: { restaurantId: restaurantId!, slug: session.groupSlug },
      });
      if (group) {
        const styles = (
          group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}
        ) as Record<string, TableStylePayload>;
        for (let n = 1; n <= group.tableCount; n++) {
          if (tableCode(n, group.prefix || '') === session.tableNumber) {
            const fee = parseSeatingFee(styles[String(n)]?.seatingFee);
            liveFeeForDisc = seatingFeeAmount(fee, session.openedAt, session.status);
            break;
          }
        }
      }
    }
    const seatLeftTotal = Math.max(0, liveFeeForDisc - seatingFeePaidTotal(payments));
    const coveringSeat = !wantSeat ? seatLeftTotal <= 0.009 : true;
    if (coveringSeat) {
      const unpaidSum = orders
        .filter((o) => settledIds.includes(o.id))
        .reduce((s, o) => s + lineTotal(o), 0);
      const gross = unpaidSum + seatPart;
      discountApplied = checkDiscountAmount(gross, meta.checkDiscount);
      amount = Math.max(0, Math.round((gross - discountApplied) * 100) / 100);
    }
  }

  const tipAmt = Math.max(0, Math.round((Number(tip) || 0) * 100) / 100);
  const tenderedAmt =
    tendered != null && Number.isFinite(Number(tendered))
      ? Math.round(Number(tendered) * 100) / 100
      : undefined;
  const changeAmt =
    tenderedAmt != null ? Math.max(0, Math.round((tenderedAmt - amount - tipAmt) * 100) / 100) : undefined;

  const payment: FloorPayment = {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    // amount = adisyon/oturma; bahşiş ayrı alanda (paidTotal şişmesin)
    amount,
    method: methodNorm,
    itemIds: settledIds,
    seatingFee: seatPart,
    createdAt: nowIso,
    note:
      [
        String(note || '').trim(),
        discountApplied > 0 ? `İndirim ${discountApplied.toFixed(2)}₺` : '',
        tipAmt > 0 ? `Bahşiş ${tipAmt.toFixed(2)}₺` : '',
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 240) || undefined,
    tendered: tenderedAmt,
    change: changeAmt,
    tip: tipAmt > 0 ? tipAmt : undefined,
  };

  const nextOrders = orders.map((o) =>
    settledIds.includes(o.id) ? { ...o, settledAt: nowIso } : o
  );
  const nextPayments = [...payments, payment];
  const clearDiscount = payingAllItems && discountApplied > 0;

  const updated = await prisma.tableFloorSession.update({
    where: { id: session.id },
    data: {
      ordersJson: JSON.stringify(nextOrders),
      paymentsJson: JSON.stringify(nextPayments),
      ...(clearDiscount
        ? {
            metaJson: serializeSessionMeta({
              ...meta,
              checkDiscount: null,
            }),
          }
        : {}),
    },
  });

  let liveFee = 0;
  if (updated.groupSlug) {
    const group = await prisma.qrTableGroup.findFirst({
      where: { restaurantId: restaurantId!, slug: updated.groupSlug },
    });
    if (group) {
      const styles = (
        group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}
      ) as Record<string, TableStylePayload>;
      for (let n = 1; n <= group.tableCount; n++) {
        if (tableCode(n, group.prefix || '') === updated.tableNumber) {
          const fee = parseSeatingFee(styles[String(n)]?.seatingFee);
          liveFee = seatingFeeAmount(fee, updated.openedAt, updated.status);
          break;
        }
      }
    }
  }

  const finalOrders = parseOrdersJson(updated.ordersJson);
  const finalPayments = parsePaymentsJson(updated.paymentsJson);
  const finalMeta = parseSessionMeta(updated.metaJson);
  const remaining = remainingBalance(finalOrders, finalPayments, liveFee, finalMeta.checkDiscount);

  res.json({
    ok: true,
    payment: {
      ...payment,
      methodLabel: methodLabel(payment.method),
    },
    orders: finalOrders,
    payments: finalPayments,
    paidTotal: paymentsTotal(finalPayments),
    remaining,
    unpaidCount: unpaidOrders(finalOrders).length,
  });
});

/** Rezervasyon / beklenen saat */
router.post('/reserve', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, guestName, expectedAt, reservationNote } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    guestName?: string;
    expectedAt?: string;
    reservationNote?: string;
  };
  const masa = String(tableNumber || '').trim();
  if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
  const grup = groupSlug ? String(groupSlug).trim() : null;
  const when = expectedAt ? new Date(expectedAt) : null;
  if (when && Number.isNaN(when.getTime())) {
    return res.status(400).json({ message: 'Geçersiz saat' });
  }
  const note =
    reservationNote !== undefined
      ? String(reservationNote || '').trim().slice(0, 1000) || null
      : undefined;

  let session = await findActiveSession(restaurantId!, masa, grup);
  if (!session) {
    session = await prisma.tableFloorSession.create({
      data: {
        restaurantId: restaurantId!,
        tableNumber: masa,
        groupSlug: grup,
        status: 'reserved',
        openedBy: 'admin',
        openedAt: new Date(),
        guestName: guestName?.trim().slice(0, 120) || null,
        expectedAt: when,
        reservationNote: note ?? null,
        ordersJson: '[]',
        mergedJson: '[]',
      },
    });
  } else {
    session = await prisma.tableFloorSession.update({
      where: { id: session.id },
      data: {
        guestName: guestName !== undefined ? guestName.trim().slice(0, 120) || null : session.guestName,
        expectedAt: expectedAt !== undefined ? when : session.expectedAt,
        reservationNote: note !== undefined ? note : session.reservationNote,
        status: session.status === 'open' ? 'open' : 'reserved',
      },
    });
  }

  res.json({ ok: true, session: serializeSession(session) });
});

/** Masa oturum meta: kişi / not / garson / hesap indirimi */
router.post('/meta', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, sessionId, pax, serviceNote, waiterUserId, waiterName, checkDiscount } =
    req.body as {
      tableNumber?: string;
      groupSlug?: string;
      sessionId?: number;
      pax?: number | null;
      serviceNote?: string | null;
      waiterUserId?: number | null;
      waiterName?: string | null;
      checkDiscount?: { mode?: string; value?: number } | null;
    };

  let session =
    sessionId != null
      ? await prisma.tableFloorSession.findFirst({
          where: {
            id: Number(sessionId),
            restaurantId: restaurantId!,
            status: { in: [...ACTIVE_STATUSES] },
          },
        })
      : null;
  if (!session && tableNumber) {
    session = await findActiveSession(
      restaurantId!,
      String(tableNumber).trim(),
      groupSlug ? String(groupSlug).trim() : null
    );
  }
  if (!session) return res.status(404).json({ message: 'Açık masa yok' });

  const prev = parseSessionMeta(session.metaJson);
  let nextWaiterName = waiterName !== undefined ? String(waiterName || '').trim().slice(0, 120) || null : prev.waiterName ?? null;
  let nextWaiterId =
    waiterUserId !== undefined
      ? waiterUserId == null || waiterUserId === ('' as unknown)
        ? null
        : Number(waiterUserId)
      : prev.waiterUserId ?? null;

  if (waiterUserId !== undefined && nextWaiterId != null && Number.isFinite(nextWaiterId)) {
    const user = await prisma.user.findFirst({
      where: { id: nextWaiterId, restaurantId: restaurantId!, isActive: true },
      select: { id: true, fullName: true },
    });
    if (!user) return res.status(400).json({ message: 'Garson bulunamadı' });
    nextWaiterId = user.id;
    nextWaiterName = user.fullName;
  } else if (waiterUserId !== undefined && (waiterUserId == null || waiterUserId === ('' as unknown))) {
    nextWaiterId = null;
    nextWaiterName = null;
  }

  let nextDiscount = prev.checkDiscount ?? null;
  if (checkDiscount !== undefined) {
    if (!checkDiscount || !Number(checkDiscount.value)) nextDiscount = null;
    else {
      nextDiscount = {
        mode: checkDiscount.mode === 'percent' ? 'percent' : 'fixed',
        value: Math.abs(Number(checkDiscount.value) || 0),
      };
    }
  }

  const nextPax =
    pax !== undefined
      ? pax == null || !Number(pax)
        ? undefined
        : Math.min(99, Math.max(1, Math.round(Number(pax))))
      : prev.pax;

  const meta: FloorSessionMeta = {
    pax: nextPax,
    serviceNote:
      serviceNote !== undefined
        ? String(serviceNote || '').trim().slice(0, 1000) || undefined
        : prev.serviceNote,
    waiterUserId: nextWaiterId,
    waiterName: nextWaiterName,
    checkDiscount: nextDiscount,
  };

  const updated = await prisma.tableFloorSession.update({
    where: { id: session.id },
    data: { metaJson: serializeSessionMeta(meta) },
  });

  res.json({ ok: true, session: serializeSession(updated), meta: parseSessionMeta(updated.metaJson) });
});

/** Masa kalıcı oturma ücreti ayarı (tableStyles içinde) */
router.put('/seating-fee', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { groupSlug, tableIndex, enabled, rate, unit } = req.body as {
    groupSlug?: string;
    tableIndex?: number;
    enabled?: boolean;
    rate?: number;
    unit?: 'minute' | 'hour';
  };
  const slug = String(groupSlug || '').trim();
  const idx = Number(tableIndex);
  if (!slug || !Number.isFinite(idx) || idx < 1) {
    return res.status(400).json({ message: 'Grup ve masa gerekli' });
  }
  const group = await prisma.qrTableGroup.findFirst({
    where: { restaurantId: restaurantId!, slug },
  });
  if (!group) return res.status(404).json({ message: 'Grup yok' });

  const styles = (
    group.tableStyles && typeof group.tableStyles === 'object' ? group.tableStyles : {}
  ) as Record<string, TableStylePayload>;
  const key = String(idx);
  const prev = styles[key] || {};
  const nextFee: SeatingFeeConfig = {
    enabled: Boolean(enabled),
    rate: Math.max(0, Math.abs(Number(rate) || 0)),
    unit: unit === 'hour' ? 'hour' : 'minute',
  };
  styles[key] = { ...prev, seatingFee: nextFee };

  await prisma.qrTableGroup.update({
    where: { id: group.id },
    data: { tableStyles: styles as Prisma.InputJsonValue },
  });

  res.json({ ok: true, seatingFee: nextFee });
});

/** Sipariş satırı güncelle / çoğalt / adet artır */
router.patch('/orders/item', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { sessionId, itemId, action, patch } = req.body as {
    sessionId?: number;
    itemId?: string;
    action?: 'update' | 'copy' | 'bump' | 'remove';
    patch?: Partial<FloorOrderItem> & { qty?: number };
  };
  const sid = Number(sessionId);
  const iid = String(itemId || '');
  if (!sid || !iid) return res.status(400).json({ message: 'Oturum ve satır gerekli' });

  const session = await prisma.tableFloorSession.findFirst({
    where: { id: sid, restaurantId: restaurantId! },
  });
  if (!session || session.status !== 'open') {
    return res.status(404).json({ message: 'Açık oturum yok' });
  }

  const orders = parseOrdersJson(session.ordersJson);
  const idx = orders.findIndex((o) => o.id === iid);
  if (idx < 0) return res.status(404).json({ message: 'Sipariş satırı yok' });

  if (orders[idx].settledAt && action !== 'copy') {
    return res.status(400).json({ message: 'Ödenmiş kalem düzenlenemez' });
  }

  if (action === 'copy') {
    const src = orders[idx];
    const stockCheck = await consumeStockForItems(restaurantId!, [
      { productId: src.productId, qty: src.qty, selections: src.selections },
    ]);
    if (!stockCheck.ok) {
      return res.status(409).json({ message: stockCheck.message, code: 'OUT_OF_STOCK' });
    }
    orders.push({
      ...src,
      id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      source: 'admin',
      settledAt: null,
    });
  } else if (action === 'remove') {
    const removed = orders[idx];
    orders.splice(idx, 1);
    await restoreStockForItems(restaurantId!, [
      { productId: removed.productId, qty: removed.qty, selections: removed.selections },
    ]);
  } else if (action === 'bump') {
    const rawDelta = Number(patch?.qty) || 1;
    const curQty = orders[idx].qty;
    const nextQty = Math.min(99, Math.max(1, curQty + rawDelta));
    const actualDelta = nextQty - curQty;
    if (actualDelta > 0) {
      const stockCheck = await consumeStockForItems(restaurantId!, [
        {
          productId: orders[idx].productId,
          qty: actualDelta,
          selections: orders[idx].selections,
        },
      ]);
      if (!stockCheck.ok) {
        return res.status(409).json({ message: stockCheck.message, code: 'OUT_OF_STOCK' });
      }
    } else if (actualDelta < 0) {
      await restoreStockForItems(restaurantId!, [
        {
          productId: orders[idx].productId,
          qty: Math.abs(actualDelta),
          selections: orders[idx].selections,
        },
      ]);
    }
    orders[idx] = {
      ...orders[idx],
      qty: nextQty,
    };
  } else {
    const cur = orders[idx];
    const nextQty =
      patch?.qty != null ? Math.min(99, Math.max(1, Number(patch.qty) || 1)) : cur.qty;

    if (nextQty !== cur.qty) {
      const diff = nextQty - cur.qty;
      if (diff > 0) {
        const stockCheck = await consumeStockForItems(restaurantId!, [
          { productId: cur.productId, qty: diff, selections: cur.selections },
        ]);
        if (!stockCheck.ok) {
          return res.status(409).json({ message: stockCheck.message, code: 'OUT_OF_STOCK' });
        }
      } else if (diff < 0) {
        await restoreStockForItems(restaurantId!, [
          { productId: cur.productId, qty: Math.abs(diff), selections: cur.selections },
        ]);
      }
    }

    const freeNote =
      patch?.freeNote !== undefined
        ? String(patch.freeNote || '').trim().slice(0, 240)
        : cur.freeNote || '';

    let nextPrice = cur.price;
    let nextSelections = cur.selections;
    let optionsNote = '';

    const selectionInputs =
      patch?.selections !== undefined
        ? (patch.selections as OptionSelectionInput[])
        : (cur.selections || []).map((s) => ({
            groupId: s.groupId,
            optionId: s.optionId,
            qty: s.qty,
          }));

    if (cur.productId) {
      const product = await prisma.product.findFirst({
        where: { id: cur.productId, restaurantId: restaurantId! },
      });
      if (product) {
        const groups = activeOptionGroups(product.optionGroups);
        if (groups.length) {
          const checked = validateSelections(groups, selectionInputs || []);
          if (!checked.ok) {
            return res.status(400).json({ message: checked.message });
          }
          nextPrice = computeUnitPrice(Number(product.price), checked.picks);
          optionsNote = formatSelectionsNote(checked.picks);
          nextSelections = checked.picks.map((p) => ({
            groupId: p.group.id,
            optionId: p.option.id,
            qty: p.qty,
            label: p.option.name,
          }));
        } else if (patch?.selections !== undefined) {
          nextSelections = undefined;
          nextPrice = Number(product.price);
        }
      }
    }

    const note =
      patch?.note !== undefined && patch.selections === undefined && patch.freeNote === undefined
        ? String(patch.note || '').trim().slice(0, 240)
        : [optionsNote, freeNote].filter(Boolean).join(' · ').slice(0, 240);

    const adjustmentType =
      patch?.adjustmentType === 'extra' || patch?.adjustmentType === 'discount'
        ? patch.adjustmentType
        : patch?.adjustmentType === null
          ? null
          : cur.adjustmentType ?? null;
    const adjustmentMode =
      patch?.adjustmentMode === 'percent'
        ? 'percent'
        : patch?.adjustmentMode === 'fixed'
          ? 'fixed'
          : cur.adjustmentMode || 'fixed';
    const adjustmentValue =
      patch?.adjustmentValue !== undefined
        ? Math.abs(Number(patch.adjustmentValue) || 0)
        : cur.adjustmentValue || 0;

    orders[idx] = {
      ...cur,
      qty: nextQty,
      price: nextPrice,
      freeNote: freeNote || undefined,
      selections: nextSelections?.length ? nextSelections : undefined,
      note: note || undefined,
      ...(adjustmentType && adjustmentValue > 0
        ? { adjustmentType, adjustmentMode, adjustmentValue }
        : { adjustmentType: null, adjustmentMode: undefined, adjustmentValue: undefined }),
    };
  }

  const updated = await prisma.tableFloorSession.update({
    where: { id: session.id },
    data: { ordersJson: JSON.stringify(orders) },
  });

  res.json({
    ok: true,
    orders: parseOrdersJson(updated.ordersJson),
    total: ordersTotal(parseOrdersJson(updated.ordersJson)),
  });
});

/** Masa taşı (grup değişebilir) */
router.post('/move', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { fromTable, toTable, groupSlug, toGroupSlug } = req.body as {
    fromTable?: string;
    toTable?: string;
    groupSlug?: string;
    toGroupSlug?: string;
  };
  const from = String(fromTable || '').trim();
  const to = String(toTable || '').trim();
  const fromGrup = groupSlug ? String(groupSlug).trim() : null;
  const toGrup =
    toGroupSlug != null && String(toGroupSlug).trim()
      ? String(toGroupSlug).trim()
      : fromGrup;
  if (!from || !to) return res.status(400).json({ message: 'Kaynak ve hedef masa gerekli' });
  if (from === to && fromGrup === toGrup) {
    return res.status(400).json({ message: 'Aynı masa' });
  }

  const source = await findActiveSession(restaurantId!, from, fromGrup);
  if (!source) return res.status(404).json({ message: 'Kaynak masa boş' });
  if (parseMergedJson(source.mergedJson).length) {
    return res.status(400).json({ message: 'Birleşik masayı önce ayırın' });
  }

  const targetBusy = await findActiveSession(restaurantId!, to, toGrup);
  if (targetBusy) return res.status(409).json({ message: 'Hedef masa dolu' });

  const anyMerged = await prisma.tableFloorSession.findMany({
    where: {
      restaurantId: restaurantId!,
      status: { in: [...ACTIVE_STATUSES] },
      groupSlug: toGrup,
    },
  });
  if (anyMerged.some((s) => parseMergedJson(s.mergedJson).includes(to))) {
    return res.status(409).json({ message: 'Hedef masa birleşik' });
  }

  const updated = await prisma.tableFloorSession.update({
    where: { id: source.id },
    data: { tableNumber: to, groupSlug: toGrup },
  });
  res.json({ ok: true, session: serializeSession(updated) });
});

/** Masa birleştir — otherTables → primary */
router.post('/merge', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { primaryTable, otherTables, groupSlug } = req.body as {
    primaryTable?: string;
    otherTables?: string[];
    groupSlug?: string;
  };
  const primary = String(primaryTable || '').trim();
  const others = (otherTables || []).map((t) => String(t).trim()).filter((t) => t && t !== primary);
  const grup = groupSlug ? String(groupSlug).trim() : null;
  if (!primary || !others.length) {
    return res.status(400).json({ message: 'Ana masa ve birleştirilecek masalar gerekli' });
  }

  let primarySession = await findActiveSession(restaurantId!, primary, grup);
  if (!primarySession) {
    primarySession = await openOrGetSession(restaurantId!, primary, grup, 'admin');
  }

  let orders = parseOrdersJson(primarySession.ordersJson);
  let payments = parsePaymentsJson(primarySession.paymentsJson);
  const merged = new Set(parseMergedJson(primarySession.mergedJson));

  for (const code of others) {
    const other = await findActiveSession(restaurantId!, code, grup);
    if (other) {
      orders = [...orders, ...parseOrdersJson(other.ordersJson)];
      payments = [...payments, ...parsePaymentsJson(other.paymentsJson)];
      for (const m of parseMergedJson(other.mergedJson)) merged.add(m);
      await closeSession(other.id);
    }
    merged.add(code);
  }

  const updated = await prisma.tableFloorSession.update({
    where: { id: primarySession.id },
    data: {
      status: 'open',
      ordersJson: JSON.stringify(orders),
      paymentsJson: JSON.stringify(payments),
      mergedJson: JSON.stringify([...merged]),
    },
  });

  res.json({ ok: true, session: serializeSession(updated) });
});

/** Birleşik masadan ayır */
router.post('/split', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { primaryTable, splitTable, groupSlug } = req.body as {
    primaryTable?: string;
    splitTable?: string;
    groupSlug?: string;
  };
  const primary = String(primaryTable || '').trim();
  const split = String(splitTable || '').trim();
  const grup = groupSlug ? String(groupSlug).trim() : null;
  if (!primary || !split) return res.status(400).json({ message: 'Masa gerekli' });

  const session = await findActiveSession(restaurantId!, primary, grup);
  if (!session) return res.status(404).json({ message: 'Ana masa yok' });

  const merged = parseMergedJson(session.mergedJson).filter((c) => c !== split);
  await prisma.tableFloorSession.update({
    where: { id: session.id },
    data: { mergedJson: JSON.stringify(merged) },
  });

  res.json({ ok: true, splitTable: split, mergedTables: merged });
});

router.post('/orders', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, items } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    items?: {
      productId?: number;
      name?: string;
      qty?: number;
      price?: number;
      note?: string;
      freeNote?: string;
      selections?: OptionSelectionInput[];
      adjustmentType?: 'extra' | 'discount' | null;
      adjustmentMode?: 'fixed' | 'percent';
      adjustmentValue?: number;
    }[];
  };

  const masa = String(tableNumber || '').trim();
  if (!masa) return res.status(400).json({ message: 'Masa gerekli' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Ürün seçin' });
  }

  const session = await openOrGetSession(
    restaurantId!,
    masa,
    groupSlug ? String(groupSlug).trim() : null,
    'admin'
  );

  const now = new Date().toISOString();
  const langs = await getLanguages();
  const langCode = langs.find((l) => l.code === 'tr')?.code || langs[0]?.code || 'tr';

  const lineItems: FloorOrderItem[] = [];
  for (const raw of items.slice(0, 40)) {
    let name = String(raw.name || '').trim();
    let price = Number(raw.price) || 0;
    let productId = raw.productId != null ? Number(raw.productId) : null;
    const freeNote = String(raw.freeNote || raw.note || '').trim().slice(0, 240);
    let optionsNote = '';
    let storedSelections: FloorOrderItem['selections'];

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, restaurantId: restaurantId! },
      });
      if (product) {
        name = getProductField(product.i18n, langCode, 'name') || name || 'Ürün';
        price = Number(product.price);
        productId = product.id;

        const groups = activeOptionGroups(product.optionGroups);
        if (groups.length) {
          const checked = validateSelections(groups, raw.selections || []);
          if (!checked.ok) {
            return res.status(400).json({ message: `${name}: ${checked.message}` });
          }
          price = computeUnitPrice(Number(product.price), checked.picks);
          optionsNote = formatSelectionsNote(checked.picks);
          storedSelections = checked.picks.map((p) => ({
            groupId: p.group.id,
            optionId: p.option.id,
            qty: p.qty,
            label: p.option.name,
          }));
        }
      }
    }
    if (!name) continue;
    const note = [optionsNote, freeNote].filter(Boolean).join(' · ').slice(0, 240);
    const adjustmentType =
      raw.adjustmentType === 'extra' || raw.adjustmentType === 'discount'
        ? raw.adjustmentType
        : null;
    const adjustmentMode = raw.adjustmentMode === 'percent' ? 'percent' : 'fixed';
    const adjustmentValue = Math.abs(Number(raw.adjustmentValue) || 0);
    lineItems.push({
      id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId,
      name: name.slice(0, 120),
      qty: Math.min(99, Math.max(1, Number(raw.qty) || 1)),
      price,
      createdAt: now,
      source: 'admin',
      ...(note ? { note } : {}),
      ...(freeNote ? { freeNote } : {}),
      ...(storedSelections?.length ? { selections: storedSelections } : {}),
      ...(adjustmentType && adjustmentValue > 0
        ? { adjustmentType, adjustmentMode, adjustmentValue }
        : {}),
    });
  }

  if (!lineItems.length) return res.status(400).json({ message: 'Geçerli ürün yok' });

  const stockCheck = await consumeStockForItems(
    restaurantId!,
    lineItems.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      selections: i.selections,
    }))
  );
  if (!stockCheck.ok) {
    return res.status(409).json({ message: stockCheck.message, code: 'OUT_OF_STOCK' });
  }

  const updated = await appendOrdersToSession(session.id, lineItems);
  const orders = parseOrdersJson(updated?.ordersJson);

  const totalPrice = ordersTotal(lineItems);
  await prisma.tableServiceRequest.create({
    data: {
      restaurantId: restaurantId!,
      type: 'waiter',
      tableNumber: masa,
      groupSlug: groupSlug ? String(groupSlug).trim() : null,
      note: 'Admin sipariş ekledi',
      orderJson: JSON.stringify({
        items: lineItems.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          note: i.note,
          adjustmentType: i.adjustmentType,
          adjustmentMode: i.adjustmentMode,
          adjustmentValue: i.adjustmentValue,
        })),
        totalPrice,
        source: 'admin',
      }),
    },
  });

  res.status(201).json({
    ok: true,
    sessionId: session.id,
    orders,
    total: ordersTotal(orders),
  });
});

router.get('/products', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const langs = await getLanguages();
  const langCode = langs.find((l) => l.code === 'tr')?.code || langs[0]?.code || 'tr';

  const products = await prisma.product.findMany({
    where: { restaurantId: restaurantId!, isActive: true },
    include: {
      group: { include: { parent: true } },
      currency: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  res.json(
    products.map((p) => {
      const root = p.group?.parent || p.group;
      return {
        id: p.id,
        name: getProductField(p.i18n, langCode, 'name') || `Ürün #${p.id}`,
        price: Number(p.price),
        groupId: root?.id ?? p.groupId,
        groupName: (root ? getGroupName(root.i18n, langCode) : '') || '',
        currency: p.currency
          ? { code: p.currency.code, symbol: p.currency.symbol }
          : null,
        optionGroups: activeOptionGroups(p.optionGroups),
      };
    })
  );
});

export default router;
