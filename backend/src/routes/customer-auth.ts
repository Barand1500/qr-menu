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
import { issueCustomerQrChallenge } from '../lib/customer-qr-challenge.js';
import { ContactError, UNAVAILABLE, requestContactChange, verifyContactChange } from '../lib/customer-contact.js';
import {
  GoogleLoginError,
  STATE_COOKIE,
  authorizeUrl,
  exchangeCode,
  googleLoginConfig,
  googleRedirectUri,
  makeState,
  readCookie,
  readState,
  safeReturnPath,
  signInWithGoogle,
} from '../lib/customer-google.js';
import customerEmailRouter from './customer-email.js';
import {
  allowCustomerEmailRequest,
  customerEmail,
} from '../lib/customer-email.js';

const router = Router();
router.use('/email', customerEmailRouter);

/** Google ile devam et: tarayıcı Google'a gider, dönüşte oturum belirteci adres parçasıyla (#) menüye iletilir. */
router.get('/google/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: Boolean(googleLoginConfig()) });
});

router.get('/google/start', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = googleLoginConfig();
  const ret = safeReturnPath(req.query.ret);
  if (!cfg || !allowCustomerEmailRequest(`google-start:${req.ip || 'unknown'}`, 60))
    return res.redirect(`${ret}#google_error=unavailable`);
  const { state, nonce } = makeState(ret, req.query.remember !== '0');
  res.append('Set-Cookie', `${STATE_COOKIE}=${nonce}; Max-Age=600; Path=/api/customer/auth/google; HttpOnly; SameSite=Lax${req.secure || req.get('x-forwarded-proto') === 'https' ? '; Secure' : ''}`);
  res.redirect(authorizeUrl(cfg.id, googleRedirectUri(req), state));
});

router.get('/google/callback', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.append('Set-Cookie', `${STATE_COOKIE}=; Max-Age=0; Path=/api/customer/auth/google; HttpOnly; SameSite=Lax`);
  const st = readState(req.query.state, readCookie(req.headers.cookie, STATE_COOKIE));
  if (!st) return res.redirect('/#google_error=expired');
  const back = (code: string) => res.redirect(`${st.ret}#google_error=${code}`);
  if (typeof req.query.code !== 'string' || !req.query.code) return back('cancelled');
  if (!allowCustomerEmailRequest(`google-callback:${req.ip || 'unknown'}`, 60)) return back('busy');
  try {
    const who = await exchangeCode(req.query.code, googleRedirectUri(req));
    const done = await signInWithGoogle(who.email, who.name, st.rem);
    res.redirect(`${st.ret}#google_token=${encodeURIComponent(done.token)}&remember=${st.rem ? 1 : 0}`);
  } catch (e) {
    back(e instanceof GoogleLoginError ? e.message : 'failed');
  }
});

