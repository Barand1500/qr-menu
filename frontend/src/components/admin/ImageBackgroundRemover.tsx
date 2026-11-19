import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, Sparkles, Terminal, Undo2, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import {
  computeRemoval,
  createRainPlan,
  detectBackground,
  drawRain,
  loadImageData,
  renderErase,
  renderFinal,
  type Background,
  type RemoveOptions,
} from '@/lib/removeBackground';
import './background-remover.css';

export type ImageBackgroundMode = 'ask' | 'auto' | 'never';
export type BackgroundDecision = {
  /** true: arka plan silinsin; false: olduğu gibi kullanılsın. */
  remove: boolean;
  options: RemoveOptions;
  /** İlk seçimde "bundan sonra" kutusunda seçilen davranış (yalnızca remember açıkken). */
  remember: ImageBackgroundMode | null;
};

type Phase = 'ask' | 'erasing' | 'done';
type Surface = 'checker' | 'light' | 'dark';

const ERASE_MS = 2600;

const REMEMBER_OPTIONS: { id: ImageBackgroundMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Her seferinde sor', hint: 'Görsel yüklerken bu soru çıkar.' },
  { id: 'auto', label: 'Düzse otomatik sil', hint: 'Arka planı tek renk olanlar sorulmadan silinir.' },
  { id: 'never', label: 'Hiç sorma', hint: 'Görseller olduğu gibi yüklenir.' },
];

function strength(tolerance: number) {
  return tolerance < 10 ? 'Düşük' : tolerance < 22 ? 'Orta' : 'Yüksek';
}

/**
 * Yüklenen görsel(ler)in düz arka planını silip şeffaf yapma penceresi. Görseller tarayıcıda işlenir, dışarı
 * gönderilmez. Birden çok görselde önizleme ilkinin üzerindedir; verilen karar ve ayarlar hepsine uygulanır.
 * İşlemi `onFinish` yapar; bitene kadar pencere ilerlemeyi gösterir.
 */
