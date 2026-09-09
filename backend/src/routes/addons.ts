import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import {
  ADDON_PRODUCTS,
  getDisabledAddons,
  getOwnedAddons,
  ownsAddon,
  resetOwnedAddons,
  setAddonEnabled,
  unlockAddon,
  validateUnlockCode,
} from '../addons/index.js';
import {
  MENU_ASSISTANT_STYLE_KEY,
  parseMenuAssistantStyle,
} from '../lib/menu-assistant-style.js';
import {
  MENU_LINEAR_CONFIG_KEY,
  parseLinearThemeConfig,
  serializeLinearThemeConfig,
  type LinearThemeConfig,
} from '../lib/menu-linear-config.js';
import {
  MENU_ANIMASYON_CONFIG_KEY,
  parseAnimasyonThemeConfig,
  serializeAnimasyonThemeConfig,
  type AnimasyonThemeConfig,
} from '../lib/menu-animasyon-config.js';
import {
  MENU_SADE_CONFIG_KEY,
  parseSadeThemeConfig,
  serializeSadeThemeConfig,
  type SadeThemeConfig,
} from '../lib/menu-sade-config.js';
import {
  MENU_ALIVE_CONFIG_KEY,
  parseAliveThemeConfig,
  serializeAliveThemeConfig,
  type AliveThemeConfig,
} from '../lib/menu-alive-config.js';
import {
  MENU_LUXURY_CONFIG_KEY,
  parseLuxuryThemeConfig,
  serializeLuxuryThemeConfig,
  type LuxuryThemeConfig,
} from '../lib/menu-luxury-config.js';
import {
  WELCOME_BASKETBALL_CONFIG_KEY,
  parseWelcomeBasketballConfig,
  serializeWelcomeBasketballConfig,
  type WelcomeBasketballConfig,
} from '../lib/welcome-basketball-config.js';
import {
  WELCOME_CUPS_CONFIG_KEY,
  parseWelcomeCupsConfig,
  serializeWelcomeCupsConfig,
  type WelcomeCupsConfig,
} from '../lib/welcome-cups-config.js';

const router = Router();
router.use(authRequired);

async function getMenuAssistantStyle(restaurantId: number) {
  const row = await prisma.setting.findUnique({
    where: {
      restaurantId_key: { restaurantId, key: MENU_ASSISTANT_STYLE_KEY },
    },
  });
  return parseMenuAssistantStyle(row?.value);
}

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [
    owned,
    disabled,
    menuAssistantStyle,
    linearRow,
    animasyonRow,
    sadeRow,
    aliveRow,
    luxuryRow,
    basketballRow,
    cupsRow,
  ] = await Promise.all([
    getOwnedAddons(restaurantId!),
    getDisabledAddons(restaurantId!),
    getMenuAssistantStyle(restaurantId!),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_LINEAR_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_ANIMASYON_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_SADE_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_ALIVE_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: MENU_LUXURY_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: WELCOME_BASKETBALL_CONFIG_KEY },
      },
    }),
    prisma.setting.findUnique({
      where: {
        restaurantId_key: { restaurantId: restaurantId!, key: WELCOME_CUPS_CONFIG_KEY },
      },
    }),
  ]);
  res.json({
    owned,
    disabled,
    menuAssistantStyle,
    linearConfig: parseLinearThemeConfig(linearRow?.value),
    animasyonConfig: parseAnimasyonThemeConfig(animasyonRow?.value),
    sadeConfig: parseSadeThemeConfig(sadeRow?.value),
    aliveConfig: parseAliveThemeConfig(aliveRow?.value),
    luxuryConfig: parseLuxuryThemeConfig(luxuryRow?.value),
    basketballConfig: parseWelcomeBasketballConfig(basketballRow?.value),
    cupsConfig: parseWelcomeCupsConfig(cupsRow?.value),
    products: ADDON_PRODUCTS.map((p) => {
      const isOwned = Boolean(p.free) || owned.includes(p.id);
      const enabled = isOwned && !disabled.includes(p.id);
      return {
        ...p,
        owned: isOwned,
        enabled,
      };
    }),
  });
});

router.post('/unlock', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { productId, code } = req.body as { productId?: string; code?: string };

  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(400).json({ message: 'Geçersiz eklenti' });
  }
  if (product.free) {
    return res.status(400).json({ message: 'Bu eklenti zaten dahil' });
  }

  if (!validateUnlockCode(product.id, String(code || ''))) {
    return res.status(400).json({ message: 'Kod hatalı' });
  }

  const owned = await unlockAddon(restaurantId!, product.id);
  const disabled = await getDisabledAddons(restaurantId!);
  res.json({
    ok: true,
    productId: product.id,
    owned,
    disabled,
    message: `“${product.name}” açıldı!`,
  });
});

