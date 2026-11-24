import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  Car,
  Check,
  ChevronDown,
  Clock,
  ConciergeBell,
  Flame,
  Footprints,
  QrCode,
  Receipt,
  ShoppingBag,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { applyDocumentTitle } from '@/lib/siteTitle';
import { playAdminNotificationSound } from '@/lib/notificationSound';
import { ago, clock, since, money, urgency, type Board, type BoardCall, type BoardTable, type CallType, type FeedKind } from '@/lib/garsonBoard';
import '@/garson-board.css';

const POLL_MS = 4000;
type Tab = 'calls' | 'tables' | 'feed';
type Filter = 'all' | 'busy' | 'due' | 'empty';

const CALL_ICON: Record<CallType, typeof Bell> = { waiter: Bell, bill: Receipt, hookah: Flame, valet: Car, order: ShoppingBag };
const FEED_ICON: Record<FeedKind, typeof Bell> = {
  ...CALL_ICON,
  scan: QrCode,
  visit: Footprints,
  claim: Footprints,
  unclaim: X,
  done: Check,
};

function saveCollapsed(s: Set<string>) {
  try {
    localStorage.setItem('garson_board_collapsed', JSON.stringify([...s]));
  } catch {
    /* depolama kapalı */
  }
}

const shortName =(t: BoardTable) => t.label.match(/(\d+)\s*$/)?.[1] ?? t.code;

