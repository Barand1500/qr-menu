// Yorumlar entegrasyonu: Google yorumları (işletme seçilerek) + elle girilen müşteri yorumları.
// Saf modül: yönetim paneli ve sunucu aynı doğrulamayı kullanır.

export const REVIEWS_KEY = 'reviews_config';
export const MAX_MANUAL_REVIEWS = 12;

export type ManualReview = { name: string; text: string; rating: number };

export type ReviewsConfig = {
  /** Google yorumları (işletme seçilmiş ve sunucuda anahtar tanımlıysa) gösterilsin mi */
  googleEnabled: boolean;
  placeId: string;
  placeName: string;
  placeAddress: string;
  /** Elle girilen "müşterilerimizden" yorumlar gösterilsin mi */
  manualEnabled: boolean;
  manual: ManualReview[];
};

export const REVIEWS_DEFAULTS: ReviewsConfig = {
  googleEnabled: false,
  placeId: '',
  placeName: '',
  placeAddress: '',
  manualEnabled: false,
  manual: [],
};

const text = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max)
    : '';

/** Google yer kimliği: harf, rakam, "_" ve "-" (ör. ChIJ…). */
const placeIdOf = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(value.trim()) ? value.trim() : '';

const ratingOf = (value: unknown) => {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 5;
};

export function normalizeReviews(input: unknown): ReviewsConfig {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const manual = Array.isArray(s.manual)
    ? s.manual
        .map((row) => {
          const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
          return { name: text(r.name, 40), text: text(r.text, 300), rating: ratingOf(r.rating) };
        })
        // İsimsiz ya da metinsiz satır anlamsız: atılır
        .filter((r) => r.name && r.text)
        .slice(0, MAX_MANUAL_REVIEWS)
    : [];
  const placeId = placeIdOf(s.placeId);
  return {
    // Yer seçilmemişse Google açık olamaz
    googleEnabled: s.googleEnabled === true && Boolean(placeId),
    placeId,
    placeName: placeId ? text(s.placeName, 120) : '',
    placeAddress: placeId ? text(s.placeAddress, 200) : '',
    manualEnabled: s.manualEnabled === true,
    manual,
  };
}

export function parseReviews(raw?: string | null): ReviewsConfig {
  if (!raw) return { ...REVIEWS_DEFAULTS };
  try {
    return normalizeReviews(JSON.parse(raw));
  } catch {
    return { ...REVIEWS_DEFAULTS };
  }
}

export function serializeReviews(config: ReviewsConfig): string {
  return JSON.stringify(normalizeReviews(config));
}

export type PublicReviewItem = {
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
  items: PublicReviewItem[];
};

/** Google'ın doğrudan "yorum yaz" sayfası. */
export function googleWriteReviewUrl(placeId: string): string {
  return placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : '';
}
