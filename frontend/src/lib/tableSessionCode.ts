import { api } from '@/lib/api';

export const TABLE_SESSION_CODE_CACHE_PREFIX = 'menu_table_code_ok:';

export type TableSessionGateStatus = 'empty' | 'pending' | 'verified' | 'expired';

export type TableSessionGateInfo = {
  enabled: boolean;
  needsCode: boolean;
  tableNumber: string | null;
  groupSlug: string | null;
  status: TableSessionGateStatus;
  expiresAt?: string | null;
  ttlMinutes: number;
};

function cacheKey(slug: string, masa: string, grup: string | null) {
  return `${TABLE_SESSION_CODE_CACHE_PREFIX}${slug}:${grup || ''}:${masa}`;
}

export function readTableCodeCache(slug: string, masa: string, grup: string | null) {
  try {
    const raw = sessionStorage.getItem(cacheKey(slug, masa, grup));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: string };
    if (!parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(cacheKey(slug, masa, grup));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeTableCodeCache(
  slug: string,
  masa: string,
  grup: string | null,
  expiresAt: string
) {
  try {
    sessionStorage.setItem(cacheKey(slug, masa, grup), JSON.stringify({ expiresAt }));
  } catch {
    /* ignore */
  }
}

export function clearTableCodeCache(slug: string, masa: string, grup: string | null) {
  try {
    sessionStorage.removeItem(cacheKey(slug, masa, grup));
  } catch {
    /* ignore */
  }
}

export async function fetchTableSessionGate(
  slug: string,
  masa: string,
  grup: string | null
): Promise<TableSessionGateInfo> {
  const qs = new URLSearchParams();
  qs.set('masa', masa);
  if (grup) qs.set('grup', grup);
  return api<TableSessionGateInfo>(`/api/menu/${slug}/table-session-gate?${qs}`);
}

export async function unlockTableSession(
  slug: string,
  masa: string,
  grup: string | null,
  code: string
) {
  return api<{
    ok: boolean;
    verified: boolean;
    enabled: boolean;
    expiresAt?: string | null;
  }>(`/api/menu/${slug}/table-session-unlock`, {
    method: 'POST',
    body: JSON.stringify({ tableNumber: masa, groupSlug: grup, code }),
  });
}
