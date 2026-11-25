import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsapSetup';
import { imageUrl } from '@/lib/api';

export type PlateHandle = {
  el: HTMLElement | null;
  /** Seçilen malzemeler tabağa uçup konar */
  toss: (emojis: string[]) => void;
  /** Porsiyon büyüklüğüne göre tabak büyür/küçülür */
  grow: (scale: number) => void;
  /** Kısa "yuttu" tepkisi */
  pulse: () => void;
  /** Bir ürün (sürükleyerek) tabağa bırakıldı: oradan tabağa süzülür */
  absorb: (from: DOMRect, src?: string | null) => void;
};

type Props = {
  images: string[];
  index: number;
  alt: string;
  orbit: string[];
  hot: number | null;
  warn: Set<number>;
  steam: boolean;
  diet: 'none' | 'ok' | 'warn';
};

const R = 262; // yörünge yarıçapı (viewBox 600)
const CIRC = 2 * Math.PI * R;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Yuvarlak "tabak": fotoğraf seramik bir tabağın içinde durur. Fareyle üç boyutlu eğilir, parmak/fareyle çevrilir,
 * kaydırdıkça döner, çevresinde malzeme adları dolanır. Seçimlere tepki verir (toss/grow/pulse).
 */
const Plate = forwardRef<PlateHandle, Props>(function Plate({ images, index, alt, orbit, hot, warn, steam, diet }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const growRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<SVGSVGElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const scrollRotRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const tossRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState({ n: 2, ls: 6 });
  const [grab, setGrab] = useState(false);
  const spin = useRef({ rot: 0, drag: false, lastA: 0, lastX: 0, lastT: 0, vel: 0, touch: false, moved: 0, tween: null as gsap.core.Tween | null });
  const reduced = prefersReducedMotion();

  const seq = orbit.map((s) => s.toLocaleUpperCase('tr'));

  // Yörünge yazısı halkayı tam doldursun: tekrar sayısı ve harf aralığı ölçülür
  useLayoutEffect(() => {
    const svg = orbitRef.current;
    if (!svg || !seq.length) return;
    const cs = getComputedStyle(svg);
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = `600 16px ${cs.fontFamily || 'sans-serif'}`;
    const text = seq.map((w) => `${w} • `).join('');
    const w = ctx.measureText(text).width;
    const n = Math.max(1, Math.round(CIRC / (w + text.length * 4)));
    const ls = Math.max(0, (CIRC / n - w) / text.length);
    setRing({ n, ls });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq.join('|')]);

  // Giriş koreografisi
  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from(enterRef.current, { scale: 0.5, rotationX: 58, rotationZ: -24, y: 100, opacity: 0, filter: 'blur(18px)', duration: 1.5 }, 0.05)
        .from(orbitRef.current, { opacity: 0, scale: 1.4, duration: 1.9 }, 0.25)
        .from(floorRef.current, { opacity: 0, scaleX: 0.4, duration: 1.4 }, 0.2);
    }, rootRef);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fareyle eğilme + parlama, kaydırmayla dönme, yörünge dolanması
  useEffect(() => {
    if (reduced) return;
    const tilt = tiltRef.current;
    const rim = rimRef.current;
    const orbitEl = orbitRef.current;
    const scrollRot = scrollRotRef.current;
    const cover = coverRef.current;
    if (!tilt || !rim || !orbitEl || !scrollRot || !cover) return;
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    const fine = window.matchMedia('(pointer: fine)').matches;
    const onMove = (e: PointerEvent) => {
      if (!fine || e.pointerType === 'touch') return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      ry(nx * 11);
      rx(-ny * 8);
      rim.style.setProperty('--gx', `${50 + nx * 34}%`);
      rim.style.setProperty('--gy', `${38 + ny * 30}%`);
      const cur = cursorRef.current;
      if (cur) {
        cur.style.setProperty('--cx', `${e.clientX}px`);
        cur.style.setProperty('--cy', `${e.clientY}px`);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const setOrbit = gsap.quickSetter(orbitEl, 'rotation', 'deg');
    const setScroll = gsap.quickSetter(scrollRot, 'rotation', 'deg');
    let angle = 0;
    let speed = 6;
    let sr = 0;
    let lastY = window.scrollY;
    let cleared = false;
    const mobile = window.matchMedia('(max-width: 1023px)');
    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 50) / 1000;
      const sy = window.scrollY;
      const vel = (sy - lastY) / Math.max(dt, 0.001);
      lastY = sy;
      speed += (6 + Math.min(Math.abs(vel) * 0.03, 60) - speed) * 0.08;
      angle += speed * dt;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = clamp(sy / max, 0, 1);
      sr += (p * 150 - sr) * 0.08;
      setOrbit(angle - p * 170);
      setScroll(sr);
      if (mobile.matches) {
        const stageH = rootRef.current?.closest('.pl-stage')?.clientHeight || 400;
        const q = clamp(sy / (stageH * 0.9), 0, 1);
        gsap.set(cover, { scale: 1 - q * 0.2, y: -q * 36, opacity: 1 - q * 0.6 });
        cleared = false;
      } else if (!cleared) {
        gsap.set(cover, { clearProps: 'transform,opacity' });
        cleared = true;
      }
    };
    gsap.ticker.add(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      gsap.ticker.remove(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Görsel değişince tabak küçük bir çeyrek tur atar
  const firstIndex = useRef(true);
  useEffect(() => {
    if (firstIndex.current) {
      firstIndex.current = false;
      return;
    }
    if (reduced) return;
    const s = spin.current;
    s.tween?.kill();
    s.tween = gsap.to(s, { rot: s.rot + 70, duration: 1.1, ease: 'power4.out', onUpdate: () => void gsap.set(spinRef.current, { rotation: s.rot }) });
  }, [index, reduced]);

  // ----- tabağı çevirme (fare: çember boyunca, dokunmatik: yatay sürükleme) -----
  function down(e: RPointerEvent<HTMLElement>) {
    if (reduced || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = spin.current;
    const r = e.currentTarget.getBoundingClientRect();
    s.drag = true;
    s.tween?.kill();
    s.lastA = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    s.lastX = e.clientX;
    s.lastT = performance.now();
    s.vel = 0;
    s.moved = 0;
    s.touch = e.pointerType !== 'mouse';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setGrab(true);
  }
  function move(e: RPointerEvent<HTMLElement>) {
    const s = spin.current;
    if (!s.drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    let d: number;
    if (s.touch) {
      d = (e.clientX - s.lastX) * 0.55;
    } else {
      const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
      let da = a - s.lastA;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      d = (da * 180) / Math.PI;
      s.lastA = a;
    }
    s.lastX = e.clientX;
    const now = performance.now();
    const dt = Math.max(0.008, (now - s.lastT) / 1000);
    s.lastT = now;
    s.vel = s.vel * 0.7 + (d / dt) * 0.3;
    s.moved += Math.abs(d);
    s.rot += d;
    gsap.set(spinRef.current, { rotation: s.rot });
  }
  function up(e: RPointerEvent<HTMLElement>) {
    const s = spin.current;
    if (!s.drag) return;
    s.drag = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* zaten bırakılmış */
    }
    setGrab(false);
    const kick = s.moved < 3 ? 34 : clamp(s.vel * 0.28, -900, 900);
    s.tween?.kill();
    s.tween = gsap.to(s, { rot: s.rot + kick, duration: s.moved < 3 ? 1 : 1.8, ease: 'power3.out', onUpdate: () => void gsap.set(spinRef.current, { rotation: s.rot }) });
  }

  // ----- dışarıdan tetiklenen tepkiler -----
  const ripple = () => {
    const layer = tossRef.current;
    if (!layer) return;
    const i = document.createElement('i');
    i.className = 'pl-ripple';
    layer.appendChild(i);
    gsap.fromTo(i, { scale: 0.25, opacity: 0.75 }, { scale: 1.12, opacity: 0, duration: 0.9, ease: 'expo.out', onComplete: () => i.remove() });
  };
  const pulse = () => {
    if (reduced) return;
    gsap.fromTo(enterRef.current, { scale: 1 }, { scale: 0.965, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: 'auto' });
    ripple();
  };

  useImperativeHandle(ref, () => ({
    el: rootRef.current,
    pulse,
    grow(scale: number) {
      if (reduced) return;
      gsap.to(growRef.current, { scale, duration: 1.1, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
    },
    toss(emojis: string[]) {
      const layer = tossRef.current;
      if (!layer || !emojis.length) return;
      if (reduced) return;
      const d = layer.clientWidth;
      const mobile = window.matchMedia('(max-width: 1023px)').matches;
      emojis.slice(0, 5).forEach((emo, k) => {
        const el = document.createElement('span');
        el.className = 'pl-toss__item';
        el.textContent = emo;
        layer.appendChild(el);
        const sx = mobile ? (Math.random() - 0.5) * d * 0.5 : d * (0.62 + Math.random() * 0.18);
        const sy = mobile ? d * 0.78 : -d * 0.05 + (Math.random() - 0.5) * d * 0.3;
        const ex = (Math.random() - 0.5) * d * 0.34;
        const ey = (Math.random() - 0.5) * d * 0.34;
        const peak = Math.min(sy, ey) - d * (0.18 + Math.random() * 0.1);
        const tl = gsap.timeline({ delay: k * 0.09, onComplete: () => void 0 });
        tl.set(el, { x: sx, y: sy, scale: 0.3, opacity: 0, rotation: -70 + Math.random() * 40 })
          .to(el, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, 0)
          .to(el, { x: ex, duration: 0.85, ease: 'power1.inOut' }, 0)
          .to(el, { y: peak, duration: 0.42, ease: 'power2.out' }, 0)
          .to(el, { y: ey, duration: 0.43, ease: 'power2.in' }, 0.42)
          .to(el, { rotation: 0, duration: 0.85, ease: 'power1.out' }, 0)
          .add(() => {
            pulse();
            try {
              navigator.vibrate?.(10);
            } catch {
              /* titreşim yok */
            }
          }, 0.85)
          .to(el, { scale: 1.25, duration: 0.1, ease: 'power2.out' }, 0.85)
          .to(el, { scale: 1, duration: 0.3, ease: 'bounce.out' }, 0.95)
          .to(el, { opacity: 0, scale: 0.4, duration: 0.5, ease: 'power2.in' }, 2.6)
          .add(() => el.remove());
      });
    },
    absorb(from: DOMRect, src?: string | null) {
      const layer = tossRef.current;
      const root = rootRef.current;
      if (!layer || !root || reduced) {
        pulse();
        return;
      }
      const to = root.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'pl-absorb';
      if (src) {
        const im = document.createElement('img');
        im.src = src.startsWith('blob:') ? src : imageUrl(src);
        im.alt = '';
        el.appendChild(im);
      }
      document.body.appendChild(el);
      const size = Math.max(48, Math.min(90, from.width));
      gsap.set(el, { width: size, height: size, left: from.left + from.width / 2 - size / 2, top: from.top + from.height / 2 - size / 2 });
      gsap.to(el, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: 0.2,
        rotation: 200,
        opacity: 0.2,
        duration: 0.7,
        ease: 'power3.in',
        onComplete: () => {
          el.remove();
          pulse();
        },
      });
    },
  }));

  const diets = diet !== 'none';
  return (
    <div className={`pl-plate${grab ? ' is-grab' : ''}`} ref={rootRef} role="img" aria-label={alt}>
      <div className="pl-plate__cover" ref={coverRef}>
        <div className="pl-plate__grow" ref={growRef}>
          <div className="pl-plate__floor" ref={floorRef} />
          <div className="pl-plate__enter" ref={enterRef}>
            <div className="pl-plate__tilt" ref={tiltRef}>
              <svg className="pl-orbit" ref={orbitRef} viewBox="0 0 600 600" aria-hidden="true">
                <defs>
                  <path id="pl-orbit-path" d={`M300,300 m-${R},0 a${R},${R} 0 1,1 ${R * 2},0 a${R},${R} 0 1,1 -${R * 2},0`} />
                </defs>
                <text className="pl-orbit__text" style={{ letterSpacing: ring.ls }}>
                  <textPath href="#pl-orbit-path">
                    {Array.from({ length: ring.n }).flatMap((_, r) =>
                      seq.map((word, k) => (
                        <tspan key={`${r}-${k}`} className={`${hot === k ? 'is-hot' : ''}${warn.has(k) ? ' is-warn' : ''}`}>
                          {word}
                          <tspan className="pl-orbit__sep">{' • '}</tspan>
                        </tspan>
                      )),
                    )}
                  </textPath>
                </text>
              </svg>
              <div className="pl-plate__rim" ref={rimRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
                <div className="pl-plate__well">
                  <div className="pl-plate__scroll" ref={scrollRotRef}>
                    <div className="pl-plate__spin" ref={spinRef}>
                      {images.map((src, i) => (
                        <img key={src + i} className={i === index ? 'is-on' : ''} src={imageUrl(src)} alt="" draggable={false} decoding="async" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pl-plate__gloss" aria-hidden="true" />
              </div>
              {diets ? (
                <svg className={`pl-diet pl-diet--${diet}`} viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="46.5" pathLength="100" />
                </svg>
              ) : null}
            </div>
          </div>
          {steam && !reduced ? (
            <div className="pl-steam" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          ) : null}
          <div className="pl-toss" ref={tossRef} aria-hidden="true" />
        </div>
      </div>
      <div className="pl-cursor" ref={cursorRef} aria-hidden="true">
        <span>{grab ? 'Çeviriyorsun' : 'Çevir'}</span>
      </div>
    </div>
  );
});

export default Plate;
