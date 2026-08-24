import { useCallback, useEffect, useState } from 'react';
import { MessageCircleHeart, MailOpen, Trash2, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui';

interface Complaint {
  id: number;
  fullName: string;
  phone?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function ComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (filter === 'unread') params.set('unread', 'true');
    const res = await api<{ data: Complaint[]; unreadCount: number }>(
      `/api/admin/complaints?${params}`
    );
    setItems(res.data);
    setUnreadCount(res.unreadCount);
  }, [filter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function markRead(id: number) {
    await api(`/api/admin/complaints/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function remove(id: number) {
    if (!confirm('Bu şikayeti silmek istediğinize emin misiniz?')) return;
    await api(`/api/admin/complaints/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader title="Şikayet Kutusu" />

      <p className="text-sm admin-text-muted -mt-3 mb-1">
        {unreadCount > 0
          ? `${unreadCount} okunmamış mesaj — karşılama ekranından gelen geri bildirimler`
          : 'Karşılama ekranından gelen geri bildirimler'}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            filter === 'all'
              ? 'bg-[var(--admin-accent)] text-white'
              : 'bg-[var(--admin-input-bg)] admin-text-muted'
          }`}
        >
          Tümü
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
            filter === 'unread'
              ? 'bg-[var(--admin-accent)] text-white'
              : 'bg-[var(--admin-input-bg)] admin-text-muted'
          }`}
        >
          <MailOpen className="w-4 h-4" />
          Okunmamış
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-white/20">{unreadCount}</span>
          )}
        </button>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState message="Henüz şikayet mesajı yok" />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`!p-0 overflow-hidden ${!item.isRead ? 'ring-2 ring-[var(--admin-accent)]/30' : ''}`}
            >
              <div
                className="p-4 sm:p-5 border-b flex flex-wrap items-start justify-between gap-3"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)' }}
                  >
                    <MessageCircleHeart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--admin-text)]">{item.fullName}</p>
                    <p className="text-xs admin-text-muted mt-0.5">{formatDate(item.createdAt)}</p>
                    {item.phone && (
                      <p className="text-sm admin-text-muted mt-1">{item.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead ? (
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700">
                      Yeni
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--admin-input-bg)] admin-text-muted">
                      Okundu
                    </span>
                  )}
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                      title="Okundu işaretle"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-red-500"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-sm text-[var(--admin-text)] whitespace-pre-wrap leading-relaxed">
                  {item.message}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
