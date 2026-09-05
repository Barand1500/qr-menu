import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { DEFAULT_MENU_THEME, DEFAULT_WELCOME_THEME } from './themes.js';
import { ADDON_PRODUCTS } from './catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../../eklenti-urun.json');

const OWNED_KEY = 'addons_owned';
const DISABLED_KEY = 'addons_disabled';

interface AddonConfig {
  masterKod?: string;
  urunKodlari?: Record<string, string>;
}

let cachedConfig: AddonConfig | null = null;
let cachedAt = 0;

export function loadAddonConfig(): AddonConfig {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < 5000) return cachedConfig;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(raw) as AddonConfig;
    cachedAt = now;
    return cachedConfig;
  } catch {
    cachedConfig = { masterKod: '241016', urunKodlari: {} };
    cachedAt = now;
    return cachedConfig;
  }
}

export function getExpectedCode(productId: string): string {
  const cfg = loadAddonConfig();
  const specific = cfg.urunKodlari?.[productId]?.trim();
  if (specific) return specific;
  return String(cfg.masterKod || '').trim();
}

export function validateUnlockCode(productId: string, code: string): boolean {
  const expected = getExpectedCode(productId);
  if (!expected) return false;
  return String(code || '').trim() === expected;
}

async function readIdList(restaurantId: number, key: string): Promise<string[]> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key } },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function writeIdList(restaurantId: number, key: string, ids: string[]) {
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key } },
    update: { value: JSON.stringify(ids) },
    create: { restaurantId, key, value: JSON.stringify(ids) },
  });
}

export async function getOwnedAddons(restaurantId: number): Promise<string[]> {
  return readIdList(restaurantId, OWNED_KEY);
}

export async function getDisabledAddons(restaurantId: number): Promise<string[]> {
  return readIdList(restaurantId, DISABLED_KEY);
}

export async function ownsAddon(restaurantId: number, productId: string) {
  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  if (product?.free) return true;
  const owned = await getOwnedAddons(restaurantId);
  return owned.includes(productId);
}

/** Satın alınmış ve kapatılmamış */
export async function isAddonActive(restaurantId: number, productId: string) {
  const product = ADDON_PRODUCTS.find((p) => p.id === productId);
  const disabled = await getDisabledAddons(restaurantId);
  if (product?.free) return !disabled.includes(productId);
  const owned = await getOwnedAddons(restaurantId);
  return owned.includes(productId) && !disabled.includes(productId);
}

export async function setAddonEnabled(
  restaurantId: number,
  productId: string,
  enabled: boolean
) {
  const owned = await getOwnedAddons(restaurantId);
  if (!owned.includes(productId)) {
    throw new Error('OWNED_REQUIRED');
  }
  let disabled = await getDisabledAddons(restaurantId);
  if (enabled) {
    disabled = disabled.filter((id) => id !== productId);
  } else if (!disabled.includes(productId)) {
    disabled = [...disabled, productId];
  }
  await writeIdList(restaurantId, DISABLED_KEY, disabled);
  return { enabled, disabled };
}

export async function unlockAddon(restaurantId: number, productId: string) {
  const owned = await getOwnedAddons(restaurantId);
  if (!owned.includes(productId)) {
    owned.push(productId);
    await writeIdList(restaurantId, OWNED_KEY, owned);
  }
  // Yeni açılan eklenti varsayılan açık
  const disabled = await getDisabledAddons(restaurantId);
  if (disabled.includes(productId)) {
    await writeIdList(
      restaurantId,
      DISABLED_KEY,
      disabled.filter((id) => id !== productId)
    );
  }
  return owned;
}

/** Test için: tüm satın alınan eklentileri sil + temaları ücretsiz varsayılana çek */
export async function resetOwnedAddons(restaurantId: number) {
  await writeIdList(restaurantId, OWNED_KEY, []);
  await writeIdList(restaurantId, DISABLED_KEY, []);

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: 'theme_welcome' } },
    update: { value: DEFAULT_WELCOME_THEME },
    create: { restaurantId, key: 'theme_welcome', value: DEFAULT_WELCOME_THEME },
  });

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: 'theme_menu' } },
    update: { value: DEFAULT_MENU_THEME },
    create: { restaurantId, key: 'theme_menu', value: DEFAULT_MENU_THEME },
  });

  return [] as string[];
}
