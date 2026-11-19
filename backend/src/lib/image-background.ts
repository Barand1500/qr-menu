/** Görsel yüklerken arka plan silme davranışı (işletme geneli). Kayıt yoksa kullanıcıya ilk seçimde sorulur. */
export const IMAGE_BACKGROUND_MODE_KEY = 'image_background_mode';

export const IMAGE_BACKGROUND_MODES = ['ask', 'auto', 'never'] as const;
export type ImageBackgroundMode = (typeof IMAGE_BACKGROUND_MODES)[number];

/** Geçerli bir mod döner; yoksa/bozuksa null (= henüz seçilmemiş). */
export function parseImageBackgroundMode(raw: unknown): ImageBackgroundMode | null {
  return typeof raw === 'string' && (IMAGE_BACKGROUND_MODES as readonly string[]).includes(raw)
    ? (raw as ImageBackgroundMode)
    : null;
}
