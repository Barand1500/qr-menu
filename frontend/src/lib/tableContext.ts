import { useEffect, useState } from 'react';
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
  // Grup varsa "Bahçe 5" gibi, yoksa "Masa 5" yazılır.
  if (groupSlug && groupSlug !== ADMIN_PREVIEW_GROUP) {
    return `${readGroupName(groupSlug)} ${tableNumber}`;
  }
  return `Masa ${tableNumber}`;
}

const GROUP_NAME_KEY = 'menu_grup_name';
const GROUP_NAME_EVENT = 'menu-table-name';

/** Masa grubunun görünen adı (sunucudan gelir); menü başlığında "Bahçe 2" yazması için saklanır. */
export function rememberTableGroupName(slug: string | null, name: string | null | undefined) {
  if (!slug || !name) return;
  try {
    if (sessionStorage.getItem(GROUP_NAME_KEY + ':' + slug) === name) return;
    sessionStorage.setItem(GROUP_NAME_KEY + ':' + slug, name);
  } catch {
    /* depolama kapalı */
  }
  window.dispatchEvent(new Event(GROUP_NAME_EVENT));
}

function readGroupName(slug: string) {
  try {
    const name = sessionStorage.getItem(GROUP_NAME_KEY + ':' + slug);
    if (name) return name;
  } catch {
    /* yok say */
  }
  // Ad henüz gelmediyse adresten okunabilir bir ad türet
  return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toLocaleUpperCase('tr'));
}

/** "Bahçe 2" (grup varsa) ya da "Masa 2". Ad sunucudan gelince kendiliğinden güncellenir. */
export function useTableLabel(tableWord: string, masaOverride?: string | null, grupOverride?: string | null) {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    window.addEventListener(GROUP_NAME_EVENT, on);
    return () => window.removeEventListener(GROUP_NAME_EVENT, on);
  }, []);
  const ctx = getTableContext();
  const masa = (masaOverride || ctx.masa || '').trim();
  const grup = (grupOverride || ctx.grup || '').trim();
  if (!masa) return null;
  if (masa === ADMIN_PREVIEW_TABLE) return null;
  if (grup && grup !== ADMIN_PREVIEW_GROUP) return `${readGroupName(grup)} ${masa}`;
  return `${tableWord} ${masa}`;
}

export function adminPreviewMenuUrl() {
  const params = new URLSearchParams({
    masa: ADMIN_PREVIEW_TABLE,
    grup: ADMIN_PREVIEW_GROUP,
  });
  return `/menu?${params}`;
}
