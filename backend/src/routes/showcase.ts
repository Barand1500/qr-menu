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
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const items = await prisma.showcaseImage.findMany({
    where: { restaurantId: restaurantId! },
    include: {
      translations: { include: { language: true } },
      product: { include: { translations: { include: { language: true } } } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(items.map(mapShowcase));
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name, productId, sortOrder, isActive, translations } = req.body;

  const maxOrder = await prisma.showcaseImage.aggregate({
    where: { restaurantId: restaurantId! },
    _max: { sortOrder: true },
  });

  const item = await prisma.showcaseImage.create({
    data: {
      restaurantId: restaurantId!,
      name: name || 'Vitrin Görseli',
      productId: productId ? Number(productId) : null,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: isActive ?? true,
      translations: {
        create: (translations || []).map(
          (t: { languageId: number; title1?: string; title2?: string }) => ({
            languageId: t.languageId,
            title1: t.title1 || null,
            title2: t.title2 || null,
          })
        ),
      },
    },
    include: {
      translations: { include: { language: true } },
      product: { include: { translations: { include: { language: true } } } },
    },
  });
  res.status(201).json(mapShowcase(item));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { name, productId, sortOrder, isActive, imageUrl, translations } = req.body;

  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  if (translations?.length) {
    for (const t of translations as { languageId: number; title1?: string; title2?: string }[]) {
      await prisma.showcaseTranslation.upsert({
        where: { showcaseId_languageId: { showcaseId: id, languageId: t.languageId } },
        update: { title1: t.title1 || null, title2: t.title2 || null },
        create: {
          showcaseId: id,
          languageId: t.languageId,
          title1: t.title1 || null,
          title2: t.title2 || null,
        },
      });
    }
  }

  const item = await prisma.showcaseImage.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(productId !== undefined && { productId: productId ? Number(productId) : null }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(imageUrl !== undefined && { imageUrl }),
    },
    include: {
      translations: { include: { language: true } },
      product: { include: { translations: { include: { language: true } } } },
    },
  });
  res.json(mapShowcase(item));
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const item = await prisma.showcaseImage.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: {
      translations: { include: { language: true } },
      product: { include: { translations: { include: { language: true } } } },
    },
  });
  res.json(mapShowcase(item));
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
  const item = await prisma.showcaseImage.update({
    where: { id },
    data: { imageUrl },
    include: {
      translations: { include: { language: true } },
      product: { include: { translations: { include: { language: true } } } },
    },
  });
  res.json(mapShowcase(item));
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

function mapShowcase(item: {
  id: number;
  name: string;
  productId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: {
    languageId: number;
    title1: string | null;
    title2: string | null;
    language: { code: string };
  }[];
  product?: {
    translations: { language: { code: string }; name: string }[];
  } | null;
}) {
  const productTr = item.product?.translations.find((t) => t.language.code === 'tr');
  return {
    id: item.id,
    name: item.name,
    productId: item.productId,
    productName: productTr?.name || item.product?.translations[0]?.name || null,
    imageUrl: item.imageUrl,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    translations: item.translations.map((t) => ({
      languageId: t.languageId,
      languageCode: t.language.code,
      title1: t.title1,
      title2: t.title2,
    })),
  };
}

export default router;
