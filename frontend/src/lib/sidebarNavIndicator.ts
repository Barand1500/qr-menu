import { gsap, prefersReducedMotion } from '@/lib/gsapSetup';

function linkTopInNav(link: HTMLElement, nav: HTMLElement) {
  return link.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
}

/** Sidebar’daki kayan seçiciyi aktif linke taşır. */
export function moveSidebarNavIndicator(
  nav: HTMLElement,
  indicator: HTMLElement,
  opts?: { instant?: boolean }
) {
  const active = nav.querySelector('.sidebar-nav-link--active') as HTMLElement | null;
  if (!active || active.offsetParent === null) {
    indicator.dataset.animating = '0';
    gsap.to(indicator, { opacity: 0, duration: 0.2, overwrite: true });
    return;
  }

  const top = linkTopInNav(active, nav);
  const height = active.offsetHeight;
  const instant = opts?.instant || prefersReducedMotion() || indicator.dataset.ready !== '1';

  if (instant) {
    indicator.dataset.animating = '0';
    gsap.killTweensOf(indicator);
    gsap.set(indicator, { top, height, opacity: 1 });
    indicator.dataset.ready = '1';
    return;
  }

  const prevTop = Number.parseFloat(String(gsap.getProperty(indicator, 'top'))) || 0;
  const distance = Math.abs(top - prevTop);

  // Kısa mesafe hızlı, uzun mesafe (Özet → Toplu Çeviri) daha yumuşak ve belirgin
  const duration = Math.min(0.72, Math.max(0.38, 0.28 + distance / 700));

  indicator.dataset.animating = '1';
  gsap.killTweensOf(indicator);
  gsap.to(indicator, {
    top,
    height,
    opacity: 1,
    duration,
    ease: 'power2.inOut',
    overwrite: true,
    onComplete: () => {
      indicator.dataset.animating = '0';
    },
  });

  indicator.dataset.ready = '1';
}

export function isSidebarNavIndicatorAnimating(indicator: HTMLElement | null) {
  return indicator?.dataset.animating === '1';
}
