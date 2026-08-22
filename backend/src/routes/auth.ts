import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authRequired, signToken } from '../lib/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: 'E-posta ve şifre gerekli' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { restaurant: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' });
  }

  const token = signToken({
    userId: user.id,
    restaurantId: user.restaurantId,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      restaurant: {
        id: user.restaurant.id,
        name: user.restaurant.name,
        slug: user.restaurant.slug,
        logoUrl: user.restaurant.logoUrl,
      },
    },
  });
});

router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { restaurant: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    restaurant: {
      id: user.restaurant.id,
      name: user.restaurant.name,
      slug: user.restaurant.slug,
      logoUrl: user.restaurant.logoUrl,
    },
  });
});

export default router;
