import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { translateText } from '../lib/translate-service.js';

const router = Router();
router.use(authRequired);

router.get('/status', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const openaiSetting = restaurantId
    ? await prisma.setting.findUnique({
        where: {
          restaurantId_key: { restaurantId, key: 'openai_api_key' },
        },
      })
    : null;

  const openaiConfigured = Boolean(openaiSetting?.value?.trim());
  res.json({
    openaiConfigured,
    freeFallback: true,
    engines: openaiConfigured
      ? ['openai', 'mymemory', 'libretranslate']
      : ['mymemory', 'libretranslate'],
  });
});

router.post('/', async (req, res) => {
  const { text, from = 'tr', to = 'en' } = req.body as {
    text?: string;
    from?: string;
    to?: string;
  };

  const sourceBase = String(from).toLowerCase().split('-')[0];
  const targetBase = String(to).toLowerCase().split('-')[0];

  if (!text?.trim()) {
    return res.status(400).json({ message: 'Çevrilecek metin gerekli' });
  }

  if (sourceBase === targetBase) {
    return res.json({ text: text.trim() });
  }

  try {
    const restaurantId = await getRestaurantId(req);
    const openaiSetting = restaurantId
      ? await prisma.setting.findUnique({
          where: {
            restaurantId_key: { restaurantId, key: 'openai_api_key' },
          },
        })
      : null;

    const translated = await translateText(
      text,
      from,
      to,
      openaiSetting?.value
    );

    if (!translated) {
      return res.status(502).json({ message: 'Çeviri alınamadı' });
    }
    res.json({ text: translated });
  } catch {
    res.status(502).json({ message: 'Çeviri servisine ulaşılamadı' });
  }
});

export default router;
