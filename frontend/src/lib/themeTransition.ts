import gsap from 'gsap';
import { prefersReducedMotion } from '@/lib/gsapSetup';
import type { ThemeMode } from '@/contexts/ThemeContext';
import '@/theme-flip.css';

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;

const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function destBg(to: ThemeMode) {
  return to === 'dark' ? '#0c0c0c' : '#eef1f6';
}

let running = false;

export function isThemeFlipRunning() {
  return running;
}

/**
 * Header’daki ay/güneş ikonunu ortaya uçurur, döndürürken ikonu değiştirir,
 * ardından ortadan dairesel renk geçişi yapar.
 */
export function playThemeFlip(opts: {
  from: ThemeMode;
  to: ThemeMode;
  originEl: HTMLElement;
  onCommit: () => void;
}): Promise<void> {
  if (running) return Promise.resolve();
  if (prefersReducedMotion()) {
    opts.onCommit();
    return Promise.resolve();
  }

  running = true;
  const { from, to, originEl, onCommit } = opts;
  const origin = originEl.getBoundingClientRect();
  const startX = origin.left + origin.width / 2;
  const startY = origin.top + origin.height / 2;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  // Başta header’daki ikon (light→Ay, dark→Güneş); sonda gidilen tema (gece→Ay, gündüz→Güneş)
  const startSvg = from === 'light' ? MOON_SVG : SUN_SVG;
  const endSvg = to === 'dark' ? MOON_SVG : SUN_SVG;
  const startColor = from === 'light' ? 'var(--admin-accent, #64748b)' : '#fbbf24';
  const endColor = to === 'dark' ? '#94a3b8' : '#fbbf24';

  const root = document.createElement('div');
  root.className = 'theme-flip';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="theme-flip__veil"></div>
    <div class="theme-flip__glow"></div>
    <div class="theme-flip__orb">
      <div class="theme-flip__icon theme-flip__icon--start">${startSvg}</div>
      <div class="theme-flip__icon theme-flip__icon--end">${endSvg}</div>
    </div>
  `;
  document.body.appendChild(root);

  const veil = root.querySelector('.theme-flip__veil') as HTMLElement;
  const glow = root.querySelector('.theme-flip__glow') as HTMLElement;
  const orb = root.querySelector('.theme-flip__orb') as HTMLElement;
  const iconStart = root.querySelector('.theme-flip__icon--start') as HTMLElement;
  const iconEnd = root.querySelector('.theme-flip__icon--end') as HTMLElement;

  veil.style.background = destBg(to);
  iconStart.style.color = startColor;
  iconEnd.style.color = endColor;

  gsap.set(veil, { clipPath: `circle(0px at ${cx}px ${cy}px)` });
  gsap.set(glow, {
    left: cx,
    top: cy,
    opacity: 0,
    scale: 0.4,
    background:
      to === 'dark'
        ? 'radial-gradient(circle, rgba(148,163,184,0.35) 0%, transparent 68%)'
        : 'radial-gradient(circle, rgba(251,191,36,0.38) 0%, transparent 68%)',
  });
  gsap.set(orb, {
    left: startX,
    top: startY,
    xPercent: -50,
    yPercent: -50,
    scale: 0.28,
    rotation: 0,
    opacity: 1,
  });
  gsap.set(iconStart, { opacity: 1, scale: 1, rotation: 0 });
  gsap.set(iconEnd, { opacity: 0, scale: 0.55, rotation: -55 });

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        root.remove();
        running = false;
        resolve();
      },
    });

    // 1) İkon ortaya uçar, büyür, döner
    tl.to(
      orb,
      {
        left: cx,
        top: cy,
        scale: 1,
        rotation: 210,
        duration: 0.58,
        ease: 'power3.out',
      },
      0
    );
    tl.to(
      glow,
      { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' },
      0.08
    );

    // 2) Ortada ikon değişimi (Ay ↔ Güneş)
    tl.to(
      iconStart,
      { opacity: 0, scale: 0.45, rotation: 70, duration: 0.3, ease: 'power2.in' },
      0.45
    );
    tl.to(
      iconEnd,
      { opacity: 1, scale: 1, rotation: 0, duration: 0.34, ease: 'back.out(1.7)' },
      0.52
    );
    tl.to(orb, { rotation: 360, duration: 0.48, ease: 'power2.inOut' }, 0.45);

    // 3) Dairesel renk yayılımı (parça parça / radial)
    tl.to(
      veil,
      {
        clipPath: `circle(150vmax at ${cx}px ${cy}px)`,
        duration: 0.9,
        ease: 'power3.inOut',
        onStart: () => onCommit(),
      },
      0.68
    );

    // 4) İkon kaybolur
    tl.to(
      [orb, glow],
      { opacity: 0, scale: 0.65, duration: 0.32, ease: 'power2.in' },
      1.22
    );
  });
}
