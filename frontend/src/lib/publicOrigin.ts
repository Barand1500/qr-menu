/**
 * QR ve paylaşım linklerinde kullanılacak herkese açık site adresi.
 * Localde telefon QR okutunca localhost çalışmaz — .env içine LAN IP yazın:
 * VITE_PUBLIC_ORIGIN=http://192.168.1.42:5173
 */
export function getPublicOrigin(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function isLocalhostOrigin(origin?: string): boolean {
  const o = (origin || getPublicOrigin()).toLowerCase();
  return (
    o.includes('localhost') ||
    o.includes('127.0.0.1') ||
    o.includes('[::1]')
  );
}
