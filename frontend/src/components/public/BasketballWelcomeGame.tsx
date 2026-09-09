import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import LanguageFlag from '@/components/LanguageFlag';
import { imageUrl } from '@/lib/api';
import { basketballWelcomeUi } from '@/lib/basketballWelcomeUi';
import {
  DEFAULT_WELCOME_BASKETBALL_CONFIG,
  parseWelcomeBasketballConfig,
  type WelcomeBasketballConfig,
} from '@/lib/welcomeBasketballConfig';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import '@/basketball-welcome.css';

type Props = {
  restaurant: { name: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  initialLang: string;
  config?: WelcomeBasketballConfig;
  onLanguageChange: (lang: string) => void;
  onComplete: (lang: string) => void;
};

type Phase = 'language' | 'intro' | 'game' | 'success';
type Point = { x: number; y: number };

const BALL_SIZE_FALLBACK = 74;
const GRAVITY = 1250;

function makeAudio() {
  let ctx: AudioContext | null = null;
  const get = () => {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };
  const tone = (frequency: number, duration: number, type: OscillatorType, gain = 0.08, delay = 0) => {
    const audio = get();
    const osc = audio.createOscillator();
    const volume = audio.createGain();
    const start = audio.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(gain, start);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(volume).connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration);
  };
  return {
    launch: () => {
      tone(180, 0.12, 'sine', 0.055);
      tone(320, 0.09, 'triangle', 0.035, 0.04);
    },
    rim: () => tone(520, 0.09, 'square', 0.035),
    score: () => {
      tone(440, 0.18, 'sine', 0.07);
      tone(660, 0.2, 'sine', 0.08, 0.1);
      tone(880, 0.3, 'triangle', 0.07, 0.2);
    },
  };
}

