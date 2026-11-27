import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bike,
  Check,
  ChefHat,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Layers,
  ListChecks,
  Loader2,
  Merge,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  TriangleAlert,
  Unplug,
  Utensils,
  WandSparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import './sefim-integration.css';

/* ───────────── Sunucu ile aynı şekiller (backend/src/lib/sefim-sync.ts) ───────────── */
type Mode = 'sync' | 'addOnly' | 'priceOnly';
export type SefimSettings = {
  enabled: boolean;
  mode: Mode;
  price: string;
  groups: string[] | null;
  fields: { name: boolean; price: boolean; group: boolean; options: boolean };
  removed: 'hide' | 'keep';
  matchByName: boolean;
  newVisible: boolean;
  tidyNames: boolean;
  autoApply: boolean;
};
type Summary = { create: number; update: number; price: number; link: number; hide: number; show: number; groups: number; same: number; total: number };
type HistoryEntry = { at: string; ok: boolean; auto: boolean; summary?: Summary; error?: string; warnings?: string[] };
type SefimState = {
  linked: boolean;
  device: string | null;
  bridgeNote: string | null;
  bridgeVersion: string | null;
  online: boolean;
  lastSeenAt: string | null;
  snapshotAt: string | null;
  lastApplyAt: string | null;
  settings: SefimSettings;
  groups: { name: string; label?: string; count: number; system: boolean; on: boolean }[];
  templates: { id: number; name: string }[];
  waitingGroups: string[];
  preview: { summary: Summary; warnings: string[]; pending: boolean } | null;
  history: HistoryEntry[];
};
type PreviewOp = { k: string; name: string; price?: number; oldPrice?: number; newName?: string; group?: string; oldGroup?: string; options?: number | boolean; hidden?: boolean };

