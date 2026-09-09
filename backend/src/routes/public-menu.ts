import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { parseClientMeta } from '../lib/client-meta.js';
import {
  getGroupName,
  getProductField,
  getShowcaseTitles,
  getWelcomeMessage,
  textMatchesI18n,
} from '../lib/i18n-json.js';
import { parseSocialLinks, publicSocialLinks } from '../lib/social.js';
import { isAddonActive } from '../addons/ownership.js';
import { parseMenuAssistantStyle, MENU_ASSISTANT_STYLE_KEY } from '../lib/menu-assistant-style.js';
import {
  MENU_LINEAR_CONFIG_KEY,
  parseLinearThemeConfig,
} from '../lib/menu-linear-config.js';
import {
  MENU_ANIMASYON_CONFIG_KEY,
  parseAnimasyonThemeConfig,
} from '../lib/menu-animasyon-config.js';
import {
  MENU_SADE_CONFIG_KEY,
  parseSadeThemeConfig,
} from '../lib/menu-sade-config.js';
import {
  MENU_ALIVE_CONFIG_KEY,
  parseAliveThemeConfig,
} from '../lib/menu-alive-config.js';
import { isTableServiceEnabled, MENU_TABLE_SERVICE_KEY } from '../lib/table-service.js';
import {
  isCodeVerified,
  loadTableSessionCodeConfig,
  resolveCodeGateStatus,
} from '../lib/table-session-code.js';
import {
  appendOrdersToSession,
  findActiveSession,
  openOrGetSession,
  type FloorOrderItem,
} from '../lib/table-floor.js';
import { parseProductImages } from '../lib/product-images.js';
import { parseAllergenTags } from '../lib/diet-allergens.js';
import {
  loadPrefCatalog,
  sanitizeAllergenTagsForCatalog,
  sanitizeDietTagsForCatalog,
} from '../lib/pref-catalog.js';
import { getRestaurantThemes } from '../addons/themes.js';
import {
  applyCampaignPrice,
  getCampaignSlug,
  loadCampaignContext,
  type CampaignCtx,
} from '../lib/campaigns.js';
import { distanceMeters, isWithinGeoLock, loadGeoLock } from '../lib/geo-lock.js';
import { isMaintenanceEnabled } from '../lib/maintenance.js';
import { addRunnerScore, getRunnerScores } from '../lib/maintenance-scores.js';
import { ABOUT_PAGE_KEY, parseAboutPage } from '../lib/about-page.js';
import {
  WELCOME_BASKETBALL_CONFIG_KEY,
  parseWelcomeBasketballConfig,
} from '../lib/welcome-basketball-config.js';
import {
  WELCOME_CUPS_CONFIG_KEY,
  parseWelcomeCupsConfig,
} from '../lib/welcome-cups-config.js';
import { activeOptionGroups } from '../lib/product-options.js';

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

function campaignMeta(campaign: CampaignCtx | null) {
  if (!campaign) return null;
  return {
    name: campaign.name,
    slug: campaign.slug,
    itemCount: campaign.productIds.length,
  };
}

async function trackView(
  restaurantId: number,
  entityType: 'group' | 'product' | 'showcase' | 'menu',
  entityId: number,
  sessionId: string,
  req: Request,
  lang?: string | null
) {
  const meta = parseClientMeta(String(req.headers['user-agent'] || ''), lang);
  await prisma.viewEvent.create({
    data: {
      restaurantId,
      entityType,
      entityId,
      sessionId,
      lang: meta.lang,
      device: meta.device,
      os: meta.os,
    },
  });
}

router.get('/resolve', async (_req, res) => {
  const restaurant = await prisma.restaurant.findFirst({ orderBy: { id: 'asc' } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const themes = await getRestaurantThemes(restaurant.id);
  const maintenance = await isMaintenanceEnabled(restaurant.id);
  res.json({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    logoUrl: restaurant.logoUrl,
    themes,
    maintenance,
  });
});

/** Bakım modu durumu */
router.get('/:slug/maintenance', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const enabled = await isMaintenanceEnabled(restaurant.id);
  res.json({
    enabled,
    restaurantName: restaurant.name,
  });
});

/** Garson koşusu skor tablosu */
router.get('/:slug/maintenance/scores', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const scores = await getRunnerScores(restaurant.id);
  res.json({ scores });
});

