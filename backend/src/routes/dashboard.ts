import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId, validateProduct } from '../lib/auth.js';
import { getGroupName, getProductField } from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

function daysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

router.get('/summary', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [groupsActive, groupsPassive, products, viewEventsToday] = await Promise.all([
    prisma.group.count({ where: { restaurantId: restaurantId!, isActive: true } }),
    prisma.group.count({ where: { restaurantId: restaurantId!, isActive: false } }),
    prisma.product.findMany({ where: { restaurantId: restaurantId! }, select: { id: true } }),
    prisma.viewEvent.findMany({
      where: { restaurantId: restaurantId!, viewedAt: { gte: today } },
      select: { sessionId: true },
    }),
  ]);

  let productsValid = 0;
  let productsInvalid = 0;
  for (const p of products) {
    const v = await validateProduct(p.id, restaurantId!);
    if (v.valid) productsValid++;
    else productsInvalid++;
  }

  const uniqueSessions = new Set(viewEventsToday.map((v) => v.sessionId));

  res.json({
    groups: { active: groupsActive, passive: groupsPassive },
    products: { valid: productsValid, invalid: productsInvalid, total: products.length },
    viewsToday: { total: viewEventsToday.length, unique: uniqueSessions.size },
  });
});

async function topEntities(
  restaurantId: number,
  entityType: 'group' | 'product',
  since: Date
) {
  const events = await prisma.viewEvent.groupBy({
    by: ['entityId'],
    where: {
      restaurantId,
      entityType,
      viewedAt: { gte: since },
    },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take: 10,
  });

  if (entityType === 'group') {
    const groups = await prisma.group.findMany({
      where: { id: { in: events.map((e) => e.entityId) } },
    });
    return events.map((e) => {
      const group = groups.find((g) => g.id === e.entityId);
      return {
        id: e.entityId,
        name: group ? getGroupName(group.i18n) : 'Bilinmiyor',
        count: e._count.entityId,
      };
    });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: events.map((e) => e.entityId) } },
  });
  return events.map((e) => {
    const product = products.find((p) => p.id === e.entityId);
    return {
      id: e.entityId,
      name: product ? getProductField(product.i18n, 'tr', 'name') : 'Bilinmiyor',
      count: e._count.entityId,
    };
  });
}

/** Özet: son 30 gün en çok bakılan gruplar */
router.get('/top-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  res.json(await topEntities(restaurantId!, 'group', daysAgo(30)));
});

/** Özet: son 30 gün en çok bakılan ürünler */
router.get('/top-products', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  res.json(await topEntities(restaurantId!, 'product', daysAgo(30)));
});

/** Son 12 ay: grup / ürün görüntülenmeleri */
router.get('/monthly', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  start.setHours(0, 0, 0, 0);

  const events = await prisma.viewEvent.findMany({
    where: {
      restaurantId: restaurantId!,
      entityType: { in: ['group', 'product'] },
      viewedAt: { gte: start },
    },
    select: { entityType: true, viewedAt: true },
  });

  const monthsTr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const buckets: { key: string; month: string; year: number; gruplar: number; urunler: number }[] =
    [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: monthsTr[d.getMonth()],
      year: d.getFullYear(),
      gruplar: 0,
      urunler: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const ev of events) {
    const d = ev.viewedAt;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = index.get(key);
    if (idx == null) continue;
    if (ev.entityType === 'group') buckets[idx].gruplar += 1;
    else if (ev.entityType === 'product') buckets[idx].urunler += 1;
  }

  res.json(
    buckets.map(({ month, year, gruplar, urunler }) => ({
      month,
      year,
      label: `${month} ${year}`,
      gruplar,
      urunler,
    }))
  );
});

export default router;
