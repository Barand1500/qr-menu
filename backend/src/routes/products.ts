import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId, validateProduct } from '../lib/auth.js';
import { config } from '../config.js';
import recipeSuggestions from './recipe-suggestions.js';
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
} from '../lib/bulk-price.js';
import {
  PRICE_HISTORY_LIMIT,
  buildSample,
  describeBulkChange,
  describeRestore,
} from '../lib/price-history.js';
import {
  parseStockQtyInput,
  parseStockResetPatch,
  setOptionStocks,
} from '../lib/product-stock.js';

const router = Router();
router.use(authRequired);
router.use('/recipe-suggestions', recipeSuggestions);

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

/** Grup içi sırayı 1..n yapar (silinen ürünlerden kalan boşlukları kapatır). */
async function compactProductSortOrders(groupId: number) {
  const products = await prisma.product.findMany({
    where: { groupId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, sortOrder: true },
  });
  const needsFix = products.some((p, i) => p.sortOrder !== i + 1);
  if (!needsFix) return false;

  await prisma.$transaction(
    products.map((p, i) =>
      prisma.product.update({
        where: { id: p.id },
        data: { sortOrder: i + 1 },
      })
    )
  );
  return true;
}

async function compactRestaurantProductSortOrders(restaurantId: number) {
  const rows = await prisma.product.findMany({
    where: { restaurantId },
    select: { groupId: true },
    distinct: ['groupId'],
  });
  for (const row of rows) {
    await compactProductSortOrders(row.groupId);
  }
}

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { search, groupId, active, page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(500, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  // Boşluklu sıraları (örn. tek ürün ama sıra=4) otomatik düzelt
  if (groupId) {
    await compactProductSortOrders(Number(groupId));
  } else {
    await compactRestaurantProductSortOrders(restaurantId!);
  }

  const where: Record<string, unknown> = { restaurantId };
  if (groupId) where.groupId = Number(groupId);
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  // Search the restaurant's complete matching set before paginating, not just the current page.
  const query = String(search || '').trim().toLowerCase();
  if (query) {
    const candidates = await prisma.product.findMany({ where, select: { id: true, i18n: true } });
    where.id = { in: candidates.filter((product) => textMatchesI18n(product.i18n, 'tr', ['name'], query)).map((product) => product.id) };
  }

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

  const mapped = await Promise.all(products.map((p) => mapProduct(p, restaurantId!, languages)));
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

// Gruba toplu ürün eklemek için hafif ürün listesi (tüm ürünler, hangi grupta oldukları ile)
router.get('/picker', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const rows = await prisma.product.findMany({
    where: { restaurantId: restaurantId! },
    include: { group: true, currency: true },
    orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json({
    products: rows.map((p) => ({
      id: p.id,
      name: getProductField(p.i18n, 'tr', 'name'),
      price: Number(p.price),
      currency: p.currency ? { code: p.currency.code, symbol: p.currency.symbol } : null,
      imageUrl: parseProductImages(p)[0] ?? null,
      isActive: p.isActive,
      groupId: p.groupId,
      groupName: getGroupName(p.group.i18n),
    })),
  });
});

// Seçilen ürünleri bir gruba taşır (bir ürün tek grupta bulunur). Sıra: seçim sırasıyla grubun sonuna.
router.post('/move-to-group', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body as { groupId?: unknown; productIds?: unknown };
  const target = Number(body.groupId);
  if (!Number.isInteger(target)) return res.status(400).json({ message: 'Geçersiz grup' });
  const ids = Array.isArray(body.productIds)
    ? [...new Set(body.productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];
  if (!ids.length) return res.status(400).json({ message: 'Eklenecek ürünleri seçin' });
  if (ids.length > 1000) return res.status(400).json({ message: 'Tek seferde en fazla 1000 ürün taşınabilir' });

  const group = await prisma.group.findFirst({ where: { id: target, restaurantId: restaurantId! } });
  if (!group) return res.status(400).json({ message: 'Geçersiz grup' });

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, restaurantId: restaurantId! },
    select: { id: true, groupId: true },
  });
  if (rows.length !== ids.length) {
    return res.status(400).json({ message: 'Seçilen ürünlerden bazıları bulunamadı' });
  }
  const groupOf = new Map(rows.map((r) => [r.id, r.groupId]));
  const toMove = ids.filter((id) => groupOf.get(id) !== target);
  if (!toMove.length) return res.json({ moved: 0, skipped: ids.length });

  const sources = [...new Set(toMove.map((id) => groupOf.get(id)!))];
  const max = await prisma.product.aggregate({ where: { groupId: target }, _max: { sortOrder: true } });
  const base = max._max.sortOrder ?? 0;
  await prisma.$transaction(
    toMove.map((id, i) =>
      prisma.product.update({ where: { id }, data: { groupId: target, sortOrder: base + i + 1 } }),
    ),
  );
  for (const groupId of [...sources, target]) await compactProductSortOrders(groupId);

  res.json({ moved: toMove.length, skipped: ids.length - toMove.length });
});

