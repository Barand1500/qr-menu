import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../lib/auth.js';
import { clearLanguageCache } from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

const PROTECTED_LANGUAGE_CODE = 'tr';

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
      clearLanguageCache();
      return res.json(reactivated);
    }
    // DB'de var ama admin listesi cache'te eski kalmış olabilir
    clearLanguageCache();
    return res.status(409).json({
      message: 'Bu dil zaten ekli',
      language: existing,
    });
  }

  const created = await prisma.language.create({
    data: { code: normalized, name: displayName, isActive: true },
  });
  clearLanguageCache();
  res.status(201).json(created);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Geçersiz dil' });
  }

  const existing = await prisma.language.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: 'Dil bulunamadı' });
  }
  if (existing.code === PROTECTED_LANGUAGE_CODE) {
    return res.status(400).json({ message: 'Türkçe dil silinemez' });
  }

  await prisma.language.delete({ where: { id } });
  clearLanguageCache();
  res.json({ ok: true });
});

export default router;
