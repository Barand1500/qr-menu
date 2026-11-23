import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type ReviewItem = {
  id: string;
  name: string;
  text: string;
  rating: number;
  source: 'google' | 'manual';
  photo: string;
  when: string;
};

export type PublicReviews = {
  rating: number | null;
  count: number | null;
  mapsUrl: string;
  writeUrl: string;
  items: ReviewItem[];
};

export const REVIEWS_CHANGED = 'menu-reviews-updated';
export function notifyReviewsChanged() {
  pending.clear();
  window.dispatchEvent(new Event(REVIEWS_CHANGED));
  try { localStorage.setItem(REVIEWS_CHANGED, String(Date.now()) + Math.random()); } catch { /* storage may be disabled */ }
}

// Aynı sayfada karşılama ve "Daha fazla" aynı veriyi paylaşır; ikinci kez istek atılmaz.
const pending = new Map<string, Promise<PublicReviews | null>>();

export function loadReviews(slug: string, lang: string, fresh = false): Promise<PublicReviews | null> {
  const key = `${slug}|${lang}`;
  let job = fresh ? undefined : pending.get(key);
  if (!job) {
    job = api<{ reviews: PublicReviews | null }>(`/api/menu/${slug}/reviews?lang=${encodeURIComponent(lang)}`, { cache: 'no-store' })
      .then((r) => r.reviews)
      .catch(() => null)
      .finally(() => { if (pending.get(key) === job) pending.delete(key); });
    pending.set(key, job);

  }
  return job;
}

/** Yorumlar yüklenirken menü beklemez; gelmezse sessizce yok sayılır. */
export function useReviews(slug: string | null | undefined, lang: string): PublicReviews | null {
  const [data, setData] = useState<PublicReviews | null>(null);
  useEffect(() => {
    setData(null);
    if (!slug) return;
    let alive = true, request = 0;
    const refresh = (fresh = false) => {
      const id = ++request;
      void loadReviews(slug, lang, fresh).then((r) => { if (alive && id === request) setData(r); });
    };
    const changed = () => refresh(true);
    const visible = () => { if (!document.hidden) refresh(true); };
    const storage = (e: StorageEvent) => { if (e.key === REVIEWS_CHANGED) changed(); };
    refresh();
    window.addEventListener(REVIEWS_CHANGED, changed);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(REVIEWS_CHANGED, changed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [slug, lang]);
  return data;
}

export function reviewsCopy(lang: string) {
  const en = !lang.startsWith('tr');
  return en
    ? {
        title: 'Reviews',
        google: 'Google reviews',
        fromGuests: 'From our guests',
        write: 'Write a review on Google',
        map: 'See on map',
        outOf: 'out of 5',
        empty: 'No reviews yet.',
      }
    : {
        title: 'Yorumlar',
        google: 'Google yorumu',
        fromGuests: 'Misafirlerimizden',
        write: 'Google’da yorum yaz',
        map: 'Haritada gör',
        outOf: '/ 5',
        empty: 'Henüz yorum yok.',
      };
}

/** 4.66 → "4,7" (Türkçe) / "4.7" */
export function formatRating(value: number, lang: string): string {
  return value.toLocaleString(lang.startsWith('tr') ? 'tr-TR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