router.post('/:slug/maintenance/scores', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  try {
    const scores = await addRunnerScore(
      restaurant.id,
      String(req.body?.name ?? ''),
      Number(req.body?.score)
    );
    res.json({ scores });
  } catch (e) {
    res.status(400).json({ message: e instanceof Error ? e.message : 'Kayıt başarısız' });
  }
});

/** Konum kilidi durumu (karşılama öncesi) */
router.get('/:slug/geo-lock', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const cfg = await loadGeoLock(restaurant.id);
  if (!cfg.enabled) {
    return res.json({ enabled: false });
  }
  res.json({
    enabled: true,
    lat: cfg.lat,
    lng: cfg.lng,
    radiusMeters: cfg.radiusMeters,
  });
});

/** Konum doğrulama */
router.post('/:slug/geo-check', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: req.params.slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });
  const cfg = await loadGeoLock(restaurant.id);
  if (!cfg.enabled) {
    return res.json({ allowed: true, enabled: false });
  }

  const lat = Number((req.body as { lat?: number }).lat);
  const lng = Number((req.body as { lng?: number }).lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      allowed: false,
      enabled: true,
      code: 'GEO_REQUIRED',
      message: 'Konum izni gerekli',
    });
  }

  const dist = distanceMeters(cfg.lat, cfg.lng, lat, lng);
  const allowed = dist <= cfg.radiusMeters;
  res.json({
    allowed,
    enabled: true,
    distanceMeters: Math.round(dist),
    radiusMeters: cfg.radiusMeters,
    code: allowed ? 'OK' : 'GEO_OUTSIDE',
    message: allowed ? 'Tamam' : 'Bölge dışındasınız',
  });
});

router.get('/:slug/welcome', async (req, res) => {
  const slug = req.params.slug;
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const [
    languages,
    musicSetting,
    socialSetting,
    themes,
    campaign,
    prefCatalog,
    basketballSetting,
    cupsSetting,
  ] = await Promise.all([
    prisma.language.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: 'welcome_music_url' },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: 'social_links' },
      },
    }),
    getRestaurantThemes(restaurant.id),
    loadCampaignContext(restaurant.id, campaignSlug),
    loadPrefCatalog(restaurant.id),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: {
          restaurantId: restaurant.id,
          key: WELCOME_BASKETBALL_CONFIG_KEY,
        },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: {
          restaurantId: restaurant.id,
          key: WELCOME_CUPS_CONFIG_KEY,
        },
      },
    }),
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
    campaign: campaignMeta(campaign),
    socialLinks: publicSocialLinks(parseSocialLinks(socialSetting?.value), 'welcome'),
    prefCatalog,
    basketballConfig: parseWelcomeBasketballConfig(basketballSetting?.value),
    cupsConfig: parseWelcomeCupsConfig(cupsSetting?.value),
  });
});

