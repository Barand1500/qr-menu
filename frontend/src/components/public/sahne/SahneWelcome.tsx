import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowRight, ChevronsRight, Clock } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { resolveMenuSlug } from '@/lib/menuPaths';
import { sofraCopy } from '@/lib/sofra';
import { SofraBrand, SofraText } from '../sofra/SofraElements';
import type { SofraWelcomeProps } from '../sofra/types';
import {
  Magnetic,
  Marquee,
  MOBILE_QUERY,
  Photo,
  SahneLanguage,
  SplitText,
  cssVars,
  isRtl,
  prefersReducedMotion,
  useMedia,
} from './shared';
import './sahne.css';

interface WelcomeMedia {
  ready: boolean;
  hero: string;
  photos: string[];
  names: string[];
}
type Stage = 'load' | 'reveal' | 'done';

/**
 * Collects the business's own photos once per page load: showcase first, then popular
 * products and categories. Everything is preloaded before the reveal, so nothing swaps mid-animation.
 */
function useWelcomeMedia(welcomeImage: string, lang: string, editing: boolean): WelcomeMedia {
  const [media, setMedia] = useState<WelcomeMedia>({
    ready: false,
    hero: welcomeImage,
    photos: [],
    names: [],
  });
  useEffect(() => {
    if (editing) return;
    let cancelled = false,
      finished = false;
    let showcase: string[] = [],
      others: string[] = [],
      names: string[] = [];
    const clean = (urls: (string | null | undefined)[]) => [
      ...new Set(urls.filter((url): url is string => Boolean(url?.trim())).map((url) => url.trim())),
    ];
    const preload = (src: string) =>
      new Promise<string | null>((resolve) => {
        const img = new Image();
        let settled = false;
        const done = (value: string | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          img.onload = img.onerror = null;
          resolve(value);
        };
        const timer = setTimeout(() => done(null), 1500);
        img.onload = () => done(src);
        img.onerror = () => done(null);
        img.src = imageUrl(src);
      });
    async function finish() {
      if (cancelled || finished) return;
      finished = true;
      clearTimeout(deadline);
      const hero = showcase[0] || welcomeImage;
      const pool = clean([...showcase.slice(1), ...others]).filter((url) => url !== hero);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const loaded = (await Promise.all([hero, ...pool.slice(0, 8)].map(preload))).filter(
        (src): src is string => Boolean(src),
      );
      if (cancelled) return;
      setMedia({ ready: true, hero: loaded[0] ?? hero, photos: loaded.length ? loaded : [hero], names });
    }
    const deadline = setTimeout(() => void finish(), 1800);
    resolveMenuSlug()
      .then(async (slug) => {
        let groupImages: string[] = [],
          productImages: string[] = [];
        await Promise.allSettled([
          api<{
            showcase?: { imageUrl?: string | null }[];
            groups?: { name: string; imageUrl?: string | null }[];
          }>(`/api/menu/${slug}?lang=${lang}`).then((data) => {
            if (finished) return;
            showcase = clean((data.showcase || []).map((item) => item.imageUrl));
            groupImages = clean((data.groups || []).map((group) => group.imageUrl));
            names = (data.groups || []).map((group) => group.name).filter(Boolean);
          }),
          api<{ imageUrl?: string | null }[]>(
            `/api/menu/${slug}/popular-products?lang=${lang}`,
          ).then((data) => {
            if (!finished && Array.isArray(data))
              productImages = clean(data.map((item) => item.imageUrl));
          }),
        ]);
        others = [...productImages, ...groupImages];
        await finish();
      })
      .catch(() => void finish());
    return () => {
      cancelled = true;
      clearTimeout(deadline);
    };
    // One selection per page load: language or render updates must not replace moving photos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return editing ? { ready: true, hero: welcomeImage, photos: [welcomeImage], names: [] } : media;
}

/** Counts to 100 while the photos load, then opens the curtain. */
function useIntro(ready: boolean, skip: boolean, counter: RefObject<HTMLElement | null>): Stage {
  const [stage, setStage] = useState<Stage>(skip ? 'done' : 'load');
  const [counted, setCounted] = useState(skip);
  useEffect(() => {
    if (skip) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      const eased = 1 - Math.pow(1 - t, 3);
      if (counter.current) counter.current.textContent = String(Math.round(eased * 100));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setCounted(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skip, counter]);
  useEffect(() => {
    if (skip || !counted || !ready) return;
    setStage('reveal');
    const timer = setTimeout(() => setStage('done'), 1500);
    return () => clearTimeout(timer);
  }, [skip, counted, ready]);
  return stage;
}

/** Longest line decides how far the display type has to scale down. */
function titleFit(text: string, room: number) {
  const longest = Math.max(1, ...text.split('\n').map((line) => line.trim().length));
  return Math.max(0.36, Math.min(1, room / longest)).toFixed(3);
}

function SlideToEnter({
  children,
  onEnter,
  disabled,
  inert,
}: {
  children: ReactNode;
  onEnter: (from: HTMLElement) => void;
  disabled?: boolean;
  inert?: boolean;
}) {
  const drag = useRef<{ startX: number; max: number; moved: boolean } | null>(null);
  const dragged = useRef(0);
  const [done, setDone] = useState(false);
  const locked = inert || disabled || done;
  function finish(track: HTMLElement) {
    if (locked) return;
    setDone(true);
    track.style.setProperty('--p', '1');
    window.setTimeout(() => onEnter(track.querySelector<HTMLElement>('.sh-slide__knob') || track), 280);
  }
  function release(track: HTMLElement, clientX: number) {
    const state = drag.current;
    drag.current = null;
    track.classList.remove('is-dragging');
    if (!state?.moved) return;
    dragged.current = Date.now();
    if ((clientX - state.startX) / state.max > 0.55) finish(track);
    else track.style.setProperty('--p', '0');
  }
  return (
    <div
      className={`sh-slide${done ? ' is-done' : ''}`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (Date.now() - dragged.current > 400) finish(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || e.target !== e.currentTarget) return;
        e.preventDefault();
        finish(e.currentTarget);
      }}
      onPointerDown={(e) => {
        if (locked) return;
        drag.current = {
          startX: e.clientX,
          max: Math.max(1, e.currentTarget.getBoundingClientRect().width - 68),
          moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const state = drag.current;
        if (!state) return;
        const dx = e.clientX - state.startX;
        if (!state.moved && Math.abs(dx) < 6) return;
        state.moved = true;
        e.currentTarget.classList.add('is-dragging');
        e.currentTarget.style.setProperty('--p', String(Math.max(0, Math.min(1, dx / state.max))));
      }}
      onPointerUp={(e) => release(e.currentTarget, e.clientX)}
      onPointerCancel={(e) => release(e.currentTarget, drag.current?.startX ?? 0)}
    >
      <span className="sh-slide__fill" aria-hidden="true" />
      <span className="sh-slide__label">{children}</span>
      <span className="sh-slide__knob" aria-hidden="true">
        <ChevronsRight size={24} />
      </span>
    </div>
  );
}

/** Mobile backdrop: a drifting wall when there are enough photos, a slow slideshow otherwise. */
function MobileBackdrop({ photos }: { photos: string[] }) {
  const [active, setActive] = useState(0);
  const wall = photos.length >= 4;
  useEffect(() => {
    if (wall || photos.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setActive((n) => (n + 1) % photos.length), 4800);
    return () => clearInterval(timer);
  }, [wall, photos.length]);
  if (!wall)
    return (
      <div className="sh-slides" aria-hidden="true">
        {photos.map((src, i) => (
          <div key={src} className={i === active % photos.length ? 'is-on' : undefined}>
            <Photo src={src} eager />
          </div>
        ))}
      </div>
    );
  const step = Math.ceil(photos.length / 3);
  return (
    <div className="sh-wall" aria-hidden="true">
      {[0, 1, 2].map((column) => {
        const tiles = Array.from(
          { length: Math.min(5, photos.length) },
          (_, i) => photos[(column * step + i) % photos.length],
        );
        return (
          <div className="sh-wall__column" key={column}>
            <div className="sh-wall__track">
              {[...tiles, ...tiles].map((src, i) => (
                <Photo key={i} src={src} eager />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SahneWelcome(p: SofraWelcomeProps) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const ringId = useId();
  const editing = Boolean(p.onTextEdit);
  const mobile = useMedia(root, MOBILE_QUERY);
  const copy = sofraCopy(p.config, p.lang);
  const en = p.lang.split('-')[0] === 'en';
  const brand = p.config.brandName || p.restaurant.name;
  const media = useWelcomeMedia(p.config.welcomeImage, p.lang, editing);
  const [still] = useState(() => editing || prefersReducedMotion());
  const stage = useIntro(media.ready, still, counter);
  const photos = media.photos.length ? media.photos : [media.hero];

  // Desktop: the fan of photos leans a little toward the pointer.
  useEffect(() => {
    const node = root.current,
      view = node?.ownerDocument.defaultView;
    if (!node || !view || mobile || still) return;
    if (!view.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0,
      x = 0,
      y = 0;
    const paint = () => {
      frame = 0;
      node.style.setProperty('--px', x.toFixed(3));
      node.style.setProperty('--py', y.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      x = e.clientX / view.innerWidth - 0.5;
      y = e.clientY / view.innerHeight - 0.5;
      if (!frame) frame = view.requestAnimationFrame(paint);
    };
    view.addEventListener('pointermove', move, { passive: true });
    return () => {
      view.cancelAnimationFrame(frame);
      view.removeEventListener('pointermove', move);
    };
  }, [mobile, still]);

  function enter(from: HTMLElement) {
    if (!p.onEnter || p.entering) return;
    const node = root.current;
    if (node) {
      const box = from.getBoundingClientRect();
      node.style.setProperty('--wx', `${box.left + box.width / 2}px`);
      node.style.setProperty('--wy', `${box.top + box.height / 2}px`);
    }
    try {
      sessionStorage.setItem('sahne-wipe', '1');
    } catch {}
    p.onEnter();
  }

  const header = (
    <header className="sh-top">
      <SofraBrand {...p} />
      <div className="sh-top__tools">
        <SahneLanguage lang={p.lang} languages={p.languages} onChange={p.onLangChange} />
        {p.tableLabel && <span className="sh-pill">{p.tableLabel}</span>}
      </div>
    </header>
  );
  const eyebrow = (
    <span className="sh-eyebrow">
      <i aria-hidden="true" />
      <SofraText field="sealText" value={copy.sealText} onTextEdit={p.onTextEdit} />
      {p.config.openingHours && (
        <span className="sh-eyebrow__hours">
          <Clock size={13} aria-hidden="true" />
          {p.config.openingHours}
        </span>
      )}
    </span>
  );
  const title = editing ? (
    <SofraText
      as="h1"
      className="sh-title"
      field="welcomeTitle"
      value={copy.welcomeTitle}
      onTextEdit={p.onTextEdit}
    />
  ) : (
    <h1
      className="sh-title"
      aria-label={copy.welcomeTitle.replace(/\n/g, ' ')}
      style={cssVars({ '--fit': titleFit(copy.welcomeTitle, mobile ? 13 : 15) })}
    >
      <SplitText text={copy.welcomeTitle} />
    </h1>
  );
  const subtitle = (
    <SofraText
      as="p"
      className="sh-sub"
      field="welcomeSubtitle"
      value={copy.welcomeSubtitle}
      onTextEdit={p.onTextEdit}
    />
  );
  const enterLabel = (
    <SofraText field="enterLabel" value={copy.enterLabel} onTextEdit={p.onTextEdit} />
  );
  const footer = (
    <footer className="sh-foot">
      <SofraText
        className="sh-foot__note"
        field="footerText"
        value={copy.footerText}
        onTextEdit={p.onTextEdit}
      />
      {p.extra && <div className="sh-foot__links">{p.extra}</div>}
    </footer>
  );

  let body: ReactNode;
  if (mobile) {
    body = (
      <>
        {editing ? (
          <button
            type="button"
            className="sh-slides sh-slides--edit"
            onClick={() => p.onImageEdit?.('welcomeImage')}
          >
            <div className="is-on">
              <Photo src={media.hero} eager />
            </div>
            <span className="sh-edit-photo">Fotoğrafı değiştir</span>
          </button>
        ) : (
          <MobileBackdrop photos={photos} />
        )}
        <div className="sh-scrim" aria-hidden="true" />
        {header}
        <main className="sh-mhero">
          {eyebrow}
          {title}
          {subtitle}
          <SlideToEnter onEnter={enter} disabled={p.entering} inert={editing}>
            {enterLabel}
          </SlideToEnter>
        </main>
        {footer}
      </>
    );
  } else {
    const shown = photos.slice(0, 5);
    const fan: string[] = [];
    // Alternate sides so the first (main) photo ends up in the middle of the fan.
    shown.forEach((src, i) => (i % 2 ? fan.unshift(src) : fan.push(src)));
    // The ring has room for about 46 characters; longer brand names are left out of it.
    const ringPair = `${copy.enterLabel} ✦ ${brand} ✦ `;
    const ringText = (
      ringPair.length <= 46 ? ringPair : `${copy.enterLabel} ✦ ${copy.enterLabel} ✦ `
    ).toLocaleUpperCase(p.lang);
    const marquee = media.names.length ? media.names : [brand, copy.picksLabel, copy.menuTitle];
    body = (
      <>
        <div className="sh-aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {header}
        <main className="sh-hero">
          <div className="sh-hero__copy">
            {eyebrow}
            {title}
            {subtitle}
            <div className="sh-cta">
              <Magnetic>
                <button
                  type="button"
                  className="sh-enter"
                  onClick={(e) => enter(e.currentTarget)}
                  disabled={p.entering}
                >
                  {enterLabel}
                  <span className="sh-enter__orb" aria-hidden="true">
                    <ArrowRight size={22} />
                  </span>
                </button>
              </Magnetic>
            </div>
          </div>
          <div className="sh-fan" data-count={fan.length}>
            {fan.map((src, i) => {
              const k = i - (fan.length - 1) / 2,
                main = src === shown[0];
              return (
                <button
                  type="button"
                  key={src}
                  className={`sh-fan__card${main ? ' is-main' : ''}`}
                  style={{
                    ...cssVars({ '--k': k, '--ak': Math.abs(k), '--i': i }),
                    zIndex: 10 - Math.round(Math.abs(k) * 2),
                  }}
                  tabIndex={main ? 0 : -1}
                  aria-hidden={main ? undefined : true}
                  aria-label={
                    main
                      ? p.onImageEdit
                        ? 'Fotoğrafı değiştir'
                        : en
                          ? 'Open the menu'
                          : 'Menüyü aç'
                      : undefined
                  }
                  onClick={(e) =>
                    main && p.onImageEdit ? p.onImageEdit('welcomeImage') : enter(e.currentTarget)
                  }
                >
                  <Photo src={src} eager />
                  {main && p.onImageEdit && <span className="sh-edit-photo">Fotoğrafı değiştir</span>}
                </button>
              );
            })}
            <span className="sh-ring" aria-hidden="true" hidden={ringText.length > 50}>
              <svg viewBox="0 0 120 120">
                <defs>
                  <path id={ringId} d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
                </defs>
                <text>
                  <textPath href={`#${ringId}`} textLength={282} lengthAdjust="spacing">
                    {ringText}
                  </textPath>
                </text>
              </svg>
              <ArrowRight size={26} />
            </span>
          </div>
        </main>
        <Marquee items={marquee} />
        {footer}
      </>
    );
  }

  return (
    <div
      ref={root}
      className={`sahne sh-welcome sh-welcome--${mobile ? 'mob' : 'desk'} is-${stage}${
        p.entering ? ' is-entering' : ''
      }${editing ? ' is-editing' : ''}`}
      dir={isRtl(p.lang) ? 'rtl' : 'ltr'}
    >
      {body}
      <div className="sh-grain" aria-hidden="true" />
      {stage !== 'done' && (
        <div className="sh-loader" aria-hidden="true">
          <span className="sh-loader__brand">{brand}</span>
          <span className="sh-loader__count">
            <span ref={counter}>0</span>
          </span>
        </div>
      )}
      <div className="sh-wipe" aria-hidden="true">
        <span>{brand}</span>
      </div>
    </div>
  );
}
