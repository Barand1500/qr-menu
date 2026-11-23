import { fetchPlace, placesKey } from './google-places.js';
import {
  googleWriteReviewUrl,
  type PublicReviewItem,
  type PublicReviews,
  type ReviewsConfig,
} from './reviews-config.js';

/** Müşteriye gidecek yorum paketi: Google (varsa) + elle girilenler; hiçbiri yoksa null. */
export async function buildPublicReviews(config: ReviewsConfig, lang: string): Promise<PublicReviews | null> {
  const google: PublicReviewItem[] = [];
  let rating: number | null = null;
  let count: number | null = null;
  let mapsUrl = '';
  let writeUrl = '';

  if (config.googleEnabled && config.placeId && placesKey()) {
    const place = await fetchPlace(config.placeId, lang);
    if (place) {
      rating = place.rating;
      count = place.count;
      mapsUrl = place.mapsUrl;
      writeUrl = googleWriteReviewUrl(config.placeId);
      for (const r of place.reviews) {
        google.push({ id: r.id, name: r.name, text: r.text, rating: r.rating, source: 'google', photo: r.photo, when: r.when });
      }
    }
  }

  const manual: PublicReviewItem[] = config.manualEnabled
    ? config.manual.map((r, i) => ({ id: `m${i}`, name: r.name, text: r.text, rating: r.rating, source: 'manual', photo: '', when: '' }))
    : [];

  // Google ve elle girilenler sırayla karışık dizilir; biri bitince diğeri devam eder
  const items: PublicReviewItem[] = [];
  for (let i = 0; i < Math.max(google.length, manual.length); i++) {
    if (google[i]) items.push(google[i]);
    if (manual[i]) items.push(manual[i]);
  }
  if (!items.length && rating === null) return null;
  return { rating, count, mapsUrl, writeUrl, items };
}
