export type SadeThemeConfig = {
  variantsEnabled: boolean;
  cartEnabled: boolean;
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
