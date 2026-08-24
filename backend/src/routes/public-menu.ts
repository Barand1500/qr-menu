import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  getGroupName,
  getProductField,
  getShowcaseTitles,
  getWelcomeMessage,
  textMatchesI18n,
} from '../lib/i18n-json.js';
import { parseProductImages } from '../lib/product-images.js';
import { getRestaurantThemes } from '../lib/menu-themes.js';

const router = Router();

function getLangCode(req: { query: Record<string, unknown> }): string {
  return String(req.query.lang || 'tr');
}

function mapCurrency(currency?: {
  id: number;
  code: string;
  name: string;
  symbol: string;
} | null) {
  if (!currency) {
    return { code: 'TRY', name: 'Türk Lirası', symbol: '₺' };
  }
  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
  };
}

async function trackView(
  restaurantId: number,
  entityType: 'group' | 'product' | 'showcase' | 'menu',
  entityId: number,
  sessionId: string
) {
  await prisma.viewEvent.create({
    data: { restaurantId, entityType, entityId, sessionId },
  });
}

router.get('/resolve', async (_req, res) => {
  const restaurant = await prisma.restaurant.findFirst({ orderBy: { id: 'asc' } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const themes = await getRestaurantThemes(restaurant.id);
  res.json({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    logoUrl: restaurant.logoUrl,
    themes,
  });
});

router.get('/:slug/welcome', async (req, res) => {
  const slug = req.params.slug;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const [languages, musicSetting, themes] = await Promise.all([
    prisma.language.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: 'welcome_music_url' },
      },
    }),
    getRestaurantThemes(restaurant.id),
  ]);

  const welcomeI18n = (restaurant.welcomeI18n as Record<string, { message?: string }>) || {};
  const welcomeByLang = Object.fromEntries(
    languages.map((l) => [l.code, welcomeI18n[l.code]?.message || welcomeI18n.tr?.message || ''])
  );

  res.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
    languages: languages.map((l) => ({ code: l.code, name: l.name })),
    welcomeByLang,
    welcomeMusicUrl: musicSetting?.value || null,
    theme: themes.welcome,
  });
});

router.get('/:slug/products/:productId', async (req, res) => {
  const slug = req.params.slug;
  const productId = Number(req.params.productId);
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId: restaurant.id, isActive: true },
    include: { group: true, currency: true },
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });

  await trackView(restaurant.id, 'product', productId, sessionId);

  const features = Array.isArray(product.features)
    ? product.features.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : [];
  const legacyFeatures: string[] = [];
  if (product.isVegan) legacyFeatures.push('Vegan');
  if (product.isVegetarian) legacyFeatures.push('Vejeteryan');
  if (product.isGlutenFree) legacyFeatures.push('Glutensiz');
  if (product.isDiabetic) legacyFeatures.push('Diyabetik');

  const images = parseProductImages(product);

  res.json({
    id: product.id,
    name: getProductField(product.i18n, activeLang, 'name'),
    description: getProductField(product.i18n, activeLang, 'description'),
    ingredients: getProductField(product.i18n, activeLang, 'ingredients'),
    allergens: getProductField(product.i18n, activeLang, 'allergens'),
    price: Number(product.price),
    currency: mapCurrency(product.currency),
    imageUrl: images[0] ?? null,
    images,
    prepTimeMinutes: product.prepTimeMinutes,
    calories: product.calories,
    isRecommended: product.isRecommended,
    features: features.length > 0 ? features : legacyFeatures,
    group: {
      id: product.group.id,
      name: getGroupName(product.group.i18n, activeLang),
    },
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
  });
});

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';

  const [groups, bannerShowcase, storyShowcase, languages, aboutSetting, themes] =
    await Promise.all([
    prisma.group.findMany({
      where: { restaurantId: restaurant.id, isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.showcaseImage.findMany({
      where: { restaurantId: restaurant.id, isActive: true, displayType: 'banner' },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.showcaseImage.findMany({
      where: { restaurantId: restaurant.id, isActive: true, displayType: 'story' },
      include: {
        product: { select: { id: true, groupId: true, i18n: true } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.language.findMany({ where: { isActive: true } }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: 'company_about' },
      },
    }),
    getRestaurantThemes(restaurant.id),
  ]);

  await trackView(restaurant.id, 'menu', restaurant.id, sessionId);

  res.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
    welcomeMessage: getWelcomeMessage(restaurant.welcomeI18n, activeLang),
    about: aboutSetting?.value || '',
    languages: languages.map((l) => ({ code: l.code, name: l.name })),
    theme: themes.menu,
    showcase: bannerShowcase.map((s) => {
      const { title1, title2 } = getShowcaseTitles(s.i18n, activeLang);
      return {
        id: s.id,
        imageUrl: s.imageUrl,
        title1,
        title2,
        sortOrder: s.sortOrder,
      };
    }),
    stories: storyShowcase
      .filter((s) => s.imageUrl && s.productId && s.product)
      .map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl,
        productId: s.productId!,
        groupId: s.product!.groupId,
        sortOrder: s.sortOrder,
        durationSeconds: s.durationSeconds,
        productName: getProductField(s.product!.i18n, activeLang, 'name'),
      })),
    groups: groups.map((g) => ({
      id: g.id,
      name: getGroupName(g.i18n, activeLang),
      imageUrl: g.imageUrl,
      sortOrder: g.sortOrder,
      productCount: g._count.products,
      children: g.children.map((c) => ({
        id: c.id,
        name: getGroupName(c.i18n, activeLang),
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
      })),
    })),
  });
});

