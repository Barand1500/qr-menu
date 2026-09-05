import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Trophy } from 'lucide-react';

type Obstacle = { x: number; w: number; h: number; kind: 0 | 1 | 2 };
type BoardEntry = { name: string; score: number; at: string };

const GROUND_RATIO = 0.74;
const PLAYER_X = 48;
const PLAYER_W = 28;
const PLAYER_H = 36;
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
    let cssH = canvas.clientHeight || 160;
    let groundY = Math.round(cssH * GROUND_RATIO);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = canvas.clientWidth || 320;
      cssH = canvas.clientHeight || 160;
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
        { w: 22, h: 28 },
        { w: 30, h: 20 },
        { w: 18, h: 34 },
      ];
      const size = sizes[kind];
      s.obstacles.push({
        x: cssW + 10,
        w: size.w,
        h: size.h,
        kind,
      });
    }

    function drawWaiter(x: number, y: number, frame: number) {
      const bob = Math.sin(frame / 5) * (stateRef.current.onGround ? 1.2 : 0);
      ctx.fillStyle = '#fff8ef';
      roundRect(ctx, x + 6, y + 10 + bob, 16, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#8a5a2b';
      roundRect(ctx, x + 8, y + 16 + bob, 12, 12, 3);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(x + 14, y + 8 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5f5f4';
      roundRect(ctx, x + 7, y + bob, 14, 5, 2);
      ctx.fill();
      ctx.fillStyle = '#c0c7d1';
      roundRect(ctx, x + 20, y + 14 + bob, 14, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.arc(x + 27, y + 12 + bob, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3b2a1c';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const stride = Math.sin(frame / 4) * 4;
      if (stateRef.current.onGround) {
        ctx.beginPath();
        ctx.moveTo(x + 11, y + 28 + bob);
        ctx.lineTo(x + 9 - stride, y + 35);
        ctx.moveTo(x + 17, y + 28 + bob);
        ctx.lineTo(x + 19 + stride, y + 35);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x + 11, y + 28);
        ctx.lineTo(x + 8, y + 34);
        ctx.moveTo(x + 17, y + 28);
        ctx.lineTo(x + 22, y + 33);
        ctx.stroke();
      }
    }

    function drawObstacle(o: Obstacle) {
      const y = groundY - o.h;
      if (o.kind === 0) {
        ctx.fillStyle = '#b07a45';
        roundRect(ctx, o.x, y + 8, o.w, o.h - 8, 3);
        ctx.fill();
        ctx.fillStyle = '#8a5a2b';
        roundRect(ctx, o.x + 2, y, o.w - 4, 8, 2);
        ctx.fill();
      } else if (o.kind === 1) {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, groundY - 4, o.w / 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2 - 2, groundY - 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#5b3d24';
        ctx.fillRect(o.x + o.w / 2 - 2, y, 4, o.h);
        ctx.fillStyle = '#fff7ed';
        roundRect(ctx, o.x, y, o.w, 14, 2);
        ctx.fill();
        ctx.strokeStyle = '#c2410c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(o.x + 3, y + 3, o.w - 6, 8);
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
      if (finalScore >= 1) {
        stateRef.current.blockRestart = true;
        setPendingScore(finalScore);
        setAwaitingName(true);
      }
    }

    function tick() {
      const s = stateRef.current;
      s.frame += 1;

      const g = ctx.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, '#ffe8d2');
      g.addColorStop(0.55, '#f6efe6');
      g.addColorStop(1, '#e8d9c4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.fillStyle = 'rgba(176, 122, 69, 0.12)';
      for (let i = 0; i < 6; i++) {
        const sx = i * 70 - ((s.distance * 0.3) % 70);
        roundRect(ctx, sx, 28, 48, 36, 6);
        ctx.fill();
      }

      ctx.fillStyle = '#d6c3a8';
      ctx.fillRect(0, groundY, cssW, cssH - groundY);
      ctx.fillStyle = '#c4ae8f';
      ctx.fillRect(0, groundY, cssW, 3);
      ctx.strokeStyle = 'rgba(88, 60, 36, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const gx = i * 40 - (s.distance % 40);
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 8);
        ctx.lineTo(gx + 18, groundY + 8);
        ctx.stroke();
      }

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
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);

        const px = PLAYER_X;
        const py = s.y;
        for (const o of s.obstacles) {
          const hit =
            px + 4 < o.x + o.w - 4 &&
            px + PLAYER_W - 4 > o.x + 4 &&
            py + 6 < groundY - 2 &&
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

      for (const o of s.obstacles) drawObstacle(o);
      drawWaiter(PLAYER_X, s.y || groundY - PLAYER_H, s.frame);

      ctx.fillStyle = '#3b2a1c';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(`Skor ${s.score}`, 12, 18);

      if (!s.running && !s.dead) {
        ctx.fillStyle = 'rgba(59, 42, 28, 0.55)';
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = '#fffaf4';
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Dokun / Space = zıpla', cssW / 2, cssH / 2 - 4);
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText('Garsonu engellerden koru', cssW / 2, cssH / 2 + 16);
        ctx.textAlign = 'left';
      }

      if (s.dead) {
        ctx.fillStyle = 'rgba(59, 42, 28, 0.45)';
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = '#fffaf4';
        ctx.font = '800 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tepsi düştü!', cssW / 2, cssH / 2 - 8);
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(
          s.blockRestart ? 'İsmini yaz, sıralamaya gir' : 'Tekrar için dokun',
          cssW / 2,
          cssH / 2 + 14
        );
        ctx.textAlign = 'left';
      }

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

  function skipName() {
    stateRef.current.blockRestart = false;
    setAwaitingName(false);
    setSaveMsg('');
  }

  function playAgain() {
    resetRef.current();
  }

  return (
    <div className="maint-game">
      <div className="maint-game__head">
        <div>
          <strong>Garson Koşusu</strong>
          <span>Menü yokken oyunumuz var</span>
        </div>
        <div className="maint-game__scores">
          <em>{score}</em>
          <span>rekor {best}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="maint-game__canvas"
        role="img"
        aria-label="Garson koşu oyunu"
      />

      {awaitingName ? (
        <form className="maint-game__submit" onSubmit={(e) => void submitScore(e)}>
          <label htmlFor="maint-runner-name">
            Skor {pendingScore} — sıralamaya isminle gir
          </label>
          <div className="maint-game__submit-row">
            <input
              id="maint-runner-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={24}
              placeholder="Adın"
              autoComplete="nickname"
              autoFocus
            />
            <button type="submit" disabled={saving}>
              {saving ? '…' : 'Kaydet'}
            </button>
          </div>
          <div className="maint-game__submit-actions">
            <button type="button" onClick={skipName}>
              Atla
            </button>
            <button type="button" onClick={playAgain}>
              Tekrar oyna
            </button>
          </div>
          {saveMsg ? <p className="maint-game__submit-msg">{saveMsg}</p> : null}
        </form>
      ) : (
        <p className="maint-game__hint">
          {started && alive
            ? 'Zıpla: dokun veya Space'
            : started
              ? 'Tekrar oynamak için dokun'
              : 'Başlamak için dokun'}
        </p>
      )}

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
