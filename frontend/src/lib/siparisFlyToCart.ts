import { gsap, prefersReducedMotion } from '@/lib/gsapSetup';

const CART_SEL = '[data-siparis-cart-target]';

function visibleCartTarget(): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(CART_SEL));
  for (const el of nodes) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return nodes[0] ?? null;
}

/** Ürün görseli / butondan sepet ikonuna uçuş */
export function siparisFlyToCart(
  fromEl: HTMLElement | null | undefined,
  imageUrl?: string | null
) {
  const target = visibleCartTarget();
  if (!fromEl || !target) return;

  if (prefersReducedMotion()) {
    target.classList.add('is-cart-bump');
    window.setTimeout(() => target.classList.remove('is-cart-bump'), 420);
    return;
  }

  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(56, Math.max(36, from.width * 0.35));

  const flyer = document.createElement('div');
  flyer.className = 'siparis-fly';
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.style.left = `${from.left + from.width / 2 - size / 2}px`;
  flyer.style.top = `${from.top + from.height / 2 - size / 2}px`;

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    flyer.appendChild(img);
  } else {
    flyer.classList.add('siparis-fly--dot');
    flyer.textContent = '+';
  }

  document.body.appendChild(flyer);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  gsap.to(flyer, {
    x: dx,
    y: dy,
    scale: 0.28,
    opacity: 0.35,
    duration: 0.65,
    ease: 'power2.in',
    onComplete: () => {
      flyer.remove();
      target.classList.add('is-cart-bump');
      window.setTimeout(() => target.classList.remove('is-cart-bump'), 420);
    },
  });
}
