export const MENU_GAMES_KEY = 'menu_games_enabled';

/** Varsayılan: açık (restoran isterse kapatır) */
export function isMenuGamesEnabled(raw?: string | null): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true' || raw === '1';
}
