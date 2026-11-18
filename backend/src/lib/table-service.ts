import { prisma } from './prisma.js';

export const MENU_TABLE_SERVICE_KEY = 'menu_table_service_enabled';
/** Menüdeki servis butonlarının sırası ve açık/kapalı durumu: [{ kind, enabled }] (JSON). */
export const MENU_SERVICE_ITEMS_KEY = 'menu_service_items';

export const SERVICE_KINDS = ['waiter', 'bill', 'hookah', 'valet'] as const;
export type MenuServiceKind = (typeof SERVICE_KINDS)[number];
export type MenuServiceItem = { kind: MenuServiceKind; enabled: boolean };

export function isTableServiceEnabled(raw?: string | null): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true' || raw === '1';
}

function isKind(value: unknown): value is MenuServiceKind {
  return typeof value === 'string' && (SERVICE_KINDS as readonly string[]).includes(value);
}

/**
 * Kayıtlı sırayı okur; eksik servisleri sona ekler. Henüz kayıt yoksa eski tek anahtar
 * (menu_table_service_enabled) tüm servisler için geçerlidir, böylece eskiden kapatılmış olan kapalı kalır.
 */
export function resolveServiceItems(
  masterRaw?: string | null,
  itemsRaw?: string | null,
): MenuServiceItem[] {
  const legacy = isTableServiceEnabled(masterRaw);
  const out: MenuServiceItem[] = [];
  if (itemsRaw) {
    try {
      const data = JSON.parse(itemsRaw) as unknown;
      if (Array.isArray(data)) {
        for (const row of data) {
          const r = row as { kind?: unknown; enabled?: unknown };
          if (isKind(r?.kind) && !out.some((o) => o.kind === r.kind)) {
            out.push({ kind: r.kind, enabled: r.enabled !== false });
          }
        }
      }
    } catch {
      /* bozuk kayıt: varsayılana dön */
    }
  }
  const hasSaved = out.length > 0;
  for (const kind of SERVICE_KINDS) {
    if (!out.some((o) => o.kind === kind)) out.push({ kind, enabled: hasSaved ? true : legacy });
  }
  return out;
}

/** Yönetim panelinden gelen listeyi doğrular: dört servis de bir kez, her biri boolean. */
export function parseServiceItemsInput(input: unknown): MenuServiceItem[] | null {
  if (!Array.isArray(input) || input.length !== SERVICE_KINDS.length) return null;
  const out: MenuServiceItem[] = [];
  for (const row of input) {
    const r = row as { kind?: unknown; enabled?: unknown };
    if (!isKind(r?.kind) || typeof r.enabled !== 'boolean' || out.some((o) => o.kind === r.kind)) {
      return null;
    }
    out.push({ kind: r.kind, enabled: r.enabled });
  }
  return out;
}

export type TableServiceState = {
  /** En az bir servis açıksa menüde servis butonu görünür. */
  enabled: boolean;
  /** Açık servisler, menüde gösterilecek sırayla. */
  kinds: MenuServiceKind[];
};

export async function loadTableServiceState(restaurantId: number): Promise<TableServiceState> {
  const rows = await prisma.setting.findMany({
    where: { restaurantId, key: { in: [MENU_TABLE_SERVICE_KEY, MENU_SERVICE_ITEMS_KEY] } },
  });
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  const kinds = resolveServiceItems(value(MENU_TABLE_SERVICE_KEY), value(MENU_SERVICE_ITEMS_KEY))
    .filter((i) => i.enabled)
    .map((i) => i.kind);
  return { enabled: kinds.length > 0, kinds };
}
