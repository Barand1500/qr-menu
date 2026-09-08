/** Admin panel URL yolu — varsayılan "admin" → /admin */

export const DEFAULT_ADMIN_PATH = 'admin';
const STORAGE_KEY = 'menu_qr_admin_path';

const BLOCKED = new Set([
  'login',
  'menu',
  'm',
  'api',
  'uploads',
  'assets',
  'health',
  'favicon.ico',
  'robots.txt',
  'index.html',
  'static',
  'public',
  'src',
  'node_modules',
]);

/** UI’da gösterilen yasaklı yollar (slug) */
export const BLOCKED_ADMIN_PATHS = [...BLOCKED].sort((a, b) => a.localeCompare(b));

let cachedSlug =
  (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || DEFAULT_ADMIN_PATH;

export function normalizeAdminPath(raw: unknown): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || DEFAULT_ADMIN_PATH;
}

export function validateAdminPath(
  raw: unknown
): { ok: true; path: string } | { ok: false; message: string } {
  const path = normalizeAdminPath(raw);
  if (path.length < 3) return { ok: false, message: 'Panel yolu en az 3 karakter olmalı' };
  if (path.length > 40) return { ok: false, message: 'Panel yolu en fazla 40 karakter olabilir' };
  if (/^\d+$/.test(path)) return { ok: false, message: 'Panel yolu yalnızca rakam olamaz' };
  if (!/^[a-z][a-z0-9_-]*$/.test(path)) {
    return { ok: false, message: 'Küçük harfle başlamalı; sadece harf, rakam, tire ve alt çizgi' };
  }
  if (BLOCKED.has(path)) {
    return { ok: false, message: `"${path}" sistem tarafından ayrılmış; kullanılamaz` };
  }
  return { ok: true, path };
}

export function getAdminPathSlug() {
  return normalizeAdminPath(cachedSlug);
}

export function setAdminPathSlug(slug: string) {
  cachedSlug = normalizeAdminPath(slug);
  try {
    localStorage.setItem(STORAGE_KEY, cachedSlug);
  } catch {
    /* ignore */
  }
  return cachedSlug;
}

/** /admin veya /yonetim/users */
export function adminPath(...segments: (string | number | null | undefined)[]) {
  const base = `/${getAdminPathSlug()}`;
  const rest = segments
    .filter((s) => s != null && String(s).length > 0)
    .map((s) => String(s).replace(/^\/+|\/+$/g, ''))
    .join('/');
  return rest ? `${base}/${rest}` : base;
}

export function suggestAdminPath() {
  const rand = Math.random().toString(36).slice(2, 6);
  return `panel-${rand}`;
}

export async function fetchAndCacheAdminPath(): Promise<string> {
  try {
    const res = await fetch('/api/public/admin-path', { credentials: 'same-origin' });
    if (res.ok) {
      const data = (await res.json()) as { path?: string };
      return setAdminPathSlug(data.path || DEFAULT_ADMIN_PATH);
    }
  } catch {
    /* keep cached */
  }
  return getAdminPathSlug();
}
