import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';
import { getLanguages, mergeWelcomeI18n } from '../lib/i18n-json.js';
import {
  DEFAULT_MENU_THEME,
  DEFAULT_WELCOME_THEME,
  FREE_MENU_THEMES,
  FREE_WELCOME_THEMES,
} from '../lib/menu-themes.js';

const router = Router();
router.use(authRequired);

const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);

  const [restaurant, languages, currencies, settings] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId! } }),
    getLanguages(),
    prisma.currency.findMany({ orderBy: { id: 'asc' } }),
    prisma.setting.findMany({ where: { restaurantId: restaurantId! } }),
  ]);

  const welcomeMessages = languages.map((lang) => ({
    languageId: lang.id,
    languageCode: lang.code,
    message:
      (restaurant?.welcomeI18n as Record<string, { message?: string }>)?.[lang.code]?.message ||
      '',
  }));

  res.json({
    restaurant,
    languages,
    currencies,
    welcomeMessages,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  });
});

router.put('/languages', async (req, res) => {
  const { languages } = req.body as { languages: { id: number; isActive: boolean }[] };

  for (const lang of languages || []) {
    await prisma.language.update({
      where: { id: lang.id },
      data: { isActive: lang.isActive },
    });
  }

  const updated = await prisma.language.findMany({ orderBy: { id: 'asc' } });
  res.json(updated);
});

router.put('/currencies', async (req, res) => {
  const { currencies } = req.body as { currencies: { id: number; isActive: boolean }[] };

  for (const currency of currencies || []) {
    await prisma.currency.update({
      where: { id: currency.id },
      data: { isActive: currency.isActive },
    });
  }

  const updated = await prisma.currency.findMany({ orderBy: { id: 'asc' } });
  res.json(updated);
});

router.put('/welcome-messages', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { messages } = req.body as { messages: { languageId: number; message: string }[] };

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId! } });
  const languages = await getLanguages();
  const welcomeI18n = mergeWelcomeI18n(restaurant?.welcomeI18n, messages || [], languages);

  await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { welcomeI18n },
  });

  res.json({ ok: true });
});

router.put('/company', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name, about } = req.body as { name?: string; about?: string };

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { ...(name !== undefined && { name }) },
  });

  if (about !== undefined) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'company_about' } },
      update: { value: about },
      create: { restaurantId: restaurantId!, key: 'company_about', value: about },
    });
  }

  res.json(restaurant);
});

router.post('/logo', upload.single('logo'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (!req.file) return res.status(400).json({ message: 'Logo gerekli' });

  const logoUrl = `/uploads/${req.file.filename}`;
  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { logoUrl },
  });
  res.json(restaurant);
});

router.put('/integration', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { enabled, config: integrationConfig, openaiApiKey } = req.body as {
    enabled?: boolean;
    config?: unknown;
    openaiApiKey?: string;
  };

  if (enabled !== undefined) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'integration_enabled' } },
      update: { value: String(enabled) },
      create: { restaurantId: restaurantId!, key: 'integration_enabled', value: String(enabled) },
    });
  }

  if (integrationConfig !== undefined) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'integration_config' } },
      update: { value: JSON.stringify(integrationConfig) },
      create: {
        restaurantId: restaurantId!,
        key: 'integration_config',
        value: JSON.stringify(integrationConfig),
      },
    });
  }

  if (openaiApiKey !== undefined) {
    const trimmed = openaiApiKey.trim();
    if (trimmed) {
      await prisma.setting.upsert({
        where: { restaurantId_key: { restaurantId: restaurantId!, key: 'openai_api_key' } },
        update: { value: trimmed },
        create: { restaurantId: restaurantId!, key: 'openai_api_key', value: trimmed },
      });
    } else {
      await prisma.setting.deleteMany({
        where: { restaurantId: restaurantId!, key: 'openai_api_key' },
      });
    }
  }

  res.json({ ok: true });
});

router.put('/themes', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { welcome, menu } = req.body as { welcome?: string; menu?: string };

  if (welcome !== undefined) {
    if (!FREE_WELCOME_THEMES.has(welcome)) {
      return res.status(403).json({ message: 'Bu karşılama teması kilitli. Satın almanız gerekir.' });
    }
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'theme_welcome' } },
      update: { value: welcome || DEFAULT_WELCOME_THEME },
      create: {
        restaurantId: restaurantId!,
        key: 'theme_welcome',
        value: welcome || DEFAULT_WELCOME_THEME,
      },
    });
  }

  if (menu !== undefined) {
    if (!FREE_MENU_THEMES.has(menu)) {
      return res.status(403).json({ message: 'Bu menü teması kilitli. Satın almanız gerekir.' });
    }
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'theme_menu' } },
      update: { value: menu || DEFAULT_MENU_THEME },
      create: {
        restaurantId: restaurantId!,
        key: 'theme_menu',
        value: menu || DEFAULT_MENU_THEME,
      },
    });
  }

  const rows = await prisma.setting.findMany({
    where: {
      restaurantId: restaurantId!,
      key: { in: ['theme_welcome', 'theme_menu'] },
    },
  });
  const map = Object.fromEntries(rows.map((s) => [s.key, s.value]));
  res.json({
    welcome: map.theme_welcome || DEFAULT_WELCOME_THEME,
    menu: map.theme_menu || DEFAULT_MENU_THEME,
  });
});

export default router;
