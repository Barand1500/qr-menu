import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Check, ChevronRight, Coins, Play, RotateCcw, Trophy, UserRound, X } from 'lucide-react';

type Obstacle = { x: number; w: number; h: number; kind: 0 | 1 | 2 };
type Tip = { x: number; y: number; taken: boolean };
type Pop = { x: number; y: number; life: number; text: string };
type Puff = { x: number; y: number; vx: number; vy: number; life: number };
type BoardEntry = { name: string; score: number; at: string };

// Oyun, ekran boyutundan bağımsız sabit bir sahnede (352x220) çalışır; canvas CSS ile ölçeklenir.
const VW = 352;
const VH = 220;
const GROUND = 172;
const PLAYER_X = 52;
const PLAYER_W = 30;
const PLAYER_H = 40;
const START_SPEED = 2.5;
const MAX_SPEED = 5.4;
const GRAVITY = 0.42;
const JUMP_VY = -8.4;
const NAME_KEY = 'maint_runner_name';
const TIP_SCORE = 10;

type Props = { slug: string };

export default function MaintenanceRunnerGame({ slug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [tips, setTips] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(`maint_runner_best_${slug}`) || 0);
    } catch {
      return 0;
    }
  });
  const [alive, setAlive] = useState(true);
  const [started, setStarted] = useState(false);
  const [record, setRecord] = useState(false);
  const [awaitingName, setAwaitingName] = useState(false);
  const [pendingScore, setPendingScore] = useState(0);
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const awaitNameRef = useRef(false);
  awaitNameRef.current = awaitingName;
  const bestRef = useRef(best);
  bestRef.current = best;
  const stateRef = useRef({
    running: false,
    dead: false,
    y: GROUND - PLAYER_H,
    vy: 0,
    onGround: true,
    speed: START_SPEED,
    distance: 0,
    obstacles: [] as Obstacle[],
    tips: [] as Tip[],
    pops: [] as Pop[],
    puffs: [] as Puff[],
    spawnIn: 90,
    frame: 0,
    score: 0,
    tipCount: 0,
    jumpBuf: 0,
    shake: 0,
    blockRestart: false,
  });
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    api<{ scores: BoardEntry[] }>(`/api/menu/${slug}/maintenance/scores`)
      .then((res) => {
        if (!cancelled) setBoard(res.scores || []);
      })
      .catch(() => {
        if (!cancelled) setBoard([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const canvas: HTMLCanvasElement = el;
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = canvas.clientWidth || VW;
      const h = canvas.clientHeight || VH;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(canvas.width / VW, 0, 0, canvas.height / VH, 0, 0);
    }
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    function reset() {
      const s = stateRef.current;
      s.running = true;
      s.dead = false;
      s.blockRestart = false;
      s.y = GROUND - PLAYER_H;
      s.vy = 0;
      s.onGround = true;
      s.speed = START_SPEED;
      s.distance = 0;
      s.obstacles = [];
      s.tips = [];
      s.pops = [];
      s.puffs = [];
      s.spawnIn = 80;
      s.frame = 0;
      s.score = 0;
      s.tipCount = 0;
      s.jumpBuf = 0;
      s.shake = 0;
      setAlive(true);
      setScore(0);
      setTips(0);
      setStarted(true);
      setRecord(false);
      setAwaitingName(false);
      setSaveMsg('');
    }
    resetRef.current = reset;

    function jump() {
      const s = stateRef.current;
      if (s.blockRestart) return;
      if (s.dead || !s.running) {
        reset();
        return;
      }
      if (s.onGround) {
        s.vy = JUMP_VY;
        s.onGround = false;
        puff(s, PLAYER_X + 14, GROUND, 3);
      } else {
        s.jumpBuf = 8; // yere inmeden hemen önce basılan zıplama kaybolmasın
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(t.tagName)) return;
      if (stateRef.current.blockRestart) return;
      e.preventDefault();
      jump();
    }
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', jump);

    function puff(s: typeof stateRef.current, x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) {
        s.puffs.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y - 2,
          vx: -0.6 - Math.random() * 0.9,
          vy: -0.25 - Math.random() * 0.5,
          life: 1,
        });
      }
    }

    function spawn(s: typeof stateRef.current) {
      const kind = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const sizes = [
        { w: 26, h: 30 },
        { w: 32, h: 22 },
        { w: 22, h: 36 },
      ];
      const size = sizes[kind];
      const x = VW + 14;
      s.obstacles.push({ x, w: size.w, h: size.h, kind });
      // Engelin üstüne bahşiş yayı: zıplamayı ödüllendirir
      if (Math.random() < 0.7) {
        for (let i = -1; i <= 1; i++) {
          s.tips.push({
            x: x + size.w / 2 + i * 17,
            y: GROUND - 58 - (1 - Math.abs(i) * 0.6) * 14,
            taken: false,
          });
        }
      }
    }

    function drawScene(s: typeof stateRef.current) {
      // Arka duvar: sıcak gece tonu
      const wall = ctx.createLinearGradient(0, 0, 0, GROUND);
      wall.addColorStop(0, '#24150f');
      wall.addColorStop(0.6, '#3a2217');
      wall.addColorStop(1, '#4d2e1d');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, VW, GROUND);

      // Uzak katman: akşamüstü pencereleri
      const farScroll = (s.distance * 0.18) % 150;
      for (let i = -1; i < Math.ceil(VW / 150) + 2; i++) {
        const wx = i * 150 - farScroll + 20;
        const wy = 30;
        const sky = ctx.createLinearGradient(0, wy, 0, wy + 78);
        sky.addColorStop(0, '#5a3b7a');
        sky.addColorStop(0.55, '#d9683f');
        sky.addColorStop(1, '#ffb45e');
        ctx.fillStyle = sky;
        roundRect(ctx, wx, wy, 78, 78, 6);
        ctx.fill();
        // şehir silüeti
        ctx.fillStyle = 'rgba(30, 16, 28, 0.85)';
        const blds = [14, 26, 18, 32, 20, 12];
        let bx = wx + 2;
        for (const bh of blds) {
          ctx.fillRect(bx, wy + 78 - bh, 12, bh);
          bx += 12.5;
        }
        // çerçeve
        ctx.strokeStyle = '#1b0f0a';
        ctx.lineWidth = 4;
        roundRect(ctx, wx, wy, 78, 78, 6);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx + 39, wy);
        ctx.lineTo(wx + 39, wy + 78);
        ctx.moveTo(wx, wy + 39);
        ctx.lineTo(wx + 78, wy + 39);
        ctx.stroke();
      }

      // Orta katman: sarkıt lambalar ve ışık huzmesi
      const midScroll = (s.distance * 0.45) % 128;
      for (let i = -1; i < Math.ceil(VW / 128) + 2; i++) {
        const lx = i * 128 - midScroll + 64;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 20);
        ctx.stroke();
        const cone = ctx.createLinearGradient(0, 26, 0, GROUND);
        cone.addColorStop(0, 'rgba(255, 190, 100, 0.2)');
        cone.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(lx - 9, 26);
        ctx.lineTo(lx + 9, 26);
        ctx.lineTo(lx + 46, GROUND);
        ctx.lineTo(lx - 46, GROUND);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1b0f0a';
        ctx.beginPath();
        ctx.moveTo(lx - 11, 26);
        ctx.quadraticCurveTo(lx, 12, lx + 11, 26);
        ctx.closePath();
        ctx.fill();
        const bulb = ctx.createRadialGradient(lx, 27, 1, lx, 27, 16);
        bulb.addColorStop(0, 'rgba(255, 226, 150, 0.95)');
        bulb.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = bulb;
        ctx.beginPath();
        ctx.arc(lx, 27, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lambri
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, GROUND - 22, VW, 22);
      ctx.fillStyle = 'rgba(255, 190, 120, 0.18)';
      ctx.fillRect(0, GROUND - 22, VW, 2);

      // Zemin
      const floor = ctx.createLinearGradient(0, GROUND, 0, VH);
      floor.addColorStop(0, '#6a4128');
      floor.addColorStop(1, '#3d2314');
      ctx.fillStyle = floor;
      ctx.fillRect(0, GROUND, VW, VH - GROUND);
      ctx.fillStyle = 'rgba(255, 200, 130, 0.35)';
      ctx.fillRect(0, GROUND, VW, 2);

      // Lamba ışığı yansıması (zeminde)
      for (let i = -1; i < Math.ceil(VW / 128) + 2; i++) {
        const lx = i * 128 - midScroll + 64;
        const pool = ctx.createRadialGradient(lx, GROUND + 14, 2, lx, GROUND + 14, 52);
        pool.addColorStop(0, 'rgba(255, 190, 100, 0.2)');
        pool.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = pool;
        ctx.fillRect(lx - 52, GROUND, 104, VH - GROUND);
      }

      // Tahta aralıkları
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 1;
      const plank = s.distance % 40;
      for (let i = -1; i < Math.ceil(VW / 40) + 2; i++) {
        const gx = i * 40 - plank;
        ctx.beginPath();
        ctx.moveTo(gx, GROUND + 4);
        ctx.lineTo(gx - 10, VH);
        ctx.stroke();
      }

      // Hız çizgileri
      if (s.running && !s.dead && s.speed > 3.6) {
        ctx.strokeStyle = 'rgba(255, 230, 190, 0.16)';
        for (let i = 0; i < 6; i++) {
          const ly = 70 + ((i * 37 + s.frame * 3) % 100);
          const lx = VW - ((s.frame * (s.speed + i)) % (VW + 60));
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + 26, ly);
          ctx.stroke();
        }
      }
    }

    function drawShadow(cx: number, ry: number, rw: number) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, GROUND + 1, rw, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawWaiter(x: number, y: number, frame: number, running: boolean) {
      const onGround = stateRef.current.onGround;
      const bob = Math.sin(frame / 5) * (onGround ? 1.4 : 0);
      const squash = onGround ? 1 : 0.92;
      const stretch = onGround ? 1 : 1.06;
      const stride = running ? Math.sin(frame / 4) * (onGround ? 5 : 0) : 0;

      drawShadow(x + 15, onGround ? 4.5 : 3, onGround ? 14 : 10);

      ctx.save();
      ctx.translate(x + 15, y + PLAYER_H);
      ctx.scale(squash, stretch);
      ctx.translate(-(x + 15), -(y + PLAYER_H));

      ctx.strokeStyle = '#1c1410';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      if (onGround) {
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 30 + bob);
        ctx.lineTo(x + 10 - stride, y + 39);
        ctx.moveTo(x + 18, y + 30 + bob);
        ctx.lineTo(x + 20 + stride, y + 39);
        ctx.stroke();
        ctx.fillStyle = '#0f0a07';
        roundRect(ctx, x + 6 - stride, y + 37, 8, 3.5, 1.5);
        ctx.fill();
        roundRect(ctx, x + 16 + stride, y + 37, 8, 3.5, 1.5);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 30);
        ctx.lineTo(x + 8, y + 37);
        ctx.moveTo(x + 18, y + 30);
        ctx.lineTo(x + 24, y + 35);
        ctx.stroke();
      }

      const shirt = ctx.createLinearGradient(x + 6, y + 10, x + 22, y + 32);
      shirt.addColorStop(0, '#fffaf3');
      shirt.addColorStop(1, '#eadcc8');
      ctx.fillStyle = shirt;
      roundRect(ctx, x + 7, y + 12 + bob, 16, 18, 5);
      ctx.fill();

      ctx.fillStyle = '#c2410c';
      roundRect(ctx, x + 9, y + 18 + bob, 12, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#e0612a';
      roundRect(ctx, x + 10, y + 19 + bob, 10, 3, 1);
      ctx.fill();

      ctx.strokeStyle = '#e8c4a0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 22, y + 16 + bob);
      ctx.lineTo(x + 28, y + 18 + bob);
      ctx.stroke();

      ctx.fillStyle = '#aab2bd';
      roundRect(ctx, x + 24, y + 16 + bob, 16, 3.5, 1.5);
      ctx.fill();
      ctx.fillStyle = '#d6dce4';
      roundRect(ctx, x + 25, y + 15.5 + bob, 14, 1.5, 1);
      ctx.fill();

      ctx.fillStyle = '#fff8ef';
      roundRect(ctx, x + 28, y + 9 + bob, 7, 7, 1.5);
      ctx.fill();
      ctx.fillStyle = '#6b3e24';
      roundRect(ctx, x + 29, y + 10 + bob, 5, 4, 1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.2;
      const steam = Math.sin(frame / 8) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 31.5, y + 8 + bob);
      ctx.quadraticCurveTo(x + 33 + steam, y + 4 + bob, x + 30.5, y + 1 + bob);
      ctx.stroke();

      ctx.fillStyle = '#f0c49a';
      ctx.beginPath();
      ctx.arc(x + 15, y + 9 + bob, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(232, 120, 100, 0.3)';
      ctx.beginPath();
      ctx.arc(x + 11, y + 10.5 + bob, 1.8, 0, Math.PI * 2);
      ctx.arc(x + 19, y + 10.5 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c2118';
      ctx.beginPath();
      ctx.arc(x + 12.5, y + 8.5 + bob, 1.1, 0, Math.PI * 2);
      ctx.arc(x + 17.5, y + 8.5 + bob, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b07050';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + 15, y + 10.5 + bob, 2.4, 0.15, Math.PI - 0.15);
      ctx.stroke();

      ctx.fillStyle = '#ffb454';
      ctx.beginPath();
      ctx.moveTo(x + 15, y + 14.5 + bob);
      ctx.lineTo(x + 11, y + 12.5 + bob);
      ctx.lineTo(x + 11, y + 16.5 + bob);
      ctx.closePath();
      ctx.moveTo(x + 15, y + 14.5 + bob);
      ctx.lineTo(x + 19, y + 12.5 + bob);
      ctx.lineTo(x + 19, y + 16.5 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + 8, y - 1 + bob, 14, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#f1efec';
      roundRect(ctx, x + 9.5, y + 4 + bob, 11, 3.5, 1.5);
      ctx.fill();

      ctx.restore();
    }

    function drawObstacle(o: Obstacle, frame: number) {
      const y = GROUND - o.h;
      drawShadow(o.x + o.w / 2, 3.5, o.w * 0.46);

      if (o.kind === 0) {
        ctx.fillStyle = '#8a5a2b';
        roundRect(ctx, o.x + 3, y, o.w - 6, 10, 2);
        ctx.fill();
        ctx.fillStyle = '#b07a45';
        roundRect(ctx, o.x + 5, y + 2, o.w - 10, 6, 1.5);
        ctx.fill();
        ctx.fillStyle = '#c28a52';
        roundRect(ctx, o.x, y + 10, o.w, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#dba46b';
        roundRect(ctx, o.x + 2, y + 11, o.w - 4, 3, 1);
        ctx.fill();
        ctx.strokeStyle = '#5b3a1d';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(o.x + 4, y + 18);
        ctx.lineTo(o.x + 3, y + o.h);
        ctx.moveTo(o.x + o.w - 4, y + 18);
        ctx.lineTo(o.x + o.w - 3, y + o.h);
        ctx.stroke();
      } else if (o.kind === 1) {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.4)';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 + 6, GROUND - 2, 11, 3, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e4e4e7';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, GROUND - 6, o.w / 2.2, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, GROUND - 8, o.w / 2.6, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 - 3, GROUND - 9, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.2;
        const st = Math.sin(frame / 10) * 2;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2 - 2, GROUND - 14);
        ctx.quadraticCurveTo(o.x + o.w / 2 + st, GROUND - 20, o.x + o.w / 2 - 1, GROUND - 24);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#6b4a2e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const mid = o.x + o.w / 2;
        ctx.beginPath();
        ctx.moveTo(mid - 8, GROUND);
        ctx.lineTo(mid, y + 4);
        ctx.lineTo(mid + 8, GROUND);
        ctx.stroke();
        ctx.fillStyle = '#2a2a2e';
        roundRect(ctx, o.x, y, o.w, 18, 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb454';
        ctx.lineWidth = 1.2;
        roundRect(ctx, o.x + 2, y + 2, o.w - 4, 14, 1.5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 241, 220, 0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(o.x + 5, y + 6 + i * 3.5);
          ctx.lineTo(o.x + o.w - 5, y + 6 + i * 3.5);
          ctx.stroke();
        }
      }
    }

    function drawTip(t: Tip, frame: number) {
      const spin = Math.abs(Math.cos(frame / 14 + t.x / 20));
      const bobY = Math.sin(frame / 10 + t.x / 15) * 2;
      const glow = ctx.createRadialGradient(t.x, t.y + bobY, 1, t.x, t.y + bobY, 13);
      glow.addColorStop(0, 'rgba(255, 210, 100, 0.55)');
      glow.addColorStop(1, 'rgba(255, 210, 100, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(t.x, t.y + bobY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + bobY, 6 * Math.max(spin, 0.25), 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d48a12';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(t.x - 1.5 * spin, t.y - 2 + bobY, 1.4 * spin, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function onDeath(finalScore: number) {
      const isRecord = finalScore > bestRef.current && finalScore > 0;
      setAlive(false);
      setScore(finalScore);
      setRecord(isRecord);
      setBest((b) => {
        const next = Math.max(b, finalScore);
        try {
          localStorage.setItem(`maint_runner_best_${slug}`, String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      stateRef.current.blockRestart = true;
      setPendingScore(finalScore);
      setAwaitingName(finalScore >= 1);
      // Ölüm ekranı yanlışlıkla atlanmasın: kısa süre sonra tekrar başlatılabilir
      window.setTimeout(() => {
        if (!awaitNameRef.current) stateRef.current.blockRestart = false;
      }, 600);
    }

    function tick() {
      const s = stateRef.current;
      s.frame += 1;
      const playing = s.running && !s.dead;

      if (!playing && !s.dead) s.distance += 0.6; // bekleme ekranında sahne yavaşça akar
      ctx.save();
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
        s.shake -= 1;
      }
      drawScene(s);

      if (playing) {
        const wasAir = !s.onGround;
        s.vy += GRAVITY;
        s.y += s.vy;
        if (s.y >= GROUND - PLAYER_H) {
          s.y = GROUND - PLAYER_H;
          s.vy = 0;
          s.onGround = true;
          if (wasAir) {
            puff(s, PLAYER_X + 14, GROUND, 4);
            if (s.jumpBuf > 0) {
              s.vy = JUMP_VY;
              s.onGround = false;
              s.jumpBuf = 0;
            }
          }
        }
        if (s.jumpBuf > 0) s.jumpBuf -= 1;
        s.distance += s.speed;
        s.speed = Math.min(MAX_SPEED, START_SPEED + s.distance / 3000);
        s.spawnIn -= 1;
        if (s.spawnIn <= 0) {
          spawn(s);
          s.spawnIn = 82 + Math.floor(Math.random() * 64) - Math.floor(s.speed * 3);
        }
        for (const o of s.obstacles) o.x -= s.speed;
        for (const t of s.tips) t.x -= s.speed;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -24);
        s.tips = s.tips.filter((t) => t.x > -20 && !t.taken);

        const px = PLAYER_X;
        const py = s.y;
        for (const o of s.obstacles) {
          const hit =
            px + 5 < o.x + o.w - 4 &&
            px + PLAYER_W - 5 > o.x + 4 &&
            py + 8 < GROUND - 2 &&
            py + PLAYER_H > GROUND - o.h + 2;
          if (hit) {
            s.dead = true;
            s.running = false;
            s.shake = 10;
            puff(s, PLAYER_X + 14, GROUND - 10, 8);
            onDeath(Math.floor(s.distance / 10) + s.tipCount * TIP_SCORE);
            break;
          }
        }
        for (const t of s.tips) {
          if (t.taken) continue;
          if (t.x > px - 4 && t.x < px + PLAYER_W + 6 && t.y > py - 6 && t.y < py + PLAYER_H + 4) {
            t.taken = true;
            s.tipCount += 1;
            s.pops.push({ x: t.x, y: t.y, life: 1, text: `+${TIP_SCORE}` });
            setTips(s.tipCount);
          }
        }
        const live = Math.floor(s.distance / 10) + s.tipCount * TIP_SCORE;
        s.score = live;
        if (s.frame % 6 === 0) setScore(live);
      }

      for (const t of s.tips) if (!t.taken) drawTip(t, s.frame);
      for (const o of s.obstacles) drawObstacle(o, s.frame);

      // toz bulutları
      for (const p of s.puffs) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.035;
        ctx.fillStyle = `rgba(255, 235, 205, ${Math.max(p.life, 0) * 0.45})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + (1 - p.life) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      s.puffs = s.puffs.filter((p) => p.life > 0);

      drawWaiter(PLAYER_X, s.y, s.frame, playing);

      // +10 yazıları
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const p of s.pops) {
        p.y -= 0.7;
        p.life -= 0.03;
        ctx.fillStyle = `rgba(255, 214, 110, ${Math.max(p.life, 0)})`;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.textAlign = 'left';
      s.pops = s.pops.filter((p) => p.life > 0);

      if (s.dead) {
        ctx.fillStyle = 'rgba(20, 10, 5, 0.45)';
        ctx.fillRect(0, 0, VW, VH);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', jump);
      ro?.disconnect();
    };
  }, [slug]);


  async function submitScore(e: React.FormEvent) {
    e.preventDefault();
    const name = playerName.trim();
    if (name.length < 2) {
      setSaveMsg('En az 2 karakterlik bir isim yazın');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await api<{ scores: BoardEntry[] }>(`/api/menu/${slug}/maintenance/scores`, {
        method: 'POST',
        body: JSON.stringify({ name, score: pendingScore }),
      });
      setBoard(res.scores || []);
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch {
        /* ignore */
      }
      setSaveMsg('Sıralamaya eklendi!');
      stateRef.current.blockRestart = false;
      setAwaitingName(false);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  const [boardOpen, setBoardOpen] = useState(false);

  // Mobilde sıralama alttan açılan kutu: Escape ile kapanır, arka plan kaymaz.
  useEffect(() => {
    if (!boardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBoardOpen(false);
    };
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [boardOpen]);

  const showOver = started && !alive;
  const me = playerName.trim().toLocaleLowerCase('tr');
  const slots = [
    { rank: 2, e: board[1] },
    { rank: 1, e: board[0] },
    { rank: 3, e: board[2] },
  ];
  const rest = board.slice(3, showAll ? 15 : 7);
  const leader = board[0];

  return (
    <div className="maint-play">
      <section className="maint-game" aria-label="Garson Koşusu">
        <div className="maint-game__stage">
          <canvas
            ref={canvasRef}
            className="maint-game__canvas"
            role="img"
            aria-label="Garson koşu oyunu: engellerin üstünden zıpla, bahşişleri topla"
          />

          <div className="maint-hud" aria-live="off">
            <span className="maint-hud__score">
              <small>Skor</small>
              <b>{score}</b>
            </span>
            <span className="maint-hud__chip" title="Topladığın bahşiş">
              <Coins size={14} />
              {tips}
            </span>
            <span className="maint-hud__chip" title="En yüksek skorun">
              <Trophy size={14} />
              {best}
            </span>
          </div>

          {!started ? (
            <div className="maint-start">
              <span className="maint-start__play">
                <Play size={22} fill="currentColor" />
              </span>
              <strong>Garson Koşusu</strong>
              <span>Dokun ve başla</span>
            </div>
          ) : null}

          {showOver ? (
            <div className="maint-over" onPointerDown={(e) => e.stopPropagation()}>
              <p className="maint-over__kicker">{record ? 'Yeni rekor!' : 'Tepsi düştü'}</p>
              <p className="maint-over__score">{pendingScore || score}</p>
              <p className="maint-over__sub">{tips} bahşiş topladın</p>

              {awaitingName ? (
                <form className="maint-name" onSubmit={(e) => void submitScore(e)}>
                  <UserRound size={18} aria-hidden />
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={24}
                    placeholder="Adını yaz"
                    aria-label="Sıralamada görünecek adın"
                    autoComplete="nickname"
                    enterKeyHint="done"
                  />
                  <button type="submit" disabled={saving} aria-label="Skoru kaydet">
                    {saving ? '…' : <Check size={20} />}
                  </button>
                </form>
              ) : null}
              {saveMsg ? <p className="maint-over__msg">{saveMsg}</p> : null}

              <div className="maint-over__actions">
                <button
                  type="button"
                  className={`maint-over__again${awaitingName ? '' : ' is-primary'}`}
                  onClick={() => resetRef.current()}
                >
                  <RotateCcw size={16} /> Tekrar oyna
                </button>
                <button
                  type="button"
                  className="maint-over__rank"
                  onClick={() => setBoardOpen(true)}
                >
                  <Trophy size={16} /> Sıralama
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobil: sıralamayı açan şerit */}
        <button type="button" className="maint-teaser" onClick={() => setBoardOpen(true)}>
          <span className="maint-teaser__icon">
            <Trophy size={18} />
          </span>
          <span className="maint-teaser__text">
            <b>Günün sıralaması</b>
            <small>
              {leader ? `Lider: ${leader.name} · ${leader.score}` : 'Henüz skor yok, ilk sen ol'}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
      </section>

      {boardOpen ? (
        <div className="maint-sheet-backdrop" onClick={() => setBoardOpen(false)} aria-hidden />
      ) : null}
      <section
        className={`maint-board${boardOpen ? ' is-open' : ''}`}
        role={boardOpen ? 'dialog' : undefined}
        aria-modal={boardOpen ? true : undefined}
        aria-label="Günün sıralaması"
      >
        <div className="maint-board__grab" aria-hidden />
        <header className="maint-board__head">
          <h2>
            <Trophy size={18} /> Günün şampiyonları
          </h2>
          <button
            type="button"
            className="maint-board__close"
            aria-label="Sıralamayı kapat"
            onClick={() => setBoardOpen(false)}
          >
            <X size={20} />
          </button>
        </header>

        <div className="maint-board__body">
          {board.length === 0 ? (
            <p className="maint-board__empty">Henüz skor yok. İlk sen ol!</p>
          ) : (
            <>
              <div className="maint-podium">
                {slots.map(({ rank, e }) => (
                  <div
                    key={rank}
                    className={`maint-podium__slot is-${rank}${e ? '' : ' is-empty'}${
                      e && e.name.toLocaleLowerCase('tr') === me ? ' is-me' : ''
                    }`}
                  >
                    <span className="maint-podium__name">{e ? e.name : '—'}</span>
                    <span className="maint-podium__score">{e ? e.score : ''}</span>
                    <span className="maint-podium__bar">{rank}</span>
                  </div>
                ))}
              </div>
              {rest.length > 0 ? (
                <ol className="maint-board__list" start={4}>
                  {rest.map((row, i) => (
                    <li
                      key={`${row.name}-${i}`}
                      className={row.name.toLocaleLowerCase('tr') === me ? 'is-me' : ''}
                    >
                      <span className="maint-board__rank">{i + 4}</span>
                      <span className="maint-board__name">{row.name}</span>
                      <span className="maint-board__score">{row.score}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {board.length > 7 ? (
                <button
                  type="button"
                  className="maint-board__more"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? 'Daha az göster' : 'Hepsini göster'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
