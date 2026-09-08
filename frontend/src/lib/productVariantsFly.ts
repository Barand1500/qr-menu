import gsap from 'gsap';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function clearOldGhosts() {
  document.querySelectorAll('.pv-fly-ghost').forEach((n) => n.remove());
}

/** Sağdaki grup kartlarını kopya ikonuna doğru “karadelik” gibi çek */
export function animateCopySuck(iconEl: HTMLElement | null) {
  if (!iconEl || prefersReducedMotion()) return Promise.resolve();
  clearOldGhosts();

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tour="pv-groups"] .pv-group')
  );
  if (!cards.length) {
    // Kart yoksa ikonu pulse et
    return new Promise<void>((resolve) => {
      gsap.fromTo(
        iconEl,
        { scale: 1 },
        {
          scale: 1.25,
          duration: 0.18,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
          onComplete: () => resolve(),
        }
      );
    });
  }

  const ir = iconEl.getBoundingClientRect();
  const tx = ir.left + ir.width / 2;
  const ty = ir.top + ir.height / 2;

  return new Promise<void>((resolve) => {
    let left = cards.length;
    const done = () => {
      left -= 1;
      if (left <= 0) {
        gsap.fromTo(
          iconEl,
          { scale: 1.35 },
          { scale: 1, duration: 0.28, ease: 'back.out(2)', onComplete: () => resolve() }
        );
      }
    };

    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.classList.add('pv-fly-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = [
        'position:fixed',
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'margin:0',
        'z-index:120',
        'pointer-events:none',
        'overflow:hidden',
        'transform-origin:center center',
        'box-shadow:0 16px 40px rgba(28,25,23,0.18)',
      ].join(';');
      document.body.appendChild(ghost);

      gsap.to(ghost, {
        x: tx - (rect.left + rect.width / 2),
        y: ty - (rect.top + rect.height / 2),
        scale: 0.06,
        opacity: 0,
        borderRadius: 999,
        duration: 0.55,
        delay: i * 0.07,
        ease: 'power3.in',
        onComplete: () => {
          ghost.remove();
          done();
        },
      });
    });
  });
}

/** Yapıştır ikonundan grup kartlarına doğru “dışarı fışkırma” */
export function animatePasteBurst(iconEl: HTMLElement | null, cardEls: HTMLElement[]) {
  if (!iconEl || !cardEls.length || prefersReducedMotion()) {
    return Promise.resolve();
  }
  clearOldGhosts();

  const ir = iconEl.getBoundingClientRect();

  return new Promise<void>((resolve) => {
    let left = cardEls.length;
    const done = () => {
      left -= 1;
      if (left <= 0) resolve();
    };

    cardEls.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const ghost = card.cloneNode(true) as HTMLElement;
      ghost.classList.add('pv-fly-ghost', 'pv-fly-ghost--burst');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = [
        'position:fixed',
        `left:${ir.left}px`,
        `top:${ir.top}px`,
        `width:${ir.width}px`,
        `height:${ir.height}px`,
        'margin:0',
        'z-index:120',
        'pointer-events:none',
        'overflow:hidden',
        'transform-origin:center center',
        'border-radius:999px',
        'opacity:0.95',
      ].join(';');
      document.body.appendChild(ghost);
      gsap.set(card, { opacity: 0 });

      gsap.to(ghost, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: 18,
        opacity: 1,
        duration: 0.58,
        delay: i * 0.08,
        ease: 'power3.out',
        onComplete: () => {
          ghost.remove();
          gsap.to(card, { opacity: 1, duration: 0.18, onComplete: done });
        },
      });
    });
  });
}

export function waitFrames(n = 2) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

export async function waitForGroupCards(maxTries = 24) {
  for (let i = 0; i < maxTries; i++) {
    await waitFrames(1);
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-tour="pv-groups"] .pv-group')
    );
    if (cards.length) return cards;
  }
  return [] as HTMLElement[];
}
