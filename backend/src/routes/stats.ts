import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { getGroupName, getProductField } from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

function buildDateFilter(from?: unknown, to?: unknown) {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(String(from));
  if (to) {
    const end = new Date(String(to));
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  return Object.keys(dateFilter).length ? dateFilter : undefined;
}

async function topEntities(
  restaurantId: number,
  entityType: 'group' | 'product',
  dateFilter?: { gte?: Date; lte?: Date }
) {
  const events = await prisma.viewEvent.groupBy({
    by: ['entityId'],
    where: {
      restaurantId,
      entityType,
      ...(dateFilter && { viewedAt: dateFilter }),
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

router.get('/top-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  res.json(await topEntities(restaurantId!, 'group', dateFilter));
});

router.get('/top-products', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  res.json(await topEntities(restaurantId!, 'product', dateFilter));
});

router.get('/languages', async (_req, res) => {
  res.json([]);
});

router.get('/operating-systems', async (_req, res) => {
  res.json([]);
});

router.get('/devices', async (_req, res) => {
  res.json([]);
});

export default router;
