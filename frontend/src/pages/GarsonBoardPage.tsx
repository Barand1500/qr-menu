import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
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
  LayoutGrid,
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
  verified: Check,
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
  const [banner, setBanner] = useState<{ text: string; id: number; tableKey?: string } | null>(null);
  // Kapalı bölümler (cihazda hatırlanır) ve yeni çağrı gelen, yanıp sönen masalar
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('garson_board_collapsed') || '[]'));
    } catch {
      return new Set<string>();
    }
  });
  const [alerts, setAlerts] = useState<Set<string>>(new Set());
  const codeWatch = useRef(new Map<number, { pending: boolean; mine: boolean }>());
  const loadSequence = useRef(0);
  const known = useRef<Set<number> | null>(null);
  const skew = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const data = await api<Board>('/api/admin/garson/board');
      if (sequence !== loadSequence.current) return;
      const verified = data.codeGateEnabled ? data.tables.filter((t) => {
        const session = t.session;
        const previous = session && codeWatch.current.get(session.id);
        return session?.codeStatus === 'verified' && session.handoff?.mine && previous?.mine && previous.pending;
      }) : [];
      codeWatch.current = new Map(data.tables.filter((t) => t.session).map((t) => [t.session!.id, {
        pending: t.session!.codeStatus !== 'verified', mine: Boolean(t.session!.handoff?.mine),
      }]));
      if (verified.length) {
        const table = verified[0];
        setBanner({ text: verified.length > 1 ? `${verified.length} masada müşteri doğrulandı` : `${table.label} · masa kodu doğrulandı`, id: -table.session!.id, tableKey: table.key });
        if (soundRef.current) playAdminNotificationSound();
        try { navigator.vibrate?.([100, 60, 100]); } catch { /* desteklenmiyor */ }
      }
      skew.current = data.now - Date.now();
      setBoard(data);
      setOffline(false);
      // Yeni çağrı: ses, titreşim ve üst bildirim (ilk yüklemede değil)
      const ids = new Set(data.tables.flatMap((t) => t.calls.map((c) => c.id)));
      if (known.current) {
        const fresh = data.tables.flatMap((t) => t.calls.filter((c) => !known.current!.has(c.id) && !c.claim?.mine).map((c) => ({ c, t })));
        if (fresh.length) {
          const { c, t } = fresh[0];
          if (!verified.length) setBanner({ text: `${t.label} · ${c.label}`, id: c.id });
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
      if (sequence !== loadSequence.current) return;
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
    }, board?.codeGateEnabled && t.session && t.session.codeStatus !== 'verified' ? undefined : `${t.label}: uğradın, kaydedildi`, t.key);

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


  const wide = useWide();
  const filterCounts: Record<Filter, number> = {
    all: tables.length,
    busy: tables.filter((t) => t.state !== 'empty').length,
    due: tables.filter((t) => t.visit === 'due' || t.visit === 'late').length,
    empty: tables.filter((t) => t.state === 'empty').length,
  };
  const FILTERS: [Filter, string][] = [
    ['all', 'Hepsi'],
    ['busy', 'Dolu'],
    ['due', 'Uğranmalı'],
    ['empty', 'Boş'],
  ];

  // Geniş ekranda ayrıntı sağ panelde açılır; Escape ile kapanır
  useEffect(() => {
    if (!wide || !sheetKey) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetKey(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, sheetKey]);

  const hasCalls = (counts?.callTables ?? 0) > 0;

  /* ---------- ortak parçalar ---------- */

  const status = (
    <div className={`gb-status${hasCalls ? ' is-hot' : ' is-calm'}`} role="status">
      <span className="gb-radar" aria-hidden="true">
        <i />
        <b>{hasCalls ? counts?.callTables : <Check size={26} />}</b>
      </span>
      <span className="gb-status__text">
        <strong>{hasCalls ? `${counts?.callTables} masa bekliyor` : 'Her şey yolunda'}</strong>
        <small>
          {hasCalls
            ? `${counts?.calls} istek · en uzun ${ago(now - Math.min(...callTables.map((t) => t.calls[0].at)))}`
            : 'Bekleyen çağrı yok'}
        </small>
      </span>
    </div>
  );

  const queue = !board ? null : callTables.length === 0 ? (
    <div className="gb-empty">
      <span className="gb-bell" aria-hidden="true">
        <BellRing size={30} />
        <i />
        <i />
      </span>
      <h2>Bekleyen masa yok</h2>
      <p>Yeni çağrı gelince burada belirir ve ses çalar.</p>
    </div>
  ) : (
    <div className="gb-list" aria-live="polite">
      {callTables.map((t, i) => (
        <CallCard key={t.key} t={t} now={now} busy={busy.has(`c${t.key}`)} flash={flash === t.key} index={i} onClaim={claim} onUnclaim={unclaim} onResolve={resolve} onOpen={() => setSheetKey(t.key)} />
      ))}
    </div>
  );

  const feed = !board ? null : board.feed.length === 0 ? (
    <div className="gb-empty">
      <h2>Henüz hareket yok</h2>
      <p>QR okutmalar, çağrılar ve garson hareketleri burada sırayla görünür.</p>
    </div>
  ) : (
    <ol className="gb-feed">
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
  );

  const floor = !board ? null : !board.hasTables && !tables.length ? (
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
    <div className="gb-floor">
      {groups.map((g) => {
        const open = !collapsed.has(g.name);
        const callN = g.tables.filter((t) => t.calls.length).length;
        const busyN = g.tables.filter((t) => t.state !== 'empty').length;
        const dueN = g.tables.filter((t) => t.visit === 'due' || t.visit === 'late').length;
        const alertN = g.tables.filter((t) => alerts.has(t.key)).length;
        return (
          <section key={g.name} className={`gb-zone${open ? ' is-open' : ''}${callN ? ' has-call' : ''}${alertN ? ' has-alert' : ''}`}>
            <button type="button" className="gb-zone__head" aria-expanded={open} onClick={() => toggleGroup(g.name)}>
              <span className="gb-zone__name">{g.name}</span>
              <span className="gb-zone__meta">
                {callN ? (
                  <b className="gb-pill is-hot">
                    <BellRing size={13} aria-hidden="true" /> {callN}
                  </b>
                ) : null}
                {dueN ? <b className="gb-pill is-warn">{dueN} uğranmalı</b> : null}
                <span className="gb-zone__count">
                  {busyN}/{g.tables.length}
                </span>
              </span>
              <ChevronDown className="gb-zone__chev" size={20} aria-hidden="true" />
            </button>
            <div className="gb-zone__body">
              <div className="gb-discs">
                {g.tables.map((t) => {
                  const num = shortName(t);
                  const cap =
                    t.state === 'call'
                      ? t.calls[0].label
                      : t.lastVisit
                        ? `${t.lastVisit.mine ? 'Sen' : t.lastVisit.name.split(' ')[0]} · ${ago(now - t.lastVisit.at)}`
                        : t.state === 'empty'
                          ? 'Boş'
                          : t.state === 'reserved'
                            ? 'Rezerve'
                            : 'Uğranmadı';
                  const more = t.session ? (t.session.total > 0 ? money(t.session.total) : t.session.codeStatus === 'verified' ? 'Müşteri onaylandı' : t.session.handoff ? 'Kod bekleniyor' : t.session.scanned ? 'QR okutuldu' : 'Oturumda') : '';
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-label={`${t.label}, ${cap}`}
                      className={`gb-disc is-${t.state} v-${t.visit}${flash === t.key ? ' is-flash' : ''}${alerts.has(t.key) ? ' is-alert' : ''}${sheetKey === t.key ? ' is-picked' : ''}`}
                      onClick={() => setSheetKey(t.key)}
                    >
                      <span className={`gb-disc__ring${num.length > 3 ? ' is-long' : ''}`}>
                        <b>{num}</b>
                        {t.calls.length ? (
                          <i className="gb-disc__badge is-bell">
                            <BellRing size={12} aria-hidden="true" />
                          </i>
                        ) : t.session?.scanned ? (
                          <i className={`gb-disc__badge${t.session.codeStatus === 'verified' ? ' is-verified' : ''}`} title={t.session.codeStatus === 'verified' ? 'Müşteri onaylandı' : 'QR okutuldu'}>
                            {t.session.codeStatus === 'verified' ? <Check size={12} aria-hidden="true" /> : <QrCode size={12} aria-hidden="true" />}
                          </i>
                        ) : null}
                        {t.visit === 'due' || t.visit === 'late' ? <i className="gb-disc__dot" aria-hidden="true" /> : null}
                      </span>
                      <small>{cap}</small>
                      {more ? <em>{more}</em> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );

  const detailBody = (s: BoardTable) => (
    <>
      <ul className="gb-facts">
        <li>
          <QrCode size={18} aria-hidden="true" />
          <span>
            {s.session?.scanned
              ? `QR okutuldu · ${clock(s.session.openedAt)}${s.session.codeStatus === 'verified' ? ' · kod onaylandı ✓' : s.session.codeStatus === 'pending' ? ' · kod bekleniyor' : ''}`
              : s.session
                ? `Masa açıldı · ${clock(s.session.openedAt)}`
                : 'Masa boş'}
          </span>
        </li>
        {s.session && s.session.itemCount > 0 ? (
          <li>
            <Receipt size={18} aria-hidden="true" />
            <span>
              Hesap {money(s.session.total)} · {s.session.itemCount} ürün
            </span>
          </li>
        ) : null}
        {s.session?.guestName ? (
          <li>
            <Users size={18} aria-hidden="true" />
            <span>Misafir: {s.session.guestName}</span>
          </li>
        ) : null}
        {s.session?.waiterName ? (
          <li>
            <ConciergeBell size={18} aria-hidden="true" />
            <span>Masanın garsonu: {s.session.waiterName}</span>
          </li>
        ) : null}
        <li className={`is-visit v-${s.visit}`}>
          <Clock size={18} aria-hidden="true" />
          <span>
            {s.lastVisit
              ? `Son uğrayan: ${s.lastVisit.mine ? 'sen' : s.lastVisit.name} · ${since(now - s.lastVisit.at)}`
              : s.session
                ? 'Bu masaya henüz uğranmadı'
                : 'Bugün uğranmadı'}
          </span>
        </li>
      </ul>
      {s.calls.length ? <CallBody t={s} now={now} busy={busy.has(`c${s.key}`)} onClaim={claim} onUnclaim={unclaim} onResolve={resolve} /> : null}
      {board?.codeGateEnabled && s.session?.codeStatus === 'verified' ? (
        <p className="gb-code-verified" role="status"><Check size={18} aria-hidden="true" /> Müşteri onaylandı{s.session.codeVerifiedAt ? ' · ' + clock(s.session.codeVerifiedAt) : ''}</p>
      ) : null}
      {board?.codeGateEnabled && s.session && s.session.codeStatus !== 'verified' && s.session.handoff ? (
        <div className="gb-access-code" aria-label="Masa erişim kodu">
          <div className="gb-access-code__head"><QrCode size={20} aria-hidden="true" /><span>{s.session.handoff.mine ? 'Müşterinin masa kodu' : 'Kod teslim ediliyor'}</span></div>
          {s.session.handoff.mine ? (
            s.session.code ? <>
              <strong className="gb-access-code__digits" aria-label={'Kod: ' + s.session.code.split('').join(' ')}>{s.session.code.slice(0, 3)}<span aria-hidden="true"> </span>{s.session.code.slice(3)}</strong>
              <p>Lütfen bu kodu müşteriye iletin.</p>
              <small>Müşteri kendi ekranına girdiğinde burada onayını göreceksiniz.</small>
              <div className="gb-access-code__waiting" role="status"><Clock size={15} aria-hidden="true" /> Kodun girilmesi bekleniyor</div>
            </> : <>
              <p>Kodun süresi doldu.</p>
              <small>Müşteriye iletmeden önce yeni bir kod alın.</small>
              <button type="button" className="gb-btn gb-btn--big" disabled={busy.has('v' + s.key)} onClick={() => void visit(s)}>Kodu yenile</button>
            </>
          ) : <><p>{s.session.handoff.name} kodu müşteriye iletiyor.</p><small>Müşteri kodu girdiğinde bu alan kendiliğinden güncellenir.</small></>}
        </div>
      ) : <>
        <button type="button" className={`gb-btn gb-btn--big${flash === s.key ? ' is-done' : ''}`} disabled={busy.has('v' + s.key)} onClick={() => void visit(s)}>
          {flash === s.key ? <Check size={22} aria-hidden="true" /> : <Footprints size={22} aria-hidden="true" />}
          {flash === s.key ? 'Kaydedildi' : 'Masaya uğradım'}
        </button>
        <p className="gb-sheet__hint">{board?.codeGateEnabled && s.session && s.session.codeStatus !== 'verified' ? 'Uğradığınızı işaretleyin; müşteriye vereceğiniz kod burada görünsün.' : 'Basınca “kim, ne zaman uğradı” kaydedilir; diğer garsonlar da görür.'}</p>
      </>}
    </>
  );

  const overlays = (
    <>
      {banner ? (
        <button
          type="button"
          key={banner.id}
          className={`gb-banner${banner.tableKey ? ' is-verified' : ''}`}
          aria-live="polite"
          onClick={() => {
            setBanner(null);
            setTab(banner.tableKey ? 'tables' : 'calls');
            if (banner.tableKey) setSheetKey(banner.tableKey);
            else if (wide) setSheetKey(null);
          }}
        >
          {banner.tableKey ? <Check size={20} aria-hidden="true" /> : <BellRing size={20} aria-hidden="true" />}
          <span>
            <b>{banner.tableKey ? 'Müşteri onaylandı' : 'Yeni çağrı'}</b>
            {banner.text}
          </span>
        </button>
      ) : null}
      {toast ? (
        <div className="gb-toast" role="status">
          <Check size={16} aria-hidden="true" /> {toast}
        </div>
      ) : null}
    </>
  );

  const offlineNote = offline ? (
    <p className="gb-offline" role="status">
      <WifiOff size={16} aria-hidden="true" /> İnternet gitti. Son görülen durum gösteriliyor, kendiliğinden yeniden deneniyor.
    </p>
  ) : null;

  const loading = (
    <div className="gb-empty">
      <span className="gb-spinner" aria-hidden="true" />
      <p>Masalar yükleniyor…</p>
    </div>
  );

  const soundBtn = (
    <button type="button" className={`gb-icon${sound ? ' is-on' : ''}`} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Sesi kapat' : 'Sesi aç'}>
      {sound ? <Bell size={20} /> : <BellOff size={20} />}
    </button>
  );
  const backBtn = (
    <button type="button" className="gb-icon" onClick={() => navigate(adminPath())} aria-label="Yönetime dön">
      <ArrowLeft size={20} />
    </button>
  );
  const liveText = offline ? 'Bağlantı yok' : board ? `${board.me.name} · canlı` : 'Bağlanıyor…';

  /* ---------- GENİŞ EKRAN: komuta merkezi ---------- */
  if (wide) {
    return (
      <div className="gb gb--w" lang="tr">
        <aside className="gb-rail">
          <div className="gb-rail__top">
            {backBtn}
            <div className="gb-brand">
              <strong>
                <ConciergeBell size={20} aria-hidden="true" /> Garson
              </strong>
              <span className={`gb-live${offline ? ' is-off' : ''}`}>
                <i aria-hidden="true" /> {liveText}
              </span>
            </div>
            {soundBtn}
          </div>
          {status}
          <div className="gb-rail__stats">
            <div>
              <b>{counts?.busy ?? 0}</b>
              <span>Dolu masa</span>
            </div>
            <div className={counts?.due ? 'is-warn' : ''}>
              <b>{counts?.due ?? 0}</b>
              <span>Uğranmalı</span>
            </div>
          </div>
          <nav className="gb-rail__filters" aria-label="Süzgeç">
            <h3>Masaları göster</h3>
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
                <span>{label}</span>
                <em>{filterCounts[id]}</em>
              </button>
            ))}
          </nav>
          {board?.restaurant ? <p className="gb-rail__foot">{board.restaurant}</p> : null}
        </aside>

        <main className="gb-center">
          <header className="gb-center__head">
            <h1>Salon planı</h1>
            <button
              type="button"
              className="gb-link"
              onClick={() => {
                const names = groups.map((g) => g.name);
                const allClosed = names.every((n) => collapsed.has(n));
                const next = new Set(collapsed);
                names.forEach((n) => (allClosed ? next.delete(n) : next.add(n)));
                setCollapsed(next);
                saveCollapsed(next);
              }}
            >
              {groups.length && groups.every((g) => collapsed.has(g.name)) ? 'Hepsini aç' : 'Hepsini kapat'}
            </button>
          </header>
          {offlineNote}
          {!board ? loading : floor}
        </main>

        <aside className="gb-side">
          {sheet ? (
            <section className="gb-detail" aria-label={`${sheet.label} ayrıntısı`}>
              <header>
                <div>
                  <small>{sheet.groupName}</small>
                  <h2>{sheet.label}</h2>
                </div>
                <button type="button" onClick={() => setSheetKey(null)} aria-label="Kapat">
                  <X size={22} />
                </button>
              </header>
              <div className="gb-sheet__body">{detailBody(sheet)}</div>
            </section>
          ) : (
            <>
              <h2 className="gb-side__title">
                Çağrılar {hasCalls ? <em>{counts?.callTables}</em> : null}
              </h2>
              {!board ? loading : queue}
              <h2 className="gb-side__title">Akış</h2>
              {feed}
            </>
          )}
        </aside>
        {overlays}
      </div>
    );
  }

  /* ---------- TELEFON: cep radarı ---------- */
  return (
    <div className="gb gb--m" lang="tr">
      <header className="gb-top">
        {backBtn}
        <div className="gb-brand">
          <strong>
            <ConciergeBell size={18} aria-hidden="true" /> Garson
          </strong>
          <span className={`gb-live${offline ? ' is-off' : ''}`}>
            <i aria-hidden="true" /> {liveText}
          </span>
        </div>
        {soundBtn}
      </header>
      {offlineNote}
      <div className="gb-m-hero">
        {status}
        <div className="gb-m-chips">
          <button
            type="button"
            className={counts?.due ? 'is-warn' : ''}
            onClick={() => {
              setTab('tables');
              setFilter('due');
            }}
          >
            <b>{counts?.due ?? 0}</b> uğranmalı
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('tables');
              setFilter('busy');
            }}
          >
            <b>{counts?.busy ?? 0}</b> dolu masa
          </button>
        </div>
      </div>

      {!board ? (
        loading
      ) : tab === 'calls' ? (
        <main className="gb-m-main">{queue}</main>
      ) : tab === 'tables' ? (
        <main className="gb-m-main">
          <div className="gb-chips" role="group" aria-label="Süzgeç">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
                {label} <em>{filterCounts[id]}</em>
              </button>
            ))}
          </div>
          {floor}
        </main>
      ) : (
        <main className="gb-m-main">{feed}</main>
      )}

      <nav className="gb-dock" role="tablist" aria-label="Bölümler">
        {(
          [
            ['calls', 'Çağrılar', BellRing, counts?.callTables],
            ['tables', 'Masalar', LayoutGrid, 0],
            ['feed', 'Akış', Activity, 0],
          ] as [Tab, string, typeof Bell, number | undefined][]
        ).map(([id, label, Icon, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            <span className="gb-dock__icon">
              <Icon size={22} aria-hidden="true" />
              {n ? <em>{n}</em> : null}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {!sheet && overlays}

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
            <div className="gb-sheet__body">{detailBody(sheet)}</div>
          </div>
          {overlays}
        </AdminOverlay>
      ) : null}
    </div>
  );
}

function useWide() {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Bekleyen masa kartı. */
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
  const num = shortName(t);
  return (
    <article className={`gb-card is-${level}${flash ? ' is-flash' : ''}`} style={{ ['--i' as string]: index }}>
      <button type="button" className="gb-card__head" onClick={onOpen} aria-label={`${t.label} ayrıntısı`}>
        <span className={`gb-card__num${num.length > 3 ? ' is-long' : ''}`}>{num}</span>
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
