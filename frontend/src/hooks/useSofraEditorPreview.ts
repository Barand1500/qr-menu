import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type {
  SofraGroup,
  SofraProduct,
} from '@/components/public/sofra/SofraElements';
import type { SofraShowcaseItem } from '@/components/public/sofra/types';
import type { MenuStory } from '@/components/public/MobileStoriesStrip';
import type { PublicSocialLink } from '@/lib/socialCatalog';

type MenuSnapshot = {
  groups: SofraGroup[];
  showcase?: SofraShowcaseItem[];
  stories?: MenuStory[];
  socialLinks?: PublicSocialLink[];
};
type Content = {
  products: SofraProduct[];
  children?: { id: number; name: string; products: SofraProduct[] }[];
};

/** Read only the logged-in business's public data; drafts and publishing stay in the editor. */
export function useSofraEditorPreview(
  slug: string | undefined,
  lang: string,
  group: number | null,
  search: string,
  enabled: boolean,
) {
  const [snapshot, setSnapshot] = useState<{
    menu: MenuSnapshot | null;
    popular: SofraProduct[] | null;
    musicUrl: string | null;
  }>({ menu: null, popular: null, musicUrl: null });
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!slug || !enabled) return;
    let cancelled = false;
    const abort = new AbortController();
    setSnapshot({ menu: null, popular: null, musicUrl: null });
    const base = `/api/menu/${encodeURIComponent(slug)}`;
    const query = `?lang=${encodeURIComponent(lang)}`;
    void Promise.allSettled([
      api<MenuSnapshot>(base + query, { signal: abort.signal }),
      api<SofraProduct[]>(base + '/popular-products' + query, {
        signal: abort.signal,
      }),
      api<{ welcomeMusicUrl?: string | null }>(base + '/welcome' + query, {
        signal: abort.signal,
      }),
    ]).then(([menu, popular, welcome]) => {
      if (cancelled) return;
      setSnapshot({
        menu: menu.status === 'fulfilled' ? menu.value : null,
        popular:
          popular.status === 'fulfilled' && Array.isArray(popular.value)
            ? popular.value
            : null,
        musicUrl:
          welcome.status === 'fulfilled'
            ? welcome.value.welcomeMusicUrl || null
            : null,
      });
    });
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [slug, lang, enabled]);

  useEffect(() => {
    setContent(null);
    setError(null);
    if (!slug || !enabled || (group == null && !search.trim())) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    setLoading(true);
    const timeout = window.setTimeout(
      () => {
        const base = `/api/menu/${encodeURIComponent(slug)}`;
        const query = new URLSearchParams({ lang });
        if (search.trim()) query.set('q', search.trim());
        const url = search.trim()
          ? `${base}/search?${query}`
          : `${base}/groups/${group}/products?${query}`;
        void api<Content | SofraProduct[]>(url, { signal: abort.signal })
          .then((data) => {
            if (!cancelled)
              setContent(Array.isArray(data) ? { products: data } : data);
          })
          .catch(() => {
            if (!cancelled)
              setError(
                'Önizleme ürünleri yüklenemedi. Kategoriyi yeniden seçebilirsiniz.',
              );
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      search.trim() ? 200 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [slug, lang, group, search, enabled]);
  return { ...snapshot, content, loading, error };
}