const DOWNLOAD_URL = '/indir/Cirak.exe';
const apiError = (e: unknown) => (e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
const tl = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ₺`;

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'hiç';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'az önce';
  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "3 yeni · 2 fiyat …" — geçmiş satırları ve bildirimler için */
export function describe(s: Summary | undefined): string {
  if (!s) return '';
  const parts = [
    s.create && `${s.create} yeni ürün`,
    s.price && `${s.price} fiyat güncellendi`,
    s.update && `${s.update} güncelleme`,
    s.link && `${s.link} ürün eşleşti`,
    s.hide && `${s.hide} gizlendi`,
    s.show && `${s.show} geri açıldı`,
    s.groups && `${s.groups} yeni grup`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Değişiklik yok, menü Şefim ile aynı';
}

/** Şefim büyük harfle yazar; panelde örnek göstermek için sunucudaki kuralın sade hali */
const tidyPreview = (s: string) =>
  /\p{Ll}/u.test(s) ? s : s.toLocaleLowerCase('tr-TR').replace(/(^|\s)(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase('tr-TR'));

/* ───────────── Durum kancası ───────────── */
export function useSefimState(onToast: (text: string, error?: boolean) => void) {
  const [state, setState] = useState<SefimState | null>(null);
  const [draft, setDraft] = useState<SefimSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'' | 'save' | 'apply' | 'code' | 'unlink'>('');
  const [pair, setPair] = useState<{ code: string; expiresAt: string } | null>(null);
  const [justLinked, setJustLinked] = useState(false);
  const dirtyRef = useRef(false);

  const hydrate = useCallback((s: SefimState, keepDraft = false) => {
    setState(s);
    if (!keepDraft) setDraft(s.settings);
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await api<SefimState>('/api/admin/sefim');
      hydrate(s, dirtyRef.current);
      setFailed(false);
      return s;
    } catch {
      setFailed(true);
      return null;
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
    // "Çırak çevrimiçi mi, son eşitleme ne zaman" bilgisi tazelensin (sekme görünürken)
    const id = window.setInterval(() => document.visibilityState === 'visible' && void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const dirty = useMemo(() => Boolean(state && draft && JSON.stringify(state.settings) !== JSON.stringify(draft)), [state, draft]);
  dirtyRef.current = dirty;

  // Kod gösterilirken Çırak'ın bağlanmasını bekle
  useEffect(() => {
    if (!pair) return;
    const id = window.setInterval(async () => {
      const s = await load();
      if (s?.linked) {
        setPair(null);
        setJustLinked(true);
        onToast('Çırak bağlandı! Şefim menünüz birazdan gelecek.');
        window.setTimeout(() => setJustLinked(false), 7000);
      } else if (new Date(pair.expiresAt).getTime() < Date.now()) setPair(null);
    }, 4000);
    return () => window.clearInterval(id);
  }, [pair, load, onToast]);

  async function save() {
    if (!draft) return;
    setBusy('save');
    try {
      hydrate(await api<SefimState>('/api/admin/sefim/settings', { method: 'PUT', body: JSON.stringify(draft) }));
      onToast('Şefim ayarları kaydedildi.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setBusy('');
    }
  }
  async function apply() {
    setBusy('apply');
    try {
      const r = await api<{ summary: Summary; state: SefimState }>('/api/admin/sefim/apply', { method: 'POST' });
      hydrate(r.state, dirtyRef.current);
      onToast(`Menü güncellendi: ${describe(r.summary)}`);
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setBusy('');
    }
  }
  async function newCode() {
    setBusy('code');
    try {
      setPair(await api<{ code: string; expiresAt: string }>('/api/admin/sefim/pair-code', { method: 'POST' }));
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setBusy('');
    }
  }
  async function unlinkNow() {
    setBusy('unlink');
    try {
      hydrate(await api<SefimState>('/api/admin/sefim', { method: 'DELETE' }), dirtyRef.current);
      onToast('Çırak bağlantısı kesildi. Menünüz olduğu gibi kaldı.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setBusy('');
    }
  }

  const status: { tone: 'ok' | 'idle' | 'off'; text: string } = !state
    ? { tone: 'off', text: 'Yükleniyor…' }
    : !state.linked
      ? { tone: 'off', text: 'Bağlı değil · Çırak ile 2 dakikada kurulur' }
      : !state.settings.enabled
        ? { tone: 'idle', text: 'Bağlı · eşitleme duraklatıldı' }
        : state.online && state.bridgeNote
          ? { tone: 'idle', text: "Çırak çalışıyor ama Şefim'i okuyamıyor" }
          : state.online
          ? { tone: 'ok', text: `Bağlı · son eşitleme ${ago(state.lastApplyAt || state.snapshotAt)}` }
          : { tone: 'idle', text: `Çırak çevrimdışı · son görülme ${ago(state.lastSeenAt)}` };

  return { state, draft, setDraft, dirty, failed, busy, pair, justLinked, status, load, save, apply, newCode, unlinkNow, reset: () => state && setDraft(state.settings) };
}
export type SefimHook = ReturnType<typeof useSefimState>;

/* ───────────── Küçük parçalar ───────────── */
function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; icon: ReactNode; title: string; text: string; badge?: string }[];
  label: string;
  cols?: 2 | 3;
}) {
  return (
    <div className={`sf-choice sf-choice--${cols}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          <span className="sf-choice__icon" aria-hidden>
            {o.icon}
          </span>
          <strong>
            {o.title}
            {o.badge ? <em>{o.badge}</em> : null}
          </strong>
          <small>{o.text}</small>
        </button>
      ))}
    </div>
  );
}

