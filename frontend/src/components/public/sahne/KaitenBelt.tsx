import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Utensils } from 'lucide-react';
import gsap from 'gsap';
import { formatMoney, imageUrl } from '@/lib/api';
import type { SofraProduct } from '../sofra/SofraElements';
import type { SofraMenuProps } from '../sofra/types';
import { AddButton, type MenuText } from './menuShared';
import './kaiten.css';

/**
 * Kategori sayfası "sushi bandı": ürünler dönen bir bandın üzerinde tabaklar olarak gelir.
 * Masaüstünde oval bant (üstüne gelince durur, sürüklenip savrulur), telefonda yatay kayan bant.
 * Tabak renkleri fiyat dilimlerini gösterir; tabağa tıklayınca doğrudan ürün sayfası açılır.
 */

const TIER_COLORS = ['#3b6bff', '#10b981', '#f59e0b', '#a855f7', '#f43f5e'];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mod = (v: number, m: number) => ((v % m) + m) % m;

/** Fiyata göre tabak halkası rengi (en çok 5 dilim) */
function buildTiers(dishes: SofraProduct[]) {
  const uniq = [...new Set(dishes.map((d) => d.price))].sort((a, b) => a - b);
  const k = Math.max(1, Math.min(TIER_COLORS.length, uniq.length));
  const tierOf = (price: number) => Math.min(k - 1, Math.floor((uniq.indexOf(price) * k) / Math.max(1, uniq.length)));
  return { colorOf: (price: number) => TIER_COLORS[tierOf(price)] };
}

function PlateFace({ dish, color, i }: { dish: SofraProduct; color: string; i: number }) {
  return (
    <>
      <span className="kb-plate__shadow" aria-hidden="true" />
      <span className="kb-plate__ring" style={{ ['--kb-c' as string]: color, ['--i' as string]: i % 12 } as React.CSSProperties}>
        <span className="kb-plate__disc">
          {dish.imageUrl ? <img src={imageUrl(dish.imageUrl)} alt="" draggable={false} loading="lazy" decoding="async" /> : <Utensils size={26} aria-hidden="true" />}
        </span>
      </span>
      {dish.soldOut ? <em className="kb-plate__out" aria-hidden="true" /> : null}
    </>
  );
}

// ───────────────────────── oval bant (masaüstü) ─────────────────────────
function atPath(a: number, rc: number, s: number) {
  const S = 2 * a;
  const A = Math.PI * rc;
  if (s < S) return { x: -a + s, y: -rc, nx: 0, ny: -1 };
  s -= S;
  if (s < A) {
    const th = -Math.PI / 2 + s / rc;
    return { x: a + rc * Math.cos(th), y: rc * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th) };
  }
  s -= A;
  if (s < S) return { x: a - s, y: rc, nx: 0, ny: 1 };
  s -= S;
  const th = Math.PI / 2 + s / rc;
  return { x: -a + rc * Math.cos(th), y: rc * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th) };
}
function ringPts(a: number, R: number, steps = 36): [number, number][] {
  const pts: [number, number][] = [[-a, -R], [a, -R]];
  for (let i = 1; i < steps; i++) {
    const th = -Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([a + R * Math.cos(th), R * Math.sin(th)]);
  }
  pts.push([a, R], [-a, R]);
  for (let i = 1; i < steps; i++) {
    const th = Math.PI / 2 + (Math.PI * i) / steps;
    pts.push([-a + R * Math.cos(th), R * Math.sin(th)]);
  }
  return pts;
}
function geometry(W: number, n: number) {
  const Wf = W * 0.86;
  const Rout = Wf * 0.2;
  const hw = Rout * 0.42;
  const rc = Rout - hw;
  const a = Math.max(10, (Wf - 2 * Rout) / 2);
  const L = 4 * a + 2 * Math.PI * rc;
  const cosT = 0.62;
  const Hf = 2 * Rout;
  const spacing = L / Math.max(1, n);
  // tabak, bandın ekrandaki yüksekliği kadar (önündeki biraz büyür)
  const pd = Math.min(hw * 2 * cosT * 1.1, spacing * 0.9);
  const height = Hf * cosT * 1.15 + pd * 0.95 + 56;
  return { Wf, Rout, hw, rc, a, L, cosT, Hf, spacing, pd, height };
}