router.get('/:slug/products/:productId', async (req, res) => {
  const slug = req.params.slug;
  const productId = Number(req.params.productId);
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  if (campaignSlug && !campaign) {
    return res.status(404).json({ message: 'Kampanya bulunamadı' });
  }
  if (campaign && !campaign.itemByProductId.has(productId)) {
    return res.status(404).json({ message: 'Ürün bu kampanyada yok' });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, restaurantId: restaurant.id, isActive: true },
    include: { group: true, currency: true },
  });
  if (!product) return res.status(404).json({ message: 'Ürün bulunamadı' });

  await trackView(restaurant.id, 'product', productId, sessionId, req, activeLang);

  const features = Array.isArray(product.features)
    ? product.features.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    : [];
  const legacyFeatures: string[] = [];
  if (product.isVegan) legacyFeatures.push('Vegan');
  if (product.isVegetarian) legacyFeatures.push('Vejeteryan');
  if (product.isGlutenFree) legacyFeatures.push('Glutensiz');
  if (product.isDiabetic) legacyFeatures.push('Diyabetik');

  const images = parseProductImages(product);
  const priced = applyCampaignPrice(
    product.id,
    {
      price: Number(product.price),
      currency: mapCurrency(product.currency),
    },
    campaign,
    mapCurrency
  );
  const themes = await getRestaurantThemes(restaurant.id);
  const prefCatalog = await loadPrefCatalog(restaurant.id);
  const [tableServiceSetting, animasyonConfigSetting, sadeConfigSetting, aliveConfigSetting] =
    await Promise.all([
    prisma.setting.findFirst({
      where: { restaurantId: restaurant.id, key: MENU_TABLE_SERVICE_KEY },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_ANIMASYON_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_SADE_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_ALIVE_CONFIG_KEY },
      },
    }),
  ]);

  const sadeCfg = parseSadeThemeConfig(sadeConfigSetting?.value);
  const aliveCfg = parseAliveThemeConfig(aliveConfigSetting?.value);
  const animasyonCfg = parseAnimasyonThemeConfig(animasyonConfigSetting?.value);

  res.json({
    id: product.id,
    name: getProductField(product.i18n, activeLang, 'name'),
    description: getProductField(product.i18n, activeLang, 'description'),
    ingredients: getProductField(product.i18n, activeLang, 'ingredients'),
    allergens: getProductField(product.i18n, activeLang, 'allergens'),
    allergenTags: sanitizeAllergenTagsForCatalog(product.allergenTags, prefCatalog),
    dietTags: sanitizeDietTagsForCatalog(product.dietTags, prefCatalog),
    isVegan: product.isVegan,
    isVegetarian: product.isVegetarian,
    isGlutenFree: product.isGlutenFree,
    isDiabetic: product.isDiabetic,
    price: priced.price,
    currency: priced.currency,
    imageUrl: images[0] ?? null,
    images,
    prepTimeMinutes: product.prepTimeMinutes,
    calories: product.calories,
    isRecommended: product.isRecommended,
    features: features.length > 0 ? features : legacyFeatures,
    campaign: campaignMeta(campaign),
    theme: themes.menu,
    group: {
      id: product.group.id,
      name: getGroupName(product.group.i18n, activeLang),
    },
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
    menuFeatures: {
      tableService: isTableServiceEnabled(tableServiceSetting?.value),
      animasyonCart: animasyonCfg.cartEnabled,
      animasyonVariants: animasyonCfg.variantsEnabled,
      sadeCart: sadeCfg.cartEnabled,
      sadeVariants: sadeCfg.variantsEnabled,
      aliveCart: aliveCfg.cartEnabled,
      aliveVariants: aliveCfg.variantsEnabled,
    },
    optionGroups: activeOptionGroups(product.optionGroups),
  });
});

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  if (campaignSlug && !campaign) {
    return res.status(404).json({ message: 'Kampanya bulunamadı' });
  }

  const [
    groups,
    bannerShowcase,
    storyShowcase,
    languages,
    aboutSetting,
    aboutPageSetting,
    socialSetting,
    themes,
    menuAssistant,
    assistantStyleSetting,
    tableServiceSetting,
    linearConfigSetting,
    animasyonConfigSetting,
    sadeConfigSetting,
    aliveConfigSetting,
  ] = await Promise.all([
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
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: ABOUT_PAGE_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: 'social_links' },
      },
    }),
    getRestaurantThemes(restaurant.id),
    isAddonActive(restaurant.id, 'menu-assistant'),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_ASSISTANT_STYLE_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_TABLE_SERVICE_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_LINEAR_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_ANIMASYON_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_SADE_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurant.id, key: MENU_ALIVE_CONFIG_KEY },
      },
    }),
  ]);

  await trackView(restaurant.id, 'menu', restaurant.id, sessionId, req, activeLang);

  const campaignCounts = new Map<number, number>();
  if (campaign) {
    for (const item of campaign.itemByProductId.values()) {
      campaignCounts.set(item.groupId, (campaignCounts.get(item.groupId) || 0) + 1);
    }
  }

  const mappedGroups = groups
    .map((g) => {
      const children = g.children
        .filter((c) => !campaign || (campaignCounts.get(c.id) || 0) > 0)
        .map((c) => ({
          id: c.id,
          name: getGroupName(c.i18n, activeLang),
          imageUrl: c.imageUrl,
          sortOrder: c.sortOrder,
        }));

      const productCount = campaign
        ? campaignCounts.get(g.id) || 0
        : g._count.products;

      if (campaign && productCount === 0 && children.length === 0) {
        return null;
      }

      return {
        id: g.id,
        name: getGroupName(g.i18n, activeLang),
        imageUrl: g.imageUrl,
        sortOrder: g.sortOrder,
        productCount,
        children,
      };
    })
    .filter(Boolean);

  const stories = storyShowcase
    .filter((s) => s.imageUrl && s.productId && s.product)
    .filter((s) => !campaign || campaign.itemByProductId.has(s.productId!))
    .map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      productId: s.productId!,
      groupId: s.product!.groupId,
      sortOrder: s.sortOrder,
      durationSeconds: s.durationSeconds,
      productName: getProductField(s.product!.i18n, activeLang, 'name'),
    }));

  res.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
    welcomeMessage: getWelcomeMessage(restaurant.welcomeI18n, activeLang),
    about: aboutSetting?.value || '',
    aboutPage: parseAboutPage(aboutPageSetting?.value, aboutSetting?.value || ''),
    languages: languages.map((l) => ({ code: l.code, name: l.name })),
    theme: themes.menu,
    campaign: campaignMeta(campaign),
    features: {
      menuAssistant,
      menuAssistantStyle: menuAssistant
        ? parseMenuAssistantStyle(assistantStyleSetting?.value)
        : undefined,
      tableService: isTableServiceEnabled(tableServiceSetting?.value),
      linear: parseLinearThemeConfig(linearConfigSetting?.value),
      animasyon: parseAnimasyonThemeConfig(animasyonConfigSetting?.value),
      sade: parseSadeThemeConfig(sadeConfigSetting?.value),
      alive: parseAliveThemeConfig(aliveConfigSetting?.value),
    },
    socialLinks: publicSocialLinks(parseSocialLinks(socialSetting?.value), 'menu'),
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
    stories,
    groups: mappedGroups,
  });
});

