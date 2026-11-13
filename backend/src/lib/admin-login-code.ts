import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma.js';
import { config } from '../config.js';
import { loginMailConfigured, sendLoginCode } from './login-mail.js';

const TTL = 5 * 60_000;
const COOLDOWN = 60_000;
const WINDOW = 60 * 60_000;
type Challenge = {
  id: string;
  hash: string;
  expires: number;
  resendAt: number;
  attempts: number;
  windowStart: number;
  sent: number;
};
export class LoginCodeError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
  }
}
export const normalizeLoginEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
export const validLoginEmail = (email: string) =>
  email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const keyFor = (id: number) => `admin_login_code_${id}`;
function parse(value: string | null | undefined): Challenge | null {
  try {
    const raw = JSON.parse(value || 'null');
    return raw &&
      typeof raw.id === 'string' &&
      typeof raw.hash === 'string' &&
      Number.isFinite(raw.expires) &&
      Number.isFinite(raw.attempts) &&
      Number.isFinite(raw.sent) &&
      Number.isFinite(raw.windowStart) &&
      Number.isFinite(raw.resendAt)
      ? raw
      : null;
  } catch {
    return null;
  }
}
function hash(email: string, id: string, code: string) {
  return createHmac('sha256', config.jwtSecret)
    .update(`admin-login:${email}:${id}:${code}`)
    .digest('hex');
}
function equal(a: string, b: string) {
  const aa = Buffer.from(a, 'hex'),
    bb = Buffer.from(b, 'hex');
  return aa.length === bb.length && aa.length > 0 && timingSafeEqual(aa, bb);
}
const invalid = () =>
  new LoginCodeError(401, 'Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.');

// Existing per-restaurant settings provide durable, atomic state across processes.
// Codes are never stored or logged in plain text. No schema change is required.
export async function requestAdminLoginCode(email: string) {
  if (!loginMailConfigured())
    throw new LoginCodeError(
      503,
      'Hızlı giriş şu anda kullanılamıyor. Şifreli giriş yapabilirsiniz.'
    );
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = { challengeId: randomUUID(), expiresIn: TTL / 1000, retryAfter: COOLDOWN / 1000 };
  if (!user || !user.isActive) return generic;
  const key = keyFor(user.id);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: user.restaurantId, key } },
  });
  const previous = parse(row?.value);
  const now = Date.now();
  if (previous && previous.resendAt > now) {
    if (!previous.hash || previous.expires <= now || previous.attempts >= 5)
      throw new LoginCodeError(
        429,
        'Yeni kod istemeden önce bir dakika bekleyin.',
        Math.ceil((previous.resendAt - now) / 1000)
      );
    return {
      ...generic,
      challengeId: previous.id,
      retryAfter: Math.ceil((previous.resendAt - now) / 1000),
      expiresIn: Math.ceil((previous.expires - now) / 1000),
    };
  }
  const sent = previous && now - previous.windowStart < WINDOW ? previous.sent : 0;
  if (sent >= 5)
    throw new LoginCodeError(
      429,
      'Çok fazla kod istendi. Biraz sonra tekrar deneyin.',
      Math.ceil((previous!.windowStart + WINDOW - now) / 1000)
    );
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge: Challenge = {
    id: generic.challengeId,
    hash: hash(email, generic.challengeId, code),
    expires: now + TTL,
    resendAt: now + COOLDOWN,
    attempts: 0,
    windowStart: sent ? previous!.windowStart : now,
    sent: sent + 1,
  };
  const value = JSON.stringify(challenge);
  if (row) {
    const updated = await prisma.setting.updateMany({
      where: { id: row.id, value: row.value },
      data: { value },
    });
    if (!updated.count) throw new LoginCodeError(429, 'Lütfen biraz sonra tekrar deneyin.', 60);
  } else {
    try {
      await prisma.setting.create({ data: { restaurantId: user.restaurantId, key, value } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new LoginCodeError(429, 'Lütfen biraz sonra tekrar deneyin.', 60);
      throw error;
    }
  }
  try {
    await sendLoginCode(email, code);
  } catch {
    // Invalidate an undelivered code, preserving the rate limit reservation.
    await prisma.setting.updateMany({
      where: { restaurantId: user.restaurantId, key, value },
      data: { value: JSON.stringify({ ...challenge, hash: '', expires: 0 }) },
    });
    throw new LoginCodeError(
      503,
      'Kod gönderilemedi. Biraz sonra tekrar deneyin veya şifreli giriş yapın.'
    );
  }
  return generic;
}

export async function verifyAdminLoginCode(email: string, id: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { restaurant: true } });
  if (!user || !user.isActive) throw invalid();
  const key = keyFor(user.id);
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId: user.restaurantId, key } },
  });
  const challenge = parse(row?.value);
  if (
    !row ||
    !challenge ||
    challenge.id !== id ||
    challenge.expires <= Date.now() ||
    challenge.attempts >= 5 ||
    !challenge.hash
  )
    throw invalid();
  const correct = equal(challenge.hash, hash(email, id, code));
  const next = {
    ...challenge,
    attempts: challenge.attempts + 1,
    ...(correct ? { hash: '', expires: 0 } : {}),
  };
  const updated = await prisma.setting.updateMany({
    where: { id: row.id, value: row.value },
    data: { value: JSON.stringify(next) },
  });
  if (!updated.count || !correct) throw invalid();
  return user;
}

// Bounded per-process IP protection complements the durable per-account limits.
const buckets = new Map<string, { start: number; count: number }>();
export function allowLoginCodeRequest(ip: string, kind: 'send' | 'verify') {
  const now = Date.now();
  for (const [key, row] of buckets) if (now - row.start > 15 * 60_000) buckets.delete(key);
  const key = `${kind}:${ip}`;
  const row = buckets.get(key);
  if (!row) {
    if (buckets.size >= 10000) return false;
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  row.count++;
  return row.count <= (kind === 'send' ? 30 : 60);
}
