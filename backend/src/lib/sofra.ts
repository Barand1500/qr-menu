import { prisma } from './prisma.js';
import { SOFRA_SETTINGS_KEY, parseSofraConfig, withLegacyWelcome } from './sofra-config.js';
export async function loadSofraConfig(restaurantId: number, legacyWelcome?: unknown) {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
  });
  return withLegacyWelcome(parseSofraConfig(row?.value), legacyWelcome);
}
