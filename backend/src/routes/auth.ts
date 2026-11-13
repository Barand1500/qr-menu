import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authRequired, signToken } from '../lib/auth.js';
import {
  allowLoginCodeRequest,
  LoginCodeError,
  normalizeLoginEmail,
  validLoginEmail,
  requestAdminLoginCode,
  verifyAdminLoginCode,
} from '../lib/admin-login-code.js';
import type { Prisma } from '@prisma/client';

const router = Router();

function sessionFor(user: Prisma.UserGetPayload<{ include: { restaurant: true } }>) {
  return {
    token: signToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      email: user.email,
      role: user.role,
    }),
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
  };
}

router.post('/login/code/request', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!allowLoginCodeRequest(req.ip || 'unknown', 'send'))
    return res
      .status(429)
      .setHeader('Retry-After', '900')
      .json({ message: 'Çok fazla istek gönderildi. Daha sonra tekrar deneyin.' });
  const email = normalizeLoginEmail(req.body?.email);
  if (!validLoginEmail(email))
    return res.status(400).json({ message: 'Geçerli bir e-posta adresi girin.' });
  try {
    return res.json(await requestAdminLoginCode(email));
  } catch (error) {
    if (error instanceof LoginCodeError) {
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      return res.status(error.status).json({ message: error.message });
    }
    return res
      .status(503)
      .json({ message: 'Hızlı giriş şu anda kullanılamıyor. Şifreli giriş yapabilirsiniz.' });
  }
});

router.post('/login/code/verify', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!allowLoginCodeRequest(req.ip || 'unknown', 'verify'))
    return res
      .status(429)
      .setHeader('Retry-After', '900')
      .json({ message: 'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.' });
  const email = normalizeLoginEmail(req.body?.email),
    code = req.body?.code,
    id = req.body?.challengeId;
  if (
    !validLoginEmail(email) ||
    typeof code !== 'string' ||
    !/^\d{6}$/.test(code) ||
    typeof id !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(id)
  )
    return res.status(400).json({ message: 'E-posta ve 6 haneli kodu kontrol edin.' });
  try {
    return res.json(sessionFor(await verifyAdminLoginCode(email, id, code)));
  } catch (error) {
    return res
      .status(error instanceof LoginCodeError ? error.status : 503)
      .json({
        message:
          error instanceof LoginCodeError
            ? error.message
            : 'Giriş tamamlanamadı. Lütfen tekrar deneyin.',
      });
  }
});

router.post('/login', async (req, res) => {
  const email = normalizeLoginEmail(req.body?.email);
  const password = req.body?.password;

  if (!validLoginEmail(email) || typeof password !== 'string' || !password) {
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

  res.setHeader('Cache-Control', 'no-store');
  res.json(sessionFor(user));
});

router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { restaurant: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Oturum geçersiz veya hesap pasif' });
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
