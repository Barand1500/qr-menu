import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ADDON_PRODUCTS,
  getDisabledAddons,
  getOwnedAddons,
  resetOwnedAddons,
  setAddonEnabled,
  unlockAddon,
  validateUnlockCode,
} from '../addons/index.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [owned, disabled] = await Promise.all([
    getOwnedAddons(restaurantId!),
    getDisabledAddons(restaurantId!),
  ]);
  res.json({
    owned,
    disabled,
    products: ADDON_PRODUCTS.map((p) => {
      const isOwned = owned.includes(p.id);
      const enabled = isOwned && !disabled.includes(p.id);
      return {
        ...p,
        owned: isOwned,
        enabled,
      };
    }),
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
  const disabled = await getDisabledAddons(restaurantId!);
  res.json({
    ok: true,
    productId: product.id,
    owned,
    disabled,
    message: `“${product.name}” açıldı!`,
  });
});

router.patch('/:productId/enabled', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const productId = String(req.params.productId || '');
  const { enabled } = req.body as { enabled?: boolean };

  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(400).json({ message: 'Geçersiz eklenti' });
  }
  if (!product.toggleable) {
    return res.status(400).json({ message: 'Bu eklenti kapatılamaz' });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled gerekli' });
  }

  try {
    const result = await setAddonEnabled(restaurantId!, productId, enabled);
    res.json({
      ok: true,
      productId,
      enabled: result.enabled,
      disabled: result.disabled,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'OWNED_REQUIRED') {
      return res.status(403).json({ message: 'Önce eklentiyi satın alın' });
    }
    throw err;
  }
});

router.post('/reset', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await resetOwnedAddons(restaurantId!);
  res.json({
    ok: true,
    owned,
    disabled: [],
    message: 'Tüm satın alımlar geri alındı. Temalar ücretsiz varsayılana döndü.',
  });
});

export default router;
