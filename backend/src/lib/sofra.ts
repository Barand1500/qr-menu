import { prisma } from './prisma.js';
import { SOFRA_SETTINGS_KEY, parseSofraConfig, withLegacyWelcome } from './sofra-config.js';
export async function loadSofraConfig(restaurantId: number, legacyWelcome?: unknown) {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
  });
  const config = withLegacyWelcome(parseSofraConfig(row?.value), legacyWelcome);
  if (!config.managerContact.enabled) config.managerContact = { enabled: false, email: '', phone: '' };
  return config;
}
