import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Lightbulb,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui';
import AdminOverlay from '@/components/admin/AdminOverlay';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import SuggestionReader, {
  SuggestionRating,
  suggestionDate,
} from '@/components/admin/suggestions/SuggestionReader';
import '@/components/admin/suggestions/suggestions.css';

export interface Suggestion {
  id: number;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  rating: number;
  isRead: boolean;
  createdAt: string;
}
type View = { filter: 'all' | 'unread'; query: string; page: number };
const PAGE_SIZE = 20;

export default function SuggestionsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>({ filter: 'all', query: '', page: 1 });
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState('');
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const lock = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const requestKey = JSON.stringify([view, revision]);
  const pending = loaded !== requestKey;
  const active = selected || (!pending && !error ? items[0] : null);
  const changeView = useCallback((next: View) => {
    setSelected(null);
    setConfirmDelete(false);
    setView(next);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = search.trim();
      if (query !== view.query) changeView({ ...view, query, page: 1 });
    }, 280);
    return () => clearTimeout(timer);
  }, [search, view, changeView]);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(view.page),
    });
    if (view.filter === 'unread') params.set('unread', 'true');
    if (view.query) params.set('q', view.query);
    async function load() {
      try {
        const res = await api<{
          data: Suggestion[];
          unreadCount: number;
          pagination?: { total: number };
        }>('/api/admin/suggestions?' + params, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!Array.isArray(res.data)) throw new Error('Öneriler alınamadı');
        const count = Number.isFinite(res.pagination?.total)
          ? res.pagination!.total
          : res.data.length;
        const last = Math.max(1, Math.ceil(count / PAGE_SIZE));
        if (view.page > last) {
          setView((v) => ({ ...v, page: last }));
          return;
        }
        setItems(res.data);
        setUnread(
          Number.isFinite(res.unreadCount) ? Math.max(0, res.unreadCount) : 0,
        );
        setTotal(Math.max(0, count));
        setSelected((previous) =>
          previous
            ? res.data.find((row) => row.id === previous.id) || previous
            : null,
        );
      } catch {
        if (controller.signal.aborted) return;
        setError(true);
      }
      if (!controller.signal.aborted) setLoaded(requestKey);
    }
    void load();
    return () => controller.abort();
  }, [view, revision, requestKey]);
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const resize = () => {
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!confirmDelete || mobileOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lock.current) {
        event.preventDefault();
        setConfirmDelete(false);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [confirmDelete, mobileOpen]);

  async function markRead(item: Suggestion) {
    if (lock.current || item.isRead) return;
    lock.current = true;
    setBusy(true);
    try {
      await api('/api/admin/suggestions/' + item.id + '/read', {
        method: 'PATCH',
      });
      if (!mounted.current) return;
      setSelected({ ...item, isRead: true });
      setUnread((v) => Math.max(0, v - 1));
      setRevision((v) => v + 1);
      setNotice({ error: false, text: 'Öneri okundu olarak işaretlendi.' });
    } catch (err) {
      if (mounted.current)
        setNotice({
          error: true,
          text: err instanceof Error ? err.message : 'Kaydedilemedi.',
        });
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function remove(item: Suggestion) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await api('/api/admin/suggestions/' + item.id, { method: 'DELETE' });
      if (!mounted.current) return;
      setSelected(null);
      setMobileOpen(false);
      setConfirmDelete(false);
      setRevision((v) => v + 1);
      setNotice({ error: false, text: 'Öneri silindi.' });
      requestAnimationFrame(() =>
        searchRef.current?.focus({ preventScroll: true }),
      );
    } catch (err) {
      if (mounted.current)
        setNotice({
          error: true,
          text: err instanceof Error ? err.message : 'Öneri silinemedi.',
        });
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function choose(item: Suggestion) {
    setSelected(item);
    setConfirmDelete(false);
    if (matchMedia('(max-width: 767px)').matches) setMobileOpen(true);
  }
  const reader = active ? (
    <SuggestionReader
      key={active.id}
      item={active}
      restaurantName={user?.restaurant.name}
      busy={busy}
      confirmDelete={confirmDelete}
      onRead={() => void markRead(active)}
      onDelete={() => void remove(active)}
      onConfirmChange={setConfirmDelete}
    />
  ) : null;
  return (
    <div className="asg-page">
      <PageHeader
        title="Öneri Kutusu"
        subtitle={
          loaded
            ? unread > 0
              ? unread + ' okunmamış not · Misafirlerinize kulak verin.'
              : 'Misafirlerinizden gelen notlar ve puanlar.'
            : 'Misafirlerinizden gelen notlar ve puanlar.'
        }
      />
      <AdminToast notice={notice} onClose={() => setNotice(null)} />
      <div className="asg-toolbar">
        <div className="asg-filters" aria-label="Öneri görünümü">
          <button
            aria-pressed={view.filter === 'all'}
            disabled={busy}
            onClick={() => {
              if (view.filter !== 'all')
                changeView({ ...view, filter: 'all', page: 1 });
            }}
          >
            Tümü
          </button>
          <button
            aria-pressed={view.filter === 'unread'}
            disabled={busy}
            onClick={() => {
              if (view.filter !== 'unread')
                changeView({ ...view, filter: 'unread', page: 1 });
            }}
          >
            Okunmamış {unread > 0 && <span>{unread}</span>}
          </button>
        </div>
        <label className="asg-search">
          <Search size={17} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Öneri ara"
            placeholder="İsim, iletişim bilgisi veya not ara"
            value={search}
            disabled={busy}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              aria-label="Aramayı temizle"
              disabled={busy}
              onClick={() => setSearch('')}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <button
          className="asg-refresh"
          aria-label="Önerileri yenile"
          disabled={busy || pending}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={17} className={pending ? 'is-spinning' : ''} />
        </button>
      </div>
      <div
        className={'asg-workspace' + (!pending && !active ? ' is-empty' : '')}
      >
        <section
          className="asg-inbox"
          aria-label="Öneriler"
          aria-busy={pending}
        >
          <header>
            <span>
              <Inbox size={15} />
              GELEN NOTLAR
            </span>
            <span>{pending ? '…' : error ? '—' : total + ' öneri'}</span>
          </header>
          <div className="asg-list" key={JSON.stringify(view)}>
            {pending ? (
              <div
                className="asg-loading"
                role="status"
                aria-label="Öneriler yükleniyor"
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <i />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="asg-empty" role="alert">
                <Inbox size={30} />
                <strong>Notlar yüklenemedi.</strong>
                <p>Bağlantıyı kontrol edip yeniden deneyin.</p>
                <button onClick={() => setRevision((v) => v + 1)}>
                  <RefreshCw size={15} />
                  Yeniden dene
                </button>
              </div>
            ) : !items.length ? (
              <div className="asg-empty">
                <div className="asg-envelope" aria-hidden="true">
                  <div>
                    <Lightbulb size={35} strokeWidth={1.2} />
                  </div>
                  <i />
                </div>
                <strong>
                  {view.query
                    ? 'Bu aramada not yok.'
                    : view.filter === 'unread'
                      ? 'Hepsi okundu.'
                      : 'İlk güzel fikri bekliyoruz.'}
                </strong>
                <p>
                  {view.query
                    ? 'Başka bir kelimeyle yeniden bakabilirsiniz.'
                    : view.filter === 'unread'
                      ? 'Diğer notlara Tümü bölümünden ulaşabilirsiniz.'
                      : 'Misafirleriniz öneri bıraktığında burada buluşacağız.'}
                </p>
              </div>
            ) : (
              <ul>
                {items.map((item, i) => (
                  <li
                    key={item.id}
                    style={
                      {
                        '--note-delay': Math.min(i, 6) * 35 + 'ms',
                      } as CSSProperties
                    }
                  >
                    <button
                      className={
                        'asg-message ' +
                        (active?.id === item.id ? 'is-selected ' : '') +
                        (!item.isRead ? 'is-unread' : '')
                      }
                      aria-label={
                        (item.fullName?.trim() || 'Misafir') + ' önerisini oku'
                      }
                      aria-pressed={active?.id === item.id}
                      onClick={() => choose(item)}
                    >
                      <span className="asg-avatar" aria-hidden="true">
                        {(item.fullName?.trim() || 'Misafir')
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join('')
                          .toLocaleUpperCase('tr-TR')}
                      </span>
                      <span className="asg-message__copy">
                        <span className="asg-message__heading">
                          <strong>
                            {item.fullName?.trim() || 'Bir misafiriniz'}
                          </strong>
                          <time dateTime={item.createdAt}>
                            {suggestionDate(item.createdAt, true)}
                          </time>
                        </span>
                        <span className="asg-message__text">
                          {item.message?.trim() || 'Yalnızca puan bıraktı.'}
                        </span>
                        <span className="asg-message__bottom">
                          <SuggestionRating rating={item.rating} />
                          {!item.isRead && (
                            <small>
                              <i />
                              Yeni
                            </small>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="asg-message__arrow" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <footer className="asg-pagination">
            <span>
              {pending
                ? 'Yükleniyor…'
                : error
                  ? 'Bağlantı bekleniyor'
                  : total
                    ? (view.page - 1) * PAGE_SIZE +
                      1 +
                      '–' +
                      Math.min(view.page * PAGE_SIZE, total) +
                      ' / ' +
                      total
                    : '0 öneri'}
            </span>
            <div>
              <button
                aria-label="Önceki sayfa"
                disabled={busy || pending || view.page === 1}
                onClick={() => changeView({ ...view, page: view.page - 1 })}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                aria-label="Sonraki sayfa"
                disabled={busy || pending || view.page * PAGE_SIZE >= total}
                onClick={() => changeView({ ...view, page: view.page + 1 })}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </footer>
        </section>
        <aside className="asg-reader" aria-label="Seçilen öneri">
          {reader || (
            <div className="asg-reader-empty">
              <div className="asg-envelope" aria-hidden="true">
                <div>
                  <Lightbulb size={35} strokeWidth={1.2} />
                </div>
                <i />
              </div>
              <h2>Her notta bir fikir var.</h2>
              <p>Bir öneri seçin, misafirinizin sesine kulak verin.</p>
            </div>
          )}
        </aside>
      </div>
      {mobileOpen && active && (
        <AdminOverlay
          label="Öneri ayrıntısı"
          busy={busy}
          onClose={() => setMobileOpen(false)}
          onEscape={() => {
            if (confirmDelete) {
              setConfirmDelete(false);
              return true;
            }
            return false;
          }}
          className="asg-reader-overlay"
        >
          <section className="relative asg-reader-sheet">
            <header>
              <span>Öneri Kutusu</span>
              <button
                aria-label="Öneriyi kapat"
                disabled={busy}
                onClick={() => {
                  if (!lock.current) setMobileOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </header>
            {reader}
          </section>
        </AdminOverlay>
      )}
    </div>
  );
}
