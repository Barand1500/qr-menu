import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';
import {
  buildGroupI18n,
  getGroupName,
  getLanguages,
  mergeGroupI18n,
  textMatchesI18n,
  toGroupTranslations,
} from '../lib/i18n-json.js';

const router = Router();
router.use(authRequired);

const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { search, active, type, parentId, page = '1', limit = '100' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { restaurantId };
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;
  if (type === 'ana') where.parentId = null;
  if (type === 'alt') where.parentId = { not: null };
  if (parentId !== undefined && parentId !== '') {
    where.parentId = parentId === 'null' ? null : Number(parentId);
  }

  const [groups, languages, total] = await Promise.all([
    prisma.group.findMany({
      where,
      include: {
        parent: true,
        _count: { select: { children: true, products: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip,
      take: limitNum,
    }),
    getLanguages(),
    prisma.group.count({ where }),
  ]);

  let filtered = groups;
  if (search) {
    const q = String(search).toLowerCase();
    filtered = groups.filter((g) => textMatchesI18n(g.i18n, 'tr', ['name'], q));
  }

  const sorted = sortGroupsHierarchical(filtered);
  res.json({
    data: sorted.map((g) => mapGroup(g, languages, groups)),
    pagination: { page: pageNum, limit: limitNum, total },
  });
});

router.get('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const [group, languages, allGroups] = await Promise.all([
    prisma.group.findFirst({
      where: { id: Number(req.params.id), restaurantId: restaurantId! },
      include: {
        parent: true,
        _count: { select: { children: true, products: true } },
      },
    }),
    getLanguages(),
    prisma.group.findMany({ where: { restaurantId: restaurantId! } }),
  ]);
  if (!group) return res.status(404).json({ message: 'Grup bulunamadı' });
  res.json(mapGroup(group, languages, allGroups));
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { translations, sortOrder, isActive, parentId } = req.body;

  if (parentId) {
    const parent = await prisma.group.findFirst({
      where: { id: Number(parentId), restaurantId: restaurantId!, parentId: null },
    });
    if (!parent) {
      return res.status(400).json({
        message: 'Geçersiz üst grup. Alt grup yalnızca ana grupların altına eklenebilir.',
      });
    }
  }

  const scopeWhere = {
    restaurantId: restaurantId!,
    parentId: parentId ? Number(parentId) : null,
  };

  const [maxOrder, languages] = await Promise.all([
    prisma.group.aggregate({ where: scopeWhere, _max: { sortOrder: true } }),
    getLanguages(),
  ]);

  const group = await prisma.group.create({
    data: {
      restaurantId: restaurantId!,
      parentId: parentId ? Number(parentId) : null,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: isActive ?? true,
      i18n: buildGroupI18n(translations || [], languages),
    },
    include: {
      parent: true,
      _count: { select: { children: true, products: true } },
    },
  });

  const allGroups = await prisma.group.findMany({ where: { restaurantId: restaurantId! } });
  res.status(201).json(mapGroup(group, languages, allGroups));
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { translations, sortOrder, isActive, imageUrl, parentId } = req.body;

  const existing = await prisma.group.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Grup bulunamadı' });

  if (parentId !== undefined && parentId !== null) {
    if (Number(parentId) === id) {
      return res.status(400).json({ message: 'Grup kendi alt grubu olamaz' });
    }
    const parent = await prisma.group.findFirst({
      where: { id: Number(parentId), restaurantId: restaurantId!, parentId: null },
    });
    if (!parent) {
      return res.status(400).json({ message: 'Geçersiz üst grup' });
    }
  }

  const languages = await getLanguages();
  const i18n =
    translations?.length > 0
      ? mergeGroupI18n(existing.i18n, translations, languages)
      : undefined;

  const group = await prisma.group.update({
    where: { id },
    data: {
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(parentId !== undefined && { parentId: parentId ? Number(parentId) : null }),
      ...(i18n !== undefined && { i18n }),
    },
    include: {
      parent: true,
      _count: { select: { children: true, products: true } },
    },
  });

  const allGroups = await prisma.group.findMany({ where: { restaurantId: restaurantId! } });
  res.json(mapGroup(group, languages, allGroups));
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.group.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Grup bulunamadı' });

  const [group, languages, allGroups] = await Promise.all([
    prisma.group.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        parent: true,
        _count: { select: { children: true, products: true } },
      },
    }),
    getLanguages(),
    prisma.group.findMany({ where: { restaurantId: restaurantId! } }),
  ]);
  res.json(mapGroup(group, languages, allGroups));
});

router.put('/reorder/bulk', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { items } = req.body as { items: { id: number; sortOrder: number }[] };

  for (const item of items || []) {
    await prisma.group.updateMany({
      where: { id: item.id, restaurantId: restaurantId! },
      data: { sortOrder: item.sortOrder },
    });
  }

  res.json({ ok: true });
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.group.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Grup bulunamadı' });
  if (!req.file) return res.status(400).json({ message: 'Görsel gerekli' });

  const imageUrl = `/uploads/${req.file.filename}`;
  const [group, languages, allGroups] = await Promise.all([
    prisma.group.update({
      where: { id },
      data: { imageUrl },
      include: {
        parent: true,
        _count: { select: { children: true, products: true } },
      },
    }),
    getLanguages(),
    prisma.group.findMany({ where: { restaurantId: restaurantId! } }),
  ]);
  res.json(mapGroup(group, languages, allGroups));
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);

  const childCount = await prisma.group.count({ where: { parentId: id, restaurantId: restaurantId! } });
  if (childCount > 0) {
    return res.status(400).json({ message: 'Alt gruplar var, önce alt grupları silin' });
  }

  const productCount = await prisma.product.count({ where: { groupId: id, restaurantId: restaurantId! } });
  if (productCount > 0) {
    return res.status(400).json({ message: 'Grupta ürün var, önce ürünleri silin veya taşıyın' });
  }

  await prisma.group.delete({ where: { id } });
  res.json({ ok: true });
});

type GroupRecord = {
  id: number;
  parentId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  i18n: unknown;
  parent?: { i18n: unknown } | null;
  _count?: { children: number; products: number };
};

function mapGroup(
  group: GroupRecord,
  languages: { id: number; code: string }[],
  allGroups: { id: number; i18n: unknown }[]
) {
  const parent = group.parent ?? allGroups.find((g) => g.id === group.parentId);
  return {
    id: group.id,
    name: getGroupName(group.i18n),
    parentId: group.parentId,
    parentName: parent ? getGroupName(parent.i18n) : null,
    isSubGroup: group.parentId !== null,
    imageUrl: group.imageUrl,
    sortOrder: group.sortOrder,
    isActive: group.isActive,
    childrenCount: group._count?.children ?? 0,
    productCount: group._count?.products ?? 0,
    translations: toGroupTranslations(group.i18n, languages),
  };
}

function sortGroupsHierarchical(groups: GroupRecord[]) {
  const roots = groups.filter((g) => g.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const result: GroupRecord[] = [];

  for (const root of roots) {
    result.push(root);
    const children = groups
      .filter((g) => g.parentId === root.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    result.push(...children);
  }

  const included = new Set(result.map((g) => g.id));
  const orphans = groups.filter((g) => !included.has(g.id));
  return [...result, ...orphans];
}

export default router;
