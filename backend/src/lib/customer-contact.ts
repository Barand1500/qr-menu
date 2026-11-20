import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { prisma } from './prisma.js';
import { customerMailConfigured } from './customer-mail.js';
import { isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from './customer-auth.js';
import { loadActiveSmtp, loadSms, smsComplete, type SmsConfig, type SmtpConfig } from './integrations.js';
import { sendSms, smtpFrom, smtpTransport } from './integration-send.js';

/**
 * Müşterinin telefon / e-posta değiştirmesi: yeni değer doğrulama koduyla onaylanır.
 * Kod, menünün işletmesinin Entegrasyonlar ayarına göre gider: telefon → SMS, e-posta → e-posta;
 * o kanal yoksa diğer açık kanal kullanılır; ikisi de yoksa işlem yapılamaz.
 */
export type ContactField = 'phone' | 'email';
export type ContactChannel = 'sms' | 'email';

export class ContactError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const TTL = 5 * 60_000;
const COOLDOWN = 60_000;
const WINDOW = 60 * 60_000;
const MAX_SENDS = 5;
const MAX_ATTEMPTS = 5;

export const UNAVAILABLE = 'Maalesef şu an bu işlem yapılamıyor. Lütfen daha sonra tekrar deneyin.';

export type Available = { sms: boolean; email: boolean };

/** Hangi kanalla, kime gideceği. Saf fonksiyon: ayarlar ve hesap bilgisi verilir. */
export function chooseChannel(
  field: ContactField,
  available: Available,
  customer: { phone: string | null; email: string | null },
  newValue: string,
): { channel: ContactChannel; to: string } {
  if (field === 'phone') {
    if (available.sms) return { channel: 'sms', to: newValue };
    if (available.email) {
      if (!customer.email) throw new ContactError(422, 'Telefonu değiştirmek için hesabında bir e-posta adresi olmalı.');
      return { channel: 'email', to: customer.email };
    }
  } else {
    if (available.email) return { channel: 'email', to: newValue };
    if (available.sms) {
      if (!customer.phone) throw new ContactError(422, 'E-postayı değiştirmek için hesabında bir telefon numarası olmalı.');
      return { channel: 'sms', to: customer.phone };
    }
  }
  throw new ContactError(503, UNAVAILABLE);
}

export const maskPhone = (p: string) => (p.length >= 4 ? `${p.slice(0, 1)}•• ••• •• ${p.slice(-2)}` : '••••');
export function maskEmail(e: string) {
  const [name, domain] = e.split('@');
  return `${(name || '').slice(0, 1)}•••@${domain || ''}`;
}

type Challenge = {
  id: string;
  hash: string;
  expires: number;
  resendAt: number;
  attempts: number;
  windowStart: number;
  sent: number;
  field: ContactField;
  value: string;
};

const keyFor = (customerId: number) => `customer_contact_${customerId}`;
const digest = (customerId: number, c: { id: string; field: string; value: string }, code: string) =>
  createHmac('sha256', config.jwtSecret).update(`contact:${customerId}:${c.id}:${c.field}:${c.value}:${code}`).digest('hex');
const same = (a: string, b: string) => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};
function parse(raw: string | null | undefined): Challenge | null {
  try {
    const c = JSON.parse(raw || 'null');
    return c && typeof c.id === 'string' && typeof c.hash === 'string' && Number.isFinite(c.expires) ? (c as Challenge) : null;
  } catch {
    return null;
  }
}

/** Yeni değeri biçimlendirir ve doğrular; telefon 5XXXXXXXXX, e-posta küçük harf. */
export function cleanValue(field: ContactField, raw: unknown): string {
  if (field === 'phone') {
    const phone = normalizePhone(String(raw || ''));
    if (!isValidPhone(phone)) throw new ContactError(400, 'Geçerli bir cep telefonu girin (5XX XXX XX XX).');
    return phone;
  }
  const email = normalizeEmail(String(raw || ''));
  if (!isValidEmail(email)) throw new ContactError(400, 'Geçerli bir e-posta adresi girin.');
  return email;
}

async function availability(restaurantId: number) {
  const [sms, smtp] = await Promise.all([loadSms(restaurantId).catch(() => null), loadActiveSmtp(restaurantId)]);
  const smsCfg: SmsConfig | null = sms && sms.enabled && smsComplete(sms) ? sms : null;
  return {
    smsCfg,
    smtp,
    available: { sms: Boolean(smsCfg), email: Boolean(smtp) || customerMailConfigured() } satisfies Available,
  };
}

