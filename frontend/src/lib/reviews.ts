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

// Aynı sayfada karşılama ve "Daha fazla" aynı veriyi paylaşır; ikinci kez istek atılmaz.
const pending = new Map<string, Promise<PublicReviews | null>>();

export function loadReviews(slug: string, lang: string): Promise<PublicReviews | null> {
  const key = `${slug}|${lang}`;
  let job = pending.get(key);
  if (!job) {
    job = api<{ reviews: PublicReviews | null }>(`/api/menu/${slug}/reviews?lang=${encodeURIComponent(lang)}`)
      .then((r) => r.reviews)
      .catch(() => null);
    pending.set(key, job);
    // Beş dakika sonra yeniden okunabilsin
    window.setTimeout(() => pending.delete(key), 5 * 60 * 1000);
  }
  return job;
}

/** Yorumlar yüklenirken menü beklemez; gelmezse sessizce yok sayılır. */
export function useReviews(slug: string | null | undefined, lang: string): PublicReviews | null {
  const [data, setData] = useState<PublicReviews | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    void loadReviews(slug, lang).then((r) => alive && setData(r));
    return () => {
      alive = false;
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
