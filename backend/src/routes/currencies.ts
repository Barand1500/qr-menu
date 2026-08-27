import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../lib/auth.js';
import { listCurrencies } from '../lib/currencies.js';

const router = Router();
router.use(authRequired);

const PROTECTED_CURRENCY_CODE = 'TRY';

router.get('/', async (_req, res) => {
  const currencies = await listCurrencies();
  res.json(currencies);
});

router.post('/', async (req, res) => {
  const { code, name, symbol } = req.body as {
    code?: string;
    name?: string;
    symbol?: string;
  };

  const normalized = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 10);
  const displayName = String(name || '').trim().slice(0, 50);
  const displaySymbol = String(symbol || '').trim().slice(0, 10) || normalized;

  if (!normalized || normalized.length < 2) {
    return res.status(400).json({ message: 'Geçersiz para birimi kodu' });
  }
  if (!displayName) {
    return res.status(400).json({ message: 'Para birimi adı gerekli' });
  }

  const existing = await prisma.currency.findUnique({ where: { code: normalized } });
  if (existing) {
    if (!existing.isActive) {
      const reactivated = await prisma.currency.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: displayName || existing.name,
          symbol: displaySymbol || existing.symbol,
        },
      });
      return res.json(reactivated);
    }
    return res.status(409).json({
      message: 'Bu para birimi zaten ekli',
      currency: existing,
    });
  }

  const created = await prisma.currency.create({
    data: {
      code: normalized,
      name: displayName,
      symbol: displaySymbol,
      isActive: true,
    },
  });
  res.status(201).json(created);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Geçersiz para birimi' });
  }

  const existing = await prisma.currency.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: 'Para birimi bulunamadı' });
  }
  if (existing.code === PROTECTED_CURRENCY_CODE) {
    return res.status(400).json({ message: 'Türk Lirası silinemez' });
  }

  await prisma.currency.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
