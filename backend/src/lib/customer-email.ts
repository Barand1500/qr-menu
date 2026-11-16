import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { config } from '../config.js';
import { customerMailConfigured, sendCustomerCode } from './customer-mail.js';
import {
  customerPublic,
  isValidEmail,
  signCustomerToken,
} from './customer-auth.js';

export type CustomerEmailPurpose = 'register' | 'reset';
const CODE_TTL = 5 * 60_000,
  GRANT_TTL = 10 * 60_000,
  COOLDOWN = 60_000,
  WINDOW = 60 * 60_000;
export class CustomerEmailError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export function customerEmail(value: unknown) {
  if (typeof value !== 'string' || value.length > 512) return '';
  const email = value.trim().toLowerCase();
  return email.length <= 150 && isValidEmail(email) ? email : '';
}
const invalid = () =>
  new CustomerEmailError(
    401,
    'Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.',
  );
const invalidGrant = () =>
  new CustomerEmailError(
    401,
    'Doğrulama süresi dolmuş. E-postanızı yeniden doğrulayın.',
  );
function digest(email: string, id: string, purpose: string, value: string) {
  return createHmac('sha256', config.jwtSecret)
    .update(`customer-email:${purpose}:${email}:${id}:${value}`)
    .digest('hex');
}
function equal(a: string, b: string) {
  const left = Buffer.from(a, 'hex'),
    right = Buffer.from(b, 'hex');
  return (
    left.length > 0 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}
const buckets = new Map<string, { start: number; count: number }>();
export function allowCustomerEmailRequest(key: string, limit: number) {
  const now = Date.now();
  for (const [k, row] of buckets)
    if (now - row.start >= 15 * 60_000) buckets.delete(k);
  let row = buckets.get(key);
  if (!row) {
    if (buckets.size >= 10000) return false;
    row = { start: now, count: 0 };
    buckets.set(key, row);
  }
  return ++row.count <= limit;
}
let lastCleanup = 0;
async function cleanup(now: number) {
  if (now - lastCleanup < 10 * 60_000) return;
  lastCleanup = now;
  await prisma.customerEmailChallenge.deleteMany({
    where: { windowStart: { lt: new Date(now - 24 * WINDOW) } },
  });
}

export async function startCustomerEmail(
  email: string,
  beforeSend?: () => void,
) {
  const customer = await prisma.menuCustomer.findUnique({
    where: { email },
    select: { id: true },
  });
  if (customer) return { step: 'password' as const, email };
  beforeSend?.();
  return {
    step: 'code' as const,
    email,
    ...(await requestCustomerCode(email, 'register')),
  };
}

export async function requestCustomerCode(
  email: string,
  purpose: CustomerEmailPurpose,
) {
  if (!customerMailConfigured())
    throw new CustomerEmailError(
      503,
      'E-posta doğrulama şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    );
  const customer = await prisma.menuCustomer.findUnique({ where: { email } });
  if (purpose === 'register' && customer)
    throw new CustomerEmailError(
      409,
      'Bu e-posta kayıtlı. Şifrenizle giriş yapın.',
    );
  const now = Date.now(),
    id = randomUUID();
  const response = {
    challengeId: id,
    expiresIn: CODE_TTL / 1000,
    retryAfter: COOLDOWN / 1000,
  };
  // Reset requests deliberately do not reveal whether an account exists.
  if (purpose === 'reset' && !customer) return response;
  await cleanup(now);
  const previous = await prisma.customerEmailChallenge.findUnique({
    where: { email },
  });
  if (previous && previous.resendAt.getTime() > now)
    throw new CustomerEmailError(
      429,
      'Yeni kod istemeden önce biraz bekleyin.',
      Math.ceil((previous.resendAt.getTime() - now) / 1000),
    );
  const sent =
    previous && now - previous.windowStart.getTime() < WINDOW
      ? previous.sent
      : 0;
  if (sent >= 5)
    throw new CustomerEmailError(
      429,
      'Çok fazla kod istendi. Daha sonra tekrar deneyin.',
      Math.ceil((previous!.windowStart.getTime() + WINDOW - now) / 1000),
    );
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const data = {
    id,
    purpose,
    codeHash: digest(email, id, purpose, code),
    grantHash: null,
    customerVersion: customer?.authVersion ?? null,
    customerId: customer?.id ?? null,
    expiresAt: new Date(now + CODE_TTL),
    grantExpiresAt: null,
    resendAt: new Date(now + COOLDOWN),
    attempts: 0,
    windowStart: sent ? previous!.windowStart : new Date(now),
    sent: sent + 1,
  };
  if (previous) {
    const changed = await prisma.customerEmailChallenge.updateMany({
      where: { email, version: previous.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (!changed.count)
      throw new CustomerEmailError(429, 'Biraz sonra tekrar deneyin.', 60);
  } else {
    try {
      await prisma.customerEmailChallenge.create({ data: { email, ...data } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new CustomerEmailError(429, 'Biraz sonra tekrar deneyin.', 60);
      throw error;
    }
  }
  try {
    await sendCustomerCode(email, code, purpose);
  } catch {
    await prisma.customerEmailChallenge.updateMany({
      where: { email, id },
      data: {
        codeHash: null,
        expiresAt: new Date(0),
        version: { increment: 1 },
      },
    });
    throw new CustomerEmailError(
      503,
      'Kod gönderilemedi. Biraz sonra tekrar deneyin.',
    );
  }
  return response;
}

export async function verifyCustomerCode(
  email: string,
  purpose: CustomerEmailPurpose,
  id: string,
  code: string,
) {
  const row = await prisma.customerEmailChallenge.findUnique({
    where: { email },
  });
  const now = Date.now();
  if (
    !row ||
    row.id !== id ||
    row.purpose !== purpose ||
    !row.codeHash ||
    row.expiresAt.getTime() <= now ||
    row.attempts >= 5
  )
    throw invalid();
  const correct = equal(row.codeHash, digest(email, id, purpose, code));
  const grant = correct ? randomBytes(32).toString('hex') : '';
  const changed = await prisma.customerEmailChallenge.updateMany({
    where: { email, id, version: row.version },
    data: {
      attempts: { increment: 1 },
      version: { increment: 1 },
      ...(correct
        ? {
            codeHash: null,
            grantHash: digest(email, id, purpose + ':grant', grant),
            grantExpiresAt: new Date(now + GRANT_TTL),
          }
        : {}),
    },
  });
  if (!changed.count || !correct) throw invalid();
  return { verificationToken: grant, expiresIn: GRANT_TTL / 1000 };
}

export async function completeCustomerEmail(body: {
  email: string;
  purpose: CustomerEmailPurpose;
  verificationToken: string;
  password: string;
  kvkkAccepted?: boolean;
  remember?: boolean;
}) {
  const { email, purpose, verificationToken, password } = body;
  if (typeof password !== 'string' || password.length < 8)
    throw new CustomerEmailError(400, 'Şifreniz en az 8 karakter olmalı.');
  if (Buffer.byteLength(password, 'utf8') > 72)
    throw new CustomerEmailError(400, 'Şifreniz çok uzun. Daha kısa bir şifre deneyin.');
  if (purpose === 'register' && body.kvkkAccepted !== true)
    throw new CustomerEmailError(400, 'KVKK onayını kabul etmelisiniz.');
  if (!/^[a-f0-9]{64}$/.test(verificationToken)) throw invalidGrant();
  const row = await prisma.customerEmailChallenge.findUnique({
    where: { email },
  });
  if (
    !row ||
    row.purpose !== purpose ||
    !row.grantHash ||
    !row.grantExpiresAt ||
    row.grantExpiresAt.getTime() <= Date.now() ||
    !equal(
      row.grantHash,
      digest(email, row.id, purpose + ':grant', verificationToken),
    )
  )
    throw invalidGrant();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const customer = await prisma.$transaction(async (tx) => {
      const consumed = await tx.customerEmailChallenge.updateMany({
        where: {
          email,
          id: row.id,
          version: row.version,
          grantHash: row.grantHash,
          grantExpiresAt: { gt: new Date() },
        },
        data: {
          grantHash: null,
          grantExpiresAt: null,
          version: { increment: 1 },
        },
      });
      if (!consumed.count) throw invalidGrant();
      if (purpose === 'register')
        return tx.menuCustomer.create({
          data: {
            email,
            phone: null,
            passwordHash,
            fullName: 'Misafir',
            kvkkAcceptedAt: new Date(),
            allergenTags: [],
            dietTags: [],
            likedFoods: [],
            dislikedFoods: [],
            pointsJson: {},
          },
        });
      const existing = await tx.menuCustomer.findUnique({ where: { email } });
      if (
        !existing ||
        existing.id !== row.customerId ||
        existing.authVersion !== row.customerVersion
      )
        throw invalidGrant();
      return tx.menuCustomer.update({
        where: { id: existing.id },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
    });
    // A password reset does not automatically establish a new session.
    if (purpose === 'reset') return { reset: true as const };
    return {
      token: signCustomerToken(
        customer.id,
        Boolean(body.remember),
        customer.authVersion,
      ),
      customer: customerPublic(customer),
    };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002')
      throw new CustomerEmailError(
        409,
        'Bu e-posta artık kayıtlı. Şifrenizle giriş yapın.',
      );
    throw error;
  }
}
