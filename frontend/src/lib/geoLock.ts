import { api } from '@/lib/api';

export type GeoLockConfig = {
  enabled: boolean;
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type GeoCoords = { lat: number; lng: number };

export type GeoGateStatus =
  | 'loading'
  | 'allowed'
  | 'blocked'
  | 'need_permission'
  | 'unavailable'
  | 'error';

const CACHE_KEY = 'menu_geo_ok';
const CACHE_TTL_MS = 20 * 60 * 1000;

type GeoCache = { slug: string; lat: number; lng: number; at: number };

export function readGeoCache(slug: string): GeoCoords | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoCache;
    if (parsed.slug !== slug) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export function writeGeoCache(slug: string, coords: GeoCoords) {
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ slug, lat: coords.lat, lng: coords.lng, at: Date.now() })
  );
}

export function clearGeoCache() {
  sessionStorage.removeItem(CACHE_KEY);
}

export function getBrowserPosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEO_UNAVAILABLE'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('GEO_DENIED'));
        else reject(new Error('GEO_ERROR'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000 }
    );
  });
}

export async function fetchGeoLockStatus(slug: string) {
  return api<{
    enabled: boolean;
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  }>(`/api/menu/${slug}/geo-lock`);
}

export async function verifyGeoLock(slug: string, coords: GeoCoords) {
  return api<{
    allowed: boolean;
    enabled: boolean;
    code?: string;
    message?: string;
    distanceMeters?: number;
  }>(`/api/menu/${slug}/geo-check`, {
    method: 'POST',
    body: JSON.stringify(coords),
  });
}
