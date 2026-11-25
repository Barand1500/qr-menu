import { useCallback, type ComponentType, type CSSProperties, type PointerEvent as RPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  CarFront,
  Check,
  ChevronDown,
  Clock,
  ConciergeBell,
  HandHelping,
  Eye,
  Footprints,
  LayoutGrid,
  QrCode,
  Power,
  Receipt,
  ReceiptText,
  ShieldAlert,
  ShoppingBag,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import HookahIcon from '@/components/public/HookahIcon';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { applyDocumentTitle } from '@/lib/siteTitle';
import { playAdminNotificationSound } from '@/lib/notificationSound';
import { parseVibration, vibrate } from '@/lib/garsonVibration';
import { allergenLabel, dietLabel } from '@/lib/dietAllergens';
import { activityText, ago, clock, since, money, urgency, type Board, type BoardCall, type BoardTable, type CallType, type FeedKind } from '@/lib/garsonBoard';
import '@/garson-board.css';

const POLL_MS = 4000;
const FEED_SHORT = 8;
type Tab = 'calls' | 'tables' | 'feed';
type Filter = 'all' | 'busy' | 'due' | 'empty';

type IconType = ComponentType<{ size?: number }>;
const TYPE_COLOR: Record<CallType, string> = { waiter: '#f97316', bill: '#22c55e', hookah: '#a855f7', valet: '#3b82f6', order: '#eab308' };
// Menüdeki servis düğmeleriyle aynı simgeler
const CALL_ICON: Record<CallType, IconType> = { waiter: HandHelping, bill: ReceiptText, hookah: HookahIcon, valet: CarFront, order: ShoppingBag };
const FEED_ICON: Record<FeedKind, IconType> = {
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

type OrderRow = NonNullable<BoardTable['session']>['orders'][number];
/** Aynı dakikada eklenen kalemler tek sipariş sayılır; en yeni üstte. */
function groupOrders(rows: OrderRow[]) {
  const groups: { at: number; rows: OrderRow[] }[] = [];
  for (const o of rows) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(o.at - last.at) < 60_000) last.rows.push(o);
    else groups.push({ at: o.at, rows: [o] });
  }
  return groups.reverse();
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
  const [feedAll, setFeedAll] = useState(false);
  const [closeAsk, setCloseAsk] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [banner, setBanner] = useState<{ text: string; id: number; tableKey?: string; kind?: 'visit'; callType?: CallType } | null>(null);
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
  const dueSeen = useRef<Map<string, number> | null>(null);
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
          if (!verified.length) setBanner({ text: `${t.label} · ${c.label}`, id: c.id, callType: c.type });
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
            vibrate(parseVibration(data.vibration)[c.type]);
          } catch {
            /* titreşim desteklenmiyor */
          }
        }
      }
      // Uğrama hatırlatması: dolu masa "uğranmalı" (1) ya da "çok bekledi" (2) seviyesine yeni geçtiyse haber ver
      const dueNow = new Map(data.tables.filter((t) => t.visit === 'due' || t.visit === 'late').map((t) => [t.key, t.visit === 'late' ? 2 : 1]));
      if (dueSeen.current && known.current) {
        const prev = dueSeen.current;
        const fresher = data.tables.filter((t) => dueNow.has(t.key) && (dueNow.get(t.key) || 0) > (prev.get(t.key) || 0));
        const calls = data.tables.some((t) => t.calls.some((c) => !known.current!.has(c.id) && !c.claim?.mine));
        if (fresher.length && !calls && !verified.length) {
          const t = fresher[0];
          setBanner({
            text: fresher.length > 1 ? `${fresher.length} masaya uğranmalı` : `${t.label} · uğrama zamanı`,
            id: -Math.abs(Date.now() % 1_000_000_000) - 1,
            tableKey: t.key,
            kind: 'visit',
          });
          if (soundRef.current) playAdminNotificationSound();
          try { navigator.vibrate?.([120]); } catch { /* desteklenmiyor */ }
        }
      }
      dueSeen.current = dueNow;
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

  // Panel açıkken telefon ekranı kararmasın (destekleyen tarayıcılarda)
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    let lock: Lock | null = null;
    let dead = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
    const ask = () => {
      if (dead || document.hidden || !nav.wakeLock) return;
      nav.wakeLock.request('screen').then((l) => {
        if (dead) void l.release();
        else lock = l;
      }).catch(() => undefined);
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release().catch(() => undefined);
    };
  }, []);

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
    () => {
      // Önce yolda olduğum, sonra kimsenin almadığı, en sonda başkasının gittiği çağrılar; her grupta en uzun bekleyen önde
      const rank = (t: BoardTable) => {
        const claim = t.calls.find((c) => c.claim)?.claim;
        return claim ? (claim.mine ? 0 : 2) : 1;
      };
      return tables.filter((t) => t.calls.length).sort((a, b) => rank(a) - rank(b) || a.calls[0].at - b.calls[0].at);
    },
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

  const closeTable = (t: BoardTable) => {
    if (!t.session) return;
    if (closeAsk !== t.key) {
      setCloseAsk(t.key);
      window.setTimeout(() => setCloseAsk((k) => (k === t.key ? null : k)), 5000);
      return;
    }
    setCloseAsk(null);
    void run(`x${t.key}`, async () => {
      await post('close', { sessionId: t.session!.id, force: true });
      setSheetKey(null);
    }, `${t.label} kapatıldı`);
  };

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
      {callTables.map((t, i) => {
        const cl = t.calls.find((c) => c.claim)?.claim;
        const next = i === 0 && (!cl || cl.mine) ? (cl?.mine ? 'mine' : 'next') : undefined;
        return <CallCard key={t.key} t={t} now={now} busy={busy.has(`c${t.key}`)} flash={flash === t.key} index={i} next={next} onClaim={claim} onUnclaim={unclaim} onResolve={resolve} onOpen={() => setSheetKey(t.key)} />;
      })}
    </div>
  );

  const feed = !board ? null : board.feed.length === 0 ? (
    <div className="gb-empty">
      <h2>Henüz hareket yok</h2>
      <p>QR okutmalar, çağrılar ve garson hareketleri burada sırayla görünür.</p>
    </div>
  ) : (
    <div className={`gb-feedbox${feedAll ? ' is-all' : ''}`}>
    <ol className="gb-feed">
      {(feedAll ? board.feed : board.feed.slice(0, FEED_SHORT)).map((f) => {
        const Icon = FEED_ICON[f.kind];
        return (
          <li key={f.id} className={`k-${f.kind}${f.kind in CALL_ICON ? ` t-${f.kind}` : ''}`}>
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
    {board.feed.length > FEED_SHORT ? (
      <button type="button" className="gb-link gb-feedbox__more" onClick={() => setFeedAll((v) => !v)}>
        {feedAll ? 'Daha az göster' : `Tümünü göster (${board.feed.length})`}
      </button>
    ) : null}
    </div>
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
              <span className="gb-zone__bar" aria-hidden="true">
                <i style={{ width: `${g.tables.length ? Math.round((busyN / g.tables.length) * 100) : 0}%` }} />
              </span>
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
                  const newest = t.calls[t.calls.length - 1];
                  const types = [...new Set(t.calls.map((c) => c.type))];
                  const ringStyle = types.length > 1
                    ? ({ ['--cg' as string]: `conic-gradient(from -90deg, ${types.map((ty, i) => `${TYPE_COLOR[ty]} ${(i * 100) / types.length}% ${((i + 1) * 100) / types.length}%`).join(', ')})` } as CSSProperties)
                    : undefined;
                  const overdue = t.visit === 'due' || t.visit === 'late';
                  const live = activityText(t.session?.activity);
                  const hasAllergy = Boolean(t.session?.prefs?.some((p) => p.startsWith('a:')));
                  // Uğrama yayı: ayardaki süreye göre ne kadar zamanı kaldı (yüzde)
                  const dueMs = (board?.visitMinutes || 0) * 60_000;
                  const arcPct = t.session && dueMs > 0 && !overdue && t.state !== 'call'
                    ? Math.max(0, Math.min(100, Math.round((1 - (now - Math.max(t.lastVisit?.at || 0, t.session.openedAt)) / dueMs) * 100)))
                    : null;
                  const cap =
                    t.state === 'call'
                      ? `${newest.label}${t.calls.length > 1 ? ` +${t.calls.length - 1}` : ''}`
                      : overdue
                        ? 'Uğranmalı'
                        : live
                        ? live
                        : t.lastVisit
                        ? `${t.lastVisit.mine ? 'Sen' : t.lastVisit.name.split(' ')[0]} · ${ago(now - t.lastVisit.at)}`
                        : t.state === 'empty'
                          ? 'Boş'
                          : t.state === 'reserved'
                            ? 'Rezerve'
                            : 'Uğranmadı';
                  const more = t.session ? (t.session.total > 0 ? money(t.session.total) : t.session.codeStatus === 'verified' ? 'Müşteri onaylandı' : t.session.handoff ? 'Kod bekleniyor' : t.session.scanned ? 'QR okutuldu' : 'Oturumda') : '';
                  return (
                    <div key={t.key} className="gb-slot">
                    <button
                      type="button"
                      aria-label={`${t.label}, ${cap}`}
                      className={`gb-disc is-${t.state}${t.calls.length ? ` t-${newest.type}${types.length > 1 ? ' has-multi' : ''}` : ''} v-${t.visit}${flash === t.key ? ' is-flash' : ''}${alerts.has(t.key) ? ' is-alert' : ''}${sheetKey === t.key ? ' is-picked' : ''}`}
                      onClick={() => setSheetKey(t.key)}
                    >
                      <span className={`gb-disc__ring${num.length > 3 ? ' is-long' : ''}`} style={ringStyle}>
                        <b>{num}</b>
                        {t.calls.length ? (
                          <i className={`gb-disc__badge is-bell t-${newest.type}`}>
                            {(() => {
                              const CallIcon = CALL_ICON[newest.type];
                              return <CallIcon size={12} />;
                            })()}
                          </i>
                        ) : t.session?.scanned ? (
                          <i className={`gb-disc__badge${t.session.codeStatus === 'verified' ? ' is-verified' : ''}`} title={t.session.codeStatus === 'verified' ? 'Müşteri onaylandı' : 'QR okutuldu'}>
                            {t.session.codeStatus === 'verified' ? <Check size={12} aria-hidden="true" /> : <QrCode size={12} aria-hidden="true" />}
                          </i>
                        ) : null}
                        {hasAllergy ? (
                          <i className="gb-disc__badge is-allergy" title="Alerji bildirdi">
                            <ShieldAlert size={12} aria-hidden="true" />
                          </i>
                        ) : null}
                        {arcPct != null ? (
                          <svg className={`gb-disc__arc${arcPct < 35 ? ' is-low' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
                            <circle className="gb-disc__arc-bg" cx="50" cy="50" r="47" />
                            <circle className="gb-disc__arc-fg" cx="50" cy="50" r="47" pathLength="100" strokeDasharray={`${arcPct} 100`} />
                          </svg>
                        ) : null}
                      </span>
                      <small className={!overdue && t.state !== 'call' && live ? 'is-live' : ''}>{cap}</small>
                      {more ? <em>{more}</em> : null}
                    </button>
                    {overdue && t.state !== 'call' ? (
                      <button
                        type="button"
                        className="gb-disc__quick"
                        title="Uğradım"
                        aria-label={`${t.label}: uğradım olarak işaretle`}
                        disabled={busy.has(`v${t.key}`)}
                        onClick={() => void visit(t)}
                      >
                        <Clock size={14} aria-hidden="true" className="q-clock" />
                        <Check size={15} aria-hidden="true" className="q-check" />
                      </button>
                    ) : null}
                    </div>
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
        {s.session?.prefs?.length ? (
          <li className="is-prefs">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>
              <b>Alerji / diyet</b>
              <span className="gb-prefs">
                {s.session.prefs.map((p) => (
                  <i key={p} className={p.startsWith('a:') ? 'is-allergen' : ''}>
                    {p.startsWith('a:') ? allergenLabel(p.slice(2), 'tr') : dietLabel(p.slice(2), 'tr')}
                  </i>
                ))}
              </span>
            </span>
          </li>
        ) : null}
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
        {activityText(s.session?.activity) ? (
          <li className="is-live">
            <Eye size={18} aria-hidden="true" />
            <span>Şu an: {activityText(s.session?.activity)}</span>
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
      {s.session && s.session.orders.length ? (
        <details className="gb-orders">
          <summary>
            <ReceiptText size={18} aria-hidden="true" />
            <span>Sipariş geçmişi</span>
            <em>
              {s.session.orders.length} kalem · {money(s.session.total)}
            </em>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <ol>
            {groupOrders(s.session.orders).map((g, i) => (
              <li key={i}>
                <time>
                  {g.at ? clock(g.at) : '—'}
                  {g.at ? ` · ${since(now - g.at)}` : ''}
                </time>
                <ul>
                  {g.rows.map((o, k) => (
                    <li key={k} className={o.paid ? 'is-paid' : ''}>
                      <span>
                        <b>{o.qty}×</b> {o.name}
                        {o.variant ? <VariantTags text={o.variant} /> : null}
                        {o.note ? <small>{o.note}</small> : null}
                      </span>
                      <em>
                        {o.paid ? <Check size={13} aria-label="Ödendi" /> : null} {money(o.line)}
                      </em>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
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
        {board?.codeGateEnabled && s.session && s.session.codeStatus !== 'verified' ? <p className="gb-sheet__hint">Uğradığınızı işaretleyin; müşteriye vereceğiniz kod burada görünsün.</p> : null}
      </>}
      {s.session ? (
        <button type="button" className={`gb-close${closeAsk === s.key ? ' is-ask' : ''}`} disabled={busy.has(`x${s.key}`)} onClick={() => closeTable(s)}>
          <Power size={18} aria-hidden="true" /> {closeAsk === s.key ? (s.session.total > 0 ? `Hesap ${money(s.session.total)} ödenmemiş olabilir. Yine de kapat` : 'Emin misin? Tekrar dokun') : 'Masayı kapat'}
        </button>
      ) : null}
    </>
  );

  const overlays = (
    <>
      {banner ? (
        <button
          type="button"
          key={banner.id}
          className={`gb-banner${banner.kind === 'visit' ? ' is-visit' : banner.tableKey ? ' is-verified' : banner.callType ? ` is-call t-${banner.callType}` : ''}`}
          aria-live="polite"
          onClick={() => {
            setBanner(null);
            setTab(banner.tableKey ? 'tables' : 'calls');
            if (banner.tableKey) setSheetKey(banner.tableKey);
            else if (wide) setSheetKey(null);
          }}
        >
          {banner.kind === 'visit' ? <Footprints size={20} aria-hidden="true" /> : banner.tableKey ? <Check size={20} aria-hidden="true" /> : banner.callType ? (
            <span className="gb-banner__icon" aria-hidden="true">
              {(() => {
                const BannerIcon = CALL_ICON[banner.callType];
                return <BannerIcon size={22} />;
              })()}
            </span>
          ) : <BellRing size={20} aria-hidden="true" />}
          <span>
            <b>{banner.kind === 'visit' ? 'Masaya uğra' : banner.tableKey ? 'Müşteri onaylandı' : 'Yeni çağrı'}</b>
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

/** Seçenek özeti ("Büyük, Peynirli") küçük etiketler olarak. */
function VariantTags({ text }: { text: string }) {
  return (
    <span className="gb-var">
      {text.split(/\s*[,·]\s*/).filter(Boolean).map((part, k) => (
        <i key={k}>{part}</i>
      ))}
    </span>
  );
}

/** Bekleyen masa kartı. Sağa kaydırınca ana işlem yapılır (gidiyorum / hallettim); düğmeler her zaman da vardır. */
const SWIPE_AT = 96;
function CallCard({
  t,
  now,
  busy,
  flash,
  index,
  next,
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
  next?: 'next' | 'mine';
  onClaim: (t: BoardTable, force?: boolean) => void;
  onUnclaim: (t: BoardTable) => void;
  onResolve: (t: BoardTable) => void;
  onOpen: () => void;
}) {
  const wait = now - t.calls[0].at;
  const level = urgency(wait);
  const num = shortName(t);
  const newest = t.calls[t.calls.length - 1];
  const types = [...new Set(t.calls.map((c) => c.type))];
  const cg = types.length > 1
    ? ({ ['--cg' as string]: `conic-gradient(from -90deg, ${types.map((ty, i) => `${TYPE_COLOR[ty]} ${(i * 100) / types.length}% ${((i + 1) * 100) / types.length}%`).join(', ')})` } as CSSProperties)
    : undefined;
  const claim = t.calls.find((c) => c.claim)?.claim || null;
  const mine = Boolean(claim?.mine);
  const swipeable = !busy && !(claim && !mine);

  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; locked: boolean } | null>(null);
  const moved = useRef(false);

  function down(e: RPointerEvent<HTMLElement>) {
    if (!swipeable || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, y: e.clientY, locked: false };
    moved.current = false;
  }
  function move(e: RPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const ox = e.clientX - d.x;
    const oy = e.clientY - d.y;
    if (!d.locked) {
      if (Math.abs(oy) > 12 && Math.abs(oy) > Math.abs(ox)) {
        drag.current = null; // dikey kaydırma: sayfa kayar
        return;
      }
      if (ox > 10) {
        d.locked = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
    }
    if (d.locked) {
      moved.current = true;
      setDx(Math.max(0, Math.min(150, ox)));
    }
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (d?.locked && dx >= SWIPE_AT) {
      if (mine) onResolve(t);
      else onClaim(t);
    }
    setDx(0);
  }

  const hint = mine ? 'Hallettim' : 'Ben gidiyorum';
  return (
    <div className={`gb-swipe${dx > 0 ? ' is-dragging' : ''}${dx >= SWIPE_AT ? ' is-armed' : ''}${mine ? ' is-mine' : ''}`} style={{ ['--dx' as string]: `${dx}px` }}>
      <span className="gb-swipe__hint" aria-hidden="true">
        {mine ? <Check size={22} /> : <Footprints size={22} />} {hint}
      </span>
      <article
        className={`gb-card is-${level} t-${newest.type}${types.length > 1 ? ' has-multi' : ''}${flash ? ' is-flash' : ''}${next ? ` gb-card--next is-${next}` : ''}`}
        style={{ ['--i' as string]: index, ...cg }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
          }
        }}
      >
        {next ? <span className="gb-card__ribbon">{next === 'mine' ? 'Yoldasın' : 'Sıradaki'}</span> : null}
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
    </div>
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
            <li key={c.id} className={`t-${c.type}`}>
              <span className="gb-calls__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div>
                <strong>{c.label}</strong>
                {c.items.length ? (
                  <div className="gb-items">
                    {c.items.map((i, k) => (
                      <span key={k} className={i.variant ? 'has-variant' : ''}>
                        <b>{i.qty}×</b> {i.name}
                        {i.variant ? <VariantTags text={i.variant} /> : null}
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