router.get('/:slug/assistant-suggest', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const hunger = String(req.query.hunger || 'hungry'); // light | hungry | stuffed
  const taste = String(req.query.taste || 'savory'); // sweet | savory | fresh
  const budget = String(req.query.budget || 'mid'); // low | mid | high
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const active = await isAddonActive(restaurant.id, 'menu-assistant');
  if (!active) {
    return res.status(403).json({ message: 'Menü asistanı aktif değil' });
  }

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  const products = await prisma.product.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    include: { group: true, currency: true },
    take: 200,
  });

  const scored = products
    .filter((p) => !campaign || campaign.itemByProductId.has(p.id))
    .map((p) => {
      const name = getProductField(p.i18n, activeLang, 'name') || '';
      const description = getProductField(p.i18n, activeLang, 'description') || '';
      const hay = `${name} ${description}`.toLocaleLowerCase('tr-TR');
      const priced = applyCampaignPrice(
        p.id,
        { price: Number(p.price), currency: mapCurrency(p.currency) },
        campaign,
        mapCurrency
      );
      const price = priced.price;
      const cal = p.calories ?? 0;
      let score = 10;

      if (hunger === 'light') {
        if (cal > 0 && cal <= 400) score += 25;
        else if (cal > 600) score -= 15;
        if (/salata|corba|çorba|smoothie|meyve|hafif|salad|soup/.test(hay)) score += 18;
        if (/burger|pizza|tatli|tatlı|dessert|sufle/.test(hay)) score -= 10;
      } else if (hunger === 'stuffed') {
        if (cal >= 600) score += 20;
        if (/burger|pizza|kebap|tabak|menu|menü|serpme|paylaş|paylas/.test(hay)) score += 18;
        if (/salata|çorba|corba|smoothie/.test(hay)) score -= 8;
      } else {
        if (cal > 0 && cal >= 350 && cal <= 750) score += 15;
        score += 5;
      }

      if (taste === 'sweet') {
        if (/tatli|tatlı|dessert|cikolata|çikolata|tiramisu|sufle|pasta|dondurma|bal|waffle/.test(hay))
          score += 28;
        else score -= 8;
      } else if (taste === 'fresh') {
        if (/salata|meyve|smoothie|avokado|yogurt|yoğurt|detox|taze|portakal/.test(hay)) score += 24;
        if (/kızart|kizart|burger|sucuk/.test(hay)) score -= 6;
      } else {
        if (/burger|pizza|tavuk|et |kebap|makarna|tost|kahvalti|kahvaltı|main|ana/.test(hay))
          score += 18;
        if (/tatli|tatlı|dessert|sufle/.test(hay)) score -= 10;
      }

      if (budget === 'low') {
        if (price <= 120) score += 22;
        else if (price <= 180) score += 8;
        else score -= 12;
      } else if (budget === 'high') {
        if (price >= 220) score += 18;
        else if (price < 120) score -= 6;
        if (p.isRecommended) score += 8;
      } else {
        if (price >= 100 && price <= 260) score += 14;
      }

      if (p.isRecommended) score += 6;
      if (p.isVegan && taste === 'fresh') score += 6;

      return {
        id: p.id,
        name,
        description,
        price,
        currency: priced.currency,
        imageUrl: parseProductImages(p)[0] ?? null,
        calories: p.calories,
        groupId: p.groupId,
        groupName: getGroupName(p.group.i18n, activeLang),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _s, ...rest }) => rest);

  res.json({ products: scored });
});

