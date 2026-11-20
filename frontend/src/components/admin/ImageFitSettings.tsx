import { useEffect, useMemo, useState } from 'react';
import { Check, Crop, Maximize2, RotateCcw, Scan } from 'lucide-react';
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
  { id: 'theme', label: 'Tema rengi' },
  { id: 'blur', label: 'Bulanık' },
  { id: 'white', label: 'Beyaz' },
  { id: 'black', label: 'Siyah' },
  { id: 'color', label: 'Özel renk' },
];

const FRAMES = [
  { id: 'square', label: 'Ürün kartı', ratio: '1 / 1' },
  { id: 'wide', label: 'Vitrin', ratio: '16 / 9' },
  { id: 'tall', label: 'Ürün detayı', ratio: '4 / 5' },
];

const TARGETS: { id: FitKind; label: string }[] = [
  { id: 'products', label: 'Ürünler' },
  { id: 'groups', label: 'Gruplar' },
  { id: 'showcase', label: 'Vitrin' },
];

const comparable = (c: ImageFitConfig) => JSON.stringify({ ...c, appliesFrom: 0 });

function Frame({ cfg, src, ratio, label }: { cfg: ImageFitConfig; src: string; ratio: string; label: string }) {
  const live = cfg.enabled;
  const shown: ImageFitConfig = live ? cfg : { ...DEFAULT_IMAGE_FIT, mode: 'cover' };
  const blur = live && shown.mode === 'contain' && shown.fill === 'blur';
  return (
    <figure className="ifs-figure">
      <div className={`ifs-frame${blur ? ' is-blur' : ''}`} style={{ aspectRatio: ratio }}>
        {blur ? <span className="ifs-blur" style={{ backgroundImage: `url("${src}")` }} /> : null}
        <img src={src} alt="" draggable={false} style={fitStyle(shown, blur)} />
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default function ImageFitSettings({ onToast }: { onToast: (text: string, error?: boolean) => void }) {
  const [saved, setSaved] = useState<ImageFitConfig | null>(null);
  const [cfg, setCfg] = useState<ImageFitConfig>(DEFAULT_IMAGE_FIT);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [own, setOwn] = useState<string[]>([]);
  const [sample, setSample] = useState(SAMPLE);

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
      {/* Açma/kapama + canlı önizleme */}
      <section className="ast-card ifs-hero">
        <header className="ast-card-head">
          <div>
            <h2>Resimler nasıl görünsün?</h2>
            <p>Ürün, grup ve vitrin görselleri menünüzde ve panelde bu ayara göre gösterilir. Menünün tasarımı değişmez.</p>
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
        </header>
        <div className="ast-card-body">
          <div className="ifs-preview">
            {FRAMES.map((f) => (
              <Frame key={f.id} cfg={cfg} src={sample} ratio={f.ratio} label={f.label} />
            ))}
          </div>
          <div className="ifs-samples" role="group" aria-label="Önizleme resmi">
            <span>Önizleme resmi</span>
            <button type="button" aria-pressed={sample === SAMPLE} onClick={() => setSample(SAMPLE)}>
              Örnek
            </button>
            {own.map((u, i) => (
              <button key={u} type="button" aria-pressed={sample === u} aria-label={`Ürün resmi ${i + 1}`} onClick={() => setSample(u)}>
                <img src={u} alt="" data-no-fit />
              </button>
            ))}
          </div>
          {!cfg.enabled ? (
            <p className="ifs-note">Şu an kapalı: görseller temanın kendi görünümüyle gösteriliyor. Açınca aşağıdaki seçimler uygulanır.</p>
          ) : null}
        </div>
      </section>

      <fieldset className="ifs-fields" disabled={!cfg.enabled || saving}>
        <section className="ast-card">
          <header className="ast-card-head">
            <div>
              <h2>Yerleşim</h2>
              <p>Resim, kutusuna kırpılarak mı doldursun, yoksa bütünüyle mi sığsın?</p>
            </div>
          </header>
          <div className="ast-card-body">
            <div className="ifs-modes" role="radiogroup" aria-label="Yerleşim">
              {(
                [
                  ['cover', Crop, 'Kırp', 'Kutuyu tamamen doldurur; taşan kenarlar kesilir.'],
                  ['contain', Scan, 'Sığdır', 'Resmin tamamı görünür; boş kalan yer doldurulur.'],
                ] as const
              ).map(([id, Icon, title, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={cfg.mode === id} onClick={() => set({ mode: id })}>
                  <span className={`ifs-mode-art ifs-mode-art--${id}`} aria-hidden>
                    <i />
                  </span>
                  <strong>
                    <Icon size={16} /> {title}
                  </strong>
                  <small>{hint}</small>
                </button>
              ))}
            </div>

            <div className="ifs-row">
              <div>
                <h3>Odak noktası</h3>
                <p>{contain ? 'Resim kutusundan küçük kaldığında nereye yaslansın?' : 'Kesilirken hangi bölge korunsun?'}</p>
              </div>
              <div className="ifs-focus" role="radiogroup" aria-label="Odak noktası">
                {FOCUS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={cfg.focus === f.id}
                    aria-label={f.label}
                    title={f.label}
                    onClick={() => set({ focus: f.id })}
                  >
                    <i />
                  </button>
                ))}
              </div>
            </div>

            {contain ? (
              <>
                <div className="ifs-row ifs-row--stack">
                  <div>
                    <h3>Boş kalan alan</h3>
                    <p>Resim kutuyu doldurmadığında arkada ne görünsün?</p>
                  </div>
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
                </div>
                <div className="ifs-row ifs-row--stack">
                  <div>
                    <h3>Kenar boşluğu</h3>
                    <p>Resmin etrafında nefes alanı bırakır.</p>
                  </div>
                  <label className="ifs-range">
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={2}
                      value={cfg.padding}
                      aria-label="Kenar boşluğu"
                      onChange={(e) => set({ padding: Number(e.target.value) })}
                    />
                    <output>{cfg.padding ? `%${cfg.padding}` : 'Yok'}</output>
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="ast-card">
          <header className="ast-card-head">
            <div>
              <h2>Neye uygulansın?</h2>
              <p>Hangi resimlerin bu ayarla gösterileceğini seçin.</p>
            </div>
          </header>
          <div className="ast-card-body">
            <div className="ifs-scope" role="radiogroup" aria-label="Kapsam">
              <button type="button" role="radio" aria-checked={cfg.scope === 'all'} onClick={() => set({ scope: 'all' })}>
                <strong>Mevcut resimler dahil hepsi</strong>
                <small>Daha önce yüklenenler de bu ayarla görünür.</small>
              </button>
              <button type="button" role="radio" aria-checked={cfg.scope === 'new'} onClick={() => set({ scope: 'new' })}>
                <strong>Yalnızca bundan sonra yüklenenler</strong>
                <small>
                  {cfg.scope === 'new' && saved.scope === 'new' && saved.appliesFrom
                    ? `${new Date(saved.appliesFrom).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden sonra yüklenenler.`
                    : 'Eski resimler temanın görünümünde kalır.'}
                </small>
              </button>
            </div>
            <div className="ifs-targets" role="group" aria-label="Uygulanacak alanlar">
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={cfg.targets[t.id]}
                  onClick={() => set({ targets: { ...cfg.targets, [t.id]: !cfg.targets[t.id] } })}
                >
                  <span aria-hidden>{cfg.targets[t.id] ? <Check size={14} /> : null}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </fieldset>

      <div className={`ifs-bar${dirty ? ' is-show' : ''}`} role="status">
        <p>
          <Maximize2 size={16} aria-hidden /> Kaydedilmemiş değişiklikler var
        </p>
        <button type="button" className="ifs-bar__ghost" disabled={saving} onClick={() => setCfg(saved)}>
          <RotateCcw size={15} aria-hidden /> Vazgeç
        </button>
        <button type="button" className="ifs-bar__save" disabled={saving} onClick={() => void save()}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
