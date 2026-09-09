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
  const tableRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLImageElement>(null);
  const cupRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  const timelineRef = useRef<ReturnType<typeof gsap.timeline> | null>(null);
  const audioRef = useRef<ReturnType<typeof makeAudio> | null>(null);
  const keyCupRef = useRef(1);
  const positionsRef = useRef<number[]>([0, 1, 2]);
  const busyRef = useRef(false);
  const gapRef = useRef(118);
  const roundKickRef = useRef(0);

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
  const [lifted, setLifted] = useState<boolean[]>([false, false, false]);

  const ui = cupsWelcomeUi(lang);
  const reduced = prefersReducedMotion();

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
  }, []);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    if (phase === 'language' || !config.skipEnabled) return;
    if (config.skipDelaySeconds === 0) {
      setShowSkip(true);
      return;
    }
    setShowSkip(false);
    const timer = window.setTimeout(() => setShowSkip(true), config.skipDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [phase, config.skipEnabled, config.skipDelaySeconds]);

  const measureGap = useCallback(() => {
    const table = tableRef.current;
    if (!table) return 118;
    const w = table.clientWidth;
    gapRef.current = Math.max(88, Math.min(150, w * 0.28));
    return gapRef.current;
  }, []);

  const placeCupsInstant = useCallback(() => {
    const gap = measureGap();
    CUP_IDS.forEach((id) => {
      const el = cupRefs.current[id];
      if (!el) return;
      gsap.set(el, { x: slotX(positionsRef.current[id], gap), y: 0, rotate: 0, scale: 1 });
    });
  }, [measureGap]);

  const resetRoundVisual = useCallback(() => {
    setLifted([false, false, false]);
    positionsRef.current = [0, 1, 2];
    keyCupRef.current = Math.floor(Math.random() * 3);
    placeCupsInstant();
    if (keyRef.current) {
      gsap.set(keyRef.current, {
        opacity: 0,
        y: -80,
        x: 0,
        scale: 0.85,
        rotate: -18,
      });
    }
  }, [placeCupsInstant]);

  const finishUnlock = useCallback(() => {
    window.setTimeout(() => onComplete(lang), reduced ? 400 : 2400);
  }, [lang, onComplete, reduced]);

  const runSuccess = useCallback(() => {
    busyRef.current = true;
    setPhase('success');
    setStatusText(ui.unlockTitle);
    playSound('correct');
    playSound('unlock');

    const tl = gsap.timeline({
      onComplete: finishUnlock,
    });
    timelineRef.current?.kill();
    timelineRef.current = tl;

    const keyCup = keyCupRef.current;
    const gap = gapRef.current;
    const keyEl = keyRef.current;
    const lockEl = lockRef.current;
    const cupEl = cupRefs.current[keyCup];

    if (cupEl) {
      tl.to(cupEl, { y: -72, duration: 0.45, ease: 'power2.out' }, 0);
    }
    setLifted((prev) => prev.map((_, i) => i === keyCup));

    if (keyEl) {
      gsap.set(keyEl, {
        opacity: 1,
        x: slotX(positionsRef.current[keyCup], gap),
        y: 18,
        scale: 0.92,
        rotate: 0,
      });
      tl.to(
        keyEl,
        { y: -40, scale: 1.15, rotate: 12, duration: 0.55, ease: 'back.out(1.6)' },
        0.2
      );
      tl.to(keyEl, { x: 0, y: -120, scale: 0.7, duration: 0.7, ease: 'power2.inOut' }, 0.75);
    }

    if (lockEl) {
      tl.fromTo(
        lockEl,
        { opacity: 0.35, scale: 0.9 },
        { opacity: 1, scale: 1.08, duration: 0.45, ease: 'power2.out' },
        1.1
      );
      tl.to(lockEl, { rotateY: 110, opacity: 0, duration: 0.75, ease: 'power3.in' }, 1.45);
    }

    tl.to('.cups-welcome__success-card', { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.4)' }, 1.5);
  }, [finishUnlock, playSound, ui.unlockTitle]);

  const runShuffle = useCallback(() => {
    setPhase('shuffle');
    setStatusText(ui.watchKey);
    const gap = gapRef.current;
    const dur = reduced ? 0.08 : SHUFFLE_DUR[config.shuffleSpeed];
    const swaps = config.shuffleCount;
    const tl = gsap.timeline({
      onComplete: () => {
        busyRef.current = false;
        setPhase('guess');
        setStatusText(ui.findHint);
      },
    });
    timelineRef.current?.kill();
    timelineRef.current = tl;

    // Cover sequence: lift key-cup, absorb key, settle
    const keyCup = keyCupRef.current;
    const keyEl = keyRef.current;
    const coverCup = cupRefs.current[keyCup];
    const coverX = slotX(positionsRef.current[keyCup], gap);

    if (keyEl) {
      gsap.set(keyEl, { opacity: 1, x: 0, y: -90, scale: 0.9, rotate: -20 });
      playSound('drop');
      tl.to(keyEl, { y: 22, rotate: 8, scale: 1, duration: reduced ? 0.2 : 0.7, ease: 'bounce.out' }, 0);
    }

    if (coverCup) {
      tl.to(coverCup, { y: -54, duration: 0.35, ease: 'power2.out' }, reduced ? 0.15 : 0.75);
      tl.to(coverCup, { x: 0, duration: 0.4, ease: 'power2.inOut' }, '-=0.1');
      if (keyEl) {
        tl.to(keyEl, { opacity: 0, scale: 0.6, duration: 0.2 }, '-=0.05');
      }
      tl.add(() => playSound('cover'));
      tl.to(coverCup, { x: coverX, y: 0, duration: 0.45, ease: 'power2.inOut' });
    }

    // Shuffle swaps
    for (let s = 0; s < swaps; s += 1) {
      let a = Math.floor(Math.random() * 3);
      let b = Math.floor(Math.random() * 3);
      while (b === a) b = Math.floor(Math.random() * 3);

      const cupA = CUP_IDS.find((id) => positionsRef.current[id] === a)!;
      const cupB = CUP_IDS.find((id) => positionsRef.current[id] === b)!;
      const elA = cupRefs.current[cupA];
      const elB = cupRefs.current[cupB];
      if (!elA || !elB) continue;

      const xA = slotX(a, gap);
      const xB = slotX(b, gap);
      const at = tl.duration() + (s === 0 ? 0.15 : 0.02);

      tl.add(() => playSound('shuffle'), at);
      tl.to(elA, { x: xB, duration: dur, ease: 'power1.inOut' }, at);
      tl.to(elB, { x: xA, duration: dur, ease: 'power1.inOut' }, at);
      tl.to(elA, { y: -22, duration: dur * 0.5, ease: 'sine.out', yoyo: true, repeat: 1 }, at);
      tl.to(elB, { y: -22, duration: dur * 0.5, ease: 'sine.out', yoyo: true, repeat: 1 }, at);
      tl.add(() => {
        positionsRef.current[cupA] = b;
        positionsRef.current[cupB] = a;
      }, at + dur);
    }
  }, [config.shuffleCount, config.shuffleSpeed, playSound, reduced, ui.findHint, ui.watchKey]);

  const startRound = useCallback(() => {
    busyRef.current = true;
    timelineRef.current?.kill();
    setLifted([false, false, false]);
    positionsRef.current = [0, 1, 2];
    keyCupRef.current = Math.floor(Math.random() * 3);
    setStatusText(ui.lockedTitle);
    roundKickRef.current += 1;
    setPhase('locked');
  }, [ui.lockedTitle]);

  useLayoutEffect(() => {
    if (phase !== 'locked') return;
    const kick = roundKickRef.current;

    const begin = () => {
      if (kick !== roundKickRef.current) return;
      if (!cupRefs.current[0] || !cupRefs.current[1] || !cupRefs.current[2]) {
        requestAnimationFrame(begin);
        return;
      }

      resetRoundVisual();
      measureGap();

      const lockEl = lockRef.current;
      const tl = gsap.timeline({
        onComplete: () => {
          if (kick === roundKickRef.current) runShuffle();
        },
      });
      timelineRef.current?.kill();
      timelineRef.current = tl;

      if (lockEl) {
        gsap.set(lockEl, { opacity: 1, scale: 1, rotateY: 0, x: 0 });
        tl.fromTo(
          lockEl,
          { scale: 0.86, opacity: 0 },
          { scale: 1, opacity: 1, duration: reduced ? 0.2 : 0.45, ease: 'back.out(1.5)' }
        );
        if (!reduced) {
          tl.to(lockEl, { x: -6, duration: 0.06, yoyo: true, repeat: 5, ease: 'power1.inOut' });
        }
        tl.to(lockEl, { opacity: 0.4, scale: 0.92, duration: reduced ? 0.15 : 0.35 }, '+=0.1');
      } else {
        tl.to({}, { duration: 0.25 });
      }
    };

    begin();
    // Only re-boot when a new round is requested (phase/round), not when callbacks recreate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const onWrong = useCallback(
    (picked: number) => {
      busyRef.current = true;
      setPhase('reveal');
      setStatusText(ui.wrongTitle);
      playSound('wrong');
      setLifted([true, true, true]);

      const gap = gapRef.current;
      const keyCup = keyCupRef.current;
      const keyEl = keyRef.current;

      CUP_IDS.forEach((id) => {
        const el = cupRefs.current[id];
        if (!el) return;
        gsap.to(el, {
          y: -70,
          duration: 0.4,
          ease: 'power2.out',
          delay: id * 0.05,
        });
      });

      if (keyEl) {
        gsap.set(keyEl, {
          opacity: 1,
          x: slotX(positionsRef.current[keyCup], gap),
          y: 16,
          scale: 1,
          rotate: 0,
        });
        gsap.fromTo(
          keyEl,
          { scale: 0.7, opacity: 0.4 },
          { scale: 1.05, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }
        );
      }

      const wrongCup = cupRefs.current[picked];
      if (wrongCup && picked !== keyCup) {
        gsap.fromTo(wrongCup, { x: '-=8' }, { x: '+=8', duration: 0.08, yoyo: true, repeat: 5 });
      }

      window.setTimeout(() => {
        setRound((r) => r + 1);
        startRound();
      }, reduced ? 700 : 1800);
    },
    [playSound, reduced, startRound, ui.wrongTitle]
  );

  const onPickCup = (cupId: number) => {
    if (phase !== 'guess' || busyRef.current) return;
    if (cupId === keyCupRef.current) runSuccess();
    else onWrong(cupId);
  };

  const enterFromLanguage = () => {
    onLanguageChange(lang);
    const card = rootRef.current?.querySelector('.cups-welcome__language-card');
    if (!card || reduced) {
      startRound();
      return;
    }
    gsap.to(card, {
      opacity: 0,
      y: -28,
      scale: 0.96,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => startRound(),
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
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.32, delay: 0.1, ease: 'power2.out', clearProps: 'all' }
        );
      }
    },
    { scope: rootRef, dependencies: [phase, activeLanguages.length] }
  );

  useEffect(() => {
    const onResize = () => {
      if (phase === 'guess' || phase === 'shuffle' || phase === 'locked') placeCupsInstant();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase, placeCupsInstant]);

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
          {logo ? <img src={logo} alt="" className="cups-welcome__logo" /> : <KeyRound className="cups-welcome__logo-fallback" />}
          <div>
            <p>{restaurant.name}</p>
            <small>Lounge · {ui.round} {round}</small>
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
      ) : (
        <div className="cups-welcome__stage">
          <div ref={lockRef} className="cups-welcome__lock" aria-hidden>
            <span className="cups-welcome__lock-body" />
            <span className="cups-welcome__lock-shackle" />
            <span className="cups-welcome__lock-glow" />
          </div>

          <p className="cups-welcome__status" role="status">
            {statusText || ui.lockedText}
          </p>
          {phase === 'locked' || phase === 'shuffle' ? (
            <p className="cups-welcome__substatus">{ui.lockedText}</p>
          ) : null}
          {phase === 'reveal' ? <p className="cups-welcome__substatus">{ui.wrongText}</p> : null}

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
                  className={`cups-welcome__cup${lifted[id] ? ' is-lifted' : ''}${
                    phase === 'guess' ? ' is-playable' : ''
                  }`}
                  disabled={phase !== 'guess'}
                  onClick={() => onPickCup(id)}
                  aria-label={`Bardak ${id + 1}`}
                >
                  <span className="cups-welcome__cup-shine" />
                  <span className="cups-welcome__cup-body" />
                  <span className="cups-welcome__cup-rim" />
                  <span className="cups-welcome__cup-stem" />
                  <span className="cups-welcome__cup-base" />
                </button>
              ))}
            </div>
          </div>

          {phase === 'success' ? (
            <div className="cups-welcome__success-card" style={{ opacity: 0, transform: 'translateY(18px) scale(0.94)' }}>
              <KeyRound className="w-7 h-7" />
              <h2>{ui.unlockTitle}</h2>
              <p>{ui.unlockText}</p>
            </div>
          ) : null}
        </div>
      )}

      {showSkip && phase !== 'language' && phase !== 'success' && config.skipEnabled ? (
        <button type="button" className="cups-welcome__skip" onClick={skipGame}>
          <SkipForward className="w-4 h-4" />
          {ui.skip}
        </button>
      ) : null}
    </div>
  );
}
