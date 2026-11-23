// Google Places API (New): işletme arama ve yorum okuma. Anahtar yalnızca sunucuda (.env) durur.
// Yorumlar veritabanına kopyalanmaz; yalnızca kısa süreli bellek önbelleğinde tutulur.

export type GoogleReview = {
  id: string;
  name: string;
  text: string;
  rating: number;
  photo: string;
  when: string;
};
export type GooglePlace = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  count: number | null;
  mapsUrl: string;
  reviews: GoogleReview[];
};

const BASE = 'https://places.googleapis.com/v1';
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 saat
const FAIL_MS = 5 * 60 * 1000; // hata sonrası 5 dk yeniden denenmez (kota/ücret koruması)
const TIMEOUT_MS = 8000;

export class PlacesError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export const placesKey = () => (process.env.GOOGLE_PLACES_API_KEY || '').trim();

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Google yanıtından (Places API New) kendi biçimimize çevirir. */
export function parsePlace(json: unknown): GooglePlace {
  const p = (json && typeof json === 'object' ? json : {}) as Json;
  const display = (p.displayName && typeof p.displayName === 'object' ? p.displayName : {}) as Json;
  const reviews = Array.isArray(p.reviews)
    ? (p.reviews as Json[])
        .map((r, i): GoogleReview | null => {
          const author = (r.authorAttribution && typeof r.authorAttribution === 'object' ? r.authorAttribution : {}) as Json;
          const body = (r.text && typeof r.text === 'object' ? r.text : r.originalText && typeof r.originalText === 'object' ? r.originalText : {}) as Json;
          const text = str(body.text).trim();
          const rating = num(r.rating);
          if (!text || rating === null) return null;
          const photo = str(author.photoUri);
          return {
            id: str(r.name) || `g${i}`,
            name: str(author.displayName).trim() || 'Google',
            text: text.slice(0, 600),
            rating: Math.min(5, Math.max(1, Math.round(rating))),
            // Yalnızca Google'ın görsel sunucusu kabul edilir
            photo: /^https:\/\/[\w-]+\.googleusercontent\.com\//.test(photo) ? photo : '',
            when: str(r.relativePublishTimeDescription),
          };
        })
        .filter((r): r is GoogleReview => r !== null)
    : [];
  return {
    id: str(p.id),
    name: str(display.text),
    address: str(p.formattedAddress),
    rating: num(p.rating),
    count: num(p.userRatingCount),
    mapsUrl: /^https:\/\/(www\.)?google\.[\w.]+\//.test(str(p.googleMapsUri)) || str(p.googleMapsUri).startsWith('https://maps.google.com/')
      ? str(p.googleMapsUri)
      : '',
    reviews,
  };
}

async function call(path: string, init: RequestInit & { fieldMask: string }): Promise<unknown> {
  const key = placesKey();
  if (!key) throw new PlacesError('Google anahtarı sunucuda tanımlı değil.', 503);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const { fieldMask, ...rest } = init;
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    if (!res.ok) {
      // Anahtarı ve ayrıntıyı müşteriye/ekrana taşımayız
      throw new PlacesError(
        res.status === 403 || res.status === 401
          ? 'Google anahtarı reddedildi (Places API (New) açık ve faturalama etkin olmalı).'
          : 'Google şu an yanıt vermiyor.',
        502,
      );
    }
    return await res.json();
  } catch (e) {
    if (e instanceof PlacesError) throw e;
    throw new PlacesError('Google ile bağlantı kurulamadı.', 502);
  } finally {
    clearTimeout(timer);
  }
}

/** İşletme adı/adresiyle arama (yönetimde işletmeyi seçmek için). */
export async function searchPlaces(query: string): Promise<{ id: string; name: string; address: string; rating: number | null; count: number | null }[]> {
  const json = (await call('/places:searchText', {
    method: 'POST',
    body: JSON.stringify({ textQuery: query, languageCode: 'tr', regionCode: 'TR', pageSize: 6 }),
    fieldMask: 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
  })) as Json;
  const rows = Array.isArray(json.places) ? (json.places as Json[]) : [];
  return rows
    .map((row) => parsePlace(row))
    .filter((p) => p.id && p.name)
    .map((p) => ({ id: p.id, name: p.name, address: p.address, rating: p.rating, count: p.count }));
}

const cache = new Map<string, { at: number; value: GooglePlace | null }>();

/** Yer ayrıntısı + yorumlar (önbellekli). Hata olursa null döner; menü bozulmaz. */
export async function fetchPlace(placeId: string, lang: string, now = Date.now()): Promise<GooglePlace | null> {
  const code = (lang || 'tr').split('-')[0].toLowerCase().slice(0, 5) || 'tr';
  const key = `${placeId}|${code}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < (hit.value ? CACHE_MS : FAIL_MS)) return hit.value;
  try {
    const json = await call(`/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(code)}`, {
      method: 'GET',
      fieldMask: 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews',
    });
    const value = parsePlace(json);
    cache.set(key, { at: now, value });
    return value;
  } catch {
    // Eski veri varsa süresi dolsa da kullan; yoksa kısa süre boş döndür
    cache.set(key, { at: now, value: hit?.value ?? null });
    return hit?.value ?? null;
  }
}

/** Yönetimde "Test et": önbelleği atlayıp hatayı açıkça bildirir. */
export async function testPlace(placeId: string): Promise<GooglePlace> {
  const json = await call(`/places/${encodeURIComponent(placeId)}?languageCode=tr`, {
    method: 'GET',
    fieldMask: 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews',
  });
  return parsePlace(json);
}

export function clearPlacesCache() {
  cache.clear();
}
