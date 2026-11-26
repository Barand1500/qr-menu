import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { imageUrl } from '@/lib/api';

/**
 * Masaüstü kategori ön izlemesi: resim tek parça gelmez, maskenin parçaları ortadan büyüyerek
 * resmi parça parça ortaya çıkarır, sonra parçalar birbirine doğru büyüyüp BİRLEŞİR ve resmin tamamı görünür.
 * İmleç ayrılınca birleşik resim yeniden parçalanıp kenarlardan kapanır. Her kategori sırası farklı maske kullanır.
 */
type Shape = { x: number; y: number; w: number; h: number; r: number };
const W = 400;
const H = 500;

const grid = (cols: number, rows: number, gap: number, r: number): Shape[] => {
  const w = (W - gap * (cols - 1)) / cols;
  const h = (H - gap * (rows - 1)) / rows;
  return Array.from({ length: cols * rows }, (_, i) => ({ x: (i % cols) * (w + gap), y: Math.floor(i / cols) * (h + gap), w, h, r }));
};

// gx/gy: parçalar arası boşluk; birleşirken parçalar bu boşluğu kapatacak kadar büyür. rEnd: birleşik hâldeki köşe yuvarlaklığı
const VARIANTS: { shapes: Shape[]; from: 'random' | 'start' | 'center' | 'edges'; gx: number; gy: number; rEnd: number }[] = [
  // kareler
  { shapes: grid(3, 4, 14, 10), from: 'random', gx: 14, gy: 14, rEnd: 6 },
  // yatay hapsı çubuklar (yukarıdan aşağı süpürür)
  { shapes: Array.from({ length: 6 }, (_, i) => ({ x: 0, y: i * 86.4, w: W, h: 68, r: 34 })), from: 'start', gx: 0, gy: 18.4, rEnd: 8 },
  // düzensiz mozaik
  {
    shapes: [
      { x: 0, y: 0, w: 200, h: 280, r: 18 },
      { x: 220, y: 0, w: 180, h: 130, r: 18 },
      { x: 220, y: 150, w: 180, h: 130, r: 18 },
      { x: 0, y: 300, w: 130, h: 200, r: 18 },
      { x: 150, y: 300, w: 250, h: 200, r: 18 },
    ],
    from: 'random',
    gx: 20,
    gy: 20,
    rEnd: 8,
  },
  // daireler (ortadan dışa)
  { shapes: Array.from({ length: 12 }, (_, i) => ({ x: (i % 3) * 130 + 8, y: Math.floor(i / 3) * 123 + 0.5, w: 124, h: 124, r: 62 })), from: 'center', gx: 6, gy: 0, rEnd: 6 },
  // dikey çubuklar (soldan sağa süpürür)
  { shapes: Array.from({ length: 5 }, (_, i) => ({ x: i * 84, y: 0, w: 64, h: H, r: 32 })), from: 'start', gx: 20, gy: 0, rEnd: 8 },
];

export type PeekItem = { src: string; i: number };

export default function SahnePeek({ item }: { item: PeekItem | null }) {
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const token = useRef(0);
  const last = useRef<PeekItem | null>(item);
  if (item) last.current = item;
  const shown = last.current;
  const variant = VARIANTS[(shown?.i ?? 0) % VARIANTS.length];
  const src = shown ? (shown.src.startsWith('blob:') ? shown.src : imageUrl(shown.src)) : '';

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mine = ++token.current;
    tl.current?.kill();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const paths = () => el.querySelectorAll<SVGRectElement>('.pk-shape');
    const full = () => el.querySelectorAll<SVGRectElement>('.pk-full');

    if (!item) {
      if (reduce) {
        el.style.visibility = 'hidden';
        return;
      }
      // birleşik resim önce yeniden parçalanır, sonra parçalar kenarlardan kapanır
      gsap.set(full(), { scale: 0 });
      gsap.set(paths(), { scaleX: (_i, t) => Number((t as SVGElement).dataset.sx), scaleY: (_i, t) => Number((t as SVGElement).dataset.sy), attr: { rx: (_i: number, t: Element) => Number((t as SVGElement).dataset.rx) } });
      tl.current = gsap
        .timeline({
          onComplete: () => {
            if (token.current === mine) el.style.visibility = 'hidden';
          },
        })
        .to(paths(), { scaleX: 1, scaleY: 1, attr: { rx: (_i: number, t: Element) => Number((t as SVGElement).dataset.r) }, duration: 0.28, ease: 'power2.inOut' })
        .to(paths(), { scale: 0, duration: 0.3, stagger: { amount: 0.18, from: 'edges' }, ease: 'expo.in' }, '>-0.02');
      return;
    }

    let started = false;
    const start = () => {
      if (started || token.current !== mine) return;
      started = true;
      el.style.visibility = 'visible';
      gsap.set(full(), { scale: 0, transformOrigin: '50% 50%' });
      if (reduce) {
        gsap.set(paths(), { scale: 0 });
        gsap.set(full(), { scale: 1 });
        return;
      }
      gsap.set(paths(), { scale: 0, transformOrigin: '50% 50%' });
      tl.current = gsap
        .timeline()
        // 1) parçalar ortadan büyüyerek resmi parça parça açar
        .to(paths(), { scale: 1, duration: 0.7, stagger: { amount: 0.36, from: variant.from }, ease: 'expo.out' })
        // 2) parçalar birbirine doğru büyüyüp birleşir: aradaki boşluklar kapanır, resmin tamamı görünür
        .to(
          paths(),
          {
            scaleX: (_i, t) => Number((t as SVGElement).dataset.sx),
            scaleY: (_i, t) => Number((t as SVGElement).dataset.sy),
            attr: { rx: (_i: number, t: Element) => Number((t as SVGElement).dataset.rx) },
            duration: 0.75,
            ease: 'power3.inOut',
            stagger: { amount: 0.14, from: 'center' },
          },
          '+=0.12',
        )
        // 3) birleşik hâl tek yuvarlak köşeli resme dönüşür (köşeler temizlenir)
        .add(() => {
          gsap.set(full(), { scale: 1 });
          gsap.set(paths(), { scale: 0 });
        });
    };
    // resim gelmeden maske açılmasın: boş parçalar görünmesin
    const im = new Image();
    im.onload = start;
    im.onerror = start;
    im.src = src;
    if (im.complete) start();
    return () => {
      im.onload = null;
      im.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.src, item?.i]);

  useEffect(
    () => () => {
      token.current++;
      tl.current?.kill();
    },
    [],
  );

  return (
    <div className="sh-peek" ref={root} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="sh-peek__svg" key={shown?.i}>
        <defs>
          <clipPath id="sh-peek-clip">
            {variant.shapes.map((s, k) => (
              <rect
                key={k}
                className="pk-shape"
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                rx={s.r}
                data-r={s.r}
                data-rx={variant.rEnd}
                data-sx={((s.w + variant.gx) / s.w) * 1.04}
                data-sy={((s.h + variant.gy) / s.h) * 1.04}
              />
            ))}
            <rect className="pk-full" x={0} y={0} width={W} height={H} rx={26} />
          </clipPath>
        </defs>
        <g clipPath="url(#sh-peek-clip)">
          {src ? <image href={src} width={W} height={H} preserveAspectRatio="xMidYMid slice" /> : null}
        </g>
      </svg>
    </div>
  );
}
