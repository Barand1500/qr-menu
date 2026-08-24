import { useEffect, useState } from 'react';
import { resolveMenuSlug } from '@/lib/menuPaths';

export function useMenuSlug() {
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveMenuSlug()
      .then((value) => {
        if (!cancelled) setSlug(value);
      })
      .catch(() => {
        if (!cancelled) setError('Menü bulunamadı');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { slug, error };
}
