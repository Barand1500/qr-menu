import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ADDON_PRODUCTS,
  getOwnedAddons,
  unlockAddon,
  validateUnlockCode,
} from '../lib/addons.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await getOwnedAddons(restaurantId!);
  res.json({
    owned,
    products: ADDON_PRODUCTS.map((p) => ({
      ...p,
      owned: owned.includes(p.id),
    })),
  });
});

router.post('/unlock', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { productId, code } = req.body as { productId?: string; code?: string };

  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(400).json({ message: 'Geçersiz eklenti' });
  }

  if (!validateUnlockCode(product.id, String(code || ''))) {
    return res.status(400).json({ message: 'Kod hatalı' });
  }

  const owned = await unlockAddon(restaurantId!, product.id);
  res.json({
    ok: true,
    productId: product.id,
    owned,
    message: `“${product.name}” açıldı!`,
  });
});

export default router;
