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
  allergensTextFromCatalog,
  loadPrefCatalog,
  parseDietTags,
  sanitizeAllergenTagsForCatalog,
  sanitizeDietTagsForCatalog,
} from '../lib/pref-catalog.js';
import {
  normalizeOptionGroups,
  optionGroupsSummary,
} from '../lib/product-options.js';
import {
  BULK_PRICE_SNAPSHOT_KEY,
  parseBulkSnapshot,
  transformOptionGroups,
  transformUnitPrice,
  type BulkOptionsAction,
  type BulkPriceParams,
  type BulkPriceRounding,
  type BulkPriceSnapshot,
  type BulkSnapshotItem,
} from '../lib/bulk-price.js';

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

router.get('/bulk-price/status', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: BULK_PRICE_SNAPSHOT_KEY },
    },
  });
  const snapshot = parseBulkSnapshot(row?.value);
  res.json({
    hasSnapshot: Boolean(snapshot),
    appliedAt: snapshot?.appliedAt ?? null,
    count: snapshot?.items.length ?? 0,
  });
});

router.post('/bulk-price/preview', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body || {};
  const params = parseBulkParams(body);
  if (!params) {
    return res.status(400).json({ message: 'Geçersiz fiyat parametreleri' });
  }

  const products = await loadBulkTargetProducts(restaurantId!, body);
  if (!products.length) {
    return res.status(400).json({ message: 'Güncellenecek ürün bulunamadı' });
  }

  const languages = await getLanguages();
  const withOptions = products.filter((p) => normalizeOptionGroups(p.optionGroups).some((g) => g.options.length > 0));
  const lines = products.map((p) => {
    const base = transformUnitPrice(Number(p.price), params);
    const opt =
      params.optionsAction === 'base_and_options'
        ? transformOptionGroups(p.optionGroups, params)
        : { groups: normalizeOptionGroups(p.optionGroups), skippedOptions: 0, changed: false };
    return {
      id: p.id,
      name: getProductField(p.i18n, 'tr', 'name'),
      groupName: getGroupName(p.group.i18n),
      currency: p.currency
        ? { code: p.currency.code, symbol: p.currency.symbol }
        : { code: 'TRY', symbol: '₺' },
      oldPrice: Number(p.price),
      newPrice: base.skipped ? Number(p.price) : base.next,
      skipped: base.skipped,
      skipReason: base.reason || null,
      hasOptions: normalizeOptionGroups(p.optionGroups).some((g) => g.options.length > 0),
      optionsChanged: opt.changed,
      optionsSkipped: opt.skippedOptions,
    };
  });

  const applyCount = lines.filter((l) => !l.skipped && Math.abs(l.newPrice - l.oldPrice) > 0.001).length;
  const warnCount = lines.filter((l) => l.skipped).length;

  res.json({
    params,
    withOptionsCount: withOptions.length,
    applyCount,
    warnCount,
    lines,
    sampleNames: lines.slice(0, 3).map((l) => l.name),
    languagesCount: languages.length,
  });
});