function OvalBelt({ dishes, colorOf, en, motion, onPick }: BeltProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const n = dishes.length;
  const g = useMemo(() => geometry(w, n), [w, n]);
  const st = useRef({ off: 0, vel: 0, hovering: false, drag: false, down: false, moved: 0, lastX: 0, lastT: 0, lock: false, visible: true, raf: 0, last: 0, playing: true });
  st.current.playing = playing;
  const geoRef = useRef(g);
  geoRef.current = g;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(560, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(560, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const render = useCallback(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const G = geoRef.current;
    const s = st.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H * 0.56;
    const P = (x: number, y: number): [number, number] => {
      const f = 1 + y / (G.Hf * 1.5);
      return [cx + x * f, cy + y * G.cosT * f];
    };
    const path = (pts: [number, number][], dy = 0) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const [X, Y] = P(x, y);
        if (i) ctx.lineTo(X, Y + dy);
        else ctx.moveTo(X, Y + dy);
      });
      ctx.closePath();
    };
    const outer = ringPts(G.a, G.Rout);
    const inner = ringPts(G.a, G.Rout - 2 * G.hw);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 34;
    ctx.fillStyle = '#0b0b0d';
    path(outer, 16);
    ctx.fill();
    ctx.restore();
    const grad = ctx.createLinearGradient(0, cy - G.Rout * G.cosT, 0, cy + G.Rout * G.cosT * 1.1);
    grad.addColorStop(0, '#3a3a3f');
    grad.addColorStop(1, '#1c1c1f');
    ctx.fillStyle = grad;
    path(outer);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    path(outer);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    path(ringPts(G.a, G.Rout - 6));
    ctx.stroke();

    // bantla birlikte akan çıtalar
    const count = Math.round(G.L / 46);
    const gap = G.L / count;
    ctx.lineCap = 'round';
    for (let k = 0; k < count; k++) {
      const q = mod(s.off + k * gap, G.L);
      const c = atPath(G.a, G.rc, q);
      const [X1, Y1] = P(c.x - c.nx * G.hw * 0.92, c.y - c.ny * G.hw * 0.92);
      const [X2, Y2] = P(c.x + c.nx * G.hw * 0.92, c.y + c.ny * G.hw * 0.92);
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(X1, Y1);
      ctx.lineTo(X2, Y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.075)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(X1, Y1 + 2);
      ctx.lineTo(X2, Y2 + 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#0c0c0e';
    path(inner, 12);
    ctx.fill();
    const ig = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
    ig.addColorStop(0, '#262629');
    ig.addColorStop(1, '#131315');
    ctx.fillStyle = ig;
    path(inner);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(255,255,255,.32)';
    path(inner);
    ctx.stroke();

    // tabaklar
    for (let i = 0; i < n; i++) {
      const el = els.current[i];
      if (!el) continue;
      const q = mod(s.off + i * G.spacing, G.L);
      const c = atPath(G.a, G.rc, q);
      const [X, Y] = P(c.x, c.y);
      const f = 1 + c.y / (G.Hf * 1.5);
      el.style.transform = `translate3d(${X - G.pd / 2}px, ${Y - G.pd / 2 - G.pd * 0.2}px, 0) scale(${f.toFixed(3)})`;
      el.style.zIndex = String(Math.round(Y * 10));
    }
  }, [n]);

  // döngü: görünürken çalışır
  useEffect(() => {
    const s = st.current;
    const el = wrap.current;
    if (!el) return;
    const frame = (now: number) => {
      const dt = Math.min(0.04, (now - s.last) / 1000 || 0.016);
      s.last = now;
      if (!s.drag && !s.lock) {
        const target = s.playing && !s.hovering ? (motion ? 34 : 15) : 0;
        s.vel += (target - s.vel) * (1 - Math.exp(-dt * (target ? 1.6 : 4.5)));
        s.off = mod(s.off + s.vel * dt, geoRef.current.L);
      }
      render();
      s.raf = s.visible ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible) kick();
    });
    io.observe(el);
    (el as HTMLElement & { _kick?: () => void })._kick = kick;
    kick();
    return () => {
      io.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [render, motion]);

  // ölçü değişince bir kez çiz (hareket kapalıysa da)
  useLayoutEffect(() => {
    render();
  }, [g, render]);

  const step = (dir: 1 | -1) => {
    const s = st.current;
    s.lock = true;
    s.vel = 0;
    const target = s.off + dir * g.spacing;
    gsap.to(s, {
      off: target,
      duration: motion ? 0.85 : 0.3,
      ease: 'power3.out',
      onUpdate: () => {
        s.off = mod(s.off, g.L);
        if (!s.raf) render();
      },
      onComplete: () => {
        s.lock = false;
        s.off = mod(s.off, g.L);
        render();
      },
    });
  };

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    s.down = true;
    s.drag = false;
    s.moved = 0;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vel = 0;
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.down) return;
    const dx = e.clientX - s.lastX;
    s.moved += Math.abs(dx);
    if (!s.drag && s.moved > 8) {
      s.drag = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (!s.drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const front = e.clientY - rect.top > rect.height * 0.56;
    const ds = dx * (front ? -1 : 1);
    const now = performance.now();
    const dt = Math.max(0.008, (now - s.lastT) / 1000);
    s.lastT = now;
    s.lastX = e.clientX;
    s.off = mod(s.off + ds, g.L);
    s.vel = s.vel * 0.6 + (ds / dt) * 0.4;
    if (!s.raf) render();
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    s.down = false;
    if (s.drag) {
      s.drag = false;
      s.vel = clamp(s.vel, -1100, 1100);
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* zaten bırakılmış */
      }
    }
  };

  const hoverDish = hover != null ? dishes[hover] : null;
  const cx = w / 2;
  return (
    <div className="kb-oval">
      <div
        className="kb-stage"
        ref={wrap}
        style={{ height: g.height, ['--kb-d' as string]: `${g.pd}px` } as React.CSSProperties}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') st.current.hovering = true;
        }}
        onPointerLeave={() => {
          st.current.hovering = false;
          setHover(null);
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="group"
        aria-label={en ? 'Plate belt' : 'Tabak bandı'}
      >
        <canvas ref={canvas} className="kb-canvas" aria-hidden="true" />
        <div className="kb-island" style={{ left: cx, top: g.height * 0.56 - 6 }} aria-live="polite">
          {hoverDish ? (
            <span key={hoverDish.id} className="kb-island__info">
              <i style={{ ['--kb-c' as string]: colorOf(hoverDish.price) } as React.CSSProperties} aria-hidden="true" />
              <b>{hoverDish.name}</b>
              <span>{formatMoney(hoverDish.price, hoverDish.currency)}</span>
            </span>
          ) : (
            <span className="kb-island__idle">{en ? `${n} dishes` : `${n} lezzet`}</span>
          )}
        </div>
        {dishes.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              els.current[i] = el;
            }}
            type="button"
            className={`kb-plate${hover === i ? ' is-hover' : ''}${d.soldOut ? ' is-out' : ''}`}
            aria-label={`${d.name}, ${formatMoney(d.price, d.currency)}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
            onClick={() => onPick(i)}
          >
            <PlateFace dish={d} color={colorOf(d.price)} i={i} />
          </button>
        ))}
      </div>
      <div className="kb-ctrl">
        <button type="button" onClick={() => step(-1)} aria-label={en ? 'Previous' : 'Önceki'}>
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying((p) => !p);
            (wrap.current as (HTMLElement & { _kick?: () => void }) | null)?._kick?.();
          }}
          aria-label={playing ? (en ? 'Pause' : 'Durdur') : en ? 'Play' : 'Başlat'}
          aria-pressed={!playing}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" onClick={() => step(1)} aria-label={en ? 'Next' : 'Sonraki'}>
          <ChevronRight size={18} />
        </button>
      </div>
      <p className="kb-hint">{en ? 'Hover to stop the belt, drag to spin it, pick a plate.' : 'Üstüne gelince bant durur, sürükleyip çevir, bir tabak seç.'}</p>
    </div>
  );
}

// ───────────────────────── yatay bant (telefon) ─────────────────────────
function StripBelt({ dishes, colorOf, t, en, motion, onPick, onAdd }: BeltProps & { onAdd?: SofraMenuProps['onAdd'] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const [w, setW] = useState(390);
  const [focus, setFocus] = useState(0);
  const n = dishes.length;
  const pd = clamp(w * 0.46, 120, 200);
  const spacing = pd * 1.12;
  const cycle = n * spacing;
  const copies = Math.max(1, Math.ceil((w + 2 * spacing) / cycle));
  const loopLen = copies * cycle;
  const total = copies * n;
  const bandH = pd * 1.12;
  const height = bandH + 46;
  const st = useRef({ off: 0, vel: 0, drag: false, down: false, moved: 0, lastX: 0, lastT: 0, lock: false, visible: true, raf: 0, last: 0, autoplay: true, idle: 0, focus: 0 });
  const geo = useRef({ w, pd, spacing, loopLen, total, n, bandH, height });
  geo.current = { w, pd, spacing, loopLen, total, n, bandH, height };

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(280, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const render = useCallback(() => {
    const G = geo.current;
    const s = st.current;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (cv && ctx) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const top = (H - G.bandH) / 2 + 4;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = '#0b0b0d';
      ctx.fillRect(-10, top + 10, W + 20, G.bandH);
      ctx.restore();
      const grad = ctx.createLinearGradient(0, top, 0, top + G.bandH);
      grad.addColorStop(0, '#3a3a3f');
      grad.addColorStop(1, '#1c1c1f');
      ctx.fillStyle = grad;
      ctx.fillRect(-10, top, W + 20, G.bandH);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(-10, top, W + 20, 2.5);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(-10, top + G.bandH - 3, W + 20, 1.5);
      const gap = 38;
      const base = mod(s.off, gap);
      ctx.lineCap = 'round';
      for (let x = base - gap; x < W + gap; x += gap) {
        ctx.strokeStyle = 'rgba(0,0,0,.5)';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(x - 7, top + G.bandH - 7);
        ctx.lineTo(x + 7, top + 7);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 6, top + G.bandH - 5);
        ctx.lineTo(x + 8, top + 9);
        ctx.stroke();
      }
    }
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < G.total; j++) {
      const el = els.current[j];
      if (!el) continue;
      const x = mod(j * G.spacing + s.off, G.loopLen) - G.spacing + G.spacing / 2;
      const d = (x - G.w / 2) / (G.w / 2);
      const sc = 1.08 - 0.24 * d * d;
      const y = 15 * d * d;
      el.style.transform = `translate3d(${x - G.pd / 2}px, ${G.height / 2 - G.pd / 2 - 6 + y}px, 0) scale(${sc.toFixed(3)})`;
      el.style.opacity = String(clamp(1 - 0.4 * Math.max(0, Math.abs(d) - 0.72), 0.45, 1));
      el.style.zIndex = String(100 - Math.round(Math.abs(d) * 50));
      if (Math.abs(x - G.w / 2) < bestD) {
        bestD = Math.abs(x - G.w / 2);
        best = j % G.n;
      }
    }
    if (best !== s.focus) {
      s.focus = best;
      setFocus(best);
    }
  }, []);

  const settle = useCallback(
    (extra = 0) => {
      const G = geo.current;
      const s = st.current;
      s.lock = true;
      let landing = s.off + extra;
      let bestDelta = 0;
      let bestAbs = Infinity;
      for (let j = 0; j < G.n; j++) {
        const x = mod(j * G.spacing + landing, G.loopLen) - G.spacing + G.spacing / 2;
        const delta = G.w / 2 - x;
        // en yakın kopya
        const dd = ((delta + G.loopLen / 2) % G.loopLen + G.loopLen) % G.loopLen - G.loopLen / 2;
        if (Math.abs(dd) < bestAbs) {
          bestAbs = Math.abs(dd);
          bestDelta = dd;
        }
      }
      landing += bestDelta;
      gsap.to(s, {
        off: landing,
        duration: motion ? 0.9 : 0.3,
        ease: 'power3.out',
        onUpdate: () => {
          if (!s.raf) render();
        },
        onComplete: () => {
          s.lock = false;
          s.off = mod(s.off, G.loopLen);
          s.vel = 0;
        },
      });
    },
    [motion, render],
  );

  useEffect(() => {
    const s = st.current;
    const el = wrap.current;
    if (!el) return;
    const frame = (now: number) => {
      const dt = Math.min(0.04, (now - s.last) / 1000 || 0.016);
      s.last = now;
      if (!s.drag && !s.lock) {
        const target = s.autoplay ? (motion ? -26 : -12) : 0;
        s.vel += (target - s.vel) * (1 - Math.exp(-dt * 2));
        s.off += s.vel * dt;
      }
      render();
      s.raf = s.visible ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!s.raf) {
        s.last = performance.now();
        s.raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible) kick();
    });
    io.observe(el);
    kick();
    return () => {
      io.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      window.clearTimeout(s.idle);
    };
  }, [render, motion]);

  useLayoutEffect(() => {
    render();
  }, [w, n, render]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    s.down = true;
    s.drag = false;
    s.moved = 0;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vel = 0;
    s.autoplay = false;
    window.clearTimeout(s.idle);
    gsap.killTweensOf(s);
    s.lock = false;
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.down) return;
    const dx = e.clientX - s.lastX;
    s.moved += Math.abs(dx);
    if (!s.drag && s.moved > 8) {
      s.drag = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (!s.drag) return;
    const now = performance.now();
    const dt = Math.max(0.008, (now - s.lastT) / 1000);
    s.lastT = now;
    s.lastX = e.clientX;
    s.off += dx;
    s.vel = s.vel * 0.6 + (dx / dt) * 0.4;
    if (!s.raf) render();
  };
  const up = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    s.down = false;
    if (s.drag) {
      s.drag = false;
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* zaten bırakılmış */
      }
      settle(clamp(s.vel, -1600, 1600) * 0.3);
    }
    window.clearTimeout(s.idle);
    s.idle = window.setTimeout(() => {
      s.autoplay = true;
    }, 2800);
  };

  const cur = dishes[focus] ?? dishes[0];
  return (
    <div className="kb-strip">
      <div
        className="kb-stage kb-stage--strip"
        ref={wrap}
        style={{ height, ['--kb-d' as string]: `${pd}px` } as React.CSSProperties}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="group"
        aria-label={en ? 'Plate belt' : 'Tabak bandı'}
      >
        <canvas ref={canvas} className="kb-canvas" aria-hidden="true" />
        {Array.from({ length: total }, (_, j) => {
          const d = dishes[j % n];
          return (
            <button
              key={j}
              ref={(el) => {
                els.current[j] = el;
              }}
              type="button"
              className={`kb-plate${focus === j % n ? ' is-hover' : ''}${d.soldOut ? ' is-out' : ''}`}
              aria-label={`${d.name}, ${formatMoney(d.price, d.currency)}`}
              tabIndex={j < n ? 0 : -1}
              aria-hidden={j >= n ? true : undefined}
              onClick={() => onPick(j % n)}
            >
              <PlateFace dish={d} color={colorOf(d.price)} i={j} />
            </button>
          );
        })}
      </div>
      {cur ? (
        <div className="kb-now" data-dish key={cur.id} aria-live="polite">
          <div className="kb-now__txt">
            <i style={{ ['--kb-c' as string]: colorOf(cur.price) } as React.CSSProperties} aria-hidden="true" />
            <div>
              <b>{cur.name}</b>
              <span>{formatMoney(cur.price, cur.currency)}</span>
            </div>
          </div>
          <div className="kb-now__act">
            {onAdd ? <AddButton dish={cur} t={t} onAdd={onAdd} round /> : null}
          </div>
        </div>
      ) : null}
      <p className="kb-hint">{en ? 'Swipe the belt, tap a plate for details.' : 'Bandı kaydır, ayrıntı için tabağa dokun.'}</p>
    </div>
  );
}

type BeltProps = {
  dishes: SofraProduct[];
  colorOf: (price: number) => string;
  t: MenuText;
  en: boolean;
  /** false: kullanıcı hareketi azaltmış (bant yine akar ama yavaş ve yaylanmasız) */
  motion: boolean;
  onPick: (i: number) => void;
};

export default function KaitenBelt({
  dishes,
  t,
  lang,
  onOpen,
  onAdd,
}: {
  dishes: SofraProduct[];
  t: MenuText;
  lang: string;
  onOpen: (id: number) => void;
  onAdd?: SofraMenuProps['onAdd'];
}) {
  const en = lang.split('-')[0] === 'en';
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true));
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const motion = typeof window !== 'undefined' ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches : true;
  const { colorOf } = useMemo(() => buildTiers(dishes), [dishes]);
  // tabağa dokununca ara pencere yok: doğrudan ürün sayfası
  const common = { dishes, colorOf, t, en, motion, onPick: (i: number) => onOpen(dishes[i].id) };
  return (
    <div className="kb" data-wide={wide || undefined}>
      {wide ? <OvalBelt {...common} /> : <StripBelt {...common} onAdd={onAdd} />}
    </div>
  );
}
