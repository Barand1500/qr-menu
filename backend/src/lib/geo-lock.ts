import { prisma } from './prisma.js';

export const GEO_LOCK_KEY = 'geo_lock';

export type GeoLockConfig = {
  enabled: boolean;
  lat: number;
  lng: number;
  /** metre */
  radiusMeters: number;
};

export const DEFAULT_GEO_LOCK: GeoLockConfig = {
  enabled: false,
  lat: 36.8121,
  lng: 34.6415,
  radiusMeters: 120,
};

export function parseGeoLock(raw: string | null | undefined): GeoLockConfig {
  if (!raw?.trim()) return { ...DEFAULT_GEO_LOCK };
  try {
    const parsed = JSON.parse(raw) as Partial<GeoLockConfig>;
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    const radiusMeters = Number(parsed.radiusMeters);
    return {
      enabled: Boolean(parsed.enabled),
      lat: Number.isFinite(lat) ? clamp(lat, -90, 90) : DEFAULT_GEO_LOCK.lat,
      lng: Number.isFinite(lng) ? clamp(lng, -180, 180) : DEFAULT_GEO_LOCK.lng,
      radiusMeters: Number.isFinite(radiusMeters)
        ? clamp(Math.round(radiusMeters), 30, 5000)
        : DEFAULT_GEO_LOCK.radiusMeters,
    };
  } catch {
    return { ...DEFAULT_GEO_LOCK };
  }
}

export function serializeGeoLock(cfg: GeoLockConfig): string {
  return JSON.stringify({
    enabled: Boolean(cfg.enabled),
    lat: clamp(Number(cfg.lat), -90, 90),
    lng: clamp(Number(cfg.lng), -180, 180),
    radiusMeters: clamp(Math.round(Number(cfg.radiusMeters) || 120), 30, 5000),
  });
}

export async function loadGeoLock(restaurantId: number): Promise<GeoLockConfig> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: GEO_LOCK_KEY } },
  });
  return parseGeoLock(row?.value);
}

/** Haversine mesafe (metre) */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinGeoLock(cfg: GeoLockConfig, lat: number, lng: number): boolean {
  if (!cfg.enabled) return true;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return distanceMeters(cfg.lat, cfg.lng, lat, lng) <= cfg.radiusMeters;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
