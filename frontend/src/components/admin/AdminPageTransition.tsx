import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap, prefersReducedMotion } from '@/lib/gsapSetup';
import {
  collectAdminPageAnimTargets,
  getAdminPageAnimPreset,
} from '@/lib/adminPageAnimation';

/** Erken return <Spinner /> sayfalarında animasyon spinner’a harcanmasın. */
function isSpinnerOnly(root: HTMLElement) {
  const kids = Array.from(root.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (kids.length === 0) return true;
  if (kids.length > 1) return false;
  const el = kids[0];
  const spin = el.querySelector('.animate-spin');
  if (!spin) return false;
  // Spinner bileşeni: tek ortalanmış dönen halka
  return el.childElementCount <= 2 && el.querySelectorAll('.animate-spin').length >= 1;
}

function playPageEnter(root: HTMLElement) {
  const preset = getAdminPageAnimPreset();
  const targets = collectAdminPageAnimTargets(root);

  gsap.killTweensOf(root);
  if (targets.length) gsap.killTweensOf(targets);

  if (targets.length <= 1) {
    gsap.fromTo(
      root,
      { opacity: 0, y: preset.y },
      {
        opacity: 1,
        y: 0,
        duration: preset.duration,
        ease: preset.ease,
        clearProps: 'transform,opacity',
      }
    );
    return;
  }

  gsap.fromTo(
    targets,
    {
      opacity: 0,
      y: preset.y,
      scale: preset.scale,
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: preset.duration,
      stagger: preset.stagger,
      ease: preset.ease,
      clearProps: 'transform,opacity',
    }
  );
}

/**
 * Admin sayfa giriş animasyonu.
 * Spinner ile erken return eden sayfalarda içeriğin gerçekten gelmesini bekler.
 */
export default function AdminPageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const animKey = `${location.pathname}:${location.key || 'default'}`;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (prefersReducedMotion()) {
      gsap.set(root, { clearProps: 'all' });
      return;
    }

    let played = false;
    let cancelled = false;
    let debounceTimer: number | null = null;

    const observer = new MutationObserver(() => {
      if (cancelled || played) return;
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        tryPlay();
      }, 32);
    });

    const tryPlay = () => {
      if (cancelled || played) return;
      if (isSpinnerOnly(root)) return;
      played = true;
      playPageEnter(root);
      observer.disconnect();
    };

    // Senkron içerik (spinner yok) — hemen; spinner ise MutationObserver bekler
    tryPlay();
    if (!played) {
      observer.observe(root, { childList: true, subtree: true });
    }

    // Güvenlik: içerik geç gelirse yine dene
    const failSafe = window.setTimeout(() => {
      if (!played && !cancelled && !isSpinnerOnly(root)) tryPlay();
    }, 4000);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
      window.clearTimeout(failSafe);
      const node = rootRef.current;
      if (node) {
        gsap.killTweensOf(node);
        const targets = collectAdminPageAnimTargets(node);
        if (targets.length) gsap.killTweensOf(targets);
      }
    };
  }, [animKey]);

  return (
    <div ref={rootRef} className="admin-page-transition" key={animKey}>
      {children}
    </div>
  );
}
