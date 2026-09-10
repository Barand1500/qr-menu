import type { PublicMenuGames } from '@/lib/menuGamesConfig';
import { isPublicGamesOn } from '@/lib/menuGamesConfig';

const GUEST_KEY = 'menu_game_guest_id';

export function getMenuGameGuestId(): string {
  try {
    const existing = sessionStorage.getItem(GUEST_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 24)
        : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    return `g${Date.now().toString(36)}`;
  }
}

export const MENU_WAITER_CALLED_EVENT = 'menu-waiter-called';

export function notifyWaiterCalled() {
  try {
    window.dispatchEvent(new CustomEvent(MENU_WAITER_CALLED_EVENT));
  } catch {
    /* ignore */
  }
}

export type MenuGameId = 'memory' | 'xox';

export const MENU_GAMES_CATALOG: {
  id: MenuGameId;
  titleTr: string;
  titleEn: string;
  blurbTr: string;
  blurbEn: string;
  badgeTr: string;
  badgeEn: string;
}[] = [
  {
    id: 'memory',
    titleTr: 'Hafıza',
    titleEn: 'Memory',
    blurbTr: 'Kartları eşleştir — hızlı solo oyun',
    blurbEn: 'Match the cards — quick solo play',
    badgeTr: 'Solo',
    badgeEn: 'Solo',
  },
  {
    id: 'xox',
    titleTr: 'XOX',
    titleEn: 'Tic-Tac-Toe',
    blurbTr: 'Aynı masadaki arkadaşınla oyna',
    blurbEn: 'Play with someone at your table',
    badgeTr: 'Masa',
    badgeEn: 'Table',
  },
];

export function enabledMenuGames(g?: PublicMenuGames | boolean | null): MenuGameId[] {
  if (!isPublicGamesOn(g)) return [];
  if (typeof g === 'boolean' || g == null) return ['memory', 'xox'];
  const ids: MenuGameId[] = [];
  if (g.memory?.enabled !== false) ids.push('memory');
  if (g.xox?.enabled !== false) ids.push('xox');
  return ids;
}