router.get('/:slug/groups/:groupId/products', async (req, res) => {
  const slug = req.params.slug;
  const groupId = Number(req.params.groupId);
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  if (campaignSlug && !campaign) {
    return res.status(404).json({ message: 'Kampanya bulunamadı' });
  }

  const group = await prisma.group.findFirst({
    where: { id: groupId, restaurantId: restaurant.id, isActive: true },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!group) return res.status(404).json({ message: 'Kategori bulunamadı' });

  const childIds = group.children.map((c) => c.id);
  const allProducts = await prisma.product.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      groupId: { in: [groupId, ...childIds] },
      ...(campaign ? { id: { in: campaign.productIds } } : {}),
    },
    include: { currency: true },
    orderBy: { sortOrder: 'asc' },
  });

  await trackView(restaurant.id, 'group', groupId, sessionId, req, activeLang);

  function mapProduct(p: (typeof allProducts)[number]) {
    const images = parseProductImages(p);
    const priced = applyCampaignPrice(
      p.id,
      {
        price: Number(p.price),
        currency: mapCurrency(p.currency),
      },
      campaign,
      mapCurrency
    );
    return {
      id: p.id,
      name: getProductField(p.i18n, activeLang, 'name'),
      description: getProductField(p.i18n, activeLang, 'description'),
      price: priced.price,
      currency: priced.currency,
      imageUrl: images[0] ?? null,
      calories: p.calories ?? null,
      isRecommended: p.isRecommended,
      allergens: getProductField(p.i18n, activeLang, 'allergens'),
      allergenTags: parseAllergenTags(p.allergenTags),
      isVegan: p.isVegan,
      isVegetarian: p.isVegetarian,
      isGlutenFree: p.isGlutenFree,
      isDiabetic: p.isDiabetic,
      groupId: p.groupId,
      sortOrder: campaign?.itemByProductId.get(p.id)?.sortOrder ?? p.sortOrder,
    };
  }

  const mappedAll = allProducts
    .map(mapProduct)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const strip = <T extends { sortOrder: number }>(rows: T[]) =>
    rows.map(({ sortOrder: _s, ...rest }) => rest);

  const mapped = strip(mappedAll.filter((p) => p.groupId === groupId));

  const children = group.children
    .map((c) => {
      const childProducts = strip(mappedAll.filter((p) => p.groupId === c.id));
      if (childProducts.length === 0) return null;
      return {
        id: c.id,
        name: getGroupName(c.i18n, activeLang),
        imageUrl: c.imageUrl,
        products: childProducts,
      };
    })
    .filter(Boolean);

  res.json({
    group: {
      id: group.id,
      name: getGroupName(group.i18n, activeLang),
      imageUrl: group.imageUrl,
    },
    campaign: campaignMeta(campaign),
    products: mapped,
    children,
  });
});

