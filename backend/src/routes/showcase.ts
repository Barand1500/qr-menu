import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { config } from '../config.js';

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
  const items = await prisma.showcaseImage.findMany({
    where: { restaurantId: restaurantId! },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(items);
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { name, sortOrder, isActive } = req.body;

  const maxOrder = await prisma.showcaseImage.aggregate({
    where: { restaurantId: restaurantId! },
    _max: { sortOrder: true },
  });

  const item = await prisma.showcaseImage.create({
    data: {
      restaurantId: restaurantId!,
      name: name || 'Vitrin Görseli',
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isActive: isActive ?? true,
    },
  });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { name, sortOrder, isActive, imageUrl } = req.body;

  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const item = await prisma.showcaseImage.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
      ...(imageUrl !== undefined && { imageUrl }),
    },
  });
  res.json(item);
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  const item = await prisma.showcaseImage.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  res.json(item);
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });
  if (!req.file) return res.status(400).json({ message: 'Görsel gerekli' });

  const imageUrl = `/uploads/${req.file.filename}`;
  const item = await prisma.showcaseImage.update({
    where: { id },
    data: { imageUrl },
  });
  res.json(item);
});

router.put('/reorder/bulk', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { items } = req.body as { items: { id: number; sortOrder: number }[] };

  for (const item of items || []) {
    await prisma.showcaseImage.updateMany({
      where: { id: item.id, restaurantId: restaurantId! },
      data: { sortOrder: item.sortOrder },
    });
  }
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.showcaseImage.findFirst({
    where: { id, restaurantId: restaurantId! },
  });
  if (!existing) return res.status(404).json({ message: 'Kayıt bulunamadı' });

  await prisma.showcaseImage.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
