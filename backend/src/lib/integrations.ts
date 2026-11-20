import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config.js';
import { prisma } from './prisma.js';

/** İşletme bazlı entegrasyon ayarları (e-posta/SMTP ve SMS). Gizli alanlar şifreli saklanır, istemciye hiç dönmez. */
export const SMTP_KEY = 'integration_smtp';
export const SMS_KEY = 'integration_sms';

// ───────── gizli alan şifreleme ─────────
const key = () => createHash('sha256').update(`${config.jwtSecret}:integrations`).digest();

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `enc:v1:${[iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:v1:')) return stored;
  try {
    const [iv, tag, data] = stored.slice(7).split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ───────── SMTP ─────────
export const SMTP_ENCRYPTIONS = ['starttls', 'ssl', 'none'] as const;
export type SmtpConfig = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: (typeof SMTP_ENCRYPTIONS)[number];
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
};

export const DEFAULT_SMTP: SmtpConfig = {
  enabled: false,
  host: '',
  port: 587,
  encryption: 'starttls',
  user: '',
  password: '',
  fromName: '',
  fromEmail: '',
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const obj = (v: unknown): Record<string, unknown> => {
  try {
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/** İstemciden/kayıttan gelen veriyi temizler. `password` düz metindir (şifreli saklama ayrıca yapılır). */
export function parseSmtp(raw: unknown): SmtpConfig {
  const s = obj(raw);
  const port = Number(s.port);
  const enc = String(s.encryption);
  const host = str(s.host, 255).toLowerCase();
  return {
    enabled: s.enabled === true,
    host: HOST.test(host) ? host : '',
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_SMTP.port,
    encryption: (SMTP_ENCRYPTIONS as readonly string[]).includes(enc) ? (enc as SmtpConfig['encryption']) : 'starttls',
    user: str(s.user, 190),
    password: typeof s.password === 'string' ? s.password.slice(0, 500) : '',
    fromName: str(s.fromName, 120).replace(/[\r\n"<>]/g, ''),
    fromEmail: EMAIL.test(str(s.fromEmail, 190)) ? str(s.fromEmail, 190) : '',
  };
}

export function smtpComplete(c: SmtpConfig) {
  return Boolean(c.host && c.user && c.password && c.fromEmail);
}

/** Boş şifre = mevcut şifre korunur; clearPassword ile silinir. */
export function mergeSmtp(input: unknown, previous: SmtpConfig): SmtpConfig {
  const next = parseSmtp(input);
  const raw = obj(input);
  if (raw.clearPassword === true) next.password = '';
  else if (!next.password) next.password = previous.password;
  return next;
}

export function smtpForClient(c: SmtpConfig) {
  const { password, ...rest } = c;
  return { ...rest, passwordSet: Boolean(password) };
}

export async function loadSmtp(restaurantId: number): Promise<SmtpConfig> {
  const row = await prisma.setting.findUnique({ where: { restaurantId_key: { restaurantId, key: SMTP_KEY } } });
  const c = parseSmtp(row?.value);
  c.password = decryptSecret(obj(row?.value).password as string);
  return c;
}

export async function saveSmtp(restaurantId: number, c: SmtpConfig) {
  const value = JSON.stringify({ ...c, password: encryptSecret(c.password) });
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: SMTP_KEY } },
    update: { value },
    create: { restaurantId, key: SMTP_KEY, value },
  });
}

/** Giriş kodu gibi sistem postaları için: işletme kendi SMTP'sini açıp tamamladıysa o. Yoksa null. */
export async function loadActiveSmtp(restaurantId: number): Promise<SmtpConfig | null> {
  try {
    const c = await loadSmtp(restaurantId);
    return c.enabled && smtpComplete(c) ? c : null;
  } catch {
    return null;
  }
}

// ───────── SMS ─────────
export const SMS_PROVIDERS = ['netgsm', 'twilio', 'webhook'] as const;
export type SmsConfig = {
  enabled: boolean;
  provider: (typeof SMS_PROVIDERS)[number];
  netgsm: { usercode: string; password: string; header: string };
  twilio: { accountSid: string; authToken: string; from: string };
  webhook: { url: string; token: string };
};

export const DEFAULT_SMS: SmsConfig = {
  enabled: false,
  provider: 'netgsm',
  netgsm: { usercode: '', password: '', header: '' },
  twilio: { accountSid: '', authToken: '', from: '' },
  webhook: { url: '', token: '' },
};

export function parseSms(raw: unknown): SmsConfig {
  const s = obj(raw);
  const n = obj(s.netgsm);
  const t = obj(s.twilio);
  const w = obj(s.webhook);
  const url = str(w.url, 500);
  return {
    enabled: s.enabled === true,
    provider: (SMS_PROVIDERS as readonly string[]).includes(String(s.provider)) ? (s.provider as SmsConfig['provider']) : 'netgsm',
    netgsm: { usercode: str(n.usercode, 80), password: typeof n.password === 'string' ? n.password.slice(0, 200) : '', header: str(n.header, 11) },
    twilio: {
      accountSid: /^AC[0-9a-zA-Z]{20,40}$/.test(str(t.accountSid, 60)) ? str(t.accountSid, 60) : '',
      authToken: typeof t.authToken === 'string' ? t.authToken.slice(0, 200) : '',
      from: str(t.from, 40),
    },
    webhook: { url: /^https:\/\//i.test(url) ? url : '', token: typeof w.token === 'string' ? w.token.slice(0, 500) : '' },
  };
}

export function smsComplete(c: SmsConfig) {
  if (c.provider === 'netgsm') return Boolean(c.netgsm.usercode && c.netgsm.password && c.netgsm.header);
  if (c.provider === 'twilio') return Boolean(c.twilio.accountSid && c.twilio.authToken && c.twilio.from);
  return Boolean(c.webhook.url);
}

export function mergeSms(input: unknown, previous: SmsConfig): SmsConfig {
  const next = parseSms(input);
  const raw = obj(input);
  const clear = obj(raw.clear);
  if (clear.netgsm === true) next.netgsm.password = '';
  else if (!next.netgsm.password) next.netgsm.password = previous.netgsm.password;
  if (clear.twilio === true) next.twilio.authToken = '';
  else if (!next.twilio.authToken) next.twilio.authToken = previous.twilio.authToken;
  if (clear.webhook === true) next.webhook.token = '';
  else if (!next.webhook.token) next.webhook.token = previous.webhook.token;
  return next;
}

export function smsForClient(c: SmsConfig) {
  return {
    enabled: c.enabled,
    provider: c.provider,
    netgsm: { usercode: c.netgsm.usercode, header: c.netgsm.header, passwordSet: Boolean(c.netgsm.password) },
    twilio: { accountSid: c.twilio.accountSid, from: c.twilio.from, authTokenSet: Boolean(c.twilio.authToken) },
    webhook: { url: c.webhook.url, tokenSet: Boolean(c.webhook.token) },
  };
}

export async function loadSms(restaurantId: number): Promise<SmsConfig> {
  const row = await prisma.setting.findUnique({ where: { restaurantId_key: { restaurantId, key: SMS_KEY } } });
  const c = parseSms(row?.value);
  const raw = obj(row?.value);
  c.netgsm.password = decryptSecret(obj(raw.netgsm).password as string);
  c.twilio.authToken = decryptSecret(obj(raw.twilio).authToken as string);
  c.webhook.token = decryptSecret(obj(raw.webhook).token as string);
  return c;
}

export async function saveSms(restaurantId: number, c: SmsConfig) {
  const value = JSON.stringify({
    ...c,
    netgsm: { ...c.netgsm, password: encryptSecret(c.netgsm.password) },
    twilio: { ...c.twilio, authToken: encryptSecret(c.twilio.authToken) },
    webhook: { ...c.webhook, token: encryptSecret(c.webhook.token) },
  });
  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: SMS_KEY } },
    update: { value },
    create: { restaurantId, key: SMS_KEY, value },
  });
}

// ───────── yardımcılar ─────────
/** Türkiye odaklı: 05xx, 5xx, 905xx, +905xx → 905xxxxxxxxx; diğer ülkeler + ile yazılırsa olduğu gibi. */
export function normalizePhone(raw: string): string | null {
  const text = raw.trim();
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  if (text.startsWith('+')) return digits.length >= 10 && digits.length <= 15 ? digits : null;
  if (digits.startsWith('00')) return digits.length >= 12 && digits.length <= 17 ? digits.slice(2) : null;
  if (digits.length === 11 && digits.startsWith('0')) return `9${digits}`;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  if (digits.length === 12 && digits.startsWith('90')) return digits;
  return null;
}

export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

/** Yönetici girdisi olan bir adrese bağlanmadan önce: iç ağ adreslerine yönlendirmeyi engeller (SSRF). */
export async function assertPublicHost(host: string) {
  if (process.env.ALLOW_PRIVATE_INTEGRATIONS === '1') return;
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new IntegrationError('Bu adrese bağlanılamaz. İnternetten erişilebilen bir sunucu adresi yazın.');
  }
}

export class IntegrationError extends Error {}
