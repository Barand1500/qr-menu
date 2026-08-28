import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, HandHelping, Receipt, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { playAdminNotificationSound } from '@/lib/notificationSound';
import { formatTableServiceLabel } from '@/lib/tableContext';
import {
  subscribeTableRequestCreated,
  type TableRequestNotifyPayload,
} from '@/lib/tableRequestNotify';

export interface TableServiceRequestRow {
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
  isRead: boolean;
  createdAt: string;
}

function typeLabel(type: string) {
  return type === 'bill' ? 'Hesap istendi' : 'Garson çağrıldı';
}

function typeIcon(type: string) {
  return type === 'bill' ? Receipt : HandHelping;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function AdminNotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TableServiceRequestRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [ringing, setRinging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef(0);
  const initialLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await api<{
        data: TableServiceRequestRow[];
        unreadCount: number;
        pagination?: { total: number };
      }>('/api/admin/table-requests?limit=12');
      setItems(res.data || []);
      setUnreadCount(res.unreadCount || 0);
      setTotalCount(res.pagination?.total ?? res.data?.length ?? 0);
    } catch {
      /* offline */
    }
  }, []);

  const applyInstantNotify = useCallback((payload?: TableRequestNotifyPayload) => {
    if (payload?.id) {
      setItems((prev) => {
        if (prev.some((x) => x.id === payload.id)) return prev;
        const row: TableServiceRequestRow = {
          id: payload.id,
          type: payload.type,
          tableNumber: payload.tableNumber,
          groupSlug: payload.groupSlug,
          isRead: false,
          createdAt: payload.createdAt,
        };
        return [row, ...prev].slice(0, 12);
      });
      setUnreadCount((c) => c + 1);
      setTotalCount((c) => c + 1);
    }
    void load();
  }, [load]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 2000);
    const unsub = subscribeTableRequestCreated(applyInstantNotify);
    const onFocus = () => void load();
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      unsub();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, applyInstantNotify]);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      prevUnread.current = unreadCount;
      return;
    }
    if (unreadCount > prevUnread.current) {
      playAdminNotificationSound();
      setRinging(true);
      const t = window.setTimeout(() => setRinging(false), 2400);
      prevUnread.current = unreadCount;
      return () => window.clearTimeout(t);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function handleItemClick(item: TableServiceRequestRow) {
    if (!item.isRead) {
      try {
        await api(`/api/admin/table-requests/${item.id}/read`, { method: 'PATCH' });
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x))
        );
      } catch {
        /* continue navigation */
      }
    }
    setOpen(false);
    if (item.tableNumber === 'admin') return;

    const params = new URLSearchParams();
    params.set('view', 'tables');
    params.set('masa', item.tableNumber);
    if (item.groupSlug) params.set('grup', item.groupSlug);
    params.set('cagri', String(item.id));
    params.set('tip', item.type);
    navigate(`/admin/barcode?${params}`);
  }

  async function clearAll() {
    if (clearing || totalCount === 0) return;
    const ok = window.confirm(
      totalCount === 1
        ? 'Bu masa çağrısını silmek istiyor musunuz?'
        : `${totalCount} masa çağrısının tamamını silmek istiyor musunuz?`
    );
    if (!ok) return;

    setClearing(true);
    try {
      await api('/api/admin/table-requests', { method: 'DELETE' });
      setItems([]);
      setUnreadCount(0);
      setTotalCount(0);
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="admin-notify" ref={panelRef}>
      <button
        type="button"
        className={`admin-notify__bell p-2 rounded-lg relative hover:bg-[var(--admin-accent-soft)] transition${ringing ? ' admin-notify__bell--ring' : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-label="Bildirimler"
        aria-expanded={open}
      >
        <Bell className="w-[18px] h-[18px]" style={{ color: 'var(--admin-text-muted)' }} />
        {unreadCount > 0 && (
          <span className="admin-notify__badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="admin-notify__panel">
          <div className="admin-notify__head">
            <strong className="admin-notify__title">
              Masa çağrıları
              {totalCount > 0 && (
                <span className="admin-notify__total">{totalCount}</span>
              )}
            </strong>
            <div className="admin-notify__head-actions">
              {totalCount > 0 && (
                <button
                  type="button"
                  className="admin-notify__clear"
                  onClick={() => void clearAll()}
                  disabled={clearing}
                  aria-label="Tümünü temizle"
                  title="Tümünü temizle"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="admin-notify__empty">Henüz çağrı yok</p>
          ) : (
            <ul className="admin-notify__list">
              {items.map((item) => {
                const Icon = typeIcon(item.type);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`admin-notify__item${!item.isRead ? ' is-new' : ''}`}
                      onClick={() => void handleItemClick(item)}
                    >
                      <span className={`admin-notify__item-icon admin-notify__item-icon--${item.type}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="admin-notify__item-copy">
                        <strong>{typeLabel(item.type)}</strong>
                        <span>
                          {formatTableServiceLabel(item.tableNumber, item.groupSlug)}
                        </span>
                      </span>
                      <em>{formatTime(item.createdAt)}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
