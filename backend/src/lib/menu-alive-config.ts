export const MENU_ALIVE_CONFIG_KEY = 'menu_alive_config';

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

export function serializeAliveThemeConfig(config: AliveThemeConfig): string {
  return JSON.stringify(parseAliveThemeConfig(JSON.stringify(config)));
}
