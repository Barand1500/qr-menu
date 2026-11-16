import { Router } from 'express';
import {
  allowCustomerEmailRequest,
  completeCustomerEmail,
  customerEmail,
  CustomerEmailError,
  requestCustomerCode,
  startCustomerEmail,
  verifyCustomerCode,
  type CustomerEmailPurpose,
} from '../lib/customer-email.js';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const purposeOf = (value: unknown): CustomerEmailPurpose | null =>
  value === 'register' || value === 'reset' ? value : null;
function limited(req: import('express').Request, kind: string, limit: number) {
  if (!allowCustomerEmailRequest(`${kind}:${req.ip || 'unknown'}`, limit))
    throw new CustomerEmailError(
      429,
      'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.',
      900,
    );
}
const endpoint =
  (fn: (req: import('express').Request) => Promise<unknown>) =>
  async (req: import('express').Request, res: import('express').Response) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      if (error instanceof CustomerEmailError) {
        if (error.retryAfter)
          res.setHeader('Retry-After', String(error.retryAfter));
        res
          .status(error.status)
          .json({ message: error.message, retryAfter: error.retryAfter });
      } else
        res
          .status(503)
          .json({ message: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' });
    }
  };
function emailOf(value: unknown) {
  const email = customerEmail(value);
  if (!email)
    throw new CustomerEmailError(400, 'Geçerli bir e-posta adresi girin.');
  return email;
}

router.post(
  '/start',
  endpoint(async (req) => {
    limited(req, 'start', 200);
    return startCustomerEmail(emailOf(req.body?.email), () =>
      limited(req, 'send', 90),
    );
  }),
);
router.post(
  '/code',
  endpoint(async (req) => {
    limited(req, 'send', 90);
    const purpose = purposeOf(req.body?.purpose);
    if (!purpose)
      throw new CustomerEmailError(400, 'Geçersiz doğrulama işlemi.');
    return requestCustomerCode(emailOf(req.body?.email), purpose);
  }),
);
router.post(
  '/verify',
  endpoint(async (req) => {
    limited(req, 'verify', 300);
    const purpose = purposeOf(req.body?.purpose),
      { challengeId, code } = req.body || {};
    if (
      !purpose ||
      typeof challengeId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(challengeId) ||
      typeof code !== 'string' ||
      !/^\d{6}$/.test(code)
    )
      throw new CustomerEmailError(
        400,
        'E-posta ve 6 haneli kodu kontrol edin.',
      );
    return verifyCustomerCode(
      emailOf(req.body?.email),
      purpose,
      challengeId,
      code,
    );
  }),
);
router.post(
  '/complete',
  endpoint(async (req) => {
    limited(req, 'complete', 120);
    const purpose = purposeOf(req.body?.purpose);
    if (!purpose)
      throw new CustomerEmailError(400, 'Geçersiz doğrulama işlemi.');
    const email = emailOf(req.body?.email);
    if (!allowCustomerEmailRequest(`complete-account:${email}`, 10))
      throw new CustomerEmailError(
        429,
        'Çok fazla deneme yapıldı. Daha sonra tekrar deneyin.',
        900,
      );
    return completeCustomerEmail({
      email,
      purpose,
      verificationToken:
        typeof req.body?.verificationToken === 'string'
          ? req.body.verificationToken
          : '',
      password: req.body?.password,
      kvkkAccepted: req.body?.kvkkAccepted === true,
      remember: req.body?.remember === true,
    });
  }),
);
export default router;
