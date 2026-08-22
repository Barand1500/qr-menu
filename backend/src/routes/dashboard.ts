import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId, validateProduct } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

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

router.get('/top-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = await prisma.viewEvent.groupBy({
    by: ['entityId'],
    where: {
      restaurantId: restaurantId!,
      entityType: 'group',
      viewedAt: { gte: today },
    },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take: 10,
  });

  const groups = await prisma.group.findMany({
    where: { id: { in: events.map((e) => e.entityId) } },
    include: { translations: { include: { language: true } } },
  });

  const data = events.map((e) => {
    const group = groups.find((g) => g.id === e.entityId);
    const tr = group?.translations.find((t) => t.language.code === 'tr');
    return {
      id: e.entityId,
      name: tr?.name || group?.translations[0]?.name || 'Bilinmiyor',
      count: e._count.entityId,
    };
  });

  res.json(data);
});

router.get('/top-products', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = await prisma.viewEvent.groupBy({
    by: ['entityId'],
    where: {
      restaurantId: restaurantId!,
      entityType: 'product',
      viewedAt: { gte: today },
    },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take: 10,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: events.map((e) => e.entityId) } },
    include: { translations: { include: { language: true } } },
  });

  const data = events.map((e) => {
    const product = products.find((p) => p.id === e.entityId);
    const tr = product?.translations.find((t) => t.language.code === 'tr');
    return {
      id: e.entityId,
      name: tr?.name || product?.translations[0]?.name || 'Bilinmiyor',
      count: e._count.entityId,
    };
  });

  res.json(data);
});

export default router;
