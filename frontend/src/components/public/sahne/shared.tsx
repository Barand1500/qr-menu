import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Check, ChevronDown, Utensils } from 'lucide-react';
import LanguageFlag from '@/components/LanguageFlag';
import { imageUrl } from '@/lib/api';

export const MOBILE_QUERY = '(max-width: 1023px)';
export const isRtl = (lang: string) => ['ar', 'he', 'fa', 'ur'].includes(lang.split('-')[0]);
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Media query against the element's own window, so the editor iframe behaves like a real device. */
export function useMedia(ref: RefObject<HTMLElement | null>, query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useLayoutEffect(() => {
    const view = ref.current?.ownerDocument.defaultView;
    if (!view) return;
    const media = view.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [ref, query]);
  return matches;
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Open state of the mobile category overlay, shared by the menu and the dock. */
const Nav = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);
export function SahneNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Nav.Provider value={{ open, setOpen }}>{children}</Nav.Provider>;
}
export const useSahneNav = () => useContext(Nav);

export function Photo({
  src,
  alt = '',
  eager,
  className,
}: {
  src?: string | null;
  alt?: string;
  eager?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken)
    return (
      <span className={`sh-photo-empty${className ? ' ' + className : ''}`} aria-hidden="true">
        <Utensils size={26} />
      </span>
    );
  return (
    <img
      className={className}
      src={src.startsWith('blob:') ? src : imageUrl(src)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Word-by-word masked reveal. Words (not letters) keep Arabic and other joined scripts intact.
 * The pieces are hidden from assistive tech; put the full text in the parent's aria-label.
 */
export function SplitText({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  let index = 0;
  return (
    <>
      {lines.map((line, l) => {
        const words = line.split(/\s+/);
        return (
          <span className="sh-line" key={l} aria-hidden="true">
            {words.map((word, w) => {
              const accent =
                lines.length > 1 ? l === lines.length - 1 : words.length > 1 && w === words.length - 1;
              return (
                <Fragment key={w}>
                  <span className="sh-word">
                    <span
                      className={accent ? 'is-accent' : undefined}
                      style={cssVars({ '--i': index++ })}
                    >
                      {word}
                    </span>
                  </span>{' '}
                </Fragment>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

/** Pulls its child toward the pointer. Mouse only; touch and reduced motion keep it still. */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const zone = outer.current,
      target = inner.current,
      view = zone?.ownerDocument.defaultView;
    if (!zone || !target || !view) return;
    if (!view.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion())
      return;
    const move = (e: PointerEvent) => {
      const box = zone.getBoundingClientRect();
      const x = (e.clientX - box.left - box.width / 2) * strength;
      const y = (e.clientY - box.top - box.height / 2) * strength;
      target.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    const leave = () => {
      target.style.transform = '';
    };
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerleave', leave);
    return () => {
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerleave', leave);
    };
  }, [strength]);
  return (
    <span className="sh-magnetic" ref={outer}>
      <span className="sh-magnetic__inner" ref={inner}>
        {children}
      </span>
    </span>
  );
}

/**
 * One delegated listener gives every `.sh-card` inside the container a pointer-following
 * light (--mx/--my) and a small 3D tilt (--rx/--ry).
 */
export function useCardPointer(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const host = ref.current,
      view = host?.ownerDocument.defaultView;
    if (!host || !view || !active) return;
    if (!view.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion())
      return;
    let current: HTMLElement | null = null,
      frame = 0,
      last: PointerEvent | null = null;
    const reset = (card: HTMLElement | null) => {
      card?.style.removeProperty('--rx');
      card?.style.removeProperty('--ry');
    };
    const paint = () => {
      frame = 0;
      if (!last) return;
      const card = (last.target as Element).closest?.('.sh-card') as HTMLElement | null;
      if (card !== current) {
        reset(current);
        current = card;
      }
      if (!card) return;
      const box = card.getBoundingClientRect();
      const x = (last.clientX - box.left) / box.width,
        y = (last.clientY - box.top) / box.height;
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
    };
    const move = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = view.requestAnimationFrame(paint);
    };
    const leave = () => {
      last = null;
      reset(current);
      current = null;
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      view.cancelAnimationFrame(frame);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      reset(current);
    };
  }, [ref, active]);
}

/** Adds `is-in` to `[data-reveal]` children the first time they scroll into view. */
export function useReveal(ref: RefObject<HTMLElement | null>, deps: unknown[], instant = false) {
  useEffect(() => {
    const host = ref.current,
      view = host?.ownerDocument.defaultView;
    if (!host || !view) return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
    if (!nodes.length) return;
    const Observer = (view as Window & typeof globalThis).IntersectionObserver;
    if (instant || !Observer || prefersReducedMotion()) {
      nodes.forEach((node) => node.classList.add('is-in'));
      return;
    }
    const observer = new Observer(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }),
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  // Repeat short lists so a single track is always wider than the screen.
  const track = Array.from({ length: Math.max(2, Math.ceil(12 / items.length)) }, () => items).flat();
  return (
    <div className={`sh-marquee${className ? ' ' + className : ''}`} aria-hidden="true">
      {[0, 1].map((copy) => (
        <div className="sh-marquee__track" key={copy}>
          {track.map((item, i) => (
            <span key={i}>
              {item}
              <i>✦</i>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SahneLanguage({
  lang,
  languages,
  onChange,
}: {
  lang: string;
  languages: { code: string; name: string }[];
  onChange?: (code: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute('open');
  if (languages.length < 2) return null;
  return (
    <details
      className="sh-lang"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        close();
        ref.current?.querySelector('summary')?.focus();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <summary aria-label="Dil / Language">
        <LanguageFlag code={lang} size={20} />
        <span>{languages.find((l) => l.code === lang)?.name || lang}</span>
        <ChevronDown size={14} />
      </summary>
      <div className="sh-lang__list">
        {languages.map((l, i) => (
          <button
            type="button"
            key={l.code}
            aria-pressed={lang === l.code}
            style={cssVars({ '--i': i })}
            onClick={() => {
              onChange?.(l.code);
              close();
            }}
          >
            <LanguageFlag code={l.code} size={20} />
            <span>{l.name}</span>
            {lang === l.code && <Check size={15} />}
          </button>
        ))}
      </div>
    </details>
  );
}
