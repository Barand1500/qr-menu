import { prisma } from './prisma.js';

/** Uygulama açılışında en az TRY aktif olsun */
export async function ensureDefaultCurrency() {
  const existing = await prisma.currency.findUnique({ where: { code: 'TRY' } });
  if (existing) {
    if (!existing.isActive) {
      return prisma.currency.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing;
  }

  return prisma.currency.create({
    data: {
      code: 'TRY',
      name: 'Türk Lirası',
      symbol: '₺',
      isActive: true,
    },
  });
}

export async function listCurrencies() {
  await ensureDefaultCurrency();
  return prisma.currency.findMany({ orderBy: { id: 'asc' } });
}
