import { prisma } from './prisma.js';
import { ACTIVE_STATUSES } from './table-floor.js';

export const TABLE_SESSION_CODE_ENABLED_KEY = 'table_session_code_enabled';
export const TABLE_SESSION_CODE_TTL_KEY = 'table_session_code_ttl_minutes';

export const DEFAULT_TABLE_SESSION_CODE_TTL = 120;

export function isTableSessionCodeEnabled(raw?: string | null): boolean {
  return raw === 'true' || raw === '1';
}

export function parseTableSessionCodeTtl(raw?: string | null): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_TABLE_SESSION_CODE_TTL;
  return Math.min(24 * 60, Math.max(15, n));
}

export async function loadTableSessionCodeConfig(restaurantId: number) {
  const rows = await prisma.setting.findMany({
    where: {
      restaurantId,
      key: { in: [TABLE_SESSION_CODE_ENABLED_KEY, TABLE_SESSION_CODE_TTL_KEY] },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: isTableSessionCodeEnabled(map[TABLE_SESSION_CODE_ENABLED_KEY]),
    ttlMinutes: parseTableSessionCodeTtl(map[TABLE_SESSION_CODE_TTL_KEY]),
  };
}

function randomDigits(length: number) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}

/** Restoran içinde aktif oturumlar arasında benzersiz 6 haneli kod */
export async function generateUniqueAccessCode(restaurantId: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomDigits(6);
    const clash = await prisma.tableFloorSession.findFirst({
      where: {
        restaurantId,
        accessCode: code,
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // Çok düşük ihtimal — zaman damgası ile zorla üret
  return `${Date.now()}`.slice(-6);
}

export function codeExpiryDate(ttlMinutes: number, from = new Date()) {
  return new Date(from.getTime() + ttlMinutes * 60_000);
}

export function isCodeExpired(expiresAt?: Date | null, now = new Date()) {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

export function isCodeVerified(session: {
  codeVerifiedAt?: Date | null;
  codeExpiresAt?: Date | null;
  accessCode?: string | null;
}) {
  if (!session.accessCode || !session.codeVerifiedAt) return false;
  if (isCodeExpired(session.codeExpiresAt)) return false;
  return true;
}

export type CodeGateStatus =
  | 'empty'
  | 'pending'
  | 'verified'
  | 'expired';

export function resolveCodeGateStatus(session: {
  accessCode?: string | null;
  codeVerifiedAt?: Date | null;
  codeExpiresAt?: Date | null;
} | null): CodeGateStatus {
  if (!session?.accessCode) return 'empty';
  if (isCodeExpired(session.codeExpiresAt)) return 'expired';
  if (session.codeVerifiedAt) return 'verified';
  return 'pending';
}
