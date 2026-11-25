import { prisma } from './prisma.js';
import { SOFRA_SETTINGS_KEY, parseSofraConfig, withLegacyWelcome } from './sofra-config.js';
export async function loadSofraConfig(restaurantId: number, legacyWelcome?: unknown) {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
  });
  const config = withLegacyWelcome(parseSofraConfig(row?.value), legacyWelcome);
  if (!config.managerContact.enabled) config.managerContact = { enabled: false, email: '', phone: '' };
  // Bant görünümü Ayarlar'daki ayrı anahtardan gelir (tema kaydı bunu ezmesin)
  const belt = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: 'category_belt_view' } },
  });
  config.beltView = belt?.value === 'true';
  return config;
}