router.patch('/:productId/enabled', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const productId = String(req.params.productId || '');
  const { enabled } = req.body as { enabled?: boolean };

  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(400).json({ message: 'Geçersiz eklenti' });
  }
  if (!product.toggleable) {
    return res.status(400).json({ message: 'Bu eklenti kapatılamaz' });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled gerekli' });
  }

  try {
    const result = await setAddonEnabled(restaurantId!, productId, enabled);
    res.json({
      ok: true,
      productId,
      enabled: result.enabled,
      disabled: result.disabled,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'OWNED_REQUIRED') {
      return res.status(403).json({ message: 'Önce eklentiyi satın alın' });
    }
    throw err;
  }
});

router.patch('/menu-assistant/style', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { style } = req.body as { style?: string };

  const owned = await ownsAddon(restaurantId!, 'menu-assistant');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Menü Asistanı eklentisini satın alın' });
  }

  const parsed = parseMenuAssistantStyle(style);
  if (!style || parsed !== style) {
    return res.status(400).json({ message: 'Geçersiz renk seçimi' });
  }

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_ASSISTANT_STYLE_KEY },
    },
    update: { value: parsed },
    create: { restaurantId: restaurantId!, key: MENU_ASSISTANT_STYLE_KEY, value: parsed },
  });

  res.json({ ok: true, style: parsed });
});

router.patch('/menu-linear/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'menu-linear');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Linear tema eklentisini satın alın' });
  }

  const body = (req.body || {}) as Partial<LinearThemeConfig>;
  const parsed = parseLinearThemeConfig(JSON.stringify(body));
  const value = serializeLinearThemeConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_LINEAR_CONFIG_KEY },
    },
    update: { value },
    create: { restaurantId: restaurantId!, key: MENU_LINEAR_CONFIG_KEY, value },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/menu-animasyon/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'menu-animasyon');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Animasyonlu tema eklentisini satın alın' });
  }

  const body = (req.body || {}) as Partial<AnimasyonThemeConfig>;
  const parsed = parseAnimasyonThemeConfig(JSON.stringify(body));
  const value = serializeAnimasyonThemeConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_ANIMASYON_CONFIG_KEY },
    },
    update: { value },
    create: { restaurantId: restaurantId!, key: MENU_ANIMASYON_CONFIG_KEY, value },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/menu-sade/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'menu-sade');
  if (!owned) {
    return res.status(403).json({ message: 'Sade tema kullanılamıyor' });
  }

  const body = (req.body || {}) as Partial<SadeThemeConfig>;
  const parsed = parseSadeThemeConfig(JSON.stringify(body));
  const value = serializeSadeThemeConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_SADE_CONFIG_KEY },
    },
    update: { value },
    create: { restaurantId: restaurantId!, key: MENU_SADE_CONFIG_KEY, value },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/menu-alive/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'menu-alive');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Canlı tema eklentisini satın alın' });
  }

  const body = (req.body || {}) as Partial<AliveThemeConfig>;
  const parsed = parseAliveThemeConfig(JSON.stringify(body));
  const value = serializeAliveThemeConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_ALIVE_CONFIG_KEY },
    },
    update: { value },
    create: { restaurantId: restaurantId!, key: MENU_ALIVE_CONFIG_KEY, value },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/menu-luxury/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'menu-luxury');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Lüks tema eklentisini satın alın' });
  }

  const body = (req.body || {}) as Partial<LuxuryThemeConfig>;
  const parsed = parseLuxuryThemeConfig(JSON.stringify(body));
  const value = serializeLuxuryThemeConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: MENU_LUXURY_CONFIG_KEY },
    },
    update: { value },
    create: { restaurantId: restaurantId!, key: MENU_LUXURY_CONFIG_KEY, value },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/welcome-basketball/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'welcome-basketball');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Basketbol Menü temasını satın alın' });
  }

  const body = (req.body || {}) as Partial<WelcomeBasketballConfig>;
  const parsed = parseWelcomeBasketballConfig(JSON.stringify(body));
  const value = serializeWelcomeBasketballConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: WELCOME_BASKETBALL_CONFIG_KEY },
    },
    update: { value },
    create: {
      restaurantId: restaurantId!,
      key: WELCOME_BASKETBALL_CONFIG_KEY,
      value,
    },
  });

  res.json({ ok: true, config: parsed });
});

router.patch('/welcome-cups/config', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await ownsAddon(restaurantId!, 'welcome-cups');
  if (!owned) {
    return res.status(403).json({ message: 'Önce Üç Bardak temasını satın alın' });
  }

  const body = (req.body || {}) as Partial<WelcomeCupsConfig>;
  const parsed = parseWelcomeCupsConfig(JSON.stringify(body));
  const value = serializeWelcomeCupsConfig(parsed);

  await prisma.setting.upsert({
    where: {
      restaurantId_key: { restaurantId: restaurantId!, key: WELCOME_CUPS_CONFIG_KEY },
    },
    update: { value },
    create: {
      restaurantId: restaurantId!,
      key: WELCOME_CUPS_CONFIG_KEY,
      value,
    },
  });

  res.json({ ok: true, config: parsed });
});

router.post('/reset', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const owned = await resetOwnedAddons(restaurantId!);
  res.json({
    ok: true,
    owned,
    disabled: [],
    message: 'Tüm satın alımlar geri alındı. Temalar ücretsiz varsayılana döndü.',
  });
});

export default router;
