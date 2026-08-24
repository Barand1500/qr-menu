import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';
import {
  buildShowcaseI18n,
  getLanguages,
  getProductField,
  mergeShowcaseI18n,
  toShowcaseTranslations,
} from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const type = req.query.type as string | undefined;
  const where: { restaurantId: number; displayType?: 'banner' | 'story' } = {
    restaurantId: restaurantId!,
  };
  if (type === 'banner' || type === 'story') {
    where.displayType = type;
  }

  const [items, languages] = await Promise.all([
    prisma.showcaseImage.findMany({
      where,
      include: { product: { include: { group: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
    getLanguages(),
  ]);
  res.json(items.map((item) => mapShowcase(item, languages)));
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name, productId, sortOrder, isActive, translations, displayType, durationSeconds } =
    req.body;

  const itemType = displayType === 'story' ? ('story' as const) : ('banner' as const);

  const [maxOrder, languages] = await Promise.all([
    prisma.showcaseImage.aggregate({
      where: { restaurantId: restaurantId!, displayType: itemType },
      _max: { sortOrder: true },
    }),
    getLanguages(),
  ]);

  const item = await prisma.showcaseImage.create({
    data: {
      restaurantId: restaurantId!,
      name: name || (itemType === 'story' ? 'Hikaye' : 'Vitrin Görseli'),
      productId: productId ? Number(productId) : null,
      displayType: itemType,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: isActive ?? true,
      durationSeconds: clampDuration(durationSeconds, itemType),
      i18n: buildShowcaseI18n(translations || [], languages),
    },
    include: { product: { include: { group: true } } },
  });
  res.status(201).json(mapShowcase(item, languages));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { name, productId, sortOrder, isActive, imageUrl, translations, displayType, durationSeconds } =
    req.body;

  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const languages = await getLanguages();
  const i18n =
    translations?.length > 0
      ? mergeShowcaseI18n(existing.i18n, translations, languages)
      : undefined;

  const item = await prisma.showcaseImage.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(productId !== undefined && { productId: productId ? Number(productId) : null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(displayType !== undefined && {
        displayType: displayType === 'story' ? 'story' : 'banner',
      }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(durationSeconds !== undefined && {
        durationSeconds: clampDuration(durationSeconds, existing.displayType),
      }),
      ...(i18n !== undefined && { i18n }),
    },
    include: { product: { include: { group: true } } },
  });
  res.json(mapShowcase(item, languages));
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const [item, languages] = await Promise.all([
    prisma.showcaseImage.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { product: { include: { group: true } } },
    }),
    getLanguages(),
  ]);
  res.json(mapShowcase(item, languages));
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });
  if (!req.file) return res.status(400).json({ message: 'Görsel gerekli' });

  const imageUrl = `/uploads/${req.file.filename}`;
  const [item, languages] = await Promise.all([
    prisma.showcaseImage.update({
      where: { id },
      data: { imageUrl },
      include: { product: { include: { group: true } } },
    }),
    getLanguages(),
  ]);
  res.json(mapShowcase(item, languages));
});

router.put('/reorder/bulk', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { items } = req.body as { items: { id: number; sortOrder: number }[] };

  for (const item of items || []) {
    await prisma.showcaseImage.updateMany({
      where: { id: item.id, restaurantId: restaurantId! },
      data: { sortOrder: item.sortOrder },
    });
  }

  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  await prisma.showcaseImage.delete({ where: { id } });
  res.json({ ok: true });
});

function clampDuration(value: unknown, displayType: 'banner' | 'story') {
  if (displayType !== 'story') return 5;
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(30, Math.max(2, Math.round(n)));
}

function mapShowcase(
  item: {
    id: number;
    name: string;
    productId: number | null;
    imageUrl: string | null;
    displayType: 'banner' | 'story';
    sortOrder: number;
    isActive: boolean;
    durationSeconds: number;
    i18n: unknown;
    product?: { i18n: unknown } | null;
  },
  languages: { id: number; code: string }[]
) {
  return {
    id: item.id,
    name: item.name,
    productId: item.productId,
    productName: item.product ? getProductField(item.product.i18n, 'tr', 'name') : null,
    imageUrl: item.imageUrl,
    displayType: item.displayType,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    durationSeconds: item.durationSeconds,
    translations: toShowcaseTranslations(item.i18n, languages),
  };
}

export default router;
