import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, SkipForward, Volume2, VolumeX } from 'lucide-react';
import LanguageFlag from '@/components/LanguageFlag';
import { imageUrl } from '@/lib/api';
import { cupsWelcomeUi } from '@/lib/cupsWelcomeUi';
import {
  DEFAULT_WELCOME_CUPS_CONFIG,
  parseWelcomeCupsConfig,
  type WelcomeCupsConfig,
} from '@/lib/welcomeCupsConfig';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import '@/cups-welcome.css';

type Props = {
  restaurant: { name: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  initialLang: string;
  config?: WelcomeCupsConfig;
  onLanguageChange: (lang: string) => void;
  onComplete: (lang: string) => void;
};

type Phase = 'language' | 'locked' | 'shuffle' | 'guess' | 'reveal' | 'success';

const CUP_IDS = [0, 1, 2] as const;
const SHUFFLE_DUR: Record<WelcomeCupsConfig['shuffleSpeed'], number> = {
  slow: 0.58,
  normal: 0.36,
  fast: 0.22,
};

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
    drop: () => {
      tone(220, 0.12, 'sine', 0.05);
      tone(140, 0.16, 'triangle', 0.04, 0.05);
    },
    cover: () => tone(320, 0.1, 'triangle', 0.04),
    shuffle: () => tone(180 + Math.random() * 80, 0.06, 'square', 0.025),
    wrong: () => {
      tone(180, 0.14, 'sawtooth', 0.04);
      tone(120, 0.18, 'sine', 0.035, 0.08);
    },
    correct: () => {
      tone(440, 0.16, 'sine', 0.06);
      tone(660, 0.2, 'triangle', 0.07, 0.1);
      tone(880, 0.28, 'sine', 0.06, 0.2);
    },
    unlock: () => {
      tone(520, 0.12, 'triangle', 0.05);
      tone(780, 0.22, 'sine', 0.06, 0.12);
    },
  };
}

function slotX(slot: number, gap: number) {
  return (slot - 1) * gap;
}

