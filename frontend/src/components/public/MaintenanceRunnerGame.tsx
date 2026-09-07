import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Trophy } from 'lucide-react';

type Obstacle = { x: number; w: number; h: number; kind: 0 | 1 | 2 };
type BoardEntry = { name: string; score: number; at: string };
type Dust = { x: number; y: number; r: number; a: number; vx: number };

const GROUND_RATIO = 0.72;
const PLAYER_X = 52;
const PLAYER_W = 30;
const PLAYER_H = 40;
const START_SPEED = 2.4;
const MAX_SPEED = 5.2;
const GRAVITY = 0.42;
const JUMP_VY = -8.2;
const NAME_KEY = 'maint_runner_name';

type Props = { slug: string };

export default function MaintenanceRunnerGame({ slug }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(`maint_runner_best_${slug}`) || 0);
    } catch {
      return 0;
    }
  });
  const [alive, setAlive] = useState(true);
  const [started, setStarted] = useState(false);
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
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const stateRef = useRef({
    running: false,
    dead: false,
    y: 0,
    vy: 0,
    onGround: true,
    speed: START_SPEED,
    distance: 0,
    obstacles: [] as Obstacle[],
    spawnIn: 110,
    frame: 0,
    score: 0,
    blockRestart: false,
    dust: [] as Dust[],
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
    let cssW = canvas.clientWidth || 320;
    let cssH = canvas.clientHeight || 180;
    let groundY = Math.round(cssH * GROUND_RATIO);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = canvas.clientWidth || 320;
      cssH = canvas.clientHeight || 180;
      groundY = Math.round(cssH * GROUND_RATIO);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stateRef.current.running && !stateRef.current.dead) {
        stateRef.current.y = groundY - PLAYER_H;
      }
    }

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    function seedDust() {
      const dust: Dust[] = [];
      for (let i = 0; i < 14; i++) {
        dust.push({
          x: Math.random() * cssW,
          y: 20 + Math.random() * (groundY - 40),
          r: 0.8 + Math.random() * 1.6,
          a: 0.12 + Math.random() * 0.25,
          vx: 0.15 + Math.random() * 0.35,
        });
      }
      stateRef.current.dust = dust;
    }
    seedDust();

    function reset() {
      const s = stateRef.current;
      s.running = true;
      s.dead = false;
      s.blockRestart = false;
      s.y = groundY - PLAYER_H;
      s.vy = 0;
      s.onGround = true;
      s.speed = START_SPEED;
      s.distance = 0;
      s.obstacles = [];
      s.spawnIn = 100;
      s.frame = 0;
      s.score = 0;
      seedDust();
      setAlive(true);
      setScore(0);
      setStarted(true);
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
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (stateRef.current.blockRestart) return;
        e.preventDefault();
        jump();
      }
    }

    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', jump);

    function spawnObstacle(s: typeof stateRef.current) {
      const kind = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const sizes = [
        { w: 26, h: 30 },
        { w: 32, h: 22 },
        { w: 22, h: 36 },
      ];
      const size = sizes[kind];
      s.obstacles.push({
        x: cssW + 12,
        w: size.w,
        h: size.h,
        kind,
      });
    }

    function drawScene(s: typeof stateRef.current) {
      // warm cafe sky / wall
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, '#ffd9b8');
      sky.addColorStop(0.35, '#ffe8d2');
      sky.addColorStop(0.75, '#f3e6d4');
      sky.addColorStop(1, '#e8d5bc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, cssW, groundY);

      // soft window light blotches
      const glow = ctx.createRadialGradient(cssW * 0.7, 18, 4, cssW * 0.7, 18, 70);
      glow.addColorStop(0, 'rgba(255, 240, 200, 0.55)');
      glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, cssW, groundY);

      // far wall stripe
      ctx.fillStyle = 'rgba(138, 90, 43, 0.07)';
      ctx.fillRect(0, groundY - 52, cssW, 52);

      // parallax shelves / frames
      const scrollFar = (s.distance * 0.22) % 90;
      for (let i = -1; i < Math.ceil(cssW / 90) + 2; i++) {
        const sx = i * 90 - scrollFar;
        // picture frame
        ctx.fillStyle = 'rgba(120, 80, 45, 0.14)';
        roundRect(ctx, sx + 14, 22, 34, 26, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 248, 235, 0.35)';
        roundRect(ctx, sx + 18, 26, 26, 18, 2);
        ctx.fill();
        // plant pot silhouette
        ctx.fillStyle = 'rgba(90, 130, 70, 0.18)';
        ctx.beginPath();
        ctx.ellipse(sx + 68, 48, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(140, 90, 50, 0.2)';
        roundRect(ctx, sx + 62, 48, 12, 10, 2);
        ctx.fill();
      }

      // hanging pendant lights
      const scrollMid = (s.distance * 0.4) % 120;
      for (let i = -1; i < Math.ceil(cssW / 120) + 2; i++) {
        const lx = i * 120 - scrollMid + 40;
        ctx.strokeStyle = 'rgba(90, 60, 35, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, 14);
        ctx.stroke();
        ctx.fillStyle = 'rgba(90, 60, 35, 0.35)';
        ctx.beginPath();
        ctx.moveTo(lx - 8, 14);
        ctx.lineTo(lx + 8, 14);
        ctx.lineTo(lx + 5, 22);
        ctx.lineTo(lx - 5, 22);
        ctx.closePath();
        ctx.fill();
        const lamp = ctx.createRadialGradient(lx, 28, 2, lx, 30, 22);
        lamp.addColorStop(0, 'rgba(255, 210, 120, 0.35)');
        lamp.addColorStop(1, 'rgba(255, 210, 120, 0)');
        ctx.fillStyle = lamp;
        ctx.beginPath();
        ctx.arc(lx, 30, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // wainscot rail
      ctx.fillStyle = 'rgba(120, 80, 45, 0.22)';
      ctx.fillRect(0, groundY - 18, cssW, 3);
      ctx.fillStyle = 'rgba(160, 120, 75, 0.12)';
      ctx.fillRect(0, groundY - 15, cssW, 15);

      // dust motes
      for (const d of s.dust) {
        d.x -= d.vx * (s.running && !s.dead ? s.speed * 0.35 : 0.4);
        if (d.x < -4) d.x = cssW + 4;
        ctx.fillStyle = `rgba(255, 250, 240, ${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y + Math.sin((s.frame + d.x) / 30) * 2, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // wooden floor
      const floor = ctx.createLinearGradient(0, groundY, 0, cssH);
      floor.addColorStop(0, '#c9ad88');
      floor.addColorStop(0.4, '#b99872');
      floor.addColorStop(1, '#a8845f');
      ctx.fillStyle = floor;
      ctx.fillRect(0, groundY, cssW, cssH - groundY);

      // floor edge highlight
      ctx.fillStyle = 'rgba(255, 240, 210, 0.35)';
      ctx.fillRect(0, groundY, cssW, 2);
      ctx.fillStyle = 'rgba(90, 55, 30, 0.22)';
      ctx.fillRect(0, groundY + 2, cssW, 2);

      // plank lines
      ctx.strokeStyle = 'rgba(88, 55, 30, 0.16)';
      ctx.lineWidth = 1;
      const plankScroll = s.distance % 36;
      for (let i = -1; i < Math.ceil(cssW / 36) + 2; i++) {
        const gx = i * 36 - plankScroll;
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 6);
        ctx.lineTo(gx, cssH);
        ctx.stroke();
      }
      // horizontal grain
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.12)';
      for (let y = groundY + 12; y < cssH; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssW, y);
        ctx.stroke();
      }
    }

    function drawShadow(cx: number, ry: number, rw: number) {
      ctx.fillStyle = 'rgba(70, 40, 20, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, groundY - 1, rw, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawWaiter(x: number, y: number, frame: number) {
      const onGround = stateRef.current.onGround;
      const bob = Math.sin(frame / 5) * (onGround ? 1.4 : 0);
      const squash = onGround ? 1 : 0.92;
      const stretch = onGround ? 1 : 1.06;
      const stride = Math.sin(frame / 4) * (onGround ? 5 : 0);

      drawShadow(x + 15, onGround ? 4.5 : 3, onGround ? 14 : 10);

      ctx.save();
      ctx.translate(x + 15, y + PLAYER_H);
      ctx.scale(squash, stretch);
      ctx.translate(-(x + 15), -(y + PLAYER_H));

      // legs
      ctx.strokeStyle = '#2c2118';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      if (onGround) {
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 30 + bob);
        ctx.lineTo(x + 10 - stride, y + 39);
        ctx.moveTo(x + 18, y + 30 + bob);
        ctx.lineTo(x + 20 + stride, y + 39);
        ctx.stroke();
        // shoes
        ctx.fillStyle = '#1f1712';
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

      // torso shirt
      const shirt = ctx.createLinearGradient(x + 6, y + 10, x + 22, y + 32);
      shirt.addColorStop(0, '#fffaf3');
      shirt.addColorStop(1, '#efe4d4');
      ctx.fillStyle = shirt;
      roundRect(ctx, x + 7, y + 12 + bob, 16, 18, 5);
      ctx.fill();

      // apron
      ctx.fillStyle = '#8b4f28';
      roundRect(ctx, x + 9, y + 18 + bob, 12, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#a86436';
      roundRect(ctx, x + 10, y + 19 + bob, 10, 3, 1);
      ctx.fill();

      // arm + tray
      ctx.strokeStyle = '#e8c4a0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 22, y + 16 + bob);
      ctx.lineTo(x + 28, y + 18 + bob);
      ctx.stroke();

      // tray
      ctx.fillStyle = '#9aa3af';
      roundRect(ctx, x + 24, y + 16 + bob, 16, 3.5, 1.5);
      ctx.fill();
      ctx.fillStyle = '#c5ccd6';
      roundRect(ctx, x + 25, y + 15.5 + bob, 14, 1.5, 1);
      ctx.fill();

      // coffee cup
      ctx.fillStyle = '#fff8ef';
      roundRect(ctx, x + 28, y + 9 + bob, 7, 7, 1.5);
      ctx.fill();
      ctx.fillStyle = '#6b3e24';
      roundRect(ctx, x + 29, y + 10 + bob, 5, 4, 1);
      ctx.fill();
      // steam
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.2;
      const steam = Math.sin(frame / 8) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 31.5, y + 8 + bob);
      ctx.quadraticCurveTo(x + 33 + steam, y + 4 + bob, x + 30.5, y + 1 + bob);
      ctx.stroke();

      // head
      ctx.fillStyle = '#f0c49a';
      ctx.beginPath();
      ctx.arc(x + 15, y + 9 + bob, 7.2, 0, Math.PI * 2);
      ctx.fill();
      // cheeks
      ctx.fillStyle = 'rgba(232, 120, 100, 0.28)';
      ctx.beginPath();
      ctx.arc(x + 11, y + 10.5 + bob, 1.8, 0, Math.PI * 2);
      ctx.arc(x + 19, y + 10.5 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // eyes
      ctx.fillStyle = '#2c2118';
      ctx.beginPath();
      ctx.arc(x + 12.5, y + 8.5 + bob, 1.1, 0, Math.PI * 2);
      ctx.arc(x + 17.5, y + 8.5 + bob, 1.1, 0, Math.PI * 2);
      ctx.fill();
      // smile
      ctx.strokeStyle = '#b07050';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + 15, y + 10.5 + bob, 2.4, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // bow tie
      ctx.fillStyle = '#c2410c';
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
      ctx.beginPath();
      ctx.arc(x + 15, y + 14.5 + bob, 1.3, 0, Math.PI * 2);
      ctx.fill();

      // chef hat
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + 8, y - 1 + bob, 14, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#f5f5f4';
      roundRect(ctx, x + 9.5, y + 4 + bob, 11, 3.5, 1.5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 160, 140, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    function drawObstacle(o: Obstacle, frame: number) {
      const y = groundY - o.h;
      drawShadow(o.x + o.w / 2, 3.5, o.w * 0.42);

      if (o.kind === 0) {
        // cafe chair
        ctx.fillStyle = '#8a5a2b';
        // backrest
        roundRect(ctx, o.x + 3, y, o.w - 6, 10, 2);
        ctx.fill();
        ctx.fillStyle = '#a06c38';
        roundRect(ctx, o.x + 5, y + 2, o.w - 10, 6, 1.5);
        ctx.fill();
        // seat
        ctx.fillStyle = '#b07a45';
        roundRect(ctx, o.x, y + 10, o.w, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#c9945c';
        roundRect(ctx, o.x + 2, y + 11, o.w - 4, 3, 1);
        ctx.fill();
        // legs
        ctx.strokeStyle = '#6b4220';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(o.x + 4, y + 18);
        ctx.lineTo(o.x + 3, y + o.h);
        ctx.moveTo(o.x + o.w - 4, y + 18);
        ctx.lineTo(o.x + o.w - 3, y + o.h);
        ctx.stroke();
      } else if (o.kind === 1) {
        // spilled soup bowl
        ctx.fillStyle = '#d4d4d8';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, groundY - 6, o.w / 2.2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, groundY - 8, o.w / 2.6, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 - 3, groundY - 9, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // puddle
        ctx.fillStyle = 'rgba(234, 88, 12, 0.35)';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 + 6, groundY - 2, 10, 3, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // steam
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        const st = Math.sin(frame / 10) * 2;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2 - 2, groundY - 14);
        ctx.quadraticCurveTo(o.x + o.w / 2 + st, groundY - 20, o.x + o.w / 2 - 1, groundY - 24);
        ctx.stroke();
      } else {
        // A-frame menu stand
        ctx.strokeStyle = '#5b3d24';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const mid = o.x + o.w / 2;
        ctx.beginPath();
        ctx.moveTo(mid - 8, groundY);
        ctx.lineTo(mid, y + 4);
        ctx.lineTo(mid + 8, groundY);
        ctx.stroke();
        // board
        ctx.fillStyle = '#fff7ed';
        roundRect(ctx, o.x, y, o.w, 16, 2);
        ctx.fill();
        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1.4;
        roundRect(ctx, o.x + 2, y + 2, o.w - 4, 12, 1.5);
        ctx.stroke();
        // menu lines
        ctx.strokeStyle = 'rgba(90, 60, 35, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(o.x + 4, y + 5 + i * 3);
          ctx.lineTo(o.x + o.w - 4, y + 5 + i * 3);
          ctx.stroke();
        }
      }
    }

    function drawHud(s: typeof stateRef.current) {
      // score chip
      ctx.fillStyle = 'rgba(59, 42, 28, 0.72)';
      roundRect(ctx, 8, 8, 72, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#fffaf4';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(`Skor ${s.score}`, 16, 23);
    }

    function drawOverlay(s: typeof stateRef.current) {
      if (!s.running && !s.dead) {
        ctx.fillStyle = 'rgba(40, 28, 18, 0.5)';
        ctx.fillRect(0, 0, cssW, cssH);
        const cw = Math.min(240, cssW - 32);
        const cx = (cssW - cw) / 2;
        const cy = cssH / 2 - 28;
        ctx.fillStyle = 'rgba(255, 250, 244, 0.95)';
        roundRect(ctx, cx, cy, cw, 56, 12);
        ctx.fill();
        ctx.fillStyle = '#3b2a1c';
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Dokun veya Space = zıpla', cssW / 2, cy + 24);
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = '#7a6554';
        ctx.fillText('Garsonu engellerden koru', cssW / 2, cy + 42);
        ctx.textAlign = 'left';
      }

      // Ölüm ekranı HTML overlay'de; canvas sadece karartır
      if (s.dead) {
        ctx.fillStyle = 'rgba(40, 28, 18, 0.42)';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    }

    function onDeath(finalScore: number) {
      setAlive(false);
      setScore(finalScore);
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
    }

    function tick() {
      const s = stateRef.current;
      s.frame += 1;

      drawScene(s);

      if (s.running && !s.dead) {
        s.vy += GRAVITY;
        s.y += s.vy;
        if (s.y >= groundY - PLAYER_H) {
          s.y = groundY - PLAYER_H;
          s.vy = 0;
          s.onGround = true;
        }
        s.distance += s.speed;
        s.speed = Math.min(MAX_SPEED, START_SPEED + s.distance / 3200);
        s.spawnIn -= 1;
        if (s.spawnIn <= 0) {
          spawnObstacle(s);
          s.spawnIn = 85 + Math.floor(Math.random() * 70) - Math.floor(s.speed * 3);
        }
        for (const o of s.obstacles) o.x -= s.speed;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -24);

        const px = PLAYER_X;
        const py = s.y;
        for (const o of s.obstacles) {
          const hit =
            px + 5 < o.x + o.w - 4 &&
            px + PLAYER_W - 5 > o.x + 4 &&
            py + 8 < groundY - 2 &&
            py + PLAYER_H > groundY - o.h + 2;
          if (hit) {
            s.dead = true;
            s.running = false;
            const finalScore = Math.floor(s.distance / 10);
            onDeath(finalScore);
            break;
          }
        }
        const liveScore = Math.floor(s.distance / 10);
        s.score = liveScore;
        if (s.frame % 6 === 0) setScore(liveScore);
      }

      for (const o of s.obstacles) drawObstacle(o, s.frame);
      drawWaiter(PLAYER_X, s.y || groundY - PLAYER_H, s.frame);
      drawHud(s);
      drawOverlay(s);

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
      setSaveMsg('En az 2 karakterlik isim yazın');
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

  function playAgain() {
    resetRef.current();
  }

  const showDeathUi = started && !alive;

  return (
    <div className="maint-game">
      <div className="maint-game__head">
        <div>
          <strong>Garson Koşusu</strong>
          <span>Menü yokken oyunumuz vardı :D</span>
        </div>
        <div className="maint-game__scores">
          <em>{score}</em>
          <span>rekor {best}</span>
        </div>
      </div>

      <div className="maint-game__stage">
        <canvas
          ref={canvasRef}
          className="maint-game__canvas"
          role="img"
          aria-label="Garson koşu oyunu"
        />

        {showDeathUi ? (
          <div className="maint-game__over" onPointerDown={(e) => e.stopPropagation()}>
            <strong>Tepsi düştü!</strong>
            <span className="maint-game__over-score">Skor {pendingScore || score}</span>

            {awaitingName ? (
              <form
                className="maint-game__over-form"
                onSubmit={(e) => void submitScore(e)}
              >
                <input
                  id="maint-runner-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={24}
                  placeholder="Adın (sıralama)"
                  autoComplete="nickname"
                  autoFocus
                />
                <button type="submit" disabled={saving}>
                  {saving ? '…' : 'Kaydet'}
                </button>
              </form>
            ) : null}

            {saveMsg ? <p className="maint-game__submit-msg">{saveMsg}</p> : null}

            <button type="button" className="maint-game__again" onClick={playAgain}>
              Tekrar oyna
            </button>
          </div>
        ) : null}
      </div>

      {!showDeathUi ? (
        <p className="maint-game__hint">
          {started && alive
            ? 'Zıpla: dokun veya Space'
            : 'Başlamak için dokun'}
        </p>
      ) : null}

      <div className="maint-board">
        <div className="maint-board__title">
          <Trophy className="w-3.5 h-3.5" />
          Sıralama
        </div>
        {board.length === 0 ? (
          <p className="maint-board__empty">Henüz skor yok — ilk sen ol.</p>
        ) : (
          <ol className="maint-board__list">
            {board.map((row, i) => (
              <li key={`${row.name}-${row.score}-${i}`}>
                <span className="maint-board__rank">{i + 1}</span>
                <span className="maint-board__name">{row.name}</span>
                <span className="maint-board__score">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
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
