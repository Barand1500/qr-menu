import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';
import { getLanguages, mergeWelcomeI18n, clearLanguageCache } from '../lib/i18n-json.js';
import { listCurrencies } from '../lib/currencies.js';
import {
  DEFAULT_MENU_THEME,
  DEFAULT_WELCOME_THEME,
  FREE_MENU_THEMES,
  FREE_WELCOME_THEMES,
  ownsAddon,
  themeIdToAddon,
} from '../addons/index.js';
import { parseSocialLinks, serializeSocialLinks, type SocialLinkConfig } from '../lib/social.js';
import { IMAGE_BACKGROUND_MODE_KEY, parseImageBackgroundMode } from '../lib/image-background.js';
import {
  IntegrationError,
  assertPublicHost,
  loadSmtp,
  loadSms,
  mergeSmtp,
  mergeSms,
  saveSmtp,
  saveSms,
  smsComplete,
  smsForClient,
  smtpComplete,
  smtpForClient,
} from '../lib/integrations.js';
import { explainSmtpError, sendSmtpTest, sendSms } from '../lib/integration-send.js';
import { loginMailConfigured } from '../lib/login-mail.js';
import { IMAGE_FIT_KEY, nextImageFit, parseImageFit } from '../lib/image-fit.js';
import {
  MENU_SERVICE_ITEMS_KEY,
  MENU_TABLE_SERVICE_KEY,
  parseServiceItemsInput,
} from '../lib/table-service.js';
import {
  MENU_GAMES_CONFIG_KEY,
  MENU_GAMES_KEY,
  parseMenuGamesConfig,
  type MenuGamesConfig,
} from '../lib/menu-games.js';
import {
  TABLE_SESSION_CODE_ENABLED_KEY,
  TABLE_SESSION_CODE_TTL_KEY,
  parseTableSessionCodeTtl,
} from '../lib/table-session-code.js';
import { parseVibration, parseVisitReminderMinutes, VIBRATION_KEY, VISIT_REMINDER_KEY } from '../lib/garson-board.js';
import { loadPrefCatalog,
  normalizePrefCatalogInput,
  PREF_CATALOG_KEY,
  serializePrefCatalog,
} from '../lib/pref-catalog.js';
import {
  INGREDIENT_POOL_KEY,
  loadIngredientPool,
  normalizeIngredientPool,
  serializeIngredientPool,
} from '../lib/ingredient-pool.js';
import {
  GEO_LOCK_KEY,
  loadGeoLock,
  parseGeoLock,
  serializeGeoLock,
  type GeoLockConfig,
} from '../lib/geo-lock.js';
import { isMaintenanceEnabled, setMaintenanceEnabled } from '../lib/maintenance.js';
import {
  TIME_MENU_KEY,
  parseTimeMenuConfig,
  serializeTimeMenuConfig,
  type TimeMenuConfig,
} from '../lib/time-menu.js';
import { ABOUT_PAGE_KEY, parseAboutPage, serializeAboutPage } from '../lib/about-page.js';
import type { AboutPageConfig } from '../lib/about-page.js';
import { REVIEWS_KEY, normalizeReviews, parseReviews, serializeReviews } from '../lib/reviews-config.js';
import { PlacesError, placesKey, searchPlaces, testPlace, clearPlacesCache } from '../lib/google-places.js';
import { CONTACT_CARD_KEY, normalizeContactCard, parseContactCard, serializeContactCard } from '../lib/contact-card.js';
import {
  ADMIN_PATH_KEY,
  DEFAULT_ADMIN_PATH,
  normalizeAdminPath,
  validateAdminPath,
} from '../lib/admin-path.js';
import {
  DEFAULT_SITE_TITLE,
  SITE_TITLE_KEY,
  validateSiteTitle,
} from '../lib/site-title.js';

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

  const [restaurant, languages, currencies, settings] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId! } }),
    // Admin listesi her zaman taze — process cache UI'da "DB'de var ama görünmüyor" yaratıyordu
    prisma.language.findMany({ orderBy: { id: 'asc' } }),
    listCurrencies(),
    prisma.setting.findMany({ where: { restaurantId: restaurantId! } }),
  ]);

  const welcomeMessages = languages.map((lang) => ({
    languageId: lang.id,
    languageCode: lang.code,
    message:
      (restaurant?.welcomeI18n as Record<string, { message?: string }>)?.[lang.code]?.message ||
      '',
  }));

  res.json({
    restaurant,
    languages,
    currencies,
    welcomeMessages,
    settings: Object.fromEntries(
      settings.filter((s) => !s.key.startsWith('admin_login_code_')).map((s) => [s.key, s.value])
    ),
  });
});

