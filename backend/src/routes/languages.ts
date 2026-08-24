import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (_req, res) => {
  const languages = await prisma.language.findMany({ orderBy: { id: 'asc' } });
  res.json(languages);
});

router.post('/', async (req, res) => {
  const { code, name } = req.body as { code?: string; name?: string };
  const normalized = String(code || '')
    .trim()
    .toLowerCase()
    .split('-')[0]
    .slice(0, 10);
  const displayName = String(name || '').trim().slice(0, 50);

  if (!normalized || !/^[a-z]{2,10}$/.test(normalized)) {
    return res.status(400).json({ message: 'Geçersiz dil kodu' });
  }
  if (!displayName) {
    return res.status(400).json({ message: 'Dil adı gerekli' });
  }

  const existing = await prisma.language.findUnique({ where: { code: normalized } });
  if (existing) {
    if (!existing.isActive) {
      const reactivated = await prisma.language.update({
        where: { id: existing.id },
        data: { isActive: true, name: displayName || existing.name },
      });
      return res.json(reactivated);
    }
    return res.status(409).json({ message: 'Bu dil zaten ekli' });
  }

  const created = await prisma.language.create({
    data: { code: normalized, name: displayName, isActive: true },
  });
  res.status(201).json(created);
});

export default router;