async function sendCodeEmail(to: string, code: string, smtp: SmtpConfig | null, restaurantName: string) {
  const transport = smtp
    ? smtpTransport(smtp)
    : nodemailer.createTransport({
        host: process.env.CUSTOMER_SMTP_HOST,
        port: Number(process.env.CUSTOMER_SMTP_PORT || 587),
        secure: Number(process.env.CUSTOMER_SMTP_PORT || 587) === 465,
        requireTLS: Number(process.env.CUSTOMER_SMTP_PORT || 587) !== 465,
        auth: { user: process.env.CUSTOMER_SMTP_USER, pass: process.env.CUSTOMER_SMTP_PASSWORD },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
  try {
    await transport.sendMail({
      from: smtp ? smtpFrom(smtp) : process.env.CUSTOMER_MAIL_FROM,
      to,
      subject: 'Bilgi güncelleme doğrulama kodunuz',
      text: `Hesap bilginizi güncellemek için doğrulama kodunuz: ${code}\n\nKod 5 dakika geçerlidir. Kodu kimseyle paylaşmayın. Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:28px;background:#fff;border:1px solid #e5e7eb;border-radius:18px;color:#1c1530"><p style="margin:0 0 6px;font-size:13px;color:#6d28d9;font-weight:700">${restaurantName.replace(/[<>]/g, '')}</p><h1 style="margin:0 0 12px;font-size:22px">Doğrulama kodunuz</h1><p style="font-size:34px;font-weight:700;letter-spacing:8px;background:#f5f2fd;padding:18px;border-radius:12px;text-align:center;margin:0 0 14px">${code}</p><p style="font-size:13px;color:#5b5575;line-height:1.5">Kod 5 dakika geçerlidir. Kodu kimseyle paylaşmayın.<br>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p></div>`,
    });
  } finally {
    transport.close();
  }
}

export async function requestContactChange(input: {
  customerId: number;
  restaurantId: number;
  field: ContactField;
  value: unknown;
}) {
  const { customerId, restaurantId, field } = input;
  const value = cleanValue(field, input.value);
  const [customer, restaurant, taken] = await Promise.all([
    prisma.menuCustomer.findUnique({ where: { id: customerId }, select: { id: true, phone: true, email: true } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }),
    field === 'phone' ? prisma.menuCustomer.findUnique({ where: { phone: value } }) : prisma.menuCustomer.findUnique({ where: { email: value } }),
  ]);
  if (!customer) throw new ContactError(401, 'Oturum geçersiz');
  if (!restaurant) throw new ContactError(400, 'İşletme bulunamadı.');
  if ((field === 'phone' ? customer.phone : customer.email) === value) throw new ContactError(400, 'Bu bilgi zaten hesabında kayıtlı.');
  if (taken && taken.id !== customerId) {
    throw new ContactError(409, field === 'phone' ? 'Bu telefon başka bir hesapta kayıtlı.' : 'Bu e-posta başka bir hesapta kayıtlı.');
  }

  const { smsCfg, smtp, available } = await availability(restaurantId);
  const target = chooseChannel(field, available, customer, value);

  const key = { restaurantId_key: { restaurantId, key: keyFor(customerId) } };
  const row = await prisma.setting.findUnique({ where: key });
  const prev = parse(row?.value);
  const now = Date.now();
  if (prev && prev.resendAt > now && prev.hash) {
    throw new ContactError(429, 'Yeni kod istemeden önce bir dakika bekleyin.', Math.ceil((prev.resendAt - now) / 1000));
  }
  const windowStart = prev && now - prev.windowStart < WINDOW ? prev.windowStart : now;
  const sent = prev && windowStart === prev.windowStart ? prev.sent : 0;
  if (sent >= MAX_SENDS) throw new ContactError(429, 'Çok fazla kod istendi. Biraz sonra tekrar deneyin.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge: Challenge = {
    id: randomUUID(),
    hash: '',
    expires: now + TTL,
    resendAt: now + COOLDOWN,
    attempts: 0,
    windowStart,
    sent: sent + 1,
    field,
    value,
  };
  challenge.hash = digest(customerId, challenge, code);
  const stored = JSON.stringify(challenge);
  await prisma.setting.upsert({ where: key, update: { value: stored }, create: { restaurantId, key: keyFor(customerId), value: stored } });

  try {
    if (target.channel === 'sms') {
      await sendSms(smsCfg!, target.to, `${restaurant.name}: doğrulama kodunuz ${code}. 5 dk geçerli, kimseyle paylaşmayın.`);
    } else {
      await sendCodeEmail(target.to, code, smtp, restaurant.name);
    }
  } catch {
    // Gönderilemeyen kod geçersiz sayılır; deneme hakkı korunur.
    await prisma.setting.update({ where: key, data: { value: JSON.stringify({ ...challenge, hash: '', expires: 0 }) } });
    throw new ContactError(503, 'Kod gönderilemedi. Biraz sonra tekrar deneyin.');
  }
  return {
    challengeId: challenge.id,
    channel: target.channel,
    maskedTo: target.channel === 'sms' ? maskPhone(target.to) : maskEmail(target.to),
    retryAfter: COOLDOWN / 1000,
    expiresIn: TTL / 1000,
  };
}

export async function verifyContactChange(input: {
  customerId: number;
  restaurantId: number;
  field: ContactField;
  value: unknown;
  challengeId: unknown;
  code: unknown;
}) {
  const { customerId, restaurantId, field } = input;
  const value = cleanValue(field, input.value);
  const bad = () => new ContactError(401, 'Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.');
  if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) || typeof input.challengeId !== 'string') throw bad();
  const key = { restaurantId_key: { restaurantId, key: keyFor(customerId) } };
  const row = await prisma.setting.findUnique({ where: key });
  const c = parse(row?.value);
  if (!row || !c || c.id !== input.challengeId || c.field !== field || c.value !== value || !c.hash || c.expires <= Date.now() || c.attempts >= MAX_ATTEMPTS) throw bad();

  const ok = same(c.hash, digest(customerId, c, input.code));
  const next = { ...c, attempts: c.attempts + 1, ...(ok ? { hash: '', expires: 0 } : {}) };
  const claimed = await prisma.setting.updateMany({ where: { id: row.id, value: row.value }, data: { value: JSON.stringify(next) } });
  if (!claimed.count || !ok) throw bad();

  try {
    return await prisma.menuCustomer.update({ where: { id: customerId }, data: field === 'phone' ? { phone: value } : { email: value } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new ContactError(409, field === 'phone' ? 'Bu telefon başka bir hesapta kayıtlı.' : 'Bu e-posta başka bir hesapta kayıtlı.');
    throw e;
  }
}
