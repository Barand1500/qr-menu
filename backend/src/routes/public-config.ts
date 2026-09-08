import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  ADMIN_PATH_KEY,
  DEFAULT_ADMIN_PATH,
  normalizeAdminPath,
} from '../lib/admin-path.js';

const router = Router();

/** Auth gerekmez — SPA route kurulumu için */
router.get('/admin-path', async (_req, res) => {
  const restaurant = await prisma.restaurant.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!restaurant) {
    return res.json({ path: DEFAULT_ADMIN_PATH });
  }
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurant.id, key: ADMIN_PATH_KEY } },
  });
  res.json({ path: normalizeAdminPath(row?.value) || DEFAULT_ADMIN_PATH });
});

export default router;
