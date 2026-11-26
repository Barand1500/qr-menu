import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, ArrowRight, Check, ChefHat, ChevronsUp, Loader2, RotateCcw, UtensilsCrossed } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import './receipt-printer.css';

export type ReceiptStage = 'processing' | 'printing' | 'complete' | 'error';

export type ReceiptData = {
  brandName: string;
  brandLogo?: string | null;
  tableLabel: string;
  items: { name: string; qty: number; line: string }[];
  total: string;
  note?: string;
  orderNo: number | null;
  at: Date;
  /** Aynı sipariş zaten iletilmişti */
  duplicate?: boolean;
};

/** Kağıdın yazıcıdan kademeli (satır satır) çıkışı: ms cinsinden toplam süre. Sunucu yanıtından sonra başlar. */
export const PRINT_MS = 2400;

const COPY = {
  tr: {
    processing: 'Siparişin alınıyor',
    printing: 'Fişin yazdırılıyor',
    complete: 'Sipariş iletildi',
    duplicate: 'Siparişin zaten iletilmişti',
    error: 'Sipariş gönderilemedi',
    total: 'Toplam',
    order: 'Sipariş no',
    table: 'Masa',
    date: 'Tarih',
    note: 'Not',
    thanks: 'Afiyet olsun!',
    waiter: 'Garsonumuz masana geliyor.',
    home: 'Menü',
    back: 'Menüye dön',
    backSub: 'Seni bekleyen daha bir sürü lezzet var',
    ballSub: 'Fişi top yaptın! Tut, savur, fırlat.',
    tearTab: 'Tut ve çek: kopar',
    tearBtn: 'Fişi kopar',
    retry: 'Tekrar dene',
    close: 'Kapat',
    machine: 'Sipariş fişi yazıcısı',
    stamp: 'SİPARİŞ ONAYLANDI',
    stampDup: 'DAHA ÖNCE İLETİLDİ',
    items: 'ürün',
    side: {
      processing: { k: 'Sipariş', h: 'Mutfağa yolluyoruz.', b: 'Bir saniye, siparişin yola çıktı.' },
      printing: { k: 'Sipariş', h: 'Fişin basılıyor.', b: 'Aşçı fişi okurken sen rahatla.' },
      done: { k: 'Sipariş onaylandı', h: 'Tamam, mutfak fişi aldı.', b: 'Fişi tutup yukarı çekerek koparabilirsin. Kopyası zaten bizde.' },
      dup: { k: 'Zaten iletilmişti', h: 'Bu sipariş bizde.', b: 'Merak etme, tekrar göndermedik. Fişi koparıp bakabilirsin.' },
      torn: { k: 'Koptu!', h: 'Tam bir profesyonel.', b: 'Bırakırsan buruşturup top yaparız.' },
      gone: { k: 'Hazırlanıyor', h: 'Fişini artık göremiyoruz.', b: 'Ama olsun, senin için çoktan hazırlanmaya başladık bile.' },
    },
  },
  en: {
    processing: 'Placing your order',
    printing: 'Printing your receipt',
    complete: 'Order sent',
    duplicate: 'Your order was already sent',
    error: 'Could not send order',
    total: 'Total',
    order: 'Order',
    table: 'Table',
    date: 'Date',
    note: 'Note',
    thanks: 'Enjoy your meal!',
    waiter: 'Your server is on the way.',
    home: 'Menu',
    back: 'Back to the menu',
    backSub: 'So many more dishes are waiting for you',
    ballSub: 'You made a paper ball! Grab it and toss it.',
    tearTab: 'Grab and pull to tear',
    tearBtn: 'Tear the receipt',
    retry: 'Try again',
    close: 'Close',
    machine: 'Order receipt printer',
    stamp: 'ORDER CONFIRMED',
    stampDup: 'ALREADY SENT',
    items: 'items',
    side: {
      processing: { k: 'Order', h: 'Sending it to the kitchen.', b: 'One second, your order is on its way.' },
      printing: { k: 'Order', h: 'Printing your ticket.', b: 'Relax while the chef reads it.' },
      done: { k: 'Order confirmed', h: 'Got it, the kitchen has it.', b: 'Grab the ticket and pull up to tear it off. We keep a copy anyway.' },
      dup: { k: 'Already sent', h: 'We already have this one.', b: 'No worries, we did not send it twice. Tear the ticket off and take a look.' },
      torn: { k: 'Torn!', h: 'A true professional.', b: 'Let go and we will crumple it into a ball.' },
      gone: { k: 'Cooking', h: 'We can no longer see your ticket.', b: 'But that is fine: we already started preparing it for you.' },
    },
  },
};

