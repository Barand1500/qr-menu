export const MENU_LUXURY_CONFIG_KEY = 'menu_luxury_config';

export type LuxuryThemeConfig = {
  variantsEnabled: boolean;
  cartEnabled: boolean;
};

export const DEFAULT_LUXURY_CONFIG: LuxuryThemeConfig = {
  variantsEnabled: true,
  cartEnabled: false,
};

export function parseLuxuryThemeConfig(raw?: string | null): LuxuryThemeConfig {
  if (!raw) return { ...DEFAULT_LUXURY_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<LuxuryThemeConfig>;
    return {
      variantsEnabled: data.variantsEnabled !== false,
      cartEnabled: data.cartEnabled === true,
    };
  } catch {
    return { ...DEFAULT_LUXURY_CONFIG };
  }
}

export function serializeLuxuryThemeConfig(config: LuxuryThemeConfig): string {
  return JSON.stringify(parseLuxuryThemeConfig(JSON.stringify(config)));
}
