import { Router } from 'express';
import { getRestaurantId } from '../lib/auth.js';
import { getMeal, mealDbKey, searchMeals } from '../lib/mealdb.js';
import {
  tinyPlatesKey,
  searchTinyRecipes,
  getTinyRecipe,
} from '../lib/tinyplates.js';
const router = Router();
const windows = new Map<number, { count: number; until: number }>();
router.use(async (req, res, next) => {
  try {
    const tenant = await getRestaurantId(req);
    if (!tenant) return res.status(403).json({ message: 'İşletme bulunamadı' });
    if (!tinyPlatesKey() && !mealDbKey())
      return res.status(503).json({
        message:
          'Ücretsiz Tiny Plates anahtarını TINYPLATES_API_KEY olarak tanımlayın.',
        code: 'RECIPE_KEY_REQUIRED',
      });
    const now = Date.now();
    for (const [key, value] of windows)
      if (value.until < now) windows.delete(key);
    const window = windows.get(tenant) || { count: 0, until: now + 60_000 };
    if (window.count >= 30)
      return res
        .status(429)
        .json({ message: 'Tarif aramasını biraz sonra tekrar deneyin.' });
    window.count++;
    windows.set(tenant, window);
    next();
  } catch (error) {
    next(error);
  }
});
router.get('/', async (req, res) => {
  const query = String(req.query.search || '').trim();
  if (query.length < 3 || query.length > 80)
    return res
      .status(400)
      .json({ message: '3–80 karakterlik ürün adı yazın.' });
  try {
    res.json({
      data: tinyPlatesKey()
        ? await searchTinyRecipes(query)
        : await searchMeals(query),
      source: tinyPlatesKey() ? 'Tiny Plates' : 'TheMealDB',
      developmentKey: !tinyPlatesKey() && mealDbKey() === '1',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_QUOTA')
      return res
        .status(429)
        .json({
          message: 'Ücretsiz tarif kotası doldu; yerel katalog kullanılabilir.',
        });
    res.status(502).json({
      message:
        'Tarif kaynağına ulaşılamıyor; kendi ürünleriniz ve başlangıç kataloğu kullanılabilir.',
    });
  }
});
router.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!/^\d{1,12}$/.test(id) && !/^tiny:[a-zA-Z0-9_-]{1,80}$/.test(id))
    return res.status(400).json({ message: 'Geçersiz tarif.' });
  try {
    if (id.startsWith('tiny:') && !tinyPlatesKey())
      return res.status(503).json({ message: 'Tiny Plates anahtarı eksik.' });
    const template = id.startsWith('tiny:')
      ? await getTinyRecipe(id.slice(5))
      : await getMeal(id);
    if (!template)
      return res.status(404).json({ message: 'Tarif bulunamadı.' });
    res.json({ template });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_QUOTA')
      return res
        .status(429)
        .json({
          message: 'Ücretsiz tarif kotası doldu; yerel katalog kullanılabilir.',
        });
    res.status(502).json({ message: 'Tarif alınamadı. Tekrar deneyin.' });
  }
});
export default router;