// Code 39: gerçek, tarayıcıyla okunabilir barkod (rakamlar ve * başlangıç/bitiş).
const C39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', '*': 'nwnnwnwnn',
};
function barcodeBars(value: string) {
  const text = `*${value}*`;
  const out: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const pattern = C39[ch];
    if (!pattern) continue;
    [...pattern].forEach((p, i) => {
      const w = p === 'w' ? 3 : 1;
      if (i % 2 === 0) out.push({ x, w });
      x += w;
    });
    x += 1; // karakterler arası boşluk
  }
  return { bars: out, width: x };
}

function Barcode({ value }: { value: string }) {
  const { bars, width } = barcodeBars(value);
  return (
    <svg className="rp-barcode" viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" role="img" aria-label={`Barkod ${value}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} />
      ))}
    </svg>
  );
}

type Phase = 'idle' | 'held' | 'free' | 'crumple' | 'ball' | 'gone';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const BALL = 70; // buruşmuş fiş topunun çapı (px)
const CRUMPLE_MS = 540;

// Buruşuk kağıt topu için sabit (rastgele ama her seferinde aynı) yüzeyler
const FACETS = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + rnd() * 0.45;
    const r = 20 + rnd() * 27;
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r] as const;
  });
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return {
      d: `M50 50 L${p[0].toFixed(1)} ${p[1].toFixed(1)} L${q[0].toFixed(1)} ${q[1].toFixed(1)}Z`,
      light: rnd() > 0.5,
      o: 0.07 + rnd() * 0.17,
      x: p[0],
      y: p[1],
    };
  });
})();

function PaperBall() {
  return (
    <svg viewBox="0 0 100 100" className="rp__ball-svg" aria-hidden="true">
      <defs>
        <radialGradient id="rp-ball-g" cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fbf8f1" />
          <stop offset="60%" stopColor="#e4ddcf" />
          <stop offset="100%" stopColor="#b9b0a0" />
        </radialGradient>
        <clipPath id="rp-ball-c">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#rp-ball-g)" />
      <g clipPath="url(#rp-ball-c)">
        {FACETS.map((f, i) => (
          <path key={i} d={f.d} fill={f.light ? '#fff' : '#000'} opacity={f.o} />
        ))}
        {FACETS.map((f, i) => (
          <line key={i} x1="50" y1="50" x2={f.x} y2={f.y} stroke="#000" strokeOpacity="0.16" strokeWidth="0.7" />
        ))}
        <rect x="26" y="40" width="30" height="2.4" rx="1.2" fill="#000" opacity="0.1" transform="rotate(-24 50 50)" />
        <rect x="34" y="55" width="36" height="2.4" rx="1.2" fill="#000" opacity="0.1" transform="rotate(-24 50 50)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="3" />
      </g>
    </svg>
  );
}

/**
 * Sipariş onayından sonraki "fiş yazıcısı" anı: makine ekranı durumu söyler, kağıt aşağıdan yukarı çıkar.
 * Fiş tutulup çekilince POS yazıcıdaki gibi kopar, bırakılınca buruşup top olur; top savrulabilir.
 * Hareket azaltma tercihinde ve klavyede düğmeyle de kopar.
 */