router.put('/languages', async (req, res) => {
  const { languages } = req.body as { languages: { id: number; isActive: boolean }[] };

  for (const lang of languages || []) {
    const existing = await prisma.language.findUnique({ where: { id: lang.id } });
    if (!existing) continue;
    // Türkçe her zaman aktif kalır; pasife alınamaz
    if (existing.code === 'tr') {
      if (!existing.isActive) {
        await prisma.language.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      continue;
    }
    await prisma.language.update({
      where: { id: lang.id },
      data: { isActive: lang.isActive },
    });
  }

  clearLanguageCache();
  const updated = await prisma.language.findMany({ orderBy: { id: 'asc' } });
  res.json(updated);
});

router.put('/currencies', async (req, res) => {
  const { currencies } = req.body as { currencies: { id: number; isActive: boolean }[] };

  for (const currency of currencies || []) {
    const existing = await prisma.currency.findUnique({ where: { id: currency.id } });
    if (!existing) continue;
    // Türk Lirası her zaman aktif kalır; pasife alınamaz
    if (existing.code === 'TRY') {
      if (!existing.isActive) {
        await prisma.currency.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      continue;
    }
    await prisma.currency.update({
      where: { id: currency.id },
      data: { isActive: currency.isActive },
    });
  }

  const updated = await prisma.currency.findMany({ orderBy: { id: 'asc' } });
  res.json(updated);
});

router.put('/welcome-messages', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { messages } = req.body as { messages: { languageId: number; message: string }[] };

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId! } });
  const languages = await getLanguages();
  const welcomeI18n = mergeWelcomeI18n(restaurant?.welcomeI18n, messages || [], languages);

  await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { welcomeI18n },
  });

  res.json({ ok: true });
});

router.get('/reviews', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: REVIEWS_KEY } },
  });
  res.json({ config: parseReviews(row?.value), keyConfigured: Boolean(placesKey()) });
});

router.put('/reviews', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const config = normalizeReviews((req.body as { config?: unknown } | undefined)?.config);
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: REVIEWS_KEY } },
    update: { value: serializeReviews(config) },
    create: { restaurantId: restaurantId!, key: REVIEWS_KEY, value: serializeReviews(config) },
  });
  clearPlacesCache();
  res.json({ config, keyConfigured: Boolean(placesKey()) });
});

// Visibility is saved independently: toggling must not discard an unfinished review draft.
router.patch('/reviews', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { channel, enabled } = req.body || {};
  if (!['manualEnabled', 'googleEnabled'].includes(channel) || typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'Geçersiz yorum görünürlüğü' });
  }
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: REVIEWS_KEY } },
  });
  const current = parseReviews(row?.value);
  if (channel === 'googleEnabled' && enabled && !current.placeId) {
    return res.status(400).json({ message: 'Önce seçtiğiniz Google işletmesini kaydedin.' });
  }
  const config = normalizeReviews({ ...current, [channel]: enabled });
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: REVIEWS_KEY } },
    update: { value: serializeReviews(config) },
    create: { restaurantId: restaurantId!, key: REVIEWS_KEY, value: serializeReviews(config) },
  });
  res.json({ config, keyConfigured: Boolean(placesKey()) });
});

router.get('/reviews/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  if (q.length > 120) return res.status(400).json({ message: 'Arama çok uzun' });
  try {
    res.json(await searchPlaces(q));
  } catch (e) {
    const err = e instanceof PlacesError ? e : new PlacesError('Arama başarısız');
    res.status(err.status).json({ message: err.message });
  }
});

