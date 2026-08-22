import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId, validateProduct } from '../lib/auth.js';
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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { search, groupId, active, page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { restaurantId };
  if (groupId) where.groupId = Number(groupId);
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const products = await prisma.product.findMany({
    where,
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
    orderBy: { sortOrder: 'asc' },
    skip,
    take: limitNum,
  });

  let filtered = products;
  if (search) {
    const q = String(search).toLowerCase();
    filtered = products.filter((p) =>
      p.translations.some((t) => t.name.toLowerCase().includes(q))
    );
  }

  const total = await prisma.product.count({ where });
  const mapped = await Promise.all(filtered.map((p) => mapProduct(p, restaurantId!)));

  res.json({
    data: mapped,
    pagination: { page: pageNum, limit: limitNum, total },
  });
});

router.get('/stats/validation', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const products = await prisma.product.findMany({
    where: { restaurantId: restaurantId! },
    select: { id: true },
  });

  let valid = 0;
  let invalid = 0;
  for (const p of products) {
    const result = await validateProduct(p.id, restaurantId!);
    if (result.valid) valid++;
    else invalid++;
  }

  res.json({ valid, invalid, total: products.length });
});

router.get('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const product = await prisma.product.findFirst({
    where: { id: Number(req.params.id), restaurantId: restaurantId! },
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });
  res.json(await mapProduct(product, restaurantId!));
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const {
    groupId,
    price,
    translations,
    sortOrder,
    isActive,
    prepTimeMinutes,
    calories,
    isVegan,
    isVegetarian,
    isGlutenFree,
    isDiabetic,
    isRecommended,
    features,
  } = req.body;

  const group = await prisma.group.findFirst({
    where: { id: Number(groupId), restaurantId: restaurantId! },
  });
  if (!group) return res.status(400).json({ message: 'Geçersiz grup' });

  const maxOrder = await prisma.product.aggregate({
    where: { groupId: Number(groupId) },
    _max: { sortOrder: true },
  });

  const product = await prisma.product.create({
    data: {
      restaurantId: restaurantId!,
      groupId: Number(groupId),
      price: price ?? 0,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: isActive ?? true,
      prepTimeMinutes: prepTimeMinutes != null ? Number(prepTimeMinutes) : null,
      calories: calories != null ? Number(calories) : null,
      isVegan: isVegan ?? false,
      isVegetarian: isVegetarian ?? false,
      isGlutenFree: isGlutenFree ?? false,
      isDiabetic: isDiabetic ?? false,
      isRecommended: isRecommended ?? false,
      features: Array.isArray(features) ? features : [],
      translations: {
        create: (translations || []).map(
          (t: {
            languageId: number;
            name: string;
            description?: string;
            ingredients?: string;
            allergens?: string;
          }) => ({
            languageId: t.languageId,
            name: t.name,
            description: t.description,
            ingredients: t.ingredients,
            allergens: t.allergens,
          })
        ),
      },
    },
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
  });

  res.status(201).json(await mapProduct(product, restaurantId!));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const {
    groupId,
    price,
    translations,
    sortOrder,
    isActive,
    imageUrl,
    prepTimeMinutes,
    calories,
    isVegan,
    isVegetarian,
    isGlutenFree,
    isDiabetic,
    isRecommended,
    features,
  } = req.body;

  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  if (translations?.length) {
    for (const t of translations as {
      languageId: number;
      name: string;
      description?: string;
      ingredients?: string;
      allergens?: string;
    }[]) {
      await prisma.productTranslation.upsert({
        where: { productId_languageId: { productId: id, languageId: t.languageId } },
        update: {
          name: t.name,
          description: t.description,
          ingredients: t.ingredients,
          allergens: t.allergens,
        },
        create: {
          productId: id,
          languageId: t.languageId,
          name: t.name,
          description: t.description,
          ingredients: t.ingredients,
          allergens: t.allergens,
        },
      });
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(groupId !== undefined && { groupId: Number(groupId) }),
      ...(price !== undefined && { price }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(prepTimeMinutes !== undefined && {
        prepTimeMinutes: prepTimeMinutes != null ? Number(prepTimeMinutes) : null,
      }),
      ...(calories !== undefined && {
        calories: calories != null ? Number(calories) : null,
      }),
      ...(isVegan !== undefined && { isVegan }),
      ...(isVegetarian !== undefined && { isVegetarian }),
      ...(isGlutenFree !== undefined && { isGlutenFree }),
      ...(isDiabetic !== undefined && { isDiabetic }),
      ...(isRecommended !== undefined && { isRecommended }),
      ...(features !== undefined && { features: Array.isArray(features) ? features : [] }),
    },
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
  });

  res.json(await mapProduct(product, restaurantId!));
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const product = await prisma.product.update({
    where: { id },
    data: { isActive: !existing.isActive },
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
  });
  res.json(await mapProduct(product, restaurantId!));
});

router.put('/reorder/bulk', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { items } = req.body as { items: { id: number; sortOrder: number }[] };

  for (const item of items || []) {
    await prisma.product.updateMany({
      where: { id: item.id, restaurantId: restaurantId! },
      data: { sortOrder: item.sortOrder },
    });
  }

  res.json({ ok: true });
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });
  if (!req.file) return res.status(400).json({ message: 'Görsel gerekli' });

  const imageUrl = `/uploads/${req.file.filename}`;
  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl },
    include: {
      translations: { include: { language: true } },
      group: { include: { translations: { include: { language: true } } } },
    },
  });
  res.json(await mapProduct(product, restaurantId!));
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  await prisma.product.delete({ where: { id } });
  res.json({ ok: true });
});

async function mapProduct(
  product: {
    id: number;
    groupId: number;
    price: unknown;
    prepTimeMinutes: number | null;
    calories: number | null;
    features: unknown;
    isVegan: boolean;
    isVegetarian: boolean;
    isGlutenFree: boolean;
    isDiabetic: boolean;
    isRecommended: boolean;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
    translations: {
      languageId: number;
      name: string;
      description: string | null;
      ingredients: string | null;
      allergens: string | null;
      language: { code: string };
    }[];
    group: {
      translations: { language: { code: string }; name: string }[];
    };
  },
  restaurantId: number
) {
  const tr = product.translations.find((t) => t.language.code === 'tr');
  const groupTr = product.group.translations.find((t) => t.language.code === 'tr');
  const validation = await validateProduct(product.id, restaurantId);

  return {
    id: product.id,
    name: tr?.name || product.translations[0]?.name || '',
    groupId: product.groupId,
    groupName: groupTr?.name || product.group.translations[0]?.name || '',
    price: Number(product.price),
    prepTimeMinutes: product.prepTimeMinutes,
    calories: product.calories,
    features: resolveFeatures(product),
    isRecommended: product.isRecommended,
    imageUrl: product.imageUrl,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
    isValid: validation.valid,
    validationIssues: validation.issues,
    translations: product.translations.map((t) => ({
      languageId: t.languageId,
      languageCode: t.language.code,
      name: t.name,
      description: t.description,
      ingredients: t.ingredients,
      allergens: t.allergens,
    })),
  };
}

function resolveFeatures(product: {
  features: unknown;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
}): string[] {
  if (Array.isArray(product.features) && product.features.length > 0) {
    return product.features.filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
  }
  const legacy: string[] = [];
  if (product.isVegan) legacy.push('Vegan');
  if (product.isVegetarian) legacy.push('Vejeteryan');
  if (product.isGlutenFree) legacy.push('Glutensiz');
  if (product.isDiabetic) legacy.push('Diyabetik');
  return legacy;
}

export default router;
