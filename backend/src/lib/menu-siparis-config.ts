export const MENU_SIPARIS_CONFIG_KEY = 'menu_siparis_config';

export type SiparisThemeConfig = {
  variantsEnabled: boolean;
  cartEnabled: boolean;
  userProfileEnabled: boolean;
};

export const DEFAULT_SIPARIS_CONFIG: SiparisThemeConfig = {
  variantsEnabled: true,
  cartEnabled: true,
  userProfileEnabled: false,
};

export function parseSiparisThemeConfig(raw?: string | null): SiparisThemeConfig {
  if (!raw) return { ...DEFAULT_SIPARIS_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<SiparisThemeConfig>;
    return {
      variantsEnabled: data.variantsEnabled !== false,
      cartEnabled: data.cartEnabled !== false,
      userProfileEnabled: data.userProfileEnabled === true,
    };
  } catch {
    return { ...DEFAULT_SIPARIS_CONFIG };
  }
}

export function serializeSiparisThemeConfig(config: SiparisThemeConfig): string {
  return JSON.stringify(parseSiparisThemeConfig(JSON.stringify(config)));
}
