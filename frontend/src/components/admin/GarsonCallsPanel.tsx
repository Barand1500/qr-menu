import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BellOff,
  CheckCheck,
  HandHelping,
  History,
  Receipt,
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
};

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

export default function GarsonCallsPanel({
  focusCallId,
  onOpenTable,
}: {
  focusCallId?: number | null;
  onOpenTable?: (masa: string, grup: string | null) => void;
}) {
  const [items, setItems] = useState<GarsonCallRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'live' | 'history' | 'report'>('live');

  const load = useCallback(async () => {
    try {
      const [list, report] = await Promise.all([
        api<{ data: GarsonCallRow[]; unreadCount: number; pagination: { total: number } }>(
          '/api/admin/table-requests?limit=50'
        ),
        api<Stats>('/api/admin/table-requests/stats?days=7'),
      ]);
      setItems(list.data || []);
      setUnreadCount(list.unreadCount || 0);
      setStats(report);
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
    } catch {
      /* ignore */
    }
  }

  const live = items.filter((i) => !i.isRead);
  const history = items;

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

        <div className="garson-panel__summary" aria-label="Özet">
          <div className={`garson-panel__summary-card${live.length ? ' is-alert' : ''}`}>
            <span>Bekleyen</span>
            <strong>{live.length}</strong>
          </div>
          <div className="garson-panel__summary-card">
            <span>Kayıt</span>
            <strong>{items.length}</strong>
          </div>
          <div className="garson-panel__summary-card">
            <span>7 gün</span>
            <strong>{stats?.total ?? '—'}</strong>
          </div>
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
            onClick={() => setTab('history')}
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
            <div className="garson-panel__stat-grid">
              <div>
                <span>7 gün toplam</span>
                <strong>{stats?.total ?? 0}</strong>
              </div>
              <div>
                <span>Garson</span>
                <strong>{stats?.waiter ?? 0}</strong>
              </div>
              <div>
                <span>Hesap</span>
                <strong>{stats?.bill ?? 0}</strong>
              </div>
            </div>
            <h3>
              <BarChart3 className="w-4 h-4" />
              En çok çağıran masalar
            </h3>
            {!stats?.topTables?.length ? (
              <div className="garson-panel__empty-card">
                <History className="garson-panel__empty-icon" strokeWidth={1.75} />
                <strong>Henüz veri yok</strong>
                <p>Çağrılar geldikçe buraya sıralanır.</p>
              </div>
            ) : (
              <ul className="garson-panel__rank">
                {stats.topTables.map((row) => (
                  <li key={`${row.groupSlug}-${row.tableNumber}`}>
                    <button
                      type="button"
                      onClick={() => onOpenTable?.(row.tableNumber, row.groupSlug)}
                    >
                      <span>{formatTableServiceLabel(row.tableNumber, row.groupSlug)}</span>
                      <em>{row.count}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (tab === 'live' ? live : history).length === 0 ? (
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
          <ul className="garson-panel__list">
            {(tab === 'live' ? live : history).map((item) => {
              const order = parseOrderJson(item.orderJson);
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
                    <span className="garson-panel__item-icon">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="garson-panel__item-copy">
                      <strong>{formatTableServiceLabel(item.tableNumber, item.groupSlug)}</strong>
                      <small>
                        {item.type === 'bill' ? 'Hesap' : order ? 'Sipariş + garson' : 'Garson'} ·{' '}
                        {formatTime(item.createdAt)}
                      </small>
                      {item.note ? <em>Not: {item.note}</em> : null}
                      {order?.items?.length ? (
                        <em>
                          {order.items.length} kalem
                          {order.totalPrice != null ? ` · ${formatMoney(order.totalPrice)}` : ''}
                        </em>
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
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
