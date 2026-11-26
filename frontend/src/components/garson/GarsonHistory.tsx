import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  Banknote,
  Check,
  ChevronLeft,
  Clock,
  DoorOpen,
  Footprints,
  HandHelping,
  History,
  Plus,
  Power,
  ReceiptText,
  ShoppingBag,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clock, money, span, type HistoryItem, type HistorySummary } from '@/lib/garsonBoard';

export type HistoryFilter = { group: string; code: string; label: string };
type Detail = { summary: HistorySummary; timeline: HistoryItem[]; now: number };
type IconType = ComponentType<{ size?: number }>;

const KIND_ICON: Record<HistoryItem['kind'], IconType> = {
  open: DoorOpen,
  join: Users,
  call: HandHelping,
  bill: ReceiptText,
  order: ShoppingBag,
  repeat: Plus,
  claim: Footprints,
  unclaim: X,
  done: Check,
  visit: Footprints,
  pay: Banknote,
  close: Power,
};
const CALL_NAME: Record<string, string> = { waiter: 'Garson çağrısı', bill: 'Hesap isteği', hookah: 'Nargile', valet: 'Vale', order: 'Sipariş' };
const CALL_ICON: Record<string, IconType> = { waiter: HandHelping, bill: ReceiptText, hookah: HandHelping, valet: HandHelping, order: ShoppingBag };

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
/** "19:42" (bugünse) ya da "12 Kas · 19:42" */
const when = (t: number, now: number) =>
  sameDay(t, now) ? clock(t) : `${new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · ${clock(t)}`;

/**
 * Masa geçmişi: her oturum (masaya oturulup kalkılana kadar) ayrı kayıt. Listede özet, dokununca ayrıntı:
 * kim ne zaman çağırdı, hangi garson kaç dakikada gitti, hesap ne zaman istendi, ne zaman kalktılar, toplam süre.
 */
