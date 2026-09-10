import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import {
  asStringArray,
  customerAuthRequired,
  customerPublic,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  parsePointsJson,
  signCustomerToken,
} from '../lib/customer-auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const {
    loginType,
    email,
    phone,
    password,
    fullName,
    kvkkAccepted,
    remember,
  } = req.body as {
    loginType?: 'email' | 'phone';
    email?: string;
    phone?: string;
    password?: string;
    fullName?: string;
    kvkkAccepted?: boolean;
    remember?: boolean;
  };

  if (!kvkkAccepted) {
    return res.status(400).json({ message: 'KVKK onayını kabul etmelisiniz' });
  }

  const name = String(fullName || '').trim().slice(0, 150);
  const pass = String(password || '');
  if (name.length < 2) {
    return res.status(400).json({ message: 'Ad soyad gerekli' });
  }
  if (pass.length < 6) {
    return res.status(400).json({ message: 'Şifre en az 6 karakter olmalı' });
  }

  const type = loginType === 'phone' ? 'phone' : 'email';
  let emailNorm: string | null = null;
  let phoneNorm: string | null = null;

  if (type === 'email') {
    emailNorm = normalizeEmail(email || '');
    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta girin' });
    }
    const exists = await prisma.menuCustomer.findUnique({ where: { email: emailNorm } });
    if (exists) {
      return res.status(409).json({ message: 'Bu e-posta ile kayıt zaten var' });
    }
  } else {
    phoneNorm = normalizePhone(phone || '');
    if (!isValidPhone(phoneNorm)) {
      return res.status(400).json({ message: 'Geçerli bir cep telefonu girin (5XX XXX XX XX)' });
    }
    const exists = await prisma.menuCustomer.findUnique({ where: { phone: phoneNorm } });
    if (exists) {
      return res.status(409).json({ message: 'Bu telefon ile kayıt zaten var' });
    }
  }

  const passwordHash = await bcrypt.hash(pass, 10);
  const row = await prisma.menuCustomer.create({
    data: {
      email: emailNorm,
      phone: phoneNorm,
      passwordHash,
      fullName: name,
      kvkkAcceptedAt: new Date(),
      allergenTags: [],
      dietTags: [],
      likedFoods: [],
      dislikedFoods: [],
      pointsJson: {},
    },
  });

  const token = signCustomerToken(row.id, Boolean(remember));
  res.status(201).json({ token, customer: customerPublic(row) });
});

router.post('/login', async (req, res) => {
  const { loginType, email, phone, password, remember } = req.body as {
    loginType?: 'email' | 'phone';
    email?: string;
    phone?: string;
    password?: string;
    remember?: boolean;
  };

  const pass = String(password || '');
  if (!pass) {
    return res.status(400).json({ message: 'Şifre gerekli' });
  }

  const type = loginType === 'phone' ? 'phone' : 'email';
  let row = null;

  if (type === 'email') {
    const emailNorm = normalizeEmail(email || '');
    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta girin' });
    }
    row = await prisma.menuCustomer.findUnique({ where: { email: emailNorm } });
  } else {
    const phoneNorm = normalizePhone(phone || '');
    if (!isValidPhone(phoneNorm)) {
      return res.status(400).json({ message: 'Geçerli bir cep telefonu girin' });
    }
    row = await prisma.menuCustomer.findUnique({ where: { phone: phoneNorm } });
  }

  if (!row) {
    return res.status(401).json({ message: 'Hesap bulunamadı veya şifre hatalı' });
  }

  const ok = await bcrypt.compare(pass, row.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Hesap bulunamadı veya şifre hatalı' });
  }

  const token = signCustomerToken(row.id, Boolean(remember));
  res.json({ token, customer: customerPublic(row) });
});

router.get('/me', customerAuthRequired, async (req, res) => {
  const row = await prisma.menuCustomer.findUnique({ where: { id: req.customer!.customerId } });
  if (!row) return res.status(401).json({ message: 'Oturum geçersiz' });

  const restaurantId = Number(req.query.restaurantId);
  if (Number.isFinite(restaurantId) && restaurantId > 0) {
    const points = parsePointsJson(row.pointsJson);
    const key = String(restaurantId);
    if (points[key] == null) {
      points[key] = 0;
      await prisma.menuCustomer.update({
        where: { id: row.id },
        data: { pointsJson: points as object },
      });
      row.pointsJson = points;
    }
  }

  res.json({ customer: customerPublic(row) });
});

router.put('/profile', customerAuthRequired, async (req, res) => {
  const body = req.body || {};
  const fullName = body.fullName != null ? String(body.fullName).trim().slice(0, 150) : undefined;
  if (fullName !== undefined && fullName.length < 2) {
    return res.status(400).json({ message: 'Ad soyad gerekli' });
  }

  const data: {
    fullName?: string;
    allergenTags?: string[];
    dietTags?: string[];
    likedFoods?: string[];
    dislikedFoods?: string[];
  } = {};

  if (fullName !== undefined) data.fullName = fullName;
  if (body.allergenTags !== undefined) data.allergenTags = asStringArray(body.allergenTags);
  if (body.dietTags !== undefined) data.dietTags = asStringArray(body.dietTags);
  if (body.likedFoods !== undefined) data.likedFoods = asStringArray(body.likedFoods);
  if (body.dislikedFoods !== undefined) data.dislikedFoods = asStringArray(body.dislikedFoods);

  const row = await prisma.menuCustomer.update({
    where: { id: req.customer!.customerId },
    data,
  });

  res.json({ customer: customerPublic(row) });
});

export default router;
