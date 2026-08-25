import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

type TableStylePayload = {
  name?: string;
  colorId?: string;
  withLogo?: boolean;
  frameId?: string;
};

type GroupPayload = {
  id?: string;
  name?: string;
  count?: number;
  styles?: Record<string, TableStylePayload>;
};

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

function mapGroup(row: {
  id: number;
  name: string;
  slug: string;
  tableCount: number;
  sortOrder: number;
  tableStyles: Prisma.JsonValue;
}) {
  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    count: row.tableCount,
    sortOrder: row.sortOrder,
    styles: (row.tableStyles && typeof row.tableStyles === 'object'
      ? row.tableStyles
      : {}) as Record<string, TableStylePayload>,
  };
}

async function ensureDefaults(restaurantId: number) {
  const count = await prisma.qrTableGroup.count({ where: { restaurantId } });
  if (count > 0) return;

  await prisma.qrTableGroup.createMany({
    data: [
      {
        restaurantId,
        name: 'Salon',
        slug: 'salon',
        tableCount: 12,
        sortOrder: 0,
        tableStyles: {},
      },
      {
        restaurantId,
        name: 'Teras',
        slug: 'teras',
        tableCount: 8,
        sortOrder: 1,
        tableStyles: {},
      },
    ],
  });
}

router.get('/table-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  await ensureDefaults(restaurantId!);

  const rows = await prisma.qrTableGroup.findMany({
    where: { restaurantId: restaurantId! },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  const setting = await prisma.setting.findUnique({
    where: {
      restaurantId_key: {
        restaurantId: restaurantId!,
        key: 'barcode_active_table_group',
      },
    },
  });

  const groups = rows.map(mapGroup);
  const activeGroupId =
    groups.find((g) => g.id === setting?.value)?.id || groups[0]?.id || 'salon';

  res.json({ groups, activeGroupId });
});

router.put('/table-groups', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const body = req.body as {
    groups?: GroupPayload[];
    activeGroupId?: string;
  };

  const incoming = Array.isArray(body.groups) ? body.groups : [];
  if (!incoming.length) {
    return res.status(400).json({ message: 'En az bir grup gerekli' });
  }

  const normalized = incoming.map((g, index) => {
    const name = String(g.name || '').trim() || `Grup ${index + 1}`;
    let slug = slugify(String(g.id || name)) || `grup-${index + 1}`;
    return {
      name,
      slug,
      tableCount: Math.max(1, Math.min(60, Number(g.count) || 8)),
      sortOrder: index,
      tableStyles: (g.styles && typeof g.styles === 'object' ? g.styles : {}) as Prisma.InputJsonValue,
    };
  });

  // unique slugs
  const seen = new Set<string>();
  for (const g of normalized) {
    let slug = g.slug;
    let n = 2;
    while (seen.has(slug)) {
      slug = `${g.slug}-${n++}`;
    }
    g.slug = slug;
    seen.add(slug);
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.qrTableGroup.findMany({
      where: { restaurantId: restaurantId! },
    });
    const keepSlugs = new Set(normalized.map((g) => g.slug));
    const toDelete = existing.filter((e) => !keepSlugs.has(e.slug));
    if (toDelete.length) {
      await tx.qrTableGroup.deleteMany({
        where: { id: { in: toDelete.map((d) => d.id) } },
      });
    }

    for (const g of normalized) {
      await tx.qrTableGroup.upsert({
        where: {
          restaurantId_slug: {
            restaurantId: restaurantId!,
            slug: g.slug,
          },
        },
        create: {
          restaurantId: restaurantId!,
          name: g.name,
          slug: g.slug,
          tableCount: g.tableCount,
          sortOrder: g.sortOrder,
          tableStyles: g.tableStyles,
        },
        update: {
          name: g.name,
          tableCount: g.tableCount,
          sortOrder: g.sortOrder,
          tableStyles: g.tableStyles,
        },
      });
    }

    const active =
      normalized.find((g) => g.slug === body.activeGroupId)?.slug ||
      normalized[0].slug;

    await tx.setting.upsert({
      where: {
        restaurantId_key: {
          restaurantId: restaurantId!,
          key: 'barcode_active_table_group',
        },
      },
      create: {
        restaurantId: restaurantId!,
        key: 'barcode_active_table_group',
        value: active,
      },
      update: { value: active },
    });
  });

  const rows = await prisma.qrTableGroup.findMany({
    where: { restaurantId: restaurantId! },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  res.json({
    groups: rows.map(mapGroup),
    activeGroupId:
      normalized.find((g) => g.slug === body.activeGroupId)?.slug ||
      rows[0]?.slug ||
      'salon',
  });
});

export default router;