router.get('/:slug/popular-products', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
  const campaignSlug = getCampaignSlug(req.query);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  if (campaignSlug && !campaign) {
    return res.json([]);
  }

  if (campaign && campaign.productIds.length === 0) {
    return res.json([]);
  }

  const campaignFilter = campaign ? { id: { in: campaign.productIds } } : {};

  /** Sadece admin “Önerilen ürün” işaretli ürünler — görüntüleme/rastgele yok */
  const products = await prisma.product.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      isRecommended: true,
      ...campaignFilter,
    },
    include: { group: true, currency: true },
    orderBy: { sortOrder: 'asc' },
    take: limit,
  });

  const items = products.map((p) => {
    const priced = applyCampaignPrice(
      p.id,
      {
        price: Number(p.price),
        currency: mapCurrency(p.currency),
      },
      campaign,
      mapCurrency
    );
    return {
      id: p.id,
      name: getProductField(p.i18n, activeLang, 'name'),
      price: priced.price,
      currency: priced.currency,
      imageUrl: parseProductImages(p)[0] ?? null,
      calories: p.calories ?? null,
      allergens: getProductField(p.i18n, activeLang, 'allergens'),
      allergenTags: parseAllergenTags(p.allergenTags),
      isVegan: p.isVegan,
      isVegetarian: p.isVegetarian,
      isGlutenFree: p.isGlutenFree,
      isDiabetic: p.isDiabetic,
      groupId: p.groupId,
      groupName: getGroupName(p.group.i18n, activeLang),
    };
  });

  res.json(items);
});

