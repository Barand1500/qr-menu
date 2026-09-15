export const DEFAULT_SITE_TITLE = 'Menu QR';
export const SITE_TITLE_STORAGE_KEY = 'menu_qr_site_title';

export function normalizeSiteTitle(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

export function validateSiteTitle(
  raw: unknown
): { ok: true; title: string } | { ok: false; message: string } {
  const title = normalizeSiteTitle(raw);
  if (!title) return { ok: false, message: 'Site adı boş olamaz' };
  if (title.length < 2) return { ok: false, message: 'Site adı en az 2 karakter olmalı' };
  return { ok: true, title };
}

export function getSiteTitle(): string {
  try {
    const cached = normalizeSiteTitle(localStorage.getItem(SITE_TITLE_STORAGE_KEY));
    if (cached) return cached;
  } catch {
    /* ignore */
  }
  return DEFAULT_SITE_TITLE;
}

export function setSiteTitle(raw: unknown): string {
  const title = normalizeSiteTitle(raw) || DEFAULT_SITE_TITLE;
  try {
    localStorage.setItem(SITE_TITLE_STORAGE_KEY, title);
  } catch {
    /* ignore */
  }
  applyDocumentTitle(title);
  return title;
}

export function applyDocumentTitle(title?: string) {
  const next = normalizeSiteTitle(title) || getSiteTitle();
  if (typeof document !== 'undefined') {
    document.title = next;
  }
}

export async function fetchAndCacheSiteTitle(): Promise<string> {
  try {
    const res = await fetch('/api/public/site-title');
    if (!res.ok) throw new Error('fail');
    const data = (await res.json()) as { title?: string };
    return setSiteTitle(data.title || DEFAULT_SITE_TITLE);
  } catch {
    applyDocumentTitle(getSiteTitle());
    return getSiteTitle();
  }
}
