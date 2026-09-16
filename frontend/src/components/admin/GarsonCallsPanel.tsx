import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  HandHelping,
  History,
  Receipt,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { api, formatMoney } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatTableServiceLabel } from '@/lib/tableContext';
import { parseOrderJson } from '@/lib/tableRequestNotify';

export type GarsonCallRow = {
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
  note?: string | null;
  orderJson?: string | null;
  isRead: boolean;
  createdAt: string;
};

type AssignedTable = {
  key: string;
  code: string;
  name: string;
  groupSlug: string;
  groupName: string;
};

type FloorLitePayload = {
  groups: {
    id: string;
    name: string;
    tables: {
      code: string;
      name: string;
      occupied: boolean;
      meta?: { waiterUserId?: number | null; waiterName?: string | null };
    }[];
  }[];
};

const HISTORY_PAGE_SIZE = 8;

function tableKey(code: string, groupSlug?: string | null) {
  return `${String(groupSlug || '').trim()}::${String(code || '').trim()}`;
}

function isAssignedToUser(
  meta: { waiterUserId?: number | null; waiterName?: string | null } | undefined,
  user: { id: number; fullName: string } | null | undefined
) {
  if (!meta || !user) return false;
  const wid = meta.waiterUserId;
  if (wid != null && wid !== ('' as unknown) && Number.isFinite(Number(wid))) {
    return Number(wid) === Number(user.id);
  }
  const name = String(meta.waiterName || '').trim();
  return Boolean(name && name === user.fullName.trim());
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function typeLabel(type: string, hasOrder: boolean) {
  if (type === 'bill') return 'Hesap';
  if (hasOrder) return 'Sipariş + garson';
  return 'Garson';
}

export default function GarsonCallsPanel({
  focusCallId,
  onOpenTable,
  onCallsSnapshot,
}: {
  focusCallId?: number | null;
  onOpenTable?: (masa: string, grup: string | null) => void;
  /** Yeni veri yüklendiğinde (bildirim / titreşim için) */
  onCallsSnapshot?: (rows: GarsonCallRow[], unreadCount: number) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<GarsonCallRow[]>([]);
  const [assigned, setAssigned] = useState<AssignedTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'mine'>('mine');
  const [historyPage, setHistoryPage] = useState(1);
  const snapshotRef = useRef(onCallsSnapshot);
  snapshotRef.current = onCallsSnapshot;
  const assignedKeysRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [list, floor] = await Promise.all([
        api<{ data: GarsonCallRow[]; unreadCount: number }>(
          '/api/admin/table-requests?limit=100'
        ),
        api<FloorLitePayload>('/api/admin/table-floor').catch(() => null),
      ]);

      const rows = list.data || [];
      const nextAssigned: AssignedTable[] = [];
      if (floor && user) {
        for (const g of floor.groups || []) {
          for (const t of g.tables || []) {
            if (isAssignedToUser(t.meta, user)) {
              nextAssigned.push({
                key: tableKey(t.code, g.id),
                code: t.code,
                name: t.name,
                groupSlug: g.id,
                groupName: g.name,
              });
            }
          }
        }
      }
      nextAssigned.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      assignedKeysRef.current = new Set(nextAssigned.map((t) => t.key));

      const mineUnread = rows.filter(
        (r) => !r.isRead && assignedKeysRef.current.has(tableKey(r.tableNumber, r.groupSlug))
      ).length;
      const notifyUnread =
        nextAssigned.length > 0
          ? mineUnread
          : list.unreadCount || 0;
      const notifyRows =
        nextAssigned.length > 0
          ? rows.filter((r) =>
              assignedKeysRef.current.has(tableKey(r.tableNumber, r.groupSlug))
            )
          : rows;

      setItems(rows);
      setAssigned(nextAssigned);
      snapshotRef.current?.(notifyRows, notifyUnread);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  async function markRead(id: number) {
    try {
      await api(`/api/admin/table-requests/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    } catch {
      /* ignore */
    }
  }

  async function clearAll() {
    if (!items.length) return;
    if (!window.confirm('Tüm garson çağrılarını silmek istiyor musunuz?')) return;
    try {
      await api('/api/admin/table-requests', { method: 'DELETE' });
      setItems([]);
      setHistoryPage(1);
    } catch {
      /* ignore */
    }
  }

  const assignedKeySet = useMemo(
    () => new Set(assigned.map((t) => t.key)),
    [assigned]
  );

  const isMineCall = useCallback(
    (row: GarsonCallRow) => assignedKeySet.has(tableKey(row.tableNumber, row.groupSlug)),
    [assignedKeySet]
  );

  const mineItems = useMemo(() => items.filter(isMineCall), [items, isMineCall]);
  const mineLive = useMemo(() => mineItems.filter((i) => !i.isRead), [mineItems]);
  const mineHistory = useMemo(() => mineItems.filter((i) => i.isRead), [mineItems]);
  const mineUnread = mineLive.length;

  const historyPages = Math.max(1, Math.ceil(mineHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPages);
  const historySlice = mineHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > historyPages) setHistoryPage(historyPages);
  }, [historyPage, historyPages]);

  function renderCallItem(item: GarsonCallRow, allowRead: boolean) {
    const order = parseOrderJson(item.orderJson);
    const note = (item.note || order?.note || '').trim();
    const Icon = item.type === 'bill' ? Receipt : HandHelping;
    const focused = focusCallId === item.id;
    const showUnread = allowRead && !item.isRead;
    return (
      <li
        key={item.id}
        className={`garson-panel__item${showUnread ? ' is-new' : ''}${focused ? ' is-focus' : ''}`}
      >
        <button
          type="button"
          className="garson-panel__item-main"
          onClick={() => {
            if (allowRead && !item.isRead) void markRead(item.id);
            onOpenTable?.(item.tableNumber, item.groupSlug || null);
          }}
        >
          <span className={`garson-panel__item-icon${item.type === 'bill' ? ' is-bill' : ''}`}>
            <Icon className="w-4 h-4" />
          </span>
          <span className="garson-panel__item-copy">
            <span className="garson-panel__item-title-row">
              <strong>{formatTableServiceLabel(item.tableNumber, item.groupSlug)}</strong>
              <span className={`garson-panel__pill${item.type === 'bill' ? ' is-bill' : ''}`}>
                {typeLabel(item.type, Boolean(order))}
              </span>
            </span>
            <small>{formatTime(item.createdAt)}</small>

            {note ? (
              <span className="garson-panel__note">
                <StickyNote className="w-3.5 h-3.5" />
                <span>{note}</span>
              </span>
            ) : null}

            {order?.items?.length ? (
              <span className="garson-panel__order">
                <ul>
                  {order.items.map((line, idx) => (
                    <li key={`${item.id}-${idx}-${line.name}`}>
                      <em>{line.qty}×</em>
                      <span>{line.name}</span>
                      <b>{formatMoney(line.price * line.qty)}</b>
                    </li>
                  ))}
                </ul>
                <span className="garson-panel__order-foot">
                  <span>{order.items.length} kalem</span>
                  <strong>{formatMoney(order.totalPrice)}</strong>
                </span>
              </span>
            ) : null}
          </span>
        </button>
        {showUnread ? (
          <button
            type="button"
            className="garson-panel__item-read"
            title="Okundu"
            onClick={() => void markRead(item.id)}
          >
            <CheckCheck className="w-4 h-4" />
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <div className="garson-panel">
      <div className="garson-panel__shell">
        <div className="garson-panel__head">
          <div className="garson-panel__head-main">
            <p className="garson-panel__eyebrow">Garson merkezi</p>
            <h2>
              {user?.fullName || 'Çağrılar'}
              {tab === 'mine' && mineUnread > 0 ? <em>{mineUnread}</em> : null}
            </h2>
            <p className="garson-panel__lead">
              {user?.restaurant?.name
                ? `${user.restaurant.name} · size atanan masaları buradan takip edin.`
                : 'Size atanan masaları buradan takip edin.'}
            </p>
          </div>

          <div className="garson-panel__head-side">
            {assigned.length > 0 ? (
              <div className="garson-panel__assigned">
                <span className="garson-panel__assigned-label">Size atanan masalar (garson ata)</span>
                <div className="garson-panel__assigned-chips">
                  {assigned.map((t) =>
                    onOpenTable ? (
                      <button
                        key={t.key}
                        type="button"
                        className="garson-panel__assigned-chip"
                        title={`${t.groupName} · ${t.name}`}
                        onClick={() => onOpenTable(t.code, t.groupSlug || null)}
                      >
                        {t.name}
                      </button>
                    ) : (
                      <span
                        key={t.key}
                        className="garson-panel__assigned-chip"
                        title={`${t.groupName} · ${t.name}`}
                      >
                        {t.name}
                      </span>
                    )
                  )}
                </div>
              </div>
            ) : (
              <p className="garson-panel__assigned-empty">Atanan masa yok</p>
            )}
            <button
              type="button"
              className="garson-panel__clear"
              onClick={() => void clearAll()}
              disabled={!items.length}
            >
              <Trash2 className="w-4 h-4" />
              Temizle
            </button>
          </div>
        </div>

        <div className="garson-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? 'is-active' : ''}
            onClick={() => setTab('all')}
          >
            Tümü
            {items.length > 0 ? <i>{items.length}</i> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={tab === 'mine' ? 'is-active' : ''}
            onClick={() => {
              setTab('mine');
              setHistoryPage(1);
            }}
          >
            Sizin masalarınız
            {mineUnread > 0 ? <i>{mineUnread}</i> : null}
          </button>
        </div>

        {loading ? (
          <div className="garson-panel__empty-card">
            <p>Yükleniyor…</p>
          </div>
        ) : tab === 'all' ? (
          items.length === 0 ? (
            <div className="garson-panel__empty-card">
              <BellOff className="garson-panel__empty-icon" strokeWidth={1.75} />
              <strong>Çağrı yok</strong>
              <p>Restorandaki tüm çağrılar burada listelenir. Okundu durumu yalnızca sizin masalarınızda işler.</p>
            </div>
          ) : (
            <ul className="garson-panel__list">{items.map((item) => renderCallItem(item, false))}</ul>
          )
        ) : assigned.length === 0 ? (
          <div className="garson-panel__empty-card">
            <HandHelping className="garson-panel__empty-icon" strokeWidth={1.75} />
            <strong>Size atanmış masa yok</strong>
            <p>
              Masa görünümünde masayı açıp <b>Garson</b> ile kendinizi atayın; atanan masaların
              çağrıları ve okundu takibi burada görünür.
            </p>
          </div>
        ) : (
          <div className="garson-panel__mine">
            <section className="garson-panel__section">
              <header className="garson-panel__section-head">
                <h3>Aktif çağrılar</h3>
                <p>Sadece size atanan masalar · okundu işaretleyebilirsiniz</p>
              </header>
              {mineLive.length === 0 ? (
                <div className="garson-panel__empty-card is-compact">
                  <BellOff className="garson-panel__empty-icon" strokeWidth={1.75} />
                  <strong>Bekleyen çağrı yok</strong>
                  <p>Atanan masalarınızdan yeni çağrı gelince burada görünür.</p>
                </div>
              ) : (
                <ul className="garson-panel__list">
                  {mineLive.map((item) => renderCallItem(item, true))}
                </ul>
              )}
            </section>

            <section className="garson-panel__section">
              <header className="garson-panel__section-head">
                <h3>
                  <History className="w-4 h-4" />
                  Geçmiş
                </h3>
                <p>Okunan çağrılar · sizin masalarınız</p>
              </header>
              {mineHistory.length === 0 ? (
                <div className="garson-panel__empty-card is-compact">
                  <History className="garson-panel__empty-icon" strokeWidth={1.75} />
                  <strong>Geçmiş boş</strong>
                  <p>Okuduğunuz çağrılar burada birikir.</p>
                </div>
              ) : (
                <>
                  <ul className="garson-panel__list">
                    {historySlice.map((item) => renderCallItem(item, true))}
                  </ul>
                  {mineHistory.length > HISTORY_PAGE_SIZE ? (
                    <div className="garson-panel__pager">
                      <button
                        type="button"
                        disabled={safeHistoryPage <= 1}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Önceki
                      </button>
                      <span>
                        {safeHistoryPage} / {historyPages}
                        <small>
                          · {(safeHistoryPage - 1) * HISTORY_PAGE_SIZE + 1}–
                          {Math.min(safeHistoryPage * HISTORY_PAGE_SIZE, mineHistory.length)} /{' '}
                          {mineHistory.length}
                        </small>
                      </span>
                      <button
                        type="button"
                        disabled={safeHistoryPage >= historyPages}
                        onClick={() => setHistoryPage((p) => Math.min(historyPages, p + 1))}
                      >
                        Sonraki
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
