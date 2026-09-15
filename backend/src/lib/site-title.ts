export const SITE_TITLE_KEY = 'site_title';
export const DEFAULT_SITE_TITLE = 'Menu QR';

export function normalizeSiteTitle(raw: unknown): string {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return t;
}

export function validateSiteTitle(raw: unknown): { ok: true; title: string } | { ok: false; message: string } {
  const title = normalizeSiteTitle(raw);
  if (!title) {
    return { ok: false, message: 'Site adı boş olamaz' };
  }
  if (title.length < 2) {
    return { ok: false, message: 'Site adı en az 2 karakter olmalı' };
  }
  return { ok: true, title };
}