export default function GarsonBoardPage() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('calls');
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem('garson_board_sound') !== 'off';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [banner, setBanner] = useState<{ text: string; id: number } | null>(null);
  // Kapalı bölümler (cihazda hatırlanır) ve yeni çağrı gelen, yanıp sönen masalar
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('garson_board_collapsed') || '[]'));
    } catch {
      return new Set<string>();
    }
  });
  const [alerts, setAlerts] = useState<Set<string>>(new Set());
  const known = useRef<Set<number> | null>(null);
  const skew = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const load = useCallback(async () => {
    try {
      const data = await api<Board>('/api/admin/garson/board');
      skew.current = data.now - Date.now();
      setBoard(data);
      setOffline(false);
      // Yeni çağrı: ses, titreşim ve üst bildirim (ilk yüklemede değil)
      const ids = new Set(data.tables.flatMap((t) => t.calls.map((c) => c.id)));
      if (known.current) {
        const fresh = data.tables.flatMap((t) => t.calls.filter((c) => !known.current!.has(c.id) && !c.claim?.mine).map((c) => ({ c, t })));
        if (fresh.length) {
          const { c, t } = fresh[0];
          setBanner({ text: `${t.label} · ${c.label}`, id: c.id });
          // Kapalı bölümde çağrı gelirse bölüm kendiliğinden açılır, masa yanıp söner
          const keys = new Set(fresh.map((f) => f.t.key));
          const groupNames = new Set(fresh.map((f) => f.t.groupName));
          setCollapsed((prev) => {
            if (![...groupNames].some((g) => prev.has(g))) return prev;
            const next = new Set(prev);
            groupNames.forEach((g) => next.delete(g));
            saveCollapsed(next);
            return next;
          });
          setAlerts((prev) => new Set([...prev, ...keys]));
          window.setTimeout(
            () =>
              setAlerts((prev) => {
                const next = new Set(prev);
                keys.forEach((k) => next.delete(k));
                return next;
              }),
            12000,
          );
          if (soundRef.current) playAdminNotificationSound();
          try {
            navigator.vibrate?.([180, 80, 180]);
          } catch {
            /* titreşim desteklenmiyor */
          }
        }
      }
      known.current = ids;
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => !document.hidden && void load(), POLL_MS);
    const clockTick = window.setInterval(() => setTick((n) => n + 1), 15000);
    const wake = () => !document.hidden && void load();
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clockTick);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [load]);

  // Sekme başlığında bekleyen sayısı
  useEffect(() => {
    const n = board?.counts.calls || 0;
    document.title = n ? `(${n}) Garson` : 'Garson';
    return () => applyDocumentTitle();
  }, [board?.counts.calls]);

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(() => setBanner(null), 6000);
    return () => window.clearTimeout(id);
  }, [banner]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const now = Date.now() + skew.current + tick * 0; // tick: süreleri tazelemek için yeniden çizim
  const tables = board?.tables || [];
  const sheet = tables.find((t) => t.key === sheetKey) || null;

  const callTables = useMemo(
    () => tables.filter((t) => t.calls.length).sort((a, b) => a.calls[0].at - b.calls[0].at),
    [tables],
  );

  function toggleGroup(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      saveCollapsed(next);
      return next;
    });
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem('garson_board_sound', next ? 'on' : 'off');
    } catch {
      /* depolama kapalı */
    }
    if (next) playAdminNotificationSound(); // tarayıcıya ses izni vermiş olur
  }

  async function run(key: string, job: () => Promise<void>, ok?: string, flashKey?: string) {
    setBusy((s) => new Set(s).add(key));
    try {
      await job();
      if (ok) setToast(ok);
      if (flashKey) {
        setFlash(flashKey);
        window.setTimeout(() => setFlash((f) => (f === flashKey ? null : f)), 1400);
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      await load();
      setBusy((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  const post = (path: string, body: Record<string, unknown>) =>
    api(`/api/admin/garson/${path}`, { method: 'POST', body: JSON.stringify(body) });

  const claim = (t: BoardTable, force = false) =>
    run(`c${t.key}`, async () => {
      for (const c of t.calls) if (!c.claim?.mine) await post('claim', { requestId: c.id, force });
    }, 'Tamam, sen gidiyorsun');
  const unclaim = (t: BoardTable) =>
    run(`c${t.key}`, async () => {
      for (const c of t.calls) await post('unclaim', { requestId: c.id });
    });
  const resolve = (t: BoardTable) =>
    run(`c${t.key}`, async () => {
      for (const c of t.calls) await post('resolve', { requestId: c.id });
    }, `${t.label} halledildi`, t.key);
  const visit = (t: BoardTable) =>
    run(`v${t.key}`, async () => {
      await post('visit', { group: t.group, table: t.code });
    }, `${t.label}: uğradın, kaydedildi`, t.key);

  const counts = board?.counts;
  const visibleTables = tables.filter((t) =>
    filter === 'all' ? true : filter === 'busy' ? t.state !== 'empty' : filter === 'due' ? t.visit === 'due' || t.visit === 'late' : t.state === 'empty',
  );
  const groups = visibleTables.reduce<{ name: string; tables: BoardTable[] }[]>((acc, t) => {
    const g = acc.find((x) => x.name === t.groupName);
    if (g) g.tables.push(t);
    else acc.push({ name: t.groupName, tables: [t] });
    return acc;
  }, []);

  return (
    <div className="gb" lang="tr">
      <header className="gb-top">
        <button type="button" className="gb-icon" onClick={() => navigate(adminPath())} aria-label="Yönetime dön">
          <ArrowLeft size={20} />
        </button>
        <div className="gb-top__title">
          <strong>
            <ConciergeBell size={18} aria-hidden="true" /> Garson
          </strong>
          <span className={`gb-live${offline ? ' is-off' : ''}`}>
            <i aria-hidden="true" /> {offline ? 'Bağlantı yok' : board ? `${board.me.name} · canlı` : 'Bağlanıyor…'}
          </span>
        </div>
        <button type="button" className={`gb-icon${sound ? ' is-on' : ''}`} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Sesi kapat' : 'Sesi aç'}>
          {sound ? <Bell size={20} /> : <BellOff size={20} />}
        </button>
      </header>

      {offline ? (
        <p className="gb-offline" role="status">
          <WifiOff size={16} aria-hidden="true" /> İnternet gitti. Son görülen durum gösteriliyor, kendiliğinden yeniden deneniyor.
        </p>
      ) : null}

      <div className="gb-stats" role="group" aria-label="Özet">
        <button type="button" className={`gb-stat is-hot${counts?.calls ? ' has' : ''}`} onClick={() => setTab('calls')}>
          <b>{counts?.callTables ?? 0}</b>
          <span>Bekleyen masa</span>
        </button>
        <button
          type="button"
          className={`gb-stat is-warn${counts?.due ? ' has' : ''}`}
          onClick={() => {
            setTab('tables');
            setFilter('due');
          }}
        >
          <b>{counts?.due ?? 0}</b>
          <span>Uğranmalı</span>
        </button>
        <button
          type="button"
          className="gb-stat"
          onClick={() => {
            setTab('tables');
            setFilter('busy');
          }}
        >
          <b>{counts?.busy ?? 0}</b>
          <span>Dolu masa</span>
        </button>
      </div>

      <nav className="gb-tabs" role="tablist" aria-label="Bölümler">
        {(
          [
            ['calls', 'Çağrılar', counts?.callTables],
            ['tables', 'Masalar', 0],
            ['feed', 'Akış', 0],
          ] as [Tab, string, number | undefined][]
        ).map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            {label}
            {n ? <em>{n}</em> : null}
          </button>
        ))}
      </nav>

      {!board ? (
        <div className="gb-empty">
          <span className="gb-spinner" aria-hidden="true" />
          <p>Masalar yükleniyor…</p>
        </div>
      ) : tab === 'calls' ? (
        <main className="gb-list" aria-live="polite">
          {callTables.length === 0 ? (
            <div className="gb-empty">
              <span className="gb-bell" aria-hidden="true">
                <BellRing size={34} />
                <i />
                <i />
              </span>
              <h2>Şu an bekleyen masa yok</h2>
              <p>Yeni bir çağrı gelince burada belirir ve ses çalar. Boş zamanında “Masalar”dan uğranmayı bekleyen masalara bakabilirsin.</p>
              <button type="button" className="gb-btn gb-btn--soft" onClick={() => setTab('tables')}>
                <Users size={18} aria-hidden="true" /> Masalara bak
              </button>
            </div>
          ) : (
            callTables.map((t, i) => (
              <CallCard key={t.key} t={t} now={now} busy={busy.has(`c${t.key}`)} flash={flash === t.key} index={i} onClaim={claim} onUnclaim={unclaim} onResolve={resolve} onOpen={() => setSheetKey(t.key)} />
            ))
          )}
        </main>
      ) : tab === 'tables' ? (
        <main className="gb-tables">
          <div className="gb-chips" role="group" aria-label="Süzgeç">
            {(
              [
                ['all', 'Hepsi'],
                ['busy', 'Dolu'],
                ['due', 'Uğranmalı'],
                ['empty', 'Boş'],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          {!board.hasTables && !tables.length ? (
            <div className="gb-empty">
              <h2>Henüz masa yok</h2>
              <p>Yönetimde “Barkod Yazdır” bölümünden masa grupları oluşturunca burada görünür.</p>
            </div>
          ) : !groups.length ? (
            <div className="gb-empty">
              <h2>Bu süzgeçte masa yok</h2>
              <button type="button" className="gb-btn gb-btn--soft" onClick={() => setFilter('all')}>
                Hepsini göster
              </button>
            </div>
          ) : (
            groups.map((g) => {
              const open = !collapsed.has(g.name);
              const callN = g.tables.filter((t) => t.calls.length).length;
              const busyN = g.tables.filter((t) => t.state !== 'empty').length;
              const dueN = g.tables.filter((t) => t.visit === 'due' || t.visit === 'late').length;
              const alertN = g.tables.filter((t) => alerts.has(t.key)).length;
              return (
              <section key={g.name} className={`gb-group${open ? ' is-open' : ''}${callN ? ' has-call' : ''}${alertN ? ' has-alert' : ''}`}>
                <button type="button" className="gb-group__head" aria-expanded={open} onClick={() => toggleGroup(g.name)}>
                  <span className="gb-group__name">{g.name}</span>
                  <span className="gb-group__meta">
                    {callN ? (
                      <b className="gb-pill is-hot">
                        <BellRing size={13} aria-hidden="true" /> {callN} çağrı
                      </b>
                    ) : null}
                    {dueN ? <b className="gb-pill is-warn">{dueN} uğranmalı</b> : null}
                    <span className="gb-group__count">
                      {busyN}/{g.tables.length} dolu
                    </span>
                  </span>
                  <ChevronDown className="gb-group__chev" size={20} aria-hidden="true" />
                </button>
                <div className="gb-group__body">
                <div className="gb-grid">
                  {g.tables.map((t) => (
                    <button key={t.key} type="button" className={`gb-tile is-${t.state} v-${t.visit}${flash === t.key ? ' is-flash' : ''}${alerts.has(t.key) ? ' is-alert' : ''}`} onClick={() => setSheetKey(t.key)}>
                      <span className="gb-tile__num">{shortName(t)}</span>
                      <span className="gb-tile__icons" aria-hidden="true">
                        {t.calls.length ? <BellRing size={13} /> : null}
                        {t.session?.scanned ? <QrCode size={13} /> : null}
                      </span>
                      <small>
                        {t.state === 'call'
                          ? t.calls[0].label
                          : t.lastVisit
                            ? `${t.lastVisit.mine ? 'Sen' : t.lastVisit.name.split(' ')[0]} · ${ago(now - t.lastVisit.at)}`
                            : t.state === 'empty'
                              ? 'Boş'
                              : t.state === 'reserved'
                                ? 'Rezerve'
                                : 'Uğranmadı'}
                      </small>
                      {t.session ? (
                        <em className="gb-tile__more">{t.session.total > 0 ? money(t.session.total) : t.session.scanned ? 'QR okutuldu' : 'Oturumda'}</em>
                      ) : null}
                      {t.visit === 'due' || t.visit === 'late' ? <i className="gb-tile__dot" aria-label="Uğranmalı" /> : null}
                    </button>
                  ))}
                </div>
                </div>
              </section>
              );
            })
          )}
        </main>
      ) : (
        <main className="gb-feed">
          {board.feed.length === 0 ? (
            <div className="gb-empty">
              <h2>Henüz hareket yok</h2>
              <p>QR okutmalar, çağrılar ve garson hareketleri burada sırayla görünür.</p>
            </div>
          ) : (
            <ol>
              {board.feed.map((f) => {
                const Icon = FEED_ICON[f.kind];
                return (
                  <li key={f.id} className={`k-${f.kind}`}>
                    <span className="gb-feed__icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div>
                      <p>
                        <strong>{f.table}</strong> {f.who ? <>· {f.who} </> : null}
                        {f.text}
                      </p>
                      <small>
                        {clock(f.at)} · {since(now - f.at)}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </main>
      )}

      {banner ? (
        <button
          type="button"
          key={banner.id}
          className="gb-banner"
          onClick={() => {
            setBanner(null);
            setTab('calls');
          }}
        >
          <BellRing size={20} aria-hidden="true" />
          <span>
            <b>Yeni çağrı</b>
            {banner.text}
          </span>
        </button>
      ) : null}
      {toast ? (
        <div className="gb-toast" role="status">
          <Check size={16} aria-hidden="true" /> {toast}
        </div>
      ) : null}

      {sheet ? (
        <AdminOverlay label={`${sheet.label} ayrıntısı`} className="gb-overlay" onClose={() => setSheetKey(null)}>
          <div className="gb-sheet">
            <header>
              <span className="gb-sheet__grip" aria-hidden="true" />
              <div>
                <small>{sheet.groupName}</small>
                <h2>{sheet.label}</h2>
              </div>
              <button type="button" onClick={() => setSheetKey(null)} aria-label="Kapat">
                <X size={22} />
              </button>
            </header>
            <div className="gb-sheet__body">
              <ul className="gb-facts">
                <li>
                  <QrCode size={18} aria-hidden="true" />
                  <span>
                    {sheet.session?.scanned
                      ? `QR okutuldu · ${clock(sheet.session.openedAt)}${sheet.session.codeStatus === 'verified' ? ' · kod girildi ✓' : sheet.session.codeStatus === 'pending' ? ' · kod bekleniyor' : ''}`
                      : sheet.session
                        ? `Masa açıldı · ${clock(sheet.session.openedAt)}`
                        : 'Masa boş'}
                  </span>
                </li>
                {sheet.session && sheet.session.itemCount > 0 ? (
                  <li>
                    <Receipt size={18} aria-hidden="true" />
                    <span>
                      Hesap {money(sheet.session.total)} · {sheet.session.itemCount} ürün
                    </span>
                  </li>
                ) : null}
                {sheet.session?.guestName ? (
                  <li>
                    <Users size={18} aria-hidden="true" />
                    <span>Misafir: {sheet.session.guestName}</span>
                  </li>
                ) : null}
                {sheet.session?.waiterName ? (
                  <li>
                    <ConciergeBell size={18} aria-hidden="true" />
                    <span>Masanın garsonu: {sheet.session.waiterName}</span>
                  </li>
                ) : null}
                <li className={`is-visit v-${sheet.visit}`}>
                  <Clock size={18} aria-hidden="true" />
                  <span>
                    {sheet.lastVisit
                      ? `Son uğrayan: ${sheet.lastVisit.mine ? 'sen' : sheet.lastVisit.name} · ${since(now - sheet.lastVisit.at)}`
                      : sheet.session
                        ? 'Bu masaya henüz uğranmadı'
                        : 'Bugün uğranmadı'}
                  </span>
                </li>
              </ul>

              {sheet.calls.length ? (
                <CallBody t={sheet} now={now} busy={busy.has(`c${sheet.key}`)} onClaim={claim} onUnclaim={unclaim} onResolve={resolve} />
              ) : null}

              <button type="button" className={`gb-btn gb-btn--big${flash === sheet.key ? ' is-done' : ''}`} disabled={busy.has(`v${sheet.key}`)} onClick={() => void visit(sheet)}>
                {flash === sheet.key ? <Check size={22} aria-hidden="true" /> : <Footprints size={22} aria-hidden="true" />}
                {flash === sheet.key ? 'Kaydedildi' : 'Masaya uğradım'}
              </button>
              <p className="gb-sheet__hint">Basınca “kim, ne zaman uğradı” kaydedilir; diğer garsonlar da görür.</p>
            </div>
          </div>
        </AdminOverlay>
      ) : null}
    </div>
  );
}

/** Bekleyen masa kartı (Çağrılar sekmesi). */
function CallCard({
  t,
  now,
  busy,
  flash,
  index,
  onClaim,
  onUnclaim,
  onResolve,
  onOpen,
}: {
  t: BoardTable;
  now: number;
  busy: boolean;
  flash: boolean;
  index: number;
  onClaim: (t: BoardTable, force?: boolean) => void;
  onUnclaim: (t: BoardTable) => void;
  onResolve: (t: BoardTable) => void;
  onOpen: () => void;
}) {
  const wait = now - t.calls[0].at;
  const level = urgency(wait);
  return (
    <article className={`gb-card is-${level}${flash ? ' is-flash' : ''}`} style={{ ['--i' as string]: index }}>
      <button type="button" className="gb-card__head" onClick={onOpen} aria-label={`${t.label} ayrıntısı`}>
        <span className="gb-card__table">
          <small>{t.groupName}</small>
          <strong>{t.label}</strong>
        </span>
        <span className="gb-timer">
          <Clock size={14} aria-hidden="true" /> {ago(wait)}
        </span>
      </button>
      <CallBody t={t} now={now} busy={busy} onClaim={onClaim} onUnclaim={onUnclaim} onResolve={onResolve} />
      <p className="gb-card__visit">
        <Footprints size={14} aria-hidden="true" />
        {t.lastVisit ? `Son uğrayan: ${t.lastVisit.mine ? 'sen' : t.lastVisit.name} · ${since(now - t.lastVisit.at)}` : 'Bu masaya henüz uğranmadı'}
      </p>
    </article>
  );
}

/** Çağrı içeriği + büyük düğmeler (kart ve ayrıntı penceresinde ortak). */
function CallBody({
  t,
  now,
  busy,
  onClaim,
  onUnclaim,
  onResolve,
}: {
  t: BoardTable;
  now: number;
  busy: boolean;
  onClaim: (t: BoardTable, force?: boolean) => void;
  onUnclaim: (t: BoardTable) => void;
  onResolve: (t: BoardTable) => void;
}) {
  const claim = t.calls.find((c) => c.claim)?.claim || null;
  const mine = Boolean(claim?.mine);
  return (
    <>
      <ul className="gb-calls">
        {t.calls.map((c: BoardCall) => {
          const Icon = CALL_ICON[c.type];
          return (
            <li key={c.id}>
              <span className="gb-calls__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div>
                <strong>{c.label}</strong>
                {c.items.length ? (
                  <div className="gb-items">
                    {c.items.map((i, k) => (
                      <span key={k}>
                        <b>{i.qty}×</b> {i.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                {c.note ? <p className="gb-note">“{c.note}”</p> : null}
              </div>
              <time>{ago(now - c.at)}</time>
            </li>
          );
        })}
      </ul>

      {claim && !mine ? (
        <div className="gb-claimed">
          <span>
            <Footprints size={16} aria-hidden="true" /> <b>{claim.name}</b> gidiyor · {since(now - claim.at)}
          </span>
          <button type="button" className="gb-link" disabled={busy} onClick={() => onClaim(t, true)}>
            Yine de ben gideyim
          </button>
        </div>
      ) : mine ? (
        <div className="gb-actions">
          <button type="button" className="gb-btn gb-btn--ok" disabled={busy} onClick={() => onResolve(t)}>
            <Check size={22} aria-hidden="true" /> Hallettim
          </button>
          <button type="button" className="gb-link" disabled={busy} onClick={() => onUnclaim(t)}>
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="gb-actions">
          <button type="button" className="gb-btn" disabled={busy} onClick={() => onClaim(t)}>
            <Footprints size={22} aria-hidden="true" /> Ben gidiyorum
          </button>
        </div>
      )}
    </>
  );
}