export default function ImageBackgroundRemover({
  files,
  subject = 'Logo',
  remember = false,
  settingsHint = false,
  onFinish,
  onCancel,
}: {
  files: File[];
  /** Cümlelerde geçen ad: "Logo", "Ürün görseli" … */
  subject?: string;
  /** İlk seçim: "Bundan sonra" kutusunu göster ve seçimi karara ekle. */
  remember?: boolean;
  /** "Her seferinde sor" modunda: davranışı Ayarlar'dan değiştirebileceğini hatırlat. */
  settingsHint?: boolean;
  onFinish: (
    decision: BackgroundDecision,
    progress: (done: number, total: number) => void,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const file = files[0];
  const many = files.length > 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<ImageData | null>(null);
  const outRef = useRef<ImageData | null>(null);
  const frame = useRef(0);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bg, setBg] = useState<Background | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [phase, setPhase] = useState<Phase>('ask');
  const [tolerance, setTolerance] = useState(14);
  const [includeInner, setIncludeInner] = useState(false);
  const [surface, setSurface] = useState<Surface>('checker');
  const [rememberMode, setRememberMode] = useState<ImageBackgroundMode>('ask');
  const [working, setWorking] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const deferredTolerance = useDeferredValue(tolerance);

  // Önizleme görselini çöz
  useEffect(() => {
    let off = false;
    setLoadState('loading');
    loadImageData(file)
      .then(({ image, width, height }) => {
        if (off) return;
        baseRef.current = image;
        outRef.current = new ImageData(width, height);
        setSize({ w: width, h: height });
        setBg(detectBackground(image));
        setLoadState('ready');
      })
      .catch(() => {
        if (!off) setLoadState('error');
      });
    return () => {
      off = true;
      cancelAnimationFrame(frame.current);
    };
  }, [file]);

  const plan = useMemo(() => createRainPlan(size.w), [size.w]);

  const removal = useMemo(() => {
    const base = baseRef.current;
    if (loadState !== 'ready' || !base || !bg || bg.alreadyTransparent) return null;
    return computeRemoval(base, bg, { tolerance: deferredTolerance, includeInner });
    // baseRef içeriği loadState ile birlikte değişir
  }, [loadState, bg, deferredTolerance, includeInner]);

  function draw(progress: number, tick = 0) {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    const out = outRef.current;
    if (!canvas || !base || !out) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!removal || progress <= 0) out.data.set(base.data);
    else if (progress >= 1) renderFinal(base, removal, out);
    else renderErase(base, removal, plan, progress, tick, out);
    ctx.putImageData(out, 0, 0);
    if (removal && progress > 0 && progress < 1) {
      drawRain(ctx, removal, plan, progress, tick, base.width, base.height);
    }
  }

  // Sahneyi güncel tut: bekleme ve bitmiş durumda
  useEffect(() => {
    if (loadState !== 'ready' || phase === 'erasing') return;
    draw(phase === 'done' ? 1 : 0);
  });

  function startErase() {
    if (!removal || removal.count === 0) {
      setError('Arka plan bulunamadı. Hassasiyeti artırmayı deneyin.');
      return;
    }
    setError('');
    setPhase('erasing');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let n = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / ERASE_MS);
      draw(t, n++);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else setPhase('done');
    };
    frame.current = requestAnimationFrame(tick);
  }

  async function finish(remove: boolean) {
    if (working) return;
    setError('');
    setWorking({ done: 0, total: files.length });
    try {
      await onFinish(
        { remove, options: { tolerance, includeInner }, remember: remember ? rememberMode : null },
        (done, total) => setWorking({ done, total }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Görseller hazırlanamadı.');
      setWorking(null);
    }
  }

  const noBackground = loadState === 'ready' && bg?.alreadyTransparent;
  const busy = phase === 'erasing' || working !== null;
  const percent = removal ? Math.round(removal.removedRatio * 100) : 0;
  const progressText = working && working.total > 1 ? ` ${working.done}/${working.total}` : '';
  const removeLabel = many ? 'Hepsini şeffaf yap' : 'Şeffaf kullan';

  return (
    <AdminOverlay label={`${subject} arka planı`} busy={busy} onClose={onCancel} className="bgr-overlay">
      <section className="relative bgr">
        <header className="bgr__head">
          <div>
            <h2>{many ? `${files.length} görsel şeffaf olsun mu?` : `${subject} şeffaf olsun mu?`}</h2>
            <p>
              {noBackground
                ? 'Bu görselin arka planı zaten şeffaf.'
                : many
                  ? 'Önizleme ilk görsel; seçtiğiniz ayar hepsine uygulanır.'
                  : 'Düz renkli arka planı silelim, sadece çizim kalsın.'}
            </p>
          </div>
          <button type="button" className="bgr__x" aria-label="Vazgeç" disabled={busy} onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <div className="bgr__body">
          <div
            className={`bgr__stage is-${surface}${phase === 'done' ? ' is-done' : ''}${phase === 'erasing' ? ' is-erasing' : ''}`}
          >
            {loadState === 'loading' && <span className="bgr__state">Görsel hazırlanıyor…</span>}
            {loadState === 'error' && (
              <span className="bgr__state">Bu görsel işlenemedi. Olduğu gibi kullanabilirsiniz.</span>
            )}
            <canvas
              ref={canvasRef}
              width={size.w}
              height={size.h}
              className={loadState === 'ready' ? undefined : 'is-hidden'}
              aria-label={`${subject} önizleme`}
              role="img"
            />
            {phase === 'erasing' && (
              <span className="bgr__chip is-run">
                <Terminal size={14} /> Arka plan çözülüyor…
              </span>
            )}
            {phase === 'done' && (
              <span className="bgr__chip is-ok">
                <Sparkles size={14} /> Arka plan silindi{percent > 0 ? ` · %${percent}` : ''}
              </span>
            )}
          </div>

          <div className="bgr__surfaces" role="group" aria-label="Önizleme zemini">
            {(
              [
                ['checker', 'Şeffaf'],
                ['light', 'Açık'],
                ['dark', 'Koyu'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={surface === id}
                className={`is-${id}`}
                onClick={() => setSurface(id)}
              >
                <i aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {!noBackground && loadState === 'ready' && (
            <div className="bgr__controls">
              <label className="bgr__range">
                <span>
                  Silme hassasiyeti <b>{strength(tolerance)}</b>
                </span>
                <input
                  type="range"
                  min={3}
                  max={40}
                  value={tolerance}
                  disabled={phase === 'erasing'}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                />
                <small>
                  Arka planda gölge veya renk geçişi varsa artırın; çizimden silinmeye başlarsa azaltın.
                </small>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={includeInner}
                className="bgr__switch"
                disabled={phase === 'erasing'}
                onClick={() => setIncludeInner((v) => !v)}
              >
                <span>
                  Harf ve boşlukların içini de sil
                  <small>Kapalı bölgelerdeki arka plan renkleri de temizlenir.</small>
                </span>
                <span className="bgr__sw" aria-hidden="true">
                  <span />
                </span>
              </button>
            </div>
          )}

          {remember && (
            <fieldset className="bgr__remember" disabled={busy}>
              <legend>Bundan sonra ürün ve grup görsellerinde</legend>
              <div role="radiogroup" aria-label="Bundan sonraki davranış">
                {REMEMBER_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={rememberMode === o.id}
                    onClick={() => setRememberMode(o.id)}
                  >
                    <b>{o.label}</b>
                    <small>{o.hint}</small>
                  </button>
                ))}
              </div>
              <p>Bu seçim işletmeniz için kaydedilir; Ayarlar &rsaquo; İşletme&apos;den değiştirebilirsiniz.</p>
            </fieldset>
          )}
          {settingsHint && !remember && (
            <p className="bgr__hint">
              Bu soruyu istemezseniz Ayarlar &rsaquo; İşletme &rsaquo; Görseller&apos;den otomatik yapabilir veya
              kapatabilirsiniz.
            </p>
          )}

          {error && (
            <p role="alert" className="bgr__error">
              {error}
            </p>
          )}
        </div>

        <footer className="bgr__foot">
          {phase === 'done' ? (
            <>
              <button type="button" className="bgr__btn" disabled={busy} onClick={() => setPhase('ask')}>
                <Undo2 size={17} /> Özgün hâli
              </button>
              <button type="button" className="bgr__btn is-primary" disabled={busy} onClick={() => void finish(true)}>
                <Check size={18} />
                {working ? `Hazırlanıyor…${progressText}` : removeLabel}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="bgr__btn" disabled={busy} onClick={() => void finish(false)}>
                {working ? `Yükleniyor…${progressText}` : 'Olduğu gibi kullan'}
              </button>
              {!noBackground && (
                <button
                  type="button"
                  className="bgr__btn is-primary"
                  disabled={busy || loadState !== 'ready'}
                  onClick={startErase}
                >
                  <Eraser size={18} />
                  {phase === 'erasing' ? 'Siliniyor…' : 'Arka planı sil'}
                </button>
              )}
            </>
          )}
        </footer>
      </section>
    </AdminOverlay>
  );
}
