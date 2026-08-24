import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (restaurantId == null) return res.status(401).json({ message: 'Yetkisiz' });

  const { unread, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: { restaurantId: number; isRead?: boolean } = { restaurantId };
  if (unread === 'true') where.isRead = false;

  const [data, total, unreadCount] = await Promise.all([
    prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.suggestion.count({ where }),
    prisma.suggestion.count({ where: { restaurantId, isRead: false } }),
  ]);

  res.json({
    data,
    unreadCount,
    pagination: { page: pageNum, limit: limitNum, total },
  });
});

router.patch('/:id/read', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);

  const existing = await prisma.suggestion.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const updated = await prisma.suggestion.update({
    where: { id },
    data: { isRead: true },
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);

  const existing = await prisma.suggestion.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  await prisma.suggestion.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
