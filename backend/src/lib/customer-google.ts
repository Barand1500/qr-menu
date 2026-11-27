import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from './prisma.js';
import { signCustomerToken, customerPublic } from './customer-auth.js';
import { customerEmail } from './customer-email.js';

/** Müşteri menüsünde "Google ile devam et". Kimlik/sır boşsa özellik kapalıdır. */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 8000;
export const STATE_COOKIE = 'g_state';
const STATE_TTL_S = 600;

export function googleLoginConfig(): { id: string; secret: string } | null {
  const id = (process.env.CUSTOMER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
  const secret = (process.env.CUSTOMER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  return id && secret ? { id, secret } : null;
}

/** Google Console'daki "Authorized redirect URI" ile birebir aynı olmalı. */
export function googleRedirectUri(req: { protocol: string; get(name: string): string | undefined }): string {
  const fixed = (process.env.CUSTOMER_GOOGLE_REDIRECT_URI || '').trim();
  if (fixed) return fixed;
  const site = config.corsOrigin.map((o) => o.trim()).find((o) => o.startsWith('https://'));
  const base = site || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/+$/, '')}/api/customer/auth/google/callback`;
}

/** Yalnızca sitenin kendi yolu: "//evil.com" ya da "https://..." kabul edilmez. */
export function safeReturnPath(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && !/[\r\n]/.test(v) && v.length <= 500 ? v : '/';
}

export function readCookie(header: string | undefined, name: string): string {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

type StatePayload = { typ: 'gstate'; nonce: string; ret: string; rem: boolean };

/** Giriş denemesini bu tarayıcıya bağlar (başkasının hesabına giriş yaptırma saldırısına karşı). */
export function makeState(ret: string, remember: boolean): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = jwt.sign({ typ: 'gstate', nonce, ret, rem: remember } satisfies StatePayload, config.jwtSecret, { expiresIn: STATE_TTL_S });
  return { state, nonce };
}

export function readState(state: unknown, cookieNonce: string): StatePayload | null {
  try {
    const p = jwt.verify(String(state || ''), config.jwtSecret) as StatePayload;
    if (p.typ !== 'gstate' || !cookieNonce) return null;
    const a = Buffer.from(p.nonce);
    const b = Buffer.from(cookieNonce);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? p : null;
  } catch {
    return null;
  }
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export class GoogleLoginError extends Error {}

/** Kodu Google'a verip doğrulanmış e-posta ve adı alır (kimlik belirteci doğrudan Google'dan TLS ile gelir). */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ email: string; name: string }> {
  const cfg = googleLoginConfig();
  if (!cfg) throw new GoogleLoginError('disabled');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: cfg.id, client_secret: cfg.secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!res.ok) throw new GoogleLoginError('rejected');
    const json = (await res.json()) as { id_token?: string };
    const claims = parseIdToken(json.id_token || '', cfg.id);
    return claims;
  } catch (e) {
    if (e instanceof GoogleLoginError) throw e;
    throw new GoogleLoginError('unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export function parseIdToken(idToken: string, clientId: string, now = Date.now()): { email: string; name: string } {
  const part = idToken.split('.')[1];
  if (!part) throw new GoogleLoginError('rejected');
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleLoginError('rejected');
  }
  const issOk = c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com';
  const verified = c.email_verified === true || c.email_verified === 'true';
  const email = customerEmail(c.email);
  if (c.aud !== clientId || !issOk || Number(c.exp) * 1000 < now || !verified || !email) throw new GoogleLoginError('rejected');
  return { email, name: String(c.name || '').trim().slice(0, 150) };
}

/** E-postası doğrulanmış Google hesabı için müşteriyi bulur ya da açar; oturum belirteci döner. */
export async function signInWithGoogle(email: string, name: string, remember: boolean) {
  let row = await prisma.menuCustomer.findUnique({ where: { email } });
  if (!row) {
    try {
      row = await prisma.menuCustomer.create({
        data: {
          email,
          phone: null,
          // Google hesabında şifre yok: tahmin edilemez bir değer; isterse "şifremi unuttum" ile belirler
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
          fullName: name.length >= 2 ? name : 'Misafir',
          kvkkAcceptedAt: new Date(),
          allergenTags: [],
          dietTags: [],
          likedFoods: [],
          dislikedFoods: [],
          pointsJson: {},
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      row = await prisma.menuCustomer.findUnique({ where: { email } });
      if (!row) throw e;
    }
  } else if (row.fullName === 'Misafir' && name.length >= 2) {
    row = await prisma.menuCustomer.update({ where: { id: row.id }, data: { fullName: name } });
  }
  return { token: signCustomerToken(row.id, remember, row.authVersion), customer: customerPublic(row) };
}