router.post('/reviews/test', async (req, res) => {
  const placeId = String((req.body as { placeId?: unknown } | undefined)?.placeId || '');
  const clean = normalizeReviews({ placeId }).placeId;
  if (!clean) return res.status(400).json({ message: 'Önce bir işletme seçin' });
  try {
    const place = await testPlace(clean);
    res.json({
      name: place.name,
      address: place.address,
      rating: place.rating,
      count: place.count,
      reviewCount: place.reviews.length,
      sample: place.reviews[0] ? { name: place.reviews[0].name, text: place.reviews[0].text, rating: place.reviews[0].rating } : null,
    });
  } catch (e) {
    const err = e instanceof PlacesError ? e : new PlacesError('Test başarısız');
    res.status(err.status).json({ message: err.message });
  }
});

router.get('/contact-card', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [row, restaurant] = await Promise.all([
    prisma.setting.findUnique({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: CONTACT_CARD_KEY } },
    }),
    prisma.restaurant.findUnique({
      where: { id: restaurantId! },
      select: { name: true, slug: true, logoUrl: true },
    }),
  ]);
  res.json({ card: parseContactCard(row?.value), restaurant });
});

router.post('/contact-card/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fotoğraf gerekli' });
  if (!req.file.mimetype.startsWith('image/')) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    return res.status(400).json({ message: 'Yalnızca resim yüklenebilir' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.put('/contact-card', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const card = normalizeContactCard((req.body as { card?: unknown } | undefined)?.card);
  const value = serializeContactCard(card);
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: CONTACT_CARD_KEY } },
    update: { value },
    create: { restaurantId: restaurantId!, key: CONTACT_CARD_KEY, value },
  });
  res.json({ card });
});

router.put('/company', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name, about, aboutPage } = req.body as {
    name?: string;
    about?: string;
    aboutPage?: AboutPageConfig;
  };

  const restaurant = await prisma.restaurant.update({
    where: { id: restaurantId! },
    data: { ...(name !== undefined && { name }) },
  });

  let aboutText = about;
  if (aboutPage && typeof aboutPage === 'object') {
    const existingAbout = await prisma.setting.findUnique({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'company_about' } },
    });
    const parsed = parseAboutPage(JSON.stringify(aboutPage), existingAbout?.value || '');
    if (aboutText === undefined) aboutText = parsed.body;
    else parsed.body = aboutText;
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: ABOUT_PAGE_KEY } },
      update: { value: serializeAboutPage({ ...parsed, body: aboutText || parsed.body }) },
      create: {
        restaurantId: restaurantId!,
        key: ABOUT_PAGE_KEY,
        value: serializeAboutPage({ ...parsed, body: aboutText || parsed.body }),
      },
    });
  }

  if (aboutText !== undefined) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'company_about' } },
      update: { value: aboutText },
      create: { restaurantId: restaurantId!, key: 'company_about', value: aboutText },
    });
  }

  res.json(restaurant);
});

router.post('/about-cover', upload.single('cover'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (!req.file) return res.status(400).json({ message: 'Görsel gerekli' });
  const coverUrl = `/uploads/${req.file.filename}`;

  const aboutRow = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: 'company_about' } },
  });
  const pageRow = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: ABOUT_PAGE_KEY } },
  });
  const parsed = parseAboutPage(pageRow?.value, aboutRow?.value || '');
  parsed.coverUrl = coverUrl;
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: ABOUT_PAGE_KEY } },
    update: { value: serializeAboutPage(parsed) },
    create: {
      restaurantId: restaurantId!,
      key: ABOUT_PAGE_KEY,
      value: serializeAboutPage(parsed),
    },
  });

  res.json({ coverUrl });
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

// Ürün/grup görseli yüklerken arka plan silme: ask | auto | never (kayıt yoksa null = henüz seçilmedi)
router.get('/image-background', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: IMAGE_BACKGROUND_MODE_KEY } },
  });
  res.json({ mode: parseImageBackgroundMode(row?.value) });
});

