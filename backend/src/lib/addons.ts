import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '../eklenti-urun.json');

export type AddonProductId =
  | 'welcome-cinema'
  | 'welcome-neon'
  | 'menu-alive'
  | 'menu-luxury'
  | 'qr-pack';

export const ADDON_PRODUCTS: {
  id: AddonProductId;
  category: 'welcome' | 'menu' | 'qr';
  name: string;
  description: string;
  themeId?: string;
}[] = [
  {
    id: 'welcome-cinema',
    category: 'welcome',
    name: 'Sinematik',
    description: 'Koyu film atmosferi, yavaş ışık geçişleri ve premium his.',
    themeId: 'cinema',
  },
  {
    id: 'welcome-neon',
    category: 'welcome',
    name: 'Neon Gece',
    description: 'Neon vurgular, ritmik parıltılar ve gece kulübü enerjisi.',
    themeId: 'neon',
  },
  {
    id: 'menu-alive',
    category: 'menu',
    name: 'Canlı',
    description: 'Daha güçlü hareket, glow ve dikkat çeken kategori kartları.',
    themeId: 'alive',
  },
  {
    id: 'menu-luxury',
    category: 'menu',
    name: 'Lüks',
    description: 'Altın vurgular, yumuşak gölgeler ve high-end restoran hissi.',
    themeId: 'luxury',
  },
  {
    id: 'qr-pack',
    category: 'qr',
    name: 'QR Paketi',
    description:
      'Renkli QR, logo ortalı QR, masa bazlı QR, kampanyalı link ve gelişmiş yazdırma.',
  },
];

const OWNED_KEY = 'addons_owned';

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

export async function getOwnedAddons(restaurantId: number): Promise<string[]> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: OWNED_KEY } },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function ownsAddon(restaurantId: number, productId: string) {
  const owned = await getOwnedAddons(restaurantId);
  return owned.includes(productId);
}

export async function unlockAddon(restaurantId: number, productId: string) {
  const owned = await getOwnedAddons(restaurantId);
  if (!owned.includes(productId)) {
    owned.push(productId);
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId, key: OWNED_KEY } },
      update: { value: JSON.stringify(owned) },
      create: {
        restaurantId,
        key: OWNED_KEY,
        value: JSON.stringify(owned),
      },
    });
  }
  return owned;
}

/** Test için: tüm satın alınan eklentileri sil + temaları ücretsiz varsayılana çek */
export async function resetOwnedAddons(restaurantId: number) {
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: OWNED_KEY } },
    update: { value: '[]' },
    create: { restaurantId, key: OWNED_KEY, value: '[]' },
  });

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: 'theme_welcome' } },
    update: { value: 'vibrant' },
    create: { restaurantId, key: 'theme_welcome', value: 'vibrant' },
  });

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: 'theme_menu' } },
    update: { value: 'sade' },
    create: { restaurantId, key: 'theme_menu', value: 'sade' },
  });

  return [] as string[];
}

export function themeIdToAddon(kind: 'welcome' | 'menu', themeId: string): AddonProductId | null {
  const found = ADDON_PRODUCTS.find(
    (p) => p.category === kind && p.themeId === themeId
  );
  return found?.id ?? null;
}
