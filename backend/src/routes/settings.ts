import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';

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

  const [restaurant, languages, welcomeMessages, settings] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId! } }),
    prisma.language.findMany({ orderBy: { id: 'asc' } }),
    prisma.welcomeMessage.findMany({
      where: { restaurantId: restaurantId! },
      include: { language: true },
    }),
    prisma.setting.findMany({ where: { restaurantId: restaurantId! } }),
  ]);

  res.json({
    restaurant,
    languages,
    welcomeMessages: welcomeMessages.map((w) => ({
      languageId: w.languageId,
      languageCode: w.language.code,
      message: w.message,
    })),
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

router.put('/welcome-messages', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { messages } = req.body as { messages: { languageId: number; message: string }[] };

  for (const msg of messages || []) {
    await prisma.welcomeMessage.upsert({
      where: {
        restaurantId_languageId: {
          restaurantId: restaurantId!,
          languageId: msg.languageId,
        },
      },
      update: { message: msg.message },
      create: {
        restaurantId: restaurantId!,
        languageId: msg.languageId,
        message: msg.message,
      },
    });
  }

  res.json({ ok: true });
});

router.put('/company', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name } = req.body;

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { ...(name !== undefined && { name }) },
  });
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
  const { enabled, config: integrationConfig } = req.body;

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: 'integration_enabled' } },
    update: { value: String(enabled) },
    create: { restaurantId: restaurantId!, key: 'integration_enabled', value: String(enabled) },
  });

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

  res.json({ ok: true });
});

export default router;
