import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

function getLangCode(req: { query: Record<string, unknown> }): string {
  return String(req.query.lang || 'tr');
}

async function trackView(
  restaurantId: number,
  entityType: 'group' | 'product' | 'showcase' | 'menu',
  entityId: number,
  sessionId: string
) {
  await prisma.viewEvent.create({
    data: { restaurantId, entityType, entityId, sessionId },
  });
}

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const fallbackLang = await prisma.language.findFirst({ where: { code: 'tr' } });
  const langId = language?.id || fallbackLang!.id;

  const [groups, showcase, welcomeMessage, languages] = await Promise.all([
    prisma.group.findMany({
      where: { restaurantId: restaurant.id, isActive: true, parentId: null },
      include: {
        translations: { where: { languageId: langId } },
        children: {
          where: { isActive: true },
          include: { translations: { where: { languageId: langId } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.showcaseImage.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      include: { translations: { where: { languageId: langId } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.welcomeMessage.findFirst({
      where: { restaurantId: restaurant.id, languageId: langId },
    }),
    prisma.language.findMany({ where: { isActive: true } }),
  ]);

  await trackView(restaurant.id, 'menu', restaurant.id, sessionId);

  res.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
    },
    welcomeMessage: welcomeMessage?.message || '',
    languages: languages.map((l) => ({ code: l.code, name: l.name })),
    showcase: showcase.map((s) => ({
      id: s.id,
      imageUrl: s.imageUrl,
      title1: s.translations[0]?.title1 || '',
      title2: s.translations[0]?.title2 || '',
      sortOrder: s.sortOrder,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.translations[0]?.name || '',
      imageUrl: g.imageUrl,
      sortOrder: g.sortOrder,
      children: g.children.map((c) => ({
        id: c.id,
        name: c.translations[0]?.name || '',
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
      })),
    })),
  });
});

router.get('/:slug/groups/:groupId/products', async (req, res) => {
  const slug = req.params.slug;
  const groupId = Number(req.params.groupId);
  const lang = getLangCode(req);
  const sessionId = String(req.query.sessionId || 'anonymous');

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const fallbackLang = await prisma.language.findFirst({ where: { code: 'tr' } });
  const langId = language?.id || fallbackLang!.id;

  const group = await prisma.group.findFirst({
    where: { id: groupId, restaurantId: restaurant.id, isActive: true },
    include: { translations: { where: { languageId: langId } } },
  });
  if (!group) return res.status(404).json({ message: 'Kategori bulunamadı' });

  const products = await prisma.product.findMany({
    where: { groupId, restaurantId: restaurant.id, isActive: true },
    include: { translations: { where: { languageId: langId } } },
    orderBy: { sortOrder: 'asc' },
  });

  await trackView(restaurant.id, 'group', groupId, sessionId);

  res.json({
    group: {
      id: group.id,
      name: group.translations[0]?.name || '',
      imageUrl: group.imageUrl,
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.translations[0]?.name || '',
      description: p.translations[0]?.description || '',
      price: Number(p.price),
      imageUrl: p.imageUrl,
    })),
  });
});

router.get('/:slug/search', async (req, res) => {
  const slug = req.params.slug;
  const q = String(req.query.q || '').toLowerCase();
  const lang = getLangCode(req);

  if (!q) return res.json([]);

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  const language = await prisma.language.findFirst({ where: { code: lang, isActive: true } });
  const fallbackLang = await prisma.language.findFirst({ where: { code: 'tr' } });
  const langId = language?.id || fallbackLang!.id;

  const products = await prisma.product.findMany({
    where: {
      restaurantId: restaurant.id,
      isActive: true,
      translations: { some: { languageId: langId, name: { contains: q } } },
    },
    include: {
      translations: { where: { languageId: langId } },
      group: { include: { translations: { where: { languageId: langId } } } },
    },
    take: 20,
  });

  res.json(
    products.map((p) => ({
      id: p.id,
      name: p.translations[0]?.name || '',
      price: Number(p.price),
      imageUrl: p.imageUrl,
      groupName: p.group.translations[0]?.name || '',
      groupId: p.groupId,
    }))
  );
});

router.post('/:slug/track', async (req, res) => {
  const slug = req.params.slug;
  const { entityType, entityId, sessionId } = req.body;

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return res.status(404).json({ message: 'Menü bulunamadı' });

  if (entityType && entityId && sessionId) {
    await trackView(restaurant.id, entityType, Number(entityId), String(sessionId));
  }

  res.json({ ok: true });
});

export default router;
