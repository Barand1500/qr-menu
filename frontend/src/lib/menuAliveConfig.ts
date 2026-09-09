export type AliveThemeConfig = {
  variantsEnabled: boolean;
  cartEnabled: boolean;
};

export const DEFAULT_ALIVE_CONFIG: AliveThemeConfig = {
  variantsEnabled: true,
  cartEnabled: false,
};

export function parseAliveThemeConfig(raw?: string | null): AliveThemeConfig {
  if (!raw) return { ...DEFAULT_ALIVE_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<AliveThemeConfig>;
    return {
      variantsEnabled: data.variantsEnabled !== false,
      cartEnabled: data.cartEnabled === true,
    };
  } catch {
    return { ...DEFAULT_ALIVE_CONFIG };
  }
}
