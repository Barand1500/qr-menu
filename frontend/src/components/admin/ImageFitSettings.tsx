import { useEffect, useMemo, useState } from 'react';
import { Check, Crop, RotateCcw, Scan } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import {
  DEFAULT_IMAGE_FIT,
  fitStyle,
  parseImageFit,
  type FitFill,
  type FitFocus,
  type FitKind,
  type ImageFitConfig,
} from '@/lib/imageFit';
import { IMAGE_FIT_CHANGED } from '@/hooks/useImageFit';
import './image-fit-settings.css';

/** Kenarları ve merkezi belli, yatay bir örnek: kırpma/sığdırmanın etkisi net görünsün. */
const SAMPLE = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><circle cx="400" cy="250" r="170" fill="#fff" opacity=".92"/><circle cx="400" cy="250" r="120" fill="#fde68a"/><circle cx="400" cy="250" r="56" fill="#f59e0b"/><g fill="#fff" font-family="Arial" font-weight="700" font-size="30"><text x="24" y="48">▲ ÜST SOL</text><text x="800" y="48" text-anchor="end">ÜST SAĞ ▲</text><text x="24" y="482">▼ ALT SOL</text><text x="776" y="482" text-anchor="end">ALT SAĞ ▼</text></g></svg>`,
)}`;

const FOCUS: { id: FitFocus; label: string }[] = [
  { id: 'top-left', label: 'Sol üst' },
  { id: 'top', label: 'Üst' },
  { id: 'top-right', label: 'Sağ üst' },
  { id: 'left', label: 'Sol' },
  { id: 'center', label: 'Orta' },
  { id: 'right', label: 'Sağ' },
  { id: 'bottom-left', label: 'Sol alt' },
  { id: 'bottom', label: 'Alt' },
  { id: 'bottom-right', label: 'Sağ alt' },
];

const FILLS: { id: FitFill; label: string }[] = [
  { id: 'theme', label: 'Tema' },
  { id: 'blur', label: 'Bulanık' },
  { id: 'white', label: 'Beyaz' },
  { id: 'black', label: 'Siyah' },
  { id: 'color', label: 'Renk' },
];

const FRAMES = [
  { id: 'square', label: 'Ürün kartı', ratio: '1 / 1', n: 1 },
  { id: 'wide', label: 'Vitrin', ratio: '16 / 9', n: 16 / 9 },
  { id: 'tall', label: 'Ürün detayı', ratio: '4 / 5', n: 0.8 },
] as const;

const TARGETS: { id: FitKind; label: string }[] = [
  { id: 'products', label: 'Ürünler' },
  { id: 'groups', label: 'Gruplar' },
  { id: 'showcase', label: 'Vitrin' },
];

const comparable = (c: ImageFitConfig) => JSON.stringify({ ...c, appliesFrom: 0 });

