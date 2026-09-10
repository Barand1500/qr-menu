/** Admin panel URL yolu — varsayılan "admin" → /admin */

export const DEFAULT_ADMIN_PATH = 'admin';

export const RESERVED_ADMIN_PATHS = new Set([
  'admin', // not reserved for validation when default — handled separately
  'login',
  'garson',
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

/** Kullanıcının seçemeyeceği (çakışan) path'ler — "admin" serbest (varsayılan) */
const BLOCKED = new Set([
  'login',
  'garson',
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

export function validateAdminPath(raw: unknown): { ok: true; path: string } | { ok: false; message: string } {
  const path = normalizeAdminPath(raw);
  if (path.length < 3) {
    return { ok: false, message: 'Panel yolu en az 3 karakter olmalı' };
  }
  if (path.length > 40) {
    return { ok: false, message: 'Panel yolu en fazla 40 karakter olabilir' };
  }
  if (/^\d+$/.test(path)) {
    return { ok: false, message: 'Panel yolu yalnızca rakam olamaz' };
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(path)) {
    return { ok: false, message: 'Küçük harfle başlamalı; sadece harf, rakam, tire ve alt çizgi' };
  }
  if (BLOCKED.has(path)) {
    return { ok: false, message: `"${path}" sistem tarafından ayrılmış; kullanılamaz` };
  }
  return { ok: true, path };
}

export const ADMIN_PATH_KEY = 'admin_path';
