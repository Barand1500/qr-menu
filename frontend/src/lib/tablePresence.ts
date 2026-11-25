import { useEffect } from 'react';
import { api } from '@/lib/api';
import { loadDietaryPrefs } from '@/lib/dietAllergens';

/** Müşterinin şu an hangi ekranda olduğu (garson panosuna kaba bilgi). Sepet içeriği, arama metni, konum gitmez. */
export type PresenceKind = 'welcome' | 'menu' | 'category' | 'product' | 'cart' | 'game' | 'code';
type Entry = { kind: PresenceKind; label: string };

const PRIORITY: Record<PresenceKind, number> = { welcome: 0, menu: 0, category: 1, product: 1, game: 2, cart: 3, code: 4 };
const entries = new Map<symbol, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function subscribePresence(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Açık ekranlar arasında en öncelikli olanı (sepet/kod penceresi menüden önemli). */
export function topPresence(base: PresenceKind): Entry {
  let best: Entry = { kind: base, label: '' };
  for (const e of entries.values()) if (PRIORITY[e.kind] >= PRIORITY[best.kind]) best = e;
  return best;
}

/** Bir ekran açıkken (on=true) durumunu bildirir; kapanınca kendiliğinden geri alır. */
export function usePresenceEntry(kind: PresenceKind, label = '', on = true) {
  useEffect(() => {
    if (!on) return;
    const key = Symbol(kind);
    entries.set(key, { kind, label });
    emit();
    return () => {
      entries.delete(key);
      emit();
    };
  }, [kind, label, on]);
}

export function presenceVisitorId(): string {
  try {
    let id = sessionStorage.getItem('menu_presence_id');
    if (!id) {
      id = `v-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      sessionStorage.setItem('menu_presence_id', id);
    }
    return id;
  } catch {
    return `v-${Math.random().toString(36).slice(2, 14)}`;
  }
}

/** Müşterinin menüde işaretlediği alerji/diyet kimlikleri; garson panosunda masa uyarısı olarak görünür (süresi kısa, kalıcı kaydedilmez). */
function dietaryFlags(): string[] {
  try {
    const prefs = loadDietaryPrefs();
    return [...prefs.allergens.map((id) => `a:${id}`), ...prefs.diets.map((id) => `d:${id}`)];
  } catch {
    return [];
  }
}

export function sendPresence(
  slug: string,
  body: { tableNumber: string; groupSlug: string | null; sessionId: number; kind: PresenceKind; label: string; active: boolean },
) {
  return api(`/api/menu/${slug}/table-presence`, {
    method: 'POST',
    body: JSON.stringify({ ...body, visitorId: presenceVisitorId(), prefs: body.active ? dietaryFlags() : [] }),
  }).catch(() => undefined);
}
