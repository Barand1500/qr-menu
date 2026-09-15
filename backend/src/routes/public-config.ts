import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  ADMIN_PATH_KEY,
  DEFAULT_ADMIN_PATH,
  normalizeAdminPath,
} from '../lib/admin-path.js';
import { DEFAULT_SITE_TITLE, SITE_TITLE_KEY } from '../lib/site-title.js';

const router = Router();

async function firstRestaurantId() {
  const restaurant = await prisma.restaurant.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return restaurant?.id ?? null;
}

/** Auth gerekmez — SPA route kurulumu için */
router.get('/admin-path', async (_req, res) => {
  const restaurantId = await firstRestaurantId();
  if (restaurantId == null) {
    return res.json({ path: DEFAULT_ADMIN_PATH });
  }
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: ADMIN_PATH_KEY } },
  });
  res.json({ path: normalizeAdminPath(row?.value) || DEFAULT_ADMIN_PATH });
});

/** Auth gerekmez — tarayıcı sekme başlığı */
router.get('/site-title', async (_req, res) => {
  const restaurantId = await firstRestaurantId();
  if (restaurantId == null) {
    return res.json({ title: DEFAULT_SITE_TITLE });
  }
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: SITE_TITLE_KEY } },
  });
  const title = String(row?.value || '').trim() || DEFAULT_SITE_TITLE;
  res.json({ title });
});

export default router;
