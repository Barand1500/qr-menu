import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (_req, res) => {
  const languages = await prisma.language.findMany({ orderBy: { id: 'asc' } });
  res.json(languages);
});

export default router;
