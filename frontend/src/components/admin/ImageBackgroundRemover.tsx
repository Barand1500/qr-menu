import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, Sparkles, Terminal, Undo2, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import {
  computeRemoval,
  createRainPlan,
  detectBackground,
  drawRain,
  exportPng,
  loadImageData,
  renderErase,
  renderFinal,
  type Background,
} from '@/lib/removeBackground';
import './background-remover.css';

type Phase = 'ask' | 'erasing' | 'done';
type Surface = 'checker' | 'light' | 'dark';

const ERASE_MS = 2600;

function strength(tolerance: number) {
  return tolerance < 10 ? 'Düşük' : tolerance < 22 ? 'Orta' : 'Yüksek';
}

/**
 * Yüklenen görselin düz arka planını silip şeffaf yapma penceresi. Görsel tarayıcıda işlenir, dışarı gönderilmez.
 * Logo ekranında kullanılır; ürün ve grup görselleri için de aynen kullanılabilir.
 */
export default function ImageBackgroundRemover({
  file,
  subject = 'Logo',
  onApply,
  onKeep,
  onCancel,
}: {
  file: File;
  /** Cümlelerde geçen ad: "Logo", "Ürün görseli" … */
  subject?: string;
  /** Şeffaf PNG hazır; yükleme için dosyayı verir. */
  onApply: (processed: File) => void;
  /** Olduğu gibi kullan. */
  onKeep: () => void;
  /** Vazgeç: hiçbir şey değişmez. */
  onCancel: () => void;
}) {
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const deferredTolerance = useDeferredValue(tolerance);

  // Görseli çöz
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

  async function apply() {
    const base = baseRef.current;
    if (!base || !removal || exporting) return;
    setExporting(true);
    setError('');
    try {
      const name = file.name.replace(/\.[^.]+$/, '') || 'logo';
      onApply(await exportPng(base, removal, `${name}-seffaf.png`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Görsel hazırlanamadı.');
      setExporting(false);
    }
  }

  const noBackground = loadState === 'ready' && bg?.alreadyTransparent;
  const busy = phase === 'erasing' || exporting;
  const percent = removal ? Math.round(removal.removedRatio * 100) : 0;

  return (
    <AdminOverlay label={`${subject} arka planı`} busy={busy} onClose={onCancel} className="bgr-overlay">
      <section className="relative bgr">
        <header className="bgr__head">
          <div>
            <h2>{subject} şeffaf olsun mu?</h2>
            <p>
              {noBackground
                ? 'Bu görselin arka planı zaten şeffaf.'
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
              <button type="button" className="bgr__btn is-primary" disabled={busy} onClick={() => void apply()}>
                <Check size={18} />
                {exporting ? 'Hazırlanıyor…' : `${subject} şeffaf kullan`}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="bgr__btn" disabled={busy} onClick={onKeep}>
                Olduğu gibi kullan
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
