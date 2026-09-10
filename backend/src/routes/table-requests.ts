import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

router.get('/stats', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || '7'), 10) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.tableServiceRequest.findMany({
    where: { restaurantId, createdAt: { gte: since } },
    select: { tableNumber: true, groupSlug: true, type: true, createdAt: true },
  });

  const byTable = new Map<string, { tableNumber: string; groupSlug: string | null; count: number }>();
  const byHour = Array.from({ length: 24 }, () => 0);
  const byDayMap = new Map<string, { date: string; waiter: number; bill: number; total: number }>();
  let waiter = 0;
  let bill = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDayMap.set(key, { date: key, waiter: 0, bill: 0, total: 0 });
  }

  for (const row of rows) {
    const key = `${row.groupSlug || ''}::${row.tableNumber}`;
    const cur = byTable.get(key) || {
      tableNumber: row.tableNumber,
      groupSlug: row.groupSlug,
      count: 0,
    };
    cur.count += 1;
    byTable.set(key, cur);
    byHour[new Date(row.createdAt).getHours()] += 1;
    const dayKey = new Date(row.createdAt).toISOString().slice(0, 10);
    const day = byDayMap.get(dayKey) || { date: dayKey, waiter: 0, bill: 0, total: 0 };
    day.total += 1;
    if (row.type === 'bill') {
      bill += 1;
      day.bill += 1;
    } else {
      waiter += 1;
      day.waiter += 1;
    }
    byDayMap.set(dayKey, day);
  }

  const topTables = [...byTable.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  const byDay = [...byDayMap.values()];

  res.json({
    days,
    total: rows.length,
    waiter,
    bill,
    topTables,
    byHour,
    byDay,
  });
});

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const { unread, page = '1', limit = '30' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: { restaurantId: number; isRead?: boolean } = { restaurantId };
  if (unread === 'true') where.isRead = false;

  const [data, total, unreadCount] = await Promise.all([
    prisma.tableServiceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.tableServiceRequest.count({ where }),
    prisma.tableServiceRequest.count({ where: { restaurantId, isRead: false } }),
  ]);

  res.json({
    data,
    unreadCount,
    pagination: { page: pageNum, limit: limitNum, total },
  });
});

router.delete('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const result = await prisma.tableServiceRequest.deleteMany({
    where: { restaurantId },
  });

  res.json({ ok: true, deleted: result.count });
});

router.patch('/:id/read', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);

  const existing = await prisma.tableServiceRequest.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const updated = await prisma.tableServiceRequest.update({
    where: { id },
    data: { isRead: true },
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);

  const existing = await prisma.tableServiceRequest.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  await prisma.tableServiceRequest.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
