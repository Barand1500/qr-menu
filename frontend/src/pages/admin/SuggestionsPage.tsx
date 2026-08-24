import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, MailOpen, Trash2, CheckCheck, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { STAR_COLORS } from '@/components/public/SuggestionMascot';
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui';

interface Suggestion {
  id: number;
  fullName?: string | null;
  phone?: string | null;
  message?: string | null;
  rating: number;
  isRead: boolean;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="w-4 h-4"
          fill={s <= rating ? STAR_COLORS[s - 1] : 'transparent'}
          stroke={s <= rating ? STAR_COLORS[s - 1] : '#cbd5e1'}
          strokeWidth={1.75}
        />
      ))}
    </div>
  );
}

export default function SuggestionsPage() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (filter === 'unread') params.set('unread', 'true');
    const res = await api<{ data: Suggestion[]; unreadCount: number }>(
      `/api/admin/suggestions?${params}`
    );
    setItems(res.data);
    setUnreadCount(res.unreadCount);
  }, [filter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function markRead(id: number) {
    await api(`/api/admin/suggestions/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function remove(id: number) {
    if (!confirm('Bu öneriyi silmek istediğinize emin misiniz?')) return;
    await api(`/api/admin/suggestions/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHeader title="Öneri Kutusu" />

      <p className="text-sm admin-text-muted -mt-3 mb-1">
        {unreadCount > 0
          ? `${unreadCount} okunmamış memnuniyet anketi`
          : 'Karşılama ekranından gelen öneri ve puanlar'}
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
          <EmptyState message="Henüz öneri veya puan yok" />
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
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RatingStars rating={item.rating} />
                      <span className="text-xs font-bold admin-text-muted">{item.rating}/5</span>
                    </div>
                    {item.fullName && (
                      <p className="font-semibold text-[var(--admin-text)] mt-1">{item.fullName}</p>
                    )}
                    <p className="text-xs admin-text-muted mt-0.5">{formatDate(item.createdAt)}</p>
                    {item.phone && <p className="text-sm admin-text-muted mt-1">{item.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!item.isRead ? (
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700">
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
              {item.message && (
                <div className="p-4 sm:p-5">
                  <p className="text-sm text-[var(--admin-text)] whitespace-pre-wrap leading-relaxed">
                    {item.message}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