export default function BasketballWelcomeGame({
  restaurant,
  languages,
  initialLang,
  config: rawConfig,
  onLanguageChange,
  onComplete,
}: Props) {
  const config = parseWelcomeBasketballConfig(rawConfig || DEFAULT_WELCOME_BASKETBALL_CONFIG);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLButtonElement>(null);
  const hoopRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('language');
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const ballStartRef = useRef<Point>({ x: 0, y: 0 });
  const ballPosRef = useRef<Point>({ x: 0, y: 0 });
  const velocityRef = useRef<Point>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const shotActiveRef = useRef(false);
  const scoredShotRef = useRef(false);

  const activeLanguages = languages.length ? languages : [{ code: 'tr', name: 'Türkçe' }];
  const preferred =
    activeLanguages.find((lang) => lang.code === 'tr')?.code ||
    activeLanguages.find((lang) => lang.code === initialLang)?.code ||
    activeLanguages[0].code;
  const [lang, setLang] = useState(preferred);
  const [phase, setPhase] = useState<Phase>('language');
  const [scores, setScores] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showSkip, setShowSkip] = useState(config.skipEnabled && config.skipDelaySeconds === 0);
  const [soundOn, setSoundOn] = useState(config.soundEnabled);
  const [retryVisible, setRetryVisible] = useState(false);
  const ui = basketballWelcomeUi(lang);
  const useLogo = Boolean(restaurant.logoUrl) && config.ballStyle !== 'basketball';

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    onLanguageChange(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confetti = useMemo(
    () =>
      Array.from({ length: 54 }, (_, index) => ({
        id: index,
        x: ((index * 47) % 100) - 50,
        color: ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#fb7185'][index % 6],
        delay: (index % 9) * 0.035,
        rotate: (index * 83) % 360,
      })),
    []
  );

  const playSound = useCallback(
    (kind: 'launch' | 'rim' | 'score') => {
      if (!soundOn) return;
      audioRef.current ||= makeAudio();
      audioRef.current[kind]();
    },
    [soundOn]
  );

  const ballSizeRef = useRef(BALL_SIZE_FALLBACK);

  const getBallSize = useCallback(() => {
    const size = ballRef.current?.offsetWidth || BALL_SIZE_FALLBACK;
    ballSizeRef.current = size;
    return size;
  }, []);

  const positionBall = useCallback((point: Point) => {
    ballPosRef.current = point;
    gsap.set(ballRef.current, { x: point.x, y: point.y });
  }, []);

  const resetBall = useCallback(
    (animated = true) => {
      cancelAnimationFrame(animationRef.current);
      shotActiveRef.current = false;
      draggingRef.current = false;
      scoredShotRef.current = false;
      setRetryVisible(false);
      const target = ballStartRef.current;
      if (!ballRef.current) return;
      if (!animated || prefersReducedMotion()) {
        positionBall(target);
        return;
      }
      gsap.to(ballRef.current, {
        x: target.x,
        y: target.y,
        rotation: 0,
        scale: 1,
        duration: 0.58,
        ease: 'back.out(1.5)',
        onUpdate: () => {
          ballPosRef.current = {
            x: Number(gsap.getProperty(ballRef.current, 'x')),
            y: Number(gsap.getProperty(ballRef.current, 'y')),
          };
        },
      });
    },
    [positionBall]
  );

  const layoutGame = useCallback(() => {
    const stage = stageRef.current;
    const hoop = hoopRef.current;
    if (!stage || !hoop) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const ballSize = getBallSize();
    const start = {
      x: width / 2 - ballSize / 2,
      y: height - ballSize - Math.max(42, height * 0.07),
    };
    ballStartRef.current = start;
    if (!shotActiveRef.current && !draggingRef.current) positionBall(start);
  }, [getBallSize, positionBall]);

  useEffect(() => {
    if (phase !== 'game') return;
    const frame = requestAnimationFrame(layoutGame);
    window.addEventListener('resize', layoutGame);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', layoutGame);
    };
  }, [phase, layoutGame]);

  useEffect(() => {
    if (phase !== 'game' || !config.skipEnabled) return;
    if (config.skipDelaySeconds === 0) {
      setShowSkip(true);
      return;
    }
    setShowSkip(false);
    const timer = window.setTimeout(() => setShowSkip(true), config.skipDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, config.skipDelaySeconds, config.skipEnabled]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      gsap.killTweensOf(ballRef.current);
    };
  }, []);

  useGSAP(
    () => {
      if (phase !== 'language') return;
      const card = rootRef.current?.querySelector('.basket-welcome__language-card');
      const langs = rootRef.current?.querySelectorAll('.basket-welcome__lang');
      if (!card) return;
      gsap.fromTo(
        card,
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
      );
      if (langs?.length) {
        gsap.fromTo(
          langs,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.05,
            duration: 0.35,
            delay: 0.12,
            ease: 'power2.out',
            clearProps: 'all',
          }
        );
      }
    },
    { scope: rootRef, dependencies: [phase, activeLanguages.length] }
  );

  const chooseLanguage = (code: string) => {
    setLang(code);
    onLanguageChange(code);
  };

  const startIntro = () => {
    onLanguageChange(lang);
    const card = rootRef.current?.querySelector('.basket-welcome__language-card');
    if (!card) {
      setPhase('intro');
      return;
    }
    gsap.to(card, {
      opacity: 0,
      y: -32,
      scale: 0.95,
      duration: 0.42,
      ease: 'power2.in',
      onComplete: () => setPhase('intro'),
    });
  };

  useEffect(() => {
    if (phase !== 'intro' || !introRef.current) return;
    const ctx = gsap.context(() => {
      const nodes = introRef.current?.querySelectorAll('.basket-welcome__intro-anim') ?? [];
      gsap.fromTo(
        introRef.current,
        { opacity: 0, scale: 0.94, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
      );
      if (nodes.length) {
        gsap.fromTo(
          nodes,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            duration: 0.4,
            delay: 0.1,
            ease: 'power2.out',
            clearProps: 'all',
          }
        );
      }
    }, introRef);
    return () => ctx.revert();
  }, [phase]);

  const startGame = () => {
    gsap.to(introRef.current, {
      opacity: 0,
      scale: 1.06,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => setPhase('game'),
    });
  };

  const finish = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    shotActiveRef.current = false;
    setPhase('success');
    requestAnimationFrame(() => {
      const pieces = confettiRef.current?.querySelectorAll<HTMLElement>('.basket-confetti__piece');
      pieces?.forEach((piece, index) => {
        const angle = (index / pieces.length) * Math.PI * 2;
        const distance = 170 + (index % 7) * 23;
        gsap.fromTo(
          piece,
          { x: 0, y: 0, opacity: 1, rotation: Number(piece.dataset.rotate || 0), scale: 1 },
          {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance + 210,
            opacity: 0,
            rotation: `+=${360 + index * 13}`,
            duration: 1.45 + (index % 5) * 0.08,
            delay: (index % 9) * 0.025,
            ease: 'power2.out',
          }
        );
      });
      gsap.fromTo(
        '.basket-welcome__success-card',
        { opacity: 0, y: 24, scale: 0.82 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.55)' }
      );
    });
    window.setTimeout(() => onComplete(lang), prefersReducedMotion() ? 350 : 2200);
  }, [confetti, lang, onComplete, playSound]);

  const registerScore = useCallback(() => {
    if (scoredShotRef.current) return;
    scoredShotRef.current = true;
    playSound('score');
    const next = scores + 1;
    setScores(next);
    gsap.fromTo(
      '.basket-welcome__score-value',
      { scale: 1.8, color: '#facc15' },
      { scale: 1, color: '#ffffff', duration: 0.55, ease: 'back.out(2)' }
    );
    if (next >= config.requiredScores) {
      window.setTimeout(finish, 480);
    } else {
      window.setTimeout(() => resetBall(true), 720);
    }
  }, [config.requiredScores, finish, playSound, resetBall, scores]);

  const simulate = useCallback(() => {
    let last = performance.now();
    const tick = (now: number) => {
      if (!shotActiveRef.current || phaseRef.current !== 'game') return;
      const stage = stageRef.current;
      const hoop = hoopRef.current;
      const ball = ballRef.current;
      if (!stage || !hoop || !ball) return;
      const dt = Math.min((now - last) / 1000, 0.025);
      last = now;

      velocityRef.current.y += GRAVITY * dt;
      const previousY = ballPosRef.current.y;
      const next = {
        x: ballPosRef.current.x + velocityRef.current.x * dt,
        y: ballPosRef.current.y + velocityRef.current.y * dt,
      };

      const ballSize = ballSizeRef.current || getBallSize();
      const stageRect = stage.getBoundingClientRect();
      const hoopRect = hoop.getBoundingClientRect();
      const rimY = hoopRect.top - stageRect.top + hoopRect.height * 0.5;
      const rimLeft = hoopRect.left - stageRect.left + hoopRect.width * 0.22;
      const rimRight = hoopRect.left - stageRect.left + hoopRect.width * 0.78;
      const centerX = next.x + ballSize / 2;
      const centerY = next.y + ballSize / 2;

      if (
        !scoredShotRef.current &&
        velocityRef.current.y > 0 &&
        previousY + ballSize / 2 <= rimY &&
        centerY >= rimY &&
        centerX > rimLeft &&
        centerX < rimRight
      ) {
        registerScore();
      }

      const wall = stage.clientWidth - ballSize;
      if (next.x < 0 || next.x > wall) {
        next.x = Math.max(0, Math.min(wall, next.x));
        velocityRef.current.x *= -0.66;
        playSound('rim');
      }

      ballPosRef.current = next;
      gsap.set(ball, {
        x: next.x,
        y: next.y,
        rotation: `+=${velocityRef.current.x * dt * 0.08}`,
      });

      if (next.y > stage.clientHeight + 100 || next.y < -stage.clientHeight * 0.8) {
        shotActiveRef.current = false;
        if (!scoredShotRef.current) {
          setRetryVisible(true);
          window.setTimeout(() => resetBall(true), 560);
        }
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [getBallSize, playSound, registerScore, resetBall]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (shotActiveRef.current || phase !== 'game') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    gsap.to(event.currentTarget, { scale: 1.06, duration: 0.15 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || !dragStartRef.current) return;
    const dx = Math.max(-125, Math.min(125, event.clientX - dragStartRef.current.x));
    const dy = Math.max(0, Math.min(165, event.clientY - dragStartRef.current.y));
    const next = {
      x: ballStartRef.current.x + dx * 0.58,
      y: ballStartRef.current.y + dy * 0.7,
    };
    positionBall(next);
    velocityRef.current = {
      x: -dx * 3.8,
      y: -Math.max(820, dy * 4.4 + 820),
    };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const pull = dragStartRef.current ? event.clientY - dragStartRef.current.y : 0;
    dragStartRef.current = null;
    gsap.to(event.currentTarget, { scale: 1, duration: 0.15 });
    if (pull < 18) {
      resetBall(true);
      return;
    }
    if (Math.abs(velocityRef.current.x) < 1 && Math.abs(velocityRef.current.y) < 1) {
      velocityRef.current = { x: 0, y: -880 };
    }
    shotActiveRef.current = true;
    scoredShotRef.current = false;
    setAttempts((value) => value + 1);
    playSound('launch');
    simulate();
  };

  return (
    <div ref={rootRef} className={`basket-welcome basket-welcome--${phase}`} dir={lang.startsWith('ar') ? 'rtl' : 'ltr'}>
      <div className="basket-welcome__ambient" aria-hidden>
        <i /><i /><i />
      </div>

      {phase === 'language' && (
        <section className="basket-welcome__language-card">
          <div className="basket-welcome__brand">
            <div className="basket-welcome__brand-ball">
              {restaurant.logoUrl ? <img src={imageUrl(restaurant.logoUrl)} alt="" /> : <span />}
            </div>
            <div>
              <small>Basketbol Menü</small>
              <strong>{restaurant.name}</strong>
            </div>
          </div>
          <div className="basket-welcome__court-mark" aria-hidden />
          <h1>{ui.chooseLanguage}</h1>
          <p>{ui.languageHint}</p>
          <div className="basket-welcome__languages">
            {activeLanguages.map((language) => (
              <button
                key={language.code}
                type="button"
                className={`basket-welcome__lang${lang === language.code ? ' is-active' : ''}`}
                onClick={() => chooseLanguage(language.code)}
              >
                <LanguageFlag code={language.code} size={25} />
                <span>{language.name}</span>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
            ))}
          </div>
          <button type="button" className="basket-welcome__primary" onClick={startIntro}>
            {ui.continue}
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>
      )}

      {phase === 'intro' && (
        <section ref={introRef} className="basket-welcome__intro">
          <span className="basket-welcome__intro-eyebrow basket-welcome__intro-anim">{ui.challengeEyebrow}</span>
          <div className="basket-welcome__mini-hoop basket-welcome__intro-anim" aria-hidden><span /></div>
          <h1 className="basket-welcome__intro-anim">{ui.challengeTitle}</h1>
          <p className="basket-welcome__intro-anim">{ui.challengeText}</p>
          <button type="button" className="basket-welcome__primary basket-welcome__intro-anim" onClick={startGame}>
            {ui.start}
            <ChevronRight className="w-5 h-5" />
          </button>
        </section>
      )}

      {phase === 'game' && (
        <section className="basket-welcome__game">
          <header className="basket-welcome__game-head">
            <div>
              <small>{restaurant.name}</small>
              <strong>{ui.challengeEyebrow}</strong>
            </div>
            <button
              type="button"
              className="basket-welcome__sound"
              onClick={() => setSoundOn((value) => !value)}
              aria-label={soundOn ? 'Sesi kapat' : 'Sesi aç'}
            >
              {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </header>

          <div ref={stageRef} className="basket-welcome__stage">
            <div className="basket-welcome__scoreboard">
              <span>{ui.score}<b className="basket-welcome__score-value">{scores}/{config.requiredScores}</b></span>
              <i />
              <span>{ui.attempts}<b>{attempts}</b></span>
            </div>
            <div className={`basket-welcome__hoop-track${config.movingHoop ? ' is-moving' : ''}`}>
              <div ref={hoopRef} className="basket-welcome__hoop">
                <div className="basket-welcome__backboard"><span /></div>
                <div className="basket-welcome__rim" />
                <div className="basket-welcome__net">
                  {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
                </div>
              </div>
            </div>

            <div className="basket-welcome__aim-line" aria-hidden />
            <button
              ref={ballRef}
              type="button"
              className={`basket-welcome__ball${useLogo ? ' has-logo' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-label={ui.dragHint}
            >
              {useLogo ? (
                <img src={imageUrl(restaurant.logoUrl!)} alt={restaurant.name} draggable={false} />
              ) : (
                <span className="basket-welcome__basketball-lines" aria-hidden />
              )}
            </button>

            <div className="basket-welcome__drag-hint">
              <span className="basket-welcome__drag-arrow">↓</span>
              <strong>{retryVisible ? ui.retry : ui.dragHint}</strong>
            </div>
          </div>

          {showSkip && (
            <button type="button" className="basket-welcome__skip" onClick={() => onComplete(lang)}>
              {ui.skip}<ChevronRight className="w-4 h-4" />
            </button>
          )}
        </section>
      )}

      {phase === 'success' && (
        <section className="basket-welcome__success">
          <div ref={confettiRef} className="basket-confetti" aria-hidden>
            {confetti.map((piece) => (
              <i
                key={piece.id}
                className="basket-confetti__piece"
                data-rotate={piece.rotate}
                style={{ backgroundColor: piece.color, marginLeft: `${piece.x}px`, animationDelay: `${piece.delay}s` }}
              />
            ))}
          </div>
          <div className="basket-welcome__success-card">
            <span className="basket-welcome__success-icon"><Sparkles className="w-8 h-8" /></span>
            <h1>{ui.successTitle}</h1>
            <p>{ui.successText}</p>
            <div className="basket-welcome__unlock"><RotateCcw className="w-4 h-4 animate-spin" /> Menü açılıyor…</div>
          </div>
        </section>
      )}
    </div>
  );
}