export default function ReceiptPrinter({
  open,
  stage,
  data,
  lang,
  errorMessage,
  onRetry,
  onClose,
}: {
  open: boolean;
  stage: ReceiptStage;
  data: ReceiptData | null;
  lang: string;
  errorMessage?: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = (lang || 'tr').split('-')[0] === 'en' ? COPY.en : COPY.tr;
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const feedRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [scrollable, setScrollable] = useState(false);
  const [shards, setShards] = useState(0);
  const g = useRef({
    ox: 0,
    oy: 0,
    sx: 0,
    sy: 0,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    rot: 0,
    moved: false,
    fromTab: false,
    auto: false,
    samples: [] as { t: number; x: number; y: number }[],
    raf: 0,
    last: 0,
    timers: [] as number[],
    ball: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, drag: false, dx: 0, dy: 0, asleep: true, samples: [] as { t: number; x: number; y: number }[] },
  });
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function go(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }
  function later(fn: () => void, ms: number) {
    g.current.timers.push(window.setTimeout(fn, ms));
  }
  function stopAll() {
    const s = g.current;
    window.cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.timers.forEach((id) => window.clearTimeout(id));
    s.timers = [];
  }

  // kapanınca / yeniden denenince her şeyi sıfırla
  useEffect(() => {
    if (open && stage === 'complete') return;
    stopAll();
    const s = g.current;
    s.px = s.py = s.rot = 0;
    s.ball.asleep = true;
    if (feedRef.current) {
      feedRef.current.style.transform = '';
      feedRef.current.style.transition = '';
    }
    phaseRef.current = 'idle';
    setPhase('idle');
    setShards(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage]);
  useEffect(() => stopAll, []);
  useLayoutEffect(() => {
    if (phase === 'ball') drawBall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Fiş ekrana sığmıyorsa küçültülür (en çok %62); yine de sığmıyorsa içinde kaydırılır ve kağıdın yerine alttaki "çek" tutamağı tutulur
  useEffect(() => {
    if (!open || stage === 'error') return;
    const fit = () => {
      const el = outRef.current;
      const paper = feedRef.current?.querySelector<HTMLElement>('.rp__paper');
      if (!el || !paper || phaseRef.current !== 'idle') return;
      paper.style.zoom = '';
      let z = 1;
      for (let i = 0; i < 4 && el.scrollHeight > el.clientHeight + 1 && z > 0.62; i++) {
        z = Math.max(0.62, z * ((el.clientHeight - 1) / el.scrollHeight));
        paper.style.zoom = String(z);
      }
      setScrollable(el.scrollHeight > el.clientHeight + 4);
    };
    const id = window.setTimeout(fit, stage === 'complete' ? 60 : 0);
    window.addEventListener('resize', fit);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', fit);
    };
  }, [open, stage, data]);

  function applyPaper() {
    const s = g.current;
    if (feedRef.current) feedRef.current.style.transform = `translate(${s.px}px, ${s.py}px) rotate(${s.rot}deg)`;
  }
  function drawBall() {
    const b = g.current.ball;
    if (ballRef.current) ballRef.current.style.transform = `translate(${b.x - BALL / 2}px, ${b.y - BALL / 2}px) rotate(${b.rot}deg)`;
  }

  function loop(now: number) {
    const s = g.current;
    const dt = Math.min(0.034, (now - s.last) / 1000 || 0.016);
    s.last = now;
    let again = false;

    if (phaseRef.current === 'free') {
      const k = 1 - Math.exp(-dt * 16);
      const before = s.px;
      s.px += (s.tx - s.px) * k;
      s.py += (s.ty - s.py) * k;
      const vx = (s.px - before) / dt;
      const sway = s.auto ? 7 : clamp(vx * 0.015, -26, 26) * (s.oy < 0 ? 1 : -1);
      s.rot += (sway - s.rot) * (1 - Math.exp(-dt * 9));
      applyPaper();
      again = true;
    }

    const b = s.ball;
    if (phaseRef.current === 'ball' && !b.asleep) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const r = BALL / 2;
      if (!b.drag) {
        b.vy += 2300 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += (b.vx / r) * dt * 57.3;
        if (b.y > H - r) {
          b.y = H - r;
          b.vy = -b.vy * 0.5;
          b.vx *= 0.84;
          if (Math.abs(b.vy) < 140) b.vy = 0;
        }
        if (b.y < r) {
          b.y = r;
          b.vy = Math.abs(b.vy) * 0.5;
        }
        if (b.x < r) {
          b.x = r;
          b.vx = Math.abs(b.vx) * 0.6;
        }
        if (b.x > W - r) {
          b.x = W - r;
          b.vx = -Math.abs(b.vx) * 0.6;
        }
        if (b.y >= H - r - 0.5 && Math.abs(b.vx) < 10 && b.vy === 0) {
          b.vx = 0;
          b.asleep = true;
        }
      }
      drawBall();
      again = again || !b.asleep || b.drag;
    }
    s.raf = again ? window.requestAnimationFrame(loop) : 0;
  }
  function ensureLoop() {
    const s = g.current;
    if (!s.raf) {
      s.last = performance.now();
      s.raf = window.requestAnimationFrame(loop);
    }
  }

  // ----- fişi tutma / kopma -----
  function down(e: ReactPointerEvent<HTMLElement>) {
    if (phaseRef.current !== 'idle' || stage !== 'complete' || reduce) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const feed = feedRef.current;
    if (!feed) return;
    const r = feed.getBoundingClientRect();
    const s = g.current;
    s.ox = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    s.oy = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.px = s.py = s.rot = s.tx = s.ty = 0;
    s.moved = false;
    s.fromTab = Boolean((e.target as Element | null)?.closest?.('.rp__tab'));
    s.auto = false;
    s.samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    feed.style.transition = 'none';
    feed.style.transformOrigin = `${(s.ox + 1) * 50}% ${(s.oy + 1) * 50}%`;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    go('held');
  }
  function tear() {
    const s = g.current;
    const last = s.samples[s.samples.length - 1];
    s.tx = last ? last.x - s.sx : 0;
    s.ty = last ? last.y - s.sy : 0;
    go('free');
    setShards((n) => n + 1);
    try {
      navigator.vibrate?.(24);
    } catch {
      /* titreşim yok */
    }
    ensureLoop();
  }
  function move(e: ReactPointerEvent<HTMLElement>) {
    const p = phaseRef.current;
    if (p !== 'held' && p !== 'free') return;
    const s = g.current;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    s.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (s.samples.length > 12) s.samples.shift();
    if (Math.hypot(dx, dy) > 6) s.moved = true;
    if (p === 'held') {
      // henüz yazıcıya bağlı: gerilir, kopmadan önce direnç gösterir
      s.px = clamp(dx * 0.4, -60, 60);
      s.py = clamp(dy * 0.4, -70, 40);
      s.rot = clamp(dx * 0.05, -7, 7);
      applyPaper();
      if (dy < -90 || Math.hypot(dx, dy) > 150) tear();
    } else {
      s.tx = dx;
      s.ty = dy;
    }
  }
  function release() {
    const s = g.current;
    const feed = feedRef.current;
    if (!feed) return;
    const now = performance.now();
    const recent = s.samples.filter((p) => now - p.t < 110);
    let vx = 0;
    let vy = 0;
    if (recent.length > 1) {
      const a = recent[0];
      const z = recent[recent.length - 1];
      const dt = Math.max(0.016, (z.t - a.t) / 1000);
      vx = clamp((z.x - a.x) / dt, -2600, 2600);
      vy = clamp((z.y - a.y) / dt, -2600, 2600);
    }
    const r = feed.getBoundingClientRect();
    s.ball.x = r.left + r.width / 2;
    s.ball.y = r.top + r.height / 2;
    s.ball.vx = vx * 0.6;
    s.ball.vy = vy * 0.6;
    s.ball.rot = 0;
    s.ball.drag = false;
    go('crumple');
    later(() => {
      go('ball');
      s.ball.asleep = false;
      drawBall();
      ensureLoop();
    }, CRUMPLE_MS);
  }
  function up(e: ReactPointerEvent<HTMLElement>) {
    const p = phaseRef.current;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* zaten bırakılmış */
    }
    if (p === 'held') {
      // koparamadı: yaylanarak yerine döner
      const feed = feedRef.current;
      const s = g.current;
      s.px = s.py = s.rot = 0;
      if (feed) {
        feed.style.transition = 'transform 0.5s cubic-bezier(0.3, 1.7, 0.5, 1)';
        feed.style.transform = '';
        later(() => {
          if (feed) feed.style.transition = '';
        }, 520);
      }
      go('idle');
      // tutamağa sürüklemeden dokunuldu: kendiliğinden kopar (işaretçi yakalandığı için tıklama olayı düğmeye gelmez)
      if (!g.current.moved && g.current.fromTab) later(autoTear, 30);
    } else if (p === 'free') {
      release();
    }
  }
  /** Düğme / klavye / dokunmadan kopar: kağıt kendiliğinden çekilir, buruşur ve zıplayan topa dönüşür. */
  function autoTear() {
    if (phaseRef.current !== 'idle' || stage !== 'complete') return;
    if (reduce) {
      go('gone');
      return;
    }
    const feed = feedRef.current;
    const s = g.current;
    if (!feed) return;
    s.ox = 0;
    s.oy = 0.7;
    s.px = s.py = s.rot = 0;
    s.tx = 0;
    s.ty = -170;
    s.auto = true;
    feed.style.transition = 'none';
    feed.style.transformOrigin = '50% 85%';
    go('free');
    setShards((n) => n + 1);
    try {
      navigator.vibrate?.(24);
    } catch {
      /* titreşim yok */
    }
    ensureLoop();
    later(() => {
      const now = performance.now();
      s.samples = [
        { t: now - 90, x: 0, y: 150 },
        { t: now, x: 0, y: 0 },
      ];
      if (phaseRef.current === 'free') release();
    }, 460);
  }
  function tabClick() {
    // sürüklenmeden tıklandıysa (klavye dahil) kendiliğinden kopar
    if (!g.current.moved) autoTear();
  }

  // ----- topu savurma -----
  function ballDown(e: ReactPointerEvent<HTMLElement>) {
    const b = g.current.ball;
    b.drag = true;
    b.asleep = false;
    b.dx = e.clientX - b.x;
    b.dy = e.clientY - b.y;
    b.vx = b.vy = 0;
    b.samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ensureLoop();
  }
  function ballMove(e: ReactPointerEvent<HTMLElement>) {
    const b = g.current.ball;
    if (!b.drag) return;
    b.x = clamp(e.clientX - b.dx, BALL / 2, window.innerWidth - BALL / 2);
    b.y = clamp(e.clientY - b.dy, BALL / 2, window.innerHeight - BALL / 2);
    b.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (b.samples.length > 10) b.samples.shift();
    drawBall();
  }
  function ballUp(e: ReactPointerEvent<HTMLElement>) {
    const b = g.current.ball;
    if (!b.drag) return;
    b.drag = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* zaten bırakılmış */
    }
    const now = performance.now();
    const recent = b.samples.filter((p) => now - p.t < 110);
    if (recent.length > 1) {
      const a = recent[0];
      const z = recent[recent.length - 1];
      const dt = Math.max(0.016, (z.t - a.t) / 1000);
      b.vx = clamp((z.x - a.x) / dt, -3200, 3200);
      b.vy = clamp((z.y - a.y) / dt, -3200, 3200);
    }
    b.asleep = false;
    ensureLoop();
  }

  useEffect(() => {
    if (!open) return;
    rootRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (stage === 'complete' || stage === 'error') && closeRef.current();
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
  }, [open, stage]);

  if (!open || !data) return null;
  const printed = stage === 'printing' || stage === 'complete';
  const dateText = data.at.toLocaleString(t === COPY.en ? 'en-GB' : 'tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const orderText = data.orderNo != null ? String(data.orderNo) : '';
  const torn = phase === 'free' || phase === 'crumple' || phase === 'ball' || phase === 'gone';
  const grabbable = stage === 'complete' && !reduce && !scrollable && (phase === 'idle' || phase === 'held' || phase === 'free');
  const grab = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up };
  const freeMode = phase === 'free' || phase === 'crumple';
  const msgKey = stage === 'processing' ? 'processing' : stage === 'printing' ? 'printing' : phase === 'ball' || phase === 'gone' ? 'gone' : torn ? 'torn' : data.duplicate ? 'dup' : 'done';
  const msg = t.side[msgKey];
  const itemCount = data.items.reduce((n, i) => n + i.qty, 0);
  const stampTime = data.at.toLocaleTimeString(t === COPY.en ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rp${freeMode ? ' is-free' : ''}`} ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.machine} data-stage={stage}>
      <div className="rp__glow" aria-hidden="true" />

      <button type="button" className="rp__back" onClick={onClose} disabled={stage === 'processing' || stage === 'printing'} tabIndex={stage === 'complete' ? 0 : -1} aria-hidden={stage !== 'complete'}>
        <span className="rp__back-icon" aria-hidden="true">
          <UtensilsCrossed size={24} />
        </span>
        <span className="rp__back-text">
          <strong>{t.back}</strong>
          <small>{phase === 'ball' ? t.ballSub : t.backSub}</small>
        </span>
        <span className="rp__back-go" aria-hidden="true">
          <ArrowRight size={22} />
        </span>
      </button>

      <div className="rp__stage">
        <section className="rp__machine">
          <header className="rp__head">
            <span className="rp__logo" aria-hidden="true">
              {data.brandLogo ? <img src={imageUrl(data.brandLogo)} alt="" data-no-fit /> : data.brandName.trim().charAt(0).toLocaleUpperCase('tr') || '•'}
            </span>
            <span className="rp__brand">{data.brandName}</span>
          </header>

          <div className="rp__screen">
            <div className="rp__sum">
              <div>
                <strong>{data.tableLabel}</strong>
                <small>
                  {data.items.reduce((n, i) => n + i.qty, 0)} {t === COPY.en ? 'items' : 'ürün'}
                </small>
              </div>
              <div>
                <small>{t.total}</small>
                <strong className="rp__total">{data.total}</strong>
              </div>
            </div>
            <div className="rp__status" role="status" aria-live="polite" key={`${stage}${msgKey === 'gone' ? 'g' : ''}`}>
              <span className={`rp__icon rp__icon--${stage}`} aria-hidden="true">
                {msgKey === 'gone' ? <ChefHat size={15} /> : stage === 'complete' ? <Check size={14} strokeWidth={3} /> : stage === 'error' ? <AlertCircle size={15} /> : <Loader2 size={15} className="rp__spin" />}
              </span>
              <span>{stage === 'error' ? errorMessage || t.error : msgKey === 'gone' ? t.side.gone.h : stage === 'complete' && data.duplicate ? t.duplicate : t[stage]}</span>
            </div>
          </div>
          <span className="rp__slot" aria-hidden="true" />
        </section>

        {stage === 'error' ? (
          <div className="rp__actions">
            <button type="button" className="rp__btn" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden /> {t.retry}
            </button>
            <button type="button" className="rp__btn rp__btn--ghost" onClick={onClose}>
              {t.close}
            </button>
          </div>
        ) : (
          <div ref={outRef} className={`rp__out${stage === 'complete' ? ' is-done' : ''}${freeMode || phase === 'ball' ? ' is-free' : ''}`}>
            {printed && !torn ? <span className="rp__shade" aria-hidden="true" /> : null}
            {torn ? <span className="rp__stub" aria-hidden="true" /> : null}
            {shards > 0 ? (
              <span className="rp__shards" key={shards} aria-hidden="true">
                {Array.from({ length: 10 }, (_, i) => {
                  const a = ((i / 9) * 150 - 75) * (Math.PI / 180);
                  const d = 46 + ((i * 37) % 70);
                  return <i key={i} style={{ ['--x' as string]: `${Math.round(Math.sin(a) * d)}px`, ['--y' as string]: `${-Math.round(Math.cos(a) * d * 0.9)}px`, ['--r' as string]: `${(i * 83) % 360}deg` } as CSSProperties} />;
                })}
              </span>
            ) : null}
            <div
              ref={feedRef}
              className={`rp__feed${stage === 'printing' ? ' is-feeding' : ''}${printed ? ' is-out' : ''}${grabbable ? ' is-grab' : ''}${phase === 'held' ? ' is-held' : ''}${phase === 'free' ? ' is-flying' : ''}${phase === 'crumple' ? ' is-crumple' : ''}${phase === 'ball' || phase === 'gone' ? ' is-hidden' : ''}`}
              style={{ ['--rp-ms' as string]: `${PRINT_MS}ms` }}
              {...(grabbable ? grab : {})}
            >
              <article className="rp__paper" aria-hidden={stage !== 'complete'}>
                <div className="rp__mark" aria-hidden="true">
                  {data.brandLogo ? <img src={imageUrl(data.brandLogo)} alt="" data-no-fit /> : <span>{data.brandName.trim().charAt(0).toLocaleUpperCase('tr') || '•'}</span>}
                </div>
                <p className="rp__name">{data.brandName}</p>
                <hr />
                {stage === 'complete' ? (
                  <div className={`rp__stamp${data.duplicate ? ' is-dup' : ''}`} aria-hidden="true">
                    <b>{data.duplicate ? t.stampDup : t.stamp}</b>
                    <small>{stampTime}</small>
                  </div>
                ) : null}
                <ul className="rp__lines">
                  {data.items.map((i, k) => (
                    <li key={k}>
                      <span>
                        <b>{i.qty}×</b> {i.name}
                      </span>
                      <em>{i.line}</em>
                    </li>
                  ))}
                </ul>
                {data.note ? <p className="rp__note">{t.note}: {data.note}</p> : null}
                <hr />
                <div className="rp__grand">
                  <span>{t.total}</span>
                  <strong>{data.total}</strong>
                </div>
                <hr />
                <dl className="rp__meta">
                  {orderText ? (
                    <div>
                      <dt>{t.order}</dt>
                      <dd>#{orderText}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t.table}</dt>
                    <dd>{data.tableLabel.replace(/^Masa\s+/i, '').replace(/^Table\s+/i, '')}</dd>
                  </div>
                  <div>
                    <dt>{t.date}</dt>
                    <dd>{dateText}</dd>
                  </div>
                </dl>
                {orderText ? (
                  <div className="rp__code">
                    <Barcode value={orderText} />
                    <small>ORD {orderText}</small>
                  </div>
                ) : null}
                <p className="rp__thanks">{t.thanks}</p>
                <p className="rp__sub">{t.waiter}</p>
                <svg className="rp__creases" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {FACETS.map((f, i) => (
                    <g key={i}>
                      <path d={f.d} fill={f.light ? '#fff' : '#000'} opacity={f.o * 1.6} />
                      <line x1="50" y1="50" x2={f.x} y2={f.y} stroke="#000" strokeOpacity="0.3" strokeWidth="0.5" />
                    </g>
                  ))}
                </svg>
              </article>
              {stage === 'complete' && (phase === 'idle' || phase === 'held') ? (
                <button type="button" className="rp__tab" onClick={tabClick} {...(scrollable && !reduce ? grab : {})}>
                  <ChevronsUp size={16} aria-hidden="true" /> {reduce ? t.tearBtn : t.tearTab}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {stage !== 'error' ? (
        <aside className={`rp__side rp__side--${msgKey}`} aria-hidden="true">
          <div className="rp__side-in" key={msgKey}>
            <span className="rp__kicker">
              {msgKey === 'gone' ? <ChefHat size={15} /> : <i />}
              {msg.k}
            </span>
            <h2>{msg.h}</h2>
            <p>{msg.b}</p>
            {stage === 'complete' ? (
              <div className="rp__chips">
                <span>{data.tableLabel}</span>
                <span>
                  {itemCount} {t.items}
                </span>
                <span>{data.total}</span>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      {phase === 'ball' ? (
        <div ref={ballRef} className="rp__ball" onPointerDown={ballDown} onPointerMove={ballMove} onPointerUp={ballUp} onPointerCancel={ballUp} aria-hidden="true">
          <PaperBall />
        </div>
      ) : null}
    </div>
  );
}