router.post('/bulk-price/apply', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body || {};
  const params = parseBulkParams(body);
  if (!params) {
    return res.status(400).json({ message: 'Geçersiz fiyat parametreleri' });
  }

  const products = await loadBulkTargetProducts(restaurantId!, body);
  if (!products.length) {
    return res.status(400).json({ message: 'Güncellenecek ürün bulunamadı' });
  }

  const snapshotItems: BulkSnapshotItem[] = [];
  const updates: { id: number; price: number; previousPrice: number; optionGroups?: unknown }[] = [];
  const skipped: { id: number; name: string; reason: string }[] = [];

  for (const p of products) {
    const oldPrice = Number(p.price);
    const base = transformUnitPrice(oldPrice, params);
    if (base.skipped) {
      skipped.push({
        id: p.id,
        name: getProductField(p.i18n, 'tr', 'name'),
        reason: 'İndirim sonrası fiyat 0’ın altına düşer — atlandı',
      });
      continue;
    }

    snapshotItems.push({
      productId: p.id,
      price: oldPrice,
      optionGroups: normalizeOptionGroups(p.optionGroups),
    });

    const next: { id: number; price: number; previousPrice: number; optionGroups?: unknown } = {
      id: p.id,
      price: base.next,
      previousPrice: oldPrice,
    };

    if (params.optionsAction === 'base_and_options') {
      const opt = transformOptionGroups(p.optionGroups, params);
      next.optionGroups = opt.groups;
    }

    if (Math.abs(base.next - oldPrice) > 0.001 || next.optionGroups) {
      updates.push(next);
    }
  }

  if (!updates.length) {
    return res.status(400).json({
      message: 'Uygulanacak fiyat değişikliği yok',
      skipped,
    });
  }

  const appliedAt = new Date().toISOString();
  const snapshot: BulkPriceSnapshot = { appliedAt, params, items: snapshotItems };

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: BULK_PRICE_SNAPSHOT_KEY },
      },
      update: { value: JSON.stringify(snapshot) },
      create: {
        restaurantId: restaurantId!,
        key: BULK_PRICE_SNAPSHOT_KEY,
        value: JSON.stringify(snapshot),
      },
    });

    for (const u of updates) {
      await tx.product.update({
        where: { id: u.id },
        data: {
          price: u.price,
          previousPrice: u.previousPrice,
          previousPriceAt: new Date(appliedAt),
          ...(u.optionGroups ? { optionGroups: u.optionGroups } : {}),
        },
      });
    }
  });

  res.json({
    ok: true,
    appliedAt,
    orderIds: updates.map((u) => u.id),
    updates: updates.map((u) => ({
      id: u.id,
      price: u.price,
      previousPrice: u.previousPrice,
      previousPriceAt: appliedAt,
    })),
    skipped,
  });
});

router.post('/bulk-price/restore', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: BULK_PRICE_SNAPSHOT_KEY },
    },
  });
  const snapshot = parseBulkSnapshot(row?.value);
  if (!snapshot) {
    return res.status(400).json({ message: 'Geri alınacak toplu fiyat kaydı yok' });
  }

  const orderIds: number[] = [];
  const updates: { id: number; price: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of snapshot.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, restaurantId: restaurantId! },
        select: { id: true },
      });
      if (!product) continue;
      await tx.product.update({
        where: { id: product.id },
        data: {
          price: item.price,
          optionGroups: item.optionGroups,
          previousPrice: null,
          previousPriceAt: null,
        },
      });
      orderIds.push(product.id);
      updates.push({ id: product.id, price: item.price });
    }

    await tx.setting.deleteMany({
      where: { restaurantId: restaurantId!, key: BULK_PRICE_SNAPSHOT_KEY },
    });
  });

  res.json({
    ok: true,
    restoredAt: snapshot.appliedAt,
    orderIds,
    updates,
  });
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

