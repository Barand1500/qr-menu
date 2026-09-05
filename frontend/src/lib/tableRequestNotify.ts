const CHANNEL = 'menu-table-request';

export interface TableRequestNotifyPayload {
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
  note?: string | null;
  orderJson?: string | null;
  createdAt: string;
}

export function notifyTableRequestCreated(payload: TableRequestNotifyPayload) {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ at: Date.now(), ...payload });
    ch.close();
  } catch {
    /* eski tarayıcı */
  }
}

export function subscribeTableRequestCreated(
  onNotify: (payload?: TableRequestNotifyPayload) => void
) {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (ev) => onNotify(ev.data as TableRequestNotifyPayload);
    return () => ch.close();
  } catch {
    return () => {};
  }
}

export type ParsedOrderSummary = {
  items: { name: string; qty: number; price: number; calories?: number | null }[];
  totalPrice: number;
  totalCalories: number | null;
  note: string | null;
};

export function parseOrderJson(raw?: string | null): ParsedOrderSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParsedOrderSummary;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return {
      items: parsed.items,
      totalPrice: Number(parsed.totalPrice) || 0,
      totalCalories:
        parsed.totalCalories != null && Number(parsed.totalCalories) > 0
          ? Number(parsed.totalCalories)
          : null,
      note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : null,
    };
  } catch {
    return null;
  }
}
