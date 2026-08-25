import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { getProductField, getGroupName } from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(restaurantId: number, base: string, excludeId?: number) {
  let slug = base || `kampanya-${Date.now()}`;
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.campaign.findFirst({
      where: {
        restaurantId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
  }
}

function mapCampaign(row: {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { items: number };
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    itemCount: row._count?.items ?? 0,
  };
}

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);

  const rows = await prisma.campaign.findMany({
    where: { restaurantId: restaurantId! },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { items: true } } },
  });

  res.json({ campaigns: rows.map(mapCampaign) });
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const name = String(req.body?.name || '').trim().slice(0, 150);
  if (!name) return res.status(400).json({ message: 'Kampanya adı gerekli' });

  const maxOrder = await prisma.campaign.aggregate({
    where: { restaurantId: restaurantId! },
    _max: { sortOrder: true },
  });

  const slug = await uniqueSlug(restaurantId!, slugify(name));
  const created = await prisma.campaign.create({
    data: {
      restaurantId: restaurantId!,
      name,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: { _count: { select: { items: true } } },
  });

  res.status(201).json(mapCampaign(created));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz id' });

  const existing = await prisma.campaign.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kampanya bulunamadı' });

  const name =
    req.body?.name !== undefined
      ? String(req.body.name || '').trim().slice(0, 150)
      : undefined;
  if (name !== undefined && !name) {
    return res.status(400).json({ message: 'Kampanya adı gerekli' });
  }

  const isActive =
    req.body?.isActive !== undefined ? Boolean(req.body.isActive) : undefined;

  let slug = existing.slug;
  if (name && name !== existing.name) {
    slug = await uniqueSlug(restaurantId!, slugify(name), id);
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name, slug }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { _count: { select: { items: true } } },
  });

  res.json(mapCampaign(updated));
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz id' });

  const existing = await prisma.campaign.findFirst({
    where: { id, restaurantId: restaurantId! },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ message: 'Kampanya bulunamadı' });

  await prisma.campaign.delete({ where: { id } });
  res.json({ ok: true });
});

router.get('/:id/items', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz id' });

  const campaign = await prisma.campaign.findFirst({
    where: { id, restaurantId: restaurantId! },
    include: {
      items: {
        include: {
          product: { include: { group: true, currency: true } },
          currency: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!campaign) return res.status(404).json({ message: 'Kampanya bulunamadı' });

  res.json({
    campaign: mapCampaign({ ...campaign, _count: { items: campaign.items.length } }),
    items: campaign.items.map((item) => ({
      productId: item.productId,
      price: Number(item.price),
      currencyId: item.currencyId,
      sortOrder: item.sortOrder,
      productName: getProductField(item.product.i18n, 'tr', 'name'),
      groupName: getGroupName(item.product.group.i18n, 'tr'),
      groupId: item.product.groupId,
      basePrice: Number(item.product.price),
      baseCurrencyId: item.product.currencyId,
      imageUrl: item.product.imageUrl,
    })),
  });
});

router.put('/:id/items', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Geçersiz id' });

  const campaign = await prisma.campaign.findFirst({
    where: { id, restaurantId: restaurantId! },
    select: { id: true },
  });
  if (!campaign) return res.status(404).json({ message: 'Kampanya bulunamadı' });

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!rawItems) return res.status(400).json({ message: 'items listesi gerekli' });

  type Incoming = {
    productId: number;
    price: number;
    currencyId: number | null;
    sortOrder: number;
  };

  const normalized: Incoming[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i] as {
      productId?: unknown;
      price?: unknown;
      currencyId?: unknown;
      sortOrder?: unknown;
    };
    const productId = Number(row.productId);
    const price = Number(row.price);
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: `Geçersiz fiyat (ürün #${productId})` });
    }
    if (seen.has(productId)) continue;
    seen.add(productId);

    let currencyId: number | null = null;
    if (row.currencyId !== undefined && row.currencyId !== null && row.currencyId !== '') {
      const cid = Number(row.currencyId);
      if (!Number.isFinite(cid)) {
        return res.status(400).json({ message: 'Geçersiz para birimi' });
      }
      currencyId = cid;
    }

    normalized.push({
      productId,
      price,
      currencyId,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : i,
    });
  }

  if (normalized.length > 0) {
    const products = await prisma.product.findMany({
      where: {
        restaurantId: restaurantId!,
        id: { in: normalized.map((n) => n.productId) },
      },
      select: { id: true },
    });
    const validIds = new Set(products.map((p) => p.id));
    const invalid = normalized.find((n) => !validIds.has(n.productId));
    if (invalid) {
      return res.status(400).json({ message: `Ürün bulunamadı (#${invalid.productId})` });
    }

    const currencyIds = [
      ...new Set(
        normalized
          .map((n) => n.currencyId)
          .filter((c): c is number => c !== null)
      ),
    ];
    if (currencyIds.length > 0) {
      const currencies = await prisma.currency.findMany({
        where: { id: { in: currencyIds }, isActive: true },
        select: { id: true },
      });
      const validCurrencies = new Set(currencies.map((c) => c.id));
      const bad = currencyIds.find((c) => !validCurrencies.has(c));
      if (bad) return res.status(400).json({ message: 'Geçersiz para birimi' });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.campaignItem.deleteMany({ where: { campaignId: id } });
    if (normalized.length === 0) return;
    await tx.campaignItem.createMany({
      data: normalized.map((n) => ({
        campaignId: id,
        productId: n.productId,
        price: new Prisma.Decimal(n.price),
        currencyId: n.currencyId,
        sortOrder: n.sortOrder,
      })),
    });
  });

  const items = await prisma.campaignItem.findMany({
    where: { campaignId: id },
    orderBy: { sortOrder: 'asc' },
    select: {
      productId: true,
      price: true,
      currencyId: true,
      sortOrder: true,
    },
  });

  res.json({
    ok: true,
    itemCount: items.length,
    items: items.map((item) => ({
      productId: item.productId,
      price: Number(item.price),
      currencyId: item.currencyId,
      sortOrder: item.sortOrder,
    })),
  });
});

export default router;
