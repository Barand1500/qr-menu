import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId, validateProduct } from '../lib/auth.js';
import { config } from '../config.js';
import {
  applyAllergenTagsToI18n,
  buildProductI18n,
  getGroupName,
  getLanguages,
  getProductField,
  mergeProductI18n,
  textMatchesI18n,
  toProductTranslations,
} from '../lib/i18n-json.js';
import { imagesPayload, parseProductImages } from '../lib/product-images.js';
import { ensureDefaultCurrency } from '../lib/currencies.js';
import {
  allergensTextFromTags,
  parseAllergenTags,
  sanitizeAllergenTags,
} from '../lib/diet-allergens.js';

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
  const limitNum = Math.min(500, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { restaurantId };
  if (groupId) where.groupId = Number(groupId);
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const [products, languages, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { group: true, currency: true },
      orderBy: { sortOrder: 'asc' },
      skip,
      take: limitNum,
    }),
    getLanguages(),
    prisma.product.count({ where }),
  ]);

  let filtered = products;
  if (search) {
    const q = String(search).toLowerCase();
    filtered = products.filter((p) => textMatchesI18n(p.i18n, 'tr', ['name'], q));
  }

  const mapped = await Promise.all(filtered.map((p) => mapProduct(p, restaurantId!, languages)));
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
  const [product, languages] = await Promise.all([
    prisma.product.findFirst({
      where: { id: Number(req.params.id), restaurantId: restaurantId! },
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });
  res.json(await mapProduct(product, restaurantId!, languages));
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const {
    groupId,
    price,
    currencyId,
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
    allergenTags,
  } = req.body;

  const group = await prisma.group.findFirst({
    where: { id: Number(groupId), restaurantId: restaurantId! },
  });
  if (!group) return res.status(400).json({ message: 'Geçersiz grup' });

  let resolvedCurrencyId: number | null = null;
  if (currencyId != null && currencyId !== '') {
    const currency = await prisma.currency.findFirst({
      where: { id: Number(currencyId), isActive: true },
    });
    if (!currency) return res.status(400).json({ message: 'Geçersiz para birimi' });
    resolvedCurrencyId = currency.id;
  } else {
    const fallback = await ensureDefaultCurrency();
    resolvedCurrencyId = fallback.id;
  }

  const [maxOrder, languages] = await Promise.all([
    prisma.product.aggregate({
      where: { groupId: Number(groupId) },
      _max: { sortOrder: true },
    }),
    getLanguages(),
  ]);

  const tags = sanitizeAllergenTags(allergenTags);
  let i18n = buildProductI18n(translations || [], languages);
  i18n = applyAllergenTagsToI18n(i18n, tags, languages, (lang) =>
    allergensTextFromTags(tags, lang)
  );

  const product = await prisma.product.create({
    data: {
      restaurantId: restaurantId!,
      groupId: Number(groupId),
      currencyId: resolvedCurrencyId,
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
      allergenTags: tags,
      i18n,
    },
    include: { group: true, currency: true },
  });

  res.status(201).json(await mapProduct(product, restaurantId!, languages));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const {
    groupId,
    price,
    currencyId,
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
    allergenTags,
  } = req.body;

  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  if (currencyId !== undefined && currencyId != null && currencyId !== '') {
    const currency = await prisma.currency.findFirst({
      where: { id: Number(currencyId), isActive: true },
    });
    if (!currency) return res.status(400).json({ message: 'Geçersiz para birimi' });
  }

  const languages = await getLanguages();
  let i18n =
    translations?.length > 0
      ? mergeProductI18n(existing.i18n, translations, languages)
      : undefined;

  const tags =
    allergenTags !== undefined
      ? sanitizeAllergenTags(allergenTags)
      : parseAllergenTags(existing.allergenTags);

  if (allergenTags !== undefined || translations?.length > 0) {
    i18n = applyAllergenTagsToI18n(i18n ?? existing.i18n, tags, languages, (lang) =>
      allergensTextFromTags(tags, lang)
    );
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(groupId !== undefined && { groupId: Number(groupId) }),
      ...(price !== undefined && { price }),
      ...(currencyId !== undefined && {
        currencyId:
          currencyId == null || currencyId === '' ? null : Number(currencyId),
      }),
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
      ...(allergenTags !== undefined && { allergenTags: tags }),
      ...(i18n !== undefined && { i18n }),
    },
    include: { group: true, currency: true },
  });

  res.json(await mapProduct(product, restaurantId!, languages));
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const [product, languages] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  res.json(await mapProduct(product, restaurantId!, languages));
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

  const newUrl = `/uploads/${req.file.filename}`;
  const images = [...parseProductImages(existing), newUrl];
  const [product, languages] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: imagesPayload(images),
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  res.json(await mapProduct(product, restaurantId!, languages));
});

router.post('/:id/images', upload.array('images', 12), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });
  if (!req.files?.length) return res.status(400).json({ message: 'Görsel gerekli' });

  const newUrls = (req.files as Express.Multer.File[]).map((f) => `/uploads/${f.filename}`);
  const images = [...parseProductImages(existing), ...newUrls];
  const [product, languages] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: imagesPayload(images),
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  res.json(await mapProduct(product, restaurantId!, languages));
});

router.delete('/:id/images', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ message: 'Silinecek görsel URL gerekli' });

  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const images = parseProductImages(existing).filter((u) => u !== url);
  const [product, languages] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: imagesPayload(images),
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  res.json(await mapProduct(product, restaurantId!, languages));
});

router.put('/:id/images/reorder', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { images } = req.body as { images?: string[] };

  const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const current = parseProductImages(existing);
  const ordered =
    Array.isArray(images) && images.length > 0
      ? images.filter((u) => current.includes(u))
      : current;

  const [product, languages] = await Promise.all([
    prisma.product.update({
      where: { id },
      data: imagesPayload(ordered),
      include: { group: true, currency: true },
    }),
    getLanguages(),
  ]);
  res.json(await mapProduct(product, restaurantId!, languages));
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
    currencyId?: number | null;
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
    images: unknown;
    allergenTags?: unknown;
    sortOrder: number;
    isActive: boolean;
    i18n: unknown;
    group: { i18n: unknown };
    currency?: {
      id: number;
      code: string;
      name: string;
      symbol: string;
    } | null;
  },
  restaurantId: number,
  languages: { id: number; code: string }[]
) {
  const validation = await validateProduct(product.id, restaurantId);
  const images = parseProductImages(product);
  const currency = product.currency
    ? {
        id: product.currency.id,
        code: product.currency.code,
        name: product.currency.name,
        symbol: product.currency.symbol,
      }
    : { id: null as number | null, code: 'TRY', name: 'Türk Lirası', symbol: '₺' };

  return {
    id: product.id,
    name: getProductField(product.i18n, 'tr', 'name'),
    groupId: product.groupId,
    groupName: getGroupName(product.group.i18n),
    price: Number(product.price),
    currencyId: product.currencyId ?? currency.id,
    currency,
    prepTimeMinutes: product.prepTimeMinutes,
    calories: product.calories,
    features: resolveFeatures(product),
    isVegan: product.isVegan,
    isVegetarian: product.isVegetarian,
    isGlutenFree: product.isGlutenFree,
    isDiabetic: product.isDiabetic,
    allergenTags: parseAllergenTags(product.allergenTags),
    isRecommended: product.isRecommended,
    imageUrl: images[0] ?? null,
    images,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
    isValid: validation.valid,
    validationIssues: validation.issues,
    translations: toProductTranslations(product.i18n, languages),
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
