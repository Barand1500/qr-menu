/** QR’sız önizleme / admin “Menüyü Gör” test masası */
export const ADMIN_PREVIEW_TABLE = 'admin';
export const ADMIN_PREVIEW_GROUP = 'onizleme';

export function getTableContext() {
  if (typeof sessionStorage === 'undefined') {
    return { masa: '', grup: '' };
  }
  return {
    masa: sessionStorage.getItem('menu_masa') || '',
    grup: sessionStorage.getItem('menu_grup') || '',
  };
}

/** Gerçek masa yoksa admin önizleme masası kullanılır */
export function resolveTableContext() {
  const ctx = getTableContext();
  if (ctx.masa) return { ...ctx, isPreview: false as const };
  return {
    masa: ADMIN_PREVIEW_TABLE,
    grup: ADMIN_PREVIEW_GROUP,
    isPreview: true as const,
  };
}

export function formatTableServiceLabel(tableNumber: string, groupSlug?: string | null) {
  if (tableNumber === ADMIN_PREVIEW_TABLE) return 'Admin masası';
  const group =
    groupSlug && groupSlug !== ADMIN_PREVIEW_GROUP
      ? ` · ${groupSlug.charAt(0).toUpperCase()}${groupSlug.slice(1)}`
      : '';
  return `Masa ${tableNumber}${group}`;
}

export function adminPreviewMenuUrl() {
  const params = new URLSearchParams({
    masa: ADMIN_PREVIEW_TABLE,
    grup: ADMIN_PREVIEW_GROUP,
  });
  return `/menu?${params}`;
}