router.put('/image-background', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const mode = parseImageBackgroundMode((req.body as { mode?: unknown })?.mode);
  if (!mode) return res.status(400).json({ message: 'Geçersiz seçim' });
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: IMAGE_BACKGROUND_MODE_KEY } },
    update: { value: mode },
    create: { restaurantId: restaurantId!, key: IMAGE_BACKGROUND_MODE_KEY, value: mode },
  });
  res.json({ mode });
});

router.get('/image-fit', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: IMAGE_FIT_KEY } },
  });
  res.json(parseImageFit(row?.value));
});

router.put('/image-fit', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const key = { restaurantId_key: { restaurantId: restaurantId!, key: IMAGE_FIT_KEY } };
  const row = await prisma.setting.findUnique({ where: key });
  const next = nextImageFit(req.body, parseImageFit(row?.value));
  const value = JSON.stringify(next);
  await prisma.setting.upsert({
    where: key,
    update: { value },
    create: { restaurantId: restaurantId!, key: IMAGE_FIT_KEY, value },
  });
  res.json(next);
});

// ───────── Entegrasyonlar: e-posta (SMTP) ve SMS ─────────
const integrationTests = new Map<number, number[]>();
/** Deneme gönderimleri kötüye kullanılmasın: işletme başına 5 dakikada en fazla 8. */
function allowIntegrationTest(restaurantId: number) {
  const now = Date.now();
  const recent = (integrationTests.get(restaurantId) ?? []).filter((t) => now - t < 5 * 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  integrationTests.set(restaurantId, recent);
  return true;
}

router.get('/integrations', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [smtp, sms] = await Promise.all([loadSmtp(restaurantId!), loadSms(restaurantId!)]);
  res.json({
    smtp: { ...smtpForClient(smtp), ready: smtpComplete(smtp) },
    sms: { ...smsForClient(sms), ready: smsComplete(sms) },
    systemMail: loginMailConfigured(),
  });
});

router.put('/integrations/smtp', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const next = mergeSmtp(req.body, await loadSmtp(restaurantId!));
  if (next.enabled && !smtpComplete(next)) {
    return res.status(400).json({ message: 'Açmak için sunucu, kullanıcı, şifre ve gönderen e-posta alanlarını doldurun.' });
  }
  if (next.host) {
    try {
      await assertPublicHost(next.host);
    } catch (e) {
      return res.status(400).json({ message: e instanceof Error ? e.message : 'Sunucu adresi geçersiz.' });
    }
  }
  await saveSmtp(restaurantId!, next);
  res.json({ ...smtpForClient(next), ready: smtpComplete(next) });
});

router.put('/integrations/sms', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const next = mergeSms(req.body, await loadSms(restaurantId!));
  if (next.enabled && !smsComplete(next)) {
    return res.status(400).json({ message: 'Açmak için seçili sağlayıcının tüm alanlarını doldurun.' });
  }
  await saveSms(restaurantId!, next);
  res.json({ ...smsForClient(next), ready: smsComplete(next) });
});

router.post('/integrations/smtp/test', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (!allowIntegrationTest(restaurantId!)) {
    return res.status(429).json({ message: 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.' });
  }
  const to = String(req.body?.to || '').trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || to.length > 190) {
    return res.status(400).json({ message: 'Geçerli bir alıcı e-posta adresi yazın.' });
  }
  const saved = await loadSmtp(restaurantId!);
  const cfg = req.body?.config ? mergeSmtp(req.body.config, saved) : saved;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId! }, select: { name: true } });
  try {
    const result = await sendSmtpTest(cfg, to, restaurant?.name || '');
    res.json({ ok: true, ms: result.ms });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof IntegrationError ? error.message : explainSmtpError(error),
    });
  }
});

