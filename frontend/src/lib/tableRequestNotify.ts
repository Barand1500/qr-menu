const CHANNEL = 'menu-table-request';

export interface TableRequestNotifyPayload {
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
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
