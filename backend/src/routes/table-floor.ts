import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  appendOrdersToSession,
  closeSession,
  findOpenSession,
  openOrGetSession,
  ordersTotal,
  parseOrdersJson,
  tableCode,
  WAITER_ALERT_MS,
  type FloorOrderItem,
} from '../lib/table-floor.js';
import { getProductField, getLanguages, getGroupName } from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

type TableStylePayload = {
  name?: string;
  colorId?: string;
  withLogo?: boolean;
  frameId?: string;
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

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  await ensureDefaultGroups(restaurantId!);

  const [groups, sessions, recentWaiters, restaurant] = await Promise.all([
    prisma.qrTableGroup.findMany({
      where: { restaurantId: restaurantId! },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.tableFloorSession.findMany({
      where: { restaurantId: restaurantId!, status: 'open' },
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

  const sessionMap = new Map(
    sessions.map((s) => [`${s.groupSlug || ''}::${s.tableNumber}`, s])
  );
  const waiterMap = new Map<string, Date>();
  for (const w of recentWaiters) {
    const key = `${w.groupSlug || ''}::${w.tableNumber}`;
    if (!waiterMap.has(key)) waiterMap.set(key, w.createdAt);
  }

  const payload = {
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
        const session = sessionMap.get(key);
        const orders = session ? parseOrdersJson(session.ordersJson) : [];
        const waiterAt = waiterMap.get(key);
        const alertMsLeft = waiterAt
          ? Math.max(0, WAITER_ALERT_MS - (Date.now() - waiterAt.getTime()))
          : 0;
        return {
          index: n,
          code,
          name: style.name?.trim() || `${g.name} ${n}`,
          colorId: style.colorId || 'black',
          occupied: Boolean(session),
          openedAt: session?.openedAt?.toISOString() || null,
          openedBy: session?.openedBy || null,
          sessionId: session?.id || null,
          orders,
          total: ordersTotal(orders),
          waiterAlertMs: alertMsLeft,
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
  };

  res.json(payload);
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
  res.json({
    ok: true,
    session: {
      id: session.id,
      tableNumber: session.tableNumber,
      groupSlug: session.groupSlug,
      openedAt: session.openedAt.toISOString(),
      openedBy: session.openedBy,
    },
  });
});

router.post('/close', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, sessionId } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    sessionId?: number;
  };

  let session =
    sessionId != null
      ? await prisma.tableFloorSession.findFirst({
          where: { id: Number(sessionId), restaurantId: restaurantId!, status: 'open' },
        })
      : null;

  if (!session && tableNumber) {
    session = await findOpenSession(
      restaurantId!,
      String(tableNumber).trim(),
      groupSlug ? String(groupSlug).trim() : null
    );
  }
  if (!session) return res.status(404).json({ message: 'Açık masa yok' });

  await closeSession(session.id);
  res.json({ ok: true });
});

router.post('/orders', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { tableNumber, groupSlug, items } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    items?: { productId?: number; name?: string; qty?: number; price?: number }[];
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

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, restaurantId: restaurantId! },
      });
      if (product) {
        name = getProductField(product.i18n, langCode, 'name') || name || 'Ürün';
        price = Number(product.price);
        productId = product.id;
      }
    }
    if (!name) continue;
    lineItems.push({
      id: `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId,
      name: name.slice(0, 120),
      qty: Math.min(99, Math.max(1, Number(raw.qty) || 1)),
      price,
      createdAt: now,
      source: 'admin',
    });
  }

  if (!lineItems.length) return res.status(400).json({ message: 'Geçerli ürün yok' });

  const updated = await appendOrdersToSession(session.id, lineItems);
  const orders = parseOrdersJson(updated?.ordersJson);

  const totalPrice = ordersTotal(lineItems);
  const notify = await prisma.tableServiceRequest.create({
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
    notificationId: notify.id,
  });
});

router.get('/products', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const langs = await getLanguages();
  const langCode = langs.find((l) => l.code === 'tr')?.code || langs[0]?.code || 'tr';

  const products = await prisma.product.findMany({
    where: { restaurantId: restaurantId!, isActive: true },
    include: { group: true, currency: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  res.json(
    products.map((p) => ({
      id: p.id,
      name: getProductField(p.i18n, langCode, 'name') || `Ürün #${p.id}`,
      price: Number(p.price),
      groupId: p.groupId,
      groupName: (p.group ? getGroupName(p.group.i18n, langCode) : '') || '',
      currency: p.currency
        ? { code: p.currency.code, symbol: p.currency.symbol }
        : null,
    }))
  );
});

export default router;
