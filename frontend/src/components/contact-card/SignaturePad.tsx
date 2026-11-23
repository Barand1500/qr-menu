import { useCallback, useEffect, useRef } from 'react';
import { Eraser, Undo2 } from 'lucide-react';
import { SIGNATURE_BOX, buildStrokePath, type SignaturePoint } from '@/lib/contactCard';

const MAX_STROKES = 12;
const INK = '#1b2a4a';
const SCALE = 2; // keskin çizim için iç çözünürlük çarpanı

/** Parmak veya fareyle imza çizilen alan. Çizgiler yumuşatılıp kısa SVG yollarına çevrilir. */
export default function SignaturePad({
  strokes,
  onChange,
  disabled = false,
}: {
  strokes: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<SignaturePoint[] | null>(null);
  const pointer = useRef<number | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const paint = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, SIGNATURE_BOX.width, SIGNATURE_BOX.height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of strokesRef.current) ctx.stroke(new Path2D(d));
    const points = live.current;
    if (points?.length) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    paint();
  }, [strokes, paint]);

  function toPoint(event: React.PointerEvent<HTMLCanvasElement>): SignaturePoint {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * SIGNATURE_BOX.width,
      y: ((event.clientY - box.top) / box.height) * SIGNATURE_BOX.height,
    };
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || strokes.length >= MAX_STROKES || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = event.pointerId;
    live.current = [toPoint(event)];
    paint();
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId || !live.current) return;
    live.current.push(toPoint(event));
    paint();
  }
  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    const points = live.current;
    live.current = null;
    const d = points ? buildStrokePath(points) : '';
    if (d) onChange([...strokes, d]);
    else paint();
  }

  const full = strokes.length >= MAX_STROKES;
  return (
    <div className="ccp-pad">
      <div className={`ccp-pad__surface${strokes.length ? ' has-ink' : ''}`}>
        <canvas
          ref={canvas}
          width={SIGNATURE_BOX.width * SCALE}
          height={SIGNATURE_BOX.height * SCALE}
          aria-label="İmza alanı: parmağınızla veya fareyle çizin"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!strokes.length ? <span className="ccp-pad__hint">Buraya imzanızı çizin</span> : null}
        <i className="ccp-pad__line" aria-hidden="true" />
      </div>
      <div className="ccp-pad__bar">
        <span>{full ? 'En fazla 12 çizgi' : strokes.length ? `${strokes.length} çizgi` : 'İsteğe bağlı'}</span>
        <div>
          <button type="button" onClick={() => onChange(strokes.slice(0, -1))} disabled={disabled || !strokes.length}>
            <Undo2 size={16} aria-hidden="true" /> Geri al
          </button>
          <button type="button" onClick={() => onChange([])} disabled={disabled || !strokes.length}>
            <Eraser size={16} aria-hidden="true" /> Temizle
          </button>
        </div>
      </div>
    </div>
  );
}