// Fiyat değişikliği geçmişi: en yeni en üstte (kim, ne zaman, ne yaptı, ilk birkaç ürün)
router.get('/price-changes', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  await importLegacyPriceSnapshot(restaurantId!);
  const rows = await prisma.priceChange.findMany({
    where: { restaurantId: restaurantId! },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PRICE_HISTORY_LIMIT,
  });
  res.json({
    changes: rows.map((c) => ({
      id: c.id,
      kind: c.kind,
      summary: c.summary,
      userName: c.userName,
      createdAt: c.createdAt.toISOString(),
      itemCount: c.itemCount,
      sample: c.sample,
    })),
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

  const historyItems: HistoryItemInput[] = [];
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

    const next: { id: number; price: number; previousPrice: number; optionGroups?: unknown } = {
      id: p.id,
      price: base.next,
      previousPrice: oldPrice,
    };
    let oldOptionGroups: unknown = null;

    if (params.optionsAction === 'base_and_options') {
      const opt = transformOptionGroups(p.optionGroups, params);
      next.optionGroups = opt.groups;
      oldOptionGroups = normalizeOptionGroups(p.optionGroups);
    }

    if (Math.abs(base.next - oldPrice) > 0.001 || next.optionGroups) {
      updates.push(next);
      historyItems.push({
        productId: p.id,
        productName: getProductField(p.i18n, 'tr', 'name'),
        oldPrice,
        newPrice: base.next,
        oldOptionGroups,
        symbol: p.currency?.symbol ?? '₺',
      });
    }
  }

  if (!updates.length) {
    return res.status(400).json({
      message: 'Uygulanacak fiyat değişikliği yok',
      skipped,
    });
  }

  const appliedAt = new Date().toISOString();
  const symbols = new Set(products.map((p) => p.currency?.symbol ?? '₺'));
  const scopeKind = body.scope === 'category' ? 'category' : body.scope === 'selected' ? 'selected' : 'all';
  const summary = describeBulkChange(
    params,
    {
      kind: scopeKind,
      groupName: products[0] ? getGroupName(products[0].group.i18n) : undefined,
      count: products.length,
    },
    symbols.size === 1 ? [...symbols][0] : null,
  );
  const actor = await actorName(req);

  await prisma.$transaction(async (tx) => {
    await recordPriceChange(tx, {
      restaurantId: restaurantId!,
      userId: req.user?.userId ?? null,
      userName: actor,
      kind: 'bulk',
      summary,
      createdAt: new Date(appliedAt),
      items: historyItems,
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

// Bir fiyat değişikliğini geri al: o işlemde değişen ürünler, işlemden önceki fiyatlarına (ve seçeneklerine) döner.
// Geri alma da geçmişe yeni bir kayıt olarak eklenir, böylece o da geri alınabilir.
router.post('/price-changes/:id/restore', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const change = await prisma.priceChange.findFirst({
    where: { id, restaurantId: restaurantId! },
    include: { items: true },
  });
  if (!change) return res.status(404).json({ message: 'Fiyat kaydı bulunamadı' });

  const products = await prisma.product.findMany({
    where: { id: { in: change.items.map((i) => i.productId) }, restaurantId: restaurantId! },
    include: { currency: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const restoreItems: HistoryItemInput[] = [];
  const updates: { id: number; price: number; previousPrice: number }[] = [];

  const actor = await actorName(req);
  const created = await prisma.$transaction(async (tx) => {
    for (const item of change.items) {
      const product = byId.get(item.productId);
      if (!product) continue; // ürün silinmiş
      const current = Number(product.price);
      const target = Number(item.oldPrice);
      const optionsToRestore = item.oldOptionGroups != null;
      if (Math.abs(current - target) < 0.001 && !optionsToRestore) continue;
      await tx.product.update({
        where: { id: product.id },
        data: {
          price: target,
          previousPrice: null,
          previousPriceAt: null,
          ...(optionsToRestore ? { optionGroups: normalizeOptionGroups(item.oldOptionGroups) } : {}),
        },
      });
      restoreItems.push({
        productId: product.id,
        productName: item.productName,
        oldPrice: current,
        newPrice: target,
        oldOptionGroups: optionsToRestore ? normalizeOptionGroups(product.optionGroups) : null,
        symbol: product.currency?.symbol ?? '₺',
      });
      updates.push({ id: product.id, price: target, previousPrice: current });
    }
    if (!restoreItems.length) return null;
    return recordPriceChange(tx, {
      restaurantId: restaurantId!,
      userId: req.user?.userId ?? null,
      userName: actor,
      kind: 'restore',
      summary: describeRestore(change.summary),
      createdAt: new Date(),
      items: restoreItems,
    });
  });
  if (!created) {
    return res.status(400).json({ message: 'Bu değişiklikteki ürünlerin fiyatı zaten o hâlde.' });
  }
  res.json({ ok: true, restored: updates.length, changeId: created.id, updates });
});

// Kaydı geçmişten sil (ürün fiyatları değişmez; o değişikliğe artık dönülemez)
router.delete('/price-changes/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const result = await prisma.priceChange.deleteMany({
    where: { id: Number(req.params.id), restaurantId: restaurantId! },
  });
  if (!result.count) return res.status(404).json({ message: 'Fiyat kaydı bulunamadı' });
  res.json({ ok: true });
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

  await compactProductSortOrders(Number(groupId));
  const refreshed = await prisma.product.findFirst({
    where: { id: product.id },
    include: { group: true, currency: true },
  });

  res.status(201).json(await mapProduct(refreshed || product, restaurantId!, languages));
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

  const nextGroupId = groupId !== undefined ? Number(groupId) : existing.groupId;
  const groupChanged = groupId !== undefined && nextGroupId !== existing.groupId;

  if (groupChanged) {
    const group = await prisma.group.findFirst({
      where: { id: nextGroupId, restaurantId: restaurantId! },
    });
    if (!group) return res.status(400).json({ message: 'Geçersiz grup' });
  }

  // Başka gruba taşınınca eski sıra taşınmaz; yeni grubun sonuna (boş yere) geçer
  let nextSortOrder: number | undefined = sortOrder !== undefined ? Number(sortOrder) : undefined;
  if (groupChanged) {
    const maxOrder = await prisma.product.aggregate({
      where: { groupId: nextGroupId },
      _max: { sortOrder: true },
    });
    nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(groupId !== undefined && { groupId: nextGroupId }),
      ...(price !== undefined && { price }),
      ...(currencyId !== undefined && {
        currencyId:
          currencyId == null || currencyId === '' ? null : Number(currencyId),
      }),
      ...(nextSortOrder !== undefined &&
        Number.isFinite(nextSortOrder) && { sortOrder: nextSortOrder }),
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

  if (groupChanged) {
    await compactProductSortOrders(existing.groupId);
    await compactProductSortOrders(nextGroupId);
  } else {
    await compactProductSortOrders(product.groupId);
  }

  const refreshed = await prisma.product.findFirst({
    where: { id: product.id },
    include: { group: true, currency: true },
  });

  res.json(await mapProduct(refreshed || product, restaurantId!, languages));
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

/** Hızlı stok / günlük reset ayarı (ürünler tablosu) */
router.patch('/:id/stock', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Ürün bulunamadı' });

  const data: {
    stockQty?: number | null;
    stockResetHour?: number | null;
    stockResetMinute?: number | null;
    stockResetTo?: number | null;
  } = {};

  if ('stockQty' in req.body) {
    const parsed = parseStockQtyInput(req.body.stockQty);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    data.stockQty = parsed.value;
  }

  const reset = parseStockResetPatch(req.body as Record<string, unknown>);
  if (!reset.ok) return res.status(400).json({ message: reset.message });
  Object.assign(data, reset.data);

  const rawOptionStocks = (req.body as Record<string, unknown>).optionStocks;
  let optionStocks: { optionId: string; stockQty: number | null }[] | null = null;
  if (rawOptionStocks !== undefined) {
    if (!Array.isArray(rawOptionStocks)) {
      return res.status(400).json({ message: 'Geçersiz varyant stoğu' });
    }
    optionStocks = [];
    for (const row of rawOptionStocks) {
      const entry = row as { optionId?: unknown; stockQty?: unknown };
      const optionId = String(entry.optionId || '').trim();
      if (!optionId) continue;
      const parsed = parseStockQtyInput(entry.stockQty);
      if (!parsed.ok) return res.status(400).json({ message: parsed.message });
      optionStocks.push({ optionId, stockQty: parsed.value });
    }
  }

  if (!Object.keys(data).length && !optionStocks) {
    return res.status(400).json({ message: 'Güncellenecek stok alanı yok' });
  }

  if (Object.keys(data).length) {
    await prisma.product.update({ where: { id }, data });
  }
  if (optionStocks?.length) {
    await setOptionStocks(restaurantId!, id, optionStocks);
  }

  const [product, languages] = await Promise.all([
    prisma.product.findFirstOrThrow({
      where: { id },
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

// Replace one slot in one update; appending then deleting would change the cover/order on failures.
router.post('/:id/images/replace', upload.single('image'), async (req, res, next) => {
  let committed = false;
  const discardUpload = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };
  try {
    const restaurantId = await getRestaurantId(req);
    const id = Number(req.params.id);
    const existing = await prisma.product.findFirst({ where: { id, restaurantId: restaurantId! } });
    if (!existing) { discardUpload(); return res.status(404).json({ message: 'Ürün bulunamadı' }); }
    const current = parseProductImages(existing);
    const url = typeof req.body.url === 'string' ? req.body.url : '';
    if (!req.file || !req.file.mimetype.startsWith('image/') || !current.includes(url)) {
      discardUpload();
      return res.status(400).json({ message: 'Değiştirilecek görsel ve geçerli bir fotoğraf seçin.' });
    }
    const replacement = `/uploads/${req.file.filename}`;
    const languages = await getLanguages();
    const product = await prisma.product.update({ where: { id }, data: imagesPayload(current.map(image => image === url ? replacement : image)), include: { group: true, currency: true } });
    committed = true;
    return res.json(await mapProduct(product, restaurantId!, languages));
  } catch (error) {
    // A database failure leaves the original gallery intact.
    if (!committed) discardUpload();
    next(error);
  }
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

  const groupId = existing.groupId;
  await prisma.product.delete({ where: { id } });
  await compactProductSortOrders(groupId);
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
    stockQty?: number | null;
    stockResetHour?: number | null;
    stockResetMinute?: number | null;
    stockResetTo?: number | null;
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
    stockQty: product.stockQty ?? null,
    stockResetHour: product.stockResetHour ?? null,
    stockResetMinute: product.stockResetMinute ?? 0,
    stockResetTo: product.stockResetTo ?? null,
    isValid: validation.valid,
    validationIssues: validation.issues,
    translations: toProductTranslations(product.i18n, languages),
    optionGroups: normalizeOptionGroups(product.optionGroups),
    optionSummary: optionGroupsSummary(product.optionGroups),
  };
}

type HistoryItemInput = {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number | null;
  /** Seçenek fiyatları da değiştiyse işlemden önceki hâli; yoksa null. */
  oldOptionGroups: unknown;
  symbol: string;
};

async function actorName(req: { user?: { userId: number } }): Promise<string> {
  if (!req.user) return 'Bilinmiyor';
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { fullName: true, email: true },
  });
  return (user?.fullName || user?.email || 'Bilinmiyor').slice(0, 150);
}

type PriceChangeTx = Pick<typeof prisma, 'priceChange' | 'priceChangeItem'>;

async function recordPriceChange(
  tx: PriceChangeTx,
  input: {
    restaurantId: number;
    userId: number | null;
    userName: string;
    kind: 'bulk' | 'restore';
    summary: string;
    createdAt: Date;
    items: HistoryItemInput[];
  },
) {
  const change = await tx.priceChange.create({
    data: {
      restaurantId: input.restaurantId,
      userId: input.userId,
      userName: input.userName,
      kind: input.kind,
      summary: input.summary,
      itemCount: input.items.length,
      sample: buildSample(
        input.items.map((i) => ({
          name: i.productName,
          oldPrice: i.oldPrice,
          newPrice: i.newPrice,
          symbol: i.symbol,
        })),
      ),
      createdAt: input.createdAt,
    },
  });
  await tx.priceChangeItem.createMany({
    data: input.items.map((i) => ({
      changeId: change.id,
      productId: i.productId,
      productName: i.productName.slice(0, 200),
      oldPrice: i.oldPrice,
      newPrice: i.newPrice,
      ...(i.oldOptionGroups != null ? { oldOptionGroups: i.oldOptionGroups as never } : {}),
    })),
  });
  return change;
}

/**
 * Eski sistemde yalnızca son toplu değişiklik tek bir ayar olarak saklanıyordu. İlk listelemede o kayıt
 * geçmişe ("Bilinmiyor" kullanıcıyla) aktarılır ve eski ayar silinir.
 */
async function importLegacyPriceSnapshot(restaurantId: number) {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: BULK_PRICE_SNAPSHOT_KEY } },
  });
  if (!row) return;
  const snapshot = parseBulkSnapshot(row.value);
  if (!snapshot) {
    await prisma.setting.deleteMany({ where: { restaurantId, key: BULK_PRICE_SNAPSHOT_KEY } });
    return;
  }
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: snapshot.items.map((i) => i.productId) } },
    include: { currency: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items: HistoryItemInput[] = snapshot.items.map((i) => {
    const product = byId.get(i.productId);
    return {
      productId: i.productId,
      productName: product ? getProductField(product.i18n, 'tr', 'name') : 'Silinmiş ürün',
      oldPrice: i.price,
      newPrice: snapshot.params ? transformUnitPrice(i.price, snapshot.params).next : null,
      oldOptionGroups: i.optionGroups.length ? i.optionGroups : null,
      symbol: product?.currency?.symbol ?? '₺',
    };
  });
  const symbols = new Set(items.map((i) => i.symbol));
  await prisma.$transaction(async (tx) => {
    await recordPriceChange(tx, {
      restaurantId,
      userId: null,
      userName: 'Bilinmiyor',
      kind: 'bulk',
      summary: snapshot.params
        ? describeBulkChange(snapshot.params, { kind: 'unknown' }, symbols.size === 1 ? [...symbols][0] : null)
        : 'Toplu fiyat değişikliği',
      createdAt: new Date(snapshot.appliedAt),
      items,
    });
    await tx.setting.deleteMany({ where: { restaurantId, key: BULK_PRICE_SNAPSHOT_KEY } });
  });
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
