import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../lib/auth.js';
import { loadSofraConfig } from '../lib/sofra.js';
import { parseManagerNote } from '../lib/manager-contact.js';

export const publicManagerMessages = Router();
const sends = new Map<string, number[]>();
publicManagerMessages.get('/:slug/manager-contact', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: String(req.params.slug) },
    });
    if (!restaurant)
      return res.status(404).json({ message: 'Menü bulunamadı.' });
    const config = await loadSofraConfig(restaurant.id);
    res.json(config.managerContact);
  } catch {
    res.status(500).json({ message: 'Bilgiler yüklenemedi.' });
  }
});
publicManagerMessages.post(
  '/:slug/manager-messages',
  async (req, res, next) => {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { slug: String(req.params.slug) },
      });
      if (!restaurant)
        return res.status(404).json({ message: 'Menü bulunamadı.' });
      const config = await loadSofraConfig(restaurant.id);
      if (!config.managerContact.enabled)
        return res
          .status(403)
          .json({ message: 'Yöneticiye mesaj alanı şu an kapalı.' });
      let data: ReturnType<typeof parseManagerNote>;
      try {
        data = parseManagerNote(req.body);
      } catch (error) {
        return res.status(400).json({ message: (error as Error).message });
      }
      const now = Date.now(),
        key = restaurant.id + '|' + req.ip;
      // Bound memory and repeated anonymous submissions; never log private message bodies.
      for (const [id, times] of sends)
        if (now - times[times.length - 1] > 600000) sends.delete(id);
      const recent = (sends.get(key) || []).filter((t) => now - t < 600000);
      if (recent.length >= 5 || (sends.size >= 5000 && !sends.has(key))) {
        res.setHeader('Retry-After', '600');
        return res.status(429).json({
          message:
            'Kısa sürede birkaç not gönderdiniz. Biraz sonra yeniden deneyin.',
        });
      }
      sends.set(key, [...recent, now]);
      await prisma.managerMessage.create({
        data: { restaurantId: restaurant.id, ...data },
      });
      res.status(201).json({ ok: true });
    } catch {
      res
        .status(500)
        .json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
    }
  },
);

const router = Router();
router.use(authRequired);
router.use((req, res, next) => {
  if (req.user?.role !== 'admin' || !req.user.restaurantId)
    return res.status(403).json({
      message: 'Yönetici mesajlarını yalnızca yöneticiler görebilir.',
    });
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/', async (req, res, next) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const integer = (value: unknown, fallback: number, max: number) => {
      const n = Number(value);
      return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
    };
    const page = integer(req.query.page, 1, 100000),
      limit = integer(req.query.limit, 20, 100);
    const q = String(req.query.q || '')
      .trim()
      .slice(0, 150);
    const where: Prisma.ManagerMessageWhereInput = {
      restaurantId,
      ...(req.query.unread === 'true' ? { isRead: false } : {}),
      ...(q
        ? {
            OR: ['fullName', 'email', 'phone', 'message'].map((field) => ({
              [field]: { contains: q },
            })),
          }
        : {}),
    };
    const [data, total, unreadCount] = await Promise.all([
      prisma.managerMessage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.managerMessage.count({ where }),
      prisma.managerMessage.count({ where: { restaurantId, isRead: false } }),
    ]);
    res.json({ data, unreadCount, pagination: { page, limit, total } });
  } catch {
    res
      .status(500)
      .json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
  }
});
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      restaurantId = req.user!.restaurantId;
    if (!Number.isSafeInteger(id) || id < 1)
      return res.status(400).json({ message: 'Geçersiz mesaj.' });
    const result = await prisma.managerMessage.updateMany({
      where: { id, restaurantId },
      data: { isRead: true },
    });
    if (!result.count)
      return res.status(404).json({ message: 'Mesaj bulunamadı.' });
    res.json(
      await prisma.managerMessage.findFirst({ where: { id, restaurantId } }),
    );
  } catch {
    res
      .status(500)
      .json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
  }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id),
      restaurantId = req.user!.restaurantId;
    if (!Number.isSafeInteger(id) || id < 1)
      return res.status(400).json({ message: 'Geçersiz mesaj.' });
    const result = await prisma.managerMessage.deleteMany({
      where: { id, restaurantId },
    });
    if (!result.count)
      return res.status(404).json({ message: 'Mesaj bulunamadı.' });
    res.json({ ok: true });
  } catch {
    res
      .status(500)
      .json({ message: 'İşlem tamamlanamadı. Lütfen yeniden deneyin.' });
  }
});
export default router;
