import { prisma } from './prisma.js';

export const MAINTENANCE_MODE_KEY = 'maintenance_mode';

export async function isMaintenanceEnabled(restaurantId: number): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: MAINTENANCE_MODE_KEY } },
  });
  return row?.value === 'true';
}

export async function setMaintenanceEnabled(restaurantId: number, enabled: boolean) {
  return prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: MAINTENANCE_MODE_KEY } },
    update: { value: enabled ? 'true' : 'false' },
    create: {
      restaurantId,
      key: MAINTENANCE_MODE_KEY,
      value: enabled ? 'true' : 'false',
    },
  });
}