export default function CupsWelcomeGame({
  restaurant,
  languages,
  initialLang,
  config: rawConfig,
  onLanguageChange,
  onComplete,
}: Props) {
  const config = parseWelcomeCupsConfig(rawConfig || DEFAULT_WELCOME_CUPS_CONFIG);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLImageElement>(null);
  const cupRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const keyCupRef = useRef(1);
  const positionsRef = useRef<number[]>([0, 1, 2]);
  const busyRef = useRef(false);
  const gapRef = useRef(120);
  const roundKickRef = useRef(0);
  const runShuffleRef = useRef<() => void>(() => undefined);

  const activeLanguages = languages.length ? languages : [{ code: 'tr', name: 'Türkçe' }];
  const preferred =
    activeLanguages.find((lang) => lang.code === 'tr')?.code ||
    activeLanguages.find((lang) => lang.code === initialLang)?.code ||
    activeLanguages[0].code;

  const [lang, setLang] = useState(preferred);
  const [phase, setPhase] = useState<Phase>('language');
  const [round, setRound] = useState(1);
  const [showSkip, setShowSkip] = useState(config.skipEnabled && config.skipDelaySeconds === 0);
  const [soundOn, setSoundOn] = useState(config.soundEnabled);
  const [statusText, setStatusText] = useState('');
  const [subText, setSubText] = useState('');

  const ui = cupsWelcomeUi(lang);
  const reduced = prefersReducedMotion();
  const inGame = phase !== 'language';

  const playSound = useCallback(
    (kind: keyof ReturnType<typeof makeAudio>) => {
      if (!soundOn) return;
      audioRef.current ||= makeAudio();
      audioRef.current[kind]();
    },
    [soundOn]
  );

  useEffect(() => {
    audioRef.current = makeAudio();
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    if (!inGame || !config.skipEnabled) return;
    if (config.skipDelaySeconds === 0) {
      setShowSkip(true);
      return;
    }
    setShowSkip(false);
    const timer = window.setTimeout(() => setShowSkip(true), config.skipDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [inGame, config.skipEnabled, config.skipDelaySeconds]);

  const measureGap = useCallback(() => {
    const table = tableRef.current;
    if (!table) return gapRef.current;
    const w = table.clientWidth;
    gapRef.current = Math.max(96, Math.min(160, w * 0.3));
    return gapRef.current;
  }, []);

  const placeCupsInstant = useCallback(() => {
    const gap = measureGap();
    CUP_IDS.forEach((id) => {
      const el = cupRefs.current[id];
      if (!el) return;
      gsap.set(el, {
        x: slotX(positionsRef.current[id], gap),
        y: 0,
        rotate: 0,
        scale: 1,
        opacity: 1,
        clearProps: '',
      });
    });
  }, [measureGap]);

  const finishUnlock = useCallback(() => {
    window.setTimeout(() => onComplete(lang), reduced ? 400 : 2400);
  }, [lang, onComplete, reduced]);

  const runSuccess = useCallback(() => {
    busyRef.current = true;
    setPhase('success');
    setStatusText(ui.unlockTitle);
    setSubText(ui.unlockText);
    playSound('correct');
    playSound('unlock');

    const tl = gsap.timeline({ onComplete: finishUnlock });
    timelineRef.current?.kill();
    timelineRef.current = tl;

    const keyCup = keyCupRef.current;
    const gap = gapRef.current;
    const keyEl = keyRef.current;
    const lockEl = lockRef.current;

    CUP_IDS.forEach((id) => {
      const el = cupRefs.current[id];
      if (!el) return;
      if (id === keyCup) tl.to(el, { y: -78, duration: 0.45, ease: 'power2.out' }, 0);
      else tl.to(el, { y: -28, opacity: 0.55, duration: 0.35, ease: 'power2.out' }, 0);
    });

    if (keyEl) {
      gsap.set(keyEl, {
        opacity: 1,
        x: slotX(positionsRef.current[keyCup], gap),
        y: 10,
        scale: 0.95,
        rotate: 0,
      });
      tl.to(keyEl, { y: -48, scale: 1.12, rotate: 10, duration: 0.55, ease: 'back.out(1.6)' }, 0.15);
      tl.to(keyEl, { x: 0, y: -130, scale: 0.72, duration: 0.65, ease: 'power2.inOut' }, 0.7);
    }

    if (lockEl) {
      gsap.set(lockEl, { opacity: 1, scale: 1, rotateY: 0 });
      tl.to(lockEl, { scale: 1.1, duration: 0.35, ease: 'power2.out' }, 1.05);
      tl.to(lockEl, { rotateY: 105, opacity: 0, duration: 0.7, ease: 'power3.in' }, 1.35);
    }

    const card = stageRef.current?.querySelector('.cups-welcome__success-card');
    if (card) {
      tl.fromTo(
        card,
        { opacity: 0, y: 18, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.4)' },
        1.45
      );
    }
  }, [finishUnlock, playSound, ui.unlockText, ui.unlockTitle]);

  const runShuffle = useCallback(() => {
    setPhase('shuffle');
    setStatusText(ui.watchKey);
    setSubText(ui.lockedText);
    const gap = measureGap();
    placeCupsInstant();
    const dur = reduced ? 0.1 : SHUFFLE_DUR[config.shuffleSpeed];
    const swaps = config.shuffleCount;
    const tl = gsap.timeline({
      onComplete: () => {
        busyRef.current = false;
        setPhase('guess');
        setStatusText(ui.findHint);
        setSubText('');
        placeCupsInstant();
      },
    });
    timelineRef.current?.kill();
    timelineRef.current = tl;

    const keyCup = keyCupRef.current;
    const keyEl = keyRef.current;
    const coverCup = cupRefs.current[keyCup];
    const coverX = slotX(positionsRef.current[keyCup], gap);

    if (keyEl) {
      gsap.set(keyEl, { opacity: 1, x: 0, y: -100, scale: 0.92, rotate: -16 });
      tl.add(() => playSound('drop'), 0);
      tl.to(keyEl, { y: 8, rotate: 6, scale: 1, duration: reduced ? 0.25 : 0.75, ease: 'bounce.out' }, 0);
    }

    if (coverCup) {
      tl.to(coverCup, { y: -58, duration: 0.35, ease: 'power2.out' }, reduced ? 0.2 : 0.8);
      tl.to(coverCup, { x: 0, duration: 0.4, ease: 'power2.inOut' }, '-=0.08');
      if (keyEl) tl.to(keyEl, { opacity: 0, scale: 0.55, duration: 0.18 }, '-=0.02');
      tl.add(() => playSound('cover'));
      tl.to(coverCup, { x: coverX, y: 0, duration: 0.45, ease: 'power2.inOut' });
    }

    for (let s = 0; s < swaps; s += 1) {
      let a = Math.floor(Math.random() * 3);
      let b = Math.floor(Math.random() * 3);
      while (b === a) b = Math.floor(Math.random() * 3);

      const cupA = CUP_IDS.find((id) => positionsRef.current[id] === a);
      const cupB = CUP_IDS.find((id) => positionsRef.current[id] === b);
      if (cupA === undefined || cupB === undefined) continue;
      const elA = cupRefs.current[cupA];
      const elB = cupRefs.current[cupB];
      if (!elA || !elB) continue;

      const xA = slotX(a, gap);
      const xB = slotX(b, gap);
      const at = tl.duration() + (s === 0 ? 0.12 : 0.02);

      tl.add(() => playSound('shuffle'), at);
      tl.to(elA, { x: xB, duration: dur, ease: 'power1.inOut' }, at);
      tl.to(elB, { x: xA, duration: dur, ease: 'power1.inOut' }, at);
      tl.to(elA, { y: -24, duration: dur * 0.5, ease: 'sine.out', yoyo: true, repeat: 1 }, at);
      tl.to(elB, { y: -24, duration: dur * 0.5, ease: 'sine.out', yoyo: true, repeat: 1 }, at);
      tl.add(() => {
        positionsRef.current[cupA] = b;
        positionsRef.current[cupB] = a;
      }, at + dur);
    }
  }, [
    config.shuffleCount,
    config.shuffleSpeed,
    measureGap,
    placeCupsInstant,
    playSound,
    reduced,
    ui.findHint,
    ui.lockedText,
    ui.watchKey,
  ]);

  runShuffleRef.current = runShuffle;

  const startRound = useCallback(() => {
    busyRef.current = true;
    timelineRef.current?.kill();
    positionsRef.current = [0, 1, 2];
    keyCupRef.current = Math.floor(Math.random() * 3);
    setStatusText(ui.lockedTitle);
    setSubText(ui.lockedText);
    roundKickRef.current += 1;
    setPhase('locked');
  }, [ui.lockedText, ui.lockedTitle]);

  useLayoutEffect(() => {
    if (phase !== 'locked') return;
    const kick = roundKickRef.current;
    let raf = 0;
    let cancelled = false;

    const begin = () => {
      if (cancelled || kick !== roundKickRef.current) return;
      if (!cupRefs.current[0] || !cupRefs.current[1] || !cupRefs.current[2] || !tableRef.current) {
        raf = requestAnimationFrame(begin);
        return;
      }

      if (keyRef.current) {
        gsap.set(keyRef.current, { opacity: 0, x: 0, y: -80, scale: 0.85, rotate: -18 });
      }
      placeCupsInstant();

      const lockEl = lockRef.current;
      const stageEl = stageRef.current;
      if (stageEl) gsap.set(stageEl, { opacity: 1, visibility: 'visible' });

      const tl = gsap.timeline({
        onComplete: () => {
          if (!cancelled && kick === roundKickRef.current) runShuffleRef.current();
        },
      });
      timelineRef.current?.kill();
      timelineRef.current = tl;

      if (lockEl) {
        gsap.set(lockEl, { opacity: 1, scale: 1, rotateY: 0, x: 0 });
        tl.fromTo(
          lockEl,
          { scale: 0.88 },
          { scale: 1, duration: reduced ? 0.2 : 0.45, ease: 'back.out(1.5)' }
        );
        if (!reduced) {
          tl.to(lockEl, { x: -5, duration: 0.05, yoyo: true, repeat: 5, ease: 'power1.inOut' });
        }
        tl.to(lockEl, { opacity: 0.55, scale: 0.94, duration: reduced ? 0.12 : 0.3 }, '+=0.08');
      } else {
        tl.to({}, { duration: 0.2 });
      }
    };

    begin();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, round, placeCupsInstant, reduced]);

  const onWrong = useCallback(
    (picked: number) => {
      busyRef.current = true;
      setPhase('reveal');
      setStatusText(ui.wrongTitle);
      setSubText(ui.wrongText);
      playSound('wrong');

      const gap = gapRef.current;
      const keyCup = keyCupRef.current;
      const keyEl = keyRef.current;

      CUP_IDS.forEach((id) => {
        const el = cupRefs.current[id];
        if (!el) return;
        gsap.to(el, { y: -74, opacity: 1, duration: 0.4, ease: 'power2.out', delay: id * 0.04 });
      });

      if (keyEl) {
        gsap.set(keyEl, {
          opacity: 1,
          x: slotX(positionsRef.current[keyCup], gap),
          y: 8,
          scale: 1,
          rotate: 0,
        });
        gsap.fromTo(
          keyEl,
          { scale: 0.75 },
          { scale: 1.06, duration: 0.45, ease: 'back.out(1.8)' }
        );
      }

      const wrongCup = cupRefs.current[picked];
      if (wrongCup && picked !== keyCup) {
        gsap.fromTo(wrongCup, { x: '-=7' }, { x: '+=7', duration: 0.07, yoyo: true, repeat: 5 });
      }

      window.setTimeout(() => {
        setRound((r) => r + 1);
        startRound();
      }, reduced ? 700 : 1700);
    },
    [playSound, reduced, startRound, ui.wrongText, ui.wrongTitle]
  );

  const onPickCup = (cupId: number) => {
    if (phase !== 'guess' || busyRef.current) return;
    if (cupId === keyCupRef.current) runSuccess();
    else onWrong(cupId);
  };

  const enterFromLanguage = () => {
    onLanguageChange(lang);
    const card = rootRef.current?.querySelector('.cups-welcome__language-card');
    const go = () => startRound();
    if (!card || reduced) {
      go();
      return;
    }
    gsap.to(card, {
      opacity: 0,
      y: -24,
      scale: 0.97,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: go,
    });
  };

  const skipGame = () => {
    timelineRef.current?.kill();
    busyRef.current = false;
    onComplete(lang);
  };

  useGSAP(
    () => {
      if (phase !== 'language') return;
      const card = rootRef.current?.querySelector('.cups-welcome__language-card');
      const langs = rootRef.current?.querySelectorAll('.cups-welcome__lang');
      if (!card) return;
      gsap.fromTo(
        card,
        { opacity: 0, y: 22, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
      );
      if (langs?.length) {
        gsap.fromTo(
          langs,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.05,
            duration: 0.32,
            delay: 0.1,
            ease: 'power2.out',
            clearProps: 'transform',
          }
        );
      }
    },
    { scope: rootRef, dependencies: [phase, activeLanguages.length] }
  );

  useEffect(() => {
    const onResize = () => {
      if (inGame) placeCupsInstant();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inGame, placeCupsInstant]);

  useLayoutEffect(() => {
    if (!inGame) return;
    placeCupsInstant();
  }, [inGame, placeCupsInstant]);

  const logo = useMemo(
    () => (restaurant.logoUrl ? imageUrl(restaurant.logoUrl) : null),
    [restaurant.logoUrl]
  );

  return (
    <div ref={rootRef} className="cups-welcome" data-phase={phase}>
      <div className="cups-welcome__ambience" aria-hidden>
        <span className="cups-welcome__glow cups-welcome__glow--a" />
        <span className="cups-welcome__glow cups-welcome__glow--b" />
        <span className="cups-welcome__vignette" />
      </div>

      <header className="cups-welcome__top">
        <div className="cups-welcome__brand">
          {logo ? (
            <img src={logo} alt="" className="cups-welcome__logo" />
          ) : (
            <KeyRound className="cups-welcome__logo-fallback" />
          )}
          <div>
            <p>{restaurant.name}</p>
            <small>
              Lounge · {ui.round} {round}
            </small>
          </div>
        </div>
        <button
          type="button"
          className="cups-welcome__sound"
          onClick={() => setSoundOn((v) => !v)}
          aria-label={soundOn ? 'Ses kapat' : 'Ses aç'}
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </header>

      {phase === 'language' ? (
        <div className="cups-welcome__language-card">
          <p className="cups-welcome__eyebrow">Private lounge</p>
          <h1>{ui.chooseLanguage}</h1>
          <p className="cups-welcome__hint">{ui.languageHint}</p>
          <div className="cups-welcome__languages">
            {activeLanguages.map((item) => (
              <button
                key={item.code}
                type="button"
                className={`cups-welcome__lang${lang === item.code ? ' is-active' : ''}`}
                onClick={() => {
                  setLang(item.code);
                  onLanguageChange(item.code);
                }}
                aria-label={item.name}
              >
                <LanguageFlag code={item.code} />
              </button>
            ))}
          </div>
          <button type="button" className="cups-welcome__enter" onClick={enterFromLanguage}>
            {ui.enterMenu}
          </button>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className={`cups-welcome__stage${inGame ? ' is-visible' : ' is-hidden'}`}
        aria-hidden={!inGame}
      >
        <div ref={lockRef} className="cups-welcome__lock" aria-hidden>
          <span className="cups-welcome__lock-shackle" />
          <span className="cups-welcome__lock-body" />
          <span className="cups-welcome__lock-glow" />
        </div>

        <p className="cups-welcome__status" role="status">
          {statusText || ui.lockedTitle}
        </p>
        {subText ? <p className="cups-welcome__substatus">{subText}</p> : null}

        <div ref={tableRef} className="cups-welcome__table">
          <div className="cups-welcome__table-top" />
          <div className="cups-welcome__table-edge" />

          <img
            ref={keyRef}
            className="cups-welcome__key"
            src="/welcome/cups-golden-key.png"
            alt=""
            draggable={false}
          />

          <div className="cups-welcome__cups">
            {CUP_IDS.map((id) => (
              <button
                key={id}
                ref={(el) => {
                  cupRefs.current[id] = el;
                }}
                type="button"
                className={`cups-welcome__cup${phase === 'guess' ? ' is-playable' : ''}`}
                aria-disabled={phase !== 'guess'}
                onClick={() => onPickCup(id)}
                aria-label={`Bardak ${id + 1}`}
              >
                <img src="/welcome/cups-lounge-cup.png" alt="" draggable={false} />
              </button>
            ))}
          </div>
        </div>

        {phase === 'success' ? (
          <div className="cups-welcome__success-card">
            <KeyRound className="w-7 h-7" />
            <h2>{ui.unlockTitle}</h2>
            <p>{ui.unlockText}</p>
          </div>
        ) : null}
      </div>

      {showSkip && inGame && phase !== 'success' && config.skipEnabled ? (
        <button type="button" className="cups-welcome__skip" onClick={skipGame}>
          <SkipForward className="w-4 h-4" />
          {ui.skip}
        </button>
      ) : null}
    </div>
  );
}
