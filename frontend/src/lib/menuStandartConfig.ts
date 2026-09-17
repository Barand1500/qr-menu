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

export function parseStandartThemeConfig(data: unknown): StandartThemeConfig {
  if (!data || typeof data !== 'object') return { ...DEFAULT_STANDART_CONFIG };
  const d = data as Partial<StandartThemeConfig>;
  return {
    variantsEnabled: d.variantsEnabled !== false,
    cartEnabled: d.cartEnabled !== false,
    userProfileEnabled: d.userProfileEnabled === true,
  };
}