router.post('/register', async (req, res) => {
  // Old clients cannot bypass the new e-mail verification flow.
  if (req.body?.loginType !== 'phone')
    return res
      .status(410)
      .json({ message: 'E-posta ile devam ederek hesabınızı doğrulayın.' });
  const { phone, password, fullName, kvkkAccepted, remember } = req.body as {
    phone?: string;
    password?: string;
    fullName?: string;
    kvkkAccepted?: boolean;
    remember?: boolean;
  };

  if (!kvkkAccepted) {
    return res.status(400).json({ message: 'KVKK onayını kabul etmelisiniz' });
  }

  const name = String(fullName || '')
    .trim()
    .slice(0, 150);
  const pass = String(password || '');
  if (name.length < 2) {
    return res.status(400).json({ message: 'Ad soyad gerekli' });
  }
  if (pass.length < 6) {
    return res.status(400).json({ message: 'Şifre en az 6 karakter olmalı' });
  }

  const phoneNorm = normalizePhone(phone || '');
  if (!isValidPhone(phoneNorm)) {
    return res
      .status(400)
      .json({ message: 'Geçerli bir cep telefonu girin (5XX XXX XX XX)' });
  }
  const exists = await prisma.menuCustomer.findUnique({
    where: { phone: phoneNorm },
  });
  if (exists)
    return res.status(409).json({ message: 'Bu telefon ile kayıt zaten var' });
  const passwordHash = await bcrypt.hash(pass, 10);
  const row = await prisma.menuCustomer.create({
    data: {
      email: null,
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
  res.setHeader('Cache-Control', 'no-store');
  const address = req.ip || 'unknown';
  const account =
    customerEmail(req.body?.email) || normalizePhone(req.body?.phone || '');
  if (
    !allowCustomerEmailRequest(`password-ip:${address}`, 300) ||
    !allowCustomerEmailRequest(`password-account:${address}:${account}`, 20)
  )
    return res
      .status(429)
      .json({
        message: 'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.',
      });
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
      return res
        .status(400)
        .json({ message: 'Geçerli bir cep telefonu girin' });
    }
    row = await prisma.menuCustomer.findUnique({ where: { phone: phoneNorm } });
  }

  if (!row) {
    return res
      .status(401)
      .json({ message: 'Hesap bulunamadı veya şifre hatalı' });
  }

  const ok = await bcrypt.compare(pass, row.passwordHash);
  if (!ok) {
    return res
      .status(401)
      .json({ message: 'Hesap bulunamadı veya şifre hatalı' });
  }

  const token = signCustomerToken(row.id, Boolean(remember), row.authVersion);
  res.json({ token, customer: customerPublic(row) });
});

router.get('/me', customerAuthRequired, async (req, res) => {
  const row = await prisma.menuCustomer.findUnique({
    where: { id: req.customer!.customerId },
  });
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
  const fullName =
    body.fullName != null
      ? String(body.fullName).trim().slice(0, 150)
      : undefined;
  if (fullName !== undefined && fullName.length < 2) {
    return res.status(400).json({ message: 'Ad soyad gerekli' });
  }

  const data: {
    fullName?: string;
    allergenTags?: string[];
    dietTags?: string[];
    likedFoods?: string[];
    dislikedFoods?: string[];
    drinksAlcohol?: boolean | null;
  } = {};

  if (fullName !== undefined) data.fullName = fullName;
  if (body.allergenTags !== undefined)
    data.allergenTags = asStringArray(body.allergenTags);
  if (body.dietTags !== undefined) data.dietTags = asStringArray(body.dietTags);
  if (body.likedFoods !== undefined)
    data.likedFoods = asStringArray(body.likedFoods);
  if (body.dislikedFoods !== undefined)
    data.dislikedFoods = asStringArray(body.dislikedFoods);
  if (body.drinksAlcohol !== undefined) {
    if (body.drinksAlcohol === true) data.drinksAlcohol = true;
    else if (body.drinksAlcohol === false) data.drinksAlcohol = false;
    else data.drinksAlcohol = null;
  }

  const row = await prisma.menuCustomer.update({
    where: { id: req.customer!.customerId },
    data,
  });

  res.json({ customer: customerPublic(row) });
});

/** Telefon / e-posta değişikliği: yeni değere doğrulama kodu gönderir (SMS veya e-posta, işletmenin ayarına göre). */
router.post('/contact/request', customerAuthRequired, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!allowCustomerEmailRequest(`contact-ip:${req.ip || 'unknown'}`, 40))
    return res.status(429).json({ message: 'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.' });
  const field = req.body?.field === 'phone' ? 'phone' : req.body?.field === 'email' ? 'email' : null;
  const restaurantId = Number(req.body?.restaurantId);
  if (!field || !Number.isInteger(restaurantId) || restaurantId <= 0)
    return res.status(400).json({ message: 'Geçersiz istek' });
  try {
    res.json(await requestContactChange({ customerId: req.customer!.customerId, restaurantId, field, value: req.body?.value }));
  } catch (e) {
    if (e instanceof ContactError) {
      if (e.retryAfter) res.setHeader('Retry-After', String(e.retryAfter));
      return res.status(e.status).json({ message: e.message });
    }
    res.status(503).json({ message: UNAVAILABLE });
  }
});

router.post('/contact/verify', customerAuthRequired, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!allowCustomerEmailRequest(`contact-verify-ip:${req.ip || 'unknown'}`, 80))
    return res.status(429).json({ message: 'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.' });
  const field = req.body?.field === 'phone' ? 'phone' : req.body?.field === 'email' ? 'email' : null;
  const restaurantId = Number(req.body?.restaurantId);
  if (!field || !Number.isInteger(restaurantId) || restaurantId <= 0)
    return res.status(400).json({ message: 'Geçersiz istek' });
  try {
    const row = await verifyContactChange({
      customerId: req.customer!.customerId,
      restaurantId,
      field,
      value: req.body?.value,
      challengeId: req.body?.challengeId,
      code: req.body?.code,
    });
    res.json({ customer: customerPublic(row) });
  } catch (e) {
    if (e instanceof ContactError) return res.status(e.status).json({ message: e.message });
    res.status(503).json({ message: UNAVAILABLE });
  }
});

router.post('/qr-challenge', customerAuthRequired, async (req, res) => {
  const customerId = req.customer!.customerId;
  const row = await prisma.menuCustomer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!row) return res.status(401).json({ message: 'Oturum geçersiz' });

  const challenge = issueCustomerQrChallenge(customerId);
  res.json(challenge);
});

export default router;
