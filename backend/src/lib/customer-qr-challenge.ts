/** Müşteri kişisel QR + 6 haneli kod — kısa ömürlü challenge (bellek içi) */

export const CUSTOMER_QR_TTL_MS = 45_000;

export type CustomerQrChallenge = {
  customerId: number;
  code: string;
  token: string;
  expiresAt: number;
};

const byCustomerId = new Map<number, CustomerQrChallenge>();
const byCode = new Map<string, CustomerQrChallenge>();
const byToken = new Map<string, CustomerQrChallenge>();

function randomDigits(length: number) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

function randomToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

function purgeExpired(now = Date.now()) {
  for (const [id, row] of byCustomerId) {
    if (row.expiresAt <= now) {
      byCustomerId.delete(id);
      byCode.delete(row.code);
      byToken.delete(row.token);
    }
  }
}

function uniqueCode(now = Date.now()): string {
  for (let i = 0; i < 40; i += 1) {
    const code = randomDigits(6);
    const existing = byCode.get(code);
    if (!existing || existing.expiresAt <= now) return code;
  }
  return `${Date.now()}`.slice(-6);
}

export function buildCustomerQrPayload(challenge: CustomerQrChallenge) {
  return `mqr-c1.${challenge.customerId}.${challenge.token}.${challenge.expiresAt}`;
}

export function issueCustomerQrChallenge(customerId: number): {
  qrPayload: string;
  code: string;
  expiresAt: number;
  ttlMs: number;
} {
  const now = Date.now();
  purgeExpired(now);

  const prev = byCustomerId.get(customerId);
  if (prev) {
    byCode.delete(prev.code);
    byToken.delete(prev.token);
  }

  const challenge: CustomerQrChallenge = {
    customerId,
    code: uniqueCode(now),
    token: randomToken(),
    expiresAt: now + CUSTOMER_QR_TTL_MS,
  };

  byCustomerId.set(customerId, challenge);
  byCode.set(challenge.code, challenge);
  byToken.set(challenge.token, challenge);

  return {
    qrPayload: buildCustomerQrPayload(challenge),
    code: challenge.code,
    expiresAt: challenge.expiresAt,
    ttlMs: CUSTOMER_QR_TTL_MS,
  };
}

export function lookupCustomerQrChallenge(input: {
  code?: string;
  qr?: string;
}): { customerId: number } | { error: string; status: number } {
  const now = Date.now();
  purgeExpired(now);

  const codeRaw = String(input.code || '')
    .replace(/\D/g, '')
    .slice(0, 6);
  const qrRaw = String(input.qr || '').trim();

  if (codeRaw.length === 6) {
    const row = byCode.get(codeRaw);
    if (!row || row.expiresAt <= now) {
      return { error: 'Kod geçersiz veya süresi dolmuş', status: 404 };
    }
    return { customerId: row.customerId };
  }

  if (qrRaw) {
    // Saf 6 hane QR alanına yapıştırılmış olabilir
    const asCode = qrRaw.replace(/\D/g, '');
    if (asCode.length === 6 && !qrRaw.includes('.')) {
      return lookupCustomerQrChallenge({ code: asCode });
    }

    const parts = qrRaw.split('.');
    if (parts[0] !== 'mqr-c1' || parts.length < 4) {
      return { error: 'QR kodu tanınamadı', status: 400 };
    }
    const customerId = Number(parts[1]);
    const token = parts[2];
    const exp = Number(parts[3]);
    if (!Number.isFinite(customerId) || !token || !Number.isFinite(exp)) {
      return { error: 'QR kodu geçersiz', status: 400 };
    }
    if (exp <= now) {
      return { error: 'QR süresi dolmuş — müşteri yenilesin', status: 410 };
    }
    const row = byToken.get(token);
    if (!row || row.customerId !== customerId || row.expiresAt <= now) {
      return { error: 'QR geçersiz veya süresi dolmuş', status: 404 };
    }
    return { customerId: row.customerId };
  }

  return { error: 'Kod veya QR gerekli', status: 400 };
}
