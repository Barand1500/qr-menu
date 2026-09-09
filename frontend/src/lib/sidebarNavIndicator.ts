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
    gsap.to(indicator, { opacity: 0, duration: 0.18, overwrite: true });
    return;
  }

  const top = linkTopInNav(active, nav);
  const height = active.getBoundingClientRect().height;
  const instant = opts?.instant || prefersReducedMotion() || indicator.dataset.ready !== '1';

  if (instant) {
    gsap.set(indicator, { top, height, opacity: 1, scaleY: 1 });
    indicator.dataset.ready = '1';
    return;
  }

  const prevTop = Number.parseFloat(String(gsap.getProperty(indicator, 'top'))) || 0;
  const distance = Math.abs(top - prevTop);
  const stretch = Math.min(0.22, distance / 420);

  gsap.killTweensOf(indicator);
  gsap
    .timeline({ overwrite: true })
    .to(
      indicator,
      {
        top,
        height,
        opacity: 1,
        duration: 0.48,
        ease: 'power3.out',
      },
      0
    )
    .fromTo(
      indicator,
      { scaleY: 1 },
      {
        scaleY: 1 + stretch,
        duration: 0.22,
        ease: 'power2.out',
        transformOrigin: top >= prevTop ? 'top center' : 'bottom center',
      },
      0
    )
    .to(
      indicator,
      {
        scaleY: 1,
        duration: 0.28,
        ease: 'power2.out',
      },
      0.2
    );

  indicator.dataset.ready = '1';
}
