export const MENU_SADE_CONFIG_KEY = 'menu_sade_config';

export type SadeThemeConfig = {
  /** Ürün varyant / ekstra seçenekleri görünsün mü */
  variantsEnabled: boolean;
  /** Sepet + sepete ekle açık mı */
  cartEnabled: boolean;
  /** Menü header’da giriş / profil açık mı */
  userProfileEnabled: boolean;
};

export const DEFAULT_SADE_CONFIG: SadeThemeConfig = {
  variantsEnabled: true,
  cartEnabled: false,
  userProfileEnabled: false,
};

export function parseSadeThemeConfig(raw?: string | null): SadeThemeConfig {
  if (!raw) return { ...DEFAULT_SADE_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<SadeThemeConfig>;
    return {
      variantsEnabled: data.variantsEnabled !== false,
      cartEnabled: data.cartEnabled === true,
      userProfileEnabled: data.userProfileEnabled === true,
    };
  } catch {
    return { ...DEFAULT_SADE_CONFIG };
  }
}

export function serializeSadeThemeConfig(config: SadeThemeConfig): string {
  return JSON.stringify(parseSadeThemeConfig(JSON.stringify(config)));
}