function Question({ n, title, hint, children }: { n: number | string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="sf-q">
      <header>
        <b aria-hidden>{n}</b>
        <div>
          <h4>{title}</h4>
          {hint ? <p>{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function CirakMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#E05D38" />
      <path d="M20 35c-4.5 0-7.5-3.2-7.5-7.2 0-3.9 3.1-7 7-7 .9 0 1.7.1 2.5.4C23.6 17 27.4 14 32 14s8.4 3 10 7.2c.8-.3 1.6-.4 2.5-.4 3.9 0 7 3.1 7 7 0 4-3 7.2-7.5 7.2" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M21 41h22M21 41v6.5c0 1.4 1.1 2.5 2.5 2.5h17c1.4 0 2.5-1.1 2.5-2.5V41" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 28l5 5-5 5" fill="none" stroke="#FFD2C2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Şefim → Çırak → Menü canlı hattı */
function Line({ s, products }: { s: SefimState; products: number }) {
  const live = s.linked && s.online && s.settings.enabled;
  return (
    <div className={`sf-line${live ? ' is-live' : s.linked ? ' is-sleep' : ''}`} aria-label={live ? 'Hat çalışıyor' : 'Hat çalışmıyor'}>
      <div className="sf-node">
        <span>
          <ChefHat size={20} />
        </span>
        <b>Şefim</b>
        <small>{s.device || 'Restoran bilgisayarı'}</small>
      </div>
      <i className="sf-wire" aria-hidden>
        <em />
      </i>
      <div className="sf-node sf-node--cirak">
        <span>
          <CirakMark size={26} />
        </span>
        <b>Çırak</b>
        <small>{s.linked ? (s.online ? `${ago(s.lastSeenAt)} konuştu` : `çevrimdışı · ${ago(s.lastSeenAt)}`) : 'kurulmadı'}</small>
      </div>
      <i className="sf-wire" aria-hidden>
        <em />
      </i>
      <div className="sf-node">
        <span>
          <QrCode size={20} />
        </span>
        <b>QR Menü</b>
        <small>{products ? `${products} ürün takipte` : 'bekliyor'}</small>
      </div>
    </div>
  );
}

function Setup({ h }: { h: SefimHook }) {
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!h.pair) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [h.pair]);
  const left = h.pair ? Math.max(0, Math.round((new Date(h.pair.expiresAt).getTime() - now) / 1000)) : 0;
  async function copy() {
    if (!h.pair) return;
    try {
      await navigator.clipboard.writeText(h.pair.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* panoya yazılamadı */
    }
  }
  return (
    <ol className="sf-steps">
      <li>
        <b aria-hidden>1</b>
        <div>
          <h4>Çırak'ı indir</h4>
          <p>
            Şefim'in kurulu olduğu kasa bilgisayarına indirip çift tıklayın. Kurulum sorusu yok. Windows "bilinmeyen yayımcı" derse <b>Ek bilgi → Yine de çalıştır</b>.
          </p>
          <a className="ig-btn ig-btn--ghost sf-dl" href={DOWNLOAD_URL} download>
            <Download size={17} aria-hidden /> Çırak'ı indir
          </a>
        </div>
      </li>
      <li>
        <b aria-hidden>2</b>
        <div>
          <h4>Şefim'i bulsun</h4>
          <p>
            Çırak <code>C:\VEGA\Sefim</code> klasörünü kendisi bulur. Bulamazsa <code>connectionstring.txt</code> dosyasını penceresine sürükleyin.
          </p>
        </div>
      </li>
      <li>
        <b aria-hidden>3</b>
        <div>
          <h4>Kodu yazın</h4>
          {h.pair ? (
            <div className="sf-code" aria-live="polite">
              <button type="button" onClick={() => void copy()} aria-label="Kodu kopyala">
                <span>{h.pair.code}</span>
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <p>
                <Loader2 size={14} className="ig-spin" aria-hidden /> Çırak'ın bağlanması bekleniyor · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </p>
            </div>
          ) : (
            <>
              <p>Çırak'ın istediği eşleştirme kodunu buradan alın. Kod 15 dakika geçerli, tek kullanımlıktır.</p>
              <button type="button" className="ig-btn sf-btn" disabled={h.busy === 'code'} onClick={() => void h.newCode()}>
                {h.busy === 'code' ? <Loader2 size={17} className="ig-spin" aria-hidden /> : <KeyRound size={17} aria-hidden />} Eşleştirme kodu al
              </button>
            </>
          )}
        </div>
      </li>
    </ol>
  );
}

function Preview({ h }: { h: SefimHook }) {
  const s = h.state!;
  const [open, setOpen] = useState(false);
  const [ops, setOps] = useState<PreviewOp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const p = s.preview;
  useEffect(() => {
    setOps(null);
    setOpen(false);
  }, [s.snapshotAt, s.settings, s.lastApplyAt]);
  if (!p) {
    return (
      <div className="sf-wait">
        <Loader2 size={18} className="ig-spin" aria-hidden />
        <p>Çırak ilk görüntüyü gönderince burada ne değişeceğini göreceksiniz.</p>
      </div>
    );
  }
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !ops) {
      setLoading(true);
      try {
        setOps((await api<{ ops: PreviewOp[] }>('/api/admin/sefim/preview')).ops);
      } catch {
        setOps([]);
      } finally {
        setLoading(false);
      }
    }
  }
  const sm = p.summary;
  const tiles = [
    { k: 'create', n: sm.create, label: 'yeni ürün', icon: <Plus size={16} /> },
    { k: 'price', n: sm.price, label: 'fiyat değişecek', icon: <Tag size={16} /> },
    { k: 'update', n: sm.update + sm.link, label: 'güncellenecek', icon: <RefreshCw size={16} /> },
    { k: 'hide', n: sm.hide, label: 'gizlenecek', icon: <EyeOff size={16} /> },
  ];
  const nothing = tiles.every((t) => !t.n) && !sm.show && !sm.groups;
  return (
    <div className="sf-preview">
      {nothing ? (
        <p className="sf-same">
          <Check size={18} aria-hidden /> Menünüz Şefim ile birebir aynı. {sm.total ? `${sm.total} ürün takipte.` : ''}
        </p>
      ) : (
        <div className="sf-tiles">
          {tiles.map((t) => (
            <div key={t.k} className={`sf-tile is-${t.k}${t.n ? '' : ' is-zero'}`}>
              <span aria-hidden>{t.icon}</span>
              <b>{t.n}</b>
              <small>{t.label}</small>
            </div>
          ))}
        </div>
      )}
      {p.warnings.map((w) => (
        <p key={w} className="sf-warn">
          <TriangleAlert size={16} aria-hidden /> {w}
        </p>
      ))}
      {s.waitingGroups.length ? (
        <p className="sf-note">
          <Loader2 size={14} className="ig-spin" aria-hidden /> Çırak {s.waitingGroups.join(', ')} ürünlerini bir dakika içinde getirecek.
        </p>
      ) : null}
      <div className="sf-preview__bar">
        {!nothing ? (
          <button type="button" className="sf-link" onClick={() => void toggle()} aria-expanded={open}>
            <ListChecks size={16} aria-hidden /> {open ? 'Listeyi gizle' : 'Neler değişecek, tek tek gör'}
            <ChevronDown size={16} className={open ? 'is-up' : ''} aria-hidden />
          </button>
        ) : (
          <span />
        )}
        {p.pending ? (
          <button type="button" className="ig-btn sf-btn" disabled={h.busy === 'apply' || h.dirty} title={h.dirty ? 'Önce ayarları kaydedin' : undefined} onClick={() => void h.apply()}>
            {h.busy === 'apply' ? <Loader2 size={17} className="ig-spin" aria-hidden /> : <Sparkles size={17} aria-hidden />} Menüye uygula
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="sf-ops">
          {loading ? <li className="sf-ops__load">Hazırlanıyor…</li> : null}
          {ops?.map((o, i) => (
            <li key={i} className={`is-${o.k}`}>
              <i aria-hidden />
              <span>
                <b>{o.newName ? `${o.name} → ${o.newName}` : o.name}</b>
                <small>
                  {o.k === 'create'
                    ? `Yeni${o.price != null ? ` · ${tl(o.price)}` : ''}${o.group ? ` · ${o.group}` : ''}${o.hidden ? ' · gizli eklenecek' : ''}`
                    : o.k === 'group'
                      ? 'Yeni grup açılacak'
                      : o.k === 'link'
                        ? 'Menünüzdeki aynı adlı ürünle eşleşecek (fotoğrafı korunur)'
                        : o.k === 'hide'
                          ? "Şefim'de yok · menüde gizlenecek"
                          : o.k === 'show'
                            ? "Şefim'e geri geldi · yeniden açılacak"
                            : [
                                o.price != null && o.oldPrice != null ? `${tl(o.oldPrice)} → ${tl(o.price)}` : '',
                                o.group ? `${o.oldGroup || '—'} → ${o.group}` : '',
                                o.options ? 'porsiyon/seçenekler' : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                </small>
              </span>
            </li>
          ))}
          {ops && !ops.length && !loading ? <li className="sf-ops__load">Liste boş.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/* ───────────── Panel ───────────── */
export function SefimPanel({ h }: { h: SefimHook }) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [more, setMore] = useState(false);
  if (h.failed && !h.state) return <p className="ig-note">Şefim bilgileri yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>;
  if (!h.state || !h.draft) return <p className="ig-note">Yükleniyor…</p>;
  const s = h.state;
  const d = h.draft;
  const set = (patch: Partial<SefimSettings>) => h.setDraft({ ...d, ...patch });
  const setField = (k: keyof SefimSettings['fields'], v: boolean) => set({ fields: { ...d.fields, [k]: v } });
  const isOn = (g: { name: string; system: boolean }) => (d.groups ? d.groups.includes(g.name) : !g.system);
  const toggleGroup = (name: string) => {
    const cur = s.groups.filter(isOn).map((g) => g.name);
    set({ groups: cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name] });
  };
  const normal = s.groups.filter((g) => !g.system);
  const system = s.groups.filter((g) => g.system);
  const products = s.preview?.summary.total ?? 0;
  const priceOptions = [
    { id: 'base', icon: <Utensils size={18} />, title: 'Masa fiyatı', text: "Şefim'deki ana satış fiyatı", badge: 'Önerilen' },
    ...s.templates.map((t) => ({
      id: `t:${t.id}`,
      icon: /paket|eve|kurye|online/i.test(t.name) ? <Bike size={18} /> : <Tag size={18} />,
      title: `${tidyPreview(t.name)} fiyatı`,
      text: `Şefim'deki "${t.name}" fiyat şablonu`,
    })),
  ];

  return (
    <article className={`sf${d.enabled ? ' is-on' : ''}${h.justLinked ? ' is-party' : ''}`}>
      <header className="sf-head">
        <span className="sf-head__icon" aria-hidden>
          <CirakMark size={46} />
        </span>
        <div>
          <h3>Vega Şefim</h3>
          <p>Şefim'deki ürünler ve fiyatlar menünüze kendiliğinden gelir.</p>
        </div>
        {s.linked ? (
          <button
            type="button"
            role="switch"
            aria-checked={d.enabled}
            aria-label="Eşitlemeyi aç/kapat"
            className={`ig-switch${d.enabled ? ' is-on' : ''}`}
            disabled={h.busy !== ''}
            onClick={() => set({ enabled: !d.enabled })}
          >
            <i />
          </button>
        ) : null}
      </header>
      <p className={`ig-status is-${h.status.tone}`}>
        <i aria-hidden /> {h.status.text}
      </p>

      <Line s={s} products={products} />
      {s.linked && s.bridgeNote ? (
        <p className="sf-warn">
          <TriangleAlert size={16} aria-hidden /> {s.bridgeNote}. Şefim açık mı, bilgisayar yeniden başlatıldı mı kontrol edin; Çırak her dakika yeniden dener.
        </p>
      ) : null}

      {!s.linked ? <Setup h={h} /> : null}

      {s.linked ? (
        <section className="sf-block" aria-label="Ne olacak">
          <h4 className="sf-block__title">
            <Sparkles size={16} aria-hidden /> Menünüzde ne olacak?
          </h4>
          <Preview h={h} />
        </section>
      ) : null}

      <section className="sf-block sf-qs" aria-label="Eşitleme ayarları">
        <h4 className="sf-block__title">
          <WandSparkles size={16} aria-hidden /> Nasıl çalışsın?
          {!s.linked ? <small>Şimdiden ayarlayabilirsiniz</small> : null}
        </h4>

        <Question n={1} title="Şefim'den ne alalım?">
          <Choice<Mode>
            label="Eşitleme türü"
            value={d.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { id: 'sync', icon: <RefreshCw size={18} />, title: 'Her şeyi eşitle', text: 'Yeni ürünleri ekler, değişenleri günceller', badge: 'Önerilen' },
              { id: 'addOnly', icon: <Plus size={18} />, title: 'Sadece yenileri ekle', text: 'Menünüzdeki ürünlere hiç dokunmaz' },
              { id: 'priceOnly', icon: <Tag size={18} />, title: 'Sadece fiyatlar', text: 'Yeni ürün eklemez, yalnızca fiyatları tazeler' },
            ]}
          />
        </Question>

        <Question n={2} title="Menüde hangi fiyat görünsün?" hint={s.templates.length ? undefined : 'Şefim bağlanınca paket gibi diğer fiyat şablonları da burada çıkar.'}>
          <Choice label="Fiyat kaynağı" value={d.price} onChange={(price) => set({ price })} cols={priceOptions.length > 2 ? 3 : 2} options={priceOptions} />
        </Question>

        <Question n={3} title="Hangi gruplar gelsin?" hint={s.groups.length ? 'Seçmediğiniz grupların ürünlerine dokunulmaz.' : "Çırak bağlanınca Şefim'deki gruplar burada listelenir."}>
          {s.groups.length ? (
            <div className="sf-groups">
              <div className="sf-chips" role="group" aria-label="Şefim grupları">
                {normal.map((g) => (
                  <button key={g.name} type="button" aria-pressed={isOn(g)} onClick={() => toggleGroup(g.name)}>
                    {g.label || g.name} <small>{g.count}</small>
                  </button>
                ))}
              </div>
              {system.length ? (
                <>
                  <button type="button" className="sf-link" onClick={() => setShowSystem(!showSystem)} aria-expanded={showSystem}>
                    <Layers size={15} aria-hidden /> Paket platformu kopyaları ({system.length}) {showSystem ? 'gizle' : 'göster'}
                  </button>
                  {showSystem ? (
                    <>
                      <p className="sf-note">
                        Bu gruplar Trendyol, Yemeksepeti gibi platformlardan gelen siparişlerin kopyalarıdır; menüye eklemeniz önerilmez.
                      </p>
                      <div className="sf-chips sf-chips--muted" role="group" aria-label="Sistem grupları">
                        {system.map((g) => (
                          <button key={g.name} type="button" aria-pressed={isOn(g)} onClick={() => toggleGroup(g.name)}>
                            {g.name} <small>{g.count.toLocaleString('tr-TR')}</small>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </Question>

        <Question n={4} title="Değişiklikler nasıl uygulansın?">
          <Choice
            label="Uygulama"
            value={d.autoApply ? 'auto' : 'manual'}
            onChange={(v) => set({ autoApply: v === 'auto' })}
            cols={2}
            options={[
              { id: 'auto', icon: <Sparkles size={18} />, title: 'Kendiliğinden', text: "Şefim'de değişince 1 dakika içinde menüde" },
              { id: 'manual', icon: <Eye size={18} />, title: 'Önce ben bakayım', text: 'Değişiklikleri görür, "Menüye uygula" dersiniz' },
            ]}
          />
        </Question>

        <button type="button" className="sf-more" onClick={() => setMore(!more)} aria-expanded={more}>
          <span>İnce ayarlar</span>
          <small>{more ? 'Kapat' : 'Silinen ürün, aynı adlı ürünler, isimler…'}</small>
          <ChevronDown size={18} className={more ? 'is-up' : ''} aria-hidden />
        </button>
        {more ? (
          <div className="sf-fine">
            {d.mode !== 'addOnly' ? (
              <Question n="a" title="Menünüzde neler güncellensin?" hint="Fotoğraf, açıklama, içerik ve çeviriler her zaman sizde kalır.">
                <div className="sf-chips" role="group" aria-label="Güncellenecek alanlar">
                  {(
                    [
                      ['name', 'Ürün adı'],
                      ['price', 'Fiyat'],
                      ['group', 'Grubu'],
                      ['options', 'Porsiyon ve seçenekler'],
                    ] as const
                  )
                    .filter(([k]) => d.mode === 'sync' || k === 'price' || k === 'options')
                    .map(([k, label]) => (
                      <button key={k} type="button" aria-pressed={d.fields[k]} onClick={() => setField(k, !d.fields[k])}>
                        {label}
                      </button>
                    ))}
                </div>
              </Question>
            ) : null}
            <Question n="b" title="Şefim'den bir ürün silinirse?">
              <Choice
                label="Silinen ürün"
                value={d.removed}
                onChange={(removed) => set({ removed })}
                cols={2}
                options={[
                  { id: 'hide', icon: <EyeOff size={18} />, title: 'Menüde gizle', text: 'Silinmez; Şefim\'e geri gelirse yeniden açılır' },
                  { id: 'keep', icon: <ShieldCheck size={18} />, title: 'Dokunma', text: 'Menüde olduğu gibi kalır' },
                ]}
              />
            </Question>
            <Question n="c" title="Menünüzde aynı adlı ürün varsa?">
              <Choice
                label="Aynı adlı ürün"
                value={d.matchByName ? 'merge' : 'separate'}
                onChange={(v) => set({ matchByName: v === 'merge' })}
                cols={2}
                options={[
                  { id: 'merge', icon: <Merge size={18} />, title: 'Birleştir', text: 'Kopya açılmaz; fotoğrafı ve açıklaması kalır', badge: 'Önerilen' },
                  { id: 'separate', icon: <Layers size={18} />, title: 'Ayrı ekle', text: "Şefim'den gelen ayrı bir ürün olur" },
                ]}
              />
            </Question>
            <Question n="d" title="Yeni gelen ürünler">
              <Choice
                label="Yeni ürünler"
                value={d.newVisible ? 'show' : 'hide'}
                onChange={(v) => set({ newVisible: v === 'show' })}
                cols={2}
                options={[
                  { id: 'show', icon: <Eye size={18} />, title: 'Hemen görünsün', text: 'Müşteri menüde hemen görür' },
                  { id: 'hide', icon: <EyeOff size={18} />, title: 'Gizli gelsin', text: 'Fotoğraf ekleyip sonra kendiniz açarsınız' },
                ]}
              />
            </Question>
            <label className="sf-toggle">
              <span>
                <b>İsimleri düzelt</b>
                <small>
                  <s>KLASİK DÜRÜMLER</s> → Klasik Dürümler
                </small>
              </span>
              <button type="button" role="switch" aria-checked={d.tidyNames} aria-label="İsimleri düzelt" className={`ig-switch${d.tidyNames ? ' is-on' : ''}`} onClick={() => set({ tidyNames: !d.tidyNames })}>
                <i />
              </button>
            </label>
          </div>
        ) : null}
      </section>

      {s.linked ? (
        <section className="sf-block" aria-label="Geçmiş">
          <h4 className="sf-block__title">
            <History size={16} aria-hidden /> Son işlemler
          </h4>
          {s.history.length ? (
            <ul className="sf-history">
              {s.history.slice(0, 8).map((e, i) => (
                <li key={`${e.at}-${i}`} className={e.ok ? '' : 'is-bad'}>
                  <i aria-hidden />
                  <span>
                    <b>{e.error || (e.summary ? describe(e.summary) : e.warnings?.[0] || 'İşlem')}</b>
                    <small>
                      {ago(e.at)} · {e.auto ? 'kendiliğinden' : 'sizin onayınızla'}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ig-note">Henüz işlem yok.</p>
          )}
          <div className="sf-foot">
            {confirmUnlink ? (
              <>
                <span>Menünüz olduğu gibi kalır, yalnızca eşitleme durur.</span>
                <button type="button" className="ig-btn ig-btn--ghost" onClick={() => setConfirmUnlink(false)}>
                  Vazgeç
                </button>
                <button type="button" className="ig-btn sf-danger" disabled={h.busy === 'unlink'} onClick={() => void h.unlinkNow().then(() => setConfirmUnlink(false))}>
                  <Unplug size={16} aria-hidden /> Bağlantıyı kes
                </button>
              </>
            ) : (
              <>
                <span>{s.device ? `Bağlı bilgisayar: ${s.device}` : ''}</span>
                <button type="button" className="sf-link" onClick={() => setConfirmUnlink(true)}>
                  <Unplug size={15} aria-hidden /> Bağlantıyı kes
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      <footer className={`ig-save sf-save${h.dirty ? ' is-show' : ''}`}>
        <span>Kaydedilmemiş değişiklikler var</span>
        <button type="button" className="ig-btn ig-btn--ghost" disabled={h.busy === 'save'} onClick={h.reset}>
          Vazgeç
        </button>
        <button type="button" className="ig-btn sf-btn" disabled={h.busy === 'save'} onClick={() => void h.save()}>
          {h.busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </footer>
    </article>
  );
}
