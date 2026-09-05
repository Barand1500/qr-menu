export type AnimasyonThemeConfig = {
  cartEnabled: boolean;
};

export const DEFAULT_ANIMASYON_CONFIG: AnimasyonThemeConfig = {
  cartEnabled: true,
};

export function parseAnimasyonThemeConfig(raw?: string | null): AnimasyonThemeConfig {
  if (!raw) return { ...DEFAULT_ANIMASYON_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<AnimasyonThemeConfig>;
    return {
      cartEnabled: data.cartEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_ANIMASYON_CONFIG };
  }
}