router.post('/integrations/sms/test', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  if (!allowIntegrationTest(restaurantId!)) {
    return res.status(429).json({ message: 'Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.' });
  }
  const saved = await loadSms(restaurantId!);
  const cfg = req.body?.config ? mergeSms(req.body.config, saved) : saved;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId! }, select: { name: true } });
  try {
    const result = await sendSms(cfg, String(req.body?.to || ''), `${restaurant?.name || 'Menu QR'}: SMS bağlantınız çalışıyor.`);
    res.json({ ok: true, ms: result.ms });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof IntegrationError ? error.message : 'Gönderilemedi. Ayarları kontrol edip tekrar deneyin.',
    });
  }
});

router.put('/integration', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { enabled, config: integrationConfig, openaiApiKey } = req.body as {
    enabled?: boolean;
    config?: unknown;
    openaiApiKey?: string;
  };

  if (enabled !== undefined) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'integration_enabled' } },
      update: { value: String(enabled) },
      create: { restaurantId: restaurantId!, key: 'integration_enabled', value: String(enabled) },
    });
  }

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

  if (openaiApiKey !== undefined) {
    const trimmed = openaiApiKey.trim();
    if (trimmed) {
      await prisma.setting.upsert({
        where: { restaurantId_key: { restaurantId: restaurantId!, key: 'openai_api_key' } },
        update: { value: trimmed },
        create: { restaurantId: restaurantId!, key: 'openai_api_key', value: trimmed },
      });
    } else {
      await prisma.setting.deleteMany({
        where: { restaurantId: restaurantId!, key: 'openai_api_key' },
      });
    }
  }

  res.json({ ok: true });
});

router.put('/social', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { links } = req.body as { links?: SocialLinkConfig[] };

  const value = serializeSocialLinks(Array.isArray(links) ? links : []);
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: 'social_links' } },
    update: { value },
    create: { restaurantId: restaurantId!, key: 'social_links', value },
  });

  res.json({ ok: true, links: parseSocialLinks(value) });
});

router.put('/welcome-music', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { url } = req.body as { url?: string };
  const value = typeof url === 'string' ? url.trim() : '';

  if (value) {
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'welcome_music_url' } },
      update: { value },
      create: { restaurantId: restaurantId!, key: 'welcome_music_url', value },
    });
  } else {
    await prisma.setting.deleteMany({
      where: { restaurantId: restaurantId!, key: 'welcome_music_url' },
    });
  }

  res.json({ ok: true, url: value || null });
});

