import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  SOFRA_SETTINGS_KEY,
  normalizeSofraConfig,
  parseSofraConfig,
  withLegacyWelcome,
} from '../lib/sofra-config.js';

const router = Router();
router.use(authRequired);
router.use((req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Tema düzenlemek için yönetici yetkisi gerekli.' });
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.get('/', async (req, res, next) => {
  try {
    const restaurantId = (await getRestaurantId(req))!;
    const [row, restaurant, languages, groups, products] = await Promise.all([
      prisma.setting.findUnique({
        where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
      }),
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { name: true, logoUrl: true, welcomeI18n: true },
      }),
      prisma.language.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
        orderBy: { id: 'asc' },
      }),
      prisma.group.findMany({
        where: { restaurantId, isActive: true, parentId: null },
        select: { id: true, i18n: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      }),
      prisma.product.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, groupId: true, i18n: true, price: true, imageUrl: true },
        orderBy: { sortOrder: 'asc' },
        take: 6,
      }),
    ]);
    res.json({
      config: withLegacyWelcome(parseSofraConfig(row?.value), restaurant?.welcomeI18n),
      revision: row?.value || '',
      restaurant: restaurant ? { name: restaurant.name, logoUrl: restaurant.logoUrl } : null,
      languages,
      groups,
      products,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const restaurantId = (await getRestaurantId(req))!;
    if (
      !req.body.config ||
      typeof req.body.config !== 'object' ||
      Array.isArray(req.body.config) ||
      typeof req.body.revision !== 'string'
    ) {
      return res.status(400).json({ message: 'Geçersiz tema verisi.' });
    }
    const theme = normalizeSofraConfig(req.body.config);
    if (
      Object.values(theme.texts).some(
        (copy) => copy.enterLabel !== undefined && !copy.enterLabel.trim()
      )
    ) {
      return res.status(400).json({ message: 'Menüye giriş düğmesinin yazısı boş bırakılamaz.' });
    }
    const value = JSON.stringify(theme);
    if (Buffer.byteLength(value, 'utf8') > 50000)
      return res.status(400).json({ message: 'Tema metinleri çok uzun.' });
    const key = { restaurantId, key: SOFRA_SETTINGS_KEY };
    const current = await prisma.setting.findUnique({ where: { restaurantId_key: key } });
    if ((current?.value || '') !== req.body.revision)
      return res.status(409).json({
        message: 'Tema başka bir oturumda değiştirildi. Taslağınızı kopyalayıp sayfayı yenileyin.',
      });
    if (current) {
      const result = await prisma.setting.updateMany({
        where: { ...key, value: current.value },
        data: { value },
      });
      if (!result.count)
        return res.status(409).json({ message: 'Tema değişti. Sayfayı yenileyip tekrar deneyin.' });
    } else {
      await prisma.setting.create({ data: { ...key, value } });
    }
    res.json({ config: theme, revision: value });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002')
      return res
        .status(409)
        .json({ message: 'Tema başka bir oturumda kaydedildi. Sayfayı yenileyin.' });
    next(err);
  }
});

router.post('/image', (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: 'Görsel en fazla 5 MB olabilir.' });
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Görsel gerekli.' });
    const bytes = file.buffer;
    const ext = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? 'jpg'
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
          ? 'webp'
          : null;
    if (!ext) return res.status(400).json({ message: 'PNG, JPG veya WebP görsel seçin.' });
    try {
      const name = `sofra-${randomUUID()}.${ext}`;
      await fs.mkdir(path.resolve(config.uploadDir), { recursive: true });
      await fs.writeFile(path.join(path.resolve(config.uploadDir), name), bytes);
      res.json({ imageUrl: `/uploads/${name}` });
    } catch (error) {
      next(error);
    }
  });
});
export default router;
