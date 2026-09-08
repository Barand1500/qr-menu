import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { getGroupName, getProductField } from '../lib/i18n-json.js';
import { languageLabel } from '../lib/client-meta.js';

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

async function topByField(
  restaurantId: number,
  field: 'lang' | 'device' | 'os',
  dateFilter?: { gte?: Date; lte?: Date }
) {
  const rows = await prisma.viewEvent.groupBy({
    by: [field],
    where: {
      restaurantId,
      [field]: { not: null },
      ...(dateFilter && { viewedAt: dateFilter }),
    },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
    take: 12,
  });

  return rows
    .filter((r) => r[field])
    .map((r, i) => {
      const raw = String(r[field]);
      const name = field === 'lang' ? languageLabel(raw) : raw;
      return {
        id: i + 1,
        name,
        count: r._count._all,
        code: field === 'lang' ? raw : undefined,
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

router.get('/languages', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  res.json(await topByField(restaurantId!, 'lang', dateFilter));
});

router.get('/operating-systems', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  res.json(await topByField(restaurantId!, 'os', dateFilter));
});

router.get('/devices', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const dateFilter = buildDateFilter(req.query.from, req.query.to);
  res.json(await topByField(restaurantId!, 'device', dateFilter));
});

export default router;