/** Bir çerçeve: yüksekliği sabit, genişliği orana göre; resim içinde ayara göre durur. */
function Frame({ cfg, src, ratio, n, height }: { cfg: ImageFitConfig; src: string; ratio: string; n: number; height: number }) {
  const live = cfg.enabled;
  const shown: ImageFitConfig = live ? cfg : { ...DEFAULT_IMAGE_FIT, mode: 'cover' };
  const blur = live && shown.mode === 'contain' && shown.fill === 'blur';
  return (
    <div className={`ifs-frame${blur ? ' is-blur' : ''}`} style={{ aspectRatio: ratio, width: `min(100%, ${Math.round(height * n)}px)` }}>
      {blur ? <span className="ifs-blur" style={{ backgroundImage: `url("${src}")` }} /> : null}
      <img src={src} alt="" draggable={false} style={fitStyle(shown, blur)} />
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ifs-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ImageFitSettings({ onToast }: { onToast: (text: string, error?: boolean) => void }) {
  const [saved, setSaved] = useState<ImageFitConfig | null>(null);
  const [cfg, setCfg] = useState<ImageFitConfig>(DEFAULT_IMAGE_FIT);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [own, setOwn] = useState<string[]>([]);
  const [sample, setSample] = useState(SAMPLE);
  const [frameId, setFrameId] = useState<(typeof FRAMES)[number]['id']>('square');

  useEffect(() => {
    let alive = true;
    api<unknown>('/api/admin/settings/image-fit')
      .then((r) => {
        if (!alive) return;
        const c = parseImageFit(r);
        setSaved(c);
        setCfg(c);
      })
      .catch(() => alive && setError(true));
    // Kendi ürün görselleriyle de denenebilsin.
    api<{ data?: { imageUrl?: string | null }[] }>('/api/admin/products?limit=40')
      .then((r) => {
        if (!alive) return;
        const urls = (r.data ?? []).map((p) => p.imageUrl).filter((u): u is string => Boolean(u));
        setOwn([...new Set(urls)].slice(0, 6).map((u) => imageUrl(u)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => (saved ? comparable(saved) !== comparable(cfg) : false), [saved, cfg]);
  const set = (patch: Partial<ImageFitConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const contain = cfg.mode === 'contain';
  const frame = FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];

  async function save() {
    setSaving(true);
    try {
      const res = await api<unknown>('/api/admin/settings/image-fit', { method: 'PUT', body: JSON.stringify(cfg) });
      const next = parseImageFit(res);
      setSaved(next);
      setCfg(next);
      window.dispatchEvent(new Event(IMAGE_FIT_CHANGED));
      onToast('Resim ayarı kaydedildi.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Kaydedilemedi.', true);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="ifs-note">Ayar yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>;
  if (!saved) return <p className="ifs-note">Yükleniyor…</p>;

  return (
    <div className="ifs">
      {/* Canlı önizleme: masaüstünde solda yapışkan, telefonda üstte */}
      <aside className="ifs-preview" aria-label="Canlı önizleme">
        <div className="ifs-preview__top">
          <div>
            <h2>Canlı önizleme</h2>
            <p>{cfg.enabled ? 'Seçimlerin burada anında görünür.' : 'Kapalı: tema kendi görünümünü kullanıyor.'}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cfg.enabled}
            aria-label="Resim ayarını kullan"
            className={`ifs-switch${cfg.enabled ? ' is-on' : ''}`}
            onClick={() => set({ enabled: !cfg.enabled })}
          >
            <i />
          </button>
        </div>

        <Seg label="Önizleme alanı" value={frameId} onChange={setFrameId} options={FRAMES.map((f) => ({ id: f.id, label: f.label }))} />

        <div className="ifs-stage">
          <Frame cfg={cfg} src={sample} ratio={frame.ratio} n={frame.n} height={230} />
        </div>

        <div className="ifs-samples" role="group" aria-label="Önizleme resmi">
          <button type="button" aria-pressed={sample === SAMPLE} onClick={() => setSample(SAMPLE)}>
            Örnek
          </button>
          {own.map((u, i) => (
            <button key={u} type="button" aria-pressed={sample === u} aria-label={`Ürün resmi ${i + 1}`} onClick={() => setSample(u)}>
              <img src={u} alt="" data-no-fit />
            </button>
          ))}
        </div>
      </aside>

      <div className="ifs-controls">
        <fieldset className="ifs-fields" disabled={!cfg.enabled || saving}>
          <section className="ifs-block">
            <h3>Yerleşim</h3>
            <div className="ifs-modes" role="radiogroup" aria-label="Yerleşim">
              {(
                [
                  ['cover', Crop, 'Kırp', 'Kutuyu doldurur, taşan kısım kesilir'],
                  ['contain', Scan, 'Sığdır', 'Resmin tamamı görünür'],
                ] as const
              ).map(([id, Icon, title, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={cfg.mode === id} onClick={() => set({ mode: id })}>
                  <span className={`ifs-mode-art ifs-mode-art--${id}`} aria-hidden>
                    <i />
                  </span>
                  <span>
                    <strong>
                      <Icon size={15} aria-hidden /> {title}
                    </strong>
                    <small>{hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="ifs-block ifs-block--split">
            <div>
              <h3>Odak noktası</h3>
              <p>{contain ? 'Küçük kalırsa nereye yaslansın?' : 'Kesilirken hangi bölge korunsun?'}</p>
            </div>
            <div className="ifs-focus" role="radiogroup" aria-label="Odak noktası">
              {FOCUS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={cfg.focus === f.id} aria-label={f.label} title={f.label} onClick={() => set({ focus: f.id })}>
                  <i />
                </button>
              ))}
            </div>
          </section>

          {contain ? (
            <section className="ifs-block">
              <h3>Boş kalan alan</h3>
              <div className="ifs-chips" role="radiogroup" aria-label="Boş alan dolgusu">
                {FILLS.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={cfg.fill === f.id} onClick={() => set({ fill: f.id })}>
                    {f.label}
                  </button>
                ))}
                {cfg.fill === 'color' ? (
                  <label className="ifs-color">
                    <input type="color" value={cfg.color} aria-label="Dolgu rengi" onChange={(e) => set({ color: e.target.value })} />
                    <span>{cfg.color.toUpperCase()}</span>
                  </label>
                ) : null}
              </div>
              <label className="ifs-range">
                <span>Kenar boşluğu</span>
                <input type="range" min={0} max={16} step={2} value={cfg.padding} aria-label="Kenar boşluğu" onChange={(e) => set({ padding: Number(e.target.value) })} />
                <output>{cfg.padding ? `%${cfg.padding}` : 'Yok'}</output>
              </label>
            </section>
          ) : null}

          <section className="ifs-block">
            <h3>Hangi resimlere?</h3>
            <Seg
              label="Kapsam"
              value={cfg.scope}
              onChange={(v) => set({ scope: v })}
              options={[
                { id: 'all', label: 'Mevcutlar dahil hepsi' },
                { id: 'new', label: 'Yalnızca yeni yüklenenler' },
              ]}
            />
            <p className="ifs-help">
              {cfg.scope === 'new'
                ? saved.scope === 'new' && saved.appliesFrom
                  ? `${new Date(saved.appliesFrom).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden sonra yüklenenler. Eskiler temanın görünümünde kalır.`
                  : 'Kaydettiğin andan sonra yüklenen resimler. Eskiler temanın görünümünde kalır.'
                : 'Daha önce yüklenen resimler de bu ayarla görünür.'}
            </p>
            <div className="ifs-targets" role="group" aria-label="Uygulanacak alanlar">
              {TARGETS.map((t) => (
                <button key={t.id} type="button" aria-pressed={cfg.targets[t.id]} onClick={() => set({ targets: { ...cfg.targets, [t.id]: !cfg.targets[t.id] } })}>
                  <span aria-hidden>{cfg.targets[t.id] ? <Check size={13} /> : null}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        </fieldset>

        <div className={`ifs-bar${dirty ? ' is-show' : ''}`} role="status">
          <p>Kaydedilmemiş değişiklik var</p>
          <button type="button" className="ifs-bar__ghost" disabled={saving} onClick={() => setCfg(saved)}>
            <RotateCcw size={15} aria-hidden /> Vazgeç
          </button>
          <button type="button" className="ifs-bar__save" disabled={saving} onClick={() => void save()}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
