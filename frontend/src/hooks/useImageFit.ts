import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  adminKindOf,
  collectMenuImages,
  fitKey,
  parseImageFit,
  startImageFit,
  type FitKind,
  type ImageFitConfig,
} from '@/lib/imageFit';
import '@/image-fit.css';

export const IMAGE_FIT_CHANGED = 'image-fit-changed';

/** Menüde: işletmenin resim ayarını çekip, menüdeki ürün/grup/vitrin resimlerine uygular. */
export function usePublicImageFit(slug: string | undefined, entries: { url: string; kind: FitKind }[]) {
  const [cfg, setCfg] = useState<ImageFitConfig | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api<unknown>(`/api/menu/${slug}/image-fit`)
      .then((r) => alive && setCfg(parseImageFit(r)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug]);
  const map = useMemo(() => new Map(entries.map((e) => [fitKey(e.url), e.kind])), [entries]);
  useEffect(() => {
    if (!cfg?.enabled || !map.size) return;
    return startImageFit(cfg, (img) => map.get(fitKey(img.currentSrc || img.src)) ?? null);
  }, [cfg, map]);
}

/** Menü verisinden görsel listesini çıkarır (yalnızca veri değişince yeniden hesaplanır). */
export function useMenuImageEntries(menu: unknown) {
  return useMemo(() => collectMenuImages(menu), [menu]);
}

/** Yönetim panelinde: ürün/grup/vitrin sayfalarındaki küçük resimleri ayara göre gösterir. */
export function useAdminImageFit() {
  const [cfg, setCfg] = useState<ImageFitConfig | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<unknown>('/api/admin/settings/image-fit')
        .then((r) => alive && setCfg(parseImageFit(r)))
        .catch(() => undefined);
    void load();
    window.addEventListener(IMAGE_FIT_CHANGED, load);
    return () => {
      alive = false;
      window.removeEventListener(IMAGE_FIT_CHANGED, load);
    };
  }, []);
  useEffect(() => {
    if (!cfg?.enabled) return;
    return startImageFit(cfg, adminKindOf);
  }, [cfg]);
}