router.put('/:id/option-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const product = await prisma.product.findFirst({
    where: { id, restaurantId: restaurantId! },
    include: { group: true, currency: true },
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const groups = normalizeOptionGroups(req.body?.groups ?? req.body?.optionGroups ?? req.body);
  const updated = await prisma.product.update({
    where: { id: product.id },
    data: { optionGroups: groups },
    include: { group: true, currency: true },
  });
  const languages = await getLanguages();
  res.json(await mapProduct(updated, restaurantId!, languages));
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
    dietTags,
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

  const [maxOrder, languages, catalog] = await Promise.all([
    prisma.product.aggregate({
      where: { groupId: Number(groupId) },
      _max: { sortOrder: true },
    }),
    getLanguages(),
    loadPrefCatalog(restaurantId!),
  ]);

  const tags = sanitizeAllergenTagsForCatalog(allergenTags, catalog);
  const customDietTags = sanitizeDietTagsForCatalog(dietTags, catalog);
  let i18n = buildProductI18n(translations || [], languages);
  i18n = applyAllergenTagsToI18n(i18n, tags, languages, (lang) =>
    allergensTextFromCatalog(tags, lang, catalog)
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
      dietTags: customDietTags,
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
    dietTags,
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
  const catalog = await loadPrefCatalog(restaurantId!);
  let i18n =
    translations?.length > 0
      ? mergeProductI18n(existing.i18n, translations, languages)
      : undefined;

  const tags =
    allergenTags !== undefined
      ? sanitizeAllergenTagsForCatalog(allergenTags, catalog)
      : sanitizeAllergenTagsForCatalog(existing.allergenTags, catalog);

  const customDietTags =
    dietTags !== undefined
      ? sanitizeDietTagsForCatalog(dietTags, catalog)
      : sanitizeDietTagsForCatalog(existing.dietTags, catalog);

  if (allergenTags !== undefined || translations?.length > 0) {
    i18n = applyAllergenTagsToI18n(i18n ?? existing.i18n, tags, languages, (lang) =>
      allergensTextFromCatalog(tags, lang, catalog)
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
      ...(dietTags !== undefined && { dietTags: customDietTags }),
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
    previousPrice?: unknown;
    previousPriceAt?: Date | null;
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
    dietTags?: unknown;
    sortOrder: number;
    isActive: boolean;
    i18n: unknown;
    optionGroups?: unknown;
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
  const catalog = await loadPrefCatalog(restaurantId);
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
    previousPrice:
      product.previousPrice != null && product.previousPrice !== undefined
        ? Number(product.previousPrice)
        : null,
    previousPriceAt: product.previousPriceAt
      ? new Date(product.previousPriceAt).toISOString()
      : null,
    currencyId: product.currencyId ?? currency.id,
    currency,
    prepTimeMinutes: product.prepTimeMinutes,
    calories: product.calories,
    features: resolveFeatures(product),
    isVegan: product.isVegan,
    isVegetarian: product.isVegetarian,
    isGlutenFree: product.isGlutenFree,
    isDiabetic: product.isDiabetic,
    allergenTags: sanitizeAllergenTagsForCatalog(product.allergenTags, catalog),
    dietTags: sanitizeDietTagsForCatalog(product.dietTags, catalog),
    isRecommended: product.isRecommended,
    imageUrl: images[0] ?? null,
    images,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
    isValid: validation.valid,
    validationIssues: validation.issues,
    translations: toProductTranslations(product.i18n, languages),
    optionGroups: normalizeOptionGroups(product.optionGroups),
    optionSummary: optionGroupsSummary(product.optionGroups),
  };
}

function parseBulkParams(body: Record<string, unknown>): BulkPriceParams | null {
  const direction = body.direction === 'down' ? 'down' : body.direction === 'up' ? 'up' : null;
  const mode = body.mode === 'fixed' ? 'fixed' : body.mode === 'percent' ? 'percent' : null;
  const value = Number(body.value);
  const roundingRaw = String(body.rounding || 'off');
  const rounding: BulkPriceRounding =
    roundingRaw === '0.1' ||
    roundingRaw === '0.5' ||
    roundingRaw === '1' ||
    roundingRaw === '5'
      ? roundingRaw
      : 'off';
  const optionsAction: BulkOptionsAction =
    body.optionsAction === 'base_and_options' ? 'base_and_options' : 'base_only';

  if (!direction || !mode || !Number.isFinite(value) || value < 0) return null;
  if (mode === 'percent' && value > 500) return null;
  return { direction, mode, value, rounding, optionsAction };
}

async function loadBulkTargetProducts(
  restaurantId: number,
  body: Record<string, unknown>
) {
  const scope = String(body.scope || 'all');
  const where: Record<string, unknown> = { restaurantId };
  if (scope === 'category' && body.groupId) {
    where.groupId = Number(body.groupId);
  } else if (scope === 'selected') {
    const ids = Array.isArray(body.productIds)
      ? body.productIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) return [];
    where.id = { in: ids };
  }

  return prisma.product.findMany({
    where,
    include: { group: true, currency: true },
    orderBy: { sortOrder: 'asc' },
  });
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