export default function GarsonHistory({ filter, onFilter }: { filter: HistoryFilter | null; onFilter: (f: HistoryFilter | null) => void }) {
  const [list, setList] = useState<{ sessions: HistorySummary[]; more: boolean; now: number } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const qs = filter ? `table=${encodeURIComponent(filter.code)}&group=${encodeURIComponent(filter.group)}` : '';
  const loadList = useCallback(async () => {
    try {
      const data = await api<{ sessions: HistorySummary[]; more: boolean; now: number }>(`/api/admin/garson/history${qs ? `?${qs}` : ''}`);
      setList(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geçmiş yüklenemedi');
    }
  }, [qs]);

  useEffect(() => {
    setList(null);
    void loadList();
    const id = window.setInterval(() => !document.hidden && void loadList(), 20_000);
    return () => window.clearInterval(id);
  }, [loadList]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetail(await api<Detail>(`/api/admin/garson/history/${id}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ayrıntı yüklenemedi');
    }
  }, []);
  useEffect(() => {
    if (openId == null) return;
    void loadDetail(openId);
    const id = window.setInterval(() => !document.hidden && void loadDetail(openId), 20_000);
    return () => window.clearInterval(id);
  }, [openId, loadDetail]);

  async function more() {
    if (!list || !list.sessions.length) return;
    setLoadingMore(true);
    try {
      const last = list.sessions[list.sessions.length - 1];
      const data = await api<{ sessions: HistorySummary[]; more: boolean; now: number }>(`/api/admin/garson/history?${qs ? `${qs}&` : ''}before=${last.openedAt}`);
      setList({ ...data, sessions: [...list.sessions, ...data.sessions] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Geçmiş yüklenemedi');
    } finally {
      setLoadingMore(false);
    }
  }

  // ───── ayrıntı ─────
  if (openId != null) {
    const s = detail?.summary;
    const now = detail?.now ?? Date.now();
    return (
      <section className="gh" aria-label="Oturum ayrıntısı">
        <button type="button" className="gh-back" onClick={() => { setOpenId(null); setDetail(null); }}>
          <ChevronLeft size={20} aria-hidden="true" /> Geçmiş
        </button>
        {error ? <p className="gh-error" role="alert">{error}</p> : null}
        {!s ? (
          <p className="gh-empty"><span className="gb-spinner" aria-hidden="true" /> Yükleniyor…</p>
        ) : (
          <>
            <header className="gh-head">
              <div>
                <h2>{s.label}</h2>
                <small>{when(s.openedAt, now)} oturumu</small>
              </div>
              <span className={`gh-badge${s.closedAt ? '' : ' is-open'}`}>{s.closedAt ? 'Kapandı' : 'Açık'}</span>
            </header>
            <dl className="gh-stats">
              <div><dt>Oturum başladı</dt><dd>{clock(s.openedAt)}</dd></div>
              <div><dt>Kalktılar</dt><dd>{s.closedAt ? clock(s.closedAt) : 'Hâlâ açık'}</dd></div>
              <div className="is-big"><dt>{s.closedAt ? 'Toplam süre' : 'Şu ana kadar'}</dt><dd>{span(s.durationMs)}</dd></div>
              <div><dt>Telefon</dt><dd>{s.people || '—'}</dd></div>
              <div><dt>Hesap istendi</dt><dd>{s.billAt ? clock(s.billAt) : '—'}</dd></div>
              <div><dt>Ödeme</dt><dd>{s.paidAt ? clock(s.paidAt) : '—'}</dd></div>
              <div><dt>Hesaptan kalkışa</dt><dd>{s.billToCloseMs != null ? span(s.billToCloseMs) : '—'}</dd></div>
              <div><dt>Gelme süresi (ort.)</dt><dd>{s.avgClaimMs != null ? span(s.avgClaimMs) : '—'}</dd></div>
              <div><dt>Tutar</dt><dd>{s.itemCount ? money(s.total) : '—'}</dd></div>
            </dl>

            {s.callList.length ? (
              <>
                <h3 className="gh-title">Çağrılar ({s.callList.length})</h3>
                <ul className="gh-calls">
                  {s.callList.map((c) => {
                    const Icon = CALL_ICON[c.type] || HandHelping;
                    return (
                      <li key={c.id} className={`t-${c.type}`}>
                        <span className="gh-calls__icon" aria-hidden="true"><Icon size={18} /></span>
                        <div>
                          <strong>{CALL_NAME[c.type] || 'Çağrı'} · {clock(c.at)}</strong>
                          <small>
                            {c.person ? `${c.person}. kişi` : 'Müşteri'}
                            {c.repeats ? ` +${c.repeats} kişi` : ''}
                          </small>
                        </div>
                        <em className={c.claimMs == null ? 'is-miss' : c.claimMs > 5 * 60_000 ? 'is-slow' : ''}>
                          {c.claimMs != null ? `${c.claimBy || 'Garson'} ${span(c.claimMs)} içinde gitti` : c.doneMs != null ? `${c.doneBy || 'Garson'} ${span(c.doneMs)} içinde halletti` : 'Kimse gitmedi'}
                        </em>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            <h3 className="gh-title">Zaman çizelgesi</h3>
            <ol className="gh-line">
              {(detail?.timeline ?? []).map((it) => {
                const Icon = KIND_ICON[it.kind];
                return (
                  <li key={it.id} className={`k-${it.kind}${it.callType ? ` t-${it.callType}` : ''}`}>
                    <span className="gh-line__dot" aria-hidden="true"><Icon size={15} /></span>
                    <div>
                      <p>{it.text}</p>
                      <time>{clock(it.t)}{it.t - s.openedAt >= 60_000 ? ` · açılıştan ${span(it.t - s.openedAt)} sonra` : ''}</time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    );
  }

  // ───── liste ─────
  const now = list?.now ?? Date.now();
  return (
    <section className="gh" aria-label="Masa geçmişi">
      <header className="gh-top">
        <h2><History size={20} aria-hidden="true" /> Masa geçmişi</h2>
        {filter ? (
          <button type="button" className="gh-chip" onClick={() => onFilter(null)} aria-label={`${filter.label} süzgecini kaldır`}>
            {filter.label} <X size={14} aria-hidden="true" />
          </button>
        ) : (
          <small>Son oturumlar, tüm masalar</small>
        )}
      </header>
      {error ? <p className="gh-error" role="alert">{error}</p> : null}
      {!list ? (
        <p className="gh-empty"><span className="gb-spinner" aria-hidden="true" /> Yükleniyor…</p>
      ) : !list.sessions.length ? (
        <p className="gh-empty">Henüz kayıtlı oturum yok.</p>
      ) : (
        <ul className="gh-list">
          {list.sessions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpenId(s.id)} aria-label={`${s.label} oturumu, ${when(s.openedAt, now)}`}>
                <span className="gh-list__top">
                  <strong>{s.label}</strong>
                  <span className={`gh-badge${s.closedAt ? '' : ' is-open'}`}>{s.closedAt ? 'Kapandı' : 'Açık'}</span>
                </span>
                <span className="gh-list__time">
                  <Clock size={14} aria-hidden="true" /> {when(s.openedAt, now)}{s.closedAt ? ` → ${clock(s.closedAt)}` : ''}
                </span>
                <span className="gh-list__meta">
                  <span><Timer size={14} aria-hidden="true" /> {span(s.durationMs)}</span>
                  {s.people ? <span><Users size={14} aria-hidden="true" /> {s.people}</span> : null}
                  {s.calls ? <span><HandHelping size={14} aria-hidden="true" /> {s.calls}</span> : null}
                  {s.itemCount ? <span><ReceiptText size={14} aria-hidden="true" /> {money(s.total)}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list?.more ? (
        <button type="button" className="gh-more" disabled={loadingMore} onClick={() => void more()}>
          {loadingMore ? 'Yükleniyor…' : 'Daha eski oturumlar'}
        </button>
      ) : null}
    </section>
  );
}
