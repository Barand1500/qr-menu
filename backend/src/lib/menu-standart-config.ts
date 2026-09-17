export const MENU_STANDART_CONFIG_KEY = 'menu_standart_config';

export type StandartThemeConfig = {
  variantsEnabled: boolean;
  cartEnabled: boolean;
  userProfileEnabled: boolean;
};

export const DEFAULT_STANDART_CONFIG: StandartThemeConfig = {
  variantsEnabled: true,
  cartEnabled: true,
  userProfileEnabled: false,
};

export function parseStandartThemeConfig(raw?: string | null): StandartThemeConfig {
  if (!raw) return { ...DEFAULT_STANDART_CONFIG };
  try {
    const data = JSON.parse(raw) as Partial<StandartThemeConfig>;
    return {
      variantsEnabled: data.variantsEnabled !== false,
      cartEnabled: data.cartEnabled !== false,
      userProfileEnabled: data.userProfileEnabled === true,
    };
  } catch {
    return { ...DEFAULT_STANDART_CONFIG };
  }
}

export function serializeStandartThemeConfig(config: StandartThemeConfig): string {
  return JSON.stringify(parseStandartThemeConfig(JSON.stringify(config)));
}