router.put('/menu-features', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { serviceItems, tableSessionCode, tableSessionCodeTtlMinutes, menuGames, garsonVisitMinutes, garsonVibration } = req.body as {
    garsonVibration?: unknown;
    garsonVisitMinutes?: number;
    serviceItems?: unknown;
    tableSessionCode?: boolean;
    tableSessionCodeTtlMinutes?: number;
    menuGames?: boolean;
  };

  if (serviceItems !== undefined) {
    const items = parseServiceItemsInput(serviceItems);
    if (!items) return res.status(400).json({ message: 'Servis listesi geçersiz' });
    const anyOn = items.some((i) => i.enabled);
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: MENU_SERVICE_ITEMS_KEY } },
      update: { value: JSON.stringify(items) },
      create: {
        restaurantId: restaurantId!,
        key: MENU_SERVICE_ITEMS_KEY,
        value: JSON.stringify(items),
      },
    });
    // Eski tek anahtar da tutarlı kalsın (hiçbiri açık değilse kapalı)
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: MENU_TABLE_SERVICE_KEY } },
      update: { value: anyOn ? 'true' : 'false' },
      create: {
        restaurantId: restaurantId!,
        key: MENU_TABLE_SERVICE_KEY,
        value: anyOn ? 'true' : 'false',
      },
    });
  }

  if (typeof menuGames === 'boolean') {
    const legacy = await prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_KEY },
    });
    const existing = await prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_CONFIG_KEY },
    });
    const cfg = parseMenuGamesConfig(existing?.value, legacy?.value);
    cfg.enabled = menuGames;
    await prisma.setting.upsert({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_GAMES_CONFIG_KEY },
      },
      update: { value: JSON.stringify(cfg) },
      create: {
        restaurantId: restaurantId!,
        key: MENU_GAMES_CONFIG_KEY,
        value: JSON.stringify(cfg),
      },
    });
  }

  if (typeof tableSessionCode === 'boolean') {
    await prisma.setting.upsert({
      where: {
        restaurantId_key: {
          restaurantId: restaurantId!,
          key: TABLE_SESSION_CODE_ENABLED_KEY,
        },
      },
      update: { value: tableSessionCode ? 'true' : 'false' },
      create: {
        restaurantId: restaurantId!,
        key: TABLE_SESSION_CODE_ENABLED_KEY,
        value: tableSessionCode ? 'true' : 'false',
      },
    });
  }

  if (garsonVibration != null && typeof garsonVibration === 'object') {
    const value = JSON.stringify(parseVibration(garsonVibration));
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: VIBRATION_KEY } },
      update: { value },
      create: { restaurantId: restaurantId!, key: VIBRATION_KEY, value },
    });
  }

  if (garsonVisitMinutes != null) {
    const minutes = parseVisitReminderMinutes(String(garsonVisitMinutes));
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: VISIT_REMINDER_KEY } },
      update: { value: String(minutes) },
      create: { restaurantId: restaurantId!, key: VISIT_REMINDER_KEY, value: String(minutes) },
    });
  }

  if (tableSessionCodeTtlMinutes != null) {
    const ttl = parseTableSessionCodeTtl(String(tableSessionCodeTtlMinutes));
    await prisma.setting.upsert({
      where: {
        restaurantId_key: {
          restaurantId: restaurantId!,
          key: TABLE_SESSION_CODE_TTL_KEY,
        },
      },
      update: { value: String(ttl) },
      create: {
        restaurantId: restaurantId!,
        key: TABLE_SESSION_CODE_TTL_KEY,
        value: String(ttl),
      },
    });
  }

  res.json({
    ok: true,
    menuGames: menuGames ?? true,
    tableSessionCode: tableSessionCode ?? false,
    tableSessionCodeTtlMinutes:
      tableSessionCodeTtlMinutes != null
        ? parseTableSessionCodeTtl(String(tableSessionCodeTtlMinutes))
        : undefined,
  });
});

router.get('/menu-games', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [cfgRow, legacy] = await Promise.all([
    prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_CONFIG_KEY },
    }),
    prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_KEY },
    }),
  ]);
  res.json({
    ok: true,
    config: parseMenuGamesConfig(cfgRow?.value, legacy?.value),
  });
});

router.put('/menu-games', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body as Partial<MenuGamesConfig>;
  const [cfgRow, legacy] = await Promise.all([
    prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_CONFIG_KEY },
    }),
    prisma.setting.findFirst({
      where: { restaurantId: restaurantId!, key: MENU_GAMES_KEY },
    }),
  ]);
  const current = parseMenuGamesConfig(cfgRow?.value, legacy?.value);
  const next: MenuGamesConfig = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    memory: {
      enabled:
        typeof body.memory?.enabled === 'boolean' ? body.memory.enabled : current.memory.enabled,
      pairCount:
        body.memory?.pairCount === 4 || body.memory?.pairCount === 6 || body.memory?.pairCount === 8
          ? body.memory.pairCount
          : current.memory.pairCount,
      pairs: Array.isArray(body.memory?.pairs) ? body.memory!.pairs : current.memory.pairs,
      pool: Array.isArray(body.memory?.pool) ? body.memory!.pool : current.memory.pool,
    },
    xox: {
      enabled: typeof body.xox?.enabled === 'boolean' ? body.xox.enabled : current.xox.enabled,
    },
    detective: {
      enabled:
        typeof body.detective?.enabled === 'boolean'
          ? body.detective.enabled
          : current.detective.enabled,
      questions: Array.isArray(body.detective?.questions)
        ? body.detective!.questions
        : current.detective.questions,
    },
    blitz: {
      enabled:
        typeof body.blitz?.enabled === 'boolean' ? body.blitz.enabled : current.blitz.enabled,
    },
  };
  const normalized = parseMenuGamesConfig(JSON.stringify(next));
  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_GAMES_CONFIG_KEY },
    },
    update: { value: JSON.stringify(normalized) },
    create: {
      restaurantId: restaurantId!,
      key: MENU_GAMES_CONFIG_KEY,
      value: JSON.stringify(normalized),
    },
  });
  res.json({ ok: true, config: normalized });
});

