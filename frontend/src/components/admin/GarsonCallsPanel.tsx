import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
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
import GarsonTableOrderDock, {
  type GarsonAssignedTable,
  type GarsonOrderLine,
} from '@/components/admin/GarsonTableOrderDock';

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

type FloorLitePayload = {
  groups: {
    id: string;
    name: string;
    tables: {
      code: string;
      name: string;
      occupied: boolean;
      sessionId?: number | null;
      openedAt?: string | null;
      orders?: GarsonOrderLine[];
      total?: number;
      remaining?: number;
      meta?: { waiterUserId?: number | null; waiterName?: string | null };
    }[];
  }[];
};

const HISTORY_PAGE_SIZE = 8;
const FRESH_MS = 14_000;

function tableKey(code: string, groupSlug?: string | null) {
  return `${String(groupSlug || '').trim()}::${String(code || '').trim()}`;
}

function seenStorageKey(userId: number) {
  return `garson-assigned-seen-v1-${userId}`;
}

function readSeenKeys(userId: number): Set<string> {
  try {
    const raw = sessionStorage.getItem(seenStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSeenKeys(userId: number, keys: Set<string>) {
  try {
    sessionStorage.setItem(seenStorageKey(userId), JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
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

function formatDuration(openedAt: string | null, now: number) {
  if (!openedAt) return '—';
  const ms = Math.max(0, now - new Date(openedAt).getTime());
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
  onCallsSnapshot?: (rows: GarsonCallRow[], unreadCount: number) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<GarsonCallRow[]>([]);
  const [assigned, setAssigned] = useState<GarsonAssignedTable[]>([]);
  const [freshKeys, setFreshKeys] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'mine' | 'history'>('mine');
  const [historyPage, setHistoryPage] = useState(1);
  const [activeTableKey, setActiveTableKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const snapshotRef = useRef(onCallsSnapshot);
  snapshotRef.current = onCallsSnapshot;
  const assignedKeysRef = useRef<Set<string>>(new Set());
  const seededSeenRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [list, floor] = await Promise.all([
        api<{ data: GarsonCallRow[]; unreadCount: number }>(
          '/api/admin/table-requests?limit=100'
        ),
        api<FloorLitePayload>('/api/admin/table-floor').catch(() => null),
      ]);

      const rows = list.data || [];
      const nextAssigned: GarsonAssignedTable[] = [];
      if (floor && user) {
        for (const g of floor.groups || []) {
          for (const t of g.tables || []) {
            if (!isAssignedToUser(t.meta, user)) continue;
            nextAssigned.push({
              key: tableKey(t.code, g.id),
              code: t.code,
              name: t.name,
              groupSlug: g.id,
              groupName: g.name,
              sessionId: t.sessionId ?? null,
              occupied: Boolean(t.occupied),
              openedAt: t.openedAt ?? null,
              orders: t.orders || [],
              total: t.total || 0,
              remaining: t.remaining || 0,
            });
          }
        }
      }
      nextAssigned.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const nextKeys = new Set(nextAssigned.map((t) => t.key));
      assignedKeysRef.current = nextKeys;

      if (user?.id) {
        const seen = readSeenKeys(user.id);
        if (!seededSeenRef.current && seen.size === 0) {
          writeSeenKeys(user.id, nextKeys);
          seededSeenRef.current = true;
          setFreshKeys(new Set());
        } else {
          seededSeenRef.current = true;
          const fresh = new Set<string>();
          for (const k of nextKeys) {
            if (!seen.has(k)) fresh.add(k);
          }
          setFreshKeys(fresh);
        }
      }

      const mineUnread = rows.filter(
        (r) => !r.isRead && assignedKeysRef.current.has(tableKey(r.tableNumber, r.groupSlug))
      ).length;
      const notifyUnread = nextAssigned.length > 0 ? mineUnread : list.unreadCount || 0;
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

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!freshKeys.size) return;
    const t = window.setTimeout(() => {
      if (!user?.id) return;
      const seen = readSeenKeys(user.id);
      for (const k of freshKeys) seen.add(k);
      writeSeenKeys(user.id, seen);
      setFreshKeys(new Set());
    }, FRESH_MS);
    return () => window.clearTimeout(t);
  }, [freshKeys, user?.id]);

  function markTableSeen(key: string) {
    setFreshKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (user?.id) {
      const seen = readSeenKeys(user.id);
      seen.add(key);
      writeSeenKeys(user.id, seen);
    }
  }

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

  const assignedKeySet = useMemo(() => new Set(assigned.map((t) => t.key)), [assigned]);
  const isMineCall = useCallback(
    (row: GarsonCallRow) => assignedKeySet.has(tableKey(row.tableNumber, row.groupSlug)),
    [assignedKeySet]
  );

  const mineLive = useMemo(
    () => items.filter((i) => isMineCall(i) && !i.isRead),
    [items, isMineCall]
  );
  const mineHistory = useMemo(
    () => items.filter((i) => isMineCall(i) && i.isRead),
    [items, isMineCall]
  );
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

  const activeTable = useMemo(
    () => assigned.find((t) => t.key === activeTableKey) || null,
    [assigned, activeTableKey]
  );

  const displayAssigned = useMemo(
    () =>
      assigned.map((t) => ({
        ...t,
        isFresh: freshKeys.has(t.key),
      })),
    [assigned, freshKeys]
  );

  function openTable(t: GarsonAssignedTable) {
    markTableSeen(t.key);
    setActiveTableKey(t.key);
  }

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
            const key = tableKey(item.tableNumber, item.groupSlug);
            const table = assigned.find((t) => t.key === key);
            if (table) openTable(table);
            else onOpenTable?.(item.tableNumber, item.groupSlug || null);
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

  if (activeTable) {
    return (
      <div className="garson-panel">
        <GarsonTableOrderDock
          table={activeTable}
          onClose={() => setActiveTableKey(null)}
          onChanged={() => void load()}
          onOpenFloor={onOpenTable}
        />
      </div>
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
              {freshKeys.size > 0 ? <em className="is-fresh">{freshKeys.size}</em> : null}
            </h2>
            <p className="garson-panel__lead">
              {user?.restaurant?.name
                ? `${user.restaurant.name} · size atanan masalar ve çağrılar`
                : 'Size atanan masalar ve çağrılar'}
            </p>
          </div>
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
            onClick={() => setTab('mine')}
          >
            Sizin masalarınız
            {mineUnread > 0 ? <i>{mineUnread}</i> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={tab === 'history' ? 'is-active' : ''}
            onClick={() => {
              setTab('history');
              setHistoryPage(1);
            }}
          >
            Geçmiş
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
              <p>Restorandaki tüm çağrılar burada listelenir. Okundu yalnızca sizin masalarınızda işler.</p>
            </div>
          ) : (
            <ul className="garson-panel__list">{items.map((item) => renderCallItem(item, false))}</ul>
          )
        ) : tab === 'history' ? (
          assigned.length === 0 ? (
            <div className="garson-panel__empty-card">
              <History className="garson-panel__empty-icon" strokeWidth={1.75} />
              <strong>Atanan masa yok</strong>
              <p>Geçmiş, size atanan masaların okunan çağrılarını gösterir.</p>
            </div>
          ) : mineHistory.length === 0 ? (
            <div className="garson-panel__empty-card">
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
          )
        ) : assigned.length === 0 ? (
          <div className="garson-panel__empty-card">
            <HandHelping className="garson-panel__empty-icon" strokeWidth={1.75} />
            <strong>Size atanmış masa yok</strong>
            <p>
              Masa görünümünde masayı açıp <b>Garson</b> ile kendinizi atayın. Atanınca masalar burada
              görünür; dokunup ürün ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="garson-panel__mine">
            <section className="garson-panel__section">
              <header className="garson-panel__section-head">
                <h3>Masalarınız</h3>
                <p>Dokunun → adisyon ve ürün ekle (masa görünümü ile aynı siparişler)</p>
              </header>
              <div className="garson-panel__tables">
                {displayAssigned.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`garson-table-card${t.occupied ? ' is-busy' : ''}${
                      t.isFresh ? ' is-fresh' : ''
                    }`}
                    onClick={() => openTable(t)}
                  >
                    {t.isFresh ? <span className="garson-table-card__badge">Yeni masanız</span> : null}
                    <span className="garson-table-card__top">
                      <span className="garson-table-card__name">{t.name}</span>
                      {t.occupied && t.openedAt ? (
                        <span className="garson-table-card__timer">
                          <Clock3 className="w-3 h-3" />
                          {formatDuration(t.openedAt, now)}
                        </span>
                      ) : (
                        <span className="garson-table-card__timer is-free">Boş</span>
                      )}
                    </span>
                    <span className="garson-table-card__meta">
                      <small>{t.groupName}</small>
                      <strong>
                        {t.orders.length
                          ? `${t.orders.length} kalem · ${formatMoney(t.total)}`
                          : 'Sipariş yok'}
                      </strong>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {mineLive.length > 0 ? (
              <section className="garson-panel__section">
                <header className="garson-panel__section-head">
                  <h3>Aktif çağrılar</h3>
                  <p>Okundu işaretleyebilirsiniz</p>
                </header>
                <ul className="garson-panel__list">
                  {mineLive.map((item) => renderCallItem(item, true))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
