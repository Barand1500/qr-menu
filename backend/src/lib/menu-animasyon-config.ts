export const MENU_ANIMASYON_CONFIG_KEY = 'menu_animasyon_config';

export type AnimasyonThemeConfig = {
  /** Sepet + hızlı ekle açık mı */
  cartEnabled: boolean;
  /** Ürün varyant / ekstra seçenekleri görünsün mü */
  variantsEnabled: boolean;
  /** Menü header’da giriş / profil açık mı */
  userProfileEnabled: boolean;
};

export const DEFAULT_ANIMASYON_CONFIG: AnimasyonThemeConfig = {
  cartEnabled: true,
  variantsEnabled: true,
  userProfileEnabled: false,
};

export function parseAnimasyonThemeConfig(raw?: string | null): AnimasyonThemeConfig {
  if (!raw) return { ...DEFAULT_ANIMASYON_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<AnimasyonThemeConfig>;
    return {
      cartEnabled: data.cartEnabled !== false,
      variantsEnabled: data.variantsEnabled !== false,
      userProfileEnabled: data.userProfileEnabled === true,
    };
  } catch {
    return { ...DEFAULT_ANIMASYON_CONFIG };
  }
}

export function serializeAnimasyonThemeConfig(config: AnimasyonThemeConfig): string {
  return JSON.stringify(parseAnimasyonThemeConfig(JSON.stringify(config)));
}
