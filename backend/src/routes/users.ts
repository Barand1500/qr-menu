import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authRequired, getRestaurantId } from '../lib/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { search, page = '1', limit = '10' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { restaurantId };
  if (search) {
    where.OR = [
      { fullName: { contains: String(search) } },
      { email: { contains: String(search) } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
      skip,
      take: limitNum,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: users, pagination: { page: pageNum, limit: limitNum, total } });
});

router.post('/', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const { email, password, fullName, phone, role, isActive } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'E-posta, şifre ve ad soyad gerekli' });
  }

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return res.status(400).json({ message: 'Bu e-posta zaten kayıtlı' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      restaurantId: restaurantId!,
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName,
      phone: phone || null,
      role: role || 'staff',
      isActive: isActive ?? true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const { email, password, fullName, phone, role, isActive } = req.body;

  const existing = await prisma.user.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const data: Record<string, unknown> = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (email !== undefined) data.email = email.toLowerCase().trim();
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });

  res.json(user);
});

router.patch('/:id/toggle', async (req, res) => {
  const restaurantId = await getRestaurantId(req);
  const id = Number(req.params.id);
  const existing = await prisma.user.findFirst({ where: { id, restaurantId: restaurantId! } });
  if (!existing) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });
  res.json(user);
});

export default router;
