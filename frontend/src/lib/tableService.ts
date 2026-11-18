export const MENU_TABLE_SERVICE_KEY = 'menu_table_service_enabled';
/** Servis butonlarının sırası ve durumu (JSON): [{ kind, enabled }] */
export const MENU_SERVICE_ITEMS_KEY = 'menu_service_items';

export const SERVICE_KINDS = ['waiter', 'bill', 'hookah', 'valet'] as const;
export type MenuServiceKind = (typeof SERVICE_KINDS)[number];
export type MenuServiceItem = { kind: MenuServiceKind; enabled: boolean };

export const SERVICE_TEXT: Record<MenuServiceKind, { label: string; description: string }> = {
  waiter: { label: 'Garson', description: 'Masanıza garson çağırır.' },
  bill: { label: 'Hesap', description: 'Hesabı masanıza getirir.' },
  hookah: { label: 'Nargileci', description: 'Köz, hazırlık veya küçük bir rica.' },
  valet: { label: 'Vale', description: 'Araç teslimi için plaka alır.' },
};

export function isTableServiceEnabled(raw?: string | null): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  return raw === 'true' || raw === '1';
}

/** Sunucudaki kuralın aynısı: kayıtlı sıra korunur, eksikler sona eklenir, kayıt yoksa eski tek anahtar geçerlidir. */
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
        for (const row of data as { kind?: string; enabled?: unknown }[]) {
          const kind = row?.kind as MenuServiceKind;
          if (SERVICE_KINDS.includes(kind) && !out.some((o) => o.kind === kind)) {
            out.push({ kind, enabled: row.enabled !== false });
          }
        }
      }
    } catch {
      /* bozuk kayıt: varsayılan */
    }
  }
  const hasSaved = out.length > 0;
  for (const kind of SERVICE_KINDS) {
    if (!out.some((o) => o.kind === kind)) out.push({ kind, enabled: hasSaved ? true : legacy });
  }
  return out;
}
