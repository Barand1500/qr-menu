export type AdminPageAnimLevel = 'fazla' | 'normal' | 'az';

export const ADMIN_PAGE_ANIM_KEY = 'menu_qr_admin_page_anim';
export const ADMIN_PAGE_ANIM_EVENT = 'menu-qr-admin-page-anim';

export const ADMIN_PAGE_ANIM_OPTIONS: {
  id: AdminPageAnimLevel;
  label: string;
  hint: string;
}[] = [
  { id: 'az', label: 'Az', hint: 'Hafif geçiş' },
  { id: 'normal', label: 'Normal', hint: 'Dengeli' },
  { id: 'fazla', label: 'Fazla', hint: 'Belirgin kayma' },
];

export function parseAdminPageAnimLevel(raw: unknown): AdminPageAnimLevel {
  if (raw === 'fazla' || raw === 'az' || raw === 'normal') return raw;
  return 'normal';
}

export function readAdminPageAnimLevel(): AdminPageAnimLevel {
  try {
    return parseAdminPageAnimLevel(localStorage.getItem(ADMIN_PAGE_ANIM_KEY));
  } catch {
    return 'normal';
  }
}

export function writeAdminPageAnimLevel(level: AdminPageAnimLevel) {
  try {
    localStorage.setItem(ADMIN_PAGE_ANIM_KEY, level);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_PAGE_ANIM_EVENT, { detail: level }));
  }
}

export function getAdminPageAnimPreset(level: AdminPageAnimLevel) {
  if (level === 'fazla') {
    return { y: 56, duration: 0.62, stagger: 0.085, scale: 0.96, ease: 'power3.out' as const };
  }
  if (level === 'az') {
    return { y: 14, duration: 0.28, stagger: 0.028, scale: 1, ease: 'power2.out' as const };
  }
  return { y: 32, duration: 0.42, stagger: 0.05, scale: 0.985, ease: 'power3.out' as const };
}

/** Sayfa kökündeki kutuları topla (tek sarmalayıcıyı deler). */
export function collectAdminPageAnimTargets(root: HTMLElement): HTMLElement[] {
  const direct = Array.from(root.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (direct.length === 0) return [];

  let pool = direct;
  if (direct.length === 1) {
    const inner = Array.from(direct[0].children).filter(
      (n): n is HTMLElement => n instanceof HTMLElement
    );
    if (inner.length >= 2) pool = inner;
  }

  return pool.filter((el) => {
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}