router.post('/menu-games/images', upload.array('images', 24), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) return res.status(400).json({ message: 'Görsel gerekli' });
  const urls = files.map((f) => `/uploads/${f.filename}`);
  res.json({ ok: true, urls });
});

router.post('/social-icon', upload.single('icon'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'İkon gerekli' });
  const iconUrl = `/uploads/${req.file.filename}`;
  res.json({ iconUrl });
});

router.put('/themes', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { welcome, menu } = req.body as { welcome?: string; menu?: string };

  if (welcome !== undefined) {
    if (!FREE_WELCOME_THEMES.has(welcome)) {
      const addonId = themeIdToAddon('welcome', welcome);
      const allowed = addonId ? await ownsAddon(restaurantId!, addonId) : false;
      if (!allowed) {
        return res.status(403).json({
          message: 'Bu karşılama teması kilitli. Eklentiler’den kod ile açın.',
        });
      }
    }
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'theme_welcome' } },
      update: { value: welcome || DEFAULT_WELCOME_THEME },
      create: {
        restaurantId: restaurantId!,
        key: 'theme_welcome',
        value: welcome || DEFAULT_WELCOME_THEME,
      },
    });
  }

  if (menu !== undefined) {
    if (!FREE_MENU_THEMES.has(menu)) {
      const addonId = themeIdToAddon('menu', menu);
      const allowed = addonId ? await ownsAddon(restaurantId!, addonId) : false;
      if (!allowed) {
        return res.status(403).json({
          message: 'Bu menü teması kilitli. Eklentiler’den kod ile açın.',
        });
      }
    }
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId: restaurantId!, key: 'theme_menu' } },
      update: { value: menu || DEFAULT_MENU_THEME },
      create: {
        restaurantId: restaurantId!,
        key: 'theme_menu',
        value: menu || DEFAULT_MENU_THEME,
      },
    });
  }

  const rows = await prisma.setting.findMany({
    where: {
      restaurantId: restaurantId!,
      key: { in: ['theme_welcome', 'theme_menu'] },
    },
  });
  const map = Object.fromEntries(rows.map((s) => [s.key, s.value]));
  res.json({
    welcome: map.theme_welcome || DEFAULT_WELCOME_THEME,
    menu: map.theme_menu || DEFAULT_MENU_THEME,
  });
});

router.get('/pref-catalog', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const catalog = await loadPrefCatalog(restaurantId!);
  res.json(catalog);
});

router.put('/pref-catalog', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const catalog = normalizePrefCatalogInput(req.body);
  if (!catalog) {
    return res.status(400).json({ message: 'Geçersiz katalog verisi' });
  }

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: PREF_CATALOG_KEY } },
    update: { value: serializePrefCatalog(catalog) },
    create: {
      restaurantId: restaurantId!,
      key: PREF_CATALOG_KEY,
      value: serializePrefCatalog(catalog),
    },
  });

  res.json(catalog);
});

router.get('/ingredient-pool', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const pool = await loadIngredientPool(restaurantId!);
  res.json(pool);
});

router.put('/ingredient-pool', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const pool = normalizeIngredientPool(req.body);
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: INGREDIENT_POOL_KEY } },
    update: { value: serializeIngredientPool(pool) },
    create: {
      restaurantId: restaurantId!,
      key: INGREDIENT_POOL_KEY,
      value: serializeIngredientPool(pool),
    },
  });
  res.json(pool);
});

router.get('/geo-lock', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const cfg = await loadGeoLock(restaurantId!);
  res.json(cfg);
});