router.get('/:slug/search', async (req, res) => {
  const slug = req.params.slug;
  const q = String(req.query.q || '').toLowerCase();
  const lang = getLangCode(req);
  const campaignSlug = getCampaignSlug(req.query);

  if (!q) return res.json([]);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const activeLang = language?.code || 'tr';
  const campaign = await loadCampaignContext(restaurant.id, campaignSlug);

  if (campaignSlug && !campaign) {
    return res.json([]);
  }

  const products = await prisma.product.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      ...(campaign ? { id: { in: campaign.productIds } } : {}),
    },
    include: { group: true, currency: true },
    take: 100,
  });

  const filtered = products
    .filter((p) => textMatchesI18n(p.i18n, activeLang, ['name'], q))
    .slice(0, 20);

  res.json(
    filtered.map((p) => {
      const priced = applyCampaignPrice(
        p.id,
        {
          price: Number(p.price),
          currency: mapCurrency(p.currency),
        },
        campaign,
        mapCurrency
      );
      return {
        id: p.id,
        name: getProductField(p.i18n, activeLang, 'name'),
        price: priced.price,
        currency: priced.currency,
        imageUrl: parseProductImages(p)[0] ?? null,
        allergens: getProductField(p.i18n, activeLang, 'allergens'),
        allergenTags: parseAllergenTags(p.allergenTags),
        isVegan: p.isVegan,
        isVegetarian: p.isVegetarian,
        isGlutenFree: p.isGlutenFree,
        isDiabetic: p.isDiabetic,
        groupName: getGroupName(p.group.i18n, activeLang),
        groupId: p.groupId,
      };
    })
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

router.post('/:slug/table-request', async (req, res) => {
  const slug = req.params.slug;
  const { type, tableNumber, groupSlug, note, order } = req.body as {
    type?: string;
    tableNumber?: string;
    groupSlug?: string;
    note?: string;
    order?: {
      items?: {
        name?: string;
        qty?: number;
        price?: number;
        calories?: number | null;
      }[];
      totalPrice?: number;
      totalCalories?: number | null;
      currency?: { code?: string; symbol?: string } | null;
    };
  };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const tableServiceSetting = await prisma.setting.findFirst({
    where: { restaurantId: restaurant.id, key: MENU_TABLE_SERVICE_KEY },
  });
  if (!isTableServiceEnabled(tableServiceSetting?.value)) {
    return res.status(403).json({ message: 'Masa hizmeti kapalı' });
  }

  const requestType = String(type || '').trim();
  if (requestType !== 'waiter') {
    return res.status(400).json({ message: 'Geçersiz istek türü' });
  }

  const masa = String(tableNumber || '').trim();
  if (!masa || masa.length > 40) {
    return res.status(400).json({ message: 'Masa numarası gerekli' });
  }

  const grup = groupSlug ? String(groupSlug).trim().slice(0, 100) : null;

  const codeCfg = await loadTableSessionCodeConfig(restaurant.id);
  if (codeCfg.enabled && masa !== 'admin') {
    const session = await findActiveSession(restaurant.id, masa, grup);
    if (!session || !isCodeVerified(session)) {
      return res.status(403).json({
        message: 'Önce masa kodunu girin',
        code: 'CODE_REQUIRED',
      });
    }
  }

  const noteText = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  let orderJson: string | null = null;
  if (order && Array.isArray(order.items) && order.items.length > 0) {
    const items = order.items
      .slice(0, 40)
      .map((i) => ({
        name: String(i.name || '').trim().slice(0, 120),
        qty: Math.min(99, Math.max(1, Number(i.qty) || 1)),
        price: Number(i.price) || 0,
        calories:
          i.calories != null && Number(i.calories) > 0 ? Number(i.calories) : null,
      }))
      .filter((i) => i.name);
    if (items.length > 0) {
      orderJson = JSON.stringify({
        items,
        totalPrice: Number(order.totalPrice) || items.reduce((s, i) => s + i.price * i.qty, 0),
        totalCalories:
          order.totalCalories != null && Number(order.totalCalories) > 0
            ? Number(order.totalCalories)
            : null,
        currency: order.currency ?? null,
        note: noteText || null,
      });
    }
  }

  const recent = await prisma.tableServiceRequest.findFirst({
    where: {
      restaurantId: restaurant.id,
      tableNumber: masa,
      type: requestType,
      createdAt: { gte: new Date(Date.now() - 45_000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    return res.status(429).json({ message: 'Kısa süre önce iletildi, lütfen bekleyin' });
  }

  const row = await prisma.tableServiceRequest.create({
    data: {
      restaurantId: restaurant.id,
      type: requestType,
      tableNumber: masa,
      groupSlug: grup,
      note: noteText || null,
      orderJson,
    },
  });

  // Masa görünümü: oturumu aç + müşteri siparişini ekle
  if (masa !== 'admin') {
    try {
      const session = await openOrGetSession(restaurant.id, masa, grup, 'qr');
      if (orderJson) {
        const parsed = JSON.parse(orderJson) as {
          items?: { name?: string; qty?: number; price?: number }[];
        };
        const lines: FloorOrderItem[] = (parsed.items || [])
          .filter((i) => i.name)
          .map((i) => ({
            id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: String(i.name).slice(0, 120),
            qty: Math.min(99, Math.max(1, Number(i.qty) || 1)),
            price: Number(i.price) || 0,
            createdAt: new Date().toISOString(),
            source: 'customer' as const,
          }));
        if (lines.length) await appendOrdersToSession(session.id, lines);
      }
    } catch {
      /* floor sync best-effort */
    }
  }

  res.status(201).json({
    ok: true,
    id: row.id,
    type: row.type,
    tableNumber: row.tableNumber,
    groupSlug: row.groupSlug,
    note: row.note,
    orderJson: row.orderJson,
    createdAt: row.createdAt.toISOString(),
  });
});

/** QR okutulunca / menü açılınca masa oturumu başlat */
router.post('/:slug/table-checkin', async (req, res) => {
  const slug = req.params.slug;
  const { tableNumber, groupSlug, lat, lng } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    lat?: number;
    lng?: number;
  };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  if (await isMaintenanceEnabled(restaurant.id)) {
    return res.status(503).json({
      message: 'Menü bakımda',
      code: 'MAINTENANCE',
    });
  }

  const masa = String(tableNumber || '').trim();
  if (!masa || masa === 'admin' || masa.length > 40) {
    return res.status(400).json({ message: 'Geçersiz masa' });
  }

  const geo = await loadGeoLock(restaurant.id);
  if (geo.enabled) {
    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!isWithinGeoLock(geo, userLat, userLng)) {
      return res.status(403).json({
        message: 'Bölge dışındasınız',
        code: 'GEO_OUTSIDE',
      });
    }
  }

  const grup = groupSlug ? String(groupSlug).trim().slice(0, 100) : null;
  const session = await openOrGetSession(restaurant.id, masa, grup, 'qr');

  res.json({
    ok: true,
    sessionId: session.id,
    openedAt: session.openedAt.toISOString(),
    openedBy: session.openedBy,
  });
});

/** Masa erişim kodu kapısı durumu */
router.get('/:slug/table-session-gate', async (req, res) => {
  const slug = req.params.slug;
  const masa = String(req.query.masa || '').trim();
  const grup = String(req.query.grup || '').trim().slice(0, 100) || null;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const codeCfg = await loadTableSessionCodeConfig(restaurant.id);
  if (!codeCfg.enabled || !masa || masa === 'admin') {
    return res.json({
      enabled: false,
      needsCode: false,
      tableNumber: masa || null,
      groupSlug: grup,
      status: 'empty',
      ttlMinutes: codeCfg.ttlMinutes,
    });
  }

  const session = await openOrGetSession(restaurant.id, masa, grup, 'qr');
  const status = resolveCodeGateStatus(session);
  res.json({
    enabled: true,
    needsCode: status !== 'verified',
    tableNumber: masa,
    groupSlug: grup,
    status,
    expiresAt: session.codeExpiresAt?.toISOString() || null,
    ttlMinutes: codeCfg.ttlMinutes,
  });
});

/** Masa erişim kodunu doğrula */
router.post('/:slug/table-session-unlock', async (req, res) => {
  const slug = req.params.slug;
  const { tableNumber, groupSlug, code } = req.body as {
    tableNumber?: string;
    groupSlug?: string;
    code?: string;
  };

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const codeCfg = await loadTableSessionCodeConfig(restaurant.id);
  if (!codeCfg.enabled) {
    return res.json({ ok: true, verified: true, enabled: false });
  }

  const masa = String(tableNumber || '').trim();
  const grup = groupSlug ? String(groupSlug).trim().slice(0, 100) : null;
  const pin = String(code || '').replace(/\D/g, '').slice(0, 12);
  if (!masa || masa === 'admin') {
    return res.status(400).json({ message: 'Masa gerekli', code: 'TABLE_REQUIRED' });
  }
  if (pin.length < 4) {
    return res.status(400).json({ message: 'Geçersiz kod', code: 'BAD_CODE' });
  }

  let session = await findActiveSession(restaurant.id, masa, grup);
  if (!session) {
    session = await openOrGetSession(restaurant.id, masa, grup, 'qr');
  }

  if (!session.accessCode || session.accessCode !== pin) {
    return res.status(403).json({ message: 'Kod hatalı', code: 'CODE_MISMATCH' });
  }
  if (!session.codeExpiresAt || session.codeExpiresAt.getTime() <= Date.now()) {
    return res.status(403).json({ message: 'Kodun süresi dolmuş', code: 'CODE_EXPIRED' });
  }

  const updated = await prisma.tableFloorSession.update({
    where: { id: session.id },
    data: { codeVerifiedAt: new Date() },
  });

  res.json({
    ok: true,
    verified: true,
    enabled: true,
    expiresAt: updated.codeExpiresAt?.toISOString() || null,
    tableNumber: masa,
    groupSlug: grup,
  });
});

router.post('/:slug/track', async (req, res) => {
  const slug = req.params.slug;
  const { entityType, entityId, sessionId, lang } = req.body;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  if (entityType && entityId && sessionId) {
    await trackView(
      restaurant.id,
      entityType,
      Number(entityId),
      String(sessionId),
      req,
      lang != null ? String(lang) : null
    );
  }

  res.json({ ok: true });
});

export default router;
