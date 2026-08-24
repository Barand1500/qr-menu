import { api } from '@/lib/api';

export const MENU_BASE = '/menu';

export function menuWelcomePath() {
  return MENU_BASE;
}

export function menuHomePath() {
  return `${MENU_BASE}/home`;
}

export function menuGroupPath(groupId: number | string) {
  return `${MENU_BASE}/group/${groupId}`;
}

export function menuProductPath(productId: number | string) {
  return `${MENU_BASE}/product/${productId}`;
}

let cachedSlug: string | null = null;

export async function resolveMenuSlug(): Promise<string> {
  if (cachedSlug) return cachedSlug;
  const restaurant = await api<{ slug: string }>('/api/menu/resolve');
  cachedSlug = restaurant.slug;
  return cachedSlug;
}

export function enteredKey(slug: string) {
  return `menu_entered_${slug}`;
}
