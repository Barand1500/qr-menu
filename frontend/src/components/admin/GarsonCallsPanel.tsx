import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

type Stats = {
  days: number;
  total: number;
  waiter: number;
  bill: number;
  topTables: { tableNumber: string; groupSlug: string | null; count: number }[];
  byHour?: number[];
  byDay?: { date: string; waiter: number; bill: number; total: number }[];
};

const HISTORY_PAGE_SIZE = 8;
const CHART_TEAL = '#0f766e';
const CHART_AMBER = '#d97706';
const CHART_MUTED = '#a8a29e';

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

function formatDayLabel(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return isoDate;
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
  const [items, setItems] = useState<GarsonCallRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'live' | 'history' | 'report'>('live');
  const [historyPage, setHistoryPage] = useState(1);
  const snapshotRef = useRef(onCallsSnapshot);
  snapshotRef.current = onCallsSnapshot;

  const load = useCallback(async () => {
    try {
      const [list, report] = await Promise.all([
        api<{ data: GarsonCallRow[]; unreadCount: number; pagination: { total: number } }>(
          '/api/admin/table-requests?limit=100'
        ),
        api<Stats>('/api/admin/table-requests/stats?days=7'),
      ]);
      const rows = list.data || [];
      const unread = list.unreadCount || 0;
      setItems(rows);
      setUnreadCount(unread);
      setStats(report);
      snapshotRef.current?.(rows, unread);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [load]);

  async function markRead(id: number) {
    try {
      await api(`/api/admin/table-requests/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
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
      setUnreadCount(0);
      setStats((s) =>
        s
          ? {
              ...s,
              total: 0,
              waiter: 0,
              bill: 0,
              topTables: [],
              byHour: Array.from({ length: 24 }, () => 0),
              byDay: (s.byDay || []).map((d) => ({ ...d, waiter: 0, bill: 0, total: 0 })),
            }
          : s
      );
      setHistoryPage(1);
    } catch {
      /* ignore */
    }
  }

  const live = useMemo(() => items.filter((i) => !i.isRead), [items]);
  const history = items;
  const historyPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPages);
  const historySlice = history.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > historyPages) setHistoryPage(historyPages);
  }, [historyPage, historyPages]);

  const typeChart = useMemo(() => {
    const w = stats?.waiter ?? 0;
    const b = stats?.bill ?? 0;
    return [
      { name: 'Garson', value: w, color: CHART_TEAL },
      { name: 'Hesap', value: b, color: CHART_AMBER },
    ].filter((x) => x.value > 0);
  }, [stats]);

  const dayChart = useMemo(
    () =>
      (stats?.byDay || []).map((d) => ({
        label: formatDayLabel(d.date),
        Garson: d.waiter,
        Hesap: d.bill,
        Toplam: d.total,
      })),
    [stats]
  );

  const hourChart = useMemo(() => {
    const hours = stats?.byHour || [];
    return hours
      .map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}`, count }))
      .filter((row) => {
        const h = Number(row.hour);
        return h >= 8 && h <= 23;
      });
  }, [stats]);

  const tableChart = useMemo(
    () =>
      (stats?.topTables || []).slice(0, 8).map((row) => ({
        name: formatTableServiceLabel(row.tableNumber, row.groupSlug),
        count: row.count,
      })),
    [stats]
  );

  const listItems = tab === 'live' ? live : historySlice;

  function renderCallItem(item: GarsonCallRow) {
    const order = parseOrderJson(item.orderJson);
    const note = (item.note || order?.note || '').trim();
    const Icon = item.type === 'bill' ? Receipt : HandHelping;
    const focused = focusCallId === item.id;
    return (
      <li
        key={item.id}
        className={`garson-panel__item${!item.isRead ? ' is-new' : ''}${focused ? ' is-focus' : ''}`}
      >
        <button
          type="button"
          className="garson-panel__item-main"
          onClick={() => {
            void markRead(item.id);
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
        {!item.isRead ? (
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

  const tooltipStyle = {
    borderRadius: 10,
    border: '1px solid rgba(88, 60, 36, 0.12)',
    fontSize: 12,
  };

  return (
    <div className="garson-panel">
      <div className="garson-panel__shell">
        <div className="garson-panel__head">
          <div>
            <p className="garson-panel__eyebrow">Garson merkezi</p>
            <h2>
              Çağrılar {unreadCount > 0 ? <em>{unreadCount}</em> : null}
            </h2>
            <p className="garson-panel__lead">
              Masa çağrılarını buradan takip et; dokununca masaya gidersin.
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
            aria-selected={tab === 'live'}
            className={tab === 'live' ? 'is-active' : ''}
            onClick={() => setTab('live')}
          >
            Canlı
            {live.length > 0 ? <i>{live.length}</i> : null}
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
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'report'}
            className={tab === 'report' ? 'is-active' : ''}
            onClick={() => setTab('report')}
          >
            Rapor
          </button>
        </div>

        {loading ? (
          <div className="garson-panel__empty-card">
            <p>Yükleniyor…</p>
          </div>
        ) : tab === 'report' ? (
          <div className="garson-panel__report">
            {!stats || stats.total === 0 ? (
              <div className="garson-panel__empty-card">
                <History className="garson-panel__empty-icon" strokeWidth={1.75} />
                <strong>Henüz veri yok</strong>
                <p>Çağrılar geldikçe günlük ve saatlik grafikler burada görünür.</p>
              </div>
            ) : (
              <>
                <div className="garson-panel__charts">
                  <section className="garson-panel__chart-card">
                    <header>
                      <h3>Çağrı türü</h3>
                      <p>Son {stats.days} gün · {stats.total} çağrı</p>
                    </header>
                    <div className="garson-panel__chart-body garson-panel__chart-body--sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={typeChart.length ? typeChart : [{ name: 'Yok', value: 1, color: CHART_MUTED }]}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={72}
                            paddingAngle={3}
                          >
                            {(typeChart.length ? typeChart : [{ color: CHART_MUTED }]).map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="garson-panel__legend">
                      <li>
                        <i style={{ background: CHART_TEAL }} />
                        Garson <b>{stats.waiter}</b>
                      </li>
                      <li>
                        <i style={{ background: CHART_AMBER }} />
                        Hesap <b>{stats.bill}</b>
                      </li>
                    </ul>
                  </section>

                  <section className="garson-panel__chart-card garson-panel__chart-card--wide">
                    <header>
                      <h3>Günlük trend</h3>
                      <p>Garson ve hesap çağrıları</p>
                    </header>
                    <div className="garson-panel__chart-body">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayChart} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(88,60,36,0.1)" />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#78716c', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#78716c', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="Garson" stackId="a" fill={CHART_TEAL} radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Hesap" stackId="a" fill={CHART_AMBER} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="garson-panel__chart-card garson-panel__chart-card--wide">
                    <header>
                      <h3>Saatlik yoğunluk</h3>
                      <p>08:00 – 23:00</p>
                    </header>
                    <div className="garson-panel__chart-body">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourChart}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(88,60,36,0.1)" />
                          <XAxis
                            dataKey="hour"
                            tick={{ fill: '#78716c', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            interval={1}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#78716c', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                          />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" name="Çağrı" fill={CHART_TEAL} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className="garson-panel__chart-card">
                    <header>
                      <h3>En çok çağıran masalar</h3>
                      <p>Dokununca masaya git</p>
                    </header>
                    {!tableChart.length ? (
                      <p className="garson-panel__chart-empty">Masa verisi yok</p>
                    ) : (
                      <div className="garson-panel__chart-body">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tableChart} layout="vertical" margin={{ left: 4, right: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(88,60,36,0.1)" />
                            <XAxis type="number" allowDecimals={false} hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={88}
                              tick={{ fill: '#57534e', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar
                              dataKey="count"
                              name="Çağrı"
                              fill={CHART_TEAL}
                              radius={[0, 6, 6, 0]}
                              cursor="pointer"
                              onClick={(data) => {
                                const row = stats.topTables.find(
                                  (t) =>
                                    formatTableServiceLabel(t.tableNumber, t.groupSlug) ===
                                    (data as { name?: string })?.name
                                );
                                if (row) onOpenTable?.(row.tableNumber, row.groupSlug);
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        ) : listItems.length === 0 ? (
          <div className="garson-panel__empty-card">
            {tab === 'live' ? (
              <BellOff className="garson-panel__empty-icon" strokeWidth={1.75} />
            ) : (
              <History className="garson-panel__empty-icon" strokeWidth={1.75} />
            )}
            <strong>{tab === 'live' ? 'Bekleyen çağrı yok' : 'Geçmiş çağrı yok'}</strong>
            <p>
              {tab === 'live'
                ? 'Misafir garson çağırınca veya hesap isteyince burada anında görünür.'
                : 'Okunan ve geçmiş çağrılar burada listelenir.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="garson-panel__list">{listItems.map(renderCallItem)}</ul>
            {tab === 'history' && history.length > HISTORY_PAGE_SIZE ? (
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
                    {Math.min(safeHistoryPage * HISTORY_PAGE_SIZE, history.length)} / {history.length}
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
      </div>
    </div>
  );
}
