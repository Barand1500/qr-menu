// Garson telefonunun servis türüne göre titreşimi. Yönetici Ayarlar → Menü deneyimi'nden seçer.
// Sunucu yalnızca kimlikleri saklar; desenler burada.
export type VibrationId = 'off' | 'short' | 'double' | 'triple' | 'long';
export type VibrationService = 'waiter' | 'bill' | 'hookah' | 'valet' | 'order';
export type VibrationMap = Record<VibrationService, VibrationId>;

export const VIBRATION_IDS: VibrationId[] = ['off', 'short', 'double', 'triple', 'long'];
export const VIBRATION_PATTERNS: Record<VibrationId, number[]> = {
  off: [],
  short: [220],
  double: [180, 80, 180],
  triple: [90, 60, 90, 60, 90],
  long: [600],
};
export const VIBRATION_LABEL: Record<VibrationId, string> = {
  off: 'Kapalı',
  short: 'Kısa',
  double: 'Çift',
  triple: 'Üçlü',
  long: 'Uzun',
};
export const VIBRATION_SERVICES: { id: VibrationService; label: string }[] = [
  { id: 'waiter', label: 'Garson çağrısı' },
  { id: 'bill', label: 'Hesap isteği' },
  { id: 'hookah', label: 'Nargileci çağrısı' },
  { id: 'valet', label: 'Vale çağrısı' },
  { id: 'order', label: 'Sipariş' },
];
export const DEFAULT_VIBRATION: VibrationMap = { waiter: 'double', bill: 'short', hookah: 'triple', valet: 'long', order: 'double' };

export function parseVibration(raw: unknown): VibrationMap {
  let src: unknown = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch {
      src = null;
    }
  }
  const out = { ...DEFAULT_VIBRATION };
  if (src && typeof src === 'object') {
    for (const key of Object.keys(out) as VibrationService[]) {
      const v = (src as Record<string, unknown>)[key];
      if (typeof v === 'string' && (VIBRATION_IDS as string[]).includes(v)) out[key] = v as VibrationId;
    }
  }
  return out;
}

export function vibrate(id: VibrationId) {
  try {
    navigator.vibrate?.(VIBRATION_PATTERNS[id]);
  } catch {
    /* titreşim desteklenmiyor */
  }
}
