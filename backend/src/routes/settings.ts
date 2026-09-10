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
import { MENU_TABLE_SERVICE_KEY } from '../lib/table-service.js';
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
import { loadPrefCatalog,
  normalizePrefCatalogInput,
  PREF_CATALOG_KEY,
  serializePrefCatalog,
} from '../lib/pref-catalog.js';
import {
  GEO_LOCK_KEY,
  loadGeoLock,
  parseGeoLock,
  serializeGeoLock,
  type GeoLockConfig,
} from '../lib/geo-lock.js';
import { isMaintenanceEnabled, setMaintenanceEnabled } from '../lib/maintenance.js';
import { ABOUT_PAGE_KEY, parseAboutPage, serializeAboutPage } from '../lib/about-page.js';
import type { AboutPageConfig } from '../lib/about-page.js';
import {
  ADMIN_PATH_KEY,
  DEFAULT_ADMIN_PATH,
  normalizeAdminPath,
  validateAdminPath,
} from '../lib/admin-path.js';

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
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
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
  const { tableService, tableSessionCode, tableSessionCodeTtlMinutes, menuGames } = req.body as {
    tableService?: boolean;
    tableSessionCode?: boolean;
    tableSessionCodeTtlMinutes?: number;
    menuGames?: boolean;
  };

  if (typeof tableService === 'boolean') {
    await prisma.setting.upsert({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_TABLE_SERVICE_KEY },
      },
      update: { value: tableService ? 'true' : 'false' },
      create: {
        restaurantId: restaurantId!,
        key: MENU_TABLE_SERVICE_KEY,
        value: tableService ? 'true' : 'false',
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
    tableService: tableService ?? true,
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

export default router;