router.get('/:slug/groups/:groupId/products', async (req, res) => {
  const slug = req.params.slug;
  const groupId = Number(req.params.groupId);
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';

  const group = await prisma.group.findFirst({
    where: { id: groupId, restaurantId: restaurant.id, isActive: true },
  });
  if (!group) return res.status(404).json({ message: 'Kategori bulunamadı' });

  const products = await prisma.product.findMany({
    where: { groupId, restaurantId: restaurant.id, isActive: true },
    include: { currency: true },
    orderBy: { sortOrder: 'asc' },
  });

  await trackView(restaurant.id, 'group', groupId, sessionId);

  res.json({
    group: {
      id: group.id,
      name: getGroupName(group.i18n, activeLang),
      imageUrl: group.imageUrl,
    },
    products: products.map((p) => {
      const images = parseProductImages(p);
      return {
        id: p.id,
        name: getProductField(p.i18n, activeLang, 'name'),
        description: getProductField(p.i18n, activeLang, 'description'),
        price: Number(p.price),
        currency: mapCurrency(p.currency),
        imageUrl: images[0] ?? null,
      };
    }),
  });
});

router.get('/:slug/popular-products', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';

  const viewCounts = await prisma.viewEvent.groupBy({
    by: ['entityId'],
    where: { restaurantId: restaurant.id, entityType: 'product' },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take: limit,
  });

  const orderedIds: number[] = viewCounts.map((e) => e.entityId);

  if (orderedIds.length < limit) {
    const recommended = await prisma.product.findMany({
      where: {
        restaurantId: restaurant.id,
        isActive: true,
        isRecommended: true,
        id: { notIn: orderedIds },
      },
      orderBy: { sortOrder: 'asc' },
      take: limit - orderedIds.length,
      select: { id: true },
    });
    orderedIds.push(...recommended.map((p) => p.id));
  }

  if (orderedIds.length < limit) {
    const fallback = await prisma.product.findMany({
      where: {
        restaurantId: restaurant.id,
        isActive: true,
        id: { notIn: orderedIds },
      },
      orderBy: { sortOrder: 'asc' },
      take: limit - orderedIds.length,
      select: { id: true },
    });
    orderedIds.push(...fallback.map((p) => p.id));
  }

  if (orderedIds.length === 0) {
    return res.json([]);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: orderedIds }, isActive: true },
    include: { group: true, currency: true },
  });

  const items = orderedIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({
      id: p!.id,
      name: getProductField(p!.i18n, activeLang, 'name'),
      price: Number(p!.price),
      currency: mapCurrency(p!.currency),
      imageUrl: p!.imageUrl,
      groupId: p!.groupId,
      groupName: getGroupName(p!.group.i18n, activeLang),
    }));

  res.json(items);
});

router.get('/:slug/search', async (req, res) => {
  const slug = req.params.slug;
  const q = String(req.query.q || '').toLowerCase();
  const lang = getLangCode(req);

  if (!q) return res.json([]);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';

  const products = await prisma.product.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    include: { group: true, currency: true },
    take: 100,
  });

  const filtered = products
    .filter((p) => textMatchesI18n(p.i18n, activeLang, ['name'], q))
    .slice(0, 20);

  res.json(
    filtered.map((p) => ({
      id: p.id,
      name: getProductField(p.i18n, activeLang, 'name'),
      price: Number(p.price),
      currency: mapCurrency(p.currency),
      imageUrl: p.imageUrl,
      groupName: getGroupName(p.group.i18n, activeLang),
      groupId: p.groupId,
    }))
  );
});

router.post('/:slug/complaints', async (req, res) => {
  const slug = req.params.slug;
  const { fullName, phone, message } = req.body as {
    fullName?: string;
    phone?: string;
    message?: string;
  };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const name = String(fullName || '').trim();
  const text = String(message || '').trim();
  const tel = phone ? String(phone).trim() : null;

  if (name.length < 2) {
    return res.status(400).json({ message: 'Ad soyad en az 2 karakter olmalı' });
  }
  if (text.length < 10) {
    return res.status(400).json({ message: 'Lütfen şikayetinizi biraz daha detaylı yazın' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ message: 'Mesaj çok uzun (en fazla 2000 karakter)' });
  }

  const complaint = await prisma.complaint.create({
    data: {
      restaurantId: restaurant.id,
      fullName: name,
      phone: tel || null,
      message: text,
    },
  });

  res.status(201).json({ ok: true, id: complaint.id });
});

router.post('/:slug/suggestions', async (req, res) => {
  const slug = req.params.slug;
  const { fullName, phone, message, rating } = req.body as {
    fullName?: string;
    phone?: string;
    message?: string;
    rating?: number;
  };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ message: 'Lütfen 1 ile 5 arasında puan verin' });
  }

  const name = fullName ? String(fullName).trim() : null;
  const text = message ? String(message).trim() : null;
  const tel = phone ? String(phone).trim() : null;

  if (name && name.length < 2) {
    return res.status(400).json({ message: 'Ad soyad en az 2 karakter olmalı' });
  }
  if (text && text.length > 2000) {
    return res.status(400).json({ message: 'Mesaj çok uzun (en fazla 2000 karakter)' });
  }

  const suggestion = await prisma.suggestion.create({
    data: {
      restaurantId: restaurant.id,
      fullName: name || null,
      phone: tel || null,
      message: text || null,
      rating: stars,
    },
  });

  res.status(201).json({ ok: true, id: suggestion.id });
});

router.post('/:slug/track', async (req, res) => {
  const slug = req.params.slug;
  const { entityType, entityId, sessionId } = req.body;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  if (entityType && entityId && sessionId) {
    await trackView(restaurant.id, entityType, Number(entityId), String(sessionId));
  }

  res.json({ ok: true });
});

export default router;
