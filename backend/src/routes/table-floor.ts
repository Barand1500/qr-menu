import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ACTIVE_STATUSES,
  appendOrdersToSession,
  closeSession,
  findActiveSession,
  openOrGetSession,
  ordersTotal,
  parseMergedJson,
  parseOrdersJson,
  parseSeatingFee,
  seatingFeeAmount,
  tableCode,
  WAITER_ALERT_MS,
  type FloorOrderItem,
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
import {
  codeExpiryDate,
  generateUniqueAccessCode,
  loadTableSessionCodeConfig,
  resolveCodeGateStatus,
} from '../lib/table-session-code.js';

const router = Router();
router.use(authRequired);

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
  mergedJson: string | null;
  accessCode?: string | null;
  codeExpiresAt?: Date | null;
  codeVerifiedAt?: Date | null;
}) {
  const orders = parseOrdersJson(session.ordersJson);
  const merged = parseMergedJson(session.mergedJson);
  const codeStatus = resolveCodeGateStatus(session);
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
    total: ordersTotal(orders),
    mergedTables: merged,
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
          seatingFee,
          seatingFeeAmount: feeAmount,
          total: ordersTotal(orders) + feeAmount,
          mergedTables: own ? parseMergedJson(own.mergedJson) : [],
          mergePrimary: isSatellite && linked ? linked.tableNumber : null,
          waiterAlertMs: alertMsLeft,
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
        if (amount > 0) {
          const orders = parseOrdersJson(session.ordersJson);
          orders.push({
            id: `seat-${Date.now()}`,
            name: 'Oturma ücreti',
            qty: 1,
            price: amount,
            createdAt: new Date().toISOString(),
            source: 'admin',
            note:
              fee?.unit === 'hour'
                ? `${fee.rate} ₺/saat`
                : fee
                  ? `${fee.rate} ₺/dk`
                  : undefined,
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

  if (action === 'copy') {
    const src = orders[idx];
    orders.push({
      ...src,
      id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      source: 'admin',
    });
  } else if (action === 'remove') {
    orders.splice(idx, 1);
  } else if (action === 'bump') {
    const delta = Number(patch?.qty) || 1;
    orders[idx] = {
      ...orders[idx],
      qty: Math.min(99, Math.max(1, orders[idx].qty + delta)),
    };
  } else {
    const cur = orders[idx];
    const nextQty =
      patch?.qty != null ? Math.min(99, Math.max(1, Number(patch.qty) || 1)) : cur.qty;

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
  const merged = new Set(parseMergedJson(primarySession.mergedJson));

  for (const code of others) {
    const other = await findActiveSession(restaurantId!, code, grup);
    if (other) {
      orders = [...orders, ...parseOrdersJson(other.ordersJson)];
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