router.put('/geo-lock', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body as Partial<GeoLockConfig>;
  const current = await loadGeoLock(restaurantId!);
  const next = parseGeoLock(
    JSON.stringify({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      lat: body.lat ?? current.lat,
      lng: body.lng ?? current.lng,
      radiusMeters: body.radiusMeters ?? current.radiusMeters,
    })
  );

  if (next.enabled && (!Number.isFinite(next.lat) || !Number.isFinite(next.lng))) {
    return res.status(400).json({ message: 'Konum seçin' });
  }

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: GEO_LOCK_KEY } },
    update: { value: serializeGeoLock(next) },
    create: {
      restaurantId: restaurantId!,
      key: GEO_LOCK_KEY,
      value: serializeGeoLock(next),
    },
  });

  res.json(next);
});

/** Nominatim proxy (tarayıcı CORS yok) */
router.get('/geo-search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  if (q.length > 120) return res.status(400).json({ message: 'Arama çok uzun' });

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'tr');

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MenuQR-Admin/1.0 (geo-lock settings)',
        'Accept-Language': 'tr',
      },
    });
    if (!upstream.ok) {
      return res.status(502).json({ message: 'Harita araması başarısız' });
    }
    const rows = (await upstream.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    res.json(
      rows
        .map((r) => ({
          label: r.display_name || '',
          lat: Number(r.lat),
          lng: Number(r.lon),
        }))
        .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    );
  } catch {
    res.status(502).json({ message: 'Harita araması başarısız' });
  }
});

router.get('/maintenance', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const enabled = await isMaintenanceEnabled(restaurantId!);
  res.json({ enabled });
});

router.put('/maintenance', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const enabled = Boolean((req.body as { enabled?: boolean }).enabled);
  await setMaintenanceEnabled(restaurantId!, enabled);
  res.json({ enabled });
});

router.get('/time-menu', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findFirst({
    where: { restaurantId: restaurantId!, key: TIME_MENU_KEY },
  });
  res.json({ ok: true, config: parseTimeMenuConfig(row?.value ?? null) });
});

router.put('/time-menu', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = (req.body ?? {}) as Partial<TimeMenuConfig>;
  const current = parseTimeMenuConfig(
    (
      await prisma.setting.findFirst({
        where: { restaurantId: restaurantId!, key: TIME_MENU_KEY },
      })
    )?.value ?? null
  );
  const next: TimeMenuConfig = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    timezone:
      typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : current.timezone,
    slots: Array.isArray(body.slots) ? body.slots : current.slots,
    rules: Array.isArray(body.rules) ? body.rules : current.rules,
  };
  const normalized = parseTimeMenuConfig(JSON.stringify(next));
  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: TIME_MENU_KEY },
    },
    update: { value: serializeTimeMenuConfig(normalized) },
    create: {
      restaurantId: restaurantId!,
      key: TIME_MENU_KEY,
      value: serializeTimeMenuConfig(normalized),
    },
  });
  res.json({ ok: true, config: normalized });
});

router.get('/admin-path', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: ADMIN_PATH_KEY } },
  });
  res.json({ path: normalizeAdminPath(row?.value) || DEFAULT_ADMIN_PATH });
});

router.put('/admin-path', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const checked = validateAdminPath((req.body as { path?: string }).path);
  if (!checked.ok) return res.status(400).json({ message: checked.message });

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: ADMIN_PATH_KEY } },
    update: { value: checked.path },
    create: { restaurantId: restaurantId!, key: ADMIN_PATH_KEY, value: checked.path },
  });

  res.json({ path: checked.path });
});

router.get('/site-title', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: SITE_TITLE_KEY } },
  });
  const title = String(row?.value || '').trim() || DEFAULT_SITE_TITLE;
  res.json({ title });
});

router.put('/site-title', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const checked = validateSiteTitle((req.body as { title?: string }).title);
  if (!checked.ok) return res.status(400).json({ message: checked.message });

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId: restaurantId!, key: SITE_TITLE_KEY } },
    update: { value: checked.title },
    create: { restaurantId: restaurantId!, key: SITE_TITLE_KEY, value: checked.title },
  });

  res.json({ title: checked.title });
});

export default router;
