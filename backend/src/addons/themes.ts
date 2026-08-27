import { prisma } from '../lib/prisma.js';

export const DEFAULT_WELCOME_THEME = 'vibrant';
export const DEFAULT_MENU_THEME = 'sade';

export const FREE_WELCOME_THEMES = new Set(['vibrant']);
export const FREE_MENU_THEMES = new Set(['sade']);

export async function getRestaurantThemes(restaurantId: number) {
  const rows = await prisma.setting.findMany({
    where: {
      restaurantId,
      key: { in: ['theme_welcome', 'theme_menu'] },
    },
  });
  const map = Object.fromEntries(rows.map((s) => [s.key, s.value]));
  return {
    welcome: map.theme_welcome || DEFAULT_WELCOME_THEME,
    menu: map.theme_menu || DEFAULT_MENU_THEME,
  };
}

export function isWelcomeThemeAllowed(id: string) {
  return FREE_WELCOME_THEMES.has(id);
}

export function isMenuThemeAllowed(id: string) {
  return FREE_MENU_THEMES.has(id);
}
